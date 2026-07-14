'use client'

// /notice/eot/[token]
//
// Public page — zero authentication required.
// Shows the single EOT record + a live progress timeline +
// a form for the department head to log a site progress note.

import { useEffect, useState, use } from 'react'
import {
  Compass, CalendarX2, Clock3, Building2, Calendar,
  Hash, Loader2, CheckCircle2, AlertCircle, ClipboardList,
  TrendingUp, Send,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface EotRecord {
  client_name:             string
  project_name:            string
  contractor_name:         string
  eot_number:              number
  days_approved:           number
  revised_completion_date: string
  status:                  string
  reason_for_eot:          string
}

type PageState = 'loading' | 'error' | 'ready'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function daysUntil(iso: string) {
  const today  = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(iso); target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000)
}

function urgency(days: number) {
  if (days <= 7)  return { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', badge: '#DC2626', label: 'CRITICAL' }
  if (days <= 15) return { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E', badge: '#D97706', label: 'HIGH PRIORITY' }
  return           { bg: '#EFF6FF', border: '#BFDBFE', text: '#1E40AF', badge: '#2563EB', label: 'ADVANCE NOTICE' }
}

/**
 * Calculates a percentage of elapsed time through the EOT window.
 * Uses revised_completion_date and days_approved to determine the window start.
 */
function timelinePercent(revisedDate: string, daysApproved: number): number {
  const endDate   = new Date(revisedDate)
  const startDate = new Date(endDate.getTime() - daysApproved * 86_400_000)
  const now       = new Date()
  const total     = endDate.getTime() - startDate.getTime()
  const elapsed   = now.getTime()  - startDate.getTime()
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)))
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EotNoticePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)

  const [pageState, setPageState]     = useState<PageState>('loading')
  const [eot, setEot]                 = useState<EotRecord | null>(null)
  const [submitting, setSubmitting]   = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitSuccess, setSubmitSuccess] = useState('')
  const [progressNote, setProgressNote]   = useState('')
  const [savedNote, setSavedNote]         = useState('')
  const [savedAt, setSavedAt]             = useState('')

  // Load EOT record on mount
  useEffect(() => {
    fetch(`/api/public/eot/${token}`)
      .then(r => r.json())
      .then(json => {
        if (json.eot) {
          setEot(json.eot)
          setPageState('ready')
        } else {
          setPageState('error')
        }
      })
      .catch(() => setPageState('error'))
  }, [token])

  // ── Submit progress note ──────────────────────────────────────────────────

  async function handleProgressSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError('')
    setSubmitSuccess('')

    if (!progressNote.trim()) {
      setSubmitError('Please enter a progress note before submitting.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/public/eot/${token}/progress`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ progress_note: progressNote }),
      })
      const json = await res.json()
      if (!res.ok) {
        setSubmitError(json.error ?? 'Submission failed. Please try again.')
        return
      }
      setSavedNote(progressNote)
      setSavedAt(json.eot?.progress_updated_at ?? new Date().toISOString())
      setProgressNote('')
      setSubmitSuccess('Progress note saved and visible to the Contract Administration team.')
    } catch {
      setSubmitError('Network error. Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (pageState === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="size-8 animate-spin text-slate-400" />
      </div>
    )
  }

  // ── Expired / invalid ─────────────────────────────────────────────────────

  if (pageState === 'error' || !eot) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-red-50">
            <CalendarX2 className="size-8 text-red-500" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-800">Link Expired or Invalid</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            This EOT advisory link is no longer valid. It may have expired (links are
            active for 7 days) or been superseded by a newer alert.
          </p>
          <p className="mt-4 text-xs text-slate-400">
            Contact the Contract Administration Department if you need assistance.
          </p>
          <div className="mt-8 border-t border-slate-100 pt-6 text-xs text-slate-400">
            EF Architects and Engineers Consulting PLC
          </div>
        </div>
      </div>
    )
  }

  // ── Main page ─────────────────────────────────────────────────────────────

  const days    = daysUntil(eot.revised_completion_date)
  const u       = urgency(days)
  const overdue = days <= 0
  const pct     = timelinePercent(eot.revised_completion_date, eot.days_approved)

  // Timeline colour
  const barColor = pct >= 90 ? '#DC2626' : pct >= 70 ? '#D97706' : '#16A34A'

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 font-sans">
      <div className="mx-auto w-full max-w-xl space-y-4">

        {/* ── Header card ── */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          {/* Banner */}
          <div
            className="flex items-center justify-between px-6 py-5"
            style={{ background: '#475569' }}
          >
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-white/10">
                <Compass className="size-5 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
                  Internal Project Milestone Advisory
                </p>
                <p className="text-sm font-extrabold text-white">EOT Deadline Notice</p>
              </div>
            </div>
            <span
              className="rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider"
              style={{ background: u.bg, color: u.badge, border: `1px solid ${u.border}` }}
            >
              {overdue ? 'OVERDUE' : u.label}
            </span>
          </div>

          {/* Urgency strip */}
          <div className="px-6 pt-5">
            <div className="rounded-xl px-5 py-4" style={{ background: u.bg, border: `1px solid ${u.border}` }}>
              <div className="flex items-center gap-2">
                <Calendar className="size-5 shrink-0" style={{ color: u.badge }} />
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: u.text }}>
                  {overdue ? 'Revised deadline has passed' : 'Revised deadline approaching'}
                </p>
              </div>
              <p className="mt-1.5 text-3xl font-extrabold leading-none" style={{ color: u.text }}>
                {overdue
                  ? `${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} overdue`
                  : `${days} day${days !== 1 ? 's' : ''} remaining`}
              </p>
              <p className="mt-1 text-xs" style={{ color: u.text, opacity: 0.8 }}>
                {overdue ? 'Deadline was:' : 'Revised completion deadline:'}{' '}
                <strong>{formatDate(eot.revised_completion_date)}</strong>
              </p>
            </div>
          </div>

          {/* EOT details */}
          <div className="px-6 pt-5">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">EOT Record Summary</p>
            <dl className="divide-y divide-slate-100">
              {[
                { icon: Building2, label: 'Project',            value: eot.project_name   },
                { icon: Building2, label: 'Client / Employer',  value: eot.client_name    },
                { icon: Building2, label: 'Contractor',         value: eot.contractor_name },
                { icon: Hash,      label: 'EOT Claim No.',      value: `#${eot.eot_number}` },
                { icon: Clock3,    label: 'Extension Granted',  value: `${eot.days_approved} calendar days` },
                { icon: Calendar,  label: 'Revised Deadline',   value: formatDate(eot.revised_completion_date) },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Icon className="size-3.5 shrink-0 text-slate-400" />
                    {label}
                  </div>
                  <span className="max-w-[55%] text-right text-xs font-semibold text-slate-800">{value}</span>
                </div>
              ))}
            </dl>
          </div>

          {/* Reason */}
          {eot.reason_for_eot && (
            <div className="px-6 pb-2 pt-3">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Reason for Extension</p>
              <p className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
                {eot.reason_for_eot}
              </p>
            </div>
          )}

          {/* Status */}
          <div className="px-6 pt-3 pb-6">
            <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-2.5">
              <span className="text-xs text-slate-500">Approval Status</span>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                eot.status === 'Approved'     ? 'bg-emerald-50 text-emerald-700' :
                eot.status === 'Rejected'     ? 'bg-red-50 text-red-700'        :
                eot.status === 'Under Review' ? 'bg-orange-50 text-orange-700'  :
                                                'bg-amber-50 text-amber-700'
              }`}>{eot.status}</span>
            </div>
          </div>

        </div>

        {/* ── EOT Window Timeline ── */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 text-slate-500" />
              <h2 className="text-sm font-extrabold text-slate-800">EOT Window Progress</h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Time elapsed through the approved extension window.
            </p>
          </div>
          <div className="px-6 py-5">
            {/* Bar */}
            <div className="relative h-4 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: barColor }}
              />
            </div>
            {/* Labels */}
            <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
              <span>EOT Start</span>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{ background: pct >= 90 ? '#FEF2F2' : pct >= 70 ? '#FFFBEB' : '#F0FDF4',
                         color: barColor }}
              >
                {pct}% elapsed
              </span>
              <span>Revised Deadline</span>
            </div>
            {/* Milestones row */}
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                { label: 'Extension Granted', value: `${eot.days_approved} days`, color: 'text-slate-700' },
                { label: 'Days Remaining',    value: overdue ? 'Overdue' : `${days} days`, color: overdue ? 'text-red-600' : days <= 15 ? 'text-amber-600' : 'text-emerald-600' },
                { label: 'Time Used',         value: `${pct}%`, color: pct >= 90 ? 'text-red-600' : pct >= 70 ? 'text-amber-600' : 'text-emerald-600' },
              ].map(m => (
                <div key={m.label} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 text-center">
                  <p className={`text-base font-extrabold ${m.color}`}>{m.value}</p>
                  <p className="mt-0.5 text-[10px] text-slate-400">{m.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Previously saved note ── */}
        {savedNote && (
          <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-4">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              <div>
                <p className="text-xs font-bold text-emerald-800">Progress Note Saved</p>
                <p className="mt-1 text-xs leading-relaxed text-emerald-700">{savedNote}</p>
                {savedAt && (
                  <p className="mt-1.5 text-[10px] text-emerald-600">Logged at {formatDateTime(savedAt)}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Progress note form ── */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="size-4 text-slate-500" />
              <h2 className="text-sm font-extrabold text-slate-800">Log Site Progress Update</h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Record the current execution status for this EOT window. Your note will be
              visible to the Contract Administration team in the portal.
            </p>
          </div>

          <form onSubmit={handleProgressSubmit} className="px-6 py-5 space-y-4">

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-700" htmlFor="progress-note">
                Site Progress Note <span className="text-red-500">*</span>
              </label>
              <textarea
                id="progress-note"
                rows={4}
                maxLength={1000}
                required
                placeholder={
                  `e.g. Structural works are 75% complete. Finishing works on floors B1–G ongoing. ` +
                  `Contractor is on track to achieve substantial completion by the revised deadline.`
                }
                value={progressNote}
                onChange={e => setProgressNote(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800
                           placeholder-slate-400 resize-none
                           focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/20"
              />
              <p className="text-right text-[10px] text-slate-400">{progressNote.length}/1000</p>
            </div>

            {/* Success */}
            {submitSuccess && (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                <p className="text-xs text-emerald-700">{submitSuccess}</p>
              </div>
            )}

            {/* Error */}
            {submitError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-500" />
                <p className="text-xs text-red-700">{submitError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3
                         text-sm font-bold text-white shadow-sm transition-all
                         disabled:cursor-not-allowed disabled:opacity-60
                         hover:opacity-90 active:scale-[0.98]"
              style={{ background: '#475569' }}
            >
              {submitting
                ? <><Loader2 className="size-4 animate-spin" /> Saving…</>
                : <><Send className="size-4" /> Save Progress Note</>
              }
            </button>

            <p className="text-center text-[10px] text-slate-400">
              You can update this note multiple times. Each submission overwrites the previous entry.
            </p>
          </form>
        </div>

        {/* Footer */}
        <div className="px-2 pb-6 text-center text-[10px] text-slate-400">
          <p className="font-semibold text-slate-600">EF Architects and Engineers Consulting PLC</p>
          <p className="mt-0.5">Contract Administration Department · Addis Ababa, Ethiopia</p>
          <p className="mt-2">This page is confidential. Do not forward or share this link.</p>
        </div>

      </div>
    </div>
  )
}
