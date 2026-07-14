'use client'

// /notice/bond/[token]
//
// Public page — zero authentication required.
// Shows the single bond record + a real renewal submission form.
// On submit: POSTs to /api/public/bond/[token]/submit which updates
// the bond's expiry date and stamps renewal_submitted_at in the DB.

import { useEffect, useState, use } from 'react'
import {
  Compass, ShieldAlert, CalendarX2, BadgeCheck,
  Clock3, Building2, Layers, CheckCircle2,
  Loader2, Send, AlertCircle,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface BondRecord {
  employer_name:        string
  project_name:         string
  contractor_name:      string
  bond_type:            string
  issue_date:           string | null
  expiry_date:          string
  amount:               number | null
  status:               string
}

type PageState = 'loading' | 'error' | 'ready' | 'submitted'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric',
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BondNoticePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)

  const [pageState, setPageState]       = useState<PageState>('loading')
  const [bond, setBond]                 = useState<BondRecord | null>(null)
  const [submitting, setSubmitting]     = useState(false)
  const [submitError, setSubmitError]   = useState('')

  // Form state
  const [newIssueDate,  setNewIssueDate]  = useState('')
  const [newExpiryDate, setNewExpiryDate] = useState('')
  const [renewalNote,   setRenewalNote]   = useState('')

  // Load bond on mount
  useEffect(() => {
    fetch(`/api/public/bond/${token}`)
      .then(r => r.json())
      .then(json => {
        if (json.bond) {
          setBond(json.bond)
          setPageState('ready')
        } else {
          setPageState('error')
        }
      })
      .catch(() => setPageState('error'))
  }, [token])

  // ── Submit handler ──────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError('')

    if (!newExpiryDate) {
      setSubmitError('Please enter the new bond expiry date.')
      return
    }
    if (new Date(newExpiryDate) <= new Date()) {
      setSubmitError('New expiry date must be in the future.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/public/bond/${token}/submit`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          new_issue_date:  newIssueDate  || undefined,
          new_expiry_date: newExpiryDate,
          renewal_note:    renewalNote   || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setSubmitError(json.error ?? 'Submission failed. Please try again.')
        return
      }
      setPageState('submitted')
    } catch {
      setSubmitError('Network error. Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (pageState === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="size-8 animate-spin text-slate-400" />
      </div>
    )
  }

  // ── Expired / invalid ───────────────────────────────────────────────────────

  if (pageState === 'error' || !bond) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-red-50">
            <CalendarX2 className="size-8 text-red-500" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-800">Link Expired or Invalid</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            This bond notice link is no longer valid. It may have expired (links are active
            for 7 days), already been used to submit a renewal, or superseded by a newer alert.
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

  // ── Success ─────────────────────────────────────────────────────────────────

  if (pageState === 'submitted') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle2 className="size-8 text-emerald-500" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-800">Renewal Submitted</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            Your bond renewal details for <strong>{bond.project_name}</strong> have been
            recorded. The Contract Administration Department has been notified and will
            process your submission.
          </p>
          <div className="mt-6 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-left">
            <p className="text-xs font-bold text-emerald-800">New Expiry Date</p>
            <p className="mt-0.5 text-sm font-semibold text-emerald-700">
              {formatDate(newExpiryDate)}
            </p>
          </div>
          <div className="mt-8 border-t border-slate-100 pt-6 text-xs text-slate-400">
            EF Architects and Engineers Consulting PLC · Contract Administration
          </div>
        </div>
      </div>
    )
  }

  // ── Main page ───────────────────────────────────────────────────────────────

  const days    = daysUntil(bond.expiry_date)
  const u       = urgency(days)
  const expired = days <= 0

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 font-sans">
      <div className="mx-auto w-full max-w-xl space-y-4">

        {/* ── Header card ── */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          {/* Banner */}
          <div
            className="flex items-center justify-between px-6 py-5"
            style={{ background: '#1E3A8A' }}
          >
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-white/10">
                <Compass className="size-5 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-200">
                  EF Architects &amp; Engineers Consulting
                </p>
                <p className="text-sm font-extrabold text-white">Official Bond Notice</p>
              </div>
            </div>
            <span
              className="rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider"
              style={{ background: u.bg, color: u.badge, border: `1px solid ${u.border}` }}
            >
              {expired ? 'EXPIRED' : u.label}
            </span>
          </div>

          {/* Urgency strip */}
          <div className="px-6 pt-5">
            <div className="rounded-xl px-5 py-4" style={{ background: u.bg, border: `1px solid ${u.border}` }}>
              <div className="flex items-center gap-2">
                <ShieldAlert className="size-5 shrink-0" style={{ color: u.badge }} />
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: u.text }}>
                  {expired ? 'Bond has expired' : 'Bond Expiry Warning'}
                </p>
              </div>
              <p className="mt-1.5 text-3xl font-extrabold leading-none" style={{ color: u.text }}>
                {expired
                  ? `${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} overdue`
                  : `${days} day${days !== 1 ? 's' : ''} remaining`}
              </p>
              <p className="mt-1 text-xs" style={{ color: u.text, opacity: 0.8 }}>
                {expired ? 'Expired on' : 'Current expiry date:'}{' '}
                <strong>{formatDate(bond.expiry_date)}</strong>
              </p>
            </div>
          </div>

          {/* Bond details */}
          <div className="px-6 pt-5">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Bond Details</p>
            <dl className="divide-y divide-slate-100">
              {[
                { icon: Building2,  label: 'Project',           value: bond.project_name    },
                { icon: Building2,  label: 'Employer / Client', value: bond.employer_name   },
                { icon: Layers,     label: 'Contractor',        value: bond.contractor_name },
                { icon: Layers,     label: 'Bond Type',         value: bond.bond_type       },
                { icon: Clock3,     label: 'Current Expiry',    value: formatDate(bond.expiry_date) },
                ...(bond.issue_date ? [{ icon: Clock3, label: 'Issue Date', value: formatDate(bond.issue_date) }] : []),
                ...(bond.amount != null ? [{ icon: BadgeCheck, label: 'Bond Amount', value: `${Number(bond.amount).toLocaleString()} ETB` }] : []),
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

          {/* Status */}
          <div className="px-6 pt-3 pb-6">
            <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-2.5">
              <span className="text-xs text-slate-500">Current Status</span>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                bond.status === 'Active'  ? 'bg-emerald-50 text-emerald-700' :
                bond.status === 'Expired' ? 'bg-red-50 text-red-700'        :
                                            'bg-slate-100 text-slate-600'
              }`}>{bond.status}</span>
            </div>
          </div>

        </div>

        {/* ── Renewal submission form ── */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-sm font-extrabold text-slate-800">Submit Bond Renewal</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Enter the details of the renewed bond. This will update the contract record
              and notify the Contract Administration Department.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

            {/* New issue date */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-700" htmlFor="new-issue">
                New Bond Issue Date
                <span className="ml-1 font-normal text-slate-400">(optional)</span>
              </label>
              <input
                id="new-issue"
                type="date"
                value={newIssueDate}
                onChange={e => setNewIssueDate(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800
                           focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* New expiry date — required */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-700" htmlFor="new-expiry">
                New Bond Expiry Date <span className="text-red-500">*</span>
              </label>
              <input
                id="new-expiry"
                type="date"
                required
                value={newExpiryDate}
                min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                onChange={e => setNewExpiryDate(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800
                           focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* Renewal note */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-700" htmlFor="renewal-note">
                Message to Contract Administration
                <span className="ml-1 font-normal text-slate-400">(optional)</span>
              </label>
              <textarea
                id="renewal-note"
                rows={3}
                maxLength={500}
                placeholder="e.g. Renewed bond issued by CBE, certificate attached to physical file…"
                value={renewalNote}
                onChange={e => setRenewalNote(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800
                           placeholder-slate-400 resize-none
                           focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <p className="text-right text-[10px] text-slate-400">{renewalNote.length}/500</p>
            </div>

            {/* Error */}
            {submitError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-500" />
                <p className="text-xs text-red-700">{submitError}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3
                         text-sm font-bold text-white shadow-sm transition-all
                         disabled:cursor-not-allowed disabled:opacity-60
                         hover:opacity-90 active:scale-[0.98]"
              style={{ background: '#1E3A8A' }}
            >
              {submitting
                ? <><Loader2 className="size-4 animate-spin" /> Submitting…</>
                : <><Send className="size-4" /> Submit Bond Renewal</>
              }
            </button>

            <p className="text-center text-[10px] text-slate-400">
              Submitting will update the bond record and invalidate this link.
              Keep a copy of the new expiry date for your records.
            </p>

          </form>
        </div>

        {/* Footer */}
        <div className="px-2 pb-6 text-center text-[10px] text-slate-400">
          <p className="font-semibold text-slate-600">EF Architects and Engineers Consulting PLC</p>
          <p className="mt-0.5">Contract Administration Department · Addis Ababa, Ethiopia</p>
          <p className="mt-2">This page is private and linked only to your specific bond. Do not share this link.</p>
        </div>

      </div>
    </div>
  )
}
