import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth
  const userRole = req.auth?.user?.role

  // Public paths that don't require authentication
  const publicPaths = ['/login']
  const isPublicPath = publicPaths.some((path) => nextUrl.pathname.startsWith(path))

  // API auth routes are always public
  const isAuthRoute = nextUrl.pathname.startsWith('/api/auth')

  if (isAuthRoute) {
    return NextResponse.next()
  }

  // If not logged in and trying to access protected route, redirect to login
  if (!isLoggedIn && !isPublicPath) {
    return NextResponse.redirect(new URL('/login', nextUrl))
  }

  // If logged in and trying to access login page, redirect to home
  if (isLoggedIn && nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/', nextUrl))
  }

  // Role-based access control for UI routes
  if (isLoggedIn && userRole) {
    // Only ADMIN can access user management pages
    if (nextUrl.pathname.startsWith('/users') && userRole !== 'ADMIN') {
      return NextResponse.redirect(new URL('/', nextUrl))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
