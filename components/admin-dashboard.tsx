'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import {
  Download,
  FileStack,
  CheckCircle2,
  Clock3,
  Users,
  RefreshCw,
  Bell,
  Loader2,
  AlertTriangle,
  FolderOpen,
  LayoutDashboard,
} from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatusBadge } from '@/components/status-badge'
import { ProjectManager } from '@/components/project-manager'
import { EmployeeManager } from '@/components/employee-manager'
import {
  PROJECTS as FALLBACK_PROJECTS,
  getReportingPeriods,
  formatBytes,
  STATUS_LABELS,
  type ReportSubmission,
  type SubmissionStatus,
  type Project,
} from '@/lib/reports'

type Row = ReportSubmission & { download_url: string | null }

const fetcher = (url: string) => fetch(url).then((r) => r.json())
const periods = getReportingPeriods()

type Tab = 'submissions' | 'projects' | 'employees'

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('submissions')
  const [periodFilter, setPeriodFilter] = useState<string>('all')
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [reminding, setReminding] = useState(false)

  // Dynamic project list
  const { data: projectsData } = useSWR<{ projects: Project[] }>('/api/projects', fetcher)
  const projects: { code: string; name: string }[] =
    (projectsData?.projects ?? FALLBACK_PROJECTS) as { code: string; name: string }[]

  const query = useMemo(() => {
    const params = new URLSearchParams()
    if (periodFilter !== 'all') params.set('period', periodFilter)
    if (projectFilter !== 'all') params.set('project', projectFilter)
    const qs = params.toString()
    return `/api/submissions${qs ? `?${qs}` : ''}`
  }, [periodFilter, projectFilter])

  const { data, isLoading, mutate } = useSWR<{ submissions: Row[] }>(query, fetcher)
  const rows = data?.submissions ?? []

  const currentPeriod = periods[0]?.value

  // Compute metrics
  const metrics = useMemo(() => {
    const uniqueEmployees = new Set(rows.map((r) => r.employee_email))
    const thisPeriodRows = rows.filter((r) => r.reporting_period === currentPeriod)
    const submittedThisPeriod = thisPeriodRows.length
    const allEmployees = new Set(rows.map((r) => r.employee_email))
    const submittersThisPeriod = new Set(thisPeriodRows.map((r) => r.employee_email))
    const missingReports = [...allEmployees].filter((e) => !submittersThisPeriod.has(e))

    return {
      totalEmployees: uniqueEmployees.size,
      activeSubmissions: submittedThisPeriod,
      pendingReview: rows.filter((r) => r.status === 'submitted' || r.status === 'under_review').length,
      approved: rows.filter((r) => r.status === 'approved').length,
      missingReports,
    }
  }, [rows, currentPeriod])

  // Group submissions by employee for directory view
  const employeeDirectory = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string
        email: string
        projects: Set<string>
        submissions: Row[]
      }
    >()

    for (const row of rows) {
      const existing = map.get(row.employee_email)
      if (existing) {
        existing.projects.add(row.project_code)
        existing.submissions.push(row)
      } else {
        map.set(row.employee_email, {
          name: row.employee_name,
          email: row.employee_email,
          projects: new Set([row.project_code]),
          submissions: [row],
        })
      }
    }

    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [rows])

  const projectName = (code: string) => {
    const found = projects.find((p) =>
      'code' in p ? (p as Project).code === code : (p as { code: string }).code === code
    )
    return found?.name ?? code
  }

  async function triggerReminders() {
    setReminding(true)
    try {
      const res = await fetch('/api/send-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to send reminders')
      toast.success('Reminders sent', {
        description: data.sent
          ? `Reminder dispatched for ${data.period}`
          : `Reminder workflow triggered (${data.reason ?? 'no action'})`,
      })
    } catch (err) {
      toast.error('Failed to send reminders', {
        description: err instanceof Error ? err.message : 'Please try again.',
      })
    } finally {
      setReminding(false)
    }
  }

  async function updateStatus(id: string, status: SubmissionStatus) {
    mutate(
      (prev) =>
        prev
          ? { submissions: prev.submissions.map((r) => (r.id === id ? { ...r, status } : r)) }
          : prev,
      false,
    )
    try {
      const res = await fetch('/api/submissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (!res.ok) throw new Error()
      toast.success('Status updated')
    } catch {
      toast.error('Failed to update status')
      mutate()
    }
  }

  const metricCards = [
    {
      label: 'Total employees',
      value: metrics.totalEmployees,
      icon: Users,
      tone: 'text-chart-3',
    },
    {
      label: 'Active this period',
      value: metrics.activeSubmissions,
      icon: FileStack,
      tone: 'text-accent',
    },
    {
      label: 'Pending review',
      value: metrics.pendingReview,
      icon: Clock3,
      tone: 'text-chart-3',
    },
    {
      label: 'Approved',
      value: metrics.approved,
      icon: CheckCircle2,
      tone: 'text-chart-4',
    },
  ]

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'submissions', label: 'Submissions', icon: LayoutDashboard },
    { id: 'projects', label: 'Projects', icon: FolderOpen },
    { id: 'employees', label: 'Employees', icon: Users },
  ]

  return (
    <div className="flex flex-col gap-8">
      {/* Tab navigation */}
      <div className="flex items-center gap-1 rounded-xl border border-border bg-secondary/40 p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon className="size-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── SUBMISSIONS TAB ── */}
      {activeTab === 'submissions' && (
        <>
          {/* Overview Metrics */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {metricCards.map((m) => (
              <Card key={m.label}>
                <CardContent className="flex items-center justify-between gap-4 py-5">
                  <div>
                    <p className="text-sm text-muted-foreground">{m.label}</p>
                    <p className="mt-1 font-display text-3xl font-extrabold text-foreground">
                      {m.value}
                    </p>
                  </div>
                  <span className={m.tone}>
                    <m.icon className="size-8" strokeWidth={1.75} />
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Missing Reports Alert */}
          {metrics.missingReports.length > 0 && (
            <Card className="border-accent/30 bg-accent/5">
              <CardContent className="flex items-center gap-3 py-4">
                <AlertTriangle className="size-5 shrink-0 text-accent" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    Missing reports — {metrics.missingReports.length} employee
                    {metrics.missingReports.length > 1 ? 's' : ''} haven&apos;t submitted for{' '}
                    {periods.find((p) => p.value === currentPeriod)?.label ?? currentPeriod}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {metrics.missingReports.join(', ')}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reminder Override */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-accent/15 text-accent">
                <Bell className="size-5" />
              </span>
              <div>
                <h3 className="font-display font-semibold text-foreground">Send email reminders</h3>
                <p className="text-sm text-muted-foreground">
                  Force-trigger the reminder email workflow immediately
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={triggerReminders}
              disabled={reminding}
              className="shrink-0"
            >
              {reminding ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Sending…
                </>
              ) : (
                <>
                  <Bell className="size-4" /> Trigger reminders
                </>
              )}
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v ?? 'all')}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All periods" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All periods</SelectItem>
                {periods.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={projectFilter} onValueChange={(v) => setProjectFilter(v ?? 'all')}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.code} value={p.code}>
                    {p.code} — {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <button
              onClick={() => mutate()}
              className="ml-auto inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <RefreshCw className="size-4" /> Refresh
            </button>
          </div>

          {/* Employee Directory & Submissions Grid */}
          <Card>
            <CardHeader className="border-b border-border">
              <CardTitle className="font-display">Employee directory</CardTitle>
              <CardDescription>
                {employeeDirectory.length} registered employee{employeeDirectory.length !== 1 ? 's' : ''}{' '}
                across all project streams
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Projects</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>File</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                          Loading submissions…
                        </TableCell>
                      </TableRow>
                    ) : rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                          No submissions found for the selected filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <div className="font-medium text-foreground">{r.employee_name}</div>
                            <div className="text-xs text-muted-foreground">{r.employee_email}</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-foreground">{r.project_code}</div>
                            <div className="max-w-[180px] truncate text-xs text-muted-foreground">
                              {projectName(r.project_code)}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {periods.find((p) => p.value === r.reporting_period)?.label ??
                              r.reporting_period}
                          </TableCell>
                          <TableCell>
                            <div className="max-w-[160px] truncate text-sm text-foreground">
                              {r.file_name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatBytes(r.file_size)}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {new Date(r.submitted_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={r.status} />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-2">
                              <Select
                                value={r.status}
                                onValueChange={(v) => v && updateStatus(r.id, v as SubmissionStatus)}
                              >
                                <SelectTrigger className="h-8 w-[150px] text-xs">
                                  <SelectValue>
                                    {(v: string) => STATUS_LABELS[v as SubmissionStatus]}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {(Object.keys(STATUS_LABELS) as SubmissionStatus[]).map((s) => (
                                    <SelectItem key={s} value={s} className="text-xs">
                                      {STATUS_LABELS[s]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {r.download_url ? (
                                <a
                                  href={r.download_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                                  aria-label={`Download ${r.file_name}`}
                                >
                                  <Download className="size-4" />
                                </a>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── PROJECTS TAB ── */}
      {activeTab === 'projects' && <ProjectManager />}

      {/* ── EMPLOYEES TAB ── */}
      {activeTab === 'employees' && <EmployeeManager />}
    </div>
  )
}
