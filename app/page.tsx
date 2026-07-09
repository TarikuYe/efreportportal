import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ShieldCheck, Clock, FileStack, ArrowRight, Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const features = [
  {
    icon: ShieldCheck,
    title: 'Secure & private',
    desc: 'Files are stored in encrypted, access-controlled storage. Only the review team can retrieve them.',
  },
  {
    icon: Clock,
    title: 'Automated reminders',
    desc: 'Monthly email reminders keep every project team on schedule for their reporting period.',
  },
  {
    icon: FileStack,
    title: 'Full audit trail',
    desc: 'Every submission is timestamped and tracked through review to approval on the dashboard.',
  },
]

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Authenticated users go straight to the dashboard
  if (user) {
    redirect('/dashboard')
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
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
          <nav className="flex items-center gap-2">
            <Link
              href="/auth/signin"
              className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
            >
              Sign In
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden bg-primary text-primary-foreground">
          <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:44px_44px]" />
          <div className="relative mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 lg:py-28">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/5 px-3 py-1 text-xs font-medium text-primary-foreground/80">
              EF Architect &amp; Engineering
            </span>
            <h1 className="mt-6 text-balance font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Submit your project reports with confidence
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-primary-foreground/75">
              The official portal for submitting periodic architecture and engineering reports.
              Sign in to upload documents, track review status, and never miss a deadline.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/auth/signin"
                className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
              >
                Sign In <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
              How the portal works
            </h2>
            <p className="mt-2 text-muted-foreground">
              A secure, streamlined workflow for project report submissions.
            </p>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {features.map((f) => (
              <Card key={f.title} className="border-border/60">
                <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
                  <span className="flex size-12 items-center justify-center rounded-lg bg-primary/5 text-primary">
                    <f.icon className="size-6" />
                  </span>
                  <div>
                    <h3 className="font-display font-bold text-foreground">{f.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border bg-secondary/40">
          <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6">
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-foreground">
              Ready to submit your report?
            </h2>
            <p className="mt-2 text-muted-foreground">
              Sign in with your administrator-assigned account to access your workspace.
            </p>
            <div className="mt-6">
              <Link href="/auth/signin">
                <Button size="lg">Sign in to your account</Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-secondary/40">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} EF Architect &amp; Engineering. All rights reserved.</p>
          <p>Secure report submission portal</p>
        </div>
      </footer>
    </div>
  )
}
