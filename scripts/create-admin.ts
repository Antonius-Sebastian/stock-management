/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
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
 * Prompt user for input
 */
function askQuestion(
  rl: readline.Interface,
  question: string
): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim())
    })
  })
}

/**
 * Prompt user for password
 * Note: Password will be visible as you type (acceptable for setup scripts)
 */
function askPassword(
  rl: readline.Interface,
  question: string
): Promise<string> {
  return askQuestion(rl, question)
}

/**
 * Validate password complexity
 */
function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return 'Password must be at least 8 characters'
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter'
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter'
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number'
  }
  return null
}

async function main() {
  console.log('👤 Admin User Creation Script')
  console.log('')

  const rl = createReadlineInterface()

  try {
    // Get username
    let username = await askQuestion(rl, 'Username (default: admin): ')
    if (!username) {
      username = 'admin'
    }

    if (username.length < 3) {
      console.error('❌ Username must be at least 3 characters')
      rl.close()
      process.exit(1)
    }

    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { username },
    })

    if (existingUser) {
      console.error(`❌ Username "${username}" already exists`)
      rl.close()
      process.exit(1)
    }

    // Get email
    let email: string | undefined = await askQuestion(rl, 'Email (optional): ')
    if (email === '') {
      email = undefined
    } else if (email && !email.includes('@')) {
      console.error('❌ Invalid email format')
      rl.close()
      process.exit(1)
    }

    // Check if email already exists (if provided)
    if (email) {
      const existingEmail = await prisma.user.findUnique({
        where: { email },
      })

      if (existingEmail) {
        console.error(`❌ Email "${email}" already exists`)
        rl.close()
        process.exit(1)
      }
    }

    // Get password
    let password = ''
    let passwordError: string | null = null

    do {
      password = await askPassword(rl, 'Password: ')
      passwordError = validatePassword(password)

      if (passwordError) {
        console.error(`❌ ${passwordError}`)
        console.log('')
      }
    } while (passwordError)

    // Confirm password
    let confirmPassword = ''
    do {
      confirmPassword = await askPassword(rl, 'Confirm Password: ')

      if (password !== confirmPassword) {
        console.error('❌ Passwords do not match')
        console.log('')
      }
    } while (password !== confirmPassword)

    // Get name
    let name = await askQuestion(rl, 'Name (default: Administrator): ')
    if (!name) {
      name = 'Administrator'
    }

    rl.close()

    console.log('')
    console.log('🔄 Creating admin user...')

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        email: email || null,
        password: hashedPassword,
        name,
        role: 'ADMIN',
        isActive: true,
      },
    })

    console.log('')
    console.log('✅ Admin user created successfully!')
    console.log('')
    console.log('📝 User Details:')
    console.log(`  Username: ${user.username}`)
    console.log(`  Email: ${user.email || '(not set)'}`)
    console.log(`  Name: ${user.name}`)
    console.log(`  Role: ${user.role}`)
    console.log('')
  } catch (error) {
    rl.close()
    console.error('')
    console.error('❌ Failed to create admin user:', error)
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
