'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Compass, Menu, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { SignOutButton } from '@/components/sign-out-button'
import { useEffect, useState } from 'react'

const ROUTING_DICTIONARY: Record<string, { label: string; href: string }[]> = {
  engineer: [
    // { label: 'AI Assistant', href: '/dashboard/ai-assistant' }, // hidden until API subscription is ready
  ],
  admin: [
    { label: 'Management Center', href: '/dashboard/registrar' },
    { label: 'Submissions Hub', href: '/api/submissions' },
    // { label: 'AI Assistant', href: '/dashboard/ai-assistant' }, // hidden until API subscription is ready
  ],
  dgm: [
    { label: 'Control Tower', href: '/dashboard/admin/analytics' },
    { label: 'View Registers', href: '/dashboard/registrar' },
    // { label: 'AI Assistant', href: '/dashboard/ai-assistant' }, // hidden until API subscription is ready
  ],
}

export function SiteHeader() {
  const [user, setUser] = useState<any>(null)
  const [role, setRole] = useState<string>('engineer')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const supabase = createClient()
    
    async function getSession() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUser(user)
        // Fetch role from employees table
        const { data: employee } = await supabase
          .from('employees')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()
        
        if (employee) {
          setRole(employee.role)
        } else {
          // Fallback check
          if (user.email?.toLowerCase() === 'dgm@efae.com') {
            setRole('dgm')
          }
        }
      }
    }

    getSession()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
        // Refetch role on login
        supabase
          .from('employees')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle()
          .then(({ data: employee }) => {
            if (employee) setRole(employee.role)
          })
      } else {
        setUser(null)
        setRole('engineer')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const navLinks = ROUTING_DICTIONARY[role] || ROUTING_DICTIONARY.engineer

  const getRoleBadgeClass = (r: string) => {
    switch (r) {
      case 'dgm':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
      case 'admin':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
    }
  }

  // Helper to determine if path matches (taking query params/tabs into account)
  const isLinkActive = (href: string) => {
    if (typeof window === 'undefined') return pathname === href
    const search = window.location.search
    if (href === '/dashboard/settings') {
      return search.includes('tab=settings')
    }
    if (href === '/dashboard') {
      return pathname === '/dashboard' && !search.includes('tab=settings')
    }
    return pathname === href
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Compass className="size-5" strokeWidth={2.2} />
          </span>
          <span className="font-display text-lg font-extrabold leading-none tracking-tight">
            <span className="text-foreground">EF</span>{' '}
            <span className="text-accent">A&E</span>
            <span className="block text-[11px] font-medium tracking-wide text-muted-foreground">
              Report Portal
            </span>
          </span>
        </Link>

        {/* Desktop links */}
        {user ? (
          <div className="hidden md:flex items-center gap-6 h-full">
            <nav className="flex items-center gap-1 text-sm font-medium h-full">
              {navLinks.map((link) => {
                const isActive = isLinkActive(link.href)
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center h-16 px-3 border-b-2 text-sm font-semibold transition-all duration-200 ${
                      isActive
                        ? 'border-primary text-primary font-bold'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                    }`}
                  >
                    {link.label}
                  </Link>
                )
              })}
            </nav>

            <div className="flex items-center gap-3">
              <span className="h-5 w-px bg-border" />
              <div className="flex flex-col items-end">
                <span className="max-w-[160px] truncate text-xs font-semibold text-foreground">
                  {user.user_metadata?.full_name || user.email?.split('@')[0]}
                </span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase mt-0.5 ${getRoleBadgeClass(role)}`}>
                  {role}
                </span>
              </div>
              <SignOutButton />
            </div>
          </div>
        ) : (
          <nav className="hidden md:flex items-center gap-2">
            <Link
              href="/auth/signin"
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              Sign in
            </Link>
            <Link
              href="/auth/signup"
              className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
            >
              Get started
            </Link>
          </nav>
        )}

        {/* Mobile menu trigger */}
        {user && (
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="flex md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Open mobile menu"
          >
            <Menu className="size-6" />
          </button>
        )}
      </div>

      {/* Mobile Drawer (Sheet component replacement) */}
      {user && mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop Overlay */}
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
          />

          {/* Drawer Container */}
          <div className="relative flex w-full max-w-xs flex-col bg-background p-6 shadow-xl animate-in slide-in-from-right duration-250 z-50 ml-auto h-full">
            {/* Close Button */}
            <div className="flex items-center justify-between mb-8">
              <span className="font-display text-sm font-bold text-muted-foreground">MENU</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                aria-label="Close menu"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Profile Info block */}
            <div className="mb-8 p-4 bg-secondary/50 rounded-xl border border-border">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
                  {((user.user_metadata?.full_name || user.email || '??').split(' ').map((n: string) => n[0]).join('').toUpperCase() + '??').substring(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-foreground truncate">
                    {user.user_metadata?.full_name || user.email?.split('@')[0]}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                  <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase mt-1.5 ${getRoleBadgeClass(role)}`}>
                    {role}
                  </span>
                </div>
              </div>
            </div>

            {/* Links stacked */}
            <nav className="flex flex-col gap-1.5 flex-1">
              {navLinks.map((link) => {
                const isActive = isLinkActive(link.href)
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                      isActive
                        ? 'bg-primary/10 text-primary font-bold'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                    }`}
                  >
                    {link.label}
                  </Link>
                )
              })}
            </nav>

            {/* Sign Out Button full-width at base */}
            <div className="mt-auto border-t border-border pt-4">
              <SignOutButton className="w-full justify-center bg-destructive text-white hover:bg-destructive/90 hover:text-white mt-4 border border-destructive/20" />
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
