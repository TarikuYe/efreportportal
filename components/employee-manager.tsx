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
  const [saving, setSaving] = useState(false)

  // ── Expanded project assignment per employee ──
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [togglingAssign, setTogglingAssign] = useState<string | null>(null)

  // ── Busy (activate/deactivate) per row ──
  const [busyId, setBusyId] = useState<string | null>(null)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: newName, email: newEmail, department: newDept }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to create employee.')
      setTempPassword({ name: json.employee.full_name, email: json.employee.email, password: json.temp_password })
      setNewName('')
      setNewEmail('')
      setNewDept('')
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
        body: JSON.stringify({ id, full_name: editName, department: editDept }),
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

  return (
    <div className="flex flex-col gap-6">
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
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-bold text-foreground">Manage employees</h3>
          <p className="text-sm text-muted-foreground">
            Create accounts, assign projects, and control access for all team members.
          </p>
        </div>
        <Button
          onClick={() => setShowAdd((v) => !v)}
          variant={showAdd ? 'outline' : 'default'}
          className="shrink-0"
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
              className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
            >
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Full name *</label>
                <Input
                  id="new-emp-name"
                  placeholder="Jane Doe"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-44"
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
                  className="w-52"
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
                  className="w-44"
                />
              </div>
              <Button type="submit" disabled={adding} className="shrink-0">
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Assigned projects</TableHead>
                  <TableHead className="w-24 text-center">Status</TableHead>
                  <TableHead className="w-48 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                      Loading employees…
                    </TableCell>
                  </TableRow>
                ) : employees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                      No employees yet. Click &quot;Add employee&quot; to create the first account.
                    </TableCell>
                  </TableRow>
                ) : (
                  employees.map((emp) => {
                    const isExpanded = expandedId === emp.id
                    const assignedCodes = assignmentMap.get(emp.id) ?? new Set<string>()

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
                                  {/* Edit name/dept */}
                                  <button
                                    onClick={() => {
                                      setEditingId(emp.id)
                                      setEditName(emp.full_name)
                                      setEditDept(emp.department ?? '')
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
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* ── Inline project assignment panel ── */}
                        {isExpanded && (
                          <TableRow className="bg-secondary/30">
                            <TableCell colSpan={5} className="py-4 pl-6">
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
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
