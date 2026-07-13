'use client'

import React, { useMemo, useState, useEffect, useRef } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import {
  History,
  Clock3,
  Settings,
  Eye,
  EyeOff,
  ShieldCheck,
  Loader2,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Clock,
  Sparkles,
  Lock,
  FolderKanban,
  Save,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { EmployeeReportPanel } from '@/components/employee-report-panel'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type Tab = 'timesheet' | 'settings'

function getWeekRange(refDate: Date) {
  const current = new Date(refDate)
  const day = current.getDay()
  // Monday is day 1, Sunday is day 7 (getDay() returns 0 for Sunday)
  const diff = current.getDate() - (day === 0 ? 6 : day - 1)
  const monday = new Date(current.setDate(diff))
  monday.setHours(0, 0, 0, 0)
  
  const days = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    days.push(d)
  }
  const sunday = days[6]
  const workDays = days.filter(d => d.getDay() !== 0) // Sunday is 0, so filter it out
  return { monday, sunday, days: workDays }
}

function formatDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function displayDateLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

// ─────────────────────────────────────────
// Password change card
// ─────────────────────────────────────────
function ChangePasswordCard({ userEmail }: { userEmail: string }) {
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSuccess(false)

    if (newPw.length < 8) {
      toast.error('Password too short', { description: 'New password must be at least 8 characters.' })
      return
    }
    if (newPw !== confirmPw) {
      toast.error('Passwords do not match', { description: 'New password and confirmation must be identical.' })
      return
    }
    if (currentPw === newPw) {
      toast.error('Same password', { description: 'New password must be different from your current one.' })
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: currentPw,
    })

    if (verifyError) {
      toast.error('Current password incorrect', {
        description: 'Please check your current password and try again.',
      })
      setLoading(false)
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPw })

    if (updateError) {
      toast.error('Password update failed', { description: updateError.message })
      setLoading(false)
      return
    }

    toast.success('Password updated', { description: 'Your password has been changed successfully.' })
    setCurrentPw('')
    setNewPw('')
    setConfirmPw('')
    setSuccess(true)
    setLoading(false)
  }

  return (
    <Card className="max-w-lg shadow-sm border-border bg-card">
      <CardHeader className="border-b border-border">
        <CardTitle className="font-display flex items-center gap-2 text-foreground">
          <ShieldCheck className="size-5 text-primary" />
          Change password
        </CardTitle>
        <CardDescription>
          Update your password regularly to keep your account secure.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        {success && (
          <div className="mb-5 flex items-center gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-600">
            <CheckCircle className="size-4 shrink-0" />
            Password changed successfully. Use your new password next time you sign in.
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="current-pw">Current password</Label>
            <div className="relative">
              <Input
                id="current-pw"
                type={showCurrent ? 'text' : 'password'}
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                placeholder="Enter current password"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                tabIndex={-1}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-pw">New password</Label>
            <div className="relative">
              <Input
                id="new-pw"
                type={showNew ? 'text' : 'password'}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="Minimum 8 characters"
                required
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                tabIndex={-1}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm-pw">Confirm new password</Label>
            <div className="relative">
              <Input
                id="confirm-pw"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="Confirm new password"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                tabIndex={-1}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full sm:w-auto mt-2">
            {loading ? (
              <><Loader2 className="size-4 animate-spin mr-2" /> Updating...</>
            ) : (
              'Update password'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────
// Timesheet Logger row interface
// ─────────────────────────────────────────
interface TimesheetRow {
  id?: number | string // numeric database id (saved/locked) or temporary string id (unsaved)
  log_date: string
  assigned_tasks: string
  actual_work_done: string
  hours_worked: number
  actual_working_hour: number
  completion_percentage: number
  done_at_home: boolean
  remark: string
  office_entrance_time: string
  office_leave_time: string
  approval_status: 'Pending' | 'Approved' | 'Returned'
  head_comments?: string | null
  reviewed_at?: string | null
  isNew?: boolean // true only for rows not yet persisted to the database
}

/**
 * Returns true when a row is already persisted (has a numeric DB id).
 * Persisted rows are immutable — neither the employee nor the server
 * allows any mutation once saved.
 */
function isRowLocked(row: TimesheetRow): boolean {
  return typeof row.id === 'number'
}

// ─────────────────────────────────────────
// localStorage draft helpers
//
// Drafts are stored as a JSON map of { [log_date]: Partial<TimesheetRow> }
// so each day's unsaved content is independently tracked.
// Key format: timesheet_draft__{userId}__{mondayStr}
// ─────────────────────────────────────────
type DraftMap = Record<string, Partial<TimesheetRow>>

function getDraftKey(userId: string, mondayStr: string): string {
  return `timesheet_draft__${userId}__${mondayStr}`
}

function saveDrafts(userId: string, mondayStr: string, rows: TimesheetRow[]): void {
  if (typeof window === 'undefined') return
  try {
    const drafts: DraftMap = {}
    rows.forEach((row) => {
      if (!isRowLocked(row)) {
        drafts[row.log_date] = {
          assigned_tasks: row.assigned_tasks,
          actual_work_done: row.actual_work_done,
          hours_worked: row.hours_worked,
          actual_working_hour: row.actual_working_hour,
          completion_percentage: row.completion_percentage,
          done_at_home: row.done_at_home,
          remark: row.remark,
          office_entrance_time: row.office_entrance_time,
          office_leave_time: row.office_leave_time,
        }
      }
    })
    window.localStorage.setItem(getDraftKey(userId, mondayStr), JSON.stringify(drafts))
  } catch {
    // localStorage quota exceeded or unavailable — silently skip
  }
}

function loadDrafts(userId: string, mondayStr: string): DraftMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(getDraftKey(userId, mondayStr))
    return raw ? (JSON.parse(raw) as DraftMap) : {}
  } catch {
    return {}
  }
}

function clearDrafts(userId: string, mondayStr: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(getDraftKey(userId, mondayStr))
  } catch {
    // ignore
  }
}

export function EmployeeWorkspace({
  userId,
  userEmail,
  userName,
  userDepartment,
  userRole,
}: {
  userId: string
  userEmail: string
  userName: string
  userDepartment: string
  userRole: string
}) {
  const [activeTab, setActiveTab] = useState<Tab>('timesheet')
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search)
      const tabParam = searchParams.get('tab')
      if (tabParam === 'settings') {
        setActiveTab('settings')
      } else if (tabParam === 'timesheet') {
        setActiveTab('timesheet')
      }
    }
  }, [])

  const [referenceDate, setReferenceDate] = useState<Date>(() => new Date())
  const [saving, setSaving] = useState(false)
  const [localRows, setLocalRows] = useState<TimesheetRow[]>([])
  const [correctingKey, setCorrectingKey] = useState<string | null>(null)

  const { monday, sunday, days } = useMemo(() => getWeekRange(referenceDate), [referenceDate])
  const mondayStr = formatDateString(monday)
  const sundayStr = formatDateString(sunday)

  // Fetch week's logs from API — poll every 10 s so admin approvals/returns
  // are reflected on the employee side without a manual page reload.
  const { data, isLoading, mutate } = useSWR<{ logs: any[] }>(
    `/api/daily-work-logs?start_date=${mondayStr}&end_date=${sundayStr}`,
    fetcher,
    { refreshInterval: 10_000 }
  )

  // Sync database logs with local rows state, restoring any localStorage drafts
  // for days that haven't been submitted yet.
  useEffect(() => {
    if (!data) return

    const dbLogs = data.logs ?? []
    const drafts = loadDrafts(userId, mondayStr)
    const mappedRows: TimesheetRow[] = []

    // Populate all 7 days of the week.
    // If a day has logs in the database, add them (locked).
    // Otherwise seed a row — restoring any draft the user previously typed.
    days.forEach(day => {
      const dateStr = formatDateString(day)
      const dayLogs = dbLogs.filter((l: any) => l.log_date === dateStr)
      const isSaturday = day.getDay() === 6
      const draft = drafts[dateStr] // may be undefined if no draft exists

      if (dayLogs.length > 0) {
        dayLogs.forEach((log: any) => {
          mappedRows.push({
            id: log.id,
            log_date: log.log_date,
            assigned_tasks: log.assigned_tasks || '',
            actual_work_done: log.actual_work_done || '',
            hours_worked: Number(log.hours_worked || 0),
            actual_working_hour: Number(log.actual_working_hour || 0),
            completion_percentage: Number(log.completion_percentage || 0),
            done_at_home: !!log.done_at_home,
            remark: log.remark || '',
            office_entrance_time: log.office_entrance_time ? log.office_entrance_time.substring(0, 5) : '08:30',
            office_leave_time: log.office_leave_time ? log.office_leave_time.substring(0, 5) : (isSaturday ? '12:30' : '17:30'),
            // approval_status and head_comments come from the latest review record
            // (flattened by the API) — never from a mutation of the original row
            approval_status: log.approval_status ?? 'Pending',
            head_comments: log.head_comments ?? null,
            reviewed_at: log.reviewed_at ?? null,
            isNew: false, // persisted rows are locked
          })
        })
      } else {
        // Seed an empty row, overlaying any draft content so the user's
        // in-progress work is restored after a refresh.
        mappedRows.push({
          log_date: dateStr,
          assigned_tasks: draft?.assigned_tasks ?? '',
          actual_work_done: draft?.actual_work_done ?? '',
          hours_worked: draft?.hours_worked ?? (isSaturday ? 4 : 8),
          actual_working_hour: draft?.actual_working_hour ?? (isSaturday ? 4 : 8),
          completion_percentage: draft?.completion_percentage ?? 0.80,
          done_at_home: draft?.done_at_home ?? false,
          remark: draft?.remark ?? '',
          office_entrance_time: draft?.office_entrance_time ?? '08:30',
          office_leave_time: draft?.office_leave_time ?? (isSaturday ? '12:30' : '17:30'),
          approval_status: 'Pending',
          isNew: true,
        })
      }
    })

    setLocalRows(mappedRows)
  }, [data, days, userId, mondayStr])

  // Persist unsaved (new) row content to localStorage whenever it changes.
  // Debounced with a short delay to avoid hammering storage on every keystroke.
  const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [draftSaved, setDraftSaved] = useState(false)

  useEffect(() => {
    const hasNewRows = localRows.some(r => !isRowLocked(r))
    if (!hasNewRows) return

    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current)
    draftSaveTimer.current = setTimeout(() => {
      saveDrafts(userId, mondayStr, localRows)
      setDraftSaved(true)
      // Hide the indicator after 2 s
      setTimeout(() => setDraftSaved(false), 2000)
    }, 600)

    return () => {
      if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current)
    }
  }, [localRows, userId, mondayStr])

  const navigateWeek = (weeks: number) => {
    const newRef = new Date(referenceDate)
    newRef.setDate(newRef.getDate() + weeks * 7)
    setReferenceDate(newRef)
  }

  const handleInputChange = (index: number, field: keyof TimesheetRow, value: any) => {
    // Immutability guard — saved rows are permanently read-only for employees
    const row = localRows[index]
    if (isRowLocked(row)) {
      toast.error('Submission Locked', {
        description: 'Once a daily task log is saved it cannot be modified. Please contact your line manager if a correction is needed.',
      })
      return
    }
    setLocalRows(prev => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value }
      return copy
    })
  }

  const correctFieldText = async (
    index: number,
    field: 'assigned_tasks' | 'actual_work_done' | 'remark'
  ) => {
    const row = localRows[index]
    const text = row[field]?.trim()
    if (!text) {
      toast.error('Nothing to correct', { description: 'Please enter some text first.' })
      return
    }

    const key = `${index}-${field}`
    setCorrectingKey(key)

    try {
      const res = await fetch('/api/text-correction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, field }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Correction failed')

      handleInputChange(index, field, json.corrected)
      toast.success('Text corrected', { description: 'Grammar and clarity improved with Gemini.' })
    } catch (err) {
      toast.error('Correction failed', {
        description: err instanceof Error ? err.message : 'Please try again.',
      })
    } finally {
      setCorrectingKey(null)
    }
  }

  const addSplitTaskRow = (dateStr: string) => {
    setLocalRows(prev => {
      // Find the last row for this date to insert right after it
      const lastIndex = prev.map(r => r.log_date).lastIndexOf(dateStr)
      const newRow: TimesheetRow = {
        id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        log_date: dateStr,
        assigned_tasks: '',
        actual_work_done: '',
        hours_worked: 4,
        actual_working_hour: 4,
        completion_percentage: 0.50,
        done_at_home: false,
        remark: '',
        office_entrance_time: '08:30',
        office_leave_time: '12:30',
        approval_status: 'Pending',
        isNew: true
      }
      
      const copy = [...prev]
      copy.splice(lastIndex + 1, 0, newRow)
      return copy
    })
    toast.info('Added split day row', { description: `Logging another assignment for ${dateStr}` })
  }

  const removeRow = (index: number) => {
    const row = localRows[index]
    
    // Immutability guard — any row with a DB id is permanently locked
    if (isRowLocked(row)) {
      toast.error('Submission Locked', {
        description: 'Saved task logs cannot be deleted. Please contact your line manager if a correction is needed.',
      })
      return
    }

    // Must keep at least one row per date
    const countForDate = localRows.filter(r => r.log_date === row.log_date).length
    if (countForDate <= 1) {
      toast.error('Cannot remove row', { description: 'Each day of the week must have at least one logger row.' })
      return
    }

    setLocalRows(prev => prev.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    // Only new (unsaved) rows can be submitted — locked rows are silently excluded
    const newRows = localRows.filter(r => !isRowLocked(r))

    if (newRows.length === 0) {
      toast.info('Nothing new to save', {
        description: 'All logs for this week have already been submitted and are locked.',
      })
      return
    }

    // Validation — only against new rows
    const invalidRows = newRows.filter(r => !r.assigned_tasks.trim() || !r.actual_work_done.trim())
    if (invalidRows.length > 0) {
      toast.error('Incomplete work logs', {
        description: `Please fill in "Assigned Tasks" and "Actual Work Done" for all rows. (${invalidRows.length} incomplete)`,
      })
      return
    }

    setSaving(true)
    try {
      // Strip any temporary string ids — only plain INSERT records, no ids included
      const logsToInsert = newRows.map(row => ({
        log_date: row.log_date,
        assigned_tasks: row.assigned_tasks,
        actual_work_done: row.actual_work_done,
        hours_worked: Number(row.hours_worked),
        actual_working_hour: Number(row.actual_working_hour),
        completion_percentage: Number(row.completion_percentage),
        done_at_home: !!row.done_at_home,
        remark: row.remark || null,
        office_entrance_time: row.office_entrance_time ? `${row.office_entrance_time}:00` : null,
        office_leave_time: row.office_leave_time ? `${row.office_leave_time}:00` : null,
        // NOTE: no `id` field — this guarantees the API receives INSERT-only records
      }))

      const res = await fetch('/api/daily-work-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logsToInsert),
      })

      const json = await res.json()

      if (!res.ok) {
        // Surface the lock error specifically
        if (res.status === 409) {
          toast.error('Submission Locked', {
            description: json.error ?? 'Once a daily task log is saved it cannot be modified.',
          })
          return
        }
        throw new Error(json.error ?? 'Failed to submit timesheet.')
      }

      toast.success('Timesheet saved', {
        description: `${json.count} log${json.count !== 1 ? 's' : ''} saved successfully. They are now locked and read-only.`,
      })
      clearDrafts(userId, mondayStr)
      mutate()
    } catch (err) {
      console.error('[timesheet] save error:', err)
      toast.error('Failed to save timesheet', {
        description: err instanceof Error ? err.message : 'Please check your connection and try again.',
      })
    } finally {
      setSaving(false)
    }
  }

  // Helper to color slider values
  const getPercentageColor = (pct: number) => {
    const val = pct * 100
    if (val < 50) return 'text-rose-500 font-semibold'
    if (val <= 80) return 'text-amber-500 font-semibold'
    return 'text-emerald-500 font-semibold'
  }

  const getSliderTrackClass = (pct: number) => {
    const val = pct * 100
    if (val < 50) return 'accent-rose-500'
    if (val <= 80) return 'accent-amber-500'
    return 'accent-emerald-500'
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Greeting Header Block */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="absolute right-0 top-0 translate-x-1/3 -translate-y-1/3 size-36 rounded-full bg-primary/5 blur-2xl" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="size-6 text-accent" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-2xl font-extrabold text-foreground">
                  Hello, {userName}
                </h1>
                <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {userRole}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {userDepartment} &middot; Active Entry Mode
              </p>
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end sm:self-auto">
            <EmployeeReportPanel />
            <div className="flex flex-wrap items-center gap-1 bg-secondary/60 rounded-xl p-1 border border-border w-full sm:w-fit">
            <button
              onClick={() => setActiveTab('timesheet')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                activeTab === 'timesheet'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutDashboard className="size-4" />
              <span className="hidden xs:inline sm:inline">Timesheet</span>
            </button>
            <Link
              href="/dashboard/employee/projects"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all text-muted-foreground hover:text-foreground hover:bg-background/60"
            >
              <FolderKanban className="size-4" />
              <span className="hidden xs:inline sm:inline">My Projects</span>
            </Link>
            <button
              id="tab-settings"
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                activeTab === 'settings'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Settings className="size-4" />
              <span className="hidden xs:inline sm:inline">Settings</span>
            </button>
          </div>
          </div>
        </div>
      </div>

      {/* ── TIMESHEET TAB ── */}
      {activeTab === 'timesheet' && (
        <>
          {/* Week Selector Bar */}
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigateWeek(-1)}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
                title="Previous Week"
              >
                <ChevronLeft className="size-5" />
              </button>
              <div className="min-w-0 flex-1 text-center sm:text-left">
                <span className="block text-sm font-semibold leading-tight text-foreground">
                  {new Date(monday).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {' '}–{' '}
                  {new Date(sunday).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span className="text-xs text-muted-foreground">Reporting week range</span>
              </div>
              <button
                onClick={() => navigateWeek(1)}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
                title="Next Week"
              >
                <ChevronRight className="size-5" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setReferenceDate(new Date())}
                className="h-9 px-3 text-xs sm:text-sm"
              >
                Current Week
              </Button>
              {draftSaved && (
                <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 animate-in fade-in duration-300">
                  <Save className="size-3" />
                  Draft saved
                </span>
              )}
              <Button
                onClick={handleSave}
                disabled={saving || isLoading}
                className="h-9 flex-1 font-semibold sm:flex-none"
              >
                {saving ? (
                  <><Loader2 className="size-4 animate-spin mr-1.5" /> Saving...</>
                ) : (
                  <><span className="hidden sm:inline">Save &amp; Submit Timesheet</span><span className="sm:hidden">Submit</span></>
                )}
              </Button>
            </div>
          </div>

          {/* Timesheet Grid */}
          <Card className="shadow-sm border-border overflow-hidden">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
                  <Loader2 className="size-8 animate-spin text-primary" />
                  <p className="text-sm">Loading timesheet records...</p>
                </div>
              ) : (
                <>
                  {/* ── Mobile card view (hidden on lg+) ── */}
                  <div className="flex flex-col divide-y divide-border lg:hidden">
                    {localRows.map((row, index) => {
                      const locked = isRowLocked(row)
                      const isApproved = row.approval_status === 'Approved'
                      const isReturned = row.approval_status === 'Returned'
                      const formattedDate = new Date(row.log_date)
                      const hasComments = row.head_comments && row.head_comments.trim()

                      return (
                        <div
                          key={row.id || `row_${row.log_date}_${index}`}
                          className={`p-4 ${locked ? 'bg-secondary/10' : ''} ${isApproved ? 'bg-emerald-500/5' : ''}`}
                        >
                          {/* Day header row */}
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5 font-semibold text-sm text-foreground">
                                {displayDateLabel(formattedDate)}
                                {locked && <Lock className="size-3 text-muted-foreground shrink-0" />}
                              </div>
                              <div className="text-xs text-muted-foreground">{row.log_date}</div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                                isApproved ? 'bg-emerald-500/10 text-emerald-600'
                                : isReturned ? 'bg-rose-500/10 text-rose-600'
                                : 'bg-amber-500/10 text-amber-600'
                              }`}>
                                {row.approval_status}
                              </span>
                              {!locked && (
                                <button
                                  onClick={() => addSplitTaskRow(row.log_date)}
                                  className="inline-flex size-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
                                  title="Add Split Task Row"
                                >
                                  <Plus className="size-4" />
                                </button>
                              )}
                              {row.id && typeof row.id === 'string' && row.id.startsWith('temp_') && (
                                <button
                                  onClick={() => removeRow(index)}
                                  className="inline-flex size-7 items-center justify-center rounded-md border border-border bg-background text-rose-500 transition-all hover:bg-rose-50 hover:text-rose-600"
                                  title="Remove Row"
                                >
                                  <Trash2 className="size-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          {hasComments && (
                            <div className="mb-3 text-xs border-l-2 border-rose-400 bg-rose-50/50 dark:bg-rose-950/20 px-2 py-1 text-rose-600 dark:text-rose-400 rounded-r">
                              <span className="font-semibold block">Head comments:</span>
                              {row.head_comments}
                            </div>
                          )}

                          {/* Office hours */}
                          <div className="mb-3 grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Office In</label>
                              <input type="time" value={row.office_entrance_time}
                                onChange={(e) => handleInputChange(index, 'office_entrance_time', e.target.value)}
                                disabled={locked}
                                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Office Out</label>
                              <input type="time" value={row.office_leave_time}
                                onChange={(e) => handleInputChange(index, 'office_leave_time', e.target.value)}
                                disabled={locked}
                                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed"
                              />
                            </div>
                          </div>

                          {/* Assigned Tasks */}
                          <div className="mb-3 flex flex-col gap-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Assigned Tasks *</label>
                            <textarea value={row.assigned_tasks}
                              onChange={(e) => handleInputChange(index, 'assigned_tasks', e.target.value)}
                              disabled={locked} placeholder="Tasks assigned..." rows={2}
                              className="w-full min-h-[56px] resize-y rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed transition"
                            />
                            {!locked && (
                              <button type="button" onClick={() => correctFieldText(index, 'assigned_tasks')}
                                disabled={correctingKey === `${index}-assigned_tasks`}
                                className="self-end flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 disabled:opacity-50 transition">
                                {correctingKey === `${index}-assigned_tasks` ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                                Fix with AI
                              </button>
                            )}
                          </div>

                          {/* Actual Work Done */}
                          <div className="mb-3 flex flex-col gap-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Actual Work Done *</label>
                            <textarea value={row.actual_work_done}
                              onChange={(e) => handleInputChange(index, 'actual_work_done', e.target.value)}
                              disabled={locked} placeholder="Work accomplished..." rows={2}
                              className="w-full min-h-[56px] resize-y rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed transition"
                            />
                            {!locked && (
                              <button type="button" onClick={() => correctFieldText(index, 'actual_work_done')}
                                disabled={correctingKey === `${index}-actual_work_done`}
                                className="self-end flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 disabled:opacity-50 transition">
                                {correctingKey === `${index}-actual_work_done` ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                                Fix with AI
                              </button>
                            )}
                          </div>

                          {/* Hours / Onsite / Completion / WFG row */}
                          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Hours</label>
                              <input type="number" value={row.hours_worked}
                                onChange={(e) => handleInputChange(index, 'hours_worked', parseFloat(e.target.value) || 0)}
                                disabled={locked} min="0" max="24" step="0.25"
                                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-center text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed transition"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Onsite Hrs</label>
                              <input type="number" value={row.actual_working_hour}
                                onChange={(e) => handleInputChange(index, 'actual_working_hour', parseFloat(e.target.value) || 0)}
                                disabled={locked} min="0" max="24" step="0.25"
                                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-center text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed transition"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                Completion: <span className={getPercentageColor(row.completion_percentage)}>{Math.round(row.completion_percentage * 100)}%</span>
                              </label>
                              <input type="range" min="0" max="1" step="0.05"
                                value={row.completion_percentage}
                                onChange={(e) => handleInputChange(index, 'completion_percentage', parseFloat(e.target.value))}
                                disabled={locked}
                                className={`w-full cursor-pointer h-1.5 rounded-lg bg-secondary focus:outline-none disabled:cursor-not-allowed ${getSliderTrackClass(row.completion_percentage)}`}
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">WFG</label>
                              <div className="flex items-center justify-center h-8">
                                <input type="checkbox" checked={row.done_at_home}
                                  onChange={(e) => handleInputChange(index, 'done_at_home', e.target.checked)}
                                  disabled={locked}
                                  className="size-4 rounded border-border bg-background text-primary focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Remark */}
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Remark</label>
                            <input type="text" value={row.remark}
                              onChange={(e) => handleInputChange(index, 'remark', e.target.value)}
                              disabled={locked} placeholder="Notes..."
                              className="h-8 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed transition"
                            />
                            {!locked && row.remark.trim() && (
                              <button type="button" onClick={() => correctFieldText(index, 'remark')}
                                disabled={correctingKey === `${index}-remark`}
                                className="self-end flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 disabled:opacity-50 transition">
                                {correctingKey === `${index}-remark` ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                                Fix
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* ── Desktop table view (hidden below lg) ── */}
                  <div className="hidden overflow-x-auto lg:block">
                    <Table className="min-w-[1200px]">
                      <TableHeader className="bg-secondary/40 border-b border-border">
                        <TableRow>
                          <TableHead className="w-[180px] font-bold text-foreground">Day / Date</TableHead>
                          <TableHead className="w-[100px] font-bold text-foreground">Office Hours</TableHead>
                          <TableHead className="w-[180px] font-bold text-foreground">Assigned Tasks *</TableHead>
                          <TableHead className="w-[180px] font-bold text-foreground">Actual Work Done *</TableHead>
                          <TableHead className="w-[80px] font-bold text-foreground">Hours</TableHead>
                          <TableHead className="w-[80px] font-bold text-foreground">Onsite</TableHead>
                          <TableHead className="w-[140px] font-bold text-foreground">Completion</TableHead>
                          <TableHead className="w-[80px] text-center font-bold text-foreground">WFG</TableHead>
                          <TableHead className="w-[130px] font-bold text-foreground">Remark</TableHead>
                          <TableHead className="w-[90px] text-center font-bold text-foreground">Status</TableHead>
                          <TableHead className="w-[70px] text-right font-bold text-foreground">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {localRows.map((row, index) => {
                          const locked = isRowLocked(row)
                          const isApproved = row.approval_status === 'Approved'
                          const isReturned = row.approval_status === 'Returned'
                          const formattedDate = new Date(row.log_date)
                          const isWeekend = formattedDate.getDay() === 0 || formattedDate.getDay() === 6
                          const hasComments = row.head_comments && row.head_comments.trim()

                          return (
                          <TableRow
                            key={row.id || `row_${row.log_date}_${index}`}
                            className={`${isWeekend ? 'bg-secondary/15' : ''} ${locked ? 'bg-secondary/10' : ''} ${isApproved ? 'bg-emerald-500/5' : ''} transition-colors border-b border-border/60 align-top`}
                          >
                            {/* Day and Date */}
                            <TableCell className="py-4">
                              <div className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                                {displayDateLabel(formattedDate)}
                                {locked && (
                                  <span
                                    className="inline-flex"
                                    aria-label="Submitted and locked"
                                    title="This log is locked and cannot be edited"
                                  >
                                    <Lock className="size-3 text-muted-foreground shrink-0" />
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {row.log_date}
                              </div>
                              {locked && (
                                <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                  <Lock className="size-2.5" />
                                  Submitted · Read-only
                                </div>
                              )}
                              {hasComments && (
                                <div className="mt-2 text-xs border-l-2 border-rose-400 bg-rose-50/50 dark:bg-rose-950/20 px-2 py-1 text-rose-600 dark:text-rose-400 rounded-r">
                                  <span className="font-semibold block">Head comments:</span>
                                  {row.head_comments}
                                </div>
                              )}
                            </TableCell>

                            {/* Office Hours */}
                            <TableCell className="py-3">
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-1.5">
                                  <Clock className="size-3 text-muted-foreground shrink-0" />
                                  <input
                                    type="time"
                                    value={row.office_entrance_time}
                                    onChange={(e) => handleInputChange(index, 'office_entrance_time', e.target.value)}
                                    disabled={locked}
                                    className="bg-transparent text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary rounded p-0.5 border border-transparent hover:border-border transition disabled:cursor-not-allowed disabled:opacity-60"
                                  />
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Clock className="size-3 text-muted-foreground shrink-0" />
                                  <input
                                    type="time"
                                    value={row.office_leave_time}
                                    onChange={(e) => handleInputChange(index, 'office_leave_time', e.target.value)}
                                    disabled={locked}
                                    className="bg-transparent text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary rounded p-0.5 border border-transparent hover:border-border transition disabled:cursor-not-allowed disabled:opacity-60"
                                  />
                                </div>
                              </div>
                            </TableCell>

                            {/* Assigned Tasks */}
                            <TableCell className="py-3">
                              <div className="flex flex-col gap-1">
                                <textarea
                                  value={row.assigned_tasks}
                                  onChange={(e) => handleInputChange(index, 'assigned_tasks', e.target.value)}
                                  disabled={locked}
                                  placeholder="Tasks assigned (markdown list...)"
                                  rows={2}
                                  className="w-full min-h-[56px] resize-y rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed transition"
                                />
                                {!locked && (
                                  <button
                                    type="button"
                                    onClick={() => correctFieldText(index, 'assigned_tasks')}
                                    disabled={correctingKey === `${index}-assigned_tasks`}
                                    className="self-end flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 disabled:opacity-50 transition"
                                    title="Fix grammar & clarity with Gemini"
                                  >
                                    {correctingKey === `${index}-assigned_tasks` ? (
                                      <Loader2 className="size-3 animate-spin" />
                                    ) : (
                                      <Sparkles className="size-3" />
                                    )}
                                    Fix with AI
                                  </button>
                                )}
                              </div>
                            </TableCell>

                            {/* Actual Work Done */}
                            <TableCell className="py-3">
                              <div className="flex flex-col gap-1">
                                <textarea
                                  value={row.actual_work_done}
                                  onChange={(e) => handleInputChange(index, 'actual_work_done', e.target.value)}
                                  disabled={locked}
                                  placeholder="Work accomplished (markdown list...)"
                                  rows={2}
                                  className="w-full min-h-[56px] resize-y rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed transition"
                                />
                                {!locked && (
                                  <button
                                    type="button"
                                    onClick={() => correctFieldText(index, 'actual_work_done')}
                                    disabled={correctingKey === `${index}-actual_work_done`}
                                    className="self-end flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 disabled:opacity-50 transition"
                                    title="Fix grammar & clarity with Gemini"
                                  >
                                    {correctingKey === `${index}-actual_work_done` ? (
                                      <Loader2 className="size-3 animate-spin" />
                                    ) : (
                                      <Sparkles className="size-3" />
                                    )}
                                    Fix with AI
                                  </button>
                                )}
                              </div>
                            </TableCell>

                            {/* Hours Worked */}
                            <TableCell className="py-3">
                              <input
                                type="number"
                                value={row.hours_worked}
                                onChange={(e) => handleInputChange(index, 'hours_worked', parseFloat(e.target.value) || 0)}
                                disabled={locked}
                                min="0"
                                max="24"
                                step="0.25"
                                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-center text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed transition"
                              />
                            </TableCell>

                            {/* Onsite active hours */}
                            <TableCell className="py-3">
                              <input
                                type="number"
                                value={row.actual_working_hour}
                                onChange={(e) => handleInputChange(index, 'actual_working_hour', parseFloat(e.target.value) || 0)}
                                disabled={locked}
                                min="0"
                                max="24"
                                step="0.25"
                                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-center text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed transition"
                              />
                            </TableCell>

                            {/* Completion Slider */}
                            <TableCell className="py-3">
                              <div className="flex flex-col gap-2">
                                <input
                                  type="range"
                                  min="0"
                                  max="1"
                                  step="0.05"
                                  value={row.completion_percentage}
                                  onChange={(e) => handleInputChange(index, 'completion_percentage', parseFloat(e.target.value))}
                                  disabled={locked}
                                  className={`w-full cursor-pointer h-1.5 rounded-lg bg-secondary focus:outline-none disabled:cursor-not-allowed ${getSliderTrackClass(row.completion_percentage)}`}
                                />
                                <div className="text-right text-[11px]">
                                  <span className={getPercentageColor(row.completion_percentage)}>
                                    {Math.round(row.completion_percentage * 100)}%
                                  </span>
                                </div>
                              </div>
                            </TableCell>

                            {/* Done at Home */}
                            <TableCell className="py-3 text-center">
                              <input
                                type="checkbox"
                                checked={row.done_at_home}
                                onChange={(e) => handleInputChange(index, 'done_at_home', e.target.checked)}
                                disabled={locked}
                                className="size-4 rounded border-border bg-background text-primary focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                              />
                            </TableCell>

                            {/* Remark */}
                            <TableCell className="py-3">
                              <div className="flex flex-col gap-1">
                                <input
                                  type="text"
                                  value={row.remark}
                                  onChange={(e) => handleInputChange(index, 'remark', e.target.value)}
                                  disabled={locked}
                                  placeholder="Notes..."
                                  className="h-8 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed transition"
                                />
                                {!locked && row.remark.trim() && (
                                  <button
                                    type="button"
                                    onClick={() => correctFieldText(index, 'remark')}
                                    disabled={correctingKey === `${index}-remark`}
                                    className="self-end flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 disabled:opacity-50 transition"
                                    title="Fix grammar & clarity with Gemini"
                                  >
                                    {correctingKey === `${index}-remark` ? (
                                      <Loader2 className="size-3 animate-spin" />
                                    ) : (
                                      <Sparkles className="size-3" />
                                    )}
                                    Fix
                                  </button>
                                )}
                              </div>
                            </TableCell>

                            {/* Approval Status */}
                            <TableCell className="py-3 text-center">
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                                  isApproved
                                    ? 'bg-emerald-500/10 text-emerald-600'
                                    : isReturned
                                      ? 'bg-rose-500/10 text-rose-600'
                                      : 'bg-amber-500/10 text-amber-600'
                                }`}
                              >
                                {row.approval_status}
                              </span>
                            </TableCell>

                            {/* Action Block */}
                            <TableCell className="py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Split task only allowed on unlocked (new) rows */}
                                {!locked && (
                                  <button
                                    onClick={() => addSplitTaskRow(row.log_date)}
                                    className="inline-flex size-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
                                    title="Add Split Task Row"
                                  >
                                    <Plus className="size-4" />
                                  </button>
                                )}
                                {/* Trash only visible for unsaved temp rows */}
                                {row.id && typeof row.id === 'string' && row.id.startsWith('temp_') ? (
                                  <button
                                    onClick={() => removeRow(index)}
                                    className="inline-flex size-7 items-center justify-center rounded-md border border-border bg-background text-rose-500 transition-all hover:bg-rose-50 hover:text-rose-600"
                                    title="Remove Row"
                                  >
                                    <Trash2 className="size-4" />
                                  </button>
                                ) : locked ? (
                                  /* Lock icon signals immutability visually */
                                  <div
                                    className="inline-flex size-7 items-center justify-center rounded-md border border-border bg-secondary/40 text-muted-foreground"
                                    title="Submitted and locked — cannot be modified"
                                    aria-label="Locked"
                                  >
                                    <Lock className="size-3.5" />
                                  </div>
                                ) : (
                                  <div className="w-7 h-7" />
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ── SETTINGS TAB ── */}
      {activeTab === 'settings' && (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight text-foreground">
              Account settings
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your password security settings. Logged in as <strong>{userEmail}</strong>.
            </p>
          </div>

          <ChangePasswordCard userEmail={userEmail} />
        </div>
      )}
    </div>
  )
}
