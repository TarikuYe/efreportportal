import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SiteHeader } from '@/components/site-header'
import { AssignedProjectsHub } from '@/components/assigned-projects-hub'

export const metadata = {
  title: 'My Assigned Projects — EF Architect & Engineering',
}

export const dynamic = 'force-dynamic'

export default async function EmployeeProjectsPage() {
  // ── Auth check ────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id || !user?.email) {
    redirect('/auth/signin')
  }

  const adminClient = createAdminClient()

  // ── Employee profile ──────────────────────────────────────────────────────
  const { data: employee } = await adminClient
    .from('employees')
    .select('id, full_name, department, role')
    .eq('id', user.id)
    .maybeSingle()

  if (!employee) {
    redirect('/auth/signin')
  }

  // DGM / admin → send to their own console
  if (employee.role === 'dgm' || employee.role === 'admin') {
    redirect('/dashboard/admin/projects')
  }

  // ── Assignments for this employee ─────────────────────────────────────────
  const { data: assignmentRows, error: assignErr } = await adminClient
    .from('employee_project_assignments')
    .select('project_code')
    .eq('employee_id', user.id)

  if (assignErr) {
    console.error('[employee/projects] assignment fetch error:', assignErr.message)
  }

  const assignedCodes = (assignmentRows ?? []).map(
    (a: { project_code: string }) => a.project_code,
  )

  // ── Resolve full project rows ─────────────────────────────────────────────
  // Use select('*') so this works even if the extended columns (client,
  // contractor, start_date, estimated_completion) don't yet exist in the
  // schema — any missing fields will simply be absent from the row object
  // and the UI renders '—' for them gracefully.
  let assignedProjects: {
    id: string
    code: string
    name: string
    active: boolean
    created_at: string
    client?: string | null
    contractor?: string | null
    start_date?: string | null
    estimated_completion?: string | null
  }[] = []

  if (assignedCodes.length > 0) {
    const { data: projectRows, error: projectErr } = await adminClient
      .from('projects')
      .select('*')
      .in('code', assignedCodes)
      .order('created_at', { ascending: true })

    if (projectErr) {
      console.error('[employee/projects] project fetch error:', projectErr.message)
    }

    assignedProjects = (projectRows ?? []).map((row: Record<string, unknown>) => ({
      id: String(row.id ?? ''),
      code: String(row.code ?? ''),
      name: String(row.name ?? ''),
      active: Boolean(row.active ?? true),
      created_at: String(row.created_at ?? new Date().toISOString()),
      client: (row.client as string | null) ?? null,
      contractor: (row.contractor as string | null) ?? null,
      start_date: (row.start_date as string | null) ?? null,
      estimated_completion: (row.estimated_completion as string | null) ?? null,
    }))
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <AssignedProjectsHub
          employee={employee}
          assignedProjects={assignedProjects}
        />
      </main>
      <footer className="border-t border-border bg-secondary/40">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} EF Architect &amp; Engineering. All rights reserved.</p>
          <p>My Assigned Projects — Read-Only Directory</p>
        </div>
      </footer>
    </div>
  )
}
