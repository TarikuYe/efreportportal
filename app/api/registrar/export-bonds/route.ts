import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ExcelJS from 'exceljs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ── Auth guard ────────────────────────────────────────────
async function checkAdminOrDgm(userId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: emp } = await admin
    .from('employees').select('role').eq('id', userId).maybeSingle()
  return emp?.role === 'admin' || emp?.role === 'dgm'
}

// ── Colour palette (AARRGGBB) — matches Bond-Expiry-Tracker template ──
const C = {
  NAVY_BG:       'FF333399',
  NAVY_FG:       'FFFFFFFF',
  TITLE_FG:      'FF333399',
  SLATE_BG:      'FFE2E8F0',
  GRAY_FG:       'FF4B5563',
  BLACK_FG:      'FF000000',
  SN_BG:         'FF003366',
  SN_FG:         'FFFFFFFF',
  BAND_A:        'FFFFFFFF',
  BAND_B:        'FFCCFFFF',
  BOND_SECTION_BG: 'FFCCFFCC',
  TEAL_BG:       'FF33CCCC',
  TEAL_FG:       'FFFFFFFF',
  ALERT_BANNER_BG: 'FF993300',
  ALERT_BANNER_FG: 'FFFFFFFF',
  RED_BG:        'FFFF8080',
  RED_FG:        'FF993300',
  YELLOW_BG:     'FFFFFF99',
  YELLOW_FG:     'FF993300',
  GREEN_BG:      'FFCCFFCC',
  GREEN_FG:      'FF008000',
  ATTN_HDR_BG:   'FFCCFFFF',
  ATTN_HDR_FG:   'FF333399',
  THIN: { style: 'thin' as const },
  MED:  { style: 'medium' as const },
}

// ── Utility helpers ───────────────────────────────────────
function fmtDate(d: string | null | undefined): string | null {
  if (!d) return null
  return String(d).substring(0, 10)
}
function cleanStr(v: string | null | undefined): string {
  const s = v?.trim()
  return s ? s : '—'
}
function allBorders(cell: ExcelJS.Cell) {
  cell.border = { top: C.THIN, bottom: C.THIN, left: C.THIN, right: C.THIN }
}
function solidFill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}
function daysRemaining(expiryDate: string | null | undefined, today: Date): number | null {
  if (!expiryDate) return null
  const exp = new Date(expiryDate)
  exp.setHours(0, 0, 0, 0)
  return Math.ceil((exp.getTime() - today.getTime()) / 86_400_000)
}

// ── Record shape from DB ──────────────────────────────────
type RawBond = {
  id: string
  employer_name: string
  project_name: string
  contractor_name: string
  bond_type: string
  issue_date: string | null
  expiry_date: string | null
  amount: number | null
  status: string // 'Active' | 'Released' (raw, as maintained by the team)
}

function isApb(bondType: string): boolean {
  return bondType.toLowerCase().includes('advance')
}
function isPb(bondType: string): boolean {
  return bondType.toLowerCase().includes('perform')
}

// ── Pivoted row: one project/contractor pairing with its APB + PB bonds ──
type PivotRow = {
  employer: string
  project: string
  contractor: string
  apb: RawBond | null
  pb: RawBond | null
  extra: RawBond[] // overflow bonds (2nd+ APB/PB, or unrecognized bond_type) — surfaced in Remarks, never dropped
}

