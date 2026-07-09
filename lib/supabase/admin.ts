import { createClient } from '@supabase/supabase-js'

// Server-only Supabase client using the service role key.
// This portal is public (employees submit without accounts), so all
// database writes/reads and storage access happen through server routes
// using this privileged client. Never import this in client components.
export function createAdminClient() {
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

  if (!url || !serviceKey) {
    throw new Error(
      'Missing Supabase environment variables (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).',
    )
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export const REPORTS_BUCKET = 'reports'
