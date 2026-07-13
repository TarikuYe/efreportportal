'use client'

import React, { useState } from 'react'
import useSWR from 'swr'
import { SiteHeader } from '@/components/site-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import {
  Mail,
  Download,
  AlertTriangle,
  Clock,
  Briefcase,
  FileText,
  Percent,
  RefreshCw,
  Loader2,
  TrendingUp,
  Sparkles,
  Inbox,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Eye,
  X
} from 'lucide-react'


const fetcher = async (url: string) => {
  const res = await fetch(url)
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error ?? `Request failed (${res.status})`)
  return json
}

export default function DGMAnalyticsPage() {
  const { data, isLoading, mutate, error } = useSWR('/api/analytics', fetcher, {
    refreshInterval: 10000 // refresh every 10 seconds for real-time streaming
  })

  // SWR query for all pending or under review daily logs
  const { data: pendingLogsData, mutate: mutatePendingLogs } = useSWR('/api/daily-work-logs?pending=true', fetcher)
  const pendingLogs = pendingLogsData?.logs ?? []

  const metrics = data?.metrics ?? {
    totalLetters: 0,
    overdueLetters: 0,
    activeBonds: 0,
    expiredOrReleasedBonds: 0,
    commitmentAverage: 0,
    unverifiedLogsCount: 0
  }

  const alerts = data?.alerts ?? {
    criticalExpiredBonds: [],
    nearlyExpiredEots: []
  }

  const [downloading, setDownloading] = useState(false)
  const [commentingLogId, setCommentingLogId] = useState<string | number | null>(null)
  const [commentText, setCommentText] = useState('')
  const [selectedEmployeeEmail, setSelectedEmployeeEmail] = useState<string | null>(null)

  // Email alert modal states
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [emailType, setEmailType] = useState<'bond' | 'eot' | null>(null)
  const [emailItem, setEmailItem] = useState<any>(null)
  const [emailRecipient, setEmailRecipient] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailMessage, setEmailMessage] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)

  const openEmailModal = (type: 'bond' | 'eot', item: any) => {
    const defaultRecipient = 'team@efae.com'
    const recipient = item.assigned_manager_email || defaultRecipient
    
    setEmailType(type)
    setEmailItem(item)
    setEmailRecipient(recipient)
    
    if (type === 'bond') {
      setEmailSubject(`ALERT: Expired Bond on Project "${item.project_name}"`)
      setEmailMessage(`Dear Project Management Team,\n\nThis is an automated notification regarding the following expired contract bond:\n- Project Description: ${item.project_name}\n- Contractor Name: ${item.contractor_name}\n- Bond Type: ${item.bond_type}\n- Expiry Date: ${item.expiry_date}\n- Amount: ${item.amount ? Number(item.amount).toLocaleString() + ' ETB' : 'Not specified'}\n\nStatus Calculation:\nDue Date of ${item.expiry_date} has passed. This bond is currently ${item.days_overdue || 0} days OVERDUE.\n\nImmediate action is required to ensure contract security or process bond release.`)
    } else {
      setEmailSubject(`ATTENTION: Nearly Expired Timeline on Project "${item.project_name}"`)
      setEmailMessage(`Dear Project Supervision Team,\n\nPlease review the revised contract timeline details:\n- Project Description: ${item.project_name}\n- Contractor Name: ${item.contractor_name}\n- Revised Completion Date: ${item.revised_completion_date} (EOT Approved)\n- Days Approved: ${item.days_approved} days\n- EOT Number: Claim #${item.eot_number}\n\nStatus Calculation:\nOnly ${item.days_remaining || 0} days remaining until deadline.\n\nPlease verify the contractor's on-site execution speed and execute necessary supervision actions.`)
    }
    
    setEmailModalOpen(true)
  }

  const handleSendEmailAlert = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!emailRecipient.trim() || !emailSubject.trim() || !emailMessage.trim()) {
      toast.error('All fields are required.')
      return
    }

    setSendingEmail(true)
    try {
      const res = await fetch('/api/alerts/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: emailType,
          recipient: emailRecipient,
          subject: emailSubject,
          message: emailMessage,
          item: emailItem
        })
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send email alert')
      
      toast.success('Email alert sent successfully')
      setEmailModalOpen(false)
    } catch (err: any) {
      toast.error('Failed to send email alert', {
        description: err.message || 'Please try again.'
      })
    } finally {
      setSendingEmail(false)
    }
  }

  const handleApprove = async (log: any) => {
    // Optimistic SWR mutation
    const updatedLogs = pendingLogs.filter((l: any) => l.id !== log.id)
    mutatePendingLogs({ logs: updatedLogs }, false)
    
    // Also mutate the main analytics endpoint to reduce count
    mutate((prev: any) => {
      if (!prev) return prev
      return {
        ...prev,
        metrics: {
          ...prev.metrics,
          unverifiedLogsCount: Math.max(0, (prev.metrics.unverifiedLogsCount ?? 0) - 1)
        }
      }
    }, false)

    try {
      const res = await fetch('/api/daily-work-logs/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviews: [{
            log_id: log.id,
            approval_status: 'Approved'
          }]
        })
      })
      if (!res.ok) throw new Error()
      toast.success('Log Approved & Locked')
      mutatePendingLogs()
      mutate() // re-fetch metrics
    } catch (err) {
      toast.error('Failed to approve log')
      mutatePendingLogs()
      mutate()
    }
  }

  const handleReturn = async (log: any, comments: string) => {
    if (!comments.trim()) {
      toast.error('Comments are required to return a log')
      return
    }

    // Optimistic SWR mutation
    const updatedLogs = pendingLogs.filter((l: any) => l.id !== log.id)
    mutatePendingLogs({ logs: updatedLogs }, false)

    mutate((prev: any) => {
      if (!prev) return prev
      return {
        ...prev,
        metrics: {
          ...prev.metrics,
          unverifiedLogsCount: Math.max(0, (prev.metrics.unverifiedLogsCount ?? 0) - 1)
        }
      }
    }, false)

    try {
      const res = await fetch('/api/daily-work-logs/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviews: [{
            log_id: log.id,
            approval_status: 'Returned',
            head_comments: comments
          }]
        })
      })
      if (!res.ok) throw new Error()
      toast.success('Log returned to engineer')
      setCommentingLogId(null)
      setCommentText('')
      mutatePendingLogs()
      mutate()
    } catch (err) {
      toast.error('Failed to return log')
      mutatePendingLogs()
      mutate()
    }
  }

  const handleExport = async () => {
    setDownloading(true)
    try {
      window.location.href = '/api/export-master'
    } catch (err) {
      console.error(err)
    } finally {
      setTimeout(() => setDownloading(false), 2000)
    }
  }

  // pre-populates email links
  const getMailtoLink = (type: 'bond' | 'eot', item: any) => {
    const defaultRecipient = 'team@efae.com'
    const recipient = item.assigned_manager_email || defaultRecipient
    let subject = ''
    let body = ''

    if (type === 'bond') {
      const overdueDays = item.days_overdue || 0
      subject = `ALERT: Expired Bond on Project "${item.project_name}"`
      body = `Dear Project Management Team,

This is an automated notification regarding the following expired contract bond:
- Project Description: ${item.project_name}
- Contractor Name: ${item.contractor_name}
- Bond Type: ${item.bond_type}
- Expiry Date: ${item.expiry_date}
- Amount: ${item.amount ? Number(item.amount).toLocaleString() + ' ETB' : 'Not specified'}

Status Calculation:
Due Date of ${item.expiry_date} has passed. This bond is currently ${overdueDays} days OVERDUE.

Immediate action is required to ensure contract security or process bond release.

Best regards,
DGM Office — EF Architects and Engineers Consulting PLC`
    } else {
      const daysRemaining = item.days_remaining || 0
      subject = `ATTENTION: Nearly Expired Timeline on Project "${item.project_name}"`
      body = `Dear Project Supervision Team,

Please review the revised contract timeline details:
- Project Description: ${item.project_name}
- Contractor Name: ${item.contractor_name}
- Revised Completion Date: ${item.revised_completion_date} (EOT Approved)
- Days Approved: ${item.days_approved} days
- EOT Number: Claim #${item.eot_number}

Status Calculation:
Only ${daysRemaining} days remaining until deadline.

Please verify the contractor's on-site execution speed and execute necessary supervision actions.

Best regards,
DGM Office — EF Architects and Engineers Consulting PLC`
    }

    return `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-secondary/30 to-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        
        {/* Header Block */}
        <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-border/60 bg-background/80 p-5 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-center gap-3.5">
            <div className="relative flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-md">
              <TrendingUp className="size-6 text-accent" />
              <span className="absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-background">
                <span className="size-1.5 rounded-full bg-white" />
              </span>
            </div>
            <div>
              <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                DGM Control Tower
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Executive overview of live engineering trackers, timelines, and operational risks.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => { mutate(); mutatePendingLogs(); }}
              disabled={isLoading}
              className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground shadow-sm transition-all hover:border-primary/30 hover:bg-secondary hover:text-foreground"
              title="Refresh data"
            >
              {isLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
            </button>
            <div className="flex flex-col items-end">
              <Button
                onClick={handleExport}
                disabled={downloading}
                className="flex h-9 items-center gap-2 px-4 font-bold shadow-sm"
              >
                {downloading ? (
                  <><Loader2 className="size-4 animate-spin" /> Exporting...</>
                ) : (
                  <><Download className="size-4" /><span className="hidden sm:inline">Export Master Log</span><span className="sm:hidden">Export</span></>
                )}
              </Button>
              {metrics.unverifiedLogsCount > 0 && (
                <span className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-rose-500">
                  <AlertTriangle className="size-3 text-rose-500" />
                  {metrics.unverifiedLogsCount} unverified records will be omitted
                </span>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive shadow-sm">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <div>
              <span className="block font-semibold">Failed to load analytics:</span>
              {error.message || 'Please check your connection and configuration.'}
            </div>
          </div>
        )}

        {/* ── CORE ANALYTICS BANNER ── */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          
          {/* Letters Widget */}
          <Card className="group relative overflow-hidden border-border/60 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 to-blue-400" />
            <div className="absolute right-0 top-0 size-32 -translate-y-1/3 translate-x-1/3 rounded-full bg-blue-500/5 blur-2xl transition-all group-hover:bg-blue-500/10" />
            <CardContent className="flex items-center justify-between p-6">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Correspondence Mailbox</span>
                <span className="mt-1 font-display text-4xl font-extrabold text-foreground">
                  {metrics.totalLetters}
                </span>
                <span className="mt-1 text-xs text-muted-foreground">
                  <strong className="font-semibold text-rose-500">{metrics.overdueLetters}</strong> Overdue Actions
                </span>
              </div>
              <span className="flex size-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 shadow-sm ring-1 ring-blue-500/10">
                <FileText className="size-6" />
              </span>
            </CardContent>
          </Card>

          {/* Bonds Widget */}
          <Card className="group relative overflow-hidden border-border/60 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 to-emerald-400" />
            <div className="absolute right-0 top-0 size-32 -translate-y-1/3 translate-x-1/3 rounded-full bg-emerald-500/5 blur-2xl transition-all group-hover:bg-emerald-500/10" />
            <CardContent className="flex items-center justify-between p-6">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Guarantee Bonds</span>
                <span className="mt-1 font-display text-4xl font-extrabold text-foreground">
                  {metrics.activeBonds}
                </span>
                <span className="mt-1 text-xs text-muted-foreground">
                  <strong className="font-semibold text-foreground">{metrics.expiredOrReleasedBonds}</strong> Released/Expired
                </span>
              </div>
              <span className="flex size-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 shadow-sm ring-1 ring-emerald-500/10">
                <Briefcase className="size-6" />
              </span>
            </CardContent>
          </Card>

          {/* Commitment Widget */}
          <Card className="group relative overflow-hidden border-border/60 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-purple-500 to-purple-400" />
            <div className="absolute right-0 top-0 size-32 -translate-y-1/3 translate-x-1/3 rounded-full bg-purple-500/5 blur-2xl transition-all group-hover:bg-purple-500/10" />
            <CardContent className="flex items-center justify-between p-6">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Engineer Commitment</span>
                <span className="mt-1 font-display text-4xl font-extrabold text-foreground">
                  {metrics.commitmentAverage}%
                </span>
                <span className="mt-1 text-xs text-muted-foreground">
                  Average completion rate
                </span>
              </div>
              <span className="flex size-12 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 shadow-sm ring-1 ring-purple-500/10">
                <Percent className="size-6" />
              </span>
            </CardContent>
          </Card>

        </div>

        {/* ── PENDING STRUCTURAL AUDIT QUEUE ── */}
        <Card className="mb-8 overflow-hidden border-border/60 shadow-sm">
          <CardHeader className="flex flex-col gap-3 border-b border-border bg-gradient-to-r from-slate-500/5 to-transparent px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ShieldCheck className="size-5" />
              </span>
              <div>
                <CardTitle className="font-display text-base font-bold text-foreground">
                  Pending Structural Audit Queue
                </CardTitle>
                <CardDescription className="mt-0.5 text-xs text-muted-foreground">
                  Review, verify, and approve daily work logs before they are committed to the Master Excel Log.
                </CardDescription>
              </div>
            </div>
            <span className="shrink-0 self-start rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary sm:self-auto">
              {(pendingLogs || []).length} logs pending
            </span>
          </CardHeader>
          <CardContent className="p-0">
            {(!pendingLogs || pendingLogs.length === 0) ? (
              <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
                <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-secondary/60">
                  <Inbox className="size-6" />
                </span>
                <p className="text-sm font-medium">Audit queue is empty. All employee logs are reviewed.</p>
              </div>
            ) : (() => {
              // Group pending logs by employee email
              const grouped = (pendingLogs || []).reduce((acc: Record<string, { employee: any; logs: any[] }>, log: any) => {
                const email = log.employees?.email || 'no-email@efae.com'
                if (!acc[email]) {
                  acc[email] = {
                    employee: log.employees ?? { full_name: 'Anonymous', email, department: 'General Staff' },
                    logs: []
                  }
                }
                acc[email].logs.push(log)
                return acc
              }, {})

              const employeeGroups = Object.values(grouped)

              return (
                <div className="divide-y divide-border">
                  {employeeGroups.map(({ employee, logs }: any) => {
                    const initials = employee.full_name
                      ? employee.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2)
                      : '??'
                    
                    const totalHours = logs.reduce((sum: number, log: any) => sum + (Number(log.hours_worked) || 0), 0)

                    return (
                      <div key={employee.email} className="flex flex-col justify-between gap-4 p-4 transition-all hover:bg-secondary/10 sm:p-5 md:flex-row md:items-center">
                        {/* Employee and Info card in a single horizontal layout */}
                        <div className="flex flex-1 flex-col items-start gap-4 sm:flex-row sm:items-center">
                          {/* Employee Avatar Badge and Profile */}
                          <div className="flex shrink-0 items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-primary/5 text-sm font-bold text-primary ring-2 ring-primary/10 sm:size-11">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold leading-snug text-foreground sm:text-base">{employee.full_name || 'Anonymous'}</div>
                              <div className="truncate text-xs text-muted-foreground">{employee.email || 'no-email@efae.com'}</div>
                              <div className="mt-1 inline-block rounded-md border border-primary/10 bg-primary/5 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary/80">
                                {employee.department || 'Procurement & Contract'}
                              </div>
                            </div>
                          </div>

                          {/* Divider */}
                          <div className="hidden h-12 w-px shrink-0 bg-border sm:block" />

                          {/* Summary Chips */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300">
                              {logs.length} {logs.length === 1 ? 'log' : 'logs'} pending
                            </span>
                            <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                              {totalHours} hrs total
                            </span>
                          </div>
                        </div>

                        {/* View Details Button */}
                        <div className="flex shrink-0 items-center">
                          <Button
                            size="sm"
                            onClick={() => setSelectedEmployeeEmail(employee.email)}
                            className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/95 sm:w-auto"
                          >
                            <Eye className="size-4" /> View Details
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </CardContent>
        </Card>


        {/* inline dialog / text modal for Return to Sender comments */}
        {commentingLogId !== null && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm animate-in fade-in duration-200 sm:items-center sm:p-4">
            <Card className="w-full max-w-md overflow-hidden rounded-t-2xl border-border/60 shadow-xl sm:rounded-2xl">

              <CardHeader className="border-b border-border bg-gradient-to-r from-rose-50 to-transparent dark:from-rose-950/20">
                <CardTitle className="flex items-center gap-2 font-display text-base font-bold text-rose-800 dark:text-rose-300">
                  <span className="flex size-8 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-950/50">
                    <XCircle className="size-4.5 text-rose-600" />
                  </span>
                  Return Work Log to Sender
                </CardTitle>
                <CardDescription className="text-xs">
                  Specify feedback for the engineer to correct their log details.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="comments" className="text-xs font-bold text-foreground">DGM Feedback Comments *</Label>
                  <textarea
                    id="comments"
                    rows={4}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Enter instructions on what to fix (e.g. Specify project tasks completed, correct working hours value...)"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    required
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCommentingLogId(null)
                      setCommentText('')
                    }}
                    className="h-9 px-4 text-xs font-medium"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      const log = pendingLogs.find((l: any) => l.id === commentingLogId)
                      if (log) handleReturn(log, commentText)
                    }}
                    className="h-9 bg-rose-600 px-4 text-xs font-bold text-white shadow-sm hover:bg-rose-700"
                  >
                    Submit Feedback
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* detail sheet modal for the selected employee */}
        {selectedEmployeeEmail !== null && (() => {
          const group = (pendingLogs || []).reduce((acc: any, log: any) => {
            const email = log.employees?.email || 'no-email@efae.com'
            if (email === selectedEmployeeEmail) {
              if (!acc.employee) {
                acc.employee = log.employees ?? { full_name: 'Anonymous', email, department: 'General Staff' }
              }
              acc.logs.push(log)
            }
            return acc
          }, { employee: null, logs: [] })

          const { employee, logs } = group

          // If the employee logs list becomes empty, close the sheet
          if (!employee || logs.length === 0) {
            // Defer update to avoid rendering-phase state update warning
            setTimeout(() => {
              if (selectedEmployeeEmail !== null) setSelectedEmployeeEmail(null)
            }, 0)
            return null
          }

          const initials = employee.full_name
            ? employee.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2)
            : '??'

          return (
            <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
              {/* Clicking the backdrop will close the sheet */}
              <div className="absolute inset-0 -z-10" onClick={() => setSelectedEmployeeEmail(null)} />
              
              <div className="relative flex h-full w-full flex-col border-l border-border bg-background shadow-2xl animate-in slide-in-from-right duration-300 sm:max-w-4xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-slate-500/5 to-transparent p-4 sm:p-6">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-primary/5 text-sm font-bold text-primary ring-2 ring-primary/10 sm:size-12">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <h3 className="flex flex-wrap items-center gap-2 font-display text-base font-extrabold text-foreground sm:text-lg">
                        <span className="truncate">{employee.full_name || 'Anonymous'}</span>
                        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                          {logs.length} pending
                        </span>
                      </h3>
                      <p className="truncate text-xs text-muted-foreground">{employee.email || 'no-email@efae.com'} &middot; {employee.department || 'General Staff'}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedEmployeeEmail(null)}
                    className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                  >
                    <X className="size-5" />
                  </Button>
                </div>

                {/* Logs List */}
                <div className="flex-1 space-y-6 overflow-y-auto p-6">
                  {logs.map((log: any) => (
                    <Card key={log.id} className="overflow-hidden border border-border/80 shadow-sm transition-all hover:border-border">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-slate-500/5 px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center rounded bg-blue-100 px-2 py-0.5 text-[10px] font-extrabold uppercase text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                            {log.project_code || 'General'}
                          </span>
                          <span className="text-xs font-semibold text-foreground">
                            {new Date(log.log_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                        <span className={`rounded px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                          log.approval_status === 'Returned'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            : log.approval_status === 'Approved'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}>
                          {log.approval_status ?? 'Pending'}
                        </span>
                      </div>

                      <CardContent className="space-y-4 p-4">
                        {/* Tasks Details */}
                        <div className="grid grid-cols-1 gap-4 text-xs md:grid-cols-2">
                          <div className="rounded-lg border border-border/30 bg-secondary/10 p-3">
                            <span className="mb-1 block text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground">Assigned Tasks</span>
                            <p className="whitespace-pre-wrap leading-relaxed text-foreground">{log.assigned_tasks}</p>
                          </div>
                          <div className="rounded-lg border border-border/30 bg-secondary/10 p-3">
                            <span className="mb-1 block text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground">Actual Work Done</span>
                            <p className="whitespace-pre-wrap leading-relaxed text-foreground">{log.actual_work_done}</p>
                          </div>
                        </div>

                        {/* Metrics and Actions Bar */}
                        <div className="flex flex-col items-stretch justify-between gap-4 border-t border-border/40 pt-2 sm:flex-row sm:items-center">
                          {/* Metrics */}
                          <div className="flex flex-wrap gap-2">
                            <div className="flex items-center gap-1.5 rounded border border-border/50 bg-secondary/30 px-2 py-1 text-xs">
                              <span className="text-muted-foreground">Worked:</span>
                              <strong className="font-semibold text-foreground">{log.hours_worked} hrs</strong>
                            </div>
                            <div className="flex items-center gap-1.5 rounded border border-border/50 bg-secondary/30 px-2 py-1 text-xs">
                              <span className="text-muted-foreground">Onsite:</span>
                              <strong className="font-semibold text-foreground">{log.actual_working_hour} hrs</strong>
                            </div>
                            <div className="flex items-center gap-1.5 rounded border border-border/50 bg-secondary/30 px-2 py-1 text-xs">
                              <span className="text-muted-foreground">Comp:</span>
                              <strong className="font-semibold text-foreground">{Math.round(log.completion_percentage * 100)}%</strong>
                            </div>
                            {log.done_at_home && (
                              <span className="rounded border border-purple-100 bg-purple-50 px-1.5 py-1 text-[10px] font-semibold text-purple-600 dark:border-purple-900/20 dark:bg-purple-950/30">Home Entry</span>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 self-end sm:self-center">
                            <Button
                              size="sm"
                              onClick={() => handleApprove(log)}
                              className="flex h-8 items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
                            >
                              <CheckCircle2 className="size-3.5" /> Approve & Lock
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setCommentingLogId(log.id)
                                setCommentText(log.head_comments || '')
                              }}
                              className="flex h-8 items-center gap-1.5 rounded-md border-rose-200 px-3 text-xs font-bold text-rose-500 hover:bg-rose-50 hover:text-rose-600"
                            >
                              <XCircle className="size-3.5" /> Return to Sender
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )
        })()}


        {/* ── HIGH-PRIORITY ALERT INBOX ── */}
        <div className="grid gap-6 lg:grid-cols-2">
          
          {/* Critical Bond Expiry (Red Alerts) */}
          <Card className="overflow-hidden border-border/60 shadow-sm">
            <CardHeader className="flex flex-row items-center gap-3 border-b border-border bg-gradient-to-r from-rose-500/5 to-transparent px-6 py-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500">
                <AlertTriangle className="size-5" />
              </span>
              <div>
                <CardTitle className="font-display text-base font-bold text-rose-800 dark:text-rose-300">
                  Critical Bond Expired Alerts
                </CardTitle>
                <CardDescription className="text-xs text-rose-600/80 dark:text-rose-400/70">
                  Active current date exceeds bond expiry limits
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="max-h-[380px] overflow-y-auto p-0">
              {(!alerts?.criticalExpiredBonds || alerts.criticalExpiredBonds.length === 0) ? (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
                  <span className="flex size-12 items-center justify-center rounded-full bg-secondary/60">
                    <Inbox className="size-6" />
                  </span>
                  <p className="text-xs font-semibold">All logged bonds are safe.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {alerts.criticalExpiredBonds.map((bond: any) => (
                    <div key={bond.id} className="flex items-start justify-between gap-4 p-4 transition-all hover:bg-rose-500/5">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="inline-block rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-rose-800">
                            {bond.bond_type}
                          </span>
                          <span className="max-w-[200px] truncate text-xs font-bold text-foreground">
                            {bond.project_name}
                          </span>
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          Contractor: <strong className="text-foreground">{bond.contractor_name}</strong> &middot; Employer: {bond.employer_name}
                        </div>
                        <div className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-rose-600">
                          <Clock className="size-3" />
                          Due {new Date(bond.expiry_date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}: {bond.days_overdue} days OVERDUE
                        </div>
                      </div>
                      <button
                        onClick={() => openEmailModal('bond', bond)}
                        className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-rose-500 shadow-sm transition-all hover:bg-rose-50 hover:text-rose-600"
                        title="Send Overdue Notification Email"
                      >
                        <Mail className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Nearly Expired Contract Time (Yellow Alerts) */}
          <Card className="overflow-hidden border-border/60 shadow-sm">
            <CardHeader className="flex flex-row items-center gap-3 border-b border-border bg-gradient-to-r from-amber-500/5 to-transparent px-6 py-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                <Clock className="size-5" />
              </span>
              <div>
                <CardTitle className="font-display text-base font-bold text-amber-800 dark:text-amber-300">
                  Nearly Expired Contract Timeline
                </CardTitle>
                <CardDescription className="text-xs text-amber-600/80 dark:text-amber-400/70">
                  Approved EOT extensions expiring within 30 days
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="max-h-[380px] overflow-y-auto p-0">
              {(!alerts?.nearlyExpiredEots || alerts.nearlyExpiredEots.length === 0) ? (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
                  <span className="flex size-12 items-center justify-center rounded-full bg-secondary/60">
                    <Inbox className="size-6" />
                  </span>
                  <p className="text-xs font-semibold">No critical timelines expiring soon.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {alerts.nearlyExpiredEots.map((eot: any) => (
                    <div key={eot.id} className="flex items-start justify-between gap-4 p-4 transition-all hover:bg-amber-500/5">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-800">
                            Claim #{eot.eot_number}
                          </span>
                          <span className="max-w-[200px] truncate text-xs font-bold text-foreground">
                            {eot.project_name}
                          </span>
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          Contractor: <strong className="text-foreground">{eot.contractor_name}</strong> &middot; Approved: {eot.days_approved} days
                        </div>
                        <div className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-amber-600">
                          <AlertTriangle className="size-3" />
                          Expiring on {new Date(eot.revised_completion_date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}: {eot.days_remaining} days left
                        </div>
                      </div>
                      <button
                        onClick={() => openEmailModal('eot', eot)}
                        className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-amber-600 shadow-sm transition-all hover:bg-amber-50 hover:text-amber-700"
                        title="Send Expiry Alert Email"
                      >
                        <Mail className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        {/* Email Alert Preview/Edit Modal */}
        {emailModalOpen && emailType && emailItem && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm animate-in fade-in duration-200 sm:items-center sm:p-4">
            <Card className="w-full max-w-2xl overflow-hidden rounded-t-2xl border-border/60 shadow-xl sm:rounded-2xl">
              <CardHeader className={`border-b border-border ${emailType === 'bond' ? 'bg-gradient-to-r from-rose-500/5 to-transparent' : 'bg-gradient-to-r from-amber-500/5 to-transparent'}`}>
                <CardTitle className={`flex items-center gap-2 font-display text-base font-bold ${emailType === 'bond' ? 'text-rose-800 dark:text-rose-300' : 'text-amber-800 dark:text-amber-300'}`}>
                  <span className={`flex size-8 items-center justify-center rounded-full ${emailType === 'bond' ? 'bg-rose-100 dark:bg-rose-950/50' : 'bg-amber-100 dark:bg-amber-950/50'}`}>
                    <Mail className={`size-4.5 ${emailType === 'bond' ? 'text-rose-600' : 'text-amber-600'}`} />
                  </span>
                  Review &amp; Edit Notification Email
                </CardTitle>
                <CardDescription className="text-xs">
                  Review the recipient and add DGM office custom comments or modify the email body below.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <form onSubmit={handleSendEmailAlert} className="space-y-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="email-recipient" className="text-xs font-bold text-foreground">Recipient Email *</Label>
                    <Input
                      id="email-recipient"
                      type="email"
                      value={emailRecipient}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmailRecipient(e.target.value)}
                      placeholder="manager@efae.com"
                      required
                    />
                  </div>
                  
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="email-subject" className="text-xs font-bold text-foreground">Subject *</Label>
                    <Input
                      id="email-subject"
                      value={emailSubject}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmailSubject(e.target.value)}
                      placeholder="ALERT: Expired Bond"
                      required
                    />
                  </div>
                  
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="email-message" className="text-xs font-bold text-foreground">Email Message Body *</Label>
                    <textarea
                      id="email-message"
                      rows={12}
                      value={emailMessage}
                      onChange={(e) => setEmailMessage(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs leading-relaxed shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      required
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 border-t border-border pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEmailModalOpen(false)}
                      disabled={sendingEmail}
                      className="h-9 px-4 text-xs font-medium"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={sendingEmail}
                      className={`flex h-9 items-center gap-1.5 px-4 text-xs font-bold shadow-sm ${
                        emailType === 'bond' 
                          ? 'bg-rose-600 text-white hover:bg-rose-700' 
                          : 'bg-amber-600 text-white hover:bg-amber-700'
                      }`}
                    >
                      {sendingEmail ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Mail className="size-3.5" />
                          Send Notification
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

      </main>
    </div>
  )
}