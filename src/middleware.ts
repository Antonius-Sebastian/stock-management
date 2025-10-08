import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth
  const userRole = req.auth?.user?.role

  // Public paths that don't require authentication
  const publicPaths = ['/login']
  const isPublicPath = publicPaths.some((path) => nextUrl.pathname.startsWith(path))

  // API auth routes and health check are always public
  const isAuthRoute = nextUrl.pathname.startsWith('/api/auth')
  const isHealthCheck = nextUrl.pathname === '/api/health'

  // Get the response
  let response: NextResponse

  if (isAuthRoute || isHealthCheck) {
    response = NextResponse.next()
  } else if (!isLoggedIn && !isPublicPath) {
    // If not logged in and trying to access protected route, redirect to login
    response = NextResponse.redirect(new URL('/login', nextUrl))
  } else if (isLoggedIn && nextUrl.pathname === '/login') {
    // If logged in and trying to access login page, redirect to home
    response = NextResponse.redirect(new URL('/', nextUrl))
  } else if (isLoggedIn && userRole) {
    // Role-based access control for UI routes
    // Only ADMIN can access user management pages
    if (nextUrl.pathname.startsWith('/users') && userRole !== 'ADMIN') {
      response = NextResponse.redirect(new URL('/', nextUrl))
    } else {
      response = NextResponse.next()
    }
  } else {
    response = NextResponse.next()
  }

  // Add CORS headers for API routes
  if (nextUrl.pathname.startsWith('/api')) {
    // Allow same-origin requests by default
    // Configure these based on your deployment needs
    const allowedOrigin = process.env.ALLOWED_ORIGIN || req.headers.get('origin') || '*'

    response.headers.set('Access-Control-Allow-Origin', allowedOrigin)
    response.headers.set('Access-Control-Allow-Credentials', 'true')
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.set(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    )
  }

  return response
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
