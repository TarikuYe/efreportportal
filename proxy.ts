import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const DGM_EMAIL = process.env.DGM_EMAIL

// Routes that do NOT require authentication
const publicPaths = [
  '/auth/signin',
  '/auth/signup',
  '/auth/callback',
  '/auth/unauthorized',
  '/api/auth', // Auth API routes (signup, etc.)
  '/api/send-reminders', // Has its own CRON_SECRET auth
]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes through without session refresh
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Allow static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/favicon') ||
    pathname === '/'
  ) {
    return NextResponse.next()
  }

  const { supabaseResponse, user } = await updateSession(request)

  // Check auth for protected routes
  const isProtectedRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/api/submit') ||
    pathname.startsWith('/api/submissions')

  if (isProtectedRoute) {
    if (!user) {
      // Redirect to sign-in with return URL
      const signInUrl = new URL('/auth/signin', request.url)
      signInUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(signInUrl)
    }

    // Admin route check: /dashboard/admin
    if (pathname.startsWith('/dashboard/admin')) {
      const userEmail = user.email?.toLowerCase()
      const dgmEmail = DGM_EMAIL?.toLowerCase()

      if (!userEmail || !dgmEmail || userEmail !== dgmEmail) {
        // Non-DGM employee → redirect to unauthorized page
        return NextResponse.redirect(new URL('/auth/unauthorized', request.url))
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Match all request paths except static files and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
