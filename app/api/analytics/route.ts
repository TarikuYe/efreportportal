import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function checkAdminAccess(userId: string) {
  const admin = createAdminClient()
  const { data: employee } = await admin
    .from('employees')
    .select('role')
    .eq('id', userId)
    .maybeSingle()
  return employee?.role === 'dgm' || employee?.role === 'admin'
}

// GET /api/analytics
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const hasAccess = await checkAdminAccess(user.id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Admin or DGM access required.' }, { status: 403 })
    }

    const admin = createAdminClient()
    const todayStr = new Date().toISOString().split('T')[0]
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // 1. Letters metrics
    const { data: letters, error: lettersError } = await admin
      .from('correspondence_register')
      .select('response_required, response_due_date, response_sent_date, status')

    if (lettersError) {
      console.error('[analytics] letters fetch error:', lettersError.message)
      return NextResponse.json({ error: 'Failed to retrieve correspondence analytics.' }, { status: 500 })
    }

    let totalLetters = letters?.length ?? 0
    let overdueLetters = 0

    for (const letter of letters ?? []) {
      if (letter.response_required && !letter.response_sent_date) {
        if (letter.response_due_date && letter.response_due_date < todayStr) {
          overdueLetters++
        }
      }
    }

    // 2. Bonds metrics & Critical expired alerts
    const { data: bonds, error: bondsError } = await admin
      .from('project_bonds')
      .select('*')

    if (bondsError) {
      console.error('[analytics] bonds fetch error:', bondsError.message)
      return NextResponse.json({ error: 'Failed to retrieve bonds analytics.' }, { status: 500 })
    }

    let activeBonds = 0
    let expiredOrReleasedBonds = 0
    const criticalExpiredBonds = []

    for (const bond of bonds ?? []) {
      const expDate = new Date(bond.expiry_date)
      expDate.setHours(0, 0, 0, 0)
      
      const diffTime = expDate.getTime() - today.getTime()
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      if (bond.status === 'Released') {
        expiredOrReleasedBonds++
      } else if (daysRemaining <= 0) {
        expiredOrReleasedBonds++
        criticalExpiredBonds.push({
          ...bond,
          days_overdue: Math.abs(daysRemaining)
        })
      } else {
        activeBonds++
      }
    }

    // 3. EOT tracker & nearly expired alerts
    const { data: eots, error: eotsError } = await admin
      .from('eot_tracker')
      .select('*')

    if (eotsError) {
      console.error('[analytics] EOT fetch error:', eotsError.message)
      return NextResponse.json({ error: 'Failed to retrieve EOT analytics.' }, { status: 500 })
    }

    const nearlyExpiredEots = []
    for (const eot of eots ?? []) {
      const compDate = new Date(eot.revised_completion_date)
      compDate.setHours(0, 0, 0, 0)

      const diffTime = compDate.getTime() - today.getTime()
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      // Flag if within 30 days of deadline (inclusive of 0 to 30 days)
      if (daysRemaining > 0 && daysRemaining <= 30) {
        nearlyExpiredEots.push({
          ...eot,
          days_remaining: daysRemaining
        })
      }
    }

    // 4. Employee commitment averages (daily logs completion percentages)
    const { data: logs, error: logsError } = await admin
      .from('daily_work_logs')
      .select('completion_percentage, approval_status')

    let commitmentAverage = 0
    let unverifiedLogsCount = 0
    if (logsError) {
      console.error('[analytics] logs fetch error:', logsError.message)
      // Fallback but don't fail completely
    } else if (logs && logs.length > 0) {
      const totalPercentage = logs.reduce((sum, log) => sum + Number(log.completion_percentage || 0), 0)
      commitmentAverage = (totalPercentage / logs.length) * 100
      unverifiedLogsCount = logs.filter(log => log.approval_status === 'Pending').length
    }

    return NextResponse.json({
      metrics: {
        totalLetters,
        overdueLetters,
        activeBonds,
        expiredOrReleasedBonds,
        commitmentAverage: Math.round(commitmentAverage * 10) / 10, // round to 1 decimal place
        unverifiedLogsCount
      },
      alerts: {
        criticalExpiredBonds,
        nearlyExpiredEots
      }
    })
  } catch (err) {
    console.error('[analytics] GET unexpected:', err)
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}
