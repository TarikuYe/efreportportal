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
  ClipboardList,
  FolderKanban,
  BarChart3,
  Mail,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const features = [
  {
    icon: ClipboardList,
    title: 'Weekly Timesheets',
    desc: 'Engineers log daily tasks, hours, completion percentages, and office entry/exit times. Supervisors review, approve, or return entries with comments.',
  },
  {
    icon: FolderKanban,
    title: 'Project Records',
    desc: 'Track correspondence registers, contractor bonds, Extension of Time (EOT) claims, and project assignments — all in one place.',
  },
  {
    icon: BarChart3,
    title: 'Performance Evaluations',
    desc: 'Score employees across six weighted dimensions — technical competence, productivity, punctuality, communication, reporting, and adaptability.',
  },
  {
    icon: ShieldCheck,
    title: 'Role-Based Access',
    desc: 'Three distinct workspaces: engineers log and track their own work, registrars manage records and exports, DGMs get a real-time analytics overview.',
  },
  {
    icon: Mail,
    title: 'Automated Reminders',
    desc: 'Scheduled email reminders keep every team member on schedule. Overdue items surface automatically so nothing slips through.',
  },
  {
    icon: FileStack,
    title: 'Full Audit Trail',
    desc: 'Every record is timestamped from creation to approval. Export to Excel at any time for offline review, reporting, or compliance.',
  },
]

const stats = [
  { value: '3', label: 'Role-based workspaces' },
  { value: '24/7', label: 'Secure access' },
  { value: '100%', label: 'Audit-tracked records' },
]

const steps = [
  {
    role: 'Engineers',
    text: 'Sign in and log your weekly tasks, hours worked, and daily progress directly in your workspace.',
  },
  {
    role: 'Registrars',
    text: 'Manage correspondence, bonds, EOT claims, and performance evaluations from the admin dashboard.',
  },
  {
    role: 'DGM',
    text: 'Access the analytics control tower for a live overview of all employees, projects, and submissions.',
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
                Management Portal
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
                EF Architects &amp; Engineers Consulting PLC
              </span>
              <h1 className="mt-6 text-balance font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                Internal management portal for your entire team
              </h1>
              <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-primary-foreground/75 sm:text-lg">
                One platform for weekly timesheets, correspondence tracking, contractor bonds, EOT
                claims, performance evaluations, and project management — built for EF A&amp;E staff
                from engineer to DGM.
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
            <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-6 border-t border-primary-foreground/15 pt-8 sm:grid-cols-3">
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
              Everything in one place
            </span>
            <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-foreground">
              What the portal covers
            </h2>
            <p className="mt-2 text-muted-foreground">
              A complete management system built around how EF A&amp;E teams actually work.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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

        {/* Role-based access breakdown */}
        <section className="border-y border-border bg-secondary/30">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-accent">
                  Tailored by role
                </span>
                <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-foreground">
                  Your workspace, your tools
                </h2>
                <p className="mt-3 max-w-md text-muted-foreground">
                  Sign in once and the portal takes you straight to the right workspace. No manual
                  navigation, no irrelevant menus — just the tools for your role.
                </p>
              </div>
              <ol className="space-y-4">
                {steps.map((step, i) => (
                  <li
                    key={step.role}
                    className="flex items-start gap-4 rounded-lg border border-border/60 bg-background p-4 shadow-sm"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground">
                      {i + 1}
                    </span>
                    <span className="pt-1 text-sm leading-relaxed text-foreground">
                      <span className="font-semibold">{step.role} — </span>
                      {step.text}
                    </span>
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
              Ready to get started?
            </h2>
            <p className="mx-auto mt-2 max-w-md text-primary-foreground/75">
              Use your administrator-assigned credentials to access your workspace. Your role
              determines where you land automatically.
            </p>
            <div className="mt-7">
              <Link href="/auth/signin">
                <Button
                  size="lg"
                  className="bg-accent text-accent-foreground shadow-md transition-all duration-200 hover:scale-[1.03] hover:bg-accent/90 hover:shadow-xl"
                >
                  Sign in to your account
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-secondary/40">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} EF Architects &amp; Engineers Consulting PLC. All rights reserved.</p>
          <p>Internal management portal</p>
        </div>
      </footer>
    </div>
  )
}
