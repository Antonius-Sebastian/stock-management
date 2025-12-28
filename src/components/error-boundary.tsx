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
      return <DefaultErrorFallback error={this.state.error} reset={this.resetErrorBoundary} />
    }

    return this.props.children
  }
}

/**
 * Default Error Fallback UI
 */
function DefaultErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <Card className="max-w-md w-full p-6">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="rounded-full bg-red-100 dark:bg-red-900/20 p-3">
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
              <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100">
                Error details (development only)
              </summary>
              <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 overflow-auto">
                <p className="text-xs font-mono text-red-600 dark:text-red-400 whitespace-pre-wrap">
                  {error.message}
                </p>
                {error.stack && (
                  <pre className="mt-2 text-xs text-gray-600 dark:text-gray-400 overflow-x-auto">
                    {error.stack}
                  </pre>
                )}
              </div>
            </details>
          )}

          <div className="flex gap-2 w-full">
            <Button
              onClick={reset}
              variant="default"
              className="flex-1"
            >
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
export function CompactErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-red-800 dark:text-red-300">
            Error loading component
          </p>
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
            {error.message}
          </p>
          <Button
            onClick={reset}
            variant="link"
            className="h-auto p-0 text-xs text-red-700 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 mt-2"
          >
            Try again
          </Button>
        </div>
      </div>
    </div>
  )
}
