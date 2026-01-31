/**
 * Phase 1 Test Script: Stock Calculation Verification
 * 
 * This script tests chronological stock calculation with various scenarios:
 * 1. Basic chronological calculation across different dates
 * 2. Same-day movement ordering
 * 3. Backdated movement validation
 * 
 * Run with: ts-node --compiler-options '{"module":"CommonJS"}' scripts/test-phase1-stock-calculation.ts
 */

import { PrismaClient } from '@prisma/client'
import {
  createStockMovement,
  calculateStockAtDate,
} from '../src/lib/services/stock-movement.service'
import { parseToWIB } from '../src/lib/timezone'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Phase 1: Stock Calculation Verification ===\n')

  try {
    // Find or create a test raw material
    let testMaterial = await prisma.rawMaterial.findFirst({
      where: { kode: 'TEST-PHASE1' },
    })

    if (!testMaterial) {
      testMaterial = await prisma.rawMaterial.create({
        data: {
          kode: 'TEST-PHASE1',
          name: 'Test Material Phase 1',
          currentStock: 0,
          moq: 10,
        },
      })
      console.log(`Created test material: ${testMaterial.name} (${testMaterial.id})`)
    } else {
      console.log(`Using existing test material: ${testMaterial.name} (${testMaterial.id})`)
    }

    // Find or create a test drum
    let testDrum = await prisma.drum.findFirst({
      where: {
        rawMaterialId: testMaterial.id,
        label: 'DRUM-TEST-1',
      },
    })

    if (!testDrum) {
      testDrum = await prisma.drum.create({
        data: {
          label: 'DRUM-TEST-1',
          currentQuantity: 0,
          rawMaterialId: testMaterial.id,
          isActive: true,
        },
      })
      console.log(`Created test drum: ${testDrum.label} (${testDrum.id})`)
    } else {
      console.log(`Using existing test drum: ${testDrum.label} (${testDrum.id})`)
    }

    // Clean up any existing test movements
    await prisma.stockMovement.deleteMany({
      where: {
        rawMaterialId: testMaterial.id,
        drumId: testDrum.id,
      },
    })
    console.log('Cleaned up existing test movements\n')

    // Reset stock
    await prisma.rawMaterial.update({
      where: { id: testMaterial.id },
      data: { currentStock: 0 },
    })
    await prisma.drum.update({
      where: { id: testDrum.id },
      data: { currentQuantity: 0 },
    })

    console.log('=== Test 1.1: Basic Chronological Calculation ===')
    console.log('Creating movements on different dates...\n')

    // Create movements on different dates
    const date1 = parseToWIB('2025-01-01')
    const date2 = parseToWIB('2025-01-02')
    const date3 = parseToWIB('2025-01-03')

    // Movement 1: Jan 1 - IN 100
    console.log('Creating: Jan 1 - IN 100')
    const movement1 = await createStockMovement({
      type: 'IN',
      quantity: 100,
      date: date1,
      description: 'Test Phase 1 - Movement 1',
      rawMaterialId: testMaterial.id,
      drumId: testDrum.id,
    })
    console.log(`  Created: ${movement1.id} at ${movement1.createdAt.toISOString()}`)

    // Check stock at end of Jan 1
    const stockEndJan1 = await calculateStockAtDate(
      testMaterial.id,
      'raw-material',
      new Date(date1.getTime() + 24 * 60 * 60 * 1000), // Next day
      null,
      testDrum.id
    )
    console.log(`  Stock at end of Jan 1: ${stockEndJan1} (expected: 100)\n`)

    // Movement 2: Jan 2 - OUT 30
    console.log('Creating: Jan 2 - OUT 30')
    const movement2 = await createStockMovement({
      type: 'OUT',
      quantity: 30,
      date: date2,
      description: 'Test Phase 1 - Movement 2',
      rawMaterialId: testMaterial.id,
      drumId: testDrum.id,
    })
    console.log(`  Created: ${movement2.id} at ${movement2.createdAt.toISOString()}`)

    // Check stock at end of Jan 2
    const stockEndJan2 = await calculateStockAtDate(
      testMaterial.id,
      'raw-material',
      new Date(date2.getTime() + 24 * 60 * 60 * 1000), // Next day
      null,
      testDrum.id
    )
    console.log(`  Stock at end of Jan 2: ${stockEndJan2} (expected: 70)\n`)

    // Movement 3: Jan 3 - IN 50
    console.log('Creating: Jan 3 - IN 50')
    const movement3 = await createStockMovement({
      type: 'IN',
      quantity: 50,
      date: date3,
      description: 'Test Phase 1 - Movement 3',
      rawMaterialId: testMaterial.id,
      drumId: testDrum.id,
    })
    console.log(`  Created: ${movement3.id} at ${movement3.createdAt.toISOString()}`)

    // Check stock at end of Jan 3
    const stockEndJan3 = await calculateStockAtDate(
      testMaterial.id,
      'raw-material',
      new Date(date3.getTime() + 24 * 60 * 60 * 1000), // Next day
      null,
      testDrum.id
    )
    console.log(`  Stock at end of Jan 3: ${stockEndJan3} (expected: 120)\n`)

    // Verify final stock
    const finalMaterial = await prisma.rawMaterial.findUnique({
      where: { id: testMaterial.id },
    })
    const finalDrum = await prisma.drum.findUnique({
      where: { id: testDrum.id },
    })
    console.log(`Final aggregate stock: ${finalMaterial?.currentStock} (expected: 120)`)
    console.log(`Final drum stock: ${finalDrum?.currentQuantity} (expected: 120)\n`)

    console.log('=== Test 1.2: Same-Day Movement Ordering ===')
    console.log('Creating multiple movements on same day...\n')

    // Clean up for next test
    await prisma.stockMovement.deleteMany({
      where: {
        rawMaterialId: testMaterial.id,
        drumId: testDrum.id,
      },
    })
    await prisma.rawMaterial.update({
      where: { id: testMaterial.id },
      data: { currentStock: 0 },
    })
    await prisma.drum.update({
      where: { id: testDrum.id },
      data: { currentQuantity: 0 },
    })

    const sameDay = parseToWIB('2025-01-05')

    // Movement A: Jan 5, 10:00 AM - IN 100
    console.log('Creating: Jan 5, 10:00 AM - IN 100')
    const movementA = await createStockMovement({
      type: 'IN',
      quantity: 100,
      date: sameDay,
      description: 'Test Phase 1 - Movement A (10:00 AM)',
      rawMaterialId: testMaterial.id,
      drumId: testDrum.id,
    })
    console.log(`  Created: ${movementA.id} at ${movementA.createdAt.toISOString()}`)

    // Wait a bit to ensure different createdAt
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Movement B: Jan 5, 11:00 AM - OUT 30
    console.log('Creating: Jan 5, 11:00 AM - OUT 30')
    const movementB = await createStockMovement({
      type: 'OUT',
      quantity: 30,
      date: sameDay,
      description: 'Test Phase 1 - Movement B (11:00 AM)',
      rawMaterialId: testMaterial.id,
      drumId: testDrum.id,
    })
    console.log(`  Created: ${movementB.id} at ${movementB.createdAt.toISOString()}`)

    // Wait a bit more
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Movement C: Jan 5, 12:00 PM - OUT 20
    console.log('Creating: Jan 5, 12:00 PM - OUT 20')
    const movementC = await createStockMovement({
      type: 'OUT',
      quantity: 20,
      date: sameDay,
      description: 'Test Phase 1 - Movement C (12:00 PM)',
      rawMaterialId: testMaterial.id,
      drumId: testDrum.id,
    })
    console.log(`  Created: ${movementC.id} at ${movementC.createdAt.toISOString()}\n`)

    // Check stock at end of Jan 5
    const stockEndJan5 = await calculateStockAtDate(
      testMaterial.id,
      'raw-material',
      new Date(sameDay.getTime() + 24 * 60 * 60 * 1000), // Next day
      null,
      testDrum.id
    )
    console.log(`  Stock at end of Jan 5: ${stockEndJan5} (expected: 50)\n`)

    // Verify chronological order by checking stock before each movement
    console.log('Verifying chronological order...')
    const stockBeforeA = await calculateStockAtDate(
      testMaterial.id,
      'raw-material',
      sameDay,
      null,
      testDrum.id,
      null,
      movementA.createdAt
    )
    console.log(`  Stock before Movement A: ${stockBeforeA} (expected: 0)`)

    const stockBeforeB = await calculateStockAtDate(
      testMaterial.id,
      'raw-material',
      sameDay,
      null,
      testDrum.id,
      null,
      movementB.createdAt
    )
    console.log(`  Stock before Movement B: ${stockBeforeB} (expected: 100)`)

    const stockBeforeC = await calculateStockAtDate(
      testMaterial.id,
      'raw-material',
      sameDay,
      null,
      testDrum.id,
      null,
      movementC.createdAt
    )
    console.log(`  Stock before Movement C: ${stockBeforeC} (expected: 70)\n`)

    console.log('=== Test 1.3: Backdated Movement Validation ===')
    console.log('Testing backdated movement with validation...\n')

    // Try to create a backdated OUT movement that should fail (insufficient stock)
    console.log('Attempting: Jan 4 (backdated) - OUT 60 (should fail - no stock)')
    try {
      const backdatedMovement = await createStockMovement({
        type: 'OUT',
        quantity: 60,
        date: parseToWIB('2025-01-04'), // Before Jan 5
        description: 'Test Phase 1 - Backdated Movement (should fail)',
        rawMaterialId: testMaterial.id,
        drumId: testDrum.id,
      })
      console.log(`  ERROR: Movement created but should have failed! ${backdatedMovement.id}`)
    } catch (error) {
      console.log(`  ✓ Correctly rejected: ${(error as Error).message}`)
    }

    // Create a valid backdated IN movement
    console.log('\nCreating: Jan 4 (backdated) - IN 50 (should succeed)')
    const backdatedIN = await createStockMovement({
      type: 'IN',
      quantity: 50,
      date: parseToWIB('2025-01-04'),
      description: 'Test Phase 1 - Backdated IN Movement',
      rawMaterialId: testMaterial.id,
      drumId: testDrum.id,
    })
    console.log(`  Created: ${backdatedIN.id} at ${backdatedIN.createdAt.toISOString()}`)

    // Now the backdated OUT should work
    console.log('\nAttempting: Jan 4 (backdated) - OUT 30 (should succeed now)')
    const backdatedOUT = await createStockMovement({
      type: 'OUT',
      quantity: 30,
      date: parseToWIB('2025-01-04'),
      description: 'Test Phase 1 - Backdated OUT Movement',
      rawMaterialId: testMaterial.id,
      drumId: testDrum.id,
    })
    console.log(`  Created: ${backdatedOUT.id} at ${backdatedOUT.createdAt.toISOString()}`)

    // Verify final stock
    const finalStock = await calculateStockAtDate(
      testMaterial.id,
      'raw-material',
      new Date('2025-01-06'),
      null,
      testDrum.id
    )
    console.log(`\nFinal calculated stock: ${finalStock} (expected: 70)`)
    console.log('  Breakdown: +50 (Jan 4 IN) -30 (Jan 4 OUT) +100 (Jan 5 IN) -30 (Jan 5 OUT) -20 (Jan 5 OUT) = 70\n')

    console.log('=== Phase 1 Tests Complete ===')
    console.log('\nCheck the debug log file for detailed instrumentation logs:')
    console.log('.cursor/debug.log\n')
  } catch (error) {
    console.error('Test failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })


