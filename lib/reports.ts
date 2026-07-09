export type SubmissionStatus = 'submitted' | 'under_review' | 'approved' | 'revisions'

export interface Project {
  id: string
  code: string
  name: string
  active: boolean
  created_at: string
}

export interface ReportSubmission {
  id: string
  employee_name: string
  employee_email: string
  project_code: string
  reporting_period: string
  file_name: string
  file_path: string
  file_size: number
  file_type: string | null
  status: SubmissionStatus
  submitted_at: string
}

export const PROJECTS = [
  { code: 'EF-2401', name: 'Harborview Mixed-Use Tower' },
  { code: 'EF-2402', name: 'Meridian Civic Center' },
  { code: 'EF-2403', name: 'Northgate Transit Hub' },
  { code: 'EF-2404', name: 'Riverside Residential Phase II' },
  { code: 'EF-2405', name: 'Summit Medical Pavilion' },
  { code: 'EF-2406', name: 'Lakeshore Bridge Retrofit' },
]

export const MAX_FILE_BYTES = 25 * 1024 * 1024 // 25 MB

export const ACCEPTED_EXTENSIONS = [
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.dwg',
  '.rvt',
  '.zip',
  '.png',
  '.jpg',
  '.jpeg',
]

export const STATUS_LABELS: Record<SubmissionStatus, string> = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  revisions: 'Revisions Requested',
}

/**
 * Builds a list of reporting periods (current month + previous 5 months),
 * e.g. "2026-07" labelled "July 2026".
 */
export function getReportingPeriods(count = 6) {
  const periods: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    periods.push({ value, label })
  }
  return periods
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
