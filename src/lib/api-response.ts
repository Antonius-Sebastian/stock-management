import { NextResponse } from 'next/server'

/**
 * Standardized API response types
 * Provides consistent structure for all API responses
 */

export type ApiSuccessResponse<T> = {
  success: true
  data: T
}

export type ApiErrorResponse = {
  success: false
  error: string
  code?: string
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse

/**
 * Create a standardized success response
 * @param data - The data to return
 * @param status - HTTP status code (default: 200)
 */
export function successResponse<T>(data: T, status: number = 200) {
  return NextResponse.json<ApiSuccessResponse<T>>(
    {
      success: true,
      data,
    },
    { status }
  )
}

/**
 * Create a standardized error response
 * @param error - Error message
 * @param status - HTTP status code
 * @param code - Optional error code for client-side handling
 */
export function errorResponse(error: string, status: number, code?: string) {
  return NextResponse.json<ApiErrorResponse>(
    {
      success: false,
      error,
      code,
    },
    { status }
  )
}

/**
 * Common error responses
 */
export const ErrorResponses = {
  unauthorized: () => errorResponse('Unauthorized', 401, 'UNAUTHORIZED'),
  forbidden: (message?: string) =>
    errorResponse(message || 'Forbidden', 403, 'FORBIDDEN'),
  notFound: (resource?: string) =>
    errorResponse(
      resource ? `${resource} not found` : 'Not found',
      404,
      'NOT_FOUND'
    ),
  badRequest: (message: string) => errorResponse(message, 400, 'BAD_REQUEST'),
  internalError: () =>
    errorResponse('Internal server error', 500, 'INTERNAL_ERROR'),
}
