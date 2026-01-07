import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  // Hash password for all users
  const defaultPassword = await bcrypt.hash('password123', 10)

  // Create Admin user
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@stockmanagement.local',
      password: defaultPassword,
      name: 'Administrator',
      role: 'ADMIN',
      isActive: true,
    },
  })
  console.log('✅ Admin user created:', admin.username)

  // Create Factory user
  const factoryUser = await prisma.user.upsert({
    where: { username: 'factory' },
    update: {},
    create: {
      username: 'factory',
      email: 'factory@example.com',
      password: defaultPassword,
      name: 'Warehouse Staff',
      role: 'OFFICE_WAREHOUSE',
      isActive: true,
    },
  })
  console.log('✅ Warehouse user created:', factoryUser.username)

  // Create Office Purchasing user
  const office = await prisma.user.upsert({
    where: { username: 'office' },
    update: {},
    create: {
      username: 'office',
      email: 'office@stockmanagement.local',
      password: defaultPassword,
      name: 'Office Purchasing Staff',
      role: 'OFFICE_PURCHASING',
      isActive: true,
    },
  })
  console.log('✅ Office Purchasing user created:', office.username)

  console.log('🎉 Seed completed!')
  console.log('')
  console.log('📝 Default credentials for all users:')
  console.log('   Password: password123')
  console.log('')
  console.log('👤 Users created:')
  console.log(
    '   - Username: admin   | Role: ADMIN   | Email: admin@stockmanagement.local'
  )
  console.log(
    '   - Username: factory | Role: OFFICE_WAREHOUSE | Email: factory@example.com'
  )
  console.log(
    '   - Username: office  | Role: OFFICE_PURCHASING | Email: office@stockmanagement.local'
  )
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
