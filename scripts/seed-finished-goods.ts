/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client'
import { parse } from 'fast-csv'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

/**
 * Parse CSV file and extract finished goods
 *
 * CSV structure:
 * - Row 3: Headers (No, Nama Produk, QTY, dates 1-31)
 * - Row 4: "5 Liter" header in column 2, dates in columns 3-33
 * - Rows 5-17: Products under 5 Liter (product name in column 2)
 * - Row 18: "1 Liter" header in column 2
 * - Rows 19-26: Products under 1 Liter (product name in column 2)
 * - Row 27: "20 Liter" header in column 2
 * - Rows 28-34: Products under 20 Liter (product name in column 2)
 */
async function parseCSV(
  filePath: string
): Promise<Array<{ name: string; size: string }>> {
  return new Promise((resolve, reject) => {
    const products: Array<{ name: string; size: string }> = []
    let currentSize = ''

    const stream = fs.createReadStream(filePath).pipe(parse({ headers: false }))

    stream.on('data', (row: string[]) => {
      // Skip completely empty rows
      if (row.every((cell) => !cell || cell.trim() === '')) {
        return
      }

      // Get column 2 (index 2) which contains size headers or product names
      const col2 = row[2]?.trim() || ''
      const col2Lower = col2.toLowerCase()

      // Check if column 2 contains a size header
      if (col2Lower.includes('liter')) {
        if (col2Lower === '5 liter' || col2Lower.startsWith('5 liter')) {
          currentSize = '5 Liter'
          return
        } else if (col2Lower === '1 liter' || col2Lower.startsWith('1 liter')) {
          currentSize = '1 Liter'
          return
        } else if (
          col2Lower === '20 liter' ||
          col2Lower.startsWith('20 liter')
        ) {
          currentSize = '20 Liter'
          return
        }
      }

      // Skip header rows
      const rowText = row.join(' ').toLowerCase()
      if (
        rowText.includes('no') ||
        rowText.includes('nama produk') ||
        rowText.includes('qty')
      ) {
        return
      }

      // Extract product name from column 2 (index 2)
      // Column structure: [empty, number, productName, ...]
      const productName = col2

      // Validate product name
      if (
        productName &&
        currentSize &&
        productName.length > 0 &&
        !col2Lower.includes('liter') &&
        !/^\d+$/.test(productName) // Not just a number
      ) {
        // Check if size is already in the product name
        const nameLower = productName.toLowerCase()
        const hasSizeInName =
          nameLower.includes('5liter') ||
          nameLower.includes('5 liter') ||
          nameLower.includes('1liter') ||
          nameLower.includes('1 liter') ||
          nameLower.includes('20liter') ||
          nameLower.includes('20 liter')

        // Create product name with size if not already included
        const finalName = hasSizeInName
          ? productName.trim()
          : `${productName.trim()} ${currentSize}`

        products.push({
          name: finalName,
          size: currentSize,
        })
      }
    })

    stream.on('end', () => {
      resolve(products)
    })

    stream.on('error', (error) => {
      reject(error)
    })
  })
}

async function main() {
  console.log('🌱 Starting Finished Goods Seed...')
  console.log('')

  const csvPath = path.join(process.cwd(), 'laporan stock.csv')

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV file not found: ${csvPath}`)
    process.exit(1)
  }

  console.log(`📄 Reading CSV file: ${csvPath}`)
  const products = await parseCSV(csvPath)

  if (products.length === 0) {
    console.error('❌ No products found in CSV file')
    process.exit(1)
  }

  console.log(`📦 Found ${products.length} products to seed`)
  console.log('')

  // Remove duplicates based on name
  const uniqueProducts = Array.from(
    new Map(products.map((p) => [p.name, p])).values()
  )

  console.log(
    `📊 After removing duplicates: ${uniqueProducts.length} unique products`
  )
  console.log('')

  console.log('🔄 Creating finished goods...')

  let created = 0
  let updated = 0
  let skipped = 0

  try {
    for (const product of uniqueProducts) {
      try {
        const existing = await prisma.finishedGood.findFirst({
          where: { name: product.name },
        })

        if (existing) {
          updated++
          console.log(`  🔄 Already exists: ${product.name}`)
        } else {
          await prisma.finishedGood.create({
            data: {
              name: product.name,
              currentStock: 0,
            },
          })
          created++
          console.log(`  ✅ Created: ${product.name}`)
        }
      } catch (error) {
        skipped++
        console.error(`  ⚠️  Skipped ${product.name}:`, error)
      }
    }

    console.log('')
    console.log('🎉 Seed completed!')
    console.log('')
    console.log('📝 Summary:')
    console.log(`  - Created: ${created}`)
    console.log(`  - Updated: ${updated}`)
    console.log(`  - Skipped: ${skipped}`)
    console.log(`  - Total: ${uniqueProducts.length}`)
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
