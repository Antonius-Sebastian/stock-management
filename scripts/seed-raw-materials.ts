/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client'
import { parse } from 'fast-csv'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

/**
 * Default MOQ value for raw materials when not specified in CSV
 */
const DEFAULT_MOQ = 1

/**
 * Parse CSV file and extract raw materials
 *
 * CSV structure:
 * - Row 1: Header row (skip)
 * - Row 2 onwards: Data rows
 *   - Column 0: Row number (1, 2, 3...)
 *   - Column 1: Code (e.g., "200HP01")
 *   - Column 2: Name (e.g., "HPMC")
 *   - Column 3: Supplier (optional)
 *   - Column 4: Category/Description (optional)
 */
async function parseCSV(
  filePath: string
): Promise<Array<{ kode: string; name: string; moq: number }>> {
  return new Promise((resolve, reject) => {
    const materials: Array<{ kode: string; name: string; moq: number }> = []
    let isFirstRow = true

    const stream = fs.createReadStream(filePath).pipe(parse({ headers: false }))

    stream.on('data', (row: string[]) => {
      // Skip completely empty rows
      if (row.every((cell) => !cell || cell.trim() === '')) {
        return
      }

      // Skip header row (first data row)
      if (isFirstRow) {
        isFirstRow = false
        return
      }

      // Extract data from columns
      // Column 0: Row number (skip)
      // Column 1: Code
      // Column 2: Name
      const kode = row[1]?.trim()
      const name = row[2]?.trim()

      // Validate required fields
      if (kode && name && kode.length > 0 && name.length > 0) {
        materials.push({
          kode,
          name,
          moq: DEFAULT_MOQ,
        })
      }
    })

    stream.on('end', () => {
      resolve(materials)
    })

    stream.on('error', (error) => {
      reject(error)
    })
  })
}

async function main() {
  console.log('🌱 Starting Raw Materials Seed...')
  console.log('')

  const csvPath = path.join(process.cwd(), '05 Stok Opname Bahan Baku 2025.csv')

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV file not found: ${csvPath}`)
    process.exit(1)
  }

  console.log(`📄 Reading CSV file: ${csvPath}`)
  const materials = await parseCSV(csvPath)

  if (materials.length === 0) {
    console.error('❌ No raw materials found in CSV file')
    process.exit(1)
  }

  console.log(`📦 Found ${materials.length} raw materials to seed`)
  console.log('')

  // Remove duplicates based on kode (code is unique)
  const uniqueMaterials = Array.from(
    new Map(materials.map((m) => [m.kode, m])).values()
  )

  console.log(
    `📊 After removing duplicates: ${uniqueMaterials.length} unique materials`
  )
  console.log('')

  console.log('🔄 Creating raw materials...')
  console.log(`   Using default MOQ: ${DEFAULT_MOQ}`)
  console.log('')

  let created = 0
  let skipped = 0
  let errors = 0

  try {
    for (const material of uniqueMaterials) {
      try {
        const existing = await prisma.rawMaterial.findUnique({
          where: { kode: material.kode },
        })

        if (existing) {
          skipped++
          console.log(
            `  🔄 Already exists: ${material.kode} - ${material.name}`
          )
        } else {
          await prisma.rawMaterial.create({
            data: {
              kode: material.kode,
              name: material.name,
              moq: material.moq,
              currentStock: 0,
            },
          })
          created++
          console.log(`  ✅ Created: ${material.kode} - ${material.name}`)
        }
      } catch (error) {
        errors++
        console.error(
          `  ⚠️  Error with ${material.kode} - ${material.name}:`,
          error instanceof Error ? error.message : error
        )
      }
    }

    console.log('')
    console.log('🎉 Seed completed!')
    console.log('')
    console.log('📝 Summary:')
    console.log(`  - Created: ${created}`)
    console.log(`  - Already exists: ${skipped}`)
    console.log(`  - Errors: ${errors}`)
    console.log(`  - Total processed: ${uniqueMaterials.length}`)
  } catch (error) {
    console.error('')
    console.error('❌ Seed failed:', error)
    throw error
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Error:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
