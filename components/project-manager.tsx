'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import {
  Plus,
  Pencil,
  Check,
  X,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Loader2,
  FolderOpen,
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
import type { Project } from '@/lib/reports'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function ProjectManager() {
  const { data, isLoading, mutate } = useSWR<{ projects: Project[] }>(
    '/api/projects',
    fetcher,
  )

  // ── Add form state ──
  const [showAdd, setShowAdd] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)

  // ── Edit state ──
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)

  // ── Loading state for archive/delete per row ──
  const [busyId, setBusyId] = useState<string | null>(null)

  const projects = data?.projects ?? []

  // ── Fetch all including inactive for the management table ──
  const { data: allData, mutate: mutateAll } = useSWR<{ projects: Project[] }>(
    '/api/projects?all=1',
    fetcher,
  )
  const allProjects = allData?.projects ?? projects

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: newCode, name: newName }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to create project.')
      toast.success('Project created', { description: `${json.project.code} — ${json.project.name}` })
      setNewCode('')
      setNewName('')
      setShowAdd(false)
      mutate()
      mutateAll()
    } catch (err) {
      toast.error('Failed to create project', {
        description: err instanceof Error ? err.message : 'Please try again.',
      })
    } finally {
      setAdding(false)
    }
  }

  async function handleSaveName(id: string) {
    if (!editName.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: editName }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to update.')
      toast.success('Project name updated')
      setEditingId(null)
      mutate()
      mutateAll()
    } catch (err) {
      toast.error('Update failed', {
        description: err instanceof Error ? err.message : 'Please try again.',
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(project: Project) {
    setBusyId(project.id)
    try {
      const res = await fetch('/api/projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: project.id, active: !project.active }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to update.')
      toast.success(project.active ? 'Project archived' : 'Project restored', {
        description: project.code,
      })
      mutate()
      mutateAll()
    } catch (err) {
      toast.error('Failed to update project', {
        description: err instanceof Error ? err.message : 'Please try again.',
      })
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(project: Project) {
    if (
      !window.confirm(
        `Permanently delete "${project.code} — ${project.name}"?\n\nThis will fail if any submissions reference this project.`,
      )
    )
      return

    setBusyId(project.id)
    try {
      const res = await fetch('/api/projects', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: project.id, code: project.code }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to delete.')
      toast.success('Project deleted', { description: project.code })
      mutate()
      mutateAll()
    } catch (err) {
      toast.error('Cannot delete project', {
        description: err instanceof Error ? err.message : 'Please try again.',
      })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-display text-lg font-bold text-foreground">Manage projects</h3>
          <p className="text-sm text-muted-foreground">
            Add, rename, or archive projects. Archived projects hide from new submissions but
            preserve historical data.
          </p>
        </div>
        <Button
          onClick={() => setShowAdd((v) => !v)}
          variant={showAdd ? 'outline' : 'default'}
          className="shrink-0 self-start sm:self-auto"
        >
          {showAdd ? (
            <>
              <X className="size-4" /> Cancel
            </>
          ) : (
            <>
              <Plus className="size-4" /> Add project
            </>
          )}
        </Button>
      </div>

      {/* Add project form */}
      {showAdd && (
        <Card className="border-accent/30 bg-accent/5">
          <CardContent className="pt-5">
            <form onSubmit={handleAdd} className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[9rem_1fr]">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Project code
                  </label>
                  <Input
                    id="new-project-code"
                    placeholder="EF-2407"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                    className="font-mono uppercase"
                    required
                    maxLength={20}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Project name</label>
                  <Input
                    id="new-project-name"
                    placeholder="e.g. Westside Office Complex"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required
                    maxLength={255}
                  />
                </div>
              </div>
              <Button type="submit" disabled={adding} className="w-full sm:w-auto sm:self-start">
                {adding ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Creating…
                  </>
                ) : (
                  <>
                    <Check className="size-4" /> Create
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Projects table */}
      <Card>
        <CardHeader className="border-b border-border">
          <CardTitle className="font-display">
            <span className="flex items-center gap-2">
              <FolderOpen className="size-5 text-accent" />
              All projects
            </span>
          </CardTitle>
          <CardDescription>
            {allProjects.length} project{allProjects.length !== 1 ? 's' : ''} total ·{' '}
            {allProjects.filter((p) => p.active).length} active
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-24 text-center">Status</TableHead>
                  <TableHead className="w-36 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-12 text-center text-muted-foreground">
                      Loading projects…
                    </TableCell>
                  </TableRow>
                ) : allProjects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-12 text-center text-muted-foreground">
                      No projects yet. Click &quot;Add project&quot; to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  allProjects.map((project) => (
                    <TableRow
                      key={project.id}
                      className={!project.active ? 'opacity-50' : undefined}
                    >
                      {/* Code */}
                      <TableCell className="font-mono text-sm font-semibold text-foreground">
                        {project.code}
                      </TableCell>

                      {/* Name — inline editable */}
                      <TableCell>
                        {editingId === project.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              id={`edit-name-${project.id}`}
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="h-8 text-sm"
                              autoFocus
                              maxLength={255}
                            />
                            <button
                              onClick={() => handleSaveName(project.id)}
                              disabled={saving}
                              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                              aria-label="Save"
                            >
                              {saving ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Check className="size-3.5" />
                              )}
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                              aria-label="Cancel edit"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-sm text-foreground">{project.name}</span>
                        )}
                      </TableCell>

                      {/* Status badge */}
                      <TableCell className="text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            project.active
                              ? 'bg-chart-4/15 text-chart-4'
                              : 'bg-secondary text-muted-foreground'
                          }`}
                        >
                          {project.active ? 'Active' : 'Archived'}
                        </span>
                      </TableCell>

                      {/* Actions */}
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {/* Edit name */}
                          {editingId !== project.id && (
                            <button
                              onClick={() => {
                                setEditingId(project.id)
                                setEditName(project.name)
                              }}
                              className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                              aria-label={`Edit ${project.code}`}
                            >
                              <Pencil className="size-3.5" />
                            </button>
                          )}

                          {/* Archive / restore toggle */}
                          <button
                            onClick={() => handleToggleActive(project)}
                            disabled={busyId === project.id}
                            className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
                            aria-label={project.active ? `Archive ${project.code}` : `Restore ${project.code}`}
                            title={project.active ? 'Archive project' : 'Restore project'}
                          >
                            {busyId === project.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : project.active ? (
                              <ToggleRight className="size-3.5" />
                            ) : (
                              <ToggleLeft className="size-3.5" />
                            )}
                          </button>

                          {/* Hard delete */}
                          <button
                            onClick={() => handleDelete(project)}
                            disabled={busyId === project.id}
                            className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                            aria-label={`Delete ${project.code}`}
                            title="Delete project (only if no submissions)"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
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
    </div>
  )
}
