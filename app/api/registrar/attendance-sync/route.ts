import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Shape of each element posted by the Python biometric_sync daemon. */
interface BiometricPunch {
  biometric_device_id: string   // UserBiometricID stored on the ZKTeco device
  log_date:            string   // 'YYYY-MM-DD'  (bucketed in office timezone)
  office_entrance:     string | null  // ISO-8601 UTC timestamp or null
  office_leave:        string | null  // ISO-8601 UTC timestamp or null
}

/** A punch that could not be mapped to any employee row. */
interface UnmappedEntry {
  device_id:       string
  log_date:        string
  office_entrance: string | null
  office_leave:    string | null
  reason:          string
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute total shift duration in decimal hours from two ISO timestamps.
 * Returns null when either value is absent or the result is negative.
 */
function computeShiftHours(
  entrance: string | null,
  leave:    string | null,
): number | null {
  if (!entrance || !leave) return null
  const inMs  = new Date(entrance).getTime()
  const outMs = new Date(leave).getTime()
  if (isNaN(inMs) || isNaN(outMs)) return null
  const diffHours = (outMs - inMs) / 3_600_000
  return diffHours > 0 ? parseFloat(diffHours.toFixed(2)) : null
}

/**
 * Extract just the HH:MM portion from an ISO timestamp for storage in the
 * office_entrance_time / office_leave_time columns (TIME-like text fields).
 */
function toTimeString(iso: string | null): string | null {
  if (!iso) return null
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return null
    const hh = String(d.getUTCHours()).padStart(2, '0')
    const mm = String(d.getUTCMinutes()).padStart(2, '0')
    return `${hh}:${mm}`
  } catch {
    return null
  }
}