// ── Main route handler ────────────────────────────────────
export async function GET(_req: Request) {
  try {
    // 1. Auth
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user)
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    if (!(await checkAdminOrDgm(user.id)))
      return NextResponse.json({ error: 'Admin or DGM access required.' }, { status: 403 })

    // 2. Fetch ALL bonds, paginating past Supabase/PostgREST's default 1000-row cap
    const admin = createAdminClient()
    const PAGE_SIZE = 1000
    let raw: any[] = []
    let page = 0
    while (true) {
      const { data: pageData, error } = await admin
        .from('project_bonds')
        .select('*')
        .order('employer_name', { ascending: true })
        .order('project_name', { ascending: true })
        .order('expiry_date', { ascending: true })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

      if (error) {
        console.error('[export-bonds] DB:', error.message)
        return NextResponse.json({ error: 'Failed to retrieve bond records.' }, { status: 500 })
      }
      raw = raw.concat(pageData ?? [])
      if (!pageData || pageData.length < PAGE_SIZE) break
      page++
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const bonds: RawBond[] = (raw ?? []).map((b: any) => {
      // Supabase returns `date` columns as "YYYY-MM-DD" strings. Guard against JS
      // Date objects (ORM hydration) or ISO timestamps with time components.
      const normaliseDate = (v: unknown): string | null => {
        if (!v) return null
        if (v instanceof Date) return v.toISOString().substring(0, 10)
        const s = String(v).trim()
        return s ? s.substring(0, 10) : null
      }
      // Use raw trimmed value for grouping keys (so null/""/whitespace all collapse to '')
      // but display-clean value (cleanStr) for cell rendering
      return {
        id:               b.id,
        employer_name:    (b.employer_name ?? '').trim() || 'Unknown Employer',
        project_name:     (b.project_name  ?? '').trim() || 'Unknown Project',
        contractor_name:  (b.contractor_name ?? '').trim() || 'Unknown Contractor',
        bond_type:        cleanStr(b.bond_type),
        issue_date:       normaliseDate(b.issue_date),
        expiry_date:      normaliseDate(b.expiry_date),
        amount:           b.amount != null ? Number(b.amount) : null,
        status:           cleanStr(b.status),
      }
    })

    // 3. Pivot: group into employer → (project|contractor) rows, each carrying
    //    an Advance Payment Bond and/or a Performance Bond. Uses per-key queues so a
    //    project with a *second* APB or PB (renewal/replacement) gets its own extra
    //    row instead of silently overwriting the first — every fetched bond ends up
    //    somewhere in the sheet.
    const employerOrder: string[] = []
    const employerRows: Map<string, PivotRow[]> = new Map()
    const bondsByKey: Map<string, RawBond[]> = new Map() // employer|project|contractor -> all bonds, in fetch order
    const keyOrder: Map<string, string[]> = new Map()    // employer -> ordered list of keys (first-seen order)

    for (const b of bonds) {
      if (!employerRows.has(b.employer_name)) {
        employerRows.set(b.employer_name, [])
        keyOrder.set(b.employer_name, [])
        employerOrder.push(b.employer_name)
      }
      const key = `${b.employer_name}\u0001${b.project_name}\u0001${b.contractor_name}`
      if (!bondsByKey.has(key)) {
        bondsByKey.set(key, [])
        keyOrder.get(b.employer_name)!.push(key)
      }
      bondsByKey.get(key)!.push(b)
    }

    for (const employer of employerOrder) {
      for (const key of keyOrder.get(employer)!) {
        const [, project, contractor] = key.split('\u0001')
        const list = bondsByKey.get(key)!
        const apbQueue = list.filter(b => isApb(b.bond_type))
        const pbQueue  = list.filter(b => isPb(b.bond_type))
        const otherQueue = list.filter(b => !isApb(b.bond_type) && !isPb(b.bond_type))
        const rowCount = Math.max(apbQueue.length, pbQueue.length, otherQueue.length, 1)

        for (let i = 0; i < rowCount; i++) {
          const extra: RawBond[] = []
          // Any APB/PB beyond the first slot for this key, plus unclassified bond types, ride along as "extra"
          if (i > 0 && apbQueue[i]) extra.push(apbQueue[i])
          if (i > 0 && pbQueue[i])  extra.push(pbQueue[i])
          if (otherQueue[i]) extra.push(otherQueue[i])

          employerRows.get(employer)!.push({
            employer, project, contractor,
            apb: i === 0 ? (apbQueue[0] ?? null) : null,
            pb:  i === 0 ? (pbQueue[0] ?? null) : null,
            extra,
          })
        }
      }
    }

    // 4. KPI tallies — derived from live-computed status so DB label mismatches don't hide real state
    let expiredCount = 0, expiringCount = 0, safeCount = 0
    const attentionApb: { contractor: string; expiry: string | null; days: number }[] = []
    const attentionPb:  { contractor: string; expiry: string | null; days: number }[] = []

    for (const b of bonds) {
      // Skip Released bonds — they are intentionally closed and should not appear in any alert bucket
      if (b.status === 'Released') continue
      const dr = daysRemaining(b.expiry_date, today)
      if (dr == null) continue
      if (dr <= 0)       expiredCount++
      else if (dr <= 30) expiringCount++
      else                safeCount++
      // Only push into the attention sidebar if the bond is not already fully expired
      // (expired ones already show in the count; attention list is for actionable upcoming ones)
      if (isApb(b.bond_type)) attentionApb.push({ contractor: b.contractor_name, expiry: fmtDate(b.expiry_date), days: dr })
      else if (isPb(b.bond_type)) attentionPb.push({ contractor: b.contractor_name, expiry: fmtDate(b.expiry_date), days: dr })
    }
    attentionApb.sort((a, b) => a.days - b.days)
    attentionPb.sort((a, b) => a.days - b.days)
    const attentionList = [
      ...attentionApb.slice(0, 5).map(r => ({ bondType: 'Advance Payment', ...r })),
      ...attentionPb.slice(0, 5).map(r => ({ bondType: 'Performance', ...r })),
    ]

    const asOfDate = today.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    const fileDate = today.toISOString().split('T')[0].replace(/-/g, '')

    // ── Build workbook ────────────────────────────────────
    const wb = new ExcelJS.Workbook()
    wb.creator  = 'EF Architects & Engineers Consulting PLC'
    wb.created  = new Date()
    wb.modified = new Date()

    const ws = wb.addWorksheet('Bond-Expiry-Tracker')
    ws.views = [{ showGridLines: true, zoomScale: 100 }]

    const LAST_MAIN_COL = 'O' // B..O = main table
    const colWidths: Record<string, number> = {
      A: 2,  B: 7,  C: 34, D: 40, E: 34, F: 14, G: 14, H: 13,
      I: 14, J: 14, K: 15, L: 13, M: 14, N: 14, O: 24,
      P: 2,  Q: 24, R: 24, S: 14, T: 11,
    }
    Object.entries(colWidths).forEach(([col, w]) => { ws.getColumn(col).width = w })

    // ── Row 2 — Main title banner ─────────────────────────
    ws.mergeCells(`B2:${LAST_MAIN_COL}2`)
    const title = ws.getCell('B2')
    title.value = 'EF Architects & Engineers Consulting — Bond Expiry Date Follow-Up Tracker'
    title.font  = { name: 'Calibri', size: 14, bold: true, color: { argb: C.TITLE_FG } }
    title.alignment = { vertical: 'middle', horizontal: 'left' }
    ws.getRow(2).height = 32

    ws.mergeCells('Q2:T2')
    const alertBanner = ws.getCell('Q2')
    alertBanner.value = '⚠  NOTIFICATION ALERTS'
    alertBanner.font  = { name: 'Calibri', size: 13, bold: true, color: { argb: C.ALERT_BANNER_FG } }
    alertBanner.fill  = solidFill(C.ALERT_BANNER_BG)
    alertBanner.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }

    // ── Row 3 — metadata + bond-type section headers ──────
    ws.mergeCells('B3:E3')
    const meta = ws.getCell('B3')
    meta.value = `As of Date: ${asOfDate}   |   Procurement & Contract Administration Department`
    meta.font  = { name: 'Calibri', size: 9, italic: true, color: { argb: C.GRAY_FG } }
    meta.alignment = { vertical: 'middle', horizontal: 'left' }
    ws.getRow(3).height = 20

    ws.mergeCells('F3:H3')
    const apbHdr = ws.getCell('F3')
    apbHdr.value = 'ADVANCE PAYMENT BOND'
    apbHdr.font  = { name: 'Calibri', size: 11, bold: true, color: { argb: C.TEAL_FG } }
    apbHdr.fill  = solidFill(C.TEAL_BG)
    apbHdr.alignment = { vertical: 'middle', horizontal: 'center' }
    allBorders(apbHdr)

    ws.mergeCells('I3:L3')
    const pbHdr = ws.getCell('I3')
    pbHdr.value = 'PERFORMANCE BOND'
    pbHdr.font  = { name: 'Calibri', size: 11, bold: true, color: { argb: C.TEAL_FG } }
    pbHdr.fill  = solidFill(C.TEAL_BG)
    pbHdr.alignment = { vertical: 'middle', horizontal: 'center' }
    allBorders(pbHdr)

    // ── Row 4 — column headers + alert KPI 1 ──────────────
    const HEADERS = [
      'S/N', 'Employer Name', 'Project Name', 'Contractor Name',
      'Issue Date', 'Expiry Date', 'Status',
      'Issue Date', 'Expiry Date', 'Amount', 'Status',
      'APB Days\nto Expiry', 'PB Days\nto Expiry', 'Remarks',
    ]
    const hdrRow = ws.getRow(4)
    hdrRow.height = 34
    HEADERS.forEach((h, i) => {
      const cell = hdrRow.getCell(2 + i) // starts at col B
      cell.value = h
      cell.font  = { name: 'Calibri', size: 11, bold: true, color: { argb: C.NAVY_FG } }
      cell.fill  = solidFill(C.NAVY_BG)
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      cell.border = { top: C.MED, bottom: C.MED, left: C.THIN, right: C.THIN }
    })

    ws.getCell('Q4').value = '🔴 Expired Bonds'
    ws.mergeCells('R4:T4')
    setAlertRow(ws, 4, C.RED_BG, C.RED_FG, expiredCount)

    // ── Row 5 — alert KPI 2 ────────────────────────────────
    ws.getCell('Q5').value = '🟡 Expiring ≤ 30 Days'
    ws.mergeCells('R5:T5')
    setAlertRow(ws, 5, C.YELLOW_BG, C.YELLOW_FG, expiringCount)

    // ── Row 6 — alert KPI 3 ────────────────────────────────
    ws.getCell('Q6').value = '🟢 Safe (> 30 Days)'
    ws.mergeCells('R6:T6')
    setAlertRow(ws, 6, C.GREEN_BG, C.GREEN_FG, safeCount)

    // ── Row 8 — Bonds Requiring Attention banner ──────────
    ws.mergeCells('Q8:T8')
    const attnBanner = ws.getCell('Q8')
    attnBanner.value = 'BONDS REQUIRING ATTENTION'
    attnBanner.font  = { name: 'Calibri', size: 11, bold: true, color: { argb: C.NAVY_FG } }
    attnBanner.fill  = solidFill(C.NAVY_BG)
    attnBanner.alignment = { vertical: 'middle', horizontal: 'center' }
    allBorders(attnBanner)
    ws.getRow(8).height = 20

    // ── Row 9 — Attention table headers ───────────────────
    const attnHdrRow = ws.getRow(9)
    attnHdrRow.height = 18
    ;['Bond Type', 'Contractor', 'Expiry Date', 'Days Left'].forEach((h, i) => {
      const cell = attnHdrRow.getCell(17 + i) // Q=17
      cell.value = h
      cell.font  = { name: 'Calibri', size: 10, bold: true, color: { argb: C.ATTN_HDR_FG } }
      cell.fill  = solidFill(C.ATTN_HDR_BG)
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
      allBorders(cell)
    })

    // ── Rows 10+ — Attention data ─────────────────────────
    let attnRowNum = 10
    for (const a of attentionList) {
      const row = ws.getRow(attnRowNum)
      row.height = 20
      const vals = [a.bondType, a.contractor, a.expiry ?? '—', a.days]
      vals.forEach((v, ci) => {
        const cell = row.getCell(17 + ci)
        cell.value = v
        cell.font  = {
          name: 'Calibri', size: 9,
          color: { argb: ci === 3 && a.days <= 0 ? C.RED_FG : C.BLACK_FG },
          bold: ci === 3 && a.days <= 0,
        }
        cell.alignment = { vertical: 'middle', horizontal: ci <= 1 ? 'left' : 'center', indent: ci <= 1 ? 1 : 0 }
        allBorders(cell)
      })
      attnRowNum++
    }
    if (attentionList.length > 0) {
      attnRowNum++
      ws.mergeCells(`Q${attnRowNum}:T${attnRowNum}`)
      const note = ws.getCell(`Q${attnRowNum}`)
      note.value = 'Auto-sorted by nearest expiry date'
      note.font  = { name: 'Calibri', size: 8, italic: true, color: { argb: C.GRAY_FG } }
      note.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
    }

    // ── Rows 5+ — Main data table, grouped/merged by employer ─
    let currentRow = 5
    let sn = 1
    for (const employer of employerOrder) {
      const rows = employerRows.get(employer)!
      const startRow = currentRow
      const endRow = currentRow + rows.length - 1

      rows.forEach((prow, i) => {
        const r = currentRow + i
        const row = ws.getRow(r)
        row.height = 22
        const band = i % 2 === 0 ? C.BAND_A : C.BAND_B

        // Employer / S/N cells written once, merged across the whole block
        if (i === 0) {
          const snCell = ws.getCell(`B${r}`)
          snCell.value = sn
          snCell.font  = { name: 'Calibri', size: 11, color: { argb: C.SN_FG } }
          snCell.fill  = solidFill(C.SN_BG)
          snCell.alignment = { vertical: 'middle', horizontal: 'center' }
          allBorders(snCell)

          const empCell = ws.getCell(`C${r}`)
          empCell.value = employer
          empCell.font  = { name: 'Calibri', size: 11, color: { argb: C.BLACK_FG } }
          empCell.fill  = solidFill(C.BAND_B)
          empCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
          allBorders(empCell)

          if (endRow > startRow) {
            ws.mergeCells(`B${startRow}:B${endRow}`)
            ws.mergeCells(`C${startRow}:C${endRow}`)
          }
        }

        // Project Name
        const prjCell = row.getCell(4)
        prjCell.value = prow.project
        prjCell.font  = { name: 'Calibri', size: 11, color: { argb: C.BLACK_FG } }
        prjCell.fill  = solidFill(band)
        prjCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
        allBorders(prjCell)

        // Contractor Name
        const ctrCell = row.getCell(5)
        ctrCell.value = prow.contractor
        ctrCell.font  = { name: 'Calibri', size: 11, color: { argb: C.BLACK_FG } }
        ctrCell.fill  = solidFill(band)
        ctrCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
        allBorders(ctrCell)

        // APB Issue / Expiry / Status
        writeDateCell(row.getCell(6), fmtDate(prow.apb?.issue_date))
        writeDateCell(row.getCell(7), fmtDate(prow.apb?.expiry_date), today)
        writeBondCell(row.getCell(8), prow.apb
          ? liveStatus(prow.apb.status, prow.apb.expiry_date, today)
          : '—'
        )

        // PB Issue / Expiry / Amount / Status
        writeDateCell(row.getCell(9),  fmtDate(prow.pb?.issue_date))
        writeDateCell(row.getCell(10), fmtDate(prow.pb?.expiry_date), today)
        const amtVal = prow.pb?.amount ?? prow.apb?.amount ?? null
        const amtCell = row.getCell(11)
        if (amtVal != null) {
          amtCell.value  = amtVal
          amtCell.numFmt = '#,##0.00'
        } else {
          amtCell.value = '—'
        }
        amtCell.font  = { name: 'Calibri', size: 10, color: { argb: C.BLACK_FG } }
        amtCell.fill  = solidFill(band)
        amtCell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 }
        allBorders(amtCell)
        writeBondCell(row.getCell(12), prow.pb
          ? liveStatus(prow.pb.status, prow.pb.expiry_date, today)
          : '—'
        )

        // APB / PB Days to Expiry
        const apbDr = daysRemaining(prow.apb?.expiry_date, today)
        const pbDr  = daysRemaining(prow.pb?.expiry_date, today)
        const apbDrCell = row.getCell(13)
        apbDrCell.value = apbDr ?? '—'
        apbDrCell.font  = { name: 'Calibri', size: 10, color: { argb: C.BLACK_FG } }
        apbDrCell.fill  = solidFill(band)
        apbDrCell.alignment = { vertical: 'middle', horizontal: 'center' }
        allBorders(apbDrCell)

        const pbDrCell = row.getCell(14)
        pbDrCell.value = pbDr ?? '—'
        pbDrCell.font  = { name: 'Calibri', size: 10, color: { argb: C.BLACK_FG } }
        pbDrCell.fill  = solidFill(band)
        pbDrCell.alignment = { vertical: 'middle', horizontal: 'center' }
        allBorders(pbDrCell)

        // Remarks — surfaces any overflow bonds (2nd APB/PB, unrecognized type) so nothing is hidden;
        // otherwise left blank for manual annotation
        const remCell = row.getCell(15)
        if (prow.extra.length > 0) {
          remCell.value = prow.extra
            .map(x => `${x.bond_type}: ${fmtDate(x.expiry_date) ?? '—'} (${x.status})${x.amount != null ? ` — ${x.amount.toLocaleString()}` : ''}`)
            .join('; ')
          remCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: C.RED_FG } }
        } else {
          remCell.value = ''
          remCell.font  = { name: 'Calibri', size: 10, color: { argb: C.GRAY_FG } }
        }
        remCell.fill  = solidFill(band)
        remCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
        allBorders(remCell)
      })

      currentRow = endRow + 1
      sn++
    }

    // ── 5 blank numbered rows for manual additions ─────────
    for (let i = 1; i <= 5; i++) {
      const row = ws.getRow(currentRow)
      row.height = 22
      const snCell = row.getCell(2)
      snCell.value = sn + i - 1
      snCell.font  = { name: 'Calibri', size: 11, color: { argb: C.SN_FG } }
      snCell.fill  = solidFill(C.SN_BG)
      snCell.alignment = { horizontal: 'center', vertical: 'middle' }
      for (let c = 2; c <= 15; c++) allBorders(row.getCell(c))
      currentRow++
    }

    // ── Footer ──────────────────────────────────────────────
    ws.mergeCells(`B${currentRow}:${LAST_MAIN_COL}${currentRow}`)
    const footer = ws.getCell(`B${currentRow}`)
    footer.value = `Generated: ${asOfDate}  |  EF Architects & Engineers Consulting PLC  |  Procurement & Contract Administration Department`
    footer.font  = { name: 'Calibri', size: 8, italic: true, color: { argb: C.GRAY_FG } }
    footer.fill  = solidFill(C.SLATE_BG)
    footer.alignment = { vertical: 'middle', horizontal: 'center' }
    ws.getRow(currentRow).height = 14

    ws.views = [{ showGridLines: true, zoomScale: 100, state: 'frozen', xSplit: 0, ySplit: 4 }]

    // ── Stream workbook as binary attachment ──────────────
    const buffer = await wb.xlsx.writeBuffer()

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="EF_Bond_Expiry_Tracker_${fileDate}.xlsx"`,
        'Cache-Control':       'no-store',
      },
    })
  } catch (err) {
    console.error('[export-bonds] Unexpected error:', err)
    return NextResponse.json({ error: 'Unexpected server error generating export.' }, { status: 500 })
  }
}

// ── Small helpers used inside the handler ─────────────────
function setAlertRow(ws: ExcelJS.Worksheet, rowNum: number, bg: string, fg: string, value: number) {
  const label = ws.getCell(`Q${rowNum}`)
  label.font  = { name: 'Calibri', size: 11, bold: true, color: { argb: fg } }
  label.fill  = solidFill(bg)
  label.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  allBorders(label)

  const valCell = ws.getCell(`R${rowNum}`)
  valCell.value = value
  valCell.font  = { name: 'Calibri', size: 14, bold: true, color: { argb: fg } }
  valCell.fill  = solidFill(bg)
  valCell.alignment = { vertical: 'middle', horizontal: 'center' }
  allBorders(valCell)
  ws.getRow(rowNum).height = 20
}

function writeDateCell(cell: ExcelJS.Cell, value: string | null, today?: Date) {
  // If a reference date is passed and the date is past, use red tint for the expiry column
  let bg = 'FFCCFFCC'
  if (!value) {
    cell.value = '—'
    cell.font  = { name: 'Calibri', size: 10, color: { argb: 'FF9CA3AF' } }
    cell.fill  = solidFill('FFF3F4F6')
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    allBorders(cell)
    return
  }
  if (today) {
    const exp = new Date(value)
    exp.setHours(0, 0, 0, 0)
    if (exp.getTime() < today.getTime()) bg = C.RED_BG
  }
  // Write as a real JS Date so Excel stores it as a proper date value,
  // then apply a display format — this prevents the cell showing as a number
  const parts = value.split('-')
  if (parts.length === 3) {
    const yr = parseInt(parts[0], 10)
    const mo = parseInt(parts[1], 10) - 1
    const dy = parseInt(parts[2], 10)
    cell.value  = new Date(yr, mo, dy)
    cell.numFmt = 'yyyy-mm-dd'
  } else {
    cell.value = value
  }
  cell.font  = { name: 'Calibri', size: 10, color: { argb: 'FF000000' } }
  cell.fill  = solidFill(bg)
  cell.alignment = { vertical: 'middle', horizontal: 'center' }
  allBorders(cell)
}

// Compute the real live status from expiry date, mirroring /api/bonds logic:
// - Released stays Released regardless of date
// - Otherwise: expired if days_remaining <= 0, else Active
function liveStatus(rawStatus: string, expiryDate: string | null | undefined, today: Date): string {
  if (rawStatus === 'Released') return 'Released'
  if (!expiryDate) return rawStatus
  const dr = daysRemaining(expiryDate, today)
  if (dr == null) return rawStatus
  return dr <= 0 ? 'Expired' : 'Active'
}

function writeBondCell(cell: ExcelJS.Cell, status: string) {
  let bg: string
  let fg: string
  let prefix: string
  switch (status) {
    case 'Expired':
      bg = C.RED_BG;    fg = C.RED_FG;    prefix = '🔴 '; break
    case 'Released':
      bg = C.GREEN_BG;  fg = C.GREEN_FG;  prefix = '🟢 '; break
    case '—':
      bg = 'FFF3F4F6'; fg = 'FF9CA3AF'; prefix = ''; break
    default: // Active
      bg = C.YELLOW_BG; fg = C.YELLOW_FG; prefix = '🟡 '; break
  }
  cell.value = status === '—' ? '—' : `${prefix}${status}`
  cell.font  = { name: 'Calibri', size: 10, bold: status === 'Expired', color: { argb: fg } }
  cell.fill  = solidFill(bg)
  cell.alignment = { vertical: 'middle', horizontal: 'center' }
  allBorders(cell)
}