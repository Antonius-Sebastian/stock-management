import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import ExcelJS from 'exceljs'
import { auth } from '@/auth'
import { canExportReports, getPermissionErrorMessage } from '@/lib/rbac'
import { logger } from '@/lib/logger'

const exportReportSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2030),
  month: z.coerce.number().int().min(1).max(12),
  type: z.enum(['raw-materials', 'finished-goods']),
  locationId: z.string().optional(), // Optional locationId for finished goods
})

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

interface ItemData {
  id: string
  name: string
  code: string
  [key: string]: string | number // For dynamic day columns
}

export async function GET(request: NextRequest) {
  try {
    // Authentication and authorization required (all authenticated users can export reports)
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canExportReports(session.user.role)) {
      return NextResponse.json(
        {
          error: getPermissionErrorMessage('export reports', session.user.role),
        },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const query = {
      year: searchParams.get('year'),
      month: searchParams.get('month'),
      type: searchParams.get('type'),
      locationId: searchParams.get('locationId') || undefined,
    }

    const validatedQuery = exportReportSchema.parse(query)

    // Generate date range for the month
    const startDate = new Date(validatedQuery.year, validatedQuery.month - 1, 1)
    const endDate = new Date(validatedQuery.year, validatedQuery.month, 0)
    const daysInMonth = endDate.getDate()

    // Only export data up to current date for current month, all days for past months
    const today = new Date()
    const isCurrentMonth =
      today.getFullYear() === validatedQuery.year &&
      today.getMonth() === validatedQuery.month - 1
    const isFutureMonth =
      validatedQuery.year > today.getFullYear() ||
      (validatedQuery.year === today.getFullYear() &&
        validatedQuery.month - 1 > today.getMonth())

    const maxDay = isFutureMonth
      ? 0
      : isCurrentMonth
        ? today.getDate()
        : daysInMonth

    // Handle edge case: future months have no data yet
    if (maxDay === 0) {
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'Stock Management System'
      workbook.created = new Date()

      const worksheet = workbook.addWorksheet('No Data')
      worksheet.addRow(['No data available for future months'])
      worksheet.addRow(['Please select current or past month to export data'])

      const buffer = await workbook.xlsx.writeBuffer()
      const monthName = MONTH_NAMES[validatedQuery.month - 1]
      const reportTypeName =
        validatedQuery.type === 'raw-materials' ? 'Bahan_Baku' : 'Produk_Jadi'
      const filename = `Laporan_${reportTypeName}_${monthName}_${validatedQuery.year}.xlsx`

      return new NextResponse(buffer, {
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    }

    // Get all items based on type
    const items =
      validatedQuery.type === 'raw-materials'
        ? await prisma.rawMaterial.findMany({
            include: {
              stockMovements: {
                orderBy: { date: 'asc' },
              },
            },
          })
        : await prisma.finishedGood.findMany({
            include: {
              stockMovements: {
                orderBy: { date: 'asc' },
              },
            },
          })

    /**
     * Calculate stock data for a specific data type (stok-awal, masuk, keluar, sisa)
     *
     * This function processes all items and calculates daily stock values based on:
     * - Opening stock: Cumulative balance from all movements before the month
     * - Daily movements: IN and OUT movements for each day
     * - Running balance: Stock level that carries forward day-to-day
     *
     * @param dataType - One of: "stok-awal", "stok-masuk", "stok-keluar", "stok-sisa"
     * @returns Array of item data with daily stock values
     */
    const calculateStockData = (dataType: string): ItemData[] => {
      const results = items.map((item) => {
        const itemData: ItemData = {
          id: item.id,
          name: item.name,
          code: 'kode' in item ? (item as { kode?: string }).kode || '' : '',
        }

        // Filter movements by locationId for finished goods if provided
        let filteredMovements = item.stockMovements
        if (
          validatedQuery.type === 'finished-goods' &&
          validatedQuery.locationId
        ) {
          filteredMovements = item.stockMovements.filter(
            (movement) => movement.locationId === validatedQuery.locationId
          )
        }

        // Step 1: Calculate opening stock (stock at start of month)
        // Sum all movements that happened before the selected month
        const movementsBeforeMonth = filteredMovements.filter((movement) => {
          const movementDate = new Date(movement.date)
          return movementDate < startDate
        })

        let openingStock = 0
        for (const movement of movementsBeforeMonth) {
          if (movement.type === 'IN') {
            openingStock += movement.quantity
          } else {
            openingStock -= movement.quantity
          }
        }

        // Step 2: Get all movements within the selected month
        const movementsInMonth = filteredMovements.filter((movement) => {
          const movementDate = new Date(movement.date)
          return movementDate >= startDate && movementDate <= endDate
        })

        // Track if item has movements for filtering
        const hasMovements = movementsInMonth.length > 0

        // Step 3: Process each day and calculate stock values
        let runningStock = openingStock // Start with opening balance

        for (let day = 1; day <= maxDay; day++) {
          const dayKey = day.toString()

          // Get movements for this specific day
          const dayMovements = movementsInMonth.filter((movement) => {
            const movementDate = new Date(movement.date)
            return (
              movementDate.getDate() === day &&
              movementDate.getMonth() === validatedQuery.month - 1 &&
              movementDate.getFullYear() === validatedQuery.year
            )
          })

          // Calculate total IN and OUT for this day
          // Note: This includes all IN movements regardless of drumId (for raw materials)
          // All movements with type === 'IN' are included in the calculation
          const inQty = dayMovements
            .filter((m) => m.type === 'IN')
            .reduce((sum, m) => sum + m.quantity, 0)

          const outQty = dayMovements
            .filter((m) => m.type === 'OUT')
            .reduce((sum, m) => sum + m.quantity, 0)

          // Set value based on data type
          switch (dataType) {
            case 'stok-awal':
              // Stock at START of day (before any movements)
              itemData[dayKey] = runningStock
              break
            case 'stok-masuk':
              // Total stock that came IN during the day
              itemData[dayKey] = inQty
              break
            case 'stok-keluar':
              // Total stock that went OUT during the day
              itemData[dayKey] = outQty
              break
            case 'stok-sisa':
              // Stock at END of day (after all movements)
              // Formula: Opening + IN - OUT
              itemData[dayKey] = runningStock + inQty - outQty
              break
          }

          // Update running stock for next day's "stok-awal"
          runningStock = runningStock + inQty - outQty
        }

        return { itemData, hasMovements, openingStock }
      })

      // Filter out items with no movements and zero opening stock
      return results
        .filter((item) => {
          // If item has movements in this month, include it
          if (item.hasMovements) return true

          // If item has opening stock, include it (even without movements this month)
          if (item.openingStock > 0) return true

          // Otherwise exclude it
          return false
        })
        .map((item) => item.itemData)
    }

    // Handle edge case: no items in database
    if (items.length === 0) {
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'Stock Management System'
      workbook.created = new Date()

      const worksheet = workbook.addWorksheet('No Items')
      worksheet.addRow(['No items found in the system'])
      worksheet.addRow(['Please add raw materials or finished goods first'])

      const buffer = await workbook.xlsx.writeBuffer()
      const monthName = MONTH_NAMES[validatedQuery.month - 1]
      const reportTypeName =
        validatedQuery.type === 'raw-materials' ? 'Bahan_Baku' : 'Produk_Jadi'
      const filename = `Laporan_${reportTypeName}_${monthName}_${validatedQuery.year}.xlsx`

      return new NextResponse(buffer, {
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    }

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Stock Management System'
    workbook.created = new Date()

    // Define the 4 data types with color themes
    const dataTypes = [
      {
        key: 'stok-awal',
        label: 'Stok Awal',
        color: '1E3A8A', // Navy Blue
        description: 'Stok di awal hari sebelum ada pergerakan',
      },
      {
        key: 'stok-masuk',
        label: 'Stok Masuk',
        color: '15803D', // Forest Green
        description: 'Total barang masuk selama hari tersebut',
      },
      {
        key: 'stok-keluar',
        label: 'Stok Keluar',
        color: 'B91C1C', // Crimson Red
        description: 'Total barang keluar selama hari tersebut',
      },
      {
        key: 'stok-sisa',
        label: 'Stok Sisa',
        color: '6D28D9', // Royal Purple
        description: 'Stok di akhir hari setelah semua pergerakan',
      },
    ]

    // Helper function to get max stock value for conditional formatting
    const getMaxStockValue = (
      sheetData: ItemData[],
      maxDay: number
    ): number => {
      let max = 0
      for (const item of sheetData) {
        for (let day = 1; day <= maxDay; day++) {
          const value = item[day.toString()]
          if (typeof value === 'number' && value > max) {
            max = value
          }
        }
      }
      return max
    }

    // Get location name if locationId is provided for finished goods
    let locationName: string | null = null
    if (
      validatedQuery.type === 'finished-goods' &&
      validatedQuery.locationId
    ) {
      const location = await prisma.location.findUnique({
        where: { id: validatedQuery.locationId },
        select: { name: true },
      })
      locationName = location?.name || null
    }

    // Create a sheet for each data type
    for (const dataType of dataTypes) {
      const sheetData = calculateStockData(dataType.key)
      const worksheet = workbook.addWorksheet(dataType.label)

      // Add professional header section
      const monthName = MONTH_NAMES[validatedQuery.month - 1]
      const reportTypeName =
        validatedQuery.type === 'raw-materials' ? 'BAHAN BAKU' : 'PRODUK JADI'
      const locationText = locationName ? ` - ${locationName}` : ''
      const currentDate = new Date()
      const formattedDate = `${currentDate.getDate()} ${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()} ${currentDate.getHours().toString().padStart(2, '0')}:${currentDate.getMinutes().toString().padStart(2, '0')}`

      // Row 1: Report Title
      worksheet.mergeCells('A1:E1')
      const titleCell = worksheet.getCell('A1')
      titleCell.value = `LAPORAN STOK ${reportTypeName}${locationText}`
      titleCell.font = {
        size: 14,
        bold: true,
        color: { argb: 'FF' + dataType.color },
      }
      titleCell.alignment = { horizontal: 'left', vertical: 'middle' }
      worksheet.getRow(1).height = 24

      // Row 2: Period
      worksheet.mergeCells('A2:E2')
      const periodCell = worksheet.getCell('A2')
      periodCell.value = `Periode: ${monthName} ${validatedQuery.year}`
      periodCell.font = { size: 11, bold: false }
      periodCell.alignment = { horizontal: 'left', vertical: 'middle' }
      worksheet.getRow(2).height = 18

      // Row 3: Sheet description
      worksheet.mergeCells('A3:E3')
      const descCell = worksheet.getCell('A3')
      descCell.value = dataType.description
      descCell.font = { size: 10, italic: true, color: { argb: 'FF666666' } }
      descCell.alignment = { horizontal: 'left', vertical: 'middle' }
      worksheet.getRow(3).height = 18

      // Row 4: Generated timestamp
      worksheet.mergeCells('A4:E4')
      const timestampCell = worksheet.getCell('A4')
      timestampCell.value = `Dicetak: ${formattedDate}`
      timestampCell.font = { size: 9, color: { argb: 'FF999999' } }
      timestampCell.alignment = { horizontal: 'left', vertical: 'middle' }
      worksheet.getRow(4).height = 16

      // Row 5: Blank spacer
      worksheet.getRow(5).height = 8

      // Row 6: Column headers
      const headerRow = ['Kode', 'Nama']
      for (let day = 1; day <= maxDay; day++) {
        headerRow.push(day.toString())
      }

      worksheet.addRow(headerRow) // This will be row 6

      // Style header row (row 6)
      const headerRowObj = worksheet.getRow(6)
      headerRowObj.height = 24
      headerRowObj.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
      headerRowObj.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF' + dataType.color },
      }
      headerRowObj.alignment = { horizontal: 'center', vertical: 'middle' }

      // Add data rows
      // For Stok Awal and Stok Sisa: show zeros (meaningful - indicates no stock)
      // For Stok Masuk and Stok Keluar: show empty for zeros (no activity)
      const showZeros =
        dataType.key === 'stok-awal' || dataType.key === 'stok-sisa'
      const maxStockValue = getMaxStockValue(sheetData, maxDay)
      const lowStockThreshold = maxStockValue * 0.1 // 10% of max is considered low

      let rowIndex = 7 // Data starts at row 7 (after headers)
      for (const item of sheetData) {
        const row: (string | number)[] = [item.code, item.name]
        for (let day = 1; day <= maxDay; day++) {
          const value = item[day.toString()]
          if (typeof value === 'number') {
            if (value !== 0 || showZeros) {
              row.push(value) // Show number (including 0 for awal/sisa)
            } else {
              row.push('') // Empty for zero in masuk/keluar
            }
          } else {
            row.push('') // Empty for undefined
          }
        }
        const addedRow = worksheet.addRow(row)

        // Apply row styling
        addedRow.height = 20
        addedRow.font = { size: 10 }

        // Zebra striping (alternating row colors)
        if (rowIndex % 2 === 0) {
          addedRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF9FAFB' }, // Very light gray
          }
        }

        // Apply conditional formatting to each cell
        addedRow.eachCell((cell, colNumber) => {
          // Text columns (Kode, Nama) - left aligned
          if (colNumber <= 2) {
            cell.alignment = { horizontal: 'left', vertical: 'middle' }
            cell.font = { size: 10, bold: colNumber === 1 } // Bold for Kode
          } else {
            // Number columns - right aligned with thousand separator
            cell.alignment = { horizontal: 'right', vertical: 'middle' }

            if (typeof cell.value === 'number') {
              cell.numFmt = '#,##0' // Thousand separator

              // Conditional formatting based on value
              if (dataType.key === 'stok-sisa') {
                // For Stok Sisa sheet: highlight low/zero stock
                if (cell.value === 0) {
                  // Zero stock - light red background
                  cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFEE2E2' },
                  }
                  cell.font = {
                    size: 10,
                    color: { argb: 'FF991B1B' },
                    bold: true,
                  }
                } else if (
                  cell.value > 0 &&
                  cell.value <= lowStockThreshold &&
                  lowStockThreshold > 0
                ) {
                  // Low stock - yellow background
                  cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFEF3C7' },
                  }
                  cell.font = { size: 10, color: { argb: 'FF92400E' } }
                }
              } else if (
                dataType.key === 'stok-masuk' ||
                dataType.key === 'stok-keluar'
              ) {
                // For movement sheets: highlight high activity (>100 units)
                if (cell.value >= 100) {
                  cell.font = {
                    size: 10,
                    bold: true,
                    color: { argb: 'FF' + dataType.color },
                  }
                }
              }

              // Negative values - red text with pink background
              if (cell.value < 0) {
                cell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FFFECDD3' },
                }
                cell.font = {
                  size: 10,
                  color: { argb: 'FFB91C1C' },
                  bold: true,
                }
              }
            }
          }
        })

        rowIndex++
      }

      // Set column widths
      worksheet.getColumn(1).width = 15 // Kode
      worksheet.getColumn(2).width = 40 // Nama (wider to prevent overflow)
      for (let day = 1; day <= maxDay; day++) {
        worksheet.getColumn(day + 2).width = 12 // Day columns (fit 1,000,000 with separator)
      }

      // Enable text wrapping for Nama column to prevent overflow
      for (let i = 7; i <= worksheet.rowCount; i++) {
        const namaCell = worksheet.getCell(i, 2)
        namaCell.alignment = {
          ...namaCell.alignment,
          wrapText: true, // Enable text wrapping
        }
      }

      // Freeze first two columns and header rows
      worksheet.views = [
        {
          state: 'frozen',
          xSplit: 2,
          ySplit: 6, // Freeze first 6 rows (title section + headers)
          activeCell: 'C7',
        },
      ]

      // Add borders to all cells (starting from row 6 - headers)
      for (let i = 6; i <= worksheet.rowCount; i++) {
        const row = worksheet.getRow(i)
        row.eachCell((cell) => {
          // Thicker border for header row
          if (i === 6) {
            cell.border = {
              top: { style: 'medium' },
              left: { style: 'thin' },
              bottom: { style: 'medium' },
              right: { style: 'thin' },
            }
          } else {
            // Regular borders for data rows
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' },
            }
          }
        })
      }

      // Add thicker borders to first two columns for visual separation
      for (let i = 6; i <= worksheet.rowCount; i++) {
        const kodeCell = worksheet.getCell(i, 1)
        const namaCell = worksheet.getCell(i, 2)

        // Preserve existing border and just update right border
        kodeCell.border = {
          ...kodeCell.border,
          right: { style: 'medium' },
        }

        namaCell.border = {
          ...namaCell.border,
          right: { style: 'medium' },
        }
      }

      // Configure print settings
      worksheet.pageSetup = {
        paperSize: 9, // A4
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0, // Fit to width, unlimited height
        margins: {
          left: 0.75,
          right: 0.75,
          top: 0.75,
          bottom: 0.75,
          header: 0.3,
          footer: 0.3,
        },
        printTitlesRow: '6:6', // Repeat header row on each page
      }

      // Set print header and footer
      worksheet.headerFooter = {
        oddHeader: `&L&B${dataType.label}&R${monthName} ${validatedQuery.year}`,
        oddFooter: `&LStock Management System&C&P / &N&R${formattedDate}`,
      }
    }

    // Generate Excel buffer
    const buffer = await workbook.xlsx.writeBuffer()

    // Create filename
    const monthName = MONTH_NAMES[validatedQuery.month - 1]
    const reportTypeName =
      validatedQuery.type === 'raw-materials' ? 'Bahan_Baku' : 'Produk_Jadi'
    const locationSuffix = locationName
      ? `_${locationName.replace(/\s+/g, '_')}`
      : ''
    const filename = `Laporan_${reportTypeName}${locationSuffix}_${monthName}_${validatedQuery.year}.xlsx`

    // Return Excel file
    return new NextResponse(buffer, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    logger.error('Error exporting stock report:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to export stock report' },
      { status: 500 }
    )
  }
}
