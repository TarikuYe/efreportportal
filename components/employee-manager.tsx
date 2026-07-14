'use client'

import React, { useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import {
  Plus,
  Pencil,
  Check,
  X,
  Loader2,
  Users,
  Copy,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  UserCheck,
  UserX,
  KeyRound,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

interface Assignment { project_code: string }
interface ProjectRow { code: string; name: string; active: boolean }
interface Employee {
  id: string
  full_name: string
  email: string
  department: string | null
  role: string
  active?: boolean   // optional – column may not exist in older DB schemas
  created_at: string
  employee_project_assignments?: Assignment[]
}

export function EmployeeManager() {
  const { data: empData, isLoading, mutate } = useSWR<{ employees: Employee[] }>(
    '/api/employees',
    fetcher,
  )
  const { data: projData } = useSWR<{ projects: ProjectRow[] }>('/api/projects?all=1', fetcher)
  const { data: assignData, mutate: mutateAssign } = useSWR<{ assignments: { employee_id: string; project_code: string }[] }>(
    '/api/employees/assignments',
    fetcher,
  )

  const employees = empData?.employees ?? []
  const allProjects = projData?.projects ?? []

  // Build a lookup: employee_id → Set<project_code>
  const assignmentMap = React.useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const a of (assignData?.assignments ?? [])) {
      if (!map.has(a.employee_id)) map.set(a.employee_id, new Set())
      map.get(a.employee_id)!.add(a.project_code)
    }
    return map
  }, [assignData])

  // ── Add form ──
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newDept, setNewDept] = useState('')
  const [newRole, setNewRole] = useState('')
  const [adding, setAdding] = useState(false)

  // ── One-time password modal ──
  const [tempPassword, setTempPassword] = useState<{
    name: string; email: string; password: string
  } | null>(null)
  const [copied, setCopied] = useState(false)

  // ── Edit state ──
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDept, setEditDept] = useState('')
  const [editRole, setEditRole] = useState('')
  const [saving, setSaving] = useState(false)

  // ── Expanded project assignment per employee ──
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [togglingAssign, setTogglingAssign] = useState<string | null>(null)

  // ── Busy (activate/deactivate) per row ──
  const [busyId, setBusyId] = useState<string | null>(null)

  // ── Delete confirmation ──
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: newName, email: newEmail, department: newDept, role: newRole }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to create employee.')
      setTempPassword({ name: json.employee.full_name, email: json.employee.email, password: json.temp_password })
      setNewName('')
      setNewEmail('')
      setNewDept('')
      setNewRole('')
      setShowAdd(false)
      mutate()
    } catch (err) {
      toast.error('Failed to create employee', {
        description: err instanceof Error ? err.message : 'Please try again.',
      })
    } finally {
      setAdding(false)
    }
  }

  async function handleSaveEdit(id: string) {
    setSaving(true)
    try {
      const res = await fetch('/api/employees', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, full_name: editName, department: editDept, role: editRole }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Update failed.')
      toast.success('Employee updated')
      setEditingId(null)
      mutate()
    } catch (err) {
      toast.error('Update failed', {
        description: err instanceof Error ? err.message : 'Please try again.',
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(emp: Employee) {
    setBusyId(emp.id)
    try {
      const res = await fetch('/api/employees', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: emp.id, active: !emp.active }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed.')
      toast.success(emp.active ? 'Employee deactivated' : 'Employee reactivated', {
        description: emp.email,
      })
      mutate()
    } catch (err) {
      toast.error('Failed to update employee', {
        description: err instanceof Error ? err.message : 'Please try again.',
      })
    } finally {
      setBusyId(null)
    }
  }

  async function handleToggleAssignment(emp: Employee, projectCode: string) {
    const key = `${emp.id}-${projectCode}`
    setTogglingAssign(key)
    const isAssigned = (assignmentMap.get(emp.id) ?? new Set()).has(projectCode)
    try {
      const res = await fetch('/api/employees/assignments', {
        method: isAssigned ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: emp.id, project_code: projectCode }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed.')
      mutateAssign()
    } catch (err) {
      toast.error('Assignment update failed', {
        description: err instanceof Error ? err.message : 'Please try again.',
      })
    } finally {
      setTogglingAssign(null)
    }
  }

  async function handleCopy(text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch('/api/employees', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteTarget.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to delete employee.')
      toast.success('Employee permanently deleted', { description: deleteTarget.email })
      setDeleteTarget(null)
      mutate()
    } catch (err) {
      toast.error('Delete failed', {
        description: err instanceof Error ? err.message : 'Please try again.',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Delete confirmation dialog ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-destructive/30 bg-card p-6 shadow-xl">
            <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="size-6" />
            </div>
            <h3 className="font-display text-lg font-bold text-foreground">Delete employee?</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              You are about to permanently delete the account for{' '}
              <strong className="text-foreground">{deleteTarget.full_name}</strong>.
            </p>
            <div className="mt-3 rounded-lg border border-border bg-secondary/40 px-4 py-3 text-sm">
              <div className="font-medium text-foreground">{deleteTarget.full_name}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{deleteTarget.email}</div>
              {deleteTarget.department && (
                <div className="mt-0.5 text-xs text-muted-foreground">{deleteTarget.department}</div>
              )}
            </div>
            <div className="mt-3 rounded-lg bg-destructive/8 px-3 py-2.5 text-xs text-destructive">
              <strong>This action cannot be undone.</strong> Their account, login access, and all project
              assignments will be permanently removed.
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="sm:w-auto"
              >
                Cancel, keep employee
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
                className="sm:w-auto"
              >
                {deleting ? (
                  <><Loader2 className="size-4 animate-spin" /> Deleting…</>
                ) : (
                  <><Trash2 className="size-4" /> Yes, delete permanently</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── One-time password modal ── */}
      {tempPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-chart-4/15 text-chart-4">
              <KeyRound className="size-6" />
            </div>
            <h3 className="font-display text-lg font-bold text-foreground">Account created!</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Share this one-time password with{' '}
              <strong className="text-foreground">{tempPassword.name}</strong> ({tempPassword.email}).
              It won&apos;t be shown again.
            </p>

            <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-secondary/60 px-4 py-3">
              <code className="flex-1 select-all font-mono text-base font-semibold tracking-wider text-foreground">
                {tempPassword.password}
              </code>
              <button
                onClick={() => handleCopy(tempPassword.password)}
                className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                aria-label="Copy password"
              >
                {copied ? <CheckCheck className="size-4 text-chart-4" /> : <Copy className="size-4" />}
              </button>
            </div>

            <div className="mt-2 rounded-lg bg-accent/10 px-3 py-2 text-xs text-accent">
              The employee should change this password after their first login.
            </div>

            <Button
              className="mt-5 w-full"
              onClick={() => { setTempPassword(null); setCopied(false) }}
            >
              Done — I&apos;ve saved the password
            </Button>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-display text-lg font-bold text-foreground">Manage employees</h3>
          <p className="text-sm text-muted-foreground">
            Create accounts, assign projects, and control access for all team members.
          </p>
        </div>
        <Button
          onClick={() => setShowAdd((v) => !v)}
          variant={showAdd ? 'outline' : 'default'}
          className="shrink-0 self-start sm:self-auto"
        >
          {showAdd ? (
            <><X className="size-4" /> Cancel</>
          ) : (
            <><Plus className="size-4" /> Add employee</>
          )}
        </Button>
      </div>

      {/* ── Add employee form ── */}
      {showAdd && (
        <Card className="border-accent/30 bg-accent/5">
          <CardContent className="pt-5">
            <form
              onSubmit={handleAdd}
              className="flex flex-col gap-3"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Full name *</label>
                  <Input
                    id="new-emp-name"
                    placeholder="Jane Doe"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Work email *</label>
                  <Input
                    id="new-emp-email"
                    type="email"
                    placeholder="jane@efae.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Department</label>
                  <Input
                    id="new-emp-dept"
                    placeholder="e.g. Architecture"
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Role</label>
                  <Input
                    id="new-emp-role"
                    placeholder="e.g. Engineer"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                  />
                </div>
              </div>
              <Button type="submit" disabled={adding} className="sm:self-start">
                {adding ? (
                  <><Loader2 className="size-4 animate-spin" /> Creating…</>
                ) : (
                  <><Check className="size-4" /> Create account</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── Employees table ── */}
      <Card>
        <CardHeader className="border-b border-border">
          <CardTitle className="font-display">
            <span className="flex items-center gap-2">
              <Users className="size-5 text-accent" />
              All employees
            </span>
          </CardTitle>
          <CardDescription>
            {employees.length} employee{employees.length !== 1 ? 's' : ''} ·{' '}
            {employees.filter((e) => e.active).length} active
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading employees…</div>
          ) : employees.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No employees yet. Click &quot;Add employee&quot; to create the first account.
            </div>
          ) : (
            <>
              {/* ── Mobile card list (hidden md+) ── */}
              <div className="flex flex-col divide-y divide-border md:hidden">
                {employees.map((emp) => {
                  const isExpanded = expandedId === emp.id
                  const assignedCodes = assignmentMap.get(emp.id) ?? new Set<string>()
                  const roleBadgeClass =
                    emp.role === 'dgm' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : emp.role === 'admin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                    : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                  return (
                    <div key={emp.id} className={`p-4 ${!emp.active ? 'opacity-50' : ''}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          {editingId === emp.id ? (
                            <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 text-sm mb-1" autoFocus />
                          ) : (
                            <div className="font-medium text-foreground truncate">{emp.full_name}</div>
                          )}
                          <div className="text-xs text-muted-foreground truncate">{emp.email}</div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${roleBadgeClass}`}>{emp.role}</span>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${emp.active ? 'bg-chart-4/15 text-chart-4' : 'bg-secondary text-muted-foreground'}`}>{emp.active ? 'Active' : 'Inactive'}</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {editingId === emp.id ? (
                            <>
                              <button onClick={() => handleSaveEdit(emp.id)} disabled={saving} className="inline-flex size-8 items-center justify-center rounded-md bg-accent text-accent-foreground hover:opacity-90 disabled:opacity-50" aria-label="Save">
                                {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                              </button>
                              <button onClick={() => setEditingId(null)} className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Cancel"><X className="size-3.5" /></button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => { setEditingId(emp.id); setEditName(emp.full_name); setEditDept(emp.department ?? ''); setEditRole(emp.role ?? 'engineer') }} className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" aria-label={`Edit ${emp.full_name}`}><Pencil className="size-3.5" /></button>
                              <button onClick={() => setExpandedId(isExpanded ? null : emp.id)} className={`inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs font-medium transition-colors ${isExpanded ? 'border-accent bg-accent/10 text-accent' : 'border-border text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
                                Projects{isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                              </button>
                              <button onClick={() => handleToggleActive(emp)} disabled={busyId === emp.id} className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50" aria-label={emp.active ? 'Deactivate' : 'Reactivate'}>
                                {busyId === emp.id ? <Loader2 className="size-3.5 animate-spin" /> : emp.active ? <UserX className="size-3.5" /> : <UserCheck className="size-3.5" />}
                              </button>
                              <button onClick={() => setDeleteTarget(emp)} className="inline-flex size-8 items-center justify-center rounded-md border border-destructive/40 text-destructive/70 transition-colors hover:bg-destructive hover:text-white" aria-label={`Delete ${emp.full_name}`} title="Permanently delete employee">
                                <Trash2 className="size-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {editingId === emp.id && (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <Input value={editDept} onChange={(e) => setEditDept(e.target.value)} className="h-8 text-sm" placeholder="Department" />
                          <Input value={editRole} onChange={(e) => setEditRole(e.target.value)} className="h-8 text-sm" placeholder="Role" />
                        </div>
                      )}
                      {editingId !== emp.id && (
                        <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {emp.department && <span>{emp.department}</span>}
                          {[...assignedCodes].map((code) => (
                            <span key={code} className="inline-flex items-center rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">{code}</span>
                          ))}
                        </div>
                      )}
                      {isExpanded && (
                        <div className="mt-3 rounded-lg bg-secondary/30 p-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Projects for {emp.full_name}</p>
                          <div className="flex flex-wrap gap-2">
                            {allProjects.map((project) => {
                              const isAssigned = assignedCodes.has(project.code)
                              const isToggling = togglingAssign === `${emp.id}-${project.code}`
                              return (
                                <button key={project.code} onClick={() => handleToggleAssignment(emp, project.code)} disabled={isToggling || !project.active}
                                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-50 ${isAssigned ? 'border-accent bg-accent/15 text-accent' : 'border-border bg-background text-muted-foreground hover:border-accent/50 hover:text-foreground'} ${!project.active ? 'line-through opacity-40' : ''}`}>
                                  {isToggling ? <Loader2 className="size-3 animate-spin" /> : isAssigned ? <Check className="size-3" /> : <Plus className="size-3" />}
                                  {project.code} — {project.name}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* ── Desktop table (hidden below md) ── */}
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Assigned projects</TableHead>
                      <TableHead className="w-24 text-center">Status</TableHead>
                      <TableHead className="w-48 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((emp) => {
                    const isExpanded = expandedId === emp.id
                    const assignedCodes = assignmentMap.get(emp.id) ?? new Set<string>()

                    const roleBadgeClass =
                      emp.role === 'dgm'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : emp.role === 'admin'
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'

                    // ⚠️ Must use React.Fragment (not <>) so we can pass a key prop
                    return (
                      <React.Fragment key={emp.id}>
                        <TableRow className={!emp.active ? 'opacity-50' : undefined}>
                          {/* Name / email */}
                          <TableCell>
                            {editingId === emp.id ? (
                              <Input
                                id={`edit-name-${emp.id}`}
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="h-8 text-sm"
                                autoFocus
                              />
                            ) : (
                              <>
                                <div className="font-medium text-foreground">{emp.full_name}</div>
                                <div className="text-xs text-muted-foreground">{emp.email}</div>
                              </>
                            )}
                          </TableCell>

                          {/* Department */}
                          <TableCell>
                            {editingId === emp.id ? (
                              <Input
                                id={`edit-dept-${emp.id}`}
                                value={editDept}
                                onChange={(e) => setEditDept(e.target.value)}
                                className="h-8 text-sm"
                                placeholder="Department"
                              />
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                {emp.department ?? '—'}
                              </span>
                            )}
                          </TableCell>

                          {/* Role */}
                          <TableCell>
                            {editingId === emp.id ? (
                              <Input
                                id={`edit-role-${emp.id}`}
                                value={editRole}
                                onChange={(e) => setEditRole(e.target.value)}
                                className="h-8 text-sm w-32"
                                placeholder="Role"
                              />
                            ) : (
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${roleBadgeClass}`}>
                                {emp.role}
                              </span>
                            )}
                          </TableCell>

                          {/* Assigned projects summary */}
                          <TableCell>
                            {assignedCodes.size === 0 ? (
                              <span className="text-xs text-muted-foreground">None assigned</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {[...assignedCodes].map((code) => (
                                  <span
                                    key={code}
                                    className="inline-flex items-center rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent"
                                  >
                                    {code}
                                  </span>
                                ))}
                              </div>
                            )}
                          </TableCell>

                          {/* Status badge */}
                          <TableCell className="text-center">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                emp.active
                                  ? 'bg-chart-4/15 text-chart-4'
                                  : 'bg-secondary text-muted-foreground'
                              }`}
                            >
                              {emp.active ? 'Active' : 'Inactive'}
                            </span>
                          </TableCell>

                          {/* Actions */}
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              {editingId === emp.id ? (
                                <>
                                  <button
                                    onClick={() => handleSaveEdit(emp.id)}
                                    disabled={saving}
                                    className="inline-flex size-8 items-center justify-center rounded-md bg-accent text-accent-foreground hover:opacity-90 disabled:opacity-50"
                                    aria-label="Save"
                                  >
                                    {saving
                                      ? <Loader2 className="size-3.5 animate-spin" />
                                      : <Check className="size-3.5" />}
                                  </button>
                                  <button
                                    onClick={() => setEditingId(null)}
                                    className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                                    aria-label="Cancel"
                                  >
                                    <X className="size-3.5" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  {/* Edit name/dept/role */}
                                  <button
                                    onClick={() => {
                                      setEditingId(emp.id)
                                      setEditName(emp.full_name)
                                      setEditDept(emp.department ?? '')
                                      setEditRole(emp.role ?? 'engineer')
                                    }}
                                    className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                                    aria-label={`Edit ${emp.full_name}`}
                                  >
                                    <Pencil className="size-3.5" />
                                  </button>

                                  {/* Project assignment toggle */}
                                  <button
                                    onClick={() => setExpandedId(isExpanded ? null : emp.id)}
                                    className={`inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs font-medium transition-colors ${
                                      isExpanded
                                        ? 'border-accent bg-accent/10 text-accent'
                                        : 'border-border text-muted-foreground hover:bg-secondary hover:text-foreground'
                                    }`}
                                    aria-label="Manage project assignments"
                                  >
                                    Projects
                                    {isExpanded
                                      ? <ChevronUp className="size-3" />
                                      : <ChevronDown className="size-3" />}
                                  </button>

                                  {/* Activate / deactivate */}
                                  <button
                                    onClick={() => handleToggleActive(emp)}
                                    disabled={busyId === emp.id}
                                    className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
                                    aria-label={emp.active ? 'Deactivate' : 'Reactivate'}
                                    title={emp.active ? 'Deactivate account' : 'Reactivate account'}
                                  >
                                    {busyId === emp.id
                                      ? <Loader2 className="size-3.5 animate-spin" />
                                      : emp.active
                                        ? <UserX className="size-3.5" />
                                        : <UserCheck className="size-3.5" />}
                                  </button>

                                  {/* Delete */}
                                  <button
                                    onClick={() => setDeleteTarget(emp)}
                                    className="inline-flex size-8 items-center justify-center rounded-md border border-destructive/40 text-destructive/70 transition-colors hover:bg-destructive hover:text-white"
                                    aria-label={`Delete ${emp.full_name}`}
                                    title="Permanently delete employee"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* ── Inline project assignment panel ── */}
                        {isExpanded && (
                          <TableRow className="bg-secondary/30">
                            <TableCell colSpan={6} className="py-4 pl-6">
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Project assignments for {emp.full_name}
                              </p>
                              {allProjects.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                  No projects yet. Create projects in the Projects tab first.
                                </p>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {allProjects.map((project) => {
                                    const isAssigned = assignedCodes.has(project.code)
                                    const toggleKey = `${emp.id}-${project.code}`
                                    const isToggling = togglingAssign === toggleKey

                                    return (
                                      <button
                                        key={project.code}
                                        onClick={() => handleToggleAssignment(emp, project.code)}
                                        disabled={isToggling || !project.active}
                                        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-50 ${
                                          isAssigned
                                            ? 'border-accent bg-accent/15 text-accent'
                                            : 'border-border bg-background text-muted-foreground hover:border-accent/50 hover:text-foreground'
                                        } ${!project.active ? 'line-through opacity-40' : ''}`}
                                        title={!project.active ? 'Archived project' : undefined}
                                      >
                                        {isToggling ? (
                                          <Loader2 className="size-3 animate-spin" />
                                        ) : isAssigned ? (
                                          <Check className="size-3" />
                                        ) : (
                                          <Plus className="size-3" />
                                        )}
                                        {project.code} — {project.name}
                                      </button>
                                    )
                                  })}
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    )
                  })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
