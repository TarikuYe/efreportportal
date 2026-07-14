'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Compass, Menu, X, ChevronRight, LayoutDashboard, BarChart3, Inbox, Users, Home, FolderKanban } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { SignOutButton } from '@/components/sign-out-button'
import { useEffect, useState } from 'react'

const ROUTING_DICTIONARY: Record<string, { label: string; href: string; icon: any }[]> = {
  engineer: [
    // { label: 'AI Assistant', href: '/dashboard/ai-assistant', icon: Sparkles }, // hidden until API subscription is ready
  ],
  admin: [
    { label: 'Management Center', href: '/dashboard/registrar', icon: Users },
    { label: 'Submissions Hub', href: '/api/submissions', icon: Inbox },
    // { label: 'AI Assistant', href: '/dashboard/ai-assistant', icon: Sparkles }, // hidden until API subscription is ready
  ],
  dgm: [
    { label: 'Control Tower', href: '/dashboard/admin/analytics', icon: BarChart3 },
    { label: 'Projects', href: '/dashboard/admin/projects', icon: FolderKanban },
    { label: 'View Registers', href: '/dashboard/registrar', icon: LayoutDashboard },
    // { label: 'AI Assistant', href: '/dashboard/ai-assistant', icon: Sparkles }, // hidden until API subscription is ready
  ],
}

export function SiteHeader() {
  const [user, setUser] = useState<any>(null)
  const [role, setRole] = useState<string>('engineer')
  const [displayName, setDisplayName] = useState<string>('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const supabase = createClient()
    
    async function getSession() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUser(user)
        const { data: employee } = await supabase
          .from('employees')
          .select('role, full_name')
          .eq('id', user.id)
          .maybeSingle()
        
        if (employee) {
          setRole(employee.role)
          setDisplayName(employee.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || '')
        } else {
          if (user.email?.toLowerCase() === 'dgm@efae.com') {
            setRole('dgm')
          }
          setDisplayName(user.user_metadata?.full_name || user.email?.split('@')[0] || '')
        }
      }
    }

    getSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
        supabase
          .from('employees')
          .select('role, full_name')
          .eq('id', session.user.id)
          .maybeSingle()
          .then(({ data: employee }) => {
            if (employee) {
              setRole(employee.role)
              setDisplayName(employee.full_name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || '')
            } else {
              setDisplayName(session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || '')
            }
          })
      } else {
        setUser(null)
        setRole('engineer')
        setDisplayName('')
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

  const getRoleGradient = (r: string) => {
    switch (r) {
      case 'dgm':    return 'from-emerald-500 to-teal-600'
      case 'admin':  return 'from-purple-500 to-indigo-600'
      default:       return 'from-blue-500 to-indigo-600'
    }
  }

  const getInitials = (name: string) => {
    const n = name || '??'
    return (n.split(' ').map((w: string) => w[0]).join('').toUpperCase() + '??').substring(0, 2)
  }

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

        {user ? (
          <div className="hidden md:flex items-center gap-4 h-full min-w-0">
            <nav className="flex items-center gap-0.5 text-sm font-medium h-full min-w-0 overflow-x-auto">
              {navLinks.map((link) => {
                const isActive = isLinkActive(link.href)
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex shrink-0 items-center h-16 px-3 border-b-2 text-sm font-semibold transition-all duration-200 ${
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

            <div className="flex shrink-0 items-center gap-3">
              <span className="h-5 w-px bg-border" />
              <div className="flex flex-col items-end">
                <span className="max-w-[140px] truncate text-xs font-semibold text-foreground">
                  {displayName}
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

        {user && (
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="flex md:hidden items-center justify-center size-9 rounded-lg bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
            aria-label="Open mobile menu"
          >
            <Menu className="size-5" />
          </button>
        )}
      </div>

      {user && mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 z-50 bg-black/60 md:hidden"
          />

          {/* Drawer Panel — fixed directly to avoid transparent-background bug on mobile */}
          <div className="fixed right-0 top-0 z-50 h-screen w-[300px] flex flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-300 overflow-hidden md:hidden" style={{ backgroundColor: 'var(--background, #ffffff)' }}>

            <div className="relative bg-primary px-5 pt-5 pb-7 overflow-hidden shrink-0">
              <div className="absolute -top-6 -right-6 size-28 rounded-full bg-white/5" />
              <div className="absolute top-8 -right-2 size-14 rounded-full bg-white/5" />
              <div className="absolute -bottom-4 left-8 size-20 rounded-full bg-white/5" />

              <div className="relative flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-md bg-white/15">
                    <Compass className="size-4 text-white" strokeWidth={2.2} />
                  </span>
                  <span className="font-display text-sm font-bold text-white/90 tracking-wide">
                    EF A&E
                  </span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex size-8 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 transition-all"
                  aria-label="Close menu"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="relative flex items-center gap-3">
                <div className={`flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br ${getRoleGradient(role)} shadow-lg text-white font-bold text-base shrink-0 ring-2 ring-white/20`}>
                  {getInitials(displayName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-white truncate leading-tight">
                    {displayName}
                  </div>
                  <div className="text-xs text-white/60 truncate mt-0.5">{user.email}</div>
                  <span className="inline-block mt-1.5 text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/15 text-white uppercase tracking-wider">
                    {role}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="p-4">
                <div className="mb-2">
                  <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Navigation
                  </p>
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                      isLinkActive('/dashboard')
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-foreground hover:bg-secondary'
                    }`}
                  >
                    <span className={`flex size-8 items-center justify-center rounded-lg ${
                      isLinkActive('/dashboard')
                        ? 'bg-white/20'
                        : 'bg-secondary group-hover:bg-background'
                    } transition-colors`}>
                      <Home className="size-4" />
                    </span>
                    <span className="flex-1">Dashboard</span>
                    <ChevronRight className="size-3.5 opacity-40 group-hover:opacity-70 transition-opacity" />
                  </Link>
                </div>

                {navLinks.length > 0 && (
                  <div className="mt-4">
                    <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Quick Access
                    </p>
                    <div className="flex flex-col gap-1">
                      {navLinks.map((link) => {
                        const isActive = isLinkActive(link.href)
                        const Icon = link.icon
                        return (
                          <Link
                            key={link.href}
                            href={link.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                              isActive
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'text-foreground hover:bg-secondary'
                            }`}
                          >
                            <span className={`flex size-8 items-center justify-center rounded-lg ${
                              isActive
                                ? 'bg-white/20'
                                : 'bg-secondary group-hover:bg-background'
                            } transition-colors`}>
                              <Icon className="size-4" />
                            </span>
                            <span className="flex-1">{link.label}</span>
                            {isActive && (
                              <span className="size-1.5 rounded-full bg-white/70" />
                            )}
                            {!isActive && (
                              <ChevronRight className="size-3.5 opacity-40 group-hover:opacity-70 transition-opacity" />
                            )}
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="shrink-0 px-4 pb-6 pt-3 border-t border-border bg-secondary/20">
              <SignOutButton className="w-full justify-center rounded-xl h-10 font-semibold text-sm bg-destructive/10 text-destructive hover:bg-destructive hover:text-white border border-destructive/20 transition-all duration-200" />
            </div>
          </div>
        </>
      )}
    </header>
  )
}
