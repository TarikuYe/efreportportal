'use client'

import { useRef, useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { UploadCloud, FileCheck2, Loader2, X, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  PROJECTS as FALLBACK_PROJECTS,
  getReportingPeriods,
  ACCEPTED_EXTENSIONS,
  MAX_FILE_BYTES,
  formatBytes,
  type Project,
} from '@/lib/reports'

const fetcher = (url: string) => fetch(url).then((r) => r.json())
const periods = getReportingPeriods()

export function SubmissionForm({
  defaultName = '',
  defaultEmail = '',
  onSuccess,
}: {
  defaultName?: string
  defaultEmail?: string
  onSuccess?: () => void
}) {
  const { data: projectsData } = useSWR<{ projects: Project[] }>('/api/projects?mine=1', fetcher)
  const projects = projectsData?.projects ?? FALLBACK_PROJECTS

  const [name, setName] = useState(defaultName)
  const [email, setEmail] = useState(defaultEmail)
  const [project, setProject] = useState('')
  const [period, setPeriod] = useState(periods[0]?.value ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function pickFile(f: File | null) {
    if (!f) return
    if (f.size > MAX_FILE_BYTES) {
      toast.error('File too large', { description: 'Maximum file size is 25 MB.' })
      return
    }
    setFile(f)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !email || !project || !period) {
      toast.error('Please complete all fields.')
      return
    }
    if (!file) {
      toast.error('Please attach your report file.')
      return
    }

    setSubmitting(true)
    const fd = new FormData()
    fd.append('employee_name', name)
    fd.append('employee_email', email)
    fd.append('project_code', project)
    fd.append('reporting_period', period)
    fd.append('file', file)

    try {
      const res = await fetch('/api/submit', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Submission failed.')

      setDone(true)
      toast.success('Report submitted', {
        description: 'Your report was received successfully.',
      })
      onSuccess?.()
    } catch (err) {
      toast.error('Submission failed', {
        description: err instanceof Error ? err.message : 'Please try again.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  function reset() {
    setName(defaultName)
    setEmail(defaultEmail)
    setProject('')
    setPeriod(periods[0]?.value ?? '')
    setFile(null)
    setDone(false)
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-chart-4/15 text-chart-4">
          <CheckCircle2 className="size-8" />
        </span>
        <div>
          <h3 className="font-display text-xl font-bold text-foreground">Report submitted</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Thank you. Your submission has been logged and the review team has been notified.
          </p>
        </div>
        <Button variant="outline" onClick={reset}>
          Submit another report
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
            autoComplete="name"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your.email@gmail.com"
            autoComplete="email"
            required
            className="bg-muted/50"
            readOnly
          />
          <p className="text-xs text-muted-foreground">Uses your verified account email</p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="project">Project</Label>
          <Select value={project} onValueChange={(v) => setProject(v ?? '')}>
            <SelectTrigger id="project">
              <SelectValue placeholder={projectsData ? 'Select a project' : 'Loading projects…'} />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.code} value={p.code}>
                  {p.code} — {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="period">Reporting period</Label>
          <Select value={period} onValueChange={(v) => setPeriod(v ?? '')}>
            <SelectTrigger id="period">
              <SelectValue placeholder="Select a period" />
            </SelectTrigger>
            <SelectContent>
              {periods.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Report file</Label>
        {file ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/60 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <FileCheck2 className="size-5 shrink-0 text-chart-4" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFile(null)}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
              aria-label="Remove file"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              pickFile(e.dataTransfer.files?.[0] ?? null)
            }}
            className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
              dragging
                ? 'border-accent bg-accent/5'
                : 'border-border bg-secondary/40 hover:border-accent/60'
            }`}
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-background text-accent">
              <UploadCloud className="size-6" />
            </span>
            <span className="text-sm font-medium text-foreground">
              Drag &amp; drop or click to upload
            </span>
            <span className="text-xs text-muted-foreground">
              PDF, DOCX, XLSX, DWG, RVT, ZIP up to 25 MB
            </span>
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={ACCEPTED_EXTENSIONS.join(',')}
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />
      </div>

      <Button type="submit" size="lg" disabled={submitting} className="mt-1 w-full sm:w-auto">
        {submitting ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Submitting…
          </>
        ) : (
          'Submit report'
        )}
      </Button>
    </form>
  )
}
