'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { FileSpreadsheet, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * EmployeeReportPanel
 * ───────────────────
 * Toolbar button that triggers a session-bound Excel export of the
 * authenticated employee's personal work log records.
 *
 * - Calls GET /api/employee/export-report (no query params — the server
 *   derives the employee identity from the Supabase session cookie).
 * - Receives the .xlsx binary, converts it to a Blob, and programmatically
 *   triggers a browser download via a temporary <a> element.
 * - Manages loading state and Sonner toast notifications throughout.
 */
export function EmployeeReportPanel() {
  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    if (downloading) return

    setDownloading(true)
    const loadingToastId = toast.loading('Preparing your report…', {
      description: 'Building your personalised Excel performance ledger.',
    })

    try {
      const res = await fetch('/api/employee/export-report', {
        method: 'GET',
        // Credentials are sent automatically via the session cookie —
        // no manual auth header needed.
      })

      if (!res.ok) {
        // Try to parse a JSON error message from the route handler
        let errMsg = `Server error (${res.status})`
        try {
          const json = await res.json()
          if (json?.error) errMsg = json.error
        } catch {
          // Response was not JSON — use status text fallback
          errMsg = res.statusText || errMsg
        }
        throw new Error(errMsg)
      }

      // Extract the suggested filename from the Content-Disposition header
      const disposition = res.headers.get('content-disposition') ?? ''
      const filenameMatch = disposition.match(/filename="([^"]+)"/)
      const filename = filenameMatch?.[1] ?? `My_Work_Log_Report_${new Date().toISOString().split('T')[0]}.xlsx`

      // Convert the streamed response to a downloadable Blob
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)

      // Programmatically click a hidden anchor to trigger the browser download
      const anchor      = document.createElement('a')
      anchor.href       = url
      anchor.download   = filename
      anchor.style.display = 'none'
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)

      // Release the object URL after a short delay to allow the download to start
      setTimeout(() => URL.revokeObjectURL(url), 5_000)

      toast.dismiss(loadingToastId)
      toast.success('Report downloaded', {
        description: `Your performance ledger has been saved as "${filename}".`,
      })
    } catch (err) {
      toast.dismiss(loadingToastId)
      toast.error('Download failed', {
        description: err instanceof Error ? err.message : 'Please try again.',
      })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Button
      variant="outline"
      onClick={handleDownload}
      disabled={downloading}
      className="h-9 gap-1.5"
      title="Download your personal attendance and work log report as an Excel spreadsheet"
    >
      {downloading ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          <span>Building Report…</span>
        </>
      ) : (
        <>
          <FileSpreadsheet className="size-4" />
          <span>Download My Performance Report</span>
        </>
      )}
    </Button>
  )
}
