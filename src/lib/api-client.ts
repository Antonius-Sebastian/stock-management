/**
 * API Client Utilities
 * Generic fetch wrappers with error handling and type safety
 *
 * These are helper functions - not used yet by existing code
 * Safe to add without breaking anything
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Generic API fetch wrapper with error handling
 */
export async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })

    if (!response.ok) {
      // Try to parse error response
      const errorData = await response.json().catch(() => ({
        error: response.statusText || 'Unknown error',
      }))

      throw new ApiError(
        errorData.error || 'Request failed',
        response.status,
        errorData.code
      )
    }

    return response.json()
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }

    // Network error or other fetch error
    throw new ApiError(
      error instanceof Error ? error.message : 'Network error',
      0
    )
  }
}

/**
 * GET request helper
 */
export async function apiGet<T>(url: string): Promise<T> {
  return apiFetch<T>(url, { method: 'GET' })
}

/**
 * POST request helper
 */
export async function apiPost<T>(url: string, data?: unknown): Promise<T> {
  return apiFetch<T>(url, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  })
}

/**
 * PUT request helper
 */
export async function apiPut<T>(url: string, data?: unknown): Promise<T> {
  return apiFetch<T>(url, {
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  })
}

/**
 * DELETE request helper
 */
export async function apiDelete<T>(url: string): Promise<T> {
  return apiFetch<T>(url, { method: 'DELETE' })
}
