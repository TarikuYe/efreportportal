import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  ShieldCheck,
  Clock,
  FileStack,
  ArrowRight,
  Compass,
  CheckCircle2,
} from 'lucide-react'
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

const stats = [
  { value: '100%', label: 'Encrypted storage' },
  { value: '24/7', label: 'Submission access' },
  { value: '0', label: 'Missed deadlines*' },
]

const steps = [
  'Sign in with your administrator-assigned account',
  'Upload your periodic report and supporting files',
  'Track review status in real time on your dashboard',
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
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
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
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-sm transition-all hover:opacity-90 hover:shadow"
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
          <div
            className="pointer-events-none absolute -top-32 right-[-10%] size-[420px] rounded-full bg-accent/25 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-40 left-[-10%] size-[380px] rounded-full bg-primary-foreground/10 blur-3xl"
            aria-hidden
          />

          <div className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-32">
            <div className="mx-auto max-w-2xl text-center">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/5 px-3 py-1 text-xs font-medium text-primary-foreground/80">
                EF Architect &amp; Engineering
              </span>
              <h1 className="mt-6 text-balance font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                Submit your project reports with confidence
              </h1>
              <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-primary-foreground/75 sm:text-lg">
                The official portal for submitting periodic architecture and engineering reports.
                Sign in to upload documents, track review status, and never miss a deadline.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/auth/signin"
                  className="inline-flex items-center gap-2 rounded-md bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-md transition-all hover:opacity-90 hover:shadow-lg"
                >
                  Sign In <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>

            {/* Stats strip */}
            <div className="mx-auto mt-16 grid max-w-2xl grid-cols-3 gap-6 border-t border-primary-foreground/15 pt-8">
              {stats.map((s) => (
                <div key={s.label} className="text-center">
                  <div className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
                    {s.value}
                  </div>
                  <div className="mt-1 text-xs text-primary-foreground/60 sm:text-sm">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-accent">
              Why teams use the portal
            </span>
            <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-foreground">
              How the portal works
            </h2>
            <p className="mt-2 text-muted-foreground">
              A secure, streamlined workflow for project report submissions.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {features.map((f) => (
              <Card
                key={f.title}
                className="border-border/60 transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md"
              >
                <CardContent className="flex flex-col items-center gap-4 py-9 text-center">
                  <span className="flex size-12 items-center justify-center rounded-lg bg-primary/5 text-primary">
                    <f.icon className="size-6" />
                  </span>
                  <div>
                    <h3 className="font-display font-bold text-foreground">{f.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {f.desc}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Process steps */}
        <section className="border-y border-border bg-secondary/30">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-accent">
                  Simple process
                </span>
                <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-foreground">
                  Three steps to a completed submission
                </h2>
                <p className="mt-3 max-w-md text-muted-foreground">
                  No spreadsheets, no lost email attachments — just a clear path from upload to
                  approval.
                </p>
              </div>
              <ol className="space-y-4">
                {steps.map((step, i) => (
                  <li
                    key={step}
                    className="flex items-start gap-4 rounded-lg border border-border/60 bg-background p-4 shadow-sm"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground">
                      {i + 1}
                    </span>
                    <span className="pt-1 text-sm leading-relaxed text-foreground">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden bg-primary text-primary-foreground">
          <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:44px_44px]" />
          <div className="relative mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 lg:py-20">
            <CheckCircle2 className="mx-auto size-8 text-accent" />
            <h2 className="mt-4 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
              Ready to submit your report?
            </h2>
            <p className="mx-auto mt-2 max-w-md text-primary-foreground/75">
              Sign in with your administrator-assigned account to access your workspace.
            </p>
            <div className="mt-7">
              <Link href="/auth/signin">
                <Button size="lg" className="shadow-md">
                  Sign in to your account
                </Button>
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