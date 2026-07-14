// ─────────────────────────────────────────────────────────────────────────────
// Alert Scanner — Cron Email Alert Service
//
// Encapsulates all DB scanning, cooldown-shield logic, email dispatch, and
// diagnostics logging for the daily automated alert cron job.
//
// Consumed exclusively by: app/api/cron/email-alerts/route.ts
// ─────────────────────────────────────────────────────────────────────────────

import { createAdminClient } from '@/lib/supabase/admin'
import { sendNotificationEmail } from '@/lib/email-service'
import {
  bondExpiryWarningEmailHtml,
  eotDeadlineWarningEmailHtml,
} from '@/lib/alert-emails'

// ── Constants ─────────────────────────────────────────────────────────────────

/** Warning thresholds in days. Order matters: most urgent first. */
const BOND_THRESHOLDS = [7, 15, 30] as const
const EOT_THRESHOLDS  = [15, 30]    as const

type BondThreshold = (typeof BOND_THRESHOLDS)[number]
type EotThreshold  = (typeof EOT_THRESHOLDS)[number]

/** Ethiopia timezone used for "today" date calculations. */
const TZ = 'Africa/Addis_Ababa'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScanResult {
  bondsSent:   number
  eotsSent:    number
  totalSent:   number
  errorsCount: number
  detail:      string
}

interface BondRow {
  id:                           string
  employer_name:                string
  project_name:                 string
  contractor_name:              string
  bond_type:                    string
  expiry_date:                  string
  amount:                       number | null
  status:                       string
  assigned_manager_email:       string | null
  notified_warning_threshold:   number | null
  last_notified_at:             string | null
}

interface EotRow {
  id:                           string
  client_name:                  string
  project_name:                 string
  contractor_name:              string
  eot_number:                   number
  days_approved:                number
  revised_completion_date:      string
  status:                       string
  assigned_manager_email:       string | null
  notified_warning_threshold:   number | null
  last_notified_at:             string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns today's date as a plain YYYY-MM-DD string in the Ethiopia timezone,
 * so that date arithmetic is not skewed by the UTC offset at cron execution time.
 */
function todayInEthiopia(): Date {
  const now = new Date()
  // Build a date string in the local TZ then parse it back to midnight UTC-equivalent
  const etStr = now.toLocaleDateString('en-CA', { timeZone: TZ }) // "YYYY-MM-DD"
  const [y, m, d] = etStr.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0)
}

/** Calendar-day difference between a future ISO date string and today (Ethiopia). */
function daysUntil(isoDate: string): number {
  const today  = todayInEthiopia()
  const target = new Date(isoDate)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000)
}

/**
 * Cooldown guard: returns the threshold we should notify at, or null if the
 * record has already been notified at this threshold today (or at a more
 * urgent threshold in the same cycle).
 *
 * Logic:
 *  - Find the tightest threshold the record currently qualifies for.
 *  - If notified_warning_threshold >= that value AND last_notified_at is
 *    within the last 24 h, skip (already sent today for this urgency level).
 *  - A lower remaining count supersedes a previous higher threshold, so if
 *    daysRemaining is now 7 but we only sent the 15-day notice, we send again.
 */
function shouldNotify(
  daysRemaining: number,
  notifiedThreshold: number | null,
  lastNotifiedAt: string | null,
  thresholds: readonly number[],
): number | null {
  // Qualifies for the smallest threshold whose value >= daysRemaining
  const qualifying = thresholds
    .slice()
    .sort((a, b) => a - b) // ascending: 7, 15, 30
    .find(t => daysRemaining <= t)

  if (qualifying === undefined) return null // outside all thresholds

  const prevThreshold = notifiedThreshold ?? 0
  const prevSentAt    = lastNotifiedAt ? new Date(lastNotifiedAt) : null
  const oneDayAgo     = Date.now() - 86_400_000

  // Already notified at this exact threshold within the last 24 h → skip
  if (prevThreshold === qualifying && prevSentAt && prevSentAt.getTime() > oneDayAgo) {
    return null
  }

  // Already notified at a more urgent (smaller) threshold → skip
  // e.g. prevThreshold = 7 and qualifying = 15 means we've already escalated
  if (prevThreshold !== 0 && prevThreshold < qualifying) {
    return null
  }

  return qualifying
}

/** Validate an email address with a minimal regex. */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/**
 * Mint a fresh UUID v4 token and a 7-day expiry timestamp.
 * Uses crypto.randomUUID() which is available in Node 18+ and the Vercel runtime.
 */
function mintToken(): { token: string; expiresAt: string } {
  const token     = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  return { token, expiresAt }
}

