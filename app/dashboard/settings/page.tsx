import { redirect } from 'next/navigation'

export default function SettingsRedirectPage() {
  redirect('/dashboard?tab=settings')
}