/** Lightweight input sanitiser — rejects obviously malformed entries. */
function validatePunch(p: unknown): p is BiometricPunch {
  if (!p || typeof p !== 'object') return false
  const punch = p as Record<string, unknown>
  return (
    typeof punch.biometric_device_id === 'string' &&
    punch.biometric_device_id.trim().length > 0 &&
    typeof punch.log_date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(punch.log_date.trim())
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/registrar/attendance-sync
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  // ── 1. Security guardrail — validate shared sync token ──────────────────
  const incomingToken = request.headers.get('x-biometric-sync-token') ?? ''
  const expectedToken = process.env.INTERNAL_SYNC_TOKEN ?? ''

  if (!expectedToken) {
    console.error('[attendance-sync] INTERNAL_SYNC_TOKEN env var is not set.')
    return NextResponse.json(
      { error: 'Gateway is misconfigured — sync token not defined.' },
      { status: 500 },
    )
  }

  if (incomingToken !== expectedToken) {
    console.warn('[attendance-sync] Rejected request — invalid sync token.')
    return NextResponse.json(
      { error: 'Unauthorised — invalid sync token.' },
      { status: 401 },
    )
  }

  // ── 2. Parse and validate payload ────────────────────────────────────────
  let punches: unknown[]
  try {
    const body = await request.json()
    punches = Array.isArray(body) ? body : [body]
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON payload.' },
      { status: 400 },
    )
  }

  if (punches.length === 0) {
    return NextResponse.json(
      { error: 'Empty payload — no attendance records provided.' },
      { status: 400 },
    )
  }

  // ── 3. Process each punch ─────────────────────────────────────────────────
  const admin = createAdminClient()

  let synced   = 0
  let unmapped = 0
  let errors   = 0

  const unmappedEntries: UnmappedEntry[] = []

  for (const raw of punches) {
    // Skip structurally invalid entries — log and continue
    if (!validatePunch(raw)) {
      console.warn('[attendance-sync] Skipping malformed punch entry:', raw)
      errors++
      continue
    }

    const punch = raw as BiometricPunch
    const deviceId  = punch.biometric_device_id.trim()
    const logDate   = punch.log_date.trim()
    const entranceTs = punch.office_entrance ?? null
    const leaveTs    = punch.office_leave    ?? null

    try {
      // ── 3a. Resolve biometric_device_id → employee row ──────────────────
      const { data: employee, error: empError } = await admin
        .from('employees')
        .select('id, full_name')
        .eq('biometric_device_id', deviceId)
        .maybeSingle()

      if (empError) {
        console.error(
          `[attendance-sync] DB error resolving device_id "${deviceId}":`,
          empError.message,
        )
        errors++
        continue
      }

      // ── 3b. No employee matched — route to unmapped audit table ──────────
      if (!employee) {
        console.warn(
          `[attendance-sync] No employee found for biometric_device_id "${deviceId}" on ${logDate}.`,
        )
        unmappedEntries.push({
          device_id:       deviceId,
          log_date:        logDate,
          office_entrance: entranceTs,
          office_leave:    leaveTs,
          reason:          `No employee row has biometric_device_id = "${deviceId}"`,
        })
        unmapped++
        continue
      }

      // ── 3c. Compute derived fields ────────────────────────────────────────
      const shiftHours    = computeShiftHours(entranceTs, leaveTs)
      const entranceTime  = toTimeString(entranceTs)
      const leaveTime     = toTimeString(leaveTs)

      // ── 3d. Build upsert record ───────────────────────────────────────────
      // ON CONFLICT (employee_id, log_date):
      //   • office_entrance_time  → set only when incoming value is non-null
      //     (preserves a manually entered time if the hardware missed the punch)
      //   • office_leave_time     → always overwrite with the latest checkout
      //   • actual_working_hour   → recalculated from biometric times
      //
      // Fields the employee fills in manually (assigned_tasks, actual_work_done,
      // completion_percentage, remark, approval_status) are NOT touched here
      // so manual entries are never overwritten by a sync run.
      const upsertRecord: Record<string, unknown> = {
        employee_id:          employee.id,
        log_date:             logDate,
        // Biometric entrance — only write when the daemon provides a value
        ...(entranceTime !== null && { office_entrance_time: entranceTime }),
        // Biometric leave — always take the latest checkout the daemon provides
        ...(leaveTime !== null    && { office_leave_time:    leaveTime }),
        // Computed shift duration
        ...(shiftHours !== null   && { actual_working_hour:  shiftHours }),
      }

      const { error: upsertError } = await admin
        .from('daily_work_logs')
        .upsert(upsertRecord, {
          onConflict:        'employee_id,log_date',
          ignoreDuplicates:  false,   // always update the leave/hours columns
        })

      if (upsertError) {
        console.error(
          `[attendance-sync] Upsert failed for employee "${employee.full_name}" on ${logDate}:`,
          upsertError.message,
        )
        errors++
        continue
      }

      console.log(
        `[attendance-sync] Synced "${employee.full_name}" (${deviceId}) → ${logDate}` +
        `  in=${entranceTime ?? '—'}  out=${leaveTime ?? '—'}  hrs=${shiftHours ?? '—'}`,
      )
      synced++

    } catch (rowErr) {
      // Catch-all per-row — a single bad row must not abort the rest of the batch
      console.error(
        `[attendance-sync] Unexpected error processing device_id "${deviceId}" on ${logDate}:`,
        rowErr instanceof Error ? rowErr.message : String(rowErr),
      )
      errors++
    }
  }

  // ── 4. Persist unmapped punches to the audit table ──────────────────────
  if (unmappedEntries.length > 0) {
    try {
      const unmappedRows = unmappedEntries.flatMap((entry) => {
        const rows = []
        if (entry.office_entrance) {
          rows.push({
            device_id:       entry.device_id,
            punch_timestamp: entry.office_entrance,
            punch_type:      0,   // entrance
          })
        }
        if (entry.office_leave) {
          rows.push({
            device_id:       entry.device_id,
            punch_timestamp: entry.office_leave,
            punch_type:      1,   // leave
          })
        }
        return rows
      })

      if (unmappedRows.length > 0) {
        const { error: auditError } = await admin
          .from('unmapped_device_logs')
          .insert(unmappedRows)

        if (auditError) {
          console.error(
            '[attendance-sync] Failed to write unmapped logs:',
            auditError.message,
          )
        } else {
          console.log(
            `[attendance-sync] Stored ${unmappedRows.length} unmapped punch(es) ` +
            'in unmapped_device_logs for manual review.',
          )
        }
      }
    } catch (auditErr) {
      // Non-fatal — the main sync result is still returned
      console.error('[attendance-sync] Audit table write error:', auditErr)
    }
  }

  // ── 5. Return summary ─────────────────────────────────────────────────────
  return NextResponse.json(
    {
      ok:       errors === 0 && unmapped === 0,
      synced,
      unmapped,
      errors,
      total:    punches.length,
    },
    { status: 200 },
  )
}