/** Collect and de-duplicate the CC list from environment variables. */
function buildCcList(): string[] {
  const cc: string[] = []

  const dgm = process.env.DGM_EMAIL
  if (dgm && isValidEmail(dgm)) cc.push(dgm)

  const contractAdmin = process.env.CONTRACT_ADMIN_EMAIL
  if (contractAdmin && isValidEmail(contractAdmin)) cc.push(contractAdmin)

  const extras = (process.env.REMINDER_RECIPIENTS ?? '')
    .split(',')
    .map(e => e.trim())
    .filter(e => isValidEmail(e))
  cc.push(...extras)

  // De-duplicate
  return [...new Set(cc)]
}

// ── Bond Scanner ──────────────────────────────────────────────────────────────

async function scanBonds(): Promise<{ sent: number; errors: number; log: string[] }> {
  const admin   = createAdminClient()
  const results = { sent: 0, errors: 0, log: [] as string[] }
  const portalUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://efae.vercel.app'
  const ccList  = buildCcList()

  const { data: bonds, error } = await admin
    .from('project_bonds')
    .select(
      'id, employer_name, project_name, contractor_name, bond_type, ' +
      'expiry_date, amount, status, assigned_manager_email, ' +
      'notified_warning_threshold, last_notified_at',
    )
    .eq('status', 'Active')
    .not('expiry_date', 'is', null)

  if (error) {
    results.errors++
    results.log.push(`[bonds] DB query failed: ${error.message}`)
    return results
  }

  for (const bond of (bonds ?? []) as BondRow[]) {
    try {
      const daysRemaining = daysUntil(bond.expiry_date)

      // Only care about upcoming expiry, not already expired
      if (daysRemaining <= 0) continue

      const threshold = shouldNotify(
        daysRemaining,
        bond.notified_warning_threshold,
        bond.last_notified_at,
        BOND_THRESHOLDS,
      )
      if (threshold === null) continue

      // Build recipient list: primary = assigned manager email (acts as
      // contractor-side contact); CC = DGM + contract admin
      const primaryEmail = bond.assigned_manager_email ?? ''
      if (!isValidEmail(primaryEmail)) {
        results.log.push(
          `[bonds] Skipped bond ${bond.id} — invalid assigned_manager_email: "${primaryEmail}"`,
        )
        continue
      }

      const toList = [primaryEmail, ...ccList.filter(e => e !== primaryEmail)]

      // Mint a fresh single-use view token — 7-day expiry
      const { token, expiresAt } = mintToken()
      const noticeUrl = `${portalUrl}/notice/bond/${token}`

      const html = bondExpiryWarningEmailHtml({
        contractorName: bond.contractor_name,
        projectName:    bond.project_name,
        employerName:   bond.employer_name,
        bondType:       bond.bond_type,
        expiryDate:     bond.expiry_date,
        amount:         bond.amount != null
          ? `${Number(bond.amount).toLocaleString()} ETB`
          : undefined,
        daysRemaining,
        noticeUrl,
      })

      const subject =
        `[${threshold}d Warning] Bond Renewal Required — ${bond.project_name} (${bond.bond_type})`

      const sent = await sendNotificationEmail({ to: toList, subject, html })

      if (sent) {
        // Stamp cooldown columns + write the new view token atomically
        await admin
          .from('project_bonds')
          .update({
            last_notified_at:           new Date().toISOString(),
            notified_warning_threshold: threshold,
            view_token:                 token,
            token_expires_at:           expiresAt,
          })
          .eq('id', bond.id)

        results.sent++
        results.log.push(
          `[bonds] ✓ Sent ${threshold}d warning for "${bond.project_name}" ` +
          `→ ${toList.join(', ')} (${daysRemaining} days remaining)`,
        )
      } else {
        results.errors++
        results.log.push(
          `[bonds] ✗ Email transport failed for bond ${bond.id} ` +
          `"${bond.project_name}"`,
        )
      }
    } catch (err: any) {
      results.errors++
      results.log.push(`[bonds] ✗ Unexpected error on bond ${bond.id}: ${err?.message}`)
    }
  }

  return results
}

// ── EOT Scanner ───────────────────────────────────────────────────────────────

