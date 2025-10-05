import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import ExcelJS from "exceljs";
import { auth } from "@/auth";
import { canExportReports, getPermissionErrorMessage } from "@/lib/rbac";

const exportReportSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2030),
  month: z.coerce.number().int().min(1).max(12),
  type: z.enum(["raw-materials", "finished-goods"]),
});

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

interface ItemData {
  id: string;
  name: string;
  code: string;
  [key: string]: string | number; // For dynamic day columns
}

export async function GET(request: NextRequest) {
  try {
    // Authentication and authorization required (all authenticated users can export reports)
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canExportReports(session.user.role)) {
      return NextResponse.json(
        { error: getPermissionErrorMessage("export reports", session.user.role) },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = {
      year: searchParams.get("year"),
      month: searchParams.get("month"),
      type: searchParams.get("type"),
    };

    const validatedQuery = exportReportSchema.parse(query);

    // Generate date range for the month
    const startDate = new Date(
      validatedQuery.year,
      validatedQuery.month - 1,
      1
    );
    const endDate = new Date(validatedQuery.year, validatedQuery.month, 0);
    const daysInMonth = endDate.getDate();

    // Only export data up to current date for current month, all days for past months
    const today = new Date();
    const isCurrentMonth =
      today.getFullYear() === validatedQuery.year &&
      today.getMonth() === validatedQuery.month - 1;
    const isFutureMonth =
      validatedQuery.year > today.getFullYear() ||
      (validatedQuery.year === today.getFullYear() &&
        validatedQuery.month - 1 > today.getMonth());

    const maxDay = isFutureMonth ? 0 : (isCurrentMonth ? today.getDate() : daysInMonth);

    // Handle edge case: future months have no data yet
    if (maxDay === 0) {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Stock Management System";
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet("No Data");
      worksheet.addRow(["No data available for future months"]);
      worksheet.addRow(["Please select current or past month to export data"]);

      const buffer = await workbook.xlsx.writeBuffer();
      const monthName = MONTH_NAMES[validatedQuery.month - 1];
      const reportTypeName = validatedQuery.type === "raw-materials" ? "Bahan_Baku" : "Produk_Jadi";
      const filename = `Laporan_${reportTypeName}_${monthName}_${validatedQuery.year}.xlsx`;

      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // Get all items based on type
    const items =
      validatedQuery.type === "raw-materials"
        ? await prisma.rawMaterial.findMany({
            include: {
              stockMovements: {
                orderBy: { date: "asc" },
              },
            },
          })
        : await prisma.finishedGood.findMany({
            include: {
              stockMovements: {
                orderBy: { date: "asc" },
              },
            },
          });

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
      return items.map((item) => {
        const itemData: ItemData = {
          id: item.id,
          name: item.name,
          code: "kode" in item ? (item as { kode?: string }).kode || "" : "",
        };

        // Step 1: Calculate opening stock (stock at start of month)
        // Sum all movements that happened before the selected month
        const movementsBeforeMonth = item.stockMovements.filter((movement) => {
          const movementDate = new Date(movement.date);
          return movementDate < startDate;
        });

        let openingStock = 0;
        for (const movement of movementsBeforeMonth) {
          if (movement.type === "IN") {
            openingStock += movement.quantity;
          } else {
            openingStock -= movement.quantity;
          }
        }

        // Step 2: Get all movements within the selected month
        const movementsInMonth = item.stockMovements.filter((movement) => {
          const movementDate = new Date(movement.date);
          return movementDate >= startDate && movementDate <= endDate;
        });

        // Step 3: Process each day and calculate stock values
        let runningStock = openingStock; // Start with opening balance

        for (let day = 1; day <= maxDay; day++) {
          const dayKey = day.toString();

          // Get movements for this specific day
          const dayMovements = movementsInMonth.filter((movement) => {
            const movementDate = new Date(movement.date);
            return (
              movementDate.getDate() === day &&
              movementDate.getMonth() === validatedQuery.month - 1 &&
              movementDate.getFullYear() === validatedQuery.year
            );
          });

          // Calculate total IN and OUT for this day
          const inQty = dayMovements
            .filter((m) => m.type === "IN")
            .reduce((sum, m) => sum + m.quantity, 0);

          const outQty = dayMovements
            .filter((m) => m.type === "OUT")
            .reduce((sum, m) => sum + m.quantity, 0);

          // Set value based on data type
          switch (dataType) {
            case "stok-awal":
              // Stock at START of day (before any movements)
              itemData[dayKey] = runningStock;
              break;
            case "stok-masuk":
              // Total stock that came IN during the day
              itemData[dayKey] = inQty;
              break;
            case "stok-keluar":
              // Total stock that went OUT during the day
              itemData[dayKey] = outQty;
              break;
            case "stok-sisa":
              // Stock at END of day (after all movements)
              // Formula: Opening + IN - OUT
              itemData[dayKey] = runningStock + inQty - outQty;
              break;
          }

          // Update running stock for next day's "stok-awal"
          runningStock = runningStock + inQty - outQty;
        }

        return itemData;
      });
    };

    // Handle edge case: no items in database
    if (items.length === 0) {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Stock Management System";
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet("No Items");
      worksheet.addRow(["No items found in the system"]);
      worksheet.addRow(["Please add raw materials or finished goods first"]);

      const buffer = await workbook.xlsx.writeBuffer();
      const monthName = MONTH_NAMES[validatedQuery.month - 1];
      const reportTypeName = validatedQuery.type === "raw-materials" ? "Bahan_Baku" : "Produk_Jadi";
      const filename = `Laporan_${reportTypeName}_${monthName}_${validatedQuery.year}.xlsx`;

      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Stock Management System";
    workbook.created = new Date();

    // Define the 4 data types
    const dataTypes = [
      { key: "stok-awal", label: "Stok Awal" },
      { key: "stok-masuk", label: "Stok Masuk" },
      { key: "stok-keluar", label: "Stok Keluar" },
      { key: "stok-sisa", label: "Stok Sisa" },
    ];

    // Create a sheet for each data type
    for (const dataType of dataTypes) {
      const sheetData = calculateStockData(dataType.key);
      const worksheet = workbook.addWorksheet(dataType.label);

      // Create header row (only up to current day for current month)
      const headerRow = ["Kode", "Nama"];
      for (let day = 1; day <= maxDay; day++) {
        headerRow.push(day.toString());
      }

      worksheet.addRow(headerRow);

      // Style header row
      const headerRowObj = worksheet.getRow(1);
      headerRowObj.font = { bold: true };
      headerRowObj.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      };
      headerRowObj.alignment = { horizontal: "center", vertical: "middle" };

      // Add data rows
      // For Stok Awal and Stok Sisa: show zeros (meaningful - indicates no stock)
      // For Stok Masuk and Stok Keluar: show empty for zeros (no activity)
      const showZeros = dataType.key === "stok-awal" || dataType.key === "stok-sisa";

      for (const item of sheetData) {
        const row: (string | number)[] = [item.code, item.name];
        for (let day = 1; day <= maxDay; day++) {
          const value = item[day.toString()];
          if (typeof value === "number") {
            if (value !== 0 || showZeros) {
              row.push(value); // Show number (including 0 for awal/sisa)
            } else {
              row.push(""); // Empty for zero in masuk/keluar
            }
          } else {
            row.push(""); // Empty for undefined
          }
        }
        worksheet.addRow(row);
      }

      // Set column widths
      worksheet.getColumn(1).width = 15; // Kode
      worksheet.getColumn(2).width = 30; // Nama
      for (let day = 1; day <= maxDay; day++) {
        worksheet.getColumn(day + 2).width = 10;
      }

      // Freeze first two columns and first row
      worksheet.views = [
        {
          state: "frozen",
          xSplit: 2,
          ySplit: 1,
          activeCell: "C2",
        },
      ];

      // Add borders to all cells
      worksheet.eachRow((row) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        });
      });
    }

    // Generate Excel buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Create filename
    const monthName = MONTH_NAMES[validatedQuery.month - 1];
    const reportTypeName = validatedQuery.type === "raw-materials" ? "Bahan_Baku" : "Produk_Jadi";
    const filename = `Laporan_${reportTypeName}_${monthName}_${validatedQuery.year}.xlsx`;

    // Return Excel file
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error exporting stock report:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to export stock report" },
      { status: 500 }
    );
  }
}
