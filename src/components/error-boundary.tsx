'use client'

import React from 'react'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error: Error; reset: () => void }>
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI.
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console (in production, send to error tracking service)
    console.error('Error Boundary caught an error:', error, errorInfo)

    // TODO: Send to error tracking service (Sentry, LogRocket, etc.)
    // if (process.env.NODE_ENV === 'production') {
    //   logErrorToService(error, errorInfo)
    // }
  }

  resetErrorBoundary = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError && this.state.error) {
      // Custom fallback UI if provided
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback
        return (
          <FallbackComponent
            error={this.state.error}
            reset={this.resetErrorBoundary}
          />
        )
      }

      // Default fallback UI
      return (
        <DefaultErrorFallback
          error={this.state.error}
          reset={this.resetErrorBoundary}
        />
      )
    }

    return this.props.children
  }
}

/**
 * Default Error Fallback UI
 */
function DefaultErrorFallback({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="flex min-h-[400px] items-center justify-center p-4">
      <Card className="w-full max-w-md p-6">
        <div className="flex flex-col items-center space-y-4 text-center">
          <div className="rounded-full bg-red-100 p-3 dark:bg-red-900/20">
            <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-500" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Something went wrong
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              An unexpected error occurred while rendering this component.
            </p>
          </div>

          {process.env.NODE_ENV === 'development' && (
            <details className="w-full text-left">
              <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100">
                Error details (development only)
              </summary>
              <div className="mt-2 overflow-auto rounded border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
                <p className="font-mono text-xs whitespace-pre-wrap text-red-600 dark:text-red-400">
                  {error.message}
                </p>
                {error.stack && (
                  <pre className="mt-2 overflow-x-auto text-xs text-gray-600 dark:text-gray-400">
                    {error.stack}
                  </pre>
                )}
              </div>
            </details>
          )}

          <div className="flex w-full gap-2">
            <Button onClick={reset} variant="default" className="flex-1">
              Try again
            </Button>
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              className="flex-1"
            >
              Reload page
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

/**
 * Compact Error Fallback (for smaller components)
 */
export function CompactErrorFallback({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-500" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-red-800 dark:text-red-300">
            Error loading component
          </p>
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
            {error.message}
          </p>
          <Button
            onClick={reset}
            variant="link"
            className="mt-2 h-auto p-0 text-xs text-red-700 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
          >
            Try again
          </Button>
        </div>
      </div>
    </div>
  )
}
