'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { useState } from 'react'

// Dynamically import ReactQueryDevtools with SSR disabled to prevent hydration errors
const ReactQueryDevtools = dynamic(
  () =>
    import('@tanstack/react-query-devtools').then((mod) => ({
      default: mod.ReactQueryDevtools,
    })),
  { ssr: false }
)

/**
 * React Query Provider
 * Wraps the app with QueryClientProvider for data fetching/caching
 *
 * This is added as a wrapper around existing code - does not affect anything
 * until we start using useQuery hooks
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Create a client instance per request to avoid sharing state between users
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Stale time: How long data is considered fresh (5 minutes)
            staleTime: 5 * 60 * 1000,
            // Retry failed requests once
            retry: 1,
            // Refetch on window focus for real-time data
            refetchOnWindowFocus: true,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* DevTools only show in development and only on client to avoid hydration errors */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  )
}
