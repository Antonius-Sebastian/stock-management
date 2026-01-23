import { describe, it, expect, vi } from 'vitest'
import { GET, POST } from '../route'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue(null), // Simulate no session by default
}))

vi.mock('@/lib/services/location.service', () => ({
  getLocations: vi.fn().mockResolvedValue([]),
  createLocation: vi.fn().mockResolvedValue({ id: '1', name: 'Test Location' }),
}))

// Mock RBAC to prevent import errors during test execution if needed
// (RBAC usually doesn't have side effects, but good to be safe)
vi.mock('@/lib/rbac', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    // @ts-ignore
    ...actual,
  }
})

describe('Locations API Security', () => {
  it('GET /api/locations should return 401 when unauthenticated', async () => {
    // Act: Call GET without session
    const response = await GET()

    // Assert: It blocks access (Status 401)
    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('POST /api/locations should return 401 when unauthenticated', async () => {
    const req = new NextRequest('http://localhost/api/locations', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test Location' })
    })

    // Act: Call POST without session
    const response = await POST(req)

    // Assert: It blocks access (Status 401)
    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('Unauthorized')
  })
})
