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
function askQuestion(
  rl: readline.Interface,
  question: string
): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer)
    })
  })
}

async function main() {
  console.log('🔄 Stock Movements Reset Script')
  console.log('')
  console.log('This script will delete the following data:')
  console.log('  - All Stock Movements')
  console.log('  - All Batches (if they exist)')
  console.log('  - All Batch Usages (if they exist)')
  console.log('')
  console.log('The following data will be preserved:')
  console.log('  - All Users')
  console.log('  - All Raw Materials')
  console.log('  - All Finished Goods')
  console.log('  - All Drums')
  console.log('  - All Locations')
  console.log('  - All Finished Good Stocks')
  console.log('')
  console.log('⚠️  WARNING: This action cannot be undone!')
  console.log('')

  const rl = createReadlineInterface()

  // Count records to be deleted
  const [stockMovementsCount, batchesCount, batchUsagesCount] =
    await Promise.all([
      prisma.stockMovement.count(),
      prisma.batch.count(),
      prisma.batchUsage.count(),
    ])

  console.log('📊 Records to be deleted:')
  console.log(`  - Stock Movements: ${stockMovementsCount}`)
  console.log(`  - Batches: ${batchesCount}`)
  console.log(`  - Batch Usages: ${batchUsagesCount}`)
  console.log('')

  const confirmation = await askQuestion(rl, 'Type "RESET" to confirm: ')

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
      // 1. Delete BatchUsages first (references Batch)
      if (batchUsagesCount > 0) {
        console.log('  Deleting Batch Usages...')
        await tx.batchUsage.deleteMany({})
      }

      // 2. Delete StockMovements (references Batch, but onDelete: SetNull, so safe to delete first)
      console.log('  Deleting Stock Movements...')
      await tx.stockMovement.deleteMany({})

      // 3. Delete Batches (BatchUsage has onDelete: Cascade, but we already deleted them)
      if (batchesCount > 0) {
        console.log('  Deleting Batches...')
        await tx.batch.deleteMany({})
      }
    })

    console.log('')
    console.log('✅ Reset completed successfully!')
    console.log('')
    console.log('📝 Summary:')
    console.log(`  - Deleted ${stockMovementsCount} Stock Movements`)
    if (batchesCount > 0) {
      console.log(`  - Deleted ${batchesCount} Batches`)
    }
    if (batchUsagesCount > 0) {
      console.log(`  - Deleted ${batchUsagesCount} Batch Usages`)
    }
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
