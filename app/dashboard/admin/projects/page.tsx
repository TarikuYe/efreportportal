'use client'

import React, { useState, useMemo } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import {
  FolderKanban,
  Plus,
  Check,
  Loader2,
  Search,
  Users,
  Calendar,
  Building2,
  HardHat,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  X,
  RefreshCw,
  CalendarCheck,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { SiteHeader } from '@/components/site-header'

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
  email: string
  department: string | null
  role: string
  active?: boolean
}

interface Assignment {
  employee_id: string
  project_code: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fetcher = async (url: string) => {
  const res = await fetch(url)
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error ?? `Request failed (${res.status})`)
  return json
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return null
  const d = new Date(iso)
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Project Creation Form ────────────────────────────────────────────────────
function ProjectCreationForm({ onCreated }: { onCreated: () => void }) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [client, setClient] = useState('')
  const [contractor, setContractor] = useState('')
  const [startDate, setStartDate] = useState('')
  const [estimatedCompletion, setEstimatedCompletion] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const reset = () => {
    setCode('')
    setName('')
    setClient('')
    setContractor('')
    setStartDate('')
    setEstimatedCompletion('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/projects/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          name,
          client: client || undefined,
          contractor: contractor || undefined,
          start_date: startDate || undefined,
          estimated_completion: estimatedCompletion || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to create project.')
      toast.success('Project registered', {
        description: `${json.project.code} — ${json.project.name}`,
      })
      reset()
      onCreated()
    } catch (err) {
      toast.error('Failed to create project', {
        description: err instanceof Error ? err.message : 'Please try again.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Code + Name */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="proj-code" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Project Code *
          </Label>
          <Input
            id="proj-code"
            placeholder="EF-2407"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="w-full font-mono uppercase sm:w-36"
            required
            maxLength={20}
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="proj-name" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Project Name *
          </Label>
          <Input
            id="proj-name"
            placeholder="e.g. Westside Office Complex"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={255}
          />
        </div>
      </div>

      {/* Client + Contractor */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="proj-client" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Building2 className="size-3" /> Client / Employer
          </Label>
          <Input
            id="proj-client"
            placeholder="e.g. Addis Urban Development"
            value={client}
            onChange={(e) => setClient(e.target.value)}
            maxLength={255}
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="proj-contractor" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <HardHat className="size-3" /> Contractor
          </Label>
          <Input
            id="proj-contractor"
            placeholder="e.g. Sunshine Construction"
            value={contractor}
            onChange={(e) => setContractor(e.target.value)}
            maxLength={255}
          />
        </div>
      </div>

      {/* Dates */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="proj-start" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Calendar className="size-3" /> Start Date
          </Label>
          <Input
            id="proj-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="proj-end" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <CalendarCheck className="size-3" /> Est. Completion
          </Label>
          <Input
            id="proj-end"
            type="date"
            value={estimatedCompletion}
            onChange={(e) => setEstimatedCompletion(e.target.value)}
          />
        </div>
      </div>

      {/* Submit */}
      <Button type="submit" disabled={submitting} className="mt-1 w-full shadow-sm">
        {submitting ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Registering…
          </>
        ) : (
          <>
            <Plus className="size-4" /> Register Project
          </>
        )}
      </Button>
    </form>
  )
}

// ─── Assignment Multi-Select Dropdown ─────────────────────────────────────────
// Fetches employees directly — avoids stale prop issues when parent data loads
// after the card grid has already rendered.
function AssignmentDropdown({
  project,
  assignedIds,
  onAssignmentChange,
}: {
  project: Project
  assignedIds: Set<string>
  onAssignmentChange: () => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Fetch employees directly in the dropdown — always fresh
  const { data: empData, isLoading: empLoading, error: empError, mutate: retryEmployees } = useSWR<{ employees: Employee[] }>('/api/employees', fetcher)
  const employees: Employee[] = empData?.employees ?? []

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return employees.filter(
      (e) =>
        e.full_name.toLowerCase().includes(q) ||
        (e.department ?? '').toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q),
    )
  }, [employees, search])

  async function toggleEmployee(emp: Employee) {
    const isAssigned = assignedIds.has(emp.id)
    setTogglingId(emp.id)
    try {
      const res = await fetch('/api/employees/assignments', {
        method: isAssigned ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: emp.id, project_code: project.code }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed.')
      onAssignmentChange()
    } catch (err) {
      toast.error('Assignment update failed', {
        description: err instanceof Error ? err.message : 'Please try again.',
      })
    } finally {
      setTogglingId(null)
    }
  }

  const assignedCount = assignedIds.size

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
          open
            ? 'border-primary/50 bg-primary/5 text-foreground shadow-sm'
            : 'border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground'
        }`}
      >
        <span className="flex items-center gap-2">
          <Users className="size-4 shrink-0" />
          {assignedCount === 0 ? 'Assign staff' : `${assignedCount} assigned`}
        </span>
        {open ? <ChevronUp className="size-4 shrink-0" /> : <ChevronDown className="size-4 shrink-0" />}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1.5 overflow-hidden rounded-xl border border-border bg-card shadow-xl" style={{maxHeight: 'min(52vh, 340px)'}}>
          {/* Search */}
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                type="text"
                placeholder="Search staff…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-xs text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Employee list */}
          <div className="max-h-52 overflow-y-auto p-1">
            {empLoading ? (
              <div className="flex items-center justify-center gap-2 px-3 py-6 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                Loading staff…
              </div>
            ) : empError ? (
              <div className="flex flex-col items-center gap-2 px-3 py-5 text-center">
                <AlertTriangle className="size-4 text-destructive" />
                <p className="text-xs text-destructive">
                  {empError?.message ?? 'Failed to load staff'}
                </p>
                <button
                  onClick={() => retryEmployees()}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-primary hover:underline"
                >
                  <RotateCcw className="size-3" /> Retry
                </button>
              </div>
            ) : employees.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                No staff members found.
              </p>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                No staff match your search.
              </p>
            ) : (
              filtered.map((emp) => {
                const checked = assignedIds.has(emp.id)
                const isToggling = togglingId === emp.id
                return (
                  <button
                    key={emp.id}
                    onClick={() => toggleEmployee(emp)}
                    disabled={isToggling}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs transition-colors disabled:opacity-60 ${
                      checked
                        ? 'bg-primary/8 text-foreground'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                    }`}
                  >
                    <span
                      className={`flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${
                        checked
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background'
                      }`}
                    >
                      {isToggling ? (
                        <Loader2 className="size-2.5 animate-spin" />
                      ) : checked ? (
                        <Check className="size-2.5" />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-foreground">
                        {emp.full_name}
                      </span>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {emp.department ?? emp.email}
                      </span>
                    </span>
                  </button>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-border p-2">
            <button
              onClick={() => { setOpen(false); setSearch('') }}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Project Card ─────────────────────────────────────────────────────────────
function ProjectCard({
  project,
  employees,
  assignedIds,
  onAssignmentChange,
}: {
  project: Project
  employees: Employee[]
  assignedIds: Set<string>
  onAssignmentChange: () => void
}) {
  const assignedEmployees = employees.filter((e) => assignedIds.has(e.id))

  return (
    <Card className="group flex flex-col gap-0 overflow-hidden border-border/60 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      {/* Status accent bar */}
      <div className={`h-1 w-full ${project.active ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gradient-to-r from-slate-400 to-slate-300'}`} />

      {/* Card header band */}
      <div className="flex items-start justify-between gap-3 border-b border-border bg-secondary/30 px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs font-bold text-primary">
              {project.code}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                project.active
                  ? 'bg-emerald-500/12 text-emerald-600'
                  : 'bg-secondary text-muted-foreground'
              }`}
            >
              {project.active ? 'Active' : 'Archived'}
            </span>
          </div>
          <h3 className="mt-1.5 truncate text-sm font-semibold leading-snug text-foreground">
            {project.name}
          </h3>
        </div>
      </div>

      {/* Meta details */}
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
          {project.client && (
            <div className="col-span-2">
              <span className="flex items-center gap-1 font-semibold text-muted-foreground">
                <Building2 className="size-3" /> Client
              </span>
              <span className="text-foreground">{project.client}</span>
            </div>
          )}
          {project.contractor && (
            <div className="col-span-2">
              <span className="flex items-center gap-1 font-semibold text-muted-foreground">
                <HardHat className="size-3" /> Contractor
              </span>
              <span className="text-foreground">{project.contractor}</span>
            </div>
          )}
          <div>
            <span className="flex items-center gap-1 font-semibold text-muted-foreground">
              <Calendar className="size-3" /> Start
            </span>
            <span className={formatDate(project.start_date) ? 'text-foreground' : 'italic text-muted-foreground/50'}>
              {formatDate(project.start_date) ?? 'Not set'}
            </span>
          </div>
          <div>
            <span className="flex items-center gap-1 font-semibold text-muted-foreground">
              <CalendarCheck className="size-3" /> Est. Completion
            </span>
            <span className={formatDate(project.estimated_completion) ? 'text-foreground' : 'italic text-muted-foreground/50'}>
              {formatDate(project.estimated_completion) ?? 'Not set'}
            </span>
          </div>
        </div>

        {/* Assigned staff chips */}
        {assignedEmployees.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-t border-border/50 pt-3">
            {assignedEmployees.map((emp) => (
              <span
                key={emp.id}
                className="inline-flex items-center rounded-full bg-accent/12 px-2 py-0.5 text-[11px] font-medium text-accent"
                title={emp.email}
              >
                {emp.full_name.split(' ')[0]}
              </span>
            ))}
          </div>
        )}

        {/* Assignment dropdown — fetches employees itself */}
        <div className="mt-auto pt-2">
          <AssignmentDropdown
            project={project}
            assignedIds={assignedIds}
            onAssignmentChange={onAssignmentChange}
          />
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminProjectsPage() {
  const {
    data: projectsData,
    isLoading: loadingProjects,
    mutate: mutateProjects,
  } = useSWR<{ projects: Project[] }>('/api/projects?all=1', fetcher)

  const { data: employeesData, isLoading: loadingEmployees, error: employeesError, mutate: mutateEmployees } = useSWR<{ employees: Employee[] }>(
    '/api/employees',
    fetcher,
  )

  const {
    data: assignData,
    mutate: mutateAssignments,
  } = useSWR<{ assignments: Assignment[] }>('/api/employees/assignments', fetcher)

  const projects = projectsData?.projects ?? []
  const employees = employeesData?.employees ?? []
  const assignments = assignData?.assignments ?? []

  const [search, setSearch] = useState('')

  // Build projectCode → Set<employeeId> map
  const assignmentMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const a of assignments) {
      if (!map.has(a.project_code)) map.set(a.project_code, new Set())
      map.get(a.project_code)!.add(a.employee_id)
    }
    return map
  }, [assignments])

  const filteredProjects = useMemo(() => {
    if (!search.trim()) return projects
    const q = search.toLowerCase()
    return projects.filter(
      (p) =>
        p.code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.client ?? '').toLowerCase().includes(q) ||
        (p.contractor ?? '').toLowerCase().includes(q),
    )
  }, [projects, search])

  const totalActive = projects.filter((p) => p.active).length
  const totalAssigned = new Set(assignments.map((a) => a.employee_id)).size

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-secondary/30 to-background">
      <SiteHeader />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        {/* ── Page Header ── */}
        <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-border/60 bg-background/80 p-5 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-center gap-3.5">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-md">
              <FolderKanban className="size-6 text-accent" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                Project Management Console
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Register new projects and assign staff to the project lifecycle.
              </p>
            </div>
          </div>
          <button
            onClick={() => { mutateProjects(); mutateAssignments(); mutateEmployees() }}
            className="inline-flex items-center gap-2 self-start rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground shadow-sm transition-all hover:border-primary/30 hover:bg-secondary hover:text-foreground sm:self-auto"
          >
            <RefreshCw className="size-4" /> Refresh
          </button>
        </div>

        {/* ── Summary Chips ── */}
        <div className="mb-8 flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm shadow-sm">
            <span className="flex size-6 items-center justify-center rounded-full bg-accent/10">
              <FolderOpen className="size-3.5 text-accent" />
            </span>
            <span className="font-semibold text-foreground">{projects.length}</span>
            <span className="text-muted-foreground">total projects</span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm shadow-sm">
            <span className="flex size-6 items-center justify-center rounded-full bg-emerald-500/10">
              <Check className="size-3.5 text-emerald-500" />
            </span>
            <span className="font-semibold text-foreground">{totalActive}</span>
            <span className="text-muted-foreground">active</span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm shadow-sm">
            <span className="flex size-6 items-center justify-center rounded-full bg-chart-3/10">
              <Users className="size-3.5 text-chart-3" />
            </span>
            <span className="font-semibold text-foreground">{totalAssigned}</span>
            <span className="text-muted-foreground">staff assigned</span>
          </div>
        </div>

        {/* ── Employee load error banner ── */}
        {employeesError && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive shadow-sm">
            <AlertTriangle className="size-4 shrink-0" />
            <span className="font-semibold">Could not load employees:</span>
            <span>{employeesError.message}</span>
            <button onClick={() => mutateEmployees()} className="ml-auto text-xs underline hover:no-underline">
              Retry
            </button>
          </div>
        )}

        {/* ── Two-Column Split Layout ── */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[380px_1fr]">

          {/* ── LEFT: Project Creation Form ── */}
          <div className="flex flex-col gap-6">
            <Card className="overflow-hidden border-accent/25 bg-gradient-to-b from-accent/5 to-transparent shadow-sm">
              <CardHeader className="border-b border-border/60 pb-4">
                <CardTitle className="font-display flex items-center gap-2 text-base">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <Plus className="size-4.5" />
                  </span>
                  Register New Project
                </CardTitle>
                <CardDescription>
                  Add a new project to the lifecycle tracking system.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-5">
                <ProjectCreationForm onCreated={() => mutateProjects()} />
              </CardContent>
            </Card>

            {/* Quick stats card */}
            <Card className="border-border/60 shadow-sm">
              <CardContent className="px-5 py-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Staff Overview
                </p>
                {employeesError ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-destructive">Failed to load employees: {employeesError.message}</p>
                    <button onClick={() => mutateEmployees()} className="self-start text-xs text-primary hover:underline">
                      Retry
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Total employees</span>
                      <span className="font-semibold text-foreground">{loadingEmployees ? '…' : employees.length}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Active employees</span>
                      <span className="font-semibold text-foreground">
                        {loadingEmployees ? '…' : employees.filter((e) => e.active !== false).length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Assigned to projects</span>
                      <span className="font-semibold text-foreground">{totalAssigned}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── RIGHT: Dynamic Assignment Matrix ── */}
          <div className="flex flex-col gap-5">
            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search projects by code, name, client or contractor…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-background pl-9 shadow-sm"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            {loadingProjects ? (
              <div className="flex items-center justify-center gap-3 py-20 text-muted-foreground">
                <Loader2 className="size-7 animate-spin text-primary" />
                <p className="text-sm">Loading projects…</p>
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-background/50 py-20 text-center">
                <span className="mb-3 flex size-14 items-center justify-center rounded-full bg-secondary/60">
                  <FolderOpen className="size-7 text-muted-foreground/50" />
                </span>
                <p className="text-sm font-medium text-muted-foreground">
                  {search ? 'No projects match your search.' : 'No projects registered yet.'}
                </p>
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="mt-2 text-xs text-primary hover:underline"
                  >
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredProjects.map((project) => (
                  <ProjectCard
                    key={project.code}
                    project={project}
                    employees={employees}
                    assignedIds={assignmentMap.get(project.code) ?? new Set()}
                    onAssignmentChange={() => mutateAssignments()}
                  />
                ))}
              </div>
            )}

            {search && filteredProjects.length > 0 && (
              <p className="text-center text-xs text-muted-foreground">
                Showing {filteredProjects.length} of {projects.length} project{projects.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-border bg-secondary/40">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} EF Architect &amp; Engineering. All rights reserved.</p>
          <p>Project Management Console</p>
        </div>
      </footer>
    </div>
  )
}