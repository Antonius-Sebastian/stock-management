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
  const factory = await prisma.user.upsert({
    where: { username: 'factory' },
    update: {},
    create: {
      username: 'factory',
      email: 'factory@stockmanagement.local',
      password: defaultPassword,
      name: 'Factory Staff',
      role: 'FACTORY',
      isActive: true,
    },
  })
  console.log('✅ Factory user created:', factory.username)

  // Create Office user
  const office = await prisma.user.upsert({
    where: { username: 'office' },
    update: {},
    create: {
      username: 'office',
      email: 'office@stockmanagement.local',
      password: defaultPassword,
      name: 'Office Staff',
      role: 'OFFICE',
      isActive: true,
    },
  })
  console.log('✅ Office user created:', office.username)

  console.log('🎉 Seed completed!')
  console.log('')
  console.log('📝 Default credentials for all users:')
  console.log('   Password: password123')
  console.log('')
  console.log('👤 Users created:')
  console.log('   - Username: admin   | Role: ADMIN   | Email: admin@stockmanagement.local')
  console.log('   - Username: factory | Role: FACTORY | Email: factory@stockmanagement.local')
  console.log('   - Username: office  | Role: OFFICE  | Email: office@stockmanagement.local')
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
