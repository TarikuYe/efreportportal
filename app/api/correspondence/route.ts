import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

// GET /api/correspondence
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data: letters, error } = await admin
      .from('correspondence_register')
      .select('*')
      .order('date_logged', { ascending: false })

    if (error) {
      console.error('[correspondence] GET error:', error.message)
      return NextResponse.json({ error: 'Failed to retrieve correspondence.' }, { status: 500 })
    }

    // Dynamic Overdue status override on GET (in case cron/recalculation is pending)
    const today = new Date().toISOString().split('T')[0]
    const processedLetters = (letters ?? []).map(letter => {
      let currentStatus = letter.status
      if (letter.response_required && !letter.response_sent_date) {
        if (letter.response_due_date && letter.response_due_date < today) {
          currentStatus = 'Overdue'
        }
      }
      return { ...letter, status: currentStatus }
    })

    return NextResponse.json({ correspondence: processedLetters })
  } catch (err) {
    console.error('[correspondence] GET unexpected:', err)
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}

// POST /api/correspondence
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
    const refNo = String(body.letter_ref_no ?? '').trim()
    const dateLogged = body.date_logged
    const direction = body.direction
    const counterparty = String(body.counterparty ?? '').trim()
    const subject = String(body.subject ?? '').trim()
    const category = body.category
    const responseRequired = !!body.response_required
    const responseDueDate = body.response_due_date || null
    const linkedResponseRef = body.linked_response_ref ? String(body.linked_response_ref).trim() : null
    const responseSentDate = body.response_sent_date || null

    if (!refNo || !dateLogged || !direction || !counterparty || !subject || !category) {
      return NextResponse.json({ error: 'Missing required correspondence fields.' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Status will be handled by the DB trigger natively, but we'll supply a placeholder 'Open'
    const { data, error } = await admin
      .from('correspondence_register')
      .insert({
        letter_ref_no: refNo,
        date_logged: dateLogged,
        direction,
        counterparty,
        subject,
        category,
        response_required: responseRequired,
        response_due_date: responseDueDate,
        linked_response_ref: linkedResponseRef,
        response_sent_date: responseSentDate,
        status: 'Open'
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: `Letter reference number "${refNo}" already exists.` }, { status: 409 })
      }
      console.error('[correspondence] POST error:', error.message)
      return NextResponse.json({ error: 'Failed to create correspondence record: ' + error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, letter: data })
  } catch (err) {
    console.error('[correspondence] POST unexpected:', err)
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}

// PATCH /api/correspondence
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
      return NextResponse.json({ error: 'Correspondence id is required.' }, { status: 400 })
    }

    const cleanUpdates: Record<string, any> = {}
    if (updates.letter_ref_no !== undefined) cleanUpdates.letter_ref_no = String(updates.letter_ref_no).trim()
    if (updates.date_logged !== undefined) cleanUpdates.date_logged = updates.date_logged
    if (updates.direction !== undefined) cleanUpdates.direction = updates.direction
    if (updates.counterparty !== undefined) cleanUpdates.counterparty = String(updates.counterparty).trim()
    if (updates.subject !== undefined) cleanUpdates.subject = String(updates.subject).trim()
    if (updates.category !== undefined) cleanUpdates.category = updates.category
    if (updates.response_required !== undefined) cleanUpdates.response_required = !!updates.response_required
    if (updates.response_due_date !== undefined) cleanUpdates.response_due_date = updates.response_due_date || null
    if (updates.linked_response_ref !== undefined) cleanUpdates.linked_response_ref = updates.linked_response_ref ? String(updates.linked_response_ref).trim() : null
    if (updates.response_sent_date !== undefined) cleanUpdates.response_sent_date = updates.response_sent_date || null
    
    // Check if we need to force status recalculation trigger
    if (Object.keys(cleanUpdates).length === 0) {
      return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('correspondence_register')
      .update(cleanUpdates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[correspondence] PATCH error:', error.message)
      return NextResponse.json({ error: 'Failed to update correspondence: ' + error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, letter: data })
  } catch (err) {
    console.error('[correspondence] PATCH unexpected:', err)
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}
