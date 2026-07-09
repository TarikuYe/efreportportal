import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SiteHeader } from '@/components/site-header'
import { AiSpreadsheetAssistant } from '@/components/ai-spreadsheet-assistant'

export const metadata = {
  title: 'AI Spreadsheet Assistant — EF Architect & Engineering',
  description: 'AI-powered spreadsheet conversion using local Ollama (Llama 3.1)',
}

export const dynamic = 'force-dynamic'

export default async function AiAssistantPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !user.email) {
    redirect('/auth/signin')
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <AiSpreadsheetAssistant />
      </main>
      <footer className="border-t border-border bg-secondary/40 mt-auto">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} EF Architect &amp; Engineering. All rights reserved.</p>
          <p>EF Management Portal — AI Assistant Mode</p>
        </div>
      </footer>
    </div>
  )
}
