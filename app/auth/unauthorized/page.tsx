import Link from 'next/link'
import { ShieldX, ArrowLeft } from 'lucide-react'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'

export const metadata = {
  title: 'Access Denied — EF Architect & Engineering',
}

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-destructive/10">
            <ShieldX className="size-10 text-destructive" strokeWidth={1.75} />
          </div>

          <h1 className="font-display text-4xl font-extrabold tracking-tight text-foreground">
            403 — Access Denied
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            You do not have the required permissions to access this area.
            This section is restricted to the Deputy General Manager only.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            If you believe this is an error, please contact your system administrator.
          </p>

          <div className="mt-8 flex items-center justify-center gap-3">
            <Link href="/dashboard">
              <Button variant="default">
                <ArrowLeft className="size-4" /> Back to dashboard
              </Button>
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        EF Architect &amp; Engineering &middot; Secure Report Portal
      </footer>
    </div>
  )
}
