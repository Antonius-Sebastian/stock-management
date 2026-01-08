/**
 * Unit Tests for User Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} from '../user.service'
import { prisma } from '@/lib/db'
import { createTestUser } from '../../../../test/helpers/test-data'
import * as bcrypt from 'bcryptjs'

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
}))

vi.mock('bcryptjs', async () => {
  const actual = await vi.importActual('bcryptjs')
  return {
    ...actual,
    default: {
      hash: vi.fn(),
      compare: vi.fn(),
    },
    hash: vi.fn(),
    compare: vi.fn(),
  }
})

describe('User Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getUsers', () => {
    it('should return all users without password', async () => {
      const mockUsers = [
        {
          id: '1',
          username: 'user1',
          email: 'user1@example.com',
          name: 'User 1',
          role: 'ADMIN' as const,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          username: 'user2',
          email: 'user2@example.com',
          name: 'User 2',
          role: 'OFFICE_PURCHASING' as const,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any)

      const result = await getUsers()

      expect(result).toEqual(mockUsers)
      expect(prisma.user.findMany).toHaveBeenCalledWith({
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
        orderBy: { createdAt: 'desc' },
      })
    })
  })

  describe('getUserById', () => {
    it('should return user when found', async () => {
      const mockUser = createTestUser({ id: 'test-id' })
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)

      const result = await getUserById('test-id')

      expect(result).toEqual(mockUser)
    })

    it('should throw error when user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      await expect(getUserById('non-existent')).rejects.toThrow(
        'User not found'
      )
    })
  })

  describe('createUser', () => {
    it('should create user with hashed password', async () => {
      const input = {
        username: 'newuser',
        password: 'Password123',
        name: 'New User',
        email: 'new@example.com',
        role: 'OFFICE_PURCHASING' as const,
      }
      const mockCreated = createTestUser(input)
      const hashedPassword = 'hashedpassword123'

      // Mock username check (returns null = no duplicate)
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null)
      // Mock email check (returns null = no duplicate)
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(bcrypt.hash).mockResolvedValue(hashedPassword as any)
      vi.mocked(prisma.user.create).mockResolvedValue(mockCreated)

      const result = await createUser(input)

      expect(result).toEqual(mockCreated)
      expect(bcrypt.hash).toHaveBeenCalledWith('Password123', 10)
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          username: input.username,
          email: input.email,
          password: hashedPassword,
          name: input.name,
          role: input.role,
          isActive: true,
        },
        select: expect.any(Object),
      })
    })

    it('should throw error when duplicate username exists', async () => {
      const input = {
        username: 'existing',
        password: 'Password123',
        name: 'User',
        role: 'OFFICE_PURCHASING' as const,
      }
      const existing = createTestUser({ username: 'existing' })
      vi.mocked(prisma.user.findUnique).mockResolvedValue(existing)

      await expect(createUser(input)).rejects.toThrow(
        'Username "existing" already exists'
      )
    })
  })

  describe('updateUser', () => {
    it('should update user without password', async () => {
      const existing = createTestUser({ id: 'test-id' })
      const updated = createTestUser({ id: 'test-id', name: 'Updated Name' })
      const input = { name: 'Updated Name' }

      vi.mocked(prisma.user.findUnique).mockResolvedValue(existing)
      vi.mocked(prisma.user.update).mockResolvedValue(updated)

      const result = await updateUser('test-id', input)

      expect(result).toEqual(updated)
      expect(bcrypt.hash).not.toHaveBeenCalled()
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        data: expect.objectContaining(input),
        select: expect.any(Object),
      })
    })

    it('should update user with new password', async () => {
      const existing = createTestUser({ id: 'test-id' })
      const updated = createTestUser({ id: 'test-id' })
      const input = { password: 'NewPassword123' }
      const hashedPassword = 'hashednewpassword'

      vi.mocked(prisma.user.findUnique).mockResolvedValue(existing)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(bcrypt.hash).mockResolvedValue(hashedPassword as any)
      vi.mocked(prisma.user.update).mockResolvedValue(updated)

      const result = await updateUser('test-id', input)

      expect(result).toEqual(updated)
      expect(bcrypt.hash).toHaveBeenCalledWith('NewPassword123', 10)
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        data: expect.objectContaining({
          password: hashedPassword,
        }),
        select: expect.any(Object),
      })
    })

    it('should throw error when user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      await expect(
        updateUser('non-existent', { name: 'Test' })
      ).rejects.toThrow('User not found')
    })

    it('should throw error when duplicate username on update', async () => {
      const existingUser = createTestUser({
        id: 'test-id',
        username: 'olduser',
        email: 'old@example.com',
      })
      const duplicateUser = createTestUser({
        id: 'other-id',
        username: 'newuser',
      })

      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(existingUser) // Existing user found
        .mockResolvedValueOnce(duplicateUser) // Duplicate username found

      await expect(
        updateUser('test-id', { username: 'newuser' })
      ).rejects.toThrow('Username "newuser" already exists')
    })

    it('should throw error when duplicate email on update', async () => {
      const existingUser = createTestUser({
        id: 'test-id',
        username: 'olduser',
        email: 'old@example.com',
      })
      const duplicateUser = createTestUser({
        id: 'other-id',
        email: 'new@example.com',
      })

      // The updateUser function checks:
      // 1. findUnique for existing user
      // 2. If username provided and different, findUnique for duplicate username
      // 3. If email provided and different, findUnique for duplicate email
      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(existingUser) // Existing user found
        .mockResolvedValueOnce(duplicateUser) // Duplicate email found (email is provided and different)

      await expect(
        updateUser('test-id', { email: 'new@example.com' })
      ).rejects.toThrow('Email "new@example.com" already exists')
    })
  })

  describe('deleteUser', () => {
    it('should delete user', async () => {
      const mockUser = createTestUser({
        id: 'test-id',
        role: 'OFFICE_PURCHASING',
      })
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)
      vi.mocked(prisma.user.delete).mockResolvedValue(mockUser)

      await deleteUser('test-id', 'other-user-id')

      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: 'test-id' },
      })
    })

    it('should throw error when user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      await expect(deleteUser('non-existent', 'current-user')).rejects.toThrow(
        'User not found'
      )
    })

    it('should throw error when trying to delete self', async () => {
      const mockUser = createTestUser({ id: 'test-id' })
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)

      await expect(deleteUser('test-id', 'test-id')).rejects.toThrow(
        'Cannot delete your own account'
      )
    })

    it('should throw error when deleting last admin', async () => {
      const mockUser = createTestUser({ id: 'test-id', role: 'ADMIN' })
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)
      vi.mocked(prisma.user.count).mockResolvedValue(1) // Only 1 admin

      await expect(deleteUser('test-id', 'other-user')).rejects.toThrow(
        'Cannot delete the last admin user'
      )
    })
  })
})
