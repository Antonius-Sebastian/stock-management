import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting stock migration...')

  // 1. Ensure Default Location exists
  let defaultLocation = await prisma.location.findUnique({
    where: { name: 'Gudang Utama' },
  })

  if (!defaultLocation) {
    console.log('Creating default location: Gudang Utama')
    defaultLocation = await prisma.location.create({
      data: {
        name: 'Gudang Utama',
        address: 'Main Warehouse',
        isDefault: true,
      },
    })
  } else {
    console.log('Default location found:', defaultLocation.name)
  }

  // 2. Migrate Finished Good Stock
  const finishedGoods = await prisma.finishedGood.findMany()
  console.log(
    `Found ${finishedGoods.length} finished goods. reconciling stock...`
  )

  for (const fg of finishedGoods) {
    if (fg.currentStock > 0) {
      // Check if stock entry already exists
      const existingStock = await prisma.finishedGoodStock.findUnique({
        where: {
          finishedGoodId_locationId: {
            finishedGoodId: fg.id,
            locationId: defaultLocation.id,
          },
        },
      })

      if (!existingStock) {
        await prisma.finishedGoodStock.create({
          data: {
            finishedGoodId: fg.id,
            locationId: defaultLocation.id,
            quantity: fg.currentStock,
          },
        })
        console.log(
          `Migrated ${fg.currentStock} stock for ${fg.name} to ${defaultLocation.name}`
        )
      } else {
        console.log(
          `Stock for ${fg.name} already exists in ${defaultLocation.name}. Skipping.`
        )
      }
    }
  }

  console.log('Migration complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
