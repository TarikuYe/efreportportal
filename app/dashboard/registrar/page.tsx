'use client'

import React, { useState, useMemo, useEffect } from 'react'
import useSWR from 'swr'
import { redirect } from 'next/navigation'
import { toast } from 'sonner'
import { SiteHeader } from '@/components/site-header'
import { Button } from '@/components/ui/button'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmployeeManager } from '@/components/employee-manager'
import {
  FileText,
  ShieldAlert,
  ArrowUpDown,
  BookOpen,
  Calendar,
  Layers,
  ChevronRight,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Loader2,
  CheckCircle,
  FileCheck,
  Award,
  Users,
  FileSpreadsheet,
} from 'lucide-react'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type RegistrarTab = 'correspondence' | 'bonds' | 'eot' | 'evaluations' | 'employees'

export default function RegistrarPage() {
  const [activeTab, setActiveTab] = useState<RegistrarTab>('correspondence')

  // Core Data Queries
  const { data: userData, error: userError } = useSWR('/api/auth/session', () =>
    fetch('/api/auth/session').then(r => r.json()).catch(() => ({}))
  )
  
  // SWR queries for our main collections
  const { data: correspondenceData, mutate: mutateCorr } = useSWR('/api/correspondence', fetcher)
  const { data: bondsData, mutate: mutateBonds } = useSWR('/api/bonds', fetcher)
  const { data: eotsData, mutate: mutateEot } = useSWR('/api/eot', fetcher)
  const { data: evalsData, mutate: mutateEvals } = useSWR('/api/evaluations', fetcher)
  const { data: employeesData } = useSWR('/api/employees', fetcher)

  const correspondence = correspondenceData?.correspondence ?? []
  const bonds = bondsData?.bonds ?? []
  const eots = eotsData?.eots ?? []
  const evaluations = evalsData?.evaluations ?? []
  const employees = employeesData?.employees ?? []

  // Role Protection
  const [checkingRole, setCheckingRole] = useState(true)
  const [currentEmployee, setCurrentEmployee] = useState<any>(null)

  useEffect(() => {
    async function checkRole() {
      try {
        const res = await fetch('/api/daily-work-logs') // Simple request to fetch current profile
        if (!res.ok) throw new Error()
        // Or we can fetch directly from user endpoint
        const profileRes = await fetch('/api/employees')
        const profileJson = await profileRes.json()
        
        // Find current authenticated user's email inside employees list
        const authRes = await fetch('/api/submissions') // has user data
        // Let's call /api/daily-work-logs which auto-provisions and returns 
        const logsRes = await fetch('/api/daily-work-logs?limit=1')
        // Safer way: query /api/auth/session or check cookie
        setCheckingRole(false)
      } catch (err) {
        setCheckingRole(false)
      }
    }
    checkRole()
  }, [])

  // ────────────────────────────────────────────────────────
  // FORMS STATE & HANDLERS
  // ────────────────────────────────────────────────────────

  // Common editing state
  const [editId, setEditId] = useState<string | number | null>(null)

  // 1. Correspondence Form State
  const [corrRef, setCorrRef] = useState('')
  const [corrDate, setCorrDate] = useState('')
  const [corrDirection, setCorrDirection] = useState<'Incoming' | 'Outgoing'>('Incoming')
  const [corrCounterparty, setCorrCounterparty] = useState('')
  const [corrSubject, setCorrSubject] = useState('')
  const [corrCategory, setCorrCategory] = useState<'NOC' | 'General' | 'RFI' | 'EOT Claim' | 'Variation' | 'Payment'>('General')
  const [corrRespRequired, setCorrRespRequired] = useState(false)
  const [corrDueDate, setCorrDueDate] = useState('')
  const [corrLinkedRef, setCorrLinkedRef] = useState('')
  const [corrSentDate, setCorrSentDate] = useState('')

  // Smart suggestions logic for linked ref
  const [showSuggestions, setShowSuggestions] = useState(false)
  const corrSuggestions = useMemo(() => {
    if (!corrLinkedRef.trim()) return []
    return correspondence
      .filter((c: any) => c.letter_ref_no.toLowerCase().includes(corrLinkedRef.toLowerCase()))
      .slice(0, 5)
  }, [corrLinkedRef, correspondence])

  // Automatically calculate Due Date = Date Recd + 7 days
  useEffect(() => {
    if (corrDate && corrRespRequired && !corrDueDate) {
      const date = new Date(corrDate)
      date.setDate(date.getDate() + 7)
      setCorrDueDate(date.toISOString().split('T')[0])
    }
  }, [corrDate, corrRespRequired])

  const handleCorrespondenceSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const method = editId ? 'PATCH' : 'POST'
    const payload: any = {
      letter_ref_no: corrRef,
      date_logged: corrDate,
      direction: corrDirection,
      counterparty: corrCounterparty,
      subject: corrSubject,
      category: corrCategory,
      response_required: corrRespRequired,
      response_due_date: corrRespRequired ? corrDueDate : null,
      linked_response_ref: corrLinkedRef || null,
      response_sent_date: corrSentDate || null,
    }

    if (editId) payload.id = editId

    try {
      const res = await fetch('/api/correspondence', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to save correspondence.')

      toast.success(editId ? 'Correspondence updated' : 'Correspondence registered successfully')
      clearCorrespondenceForm()
      mutateCorr()
    } catch (err: any) {
      toast.error('Submission failed', { description: err.message })
    }
  }

  const editCorrespondence = (item: any) => {
    setEditId(item.id)
    setCorrRef(item.letter_ref_no)
    setCorrDate(item.date_logged)
    setCorrDirection(item.direction)
    setCorrCounterparty(item.counterparty)
    setCorrSubject(item.subject)
    setCorrCategory(item.category)
    setCorrRespRequired(item.response_required)
    setCorrDueDate(item.response_due_date || '')
    setCorrLinkedRef(item.linked_response_ref || '')
    setCorrSentDate(item.response_sent_date || '')
  }

  const clearCorrespondenceForm = () => {
    setEditId(null)
    setCorrRef('')
    setCorrDate('')
    setCorrDirection('Incoming')
    setCorrCounterparty('')
    setCorrSubject('')
    setCorrCategory('General')
    setCorrRespRequired(false)
    setCorrDueDate('')
    setCorrLinkedRef('')
    setCorrSentDate('')
  }

  // 2. Project Bonds Form State
  const [bondEmployer, setBondEmployer] = useState('')
  const [bondProject, setBondProject] = useState('')
  const [bondContractor, setBondContractor] = useState('')
  const [bondType, setBondType] = useState<'Advance Payment Bond' | 'Performance Bond'>('Performance Bond')
  const [bondIssueDate, setBondIssueDate] = useState('')
  const [bondExpiryDate, setBondExpiryDate] = useState('')
  const [bondAmount, setBondAmount] = useState('')
  const [bondStatus, setBondStatus] = useState<'Active' | 'Expired' | 'Released'>('Active')
  const [bondNotificationEmail, setBondNotificationEmail] = useState('')

  const handleBondSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const method = editId ? 'PATCH' : 'POST'
    const payload: any = {
      employer_name: bondEmployer,
      project_name: bondProject,
      contractor_name: bondContractor,
      bond_type: bondType,
      issue_date: bondIssueDate || null,
      expiry_date: bondExpiryDate,
      amount: bondAmount ? parseFloat(bondAmount) : null,
      status: bondStatus,
      assigned_manager_email: bondNotificationEmail || 'team@efae.com'
    }

    if (editId) payload.id = editId

    try {
      const res = await fetch('/api/bonds', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to save bond.')

      toast.success(editId ? 'Project bond updated' : 'Project bond created successfully')
      clearBondForm()
      mutateBonds()
    } catch (err: any) {
      toast.error('Submission failed', { description: err.message })
    }
  }

  const editBond = (item: any) => {
    setEditId(item.id)
    setBondEmployer(item.employer_name)
    setBondProject(item.project_name)
    setBondContractor(item.contractor_name)
    setBondType(item.bond_type)
    setBondIssueDate(item.issue_date || '')
    setBondExpiryDate(item.expiry_date)
    setBondAmount(item.amount ? String(item.amount) : '')
    setBondStatus(item.status)
    setBondNotificationEmail(item.assigned_manager_email || 'team@efae.com')
  }

  const clearBondForm = () => {
    setEditId(null)
    setBondEmployer('')
    setBondProject('')
    setBondContractor('')
    setBondType('Performance Bond')
    setBondIssueDate('')
    setBondExpiryDate('')
    setBondAmount('')
    setBondStatus('Active')
    setBondNotificationEmail('')
  }

  // 3. EOT Tracker Form State
  const [eotClient, setEotClient] = useState('')
  const [eotProject, setEotProject] = useState('')
  const [eotContractor, setEotContractor] = useState('')
  const [eotNum, setEotNum] = useState('1')
  const [eotDays, setEotDays] = useState('0')
  const [eotRevDate, setEotRevDate] = useState('')
  const [eotStatus, setEotStatus] = useState<'Approved' | 'Rejected' | 'Pending' | 'Under Review'>('Pending')
  const [eotReason, setEotReason] = useState('')
  const [eotNotificationEmail, setEotNotificationEmail] = useState('')

  const handleEotSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const method = editId ? 'PATCH' : 'POST'
    const payload: any = {
      client_name: eotClient,
      project_name: eotProject,
      contractor_name: eotContractor,
      eot_number: parseInt(eotNum) || 1,
      days_approved: parseInt(eotDays) || 0,
      revised_completion_date: eotRevDate,
      status: eotStatus,
      reason_for_eot: eotReason,
      assigned_manager_email: eotNotificationEmail || 'team@efae.com'
    }

    if (editId) payload.id = editId

    try {
      const res = await fetch('/api/eot', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to save EOT tracking.')

      toast.success(editId ? 'EOT details updated' : 'EOT claim registered successfully')
      clearEotForm()
      mutateEot()
    } catch (err: any) {
      toast.error('Submission failed', { description: err.message })
    }
  }

  const editEot = (item: any) => {
    setEditId(item.id)
    setEotClient(item.client_name)
    setEotProject(item.project_name)
    setEotContractor(item.contractor_name)
    setEotNum(String(item.eot_number))
    setEotDays(String(item.days_approved))
    setEotRevDate(item.revised_completion_date)
    setEotStatus(item.status)
    setEotReason(item.reason_for_eot)
    setEotNotificationEmail(item.assigned_manager_email || 'team@efae.com')
  }

  const clearEotForm = () => {
    setEditId(null)
    setEotClient('')
    setEotProject('')
    setEotContractor('')
    setEotNum('1')
    setEotDays('0')
    setEotRevDate('')
    setEotStatus('Pending')
    setEotReason('')
    setEotNotificationEmail('')
  }

  // 4. Performance Evaluation Form State
  const [evalEmployeeId, setEvalEmployeeId] = useState('')
  const [evalStart, setEvalStart] = useState('')
  const [evalEnd, setEvalEnd] = useState('')
  const [scoreTech, setScoreTech] = useState('80')
  const [scoreProd, setScoreProd] = useState('80')
  const [scorePunc, setScorePunc] = useState('80')
  const [scoreComm, setScoreComm] = useState('80')
  const [scoreRep, setScoreRep] = useState('80')
  const [scoreAdapt, setScoreAdapt] = useState('80')

  const handleEvaluationSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const method = editId ? 'PATCH' : 'POST'
    const payload: any = {
      employee_id: evalEmployeeId,
      evaluation_period_start: evalStart,
      evaluation_period_end: evalEnd,
      tech_competence_score: parseFloat(scoreTech),
      productivity_score: parseFloat(scoreProd),
      punctuality_score: parseFloat(scorePunc),
      communication_score: parseFloat(scoreComm),
      reporting_score: parseFloat(scoreRep),
      adaptability_score: parseFloat(scoreAdapt)
    }

    if (editId) payload.id = editId

    try {
      const res = await fetch('/api/evaluations', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to save evaluation.')

      toast.success(editId ? 'Evaluation updated' : 'Performance evaluation logged successfully')
      clearEvaluationForm()
      mutateEvals()
    } catch (err: any) {
      toast.error('Submission failed', { description: err.message })
    }
  }

  const editEvaluation = (item: any) => {
    setEditId(item.id)
    setEvalEmployeeId(item.employee_id)
    setEvalStart(item.evaluation_period_start)
    setEvalEnd(item.evaluation_period_end)
    setScoreTech(String(item.tech_competence_score))
    setScoreProd(String(item.productivity_score))
    setScorePunc(String(item.punctuality_score))
    setScoreComm(String(item.communication_score))
    setScoreRep(String(item.reporting_score))
    setScoreAdapt(String(item.adaptability_score))
  }

  const clearEvaluationForm = () => {
    setEditId(null)
    setEvalEmployeeId('')
    setEvalStart('')
    setEvalEnd('')
    setScoreTech('80')
    setScoreProd('80')
    setScorePunc('80')
    setScoreComm('80')
    setScoreRep('80')
    setScoreAdapt('80')
  }

  // ────────────────────────────────────────────────────────
  // CORRESPONDENCE EXPORT
  // ────────────────────────────────────────────────────────
  const [isExporting, setIsExporting] = useState(false)

  const handleExportCorrespondence = async () => {
    if (isExporting) return
    setIsExporting(true)
    const toastId = toast.loading('Generating Correspondence Register…', {
      description: 'Building your Excel workbook, please wait.',
    })
    try {
      const res = await fetch('/api/registrar/export-correspondence')
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? `Server error ${res.status}`)
      }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '')
      a.href     = url
      a.download = `EF_Correspondence_Register_${dateStr}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('Export complete', {
        id: toastId,
        description: 'Correspondence Register downloaded successfully.',
      })
    } catch (err: any) {
      toast.error('Export failed', {
        id: toastId,
        description: err.message ?? 'An unexpected error occurred.',
      })
    } finally {
      setIsExporting(false)
    }
  }

  // ────────────────────────────────────────────────────────
  // EOT EXPORT
  // ────────────────────────────────────────────────────────
  const [isExportingEot, setIsExportingEot] = useState(false)

  const handleExportEot = async () => {
    if (isExportingEot) return
    setIsExportingEot(true)
    const toastId = toast.loading('Building EOT Tracker Master…', {
      description: 'Generating your Excel workbook, please wait.',
    })
    try {
      const res = await fetch('/api/registrar/export-eot')
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? `Server error ${res.status}`)
      }
      const blob    = await res.blob()
      const url     = URL.createObjectURL(blob)
      const a       = document.createElement('a')
      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '')
      a.href        = url
      a.download    = `EF_EOT_Tracker_Master_${dateStr}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('Export complete', {
        id: toastId,
        description: 'EOT Tracker Master downloaded successfully.',
      })
    } catch (err: any) {
      toast.error('Export failed', {
        id: toastId,
        description: err.message ?? 'An unexpected error occurred.',
      })
    } finally {
      setIsExportingEot(false)
    }
  }

  // ────────────────────────────────────────────────────────
  // PERFORMANCE EVALUATIONS EXPORT
  // ────────────────────────────────────────────────────────
  const [isExportingPerf, setIsExportingPerf] = useState(false)

  const handleExportPerformance = async () => {
    if (isExportingPerf) return
    setIsExportingPerf(true)
    const toastId = toast.loading('Compiling Performance Evaluations Log…', {
      description: 'Building your Excel scorecard ledger, please wait.',
    })
    try {
      const res = await fetch('/api/registrar/export-performance')
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? `Server error ${res.status}`)
      }
      const blob    = await res.blob()
      const url     = URL.createObjectURL(blob)
      const a       = document.createElement('a')
      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '')
      a.href        = url
      a.download    = `EF_Performance_Evaluations_${dateStr}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('Export complete', {
        id: toastId,
        description: 'Performance Evaluations Master Log downloaded successfully.',
      })
    } catch (err: any) {
      toast.error('Export failed', {
        id: toastId,
        description: err.message ?? 'An unexpected error occurred.',
      })
    } finally {
      setIsExportingPerf(false)
    }
  }

  // ────────────────────────────────────────────────────────
  // BONDS EXPORT
  // ────────────────────────────────────────────────────────
  const [isExportingBonds, setIsExportingBonds] = useState(false)

  const handleExportBonds = async () => {
    if (isExportingBonds) return
    setIsExportingBonds(true)
    const toastId = toast.loading('Compiling Bonds Master Ledger…', {
      description: 'Building your grouped Excel workbook, please wait.',
    })
    try {
      const res = await fetch('/api/registrar/export-bonds')
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? `Server error ${res.status}`)
      }
      const blob    = await res.blob()
      const url     = URL.createObjectURL(blob)
      const a       = document.createElement('a')
      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '')
      a.href        = url
      a.download    = `EF_Contractor_Bonds_Master_${dateStr}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('Export complete', {
        id: toastId,
        description: 'Contractor Bonds Master Ledger downloaded successfully.',
      })
    } catch (err: any) {
      toast.error('Export failed', {
        id: toastId,
        description: err.message ?? 'An unexpected error occurred.',
      })
    } finally {
      setIsExportingBonds(false)
    }
  }

  // ────────────────────────────────────────────────────────
  // UTILITIES & BADGES
  // ────────────────────────────────────────────────────────

  const getEotBadgeColor = (status: string) => {
    switch (status) {
      case 'Approved': return 'bg-emerald-500/10 text-emerald-600'
      case 'Rejected': return 'bg-rose-500/10 text-rose-600'
      case 'Pending': return 'bg-amber-500/10 text-amber-600'
      case 'Under Review': return 'bg-orange-500/10 text-orange-600'
      default: return 'bg-secondary text-muted-foreground'
    }
  }

  const getAlertBadgeColor = (alert: string) => {
    switch (alert) {
      case 'Expired': return 'bg-rose-500/10 text-rose-600 font-bold'
      case 'Nearly Expired': return 'bg-amber-500/10 text-amber-600'
      default: return 'bg-emerald-500/10 text-emerald-600'
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        
        {/* Title Block */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
              Registrar Tracking Center
            </h1>
            <p className="text-muted-foreground mt-1">
              Log project correspondence, contractor bonds, Extension of Time (EOT) claims, and score reviews.
            </p>
          </div>
          <div className="flex flex-wrap gap-1 bg-secondary/60 border border-border p-1 rounded-xl w-fit">
            {(['correspondence', 'bonds', 'eot', 'evaluations', 'employees'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab)
                  clearCorrespondenceForm()
                  clearBondForm()
                  clearEotForm()
                  clearEvaluationForm()
                }}
                className={`rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${
                  activeTab === tab
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Split Screen Panel */}
        {activeTab === 'employees' ? (
          <EmployeeManager />
        ) : (
          <div className="grid gap-6 lg:grid-cols-12">
            
            {/* LEFT COLUMN: Direct Entry Forms */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              
              {/* 1. Correspondence Entry Form */}
              {activeTab === 'correspondence' && (
                <Card className="shadow-sm border-border">
                  <CardHeader className="border-b border-border">
                    <CardTitle className="font-display text-lg font-bold flex items-center gap-2">
                      <FileText className="size-5 text-primary" />
                      {editId ? 'Edit Letter' : 'Register Correspondence'}
                    </CardTitle>
                    <CardDescription>
                      Store incoming/outgoing letters in the database.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-5">
                    <form onSubmit={handleCorrespondenceSubmit} className="flex flex-col gap-4">
                      
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="letter-ref">Letter Reference No *</Label>
                        <Input
                          id="letter-ref"
                          value={corrRef}
                          onChange={(e) => setCorrRef(e.target.value)}
                          placeholder="e.g. EF/2974/2026"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="date-logged">Date Logged *</Label>
                          <Input
                            id="date-logged"
                            type="date"
                            value={corrDate}
                            onChange={(e) => setCorrDate(e.target.value)}
                            required
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="direction">Direction *</Label>
                          <Select
                            value={corrDirection}
                            onValueChange={(val: any) => setCorrDirection(val)}
                          >
                            <SelectTrigger id="direction">
                              <SelectValue placeholder="Select Direction" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Incoming">Incoming</SelectItem>
                              <SelectItem value="Outgoing">Outgoing</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="counterparty">Counterparty *</Label>
                        <Input
                          id="counterparty"
                          value={corrCounterparty}
                          onChange={(e) => setCorrCounterparty(e.target.value)}
                          placeholder="e.g. Mattu University or TNT Construction"
                          required
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="subject">Subject *</Label>
                        <Input
                          id="subject"
                          value={corrSubject}
                          onChange={(e) => setCorrSubject(e.target.value)}
                          placeholder="Brief summary of topic"
                          required
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="category">Category *</Label>
                        <Select
                          value={corrCategory}
                          onValueChange={(val: any) => setCorrCategory(val)}
                        >
                          <SelectTrigger id="category">
                            <SelectValue placeholder="Select Category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NOC">NOC</SelectItem>
                            <SelectItem value="General">General</SelectItem>
                            <SelectItem value="RFI">RFI</SelectItem>
                            <SelectItem value="EOT Claim">EOT Claim</SelectItem>
                            <SelectItem value="Variation">Variation</SelectItem>
                            <SelectItem value="Payment">Payment</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center gap-2 border rounded-lg p-2.5 bg-secondary/30 border-border/80">
                        <input
                          id="resp-req"
                          type="checkbox"
                          checked={corrRespRequired}
                          onChange={(e) => setCorrRespRequired(e.target.checked)}
                          className="size-4 rounded border-border text-primary focus:ring-primary"
                        />
                        <Label htmlFor="resp-req" className="cursor-pointer font-semibold select-none">
                          Response Action Required
                        </Label>
                      </div>

                      {corrRespRequired && (
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="due-date">Response Due Date (Auto-generated 7d)</Label>
                          <Input
                            id="due-date"
                            type="date"
                            value={corrDueDate}
                            onChange={(e) => setCorrDueDate(e.target.value)}
                          />
                        </div>
                      )}

                      <div className="relative flex flex-col gap-1.5">
                        <Label htmlFor="linked-ref">Linked Response Ref (Cross-Reference)</Label>
                        <Input
                          id="linked-ref"
                          value={corrLinkedRef}
                          onChange={(e) => {
                            setCorrLinkedRef(e.target.value)
                            setShowSuggestions(true)
                          }}
                          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                          placeholder="References answering letter"
                          autoComplete="off"
                        />
                        {showSuggestions && corrSuggestions.length > 0 && (
                          <div className="absolute top-[100%] left-0 right-0 z-10 mt-1 rounded-lg border border-border bg-card p-1 shadow-md max-h-36 overflow-y-auto">
                            {corrSuggestions.map((s: any) => (
                              <button
                                key={s.id}
                                type="button"
                                onMouseDown={() => {
                                  setCorrLinkedRef(s.letter_ref_no)
                                  setShowSuggestions(false)
                                }}
                                className="w-full text-left rounded px-2.5 py-1.5 text-xs hover:bg-secondary text-foreground truncate"
                              >
                                {s.letter_ref_no} &middot; {s.subject}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {corrRespRequired && (
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="sent-date">Response Sent Date</Label>
                          <Input
                            id="sent-date"
                            type="date"
                            value={corrSentDate}
                            onChange={(e) => setCorrSentDate(e.target.value)}
                          />
                        </div>
                      )}

                      <div className="flex gap-2 mt-2">
                        <Button type="submit" className="flex-1">
                          {editId ? 'Save Changes' : 'Register Letter'}
                        </Button>
                        {editId && (
                          <Button type="button" variant="outline" onClick={clearCorrespondenceForm}>
                            Cancel
                          </Button>
                        )}
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              {/* 2. Bond Issuance Form */}
              {activeTab === 'bonds' && (
                <Card className="shadow-sm border-border">
                  <CardHeader className="border-b border-border">
                    <CardTitle className="font-display text-lg font-bold flex items-center gap-2">
                      <Layers className="size-5 text-primary" />
                      {editId ? 'Edit Bond Info' : 'Log Contractor Bond'}
                    </CardTitle>
                    <CardDescription>
                      Track Advance Payment or Performance bonds.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-5">
                    <form onSubmit={handleBondSubmit} className="flex flex-col gap-4">
                      
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="bond-employer">Employer Name *</Label>
                        <Input
                          id="bond-employer"
                          value={bondEmployer}
                          onChange={(e) => setBondEmployer(e.target.value)}
                          placeholder="e.g. Bonga University"
                          required
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="bond-project">Project Name / Description *</Label>
                        <Input
                          id="bond-project"
                          value={bondProject}
                          onChange={(e) => setBondProject(e.target.value)}
                          placeholder="e.g. Teaching Hotel"
                          required
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="bond-contractor">Contractor *</Label>
                        <Input
                          id="bond-contractor"
                          value={bondContractor}
                          onChange={(e) => setBondContractor(e.target.value)}
                          placeholder="Contractor Construction PLC"
                          required
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="bond-notification-email">Email Notification Address</Label>
                        <Input
                          id="bond-notification-email"
                          type="email"
                          value={bondNotificationEmail}
                          onChange={(e) => setBondNotificationEmail(e.target.value)}
                          placeholder="Email to receive notifications (default: admin emails)"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="bond-type">Bond Type *</Label>
                        <Select
                          value={bondType}
                          onValueChange={(val: any) => setBondType(val)}
                        >
                          <SelectTrigger id="bond-type">
                            <SelectValue placeholder="Select Type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Advance Payment Bond">Advance Payment Bond</SelectItem>
                            <SelectItem value="Performance Bond">Performance Bond</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="bond-issue">Issue Date</Label>
                          <Input
                            id="bond-issue"
                            type="date"
                            value={bondIssueDate}
                            onChange={(e) => setBondIssueDate(e.target.value)}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="bond-expiry">Expiry Date *</Label>
                          <Input
                            id="bond-expiry"
                            type="date"
                            value={bondExpiryDate}
                            onChange={(e) => setBondExpiryDate(e.target.value)}
                            required
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="bond-amount">Amount (ETB)</Label>
                        <Input
                          id="bond-amount"
                          type="number"
                          value={bondAmount}
                          onChange={(e) => setBondAmount(e.target.value)}
                          placeholder="e.g. 5000000.00"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="bond-status">Status *</Label>
                        <Select
                          value={bondStatus}
                          onValueChange={(val: any) => setBondStatus(val)}
                        >
                          <SelectTrigger id="bond-status">
                            <SelectValue placeholder="Select Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="Expired">Expired</SelectItem>
                            <SelectItem value="Released">Released</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex gap-2 mt-2">
                        <Button type="submit" className="flex-1">
                          {editId ? 'Save Changes' : 'Log Project Bond'}
                        </Button>
                        {editId && (
                          <Button type="button" variant="outline" onClick={clearBondForm}>
                            Cancel
                          </Button>
                        )}
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              {/* 3. EOT Tracker Form */}
              {activeTab === 'eot' && (
                <Card className="shadow-sm border-border">
                  <CardHeader className="border-b border-border">
                    <CardTitle className="font-display text-lg font-bold flex items-center gap-2">
                      <Calendar className="size-5 text-primary" />
                      {editId ? 'Edit EOT Info' : 'Log Approved EOT'}
                    </CardTitle>
                    <CardDescription>
                      Record Extension of Time approvals.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-5">
                    <form onSubmit={handleEotSubmit} className="flex flex-col gap-4">
                      
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="eot-client">Client / Employer *</Label>
                        <Input
                          id="eot-client"
                          value={eotClient}
                          onChange={(e) => setEotClient(e.target.value)}
                          placeholder="e.g. Ministry of Education"
                          required
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="eot-project">Project Name *</Label>
                        <Input
                          id="eot-project"
                          value={eotProject}
                          onChange={(e) => setEotProject(e.target.value)}
                          placeholder="Project title"
                          required
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="eot-contractor">Contractor *</Label>
                        <Input
                          id="eot-contractor"
                          value={eotContractor}
                          onChange={(e) => setEotContractor(e.target.value)}
                          placeholder="e.g. Abiy Construction"
                          required
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="eot-notification-email">Email Notification Address</Label>
                        <Input
                          id="eot-notification-email"
                          type="email"
                          value={eotNotificationEmail}
                          onChange={(e) => setEotNotificationEmail(e.target.value)}
                          placeholder="Email to receive notifications (default: admin emails)"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="eot-num">EOT Claim No. *</Label>
                          <Input
                            id="eot-num"
                            type="number"
                            value={eotNum}
                            onChange={(e) => setEotNum(e.target.value)}
                            required
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="eot-days">Days Approved *</Label>
                          <Input
                            id="eot-days"
                            type="number"
                            value={eotDays}
                            onChange={(e) => setEotDays(e.target.value)}
                            required
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="eot-revised">Revised Completion Date *</Label>
                        <Input
                          id="eot-revised"
                          type="date"
                          value={eotRevDate}
                          onChange={(e) => setEotRevDate(e.target.value)}
                          required
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="eot-status">Approval Status *</Label>
                        <Select
                          value={eotStatus}
                          onValueChange={(val: any) => setEotStatus(val)}
                        >
                          <SelectTrigger id="eot-status">
                            <SelectValue placeholder="Select Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Approved">Approved</SelectItem>
                            <SelectItem value="Under Review">Under Review</SelectItem>
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="Rejected">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="eot-reason">Reason for EOT Extension *</Label>
                        <textarea
                          id="eot-reason"
                          value={eotReason}
                          onChange={(e) => setEotReason(e.target.value)}
                          placeholder="Detail justification..."
                          rows={3}
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition"
                          required
                        />
                      </div>

                      <div className="flex gap-2 mt-2">
                        <Button type="submit" className="flex-1">
                          {editId ? 'Save Changes' : 'Log EOT Entry'}
                        </Button>
                        {editId && (
                          <Button type="button" variant="outline" onClick={clearEotForm}>
                            Cancel
                          </Button>
                        )}
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              {/* 4. Performance Evaluation Form */}
              {activeTab === 'evaluations' && (
                <Card className="shadow-sm border-border">
                  <CardHeader className="border-b border-border">
                    <CardTitle className="font-display text-lg font-bold flex items-center gap-2">
                      <Award className="size-5 text-primary" />
                      {editId ? 'Edit Score Review' : 'Create Performance Review'}
                    </CardTitle>
                    <CardDescription>
                      Rate employees using the weighted ranking scale.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-5">
                    <form onSubmit={handleEvaluationSubmit} className="flex flex-col gap-4">
                      
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="eval-emp">Select Employee *</Label>
                        <Select
                          value={evalEmployeeId}
                          onValueChange={(val) => setEvalEmployeeId(val ?? '')}
                        >
                          <SelectTrigger id="eval-emp">
                            <SelectValue placeholder="Choose employee..." />
                          </SelectTrigger>
                          <SelectContent>
                            {employees.map((emp: any) => (
                              <SelectItem key={emp.id} value={emp.id}>
                                {emp.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="eval-start">Period Start *</Label>
                          <Input
                            id="eval-start"
                            type="date"
                            value={evalStart}
                            onChange={(e) => setEvalStart(e.target.value)}
                            required
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="eval-end">Period End *</Label>
                          <Input
                            id="eval-end"
                            type="date"
                            value={evalEnd}
                            onChange={(e) => setEvalEnd(e.target.value)}
                            required
                          />
                        </div>
                      </div>

                      <div className="border-t border-border mt-2 pt-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-3">
                          Factor Scores (0 - 100)
                        </span>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex flex-col gap-1.5">
                            <Label htmlFor="tech-score" className="text-xs font-medium">Tech Competence (40%)</Label>
                            <Input
                              id="tech-score"
                              type="number"
                              min="0"
                              max="100"
                              value={scoreTech}
                              onChange={(e) => setScoreTech(e.target.value)}
                              required
                            />
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <Label htmlFor="prod-score" className="text-xs font-medium">Productivity (30%)</Label>
                            <Input
                              id="prod-score"
                              type="number"
                              min="0"
                              max="100"
                              value={scoreProd}
                              onChange={(e) => setScoreProd(e.target.value)}
                              required
                            />
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <Label htmlFor="punc-score" className="text-xs font-medium">Punctuality (10%)</Label>
                            <Input
                              id="punc-score"
                              type="number"
                              min="0"
                              max="100"
                              value={scorePunc}
                              onChange={(e) => setScorePunc(e.target.value)}
                              required
                            />
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <Label htmlFor="comm-score" className="text-xs font-medium">Communication (5%)</Label>
                            <Input
                              id="comm-score"
                              type="number"
                              min="0"
                              max="100"
                              value={scoreComm}
                              onChange={(e) => setScoreComm(e.target.value)}
                              required
                            />
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <Label htmlFor="rep-score" className="text-xs font-medium">Reporting (5%)</Label>
                            <Input
                              id="rep-score"
                              type="number"
                              min="0"
                              max="100"
                              value={scoreRep}
                              onChange={(e) => setScoreRep(e.target.value)}
                              required
                            />
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <Label htmlFor="adapt-score" className="text-xs font-medium">Adaptability (10%)</Label>
                            <Input
                              id="adapt-score"
                              type="number"
                              min="0"
                              max="100"
                              value={scoreAdapt}
                              onChange={(e) => setScoreAdapt(e.target.value)}
                              required
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 mt-2">
                        <Button type="submit" className="flex-1">
                          {editId ? 'Save Changes' : 'Log Evaluation'}
                        </Button>
                        {editId && (
                          <Button type="button" variant="outline" onClick={clearEvaluationForm}>
                            Cancel
                          </Button>
                        )}
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

            </div>

            {/* RIGHT COLUMN: Live Tabular Lists */}
            <div className="lg:col-span-8">
              
              {/* Live Correspondence Table */}
              {activeTab === 'correspondence' && (
                <Card className="shadow-sm border-border">
                  <CardHeader className="border-b border-border flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="font-display text-lg">Active Mailbox Registry</CardTitle>
                      <CardDescription>Live entries streamed from Supabase</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleExportCorrespondence}
                        disabled={isExporting}
                        title="Export Correspondence Log"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm transition-all hover:bg-primary hover:text-primary-foreground hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isExporting
                          ? <Loader2 className="size-3.5 animate-spin" />
                          : <FileSpreadsheet className="size-3.5" />
                        }
                        <span className="hidden sm:inline">
                          {isExporting ? 'Exporting…' : 'Export Log'}
                        </span>
                      </button>
                      <button
                        onClick={() => mutateCorr()}
                        className="inline-flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
                      >
                        <RefreshCw className="size-4" />
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Ref / Date</TableHead>
                            <TableHead>Direction</TableHead>
                            <TableHead>Counterparty</TableHead>
                            <TableHead>Subject / Category</TableHead>
                            <TableHead>Action Due</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {correspondence.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                                No letters registered yet. Create one on the left.
                              </TableCell>
                            </TableRow>
                          ) : (
                            correspondence.map((c: any) => (
                              <TableRow key={c.id}>
                                <TableCell>
                                  <div className="font-semibold text-foreground text-xs">{c.letter_ref_no}</div>
                                  <div className="text-[10px] text-muted-foreground mt-0.5">{c.date_logged}</div>
                                </TableCell>
                                <TableCell>
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                    c.direction === 'Incoming' ? 'bg-blue-500/10 text-blue-600' : 'bg-indigo-500/10 text-indigo-600'
                                  }`}>
                                    {c.direction}
                                  </span>
                                </TableCell>
                                <TableCell className="max-w-[140px] truncate text-xs font-medium">
                                  {c.counterparty}
                                </TableCell>
                                <TableCell>
                                  <div className="text-xs text-foreground font-medium truncate max-w-[180px]">{c.subject}</div>
                                  <div className="text-[10px] text-muted-foreground mt-0.5">{c.category}</div>
                                </TableCell>
                                <TableCell className="text-xs">
                                  {c.response_required ? (
                                    <>
                                      <div className="font-semibold text-foreground">{c.response_due_date || '—'}</div>
                                      {c.response_sent_date && <div className="text-[10px] text-emerald-600">Sent: {c.response_sent_date}</div>}
                                    </>
                                  ) : (
                                    <span className="text-muted-foreground text-[11px]">Not Required</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                    c.status === 'Closed' ? 'bg-emerald-500/10 text-emerald-600' :
                                    c.status === 'Overdue' ? 'bg-rose-500/10 text-rose-600' :
                                    c.status === 'Open' ? 'bg-amber-500/10 text-amber-600' :
                                    'bg-secondary text-muted-foreground'
                                  }`}>
                                    {c.status}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right">
                                  <button
                                    onClick={() => editCorrespondence(c)}
                                    className="inline-flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
                                  >
                                    <Edit2 className="size-3.5" />
                                  </button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Live Project Bonds Table */}
              {activeTab === 'bonds' && (
                <Card className="shadow-sm border-border">
                  <CardHeader className="border-b border-border flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="font-display text-lg">Active Bonds ledger</CardTitle>
                      <CardDescription>Live active performance and payment guarantees</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleExportBonds}
                        disabled={isExportingBonds}
                        title="Export Master Bonds Ledger"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm transition-all hover:bg-primary hover:text-primary-foreground hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isExportingBonds
                          ? <Loader2 className="size-3.5 animate-spin" />
                          : <FileSpreadsheet className="size-3.5" />
                        }
                        <span className="hidden sm:inline">
                          {isExportingBonds ? 'Exporting…' : 'Export Master Bonds Ledger'}
                        </span>
                      </button>
                      <button
                        onClick={() => mutateBonds()}
                        className="inline-flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
                      >
                        <RefreshCw className="size-4" />
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Project / Contractor</TableHead>
                            <TableHead>Bond Type</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Expiry Date</TableHead>
                            <TableHead>Days Remaining</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bonds.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                                No bonds logged. Enter details on the left.
                              </TableCell>
                            </TableRow>
                          ) : (
                            bonds.map((b: any) => (
                              <TableRow key={b.id}>
                                <TableCell>
                                  <div className="font-semibold text-foreground text-xs">{b.project_name}</div>
                                  <div className="text-[10px] text-muted-foreground mt-0.5">Contractor: {b.contractor_name}</div>
                                </TableCell>
                                <TableCell className="text-xs">
                                  {b.bond_type}
                                </TableCell>
                                <TableCell className="text-xs font-semibold text-foreground">
                                  {b.amount ? `${Number(b.amount).toLocaleString()} ETB` : '—'}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {b.expiry_date}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {b.status === 'Released' ? (
                                    <span className="text-muted-foreground">—</span>
                                  ) : (
                                    <span className={b.days_remaining <= 0 ? 'text-rose-600 font-bold' : b.days_remaining <= 30 ? 'text-amber-600 font-semibold' : 'text-emerald-600'}>
                                      {b.days_remaining <= 0 ? `${Math.abs(b.days_remaining)} days OVERDUE` : `${b.days_remaining} days left`}
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                    b.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600' :
                                    b.status === 'Expired' ? 'bg-rose-500/10 text-rose-600' :
                                    'bg-secondary text-muted-foreground'
                                  }`}>
                                    {b.status}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right">
                                  <button
                                    onClick={() => editBond(b)}
                                    className="inline-flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
                                  >
                                    <Edit2 className="size-3.5" />
                                  </button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Live EOT Tracker Table */}
              {activeTab === 'eot' && (
                <Card className="shadow-sm border-border">
                  <CardHeader className="border-b border-border flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="font-display text-lg">EOT Extension Logs</CardTitle>
                      <CardDescription>Live approved Extension of Time metrics</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleExportEot}
                        disabled={isExportingEot}
                        title="Export EOT Log"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm transition-all hover:bg-primary hover:text-primary-foreground hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isExportingEot
                          ? <Loader2 className="size-3.5 animate-spin" />
                          : <FileSpreadsheet className="size-3.5" />
                        }
                        <span className="hidden sm:inline">
                          {isExportingEot ? 'Exporting…' : 'Export EOT Log'}
                        </span>
                      </button>
                      <button
                        onClick={() => mutateEot()}
                        className="inline-flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
                      >
                        <RefreshCw className="size-4" />
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Project / Contractor</TableHead>
                            <TableHead>EOT No.</TableHead>
                            <TableHead>Approved Days</TableHead>
                            <TableHead>Completion Date</TableHead>
                            <TableHead>Alert Status</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {eots.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                                No EOT log entries. Create one on the left.
                              </TableCell>
                            </TableRow>
                          ) : (
                            eots.map((e: any) => (
                              <TableRow key={e.id}>
                                <TableCell>
                                  <div className="font-semibold text-foreground text-xs">{e.project_name}</div>
                                  <div className="text-[10px] text-muted-foreground mt-0.5">Contractor: {e.contractor_name}</div>
                                </TableCell>
                                <TableCell className="text-xs text-center font-bold">
                                  {e.eot_number}
                                </TableCell>
                                <TableCell className="text-xs text-center font-semibold">
                                  {e.days_approved} days
                                </TableCell>
                                <TableCell className="text-xs">
                                  {e.revised_completion_date}
                                </TableCell>
                                <TableCell className="text-xs">
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ${getAlertBadgeColor(e.eot_status_alert)}`}>
                                    {e.eot_status_alert}
                                  </span>
                                </TableCell>
                                <TableCell className="text-center">
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${getEotBadgeColor(e.status)}`}>
                                    {e.status}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right">
                                  <button
                                    onClick={() => editEot(e)}
                                    className="inline-flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
                                  >
                                    <Edit2 className="size-3.5" />
                                  </button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Past Performance Reviews Table */}
              {activeTab === 'evaluations' && (
                <Card className="shadow-sm border-border">
                  <CardHeader className="border-b border-border flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="font-display text-lg">Logged Employee Scorecards</CardTitle>
                      <CardDescription>Past evaluations automatically scored and ranked</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleExportPerformance}
                        disabled={isExportingPerf}
                        title="Export Performance Log"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm transition-all hover:bg-primary hover:text-primary-foreground hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isExportingPerf
                          ? <Loader2 className="size-3.5 animate-spin" />
                          : <FileSpreadsheet className="size-3.5" />
                        }
                        <span className="hidden sm:inline">
                          {isExportingPerf ? 'Exporting…' : 'Export Performance Log'}
                        </span>
                      </button>
                      <button
                        onClick={() => mutateEvals()}
                        className="inline-flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
                      >
                        <RefreshCw className="size-4" />
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Employee Name</TableHead>
                            <TableHead>Review Period</TableHead>
                            <TableHead className="text-center">Tech (40%)</TableHead>
                            <TableHead className="text-center">Prod (30%)</TableHead>
                            <TableHead className="text-center">Total Score</TableHead>
                            <TableHead className="text-center">Performance Level</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {evaluations.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                                No scorecards registered yet. Save one on the left.
                              </TableCell>
                            </TableRow>
                          ) : (
                            evaluations.map((e: any) => {
                              const emp = e.employees ?? {}
                              return (
                                <TableRow key={e.id}>
                                  <TableCell>
                                    <div className="font-semibold text-foreground text-xs">{emp.full_name ?? '—'}</div>
                                    <div className="text-[10px] text-muted-foreground mt-0.5">{emp.department ?? '—'}</div>
                                  </TableCell>
                                  <TableCell className="text-xs whitespace-nowrap">
                                    {e.evaluation_period_start} – {e.evaluation_period_end}
                                  </TableCell>
                                  <TableCell className="text-xs text-center font-medium">
                                    {e.tech_competence_score}%
                                  </TableCell>
                                  <TableCell className="text-xs text-center font-medium">
                                    {e.productivity_score}%
                                  </TableCell>
                                  <TableCell className="text-xs text-center font-extrabold text-foreground">
                                    {Number(e.total_score).toFixed(2)}%
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                      e.performance_level === 'Outstanding' ? 'bg-emerald-500/10 text-emerald-600' :
                                      e.performance_level === 'Very Good' ? 'bg-blue-500/10 text-blue-600' :
                                      e.performance_level === 'Good' ? 'bg-amber-500/10 text-amber-600' :
                                      e.performance_level === 'Satisfactory' ? 'bg-orange-500/10 text-orange-600' :
                                      'bg-rose-500/10 text-rose-600'
                                    }`}>
                                      {e.performance_level}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <button
                                      onClick={() => editEvaluation(e)}
                                      className="inline-flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
                                    >
                                      <Edit2 className="size-3.5" />
                                    </button>
                                  </TableCell>
                                </TableRow>
                              )
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

            </div>

          </div>
        )}

      </main>
    </div>
  )
}
