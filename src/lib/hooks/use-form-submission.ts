/**
 * Custom Hook: useFormSubmission
 *
 * Handles form submission with loading state, error handling, and success callbacks.
 * Provides consistent pattern for API form submissions.
 *
 * @template T - Type of the form data
 * @param onSubmit - Async function that handles the form submission
 * @param onSuccess - Optional callback called on successful submission
 * @param onError - Optional callback called on error
 * @returns Object with submit handler, loading state, and error state
 */

import { useState } from 'react'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'

interface UseFormSubmissionOptions<T> {
  onSubmit: (data: T) => Promise<void>
  onSuccess?: () => void
  onError?: (error: Error) => void
  successMessage?: string
  errorMessage?: string
}

interface UseFormSubmissionReturn<T> {
  handleSubmit: (data: T) => Promise<void>
  isLoading: boolean
  error: Error | null
}

export function useFormSubmission<T>({
  onSubmit,
  onSuccess,
  onError,
  successMessage,
  errorMessage = 'An error occurred',
}: UseFormSubmissionOptions<T>): UseFormSubmissionReturn<T> {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const handleSubmit = async (data: T) => {
    setIsLoading(true)
    setError(null)

    try {
      await onSubmit(data)
      if (successMessage) {
        toast.success(successMessage)
      }
      onSuccess?.()
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error('Form submission error:', error)
      setError(error)
      const message = error.message || errorMessage
      toast.error(message)
      onError?.(error)
    } finally {
      setIsLoading(false)
    }
  }

  return {
    handleSubmit,
    isLoading,
    error,
  }
}
