import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendBondNotification } from '@/lib/email-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function checkAdminOrDgm(userId: string) {
  const admin = createAdminClient()
  const { data: employee } = await admin
    .from('employees')
    .select('role')
    .eq('id', userId)
    .maybeSingle()
  return employee?.role === 'admin' || employee?.role === 'dgm'
}

// GET /api/bonds
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data: bonds, error } = await admin
      .from('project_bonds')
      .select('*')
      .order('expiry_date', { ascending: true })

    if (error) {
      console.error('[bonds] GET error:', error.message)
      return NextResponse.json({ error: 'Failed to retrieve bonds.' }, { status: 500 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // Process days remaining and override status to Expired if time is up and not Released
    const processedBonds = (bonds ?? []).map(bond => {
      const expDate = new Date(bond.expiry_date)
      expDate.setHours(0, 0, 0, 0)
      
      const diffTime = expDate.getTime() - today.getTime()
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      
      let finalStatus = bond.status
      if (bond.status !== 'Released') {
        finalStatus = daysRemaining <= 0 ? 'Expired' : 'Active'
      }
      
      return {
        ...bond,
        status: finalStatus,
        days_remaining: daysRemaining
      }
    })

    return NextResponse.json({ bonds: processedBonds })
  } catch (err) {
    console.error('[bonds] GET unexpected:', err)
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}

// POST /api/bonds
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const hasAccess = await checkAdminOrDgm(user.id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Admin or DGM access required.' }, { status: 403 })
    }

    const body = await request.json()
    const employerName = String(body.employer_name ?? '').trim()
    const projectName = String(body.project_name ?? '').trim()
    const contractorName = String(body.contractor_name ?? '').trim()
    const bondType = body.bond_type
    const issueDate = body.issue_date || null
    const expiryDate = body.expiry_date
    const amount = body.amount ? Number(body.amount) : null
    const bondStatus = body.status || 'Active'
    const assignedManagerEmail = body.assigned_manager_email ? String(body.assigned_manager_email).trim() : ''

    if (!employerName || !projectName || !contractorName || !bondType || !expiryDate) {
      return NextResponse.json({ error: 'Missing required bond fields.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('project_bonds')
      .insert({
        employer_name: employerName,
        project_name: projectName,
        contractor_name: contractorName,
        bond_type: bondType,
        issue_date: issueDate,
        expiry_date: expiryDate,
        amount,
        status: bondStatus,
        assigned_manager_email: assignedManagerEmail || 'team@efae.com'
      })
      .select()
      .single()

    if (error) {
      console.error('[bonds] POST error:', error.message)
      return NextResponse.json({ error: 'Failed to create bond record: ' + error.message }, { status: 500 })
    }

    // Send email notification
    try {
      const recipients: string[] = []
      
      // Use the stored assigned manager email - always send to this email
      const storedEmail = data.assigned_manager_email
      if (storedEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(storedEmail)) {
        recipients.push(storedEmail)
      }
      
      if (recipients.length > 0) {
        await sendBondNotification({
          submitterName: user.email || 'System User',
          submitterEmail: user.email || '',
          projectName: projectName,
          contractorName: contractorName,
          bondType: bondType,
          expiryDate: expiryDate,
          status: bondStatus,
          amount: amount ? amount.toLocaleString() : undefined,
          recipients: recipients
        })
      }
    } catch (emailError) {
      console.error('[bonds] Email notification failed:', emailError)
      // Don't fail the request if email fails
    }

    return NextResponse.json({ success: true, bond: data })
  } catch (err) {
    console.error('[bonds] POST unexpected:', err)
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}

// PATCH /api/bonds
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const hasAccess = await checkAdminOrDgm(user.id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Admin or DGM access required.' }, { status: 403 })
    }

    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Bond id is required.' }, { status: 400 })
    }

    const cleanUpdates: Record<string, any> = {}
    if (updates.employer_name !== undefined) cleanUpdates.employer_name = String(updates.employer_name).trim()
    if (updates.project_name !== undefined) cleanUpdates.project_name = String(updates.project_name).trim()
    if (updates.contractor_name !== undefined) cleanUpdates.contractor_name = String(updates.contractor_name).trim()
    if (updates.bond_type !== undefined) cleanUpdates.bond_type = updates.bond_type
    if (updates.issue_date !== undefined) cleanUpdates.issue_date = updates.issue_date || null
    if (updates.expiry_date !== undefined) cleanUpdates.expiry_date = updates.expiry_date
    if (updates.amount !== undefined) cleanUpdates.amount = updates.amount ? Number(updates.amount) : null
    if (updates.status !== undefined) cleanUpdates.status = updates.status
    if (updates.assigned_manager_email !== undefined) cleanUpdates.assigned_manager_email = updates.assigned_manager_email ? String(updates.assigned_manager_email).trim() : 'team@efae.com'

    if (Object.keys(cleanUpdates).length === 0) {
      return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('project_bonds')
      .update(cleanUpdates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[bonds] PATCH error:', error.message)
      return NextResponse.json({ error: 'Failed to update bond: ' + error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, bond: data })
  } catch (err) {
    console.error('[bonds] PATCH unexpected:', err)
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}

// DELETE /api/bonds
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }
    const hasAccess = await checkAdminOrDgm(user.id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Admin or DGM access required.' }, { status: 403 })
    }

    const body = await request.json()
    const id = Number(body.id)
    if (!id) {
      return NextResponse.json({ error: 'Bond id is required.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { error } = await admin
      .from('project_bonds')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[bonds] DELETE error:', error.message)
      return NextResponse.json({ error: 'Failed to delete bond: ' + error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[bonds] DELETE unexpected:', err)
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}