async function scanEots(): Promise<{ sent: number; errors: number; log: string[] }> {
  const admin   = createAdminClient()
  const results = { sent: 0, errors: 0, log: [] as string[] }
  const portalUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://efae.vercel.app'
  const ccList  = buildCcList()

  const { data: eots, error } = await admin
    .from('eot_tracker')
    .select(
      'id, client_name, project_name, contractor_name, eot_number, ' +
      'days_approved, revised_completion_date, status, assigned_manager_email, ' +
      'notified_warning_threshold, last_notified_at',
    )
    .not('revised_completion_date', 'is', null)

  if (error) {
    results.errors++
    results.log.push(`[eots] DB query failed: ${error.message}`)
    return results
  }

  for (const eot of (eots ?? []) as EotRow[]) {
    try {
      const daysRemaining = daysUntil(eot.revised_completion_date)

      if (daysRemaining <= 0) continue

      const threshold = shouldNotify(
        daysRemaining,
        eot.notified_warning_threshold,
        eot.last_notified_at,
        EOT_THRESHOLDS,
      )
      if (threshold === null) continue

      // For EOT, primary recipient is the assigned department-head/manager email
      const primaryEmail = eot.assigned_manager_email ?? ''
      if (!isValidEmail(primaryEmail)) {
        results.log.push(
          `[eots] Skipped EOT ${eot.id} — invalid assigned_manager_email: "${primaryEmail}"`,
        )
        continue
      }

      const toList = [primaryEmail, ...ccList.filter(e => e !== primaryEmail)]

      // Mint a fresh single-use view token — 7-day expiry
      const { token, expiresAt } = mintToken()
      const noticeUrl = `${portalUrl}/notice/eot/${token}`

      const html = eotDeadlineWarningEmailHtml({
        projectName:           eot.project_name,
        contractorName:        eot.contractor_name,
        clientName:            eot.client_name,
        eotNumber:             eot.eot_number,
        daysApproved:          eot.days_approved,
        revisedCompletionDate: eot.revised_completion_date,
        daysRemaining,
        noticeUrl,
      })

      const subject =
        `[${threshold}d Advisory] EOT Window Closing — ${eot.project_name} / Claim #${eot.eot_number}`

      const sent = await sendNotificationEmail({ to: toList, subject, html })

      if (sent) {
        // Stamp cooldown columns + write the new view token atomically
        await admin
          .from('eot_tracker')
          .update({
            last_notified_at:           new Date().toISOString(),
            notified_warning_threshold: threshold,
            view_token:                 token,
            token_expires_at:           expiresAt,
          })
          .eq('id', eot.id)

        results.sent++
        results.log.push(
          `[eots] ✓ Sent ${threshold}d advisory for "${eot.project_name}" ` +
          `(Claim #${eot.eot_number}) → ${toList.join(', ')} (${daysRemaining} days remaining)`,
        )
      } else {
        results.errors++
        results.log.push(
          `[eots] ✗ Email transport failed for EOT ${eot.id} "${eot.project_name}"`,
        )
      }
    } catch (err: any) {
      results.errors++
      results.log.push(`[eots] ✗ Unexpected error on EOT ${eot.id}: ${err?.message}`)
    }
  }

  return results
}

// ── Diagnostics Logger ────────────────────────────────────────────────────────

async function writeCronLog(result: ScanResult): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('system_cron_logs').insert({
      job_name:    'email-alerts',
      status:      result.errorsCount > 0 && result.totalSent === 0
                     ? 'error'
                     : result.errorsCount > 0
                     ? 'partial'
                     : 'success',
      bonds_sent:  result.bondsSent,
      eots_sent:   result.eotsSent,
      total_sent:  result.totalSent,
      errors_count: result.errorsCount,
      detail:      result.detail,
      executed_at: new Date().toISOString(),
    })
  } catch (err: any) {
    // Non-fatal: log failure should never crash the cron itself
    console.error('[alert-scanner] Failed to write cron log:', err?.message)
  }
}

// ── Public Entry Point ────────────────────────────────────────────────────────

/**
 * runAlertScan()
 *
 * Executes the full bond + EOT scan cycle:
 *  1. Queries both tables for records approaching threshold windows.
 *  2. Applies the cooldown shield (skips already-notified records).
 *  3. Dispatches HTML alert emails via sendNotificationEmail().
 *  4. Stamps last_notified_at + notified_warning_threshold on each dispatched row.
 *  5. Appends a diagnostics row to system_cron_logs.
 *
 * Returns a ScanResult summary for the HTTP response body.
 */
export async function runAlertScan(): Promise<ScanResult> {
  const [bondScan, eotScan] = await Promise.all([scanBonds(), scanEots()])

  const result: ScanResult = {
    bondsSent:   bondScan.sent,
    eotsSent:    eotScan.sent,
    totalSent:   bondScan.sent + eotScan.sent,
    errorsCount: bondScan.errors + eotScan.errors,
    detail: [...bondScan.log, ...eotScan.log].join('\n'),
  }

  await writeCronLog(result)

  return result
}
