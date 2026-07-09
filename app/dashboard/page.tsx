import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SiteHeader } from '@/components/site-header'
import { EmployeeWorkspace } from '@/components/employee-workspace'

export const metadata = {
  title: 'Workspace — EF Architect & Engineering',
}

export const dynamic = 'force-dynamic'

async function getOrCreateEmployee(userId: string, email: string, fullName: string) {
  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('employees')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (existing) return existing

  const dgmEmail = process.env.DGM_EMAIL?.toLowerCase() ?? 'dgm@efae.com'
  const isDGM = email.toLowerCase() === dgmEmail
  
  const { data: newEmp, error: createError } = await admin
    .from('employees')
    .insert({
      id: userId,
      full_name: fullName || email.split('@')[0],
      email: email,
      role: isDGM ? 'dgm' : 'engineer',
      department: 'Procurement and Contract Administration'
    })
    .select()
    .single()

  if (createError) {
    throw new Error('Failed to auto-provision employee: ' + createError.message)
  }
  return newEmp
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !user.email) {
    redirect('/auth/signin')
  }

  const employee = await getOrCreateEmployee(
    user.id,
    user.email,
    user.user_metadata?.full_name ?? ''
  )

  // Redirect based on role
  if (employee.role === 'dgm') {
    redirect('/dashboard/admin/analytics')
  } else if (employee.role === 'admin') {
    redirect('/dashboard/registrar')
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <EmployeeWorkspace
          userId={user.id}
          userEmail={user.email}
          userName={employee.full_name}
          userDepartment={employee.department}
          userRole={employee.role}
        />
      </main>
      <footer className="border-t border-border bg-secondary/40">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} EF Architect &amp; Engineering. All rights reserved.</p>
          <p>EF Management Portal — Direct Entry Mode</p>
        </div>
      </footer>
    </div>
  )
}
