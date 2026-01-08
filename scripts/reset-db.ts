/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client'
import * as readline from 'readline'

const prisma = new PrismaClient()

/**
 * Create readline interface for user input
 */
function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
}

/**
 * Prompt user for confirmation
 */
function askQuestion(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer)
    })
  })
}

async function main() {
  console.log('🔄 Database Reset Script')
  console.log('')
  console.log('This script will delete the following data:')
  console.log('  - All Stock Movements')
  console.log('  - All Batches')
  console.log('  - All Batch Usages')
  console.log('  - All Drums')
  console.log('  - All Locations')
  console.log('')
  console.log('The following data will be preserved:')
  console.log('  - All Users')
  console.log('  - All Raw Materials')
  console.log('  - All Finished Goods')
  console.log('  - All Finished Good Stocks')
  console.log('')
  console.log('⚠️  WARNING: This action cannot be undone!')
  console.log('')

  const rl = createReadlineInterface()

  // Count records to be deleted
  const [
    stockMovementsCount,
    batchesCount,
    batchUsagesCount,
    drumsCount,
    finishedGoodStocksCount,
    locationsCount,
  ] = await Promise.all([
    prisma.stockMovement.count(),
    prisma.batch.count(),
    prisma.batchUsage.count(),
    prisma.drum.count(),
    prisma.finishedGoodStock.count(),
    prisma.location.count(),
  ])

  console.log('📊 Records to be deleted:')
  console.log(`  - Stock Movements: ${stockMovementsCount}`)
  console.log(`  - Batches: ${batchesCount}`)
  console.log(`  - Batch Usages: ${batchUsagesCount}`)
  console.log(`  - Drums: ${drumsCount}`)
  console.log(`  - Finished Good Stocks: ${finishedGoodStocksCount}`)
  console.log(`  - Locations: ${locationsCount}`)
  console.log('')

  const confirmation = await askQuestion(
    rl,
    'Type "RESET" to confirm: '
  )

  rl.close()

  if (confirmation !== 'RESET') {
    console.log('❌ Reset cancelled.')
    return
  }

  console.log('')
  console.log('🔄 Starting reset...')

  try {
    // Use transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      // Delete in order to respect foreign key constraints
      // 1. Delete BatchUsages first (references Batch and Drum)
      console.log('  Deleting Batch Usages...')
      await tx.batchUsage.deleteMany({})

      // 2. Delete StockMovements (references Batch, Drum, Location, etc.)
      console.log('  Deleting Stock Movements...')
      await tx.stockMovement.deleteMany({})

      // 3. Delete Batches
      console.log('  Deleting Batches...')
      await tx.batch.deleteMany({})

      // 4. Delete Drums
      console.log('  Deleting Drums...')
      await tx.drum.deleteMany({})

      // 5. Delete FinishedGoodStock (references Location)
      console.log('  Deleting Finished Good Stocks...')
      await tx.finishedGoodStock.deleteMany({})

      // 6. Delete Locations
      console.log('  Deleting Locations...')
      await tx.location.deleteMany({})

      // 7. Reset currentStock for RawMaterials
      console.log('  Resetting Raw Material stock counts...')
      await tx.rawMaterial.updateMany({
        data: { currentStock: 0 },
      })

      // 8. Reset currentStock for FinishedGoods
      console.log('  Resetting Finished Good stock counts...')
      await tx.finishedGood.updateMany({
        data: { currentStock: 0 },
      })
    })

    console.log('')
    console.log('✅ Reset completed successfully!')
    console.log('')
    console.log('📝 Summary:')
    console.log(`  - Deleted ${stockMovementsCount} Stock Movements`)
    console.log(`  - Deleted ${batchesCount} Batches`)
    console.log(`  - Deleted ${batchUsagesCount} Batch Usages`)
    console.log(`  - Deleted ${drumsCount} Drums`)
    console.log(`  - Deleted ${finishedGoodStocksCount} Finished Good Stocks`)
    console.log(`  - Deleted ${locationsCount} Locations`)
    console.log('  - Reset all stock counts to 0')
  } catch (error) {
    console.error('')
    console.error('❌ Reset failed:', error)
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

