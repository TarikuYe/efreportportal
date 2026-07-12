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
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        
        {/* Header Block */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <TrendingUp className="size-6 text-accent" />
            </div>
            <div>
              <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
                DGM Control Tower
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Executive overview of live engineering trackers, timelines, and operational risks.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { mutate(); mutatePendingLogs(); }}
              disabled={isLoading}
              className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
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
                className="font-bold flex items-center gap-2 h-9 px-4"
              >
                {downloading ? (
                  <><Loader2 className="size-4 animate-spin" /> Exporting...</>
                ) : (
                  <><Download className="size-4" /> Export Master Log</>
                )}
              </Button>
              {metrics.unverifiedLogsCount > 0 && (
                <span className="text-[11px] font-semibold text-rose-500 flex items-center gap-1 mt-1">
                  <AlertTriangle className="size-3 text-rose-500" />
                  Warning: {metrics.unverifiedLogsCount} unverified records will be omitted from the Master Log
                </span>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="size-4 mt-0.5 shrink-0" />
            <div>
              <span className="font-semibold block">Failed to load analytics:</span>
              {error.message || 'Please check your connection and configuration.'}
            </div>
          </div>
        )}

        {/* ── CORE ANALYTICS BANNER ── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
          
          {/* Letters Widget */}
          <Card className="shadow-sm border-border relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-1/3 -translate-y-1/3 size-28 rounded-full bg-blue-500/5 blur-xl" />
            <CardContent className="flex items-center justify-between p-6">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Correspondence Mailbox</span>
                <span className="font-display text-4xl font-extrabold text-foreground mt-1">
                  {metrics.totalLetters}
                </span>
                <span className="text-xs text-muted-foreground mt-1">
                  <strong className="text-rose-500 font-semibold">{metrics.overdueLetters}</strong> Overdue Actions
                </span>
              </div>
              <span className="flex size-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
                <FileText className="size-6" />
              </span>
            </CardContent>
          </Card>

          {/* Bonds Widget */}
          <Card className="shadow-sm border-border relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-1/3 -translate-y-1/3 size-28 rounded-full bg-emerald-500/5 blur-xl" />
            <CardContent className="flex items-center justify-between p-6">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Guarantee Bonds</span>
                <span className="font-display text-4xl font-extrabold text-foreground mt-1">
                  {metrics.activeBonds}
                </span>
                <span className="text-xs text-muted-foreground mt-1">
                  <strong className="text-foreground font-semibold">{metrics.expiredOrReleasedBonds}</strong> Released/Expired
                </span>
              </div>
              <span className="flex size-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <Briefcase className="size-6" />
              </span>
            </CardContent>
          </Card>

          {/* Commitment Widget */}
          <Card className="shadow-sm border-border relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-1/3 -translate-y-1/3 size-28 rounded-full bg-purple-500/5 blur-xl" />
            <CardContent className="flex items-center justify-between p-6">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Engineer Commitment</span>
                <span className="font-display text-4xl font-extrabold text-foreground mt-1">
                  {metrics.commitmentAverage}%
                </span>
                <span className="text-xs text-muted-foreground mt-1">
                  Average completion rate
                </span>
              </div>
              <span className="flex size-12 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600">
                <Percent className="size-6" />
              </span>
            </CardContent>
          </Card>

        </div>

        {/* ── PENDING STRUCTURAL AUDIT QUEUE ── */}
        <Card className="shadow-sm border-border mb-8">
          <CardHeader className="border-b border-border bg-slate-500/5 py-4 px-6 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-display text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <ShieldCheck className="size-5 text-primary" />
                PENDING STRUCTURAL AUDIT QUEUE
              </CardTitle>
              <CardDescription className="text-slate-600/80 dark:text-slate-400 text-xs mt-0.5">
                Review, verify, and approve daily work logs before they are committed to the Master Excel Log.
              </CardDescription>
            </div>
            <span className="bg-primary/10 text-primary text-xs font-bold px-2.5 py-1 rounded-full">
              {(pendingLogs || []).length} logs pending
            </span>
          </CardHeader>
          <CardContent className="p-0">
            {(!pendingLogs || pendingLogs.length === 0) ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Inbox className="size-8 mb-2" />
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
                      <div key={employee.email} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-secondary/5 transition-all">
                        {/* Employee and Info card in a single horizontal layout */}
                        <div className="flex-1 flex flex-col sm:flex-row gap-6 items-start sm:items-center">
                          {/* Employee Avatar Badge and Profile */}
                          <div className="flex items-center gap-4 shrink-0">
                            <div className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm border border-primary/20">
                              {initials}
                            </div>
                            <div>
                              <div className="font-semibold text-base text-foreground leading-snug">{employee.full_name || 'Anonymous'}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">{employee.email || 'no-email@efae.com'}</div>
                              <div className="text-[10px] text-primary/80 font-bold uppercase tracking-wider mt-1 px-1.5 py-0.5 bg-primary/5 border border-primary/10 rounded-md inline-block">
                                {employee.department || 'Procurement & Contract'}
                              </div>
                            </div>
                          </div>

                          {/* Divider */}
                          <div className="hidden sm:block h-12 w-px bg-border shrink-0" />

                          {/* Summary Chips */}
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold px-3 py-1.5 rounded-full border border-indigo-100 dark:border-indigo-900/50">
                              {logs.length} {logs.length === 1 ? 'log' : 'logs'} pending
                            </span>
                            <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold px-3 py-1.5 rounded-full border border-emerald-100 dark:border-emerald-900/50">
                              {totalHours} hrs total
                            </span>
                          </div>
                        </div>

                        {/* View Details Button */}
                        <div className="shrink-0 flex items-center justify-end">
                          <Button
                            size="sm"
                            onClick={() => setSelectedEmployeeEmail(employee.email)}
                            className="bg-primary hover:bg-primary/95 text-primary-foreground font-semibold flex items-center gap-2 h-9 text-xs px-4 rounded-lg shadow-sm"
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
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <Card className="w-full max-w-md shadow-lg border-border">

              <CardHeader className="border-b border-border bg-rose-50/5">
                <CardTitle className="font-display text-base font-bold text-rose-800 flex items-center gap-2">
                  <XCircle className="size-5 text-rose-600" />
                  Return Work Log to Sender
                </CardTitle>
                <CardDescription className="text-xs">
                  Specify feedback for the engineer to correct their log details.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="comments" className="text-xs font-bold text-foreground">DGM Feedback Comments *</Label>
                  <textarea
                    id="comments"
                    rows={4}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Enter instructions on what to fix (e.g. Specify project tasks completed, correct working hours value...)"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
                    className="bg-rose-600 hover:bg-rose-700 text-white font-bold h-9 px-4 text-xs"
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
              
              <div className="w-full max-w-4xl bg-background border-l border-border h-full flex flex-col shadow-2xl relative animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="p-6 border-b border-border bg-slate-500/5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-base border border-primary/20">
                      {initials}
                    </div>
                    <div>
                      <h3 className="font-display font-extrabold text-lg text-foreground flex items-center gap-2">
                        {employee.full_name || 'Anonymous'}
                        <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full">
                          {logs.length} pending
                        </span>
                      </h3>
                      <p className="text-xs text-muted-foreground">{employee.email || 'no-email@efae.com'} &middot; {employee.department || 'General Staff'}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedEmployeeEmail(null)}
                    className="rounded-full hover:bg-secondary/40 h-9 w-9 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-5" />
                  </Button>
                </div>

                {/* Logs List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {logs.map((log: any) => (
                    <Card key={log.id} className="border border-border/80 shadow-sm overflow-hidden hover:border-border transition-all">
                      <div className="bg-slate-500/5 px-4 py-3 border-b border-border/60 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-[10px] font-extrabold uppercase">
                            {log.project_code || 'General'}
                          </span>
                          <span className="text-xs font-semibold text-foreground">
                            {new Date(log.log_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider ${
                          log.approval_status === 'Returned'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            : log.approval_status === 'Approved'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}>
                          {log.approval_status ?? 'Pending'}
                        </span>
                      </div>

                      <CardContent className="p-4 space-y-4">
                        {/* Tasks Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          <div className="bg-secondary/10 p-3 rounded-lg border border-border/30">
                            <span className="font-extrabold text-[9px] uppercase tracking-wider text-muted-foreground block mb-1">Assigned Tasks</span>
                            <p className="text-foreground whitespace-pre-wrap leading-relaxed">{log.assigned_tasks}</p>
                          </div>
                          <div className="bg-secondary/10 p-3 rounded-lg border border-border/30">
                            <span className="font-extrabold text-[9px] uppercase tracking-wider text-muted-foreground block mb-1">Actual Work Done</span>
                            <p className="text-foreground whitespace-pre-wrap leading-relaxed">{log.actual_work_done}</p>
                          </div>
                        </div>

                        {/* Metrics and Actions Bar */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2 border-t border-border/40">
                          {/* Metrics */}
                          <div className="flex flex-wrap gap-2">
                            <div className="flex items-center gap-1.5 bg-secondary/30 px-2 py-1 rounded text-xs border border-border/50">
                              <span className="text-muted-foreground">Worked:</span>
                              <strong className="text-foreground font-semibold">{log.hours_worked} hrs</strong>
                            </div>
                            <div className="flex items-center gap-1.5 bg-secondary/30 px-2 py-1 rounded text-xs border border-border/50">
                              <span className="text-muted-foreground">Onsite:</span>
                              <strong className="text-foreground font-semibold">{log.actual_working_hour} hrs</strong>
                            </div>
                            <div className="flex items-center gap-1.5 bg-secondary/30 px-2 py-1 rounded text-xs border border-border/50">
                              <span className="text-muted-foreground">Comp:</span>
                              <strong className="text-foreground font-semibold">{Math.round(log.completion_percentage * 100)}%</strong>
                            </div>
                            {log.done_at_home && (
                              <span className="text-[10px] font-semibold text-purple-600 bg-purple-50 dark:bg-purple-950/30 px-1.5 py-1 rounded border border-purple-100 dark:border-purple-900/20">Home Entry</span>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 self-end sm:self-center">
                            <Button
                              size="sm"
                              onClick={() => handleApprove(log)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 h-8 text-xs px-3 shadow-sm rounded-md"
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
                              className="border-rose-200 hover:bg-rose-50 hover:text-rose-600 text-rose-500 font-bold flex items-center gap-1.5 h-8 text-xs px-3 rounded-md"
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
          <Card className="shadow-sm border-border">
            <CardHeader className="border-b border-border bg-rose-500/5 flex flex-row items-center gap-2 py-4 px-6">
              <AlertTriangle className="size-5 text-rose-500 shrink-0" />
              <div>
                <CardTitle className="font-display text-base font-bold text-rose-800">
                  CRITICAL BOND EXPIRED ALERTS
                </CardTitle>
                <CardDescription className="text-rose-600/80 text-xs">
                  Active current date exceeds bond expiry limits
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0 max-h-[380px] overflow-y-auto">
              {(!alerts?.criticalExpiredBonds || alerts.criticalExpiredBonds.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
                  <Inbox className="size-8" />
                  <p className="text-xs font-semibold">All logged bonds are safe.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {alerts.criticalExpiredBonds.map((bond: any) => (
                    <div key={bond.id} className="p-4 flex items-start justify-between gap-4 hover:bg-secondary/20 transition-all">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="inline-block px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-extrabold uppercase">
                            {bond.bond_type}
                          </span>
                          <span className="text-xs font-bold text-foreground truncate max-w-[200px]">
                            {bond.project_name}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1">
                          Contractor: <strong className="text-foreground">{bond.contractor_name}</strong> &middot; Employer: {bond.employer_name}
                        </div>
                        <div className="text-[11px] font-semibold text-rose-600 mt-1.5 flex items-center gap-1">
                          <Clock className="size-3" />
                          Due {new Date(bond.expiry_date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}: {bond.days_overdue} days OVERDUE
                        </div>
                      </div>
                      <button
                        onClick={() => openEmailModal('bond', bond)}
                        className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-background text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-all shrink-0 mt-0.5 shadow-sm"
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
          <Card className="shadow-sm border-border">
            <CardHeader className="border-b border-border bg-amber-500/5 flex flex-row items-center gap-2 py-4 px-6">
              <Clock className="size-5 text-amber-500 shrink-0" />
              <div>
                <CardTitle className="font-display text-base font-bold text-amber-800">
                  NEARLY EXPIRED CONTRACT TIMELINE
                </CardTitle>
                <CardDescription className="text-amber-600/80 text-xs">
                  Approved EOT extensions expiring within 30 days
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0 max-h-[380px] overflow-y-auto">
              {(!alerts?.nearlyExpiredEots || alerts.nearlyExpiredEots.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
                  <Inbox className="size-8" />
                  <p className="text-xs font-semibold">No critical timelines expiring soon.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {alerts.nearlyExpiredEots.map((eot: any) => (
                    <div key={eot.id} className="p-4 flex items-start justify-between gap-4 hover:bg-secondary/20 transition-all">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold uppercase">
                            Claim #{eot.eot_number}
                          </span>
                          <span className="text-xs font-bold text-foreground truncate max-w-[200px]">
                            {eot.project_name}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1">
                          Contractor: <strong className="text-foreground">{eot.contractor_name}</strong> &middot; Approved: {eot.days_approved} days
                        </div>
                        <div className="text-[11px] font-semibold text-amber-600 mt-1.5 flex items-center gap-1">
                          <AlertTriangle className="size-3" />
                          Expiring on {new Date(eot.revised_completion_date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}: {eot.days_remaining} days left
                        </div>
                      </div>
                      <button
                        onClick={() => openEmailModal('eot', eot)}
                        className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-background text-amber-600 hover:bg-amber-50 hover:text-amber-700 transition-all shrink-0 mt-0.5 shadow-sm"
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
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <Card className="w-full max-w-2xl shadow-lg border-border">
              <CardHeader className={`border-b border-border ${emailType === 'bond' ? 'bg-rose-500/5' : 'bg-amber-500/5'}`}>
                <CardTitle className={`font-display text-base font-bold flex items-center gap-2 ${emailType === 'bond' ? 'text-rose-800' : 'text-amber-800'}`}>
                  <Mail className={`size-5 ${emailType === 'bond' ? 'text-rose-600' : 'text-amber-600'}`} />
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
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono text-xs leading-relaxed"
                      required
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
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
                      className={`font-bold h-9 px-4 text-xs flex items-center gap-1.5 ${
                        emailType === 'bond' 
                          ? 'bg-rose-600 hover:bg-rose-700 text-white' 
                          : 'bg-amber-600 hover:bg-amber-700 text-white'
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
