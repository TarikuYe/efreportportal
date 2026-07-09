import { STATUS_LABELS, type SubmissionStatus } from '@/lib/reports'

const styles: Record<SubmissionStatus, string> = {
  submitted: 'bg-chart-3/12 text-chart-3 border-chart-3/25',
  under_review: 'bg-accent/15 text-accent-foreground border-accent/30',
  approved: 'bg-chart-4/15 text-chart-4 border-chart-4/30',
  revisions: 'bg-destructive/10 text-destructive border-destructive/25',
}

export function StatusBadge({ status }: { status: SubmissionStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
