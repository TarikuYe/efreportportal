import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

// TEMPORARILY DISABLED FOR TESTING - allowing @gmail.com and other domains
// const ALLOWED_DOMAIN = '@efae.com'

export async function POST(request: Request) {
  try {
    const { email, password, full_name, department, role } = await request.json()

    // Server-side domain validation (defense-in-depth)
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
    }

    const trimmedEmail = email.trim().toLowerCase()

    // TEMPORARILY DISABLED FOR TESTING - allowing @gmail.com and other domains
    // if (!trimmedEmail.endsWith(ALLOWED_DOMAIN)) {
    //   return NextResponse.json(
    //     {
    //       error: `Registration is restricted to ${ALLOWED_DOMAIN} email addresses. Please use your official company email.`,
    //     },
    //     { status: 403 },
    //   )
    // }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters.' },
        { status: 400 },
      )
    }

    if (!full_name || typeof full_name !== 'string' || full_name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Full name is required.' },
        { status: 400 },
      )
    }

    // Create the user via the server-side Supabase client (handles cookies properly)
    const supabase = await createClient()
    
    // DEVELOPMENT: Temporarily skip email confirmation while SMTP is being configured
    // Once Gmail SMTP is set up in Supabase Dashboard, remove this data block
    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        emailRedirectTo: `${new URL(request.url).origin}/auth/callback`,
        data: {
          email_confirmed: true,
          full_name: full_name.trim(),
        },
      },
    })

    if (error) {
      // Handle duplicate / already-registered errors gracefully
      const msg = error.message.toLowerCase()
      if (
        msg.includes('already registered') ||
        msg.includes('already exists') ||
        msg.includes('user already')
      ) {
        return NextResponse.json(
          { error: 'An account with this email already exists. Please sign in instead.' },
          { status: 409 },
        )
      }
      console.log('[signup] auth error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Create employee profile if user was created successfully
    if (data.user) {
      try {
        const admin = createAdminClient()
        
        // Check if employee profile already exists
        const { data: existingEmployee } = await admin
          .from('employees')
          .select('id')
          .eq('id', data.user.id)
          .maybeSingle()

        if (!existingEmployee) {
          // Create employee profile
          const { error: employeeError } = await admin
            .from('employees')
            .insert({
              id: data.user.id,
              full_name: full_name.trim(),
              email: trimmedEmail,
              department: department?.trim() || null,
              active: true,
              role: role?.trim() || 'engineer'
            })

          if (employeeError) {
            console.log('[signup] employee profile creation error:', employeeError.message)
            // Don't fail the whole request if employee profile creation fails
          }
        }

        // Also create or update employee_profiles table if it exists
        const { error: profileError } = await admin
          .from('employee_profiles')
          .upsert({
            email: trimmedEmail,
            full_name: full_name.trim(),
            active: true
          }, {
            onConflict: 'email'
          })

        if (profileError) {
          console.log('[signup] employee_profiles upsert error:', profileError.message)
          // Don't fail the whole request if profile creation fails
        }
      } catch (profileErr) {
        console.log('[signup] profile creation error:', profileErr)
        // Don't fail the whole request if profile creation fails
      }
    }

    return NextResponse.json({
      success: true,
      user: data.user
        ? {
            id: data.user.id,
            email: data.user.email,
            full_name: full_name.trim(),
          }
        : null,
    })
  } catch (err) {
    console.log('[signup] route error:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}
