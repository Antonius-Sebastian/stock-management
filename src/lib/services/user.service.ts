/**
 * User Service
 *
 * Handles all database operations for users
 * Separates business logic from API route handlers
 */

import { prisma } from '@/lib/db'
import { CreateUserInput } from '@/lib/validations'
import { User } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

/**
 * User update input type for service layer
 * All fields optional to match API route structure
 */
export interface UpdateUserInput {
  username?: string
  email?: string | null
  password?: string
  name?: string
  role?: 'ADMIN' | 'FACTORY' | 'OFFICE'
  isActive?: boolean
}

/**
 * User type without password field
 */
export type UserWithoutPassword = Omit<User, 'password'>

/**
 * Get all users
 *
 * @returns Array of users (password excluded)
 *
 * @remarks
 * - Returns users ordered by creation date (newest first)
 * - Password field excluded from all users
 */
export async function getUsers(): Promise<UserWithoutPassword[]> {
  return await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  })
}

/**
 * Get a single user by ID
 *
 * @param id - User ID
 * @returns User (password excluded)
 * @throws {Error} If user not found
 */
export async function getUserById(id: string): Promise<UserWithoutPassword> {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!user) {
    throw new Error('User not found')
  }

  return user
}

/**
 * Create a new user with hashed password
 *
 * @param data - User input data (validated)
 * @returns Created user (password excluded)
 * @throws {Error} If username already exists
 * @throws {Error} If email already exists (if provided)
 *
 * @remarks
 * - Hashes password with bcrypt (10 rounds)
 * - Always sets isActive = true on creation
 * - Returns user without password field
 */
export async function createUser(
  data: CreateUserInput
): Promise<UserWithoutPassword> {
  // Check for duplicate username
  const existingUser = await prisma.user.findUnique({
    where: { username: data.username },
  })

  if (existingUser) {
    throw new Error(`Username "${data.username}" already exists`)
  }

  // Check for duplicate email if provided
  if (data.email) {
    const existingEmail = await prisma.user.findUnique({
      where: { email: data.email },
    })

    if (existingEmail) {
      throw new Error(`Email "${data.email}" already exists`)
    }
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(data.password, 10)

  // Create user
  return await prisma.user.create({
    data: {
      username: data.username,
      email: data.email,
      password: hashedPassword,
      name: data.name,
      role: data.role,
      isActive: true,
    },
    select: {
      id: true,
      username: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  })
}

/**
 * Update an existing user
 *
 * @param id - User ID
 * @param data - Updated user data (validated, all fields optional)
 * @returns Updated user (password excluded)
 * @throws {Error} If user not found
 * @throws {Error} If username already exists (if changed)
 * @throws {Error} If email already exists (if changed)
 *
 * @remarks
 * - Only hashes password if provided in update
 * - All fields are optional
 * - Returns user without password field
 */
export async function updateUser(
  id: string,
  data: UpdateUserInput
): Promise<UserWithoutPassword> {
  const existingUser = await prisma.user.findUnique({
    where: { id },
  })

  if (!existingUser) {
    throw new Error('User not found')
  }

  // Check for duplicate username if being changed
  if (data.username && data.username !== existingUser.username) {
    const duplicateUsername = await prisma.user.findUnique({
      where: { username: data.username },
    })

    if (duplicateUsername) {
      throw new Error(`Username "${data.username}" already exists`)
    }
  }

  // Check for duplicate email if being changed
  if (data.email && data.email !== existingUser.email) {
    const duplicateEmail = await prisma.user.findUnique({
      where: { email: data.email },
    })

    if (duplicateEmail) {
      throw new Error(`Email "${data.email}" already exists`)
    }
  }

  // Prepare update data
  const updateData: {
    username?: string
    email?: string | null
    name?: string
    role?: 'ADMIN' | 'FACTORY' | 'OFFICE'
    isActive?: boolean
    password?: string
  } = {}

  if (data.username) updateData.username = data.username
  if (data.email !== undefined) updateData.email = data.email
  if (data.name) updateData.name = data.name
  if (data.role) updateData.role = data.role
  if (data.isActive !== undefined) updateData.isActive = data.isActive
  if (data.password) {
    updateData.password = await bcrypt.hash(data.password, 10)
  }

  // Update user
  return await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      username: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  })
}

/**
 * Delete a user
 *
 * @param id - User ID
 * @param currentUserId - ID of currently logged in user
 * @returns void
 * @throws {Error} If user not found
 * @throws {Error} If attempting to delete own account
 * @throws {Error} If deleting last admin user
 *
 * @remarks
 * - Hard delete (not soft delete)
 * - Prevents self-deletion
 * - Prevents deleting last admin user
 * - Cascade deletes handled by Prisma schema (accounts, sessions)
 */
export async function deleteUser(
  id: string,
  currentUserId: string
): Promise<void> {
  const existingUser = await prisma.user.findUnique({
    where: { id },
  })

  if (!existingUser) {
    throw new Error('User not found')
  }

  // Prevent self-deletion
  if (existingUser.id === currentUserId) {
    throw new Error('Cannot delete your own account')
  }

  // Prevent deleting the last admin
  if (existingUser.role === 'ADMIN') {
    const adminCount = await prisma.user.count({
      where: { role: 'ADMIN', isActive: true },
    })

    if (adminCount <= 1) {
      throw new Error('Cannot delete the last admin user')
    }
  }

  // Delete user
  await prisma.user.delete({
    where: { id },
  })
}
