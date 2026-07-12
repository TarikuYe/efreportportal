'use client'

import {
  FolderKanban,
  Building2,
  HardHat,
  Calendar,
  CalendarCheck,
  FolderOpen,
  CheckCircle2,
  Clock,
  ArrowLeft,
} from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Project {
  id: string
  code: string
  name: string
  active: boolean
  created_at: string
  client?: string | null
  contractor?: string | null
  start_date?: string | null
  estimated_completion?: string | null
}

interface Employee {
  id: string
  full_name: string
  department: string | null
  role: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso: string | null | undefined) {
  if (!iso) return null
  const d = new Date(iso)
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function getDaysRemaining(iso: string | null | undefined): {
  label: string
  tone: string
} | null {
  if (!iso) return null
  const end = new Date(iso)
  if (isNaN(end.getTime())) return null
  const diff = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (diff < 0)
    return { label: `${Math.abs(diff)}d overdue`, tone: 'text-rose-600 bg-rose-500/10' }
  if (diff <= 30)
    return { label: `${diff}d remaining`, tone: 'text-amber-600 bg-amber-500/10' }
  return { label: `${diff}d remaining`, tone: 'text-emerald-600 bg-emerald-500/10' }
}

// ─── Project Detail Card ──────────────────────────────────────────────────────
function ProjectDetailCard({ project }: { project: Project }) {
  const deadline = getDaysRemaining(project.estimated_completion)

  return (
    <Card className="flex flex-col border-border shadow-sm transition-shadow hover:shadow-md overflow-hidden">
      {/* Header band */}
      <div className="flex items-start justify-between gap-3 bg-secondary/30 border-b border-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
              {project.code}
            </span>
            {project.active ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                <CheckCircle2 className="size-2.5" />
                Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                Archived
              </span>
            )}
            {deadline && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${deadline.tone}`}
              >
                <Clock className="size-2.5" />
                {deadline.label}
              </span>
            )}
          </div>
          <h3 className="mt-1.5 text-sm font-semibold text-foreground leading-snug">
            {project.name}
          </h3>
        </div>
      </div>

      {/* Details grid */}
      <CardContent className="flex flex-col gap-4 p-4 flex-1">
        <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
          {project.client && (
            <div className="col-span-full">
              <dt className="flex items-center gap-1 font-semibold text-muted-foreground mb-0.5">
                <Building2 className="size-3" /> Client / Employer
              </dt>
              <dd className="text-foreground font-medium">{project.client}</dd>
            </div>
          )}

          {project.contractor && (
            <div className="col-span-full">
              <dt className="flex items-center gap-1 font-semibold text-muted-foreground mb-0.5">
                <HardHat className="size-3" /> Contractor
              </dt>
              <dd className="text-foreground font-medium">{project.contractor}</dd>
            </div>
          )}

          <div>
            <dt className="flex items-center gap-1 font-semibold text-muted-foreground mb-0.5">
              <Calendar className="size-3" /> Start Date
            </dt>
            <dd className="text-foreground">{formatDate(project.start_date) ?? '—'}</dd>
          </div>

          <div>
            <dt className="flex items-center gap-1 font-semibold text-muted-foreground mb-0.5">
              <CalendarCheck className="size-3" /> Est. Completion
            </dt>
            <dd className="text-foreground">{formatDate(project.estimated_completion) ?? '—'}</dd>
          </div>
        </dl>

        {/* Created date footnote */}
        <p className="mt-auto text-[10px] text-muted-foreground/70">
          Registered{' '}
          {new Date(project.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
      </CardContent>
    </Card>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function AssignedProjectsHub({
  employee,
  assignedProjects,
}: {
  employee: Employee
  assignedProjects: Project[]
}) {
  const activeProjects = assignedProjects.filter((p) => p.active)
  const archivedProjects = assignedProjects.filter((p) => !p.active)

  return (
    <div className="flex flex-col gap-8">
      {/* ── Page Header ── */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="absolute right-0 top-0 translate-x-1/3 -translate-y-1/3 size-40 rounded-full bg-primary/5 blur-2xl pointer-events-none" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <FolderKanban className="size-6 text-accent" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground">
                My Assigned Projects
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {employee.full_name} &middot; {employee.department ?? employee.role} &middot; Read-only directory
              </p>
            </div>
          </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground self-start sm:self-auto"
        >
          <ArrowLeft className="size-4" />
          Back to Dashboard
        </Link>
        </div>
      </div>

      {/* ── Summary Chips ── */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm shadow-sm">
          <FolderKanban className="size-4 text-primary" />
          <span className="font-semibold text-foreground">{assignedProjects.length}</span>
          <span className="text-muted-foreground">
            project{assignedProjects.length !== 1 ? 's' : ''} assigned
          </span>
        </div>
        {activeProjects.length > 0 && (
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm shadow-sm">
            <CheckCircle2 className="size-4 text-emerald-500" />
            <span className="font-semibold text-foreground">{activeProjects.length}</span>
            <span className="text-muted-foreground">active</span>
          </div>
        )}
        {archivedProjects.length > 0 && (
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm shadow-sm">
            <FolderOpen className="size-4 text-muted-foreground" />
            <span className="font-semibold text-foreground">{archivedProjects.length}</span>
            <span className="text-muted-foreground">archived</span>
          </div>
        )}
      </div>

      {/* ── Empty state ── */}
      {assignedProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card py-24 text-center px-6">
          <div className="flex size-16 items-center justify-center rounded-full bg-secondary mb-4">
            <FolderOpen className="size-8 text-muted-foreground/50" />
          </div>
          <h3 className="font-display text-lg font-semibold text-foreground">
            No projects assigned yet
          </h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            You haven&apos;t been assigned to any projects. Contact your line manager or admin to
            be added to active project teams.
          </p>
        </div>
      ) : (
        <>
          {/* Active projects section */}
          {activeProjects.length > 0 && (
            <section className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <h2 className="font-display text-lg font-bold text-foreground">
                  Active Projects
                </h2>
                <span className="rounded-full bg-emerald-500/12 px-2.5 py-0.5 text-xs font-semibold text-emerald-600">
                  {activeProjects.length}
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {activeProjects.map((project) => (
                  <ProjectDetailCard key={project.id} project={project} />
                ))}
              </div>
            </section>
          )}

          {/* Archived projects section */}
          {archivedProjects.length > 0 && (
            <section className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <h2 className="font-display text-lg font-bold text-muted-foreground">
                  Archived Projects
                </h2>
                <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                  {archivedProjects.length}
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 opacity-70">
                {archivedProjects.map((project) => (
                  <ProjectDetailCard key={project.id} project={project} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
