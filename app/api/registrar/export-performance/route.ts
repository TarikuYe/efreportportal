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
    .from('employees')
    .select('role')
    .eq('id', userId)
    .maybeSingle()
  return emp?.role === 'admin' || emp?.role === 'dgm'
}

// ── Colour palette (AARRGGBB) ─────────────────────────────
const C = {
  // Header / structure
  NAVY_BG:      'FF1E3A8A',   // Corporate navy — main banner
  NAVY_FG:      'FFFFFFFF',   // White on navy
  SLATE_BG:     'FFE2E8F0',   // Header row fill
  BLACK_FG:     'FF111827',
  GRAY_FG:      'FF475569',
  MUTED_FG:     'FF64748B',
  // ── 5-tier performance fills (exact scale from company template) ──
  // Rank A  90–100  Outstanding
  A_BG:         'FFD1FAE5',   // Soft mint green
  A_FG:         'FF065F46',   // Dark emerald
  // Rank B  80–89   Very Good
  B_BG:         'FFDBEAFE',   // Soft sky blue
  B_FG:         'FF1D4ED8',   // Dark blue
  // Rank C  70–79   Good
  C_BG:         'FFFEF9C3',   // Soft yellow
  C_FG:         'FF713F12',   // Dark yellow-brown
  // Rank D  60–69   Satisfactory
  D_BG:         'FFFEF3C7',   // Soft amber
  D_FG:         'FF92400E',   // Dark amber
  // Rank E  < 60    Needs Improvement
  E_BG:         'FFFEE2E2',   // Soft red
  E_FG:         'FF991B1B',   // Dark red
  // Row banding
  BAND_A:       'FFFFFFFF',
  BAND_B:       'FFF8FAFC',
  THIN:  { style: 'thin'   as const },
  MED:   { style: 'medium' as const },
}

// ── Utility helpers ───────────────────────────────────────
function solidFill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}
function allBorders(cell: ExcelJS.Cell) {
  cell.border = { top: C.THIN, bottom: C.THIN, left: C.THIN, right: C.THIN }
}
function medBorders(cell: ExcelJS.Cell) {
  cell.border = { top: C.MED, bottom: C.MED, left: C.MED, right: C.MED }
}
function cleanStr(v: string | null | undefined): string {
  const s = v?.trim()
  return s || '—'
}
function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  return String(d).substring(0, 10)
}

// ── DB + computed row shape ───────────────────────────────
type EvalRow = {
  id:                       string
  employee_name:            string
  employee_email:           string
  department:               string
  period_start:             string
  period_end:               string
  // Raw 0-100 scores stored in DB
  tech_score:               number   // weight 40 %
  prod_score:               number   // weight 30 %
  punc_score:               number   // weight 10 %
  comm_score:               number   // weight  5 %
  rep_score:                number   // weight  5 %
  adapt_score:              number   // weight 10 %
  // Weighted contributions (score × weight / 100)
  tech_weighted:            number
  prod_weighted:            number
  punc_weighted:            number
  comm_weighted:            number
  rep_weighted:             number
  adapt_weighted:           number
  // Aggregate
  total_score:              number
  performance_level:        string
  grade:                    string   // A | B | C | D | E
}

// ── 5-tier ranking scale (exact match to company template) ──
// Score 90–100 → Outstanding  → A
// Score 80–89  → Very Good    → B
// Score 70–79  → Good         → C
// Score 60–69  → Satisfactory → D
// Score < 60   → Needs Improvement → E
function computeLevel(total: number): string {
  if (total >= 90) return 'Outstanding'
  if (total >= 80) return 'Very Good'
  if (total >= 70) return 'Good'
  if (total >= 60) return 'Satisfactory'
  return 'Needs Improvement'
}

function computeGrade(total: number): string {
  if (total >= 90) return 'A'
  if (total >= 80) return 'B'
  if (total >= 70) return 'C'
  if (total >= 60) return 'D'
  return 'E'
}

// Returns the bg/fg colour pair for a given total score
function tierColors(total: number): [string, string] {
  if (total >= 90) return [C.A_BG, C.A_FG]
  if (total >= 80) return [C.B_BG, C.B_FG]
  if (total >= 70) return [C.C_BG, C.C_FG]
  if (total >= 60) return [C.D_BG, C.D_FG]
  return [C.E_BG, C.E_FG]
}

// Weighted contribution: raw score × weight / 100
function weighted(raw: number, weight: number): number {
  return (raw * weight) / 100
}

// ── GET /api/registrar/export-performance ─────────────────
export async function GET(_req: Request) {
  try {
    // 1. Auth
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user)
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    if (!(await checkAdminOrDgm(user.id)))
      return NextResponse.json({ error: 'Admin or DGM access required.' }, { status: 403 })

    // 2. Fetch all performance evaluations, paginated, sorted by employee name ASC
    const admin = createAdminClient()
    const PAGE_SIZE = 1000
    let rawAll: any[] = []
    let page = 0
    while (true) {
      const { data: pageData, error } = await admin
        .from('performance_evaluations')
        .select('*, employees(full_name, email, department)')
        .order('employee_id', { ascending: true })          // stable secondary sort
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

      if (error) {
        console.error('[export-performance] DB:', error.message)
        return NextResponse.json({ error: 'Failed to retrieve evaluation records.' }, { status: 500 })
      }
      rawAll = rawAll.concat(pageData ?? [])
      if (!pageData || pageData.length < PAGE_SIZE) break
      page++
    }

    // 3. Normalise, compute weighted scores, sort alphabetically by employee name
    const rows: EvalRow[] = rawAll
      .map((r: any): EvalRow => {
        const emp = r.employees ?? {}
        const tech  = Number(r.tech_competence_score  ?? 0)
        const prod  = Number(r.productivity_score      ?? 0)
        const punc  = Number(r.punctuality_score       ?? 0)
        const comm  = Number(r.communication_score     ?? 0)
        const rep   = Number(r.reporting_score         ?? 0)
        const adapt = Number(r.adaptability_score      ?? 0)

        const techW  = weighted(tech,  40)
        const prodW  = weighted(prod,  30)
        const puncW  = weighted(punc,  10)
        const commW  = weighted(comm,   5)
        const repW   = weighted(rep,    5)
        const adaptW = weighted(adapt, 10)
        const total  = techW + prodW + puncW + commW + repW + adaptW

        return {
          id:               r.id,
          employee_name:    cleanStr(emp.full_name),
          employee_email:   cleanStr(emp.email),
          department:       cleanStr(emp.department),
          period_start:     fmtDate(r.evaluation_period_start),
          period_end:       fmtDate(r.evaluation_period_end),
          tech_score:       tech,
          prod_score:       prod,
          punc_score:       punc,
          comm_score:       comm,
          rep_score:        rep,
          adapt_score:      adapt,
          tech_weighted:    techW,
          prod_weighted:    prodW,
          punc_weighted:    puncW,
          comm_weighted:    commW,
          rep_weighted:     repW,
          adapt_weighted:   adaptW,
          total_score:      total,
          // Prefer DB-computed level; fall back to local computation
          performance_level: cleanStr(r.performance_level) !== '—'
            ? cleanStr(r.performance_level)
            : computeLevel(total),
          grade:            computeGrade(total),
        }
      })
      .sort((a, b) => a.employee_name.localeCompare(b.employee_name))

    // 4. KPI tallies — exact 5-tier scale
    const totalRecords  = rows.length
    const rankACount    = rows.filter(r => r.total_score >= 90).length   // Outstanding
    const rankBCount    = rows.filter(r => r.total_score >= 80 && r.total_score < 90).length  // Very Good
    const rankCCount    = rows.filter(r => r.total_score >= 70 && r.total_score < 80).length  // Good
    const rankDCount    = rows.filter(r => r.total_score >= 60 && r.total_score < 70).length  // Satisfactory
    const rankECount    = rows.filter(r => r.total_score < 60).length    // Needs Improvement
    const avgScore      = totalRecords > 0
      ? rows.reduce((sum, r) => sum + r.total_score, 0) / totalRecords
      : 0

    const today    = new Date()
    today.setHours(0, 0, 0, 0)
    const asOfDate = today.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    const fileDate = today.toISOString().split('T')[0].replace(/-/g, '')

    // ── Build workbook ────────────────────────────────────
    const wb = new ExcelJS.Workbook()
    wb.creator  = 'EF Architects & Engineers Consulting PLC'
    wb.created  = new Date()
    wb.modified = new Date()

    const ws = wb.addWorksheet('Performance-Evaluations')
    ws.views = [{
      showGridLines: true,
      zoomScale:     100,
      state:         'frozen',
      xSplit:        0,
      ySplit:        5,   // freeze through KPI bar + header row
    }]

    // ── Column definitions ────────────────────────────────
    // A: Employee Name | B: Email | C: Department | D: Period Start | E: Period End
    // F: Tech (40%)    | G: Prod (30%) | H: Punc (10%) | I: Comm (5%) | J: Rep (5%) | K: Adapt (10%)
    // L: Total Score   | M: Performance Level | N: Grade
    const COL_WIDTHS = [
      32,   // A  Employee Name
      28,   // B  Email
      28,   // C  Department
      13,   // D  Period Start
      13,   // E  Period End
      16,   // F  Tech Competence (40%)
      15,   // G  Productivity (30%)
      14,   // H  Punctuality (10%)
      16,   // I  Communication (5%)
      13,   // J  Reporting (5%)
      15,   // K  Adaptability (10%)
      13,   // L  Total Score
      24,   // M  Performance Level
       8,   // N  Grade (A/B/C/D/E)
    ]
    COL_WIDTHS.forEach((w, i) => { ws.getColumn(i + 1).width = w })

    // ═════════════════════════════════════════════════════
    // ROW 1 — Main corporate banner  (A1:N1)
    // ═════════════════════════════════════════════════════
    ws.mergeCells('A1:N1')
    const titleCell    = ws.getCell('A1')
    titleCell.value    = 'EF Architects & Engineers Consulting — Performance Evaluations Master Log'
    titleCell.font     = { name: 'Calibri', size: 14, bold: true, color: { argb: C.NAVY_FG } }
    titleCell.fill     = solidFill(C.NAVY_BG)
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
    ws.getRow(1).height = 38

    // ─────────────────────────────────────────────────────
    // ROW 2 — blank spacer
    // ─────────────────────────────────────────────────────
    ws.mergeCells('A2:N2')
    ws.getCell('A2').fill = solidFill('FFF1F5F9')
    ws.getRow(2).height   = 6

    // ═════════════════════════════════════════════════════
    // ROW 3 — Operational metadata
    // ═════════════════════════════════════════════════════
    ws.getRow(3).height = 22

    ws.mergeCells('A3:H3')
    const prepCell    = ws.getCell('A3')
    prepCell.value    = 'Prepared By: Human Resources & Procurement Department'
    prepCell.font     = { name: 'Calibri', size: 10, italic: true, color: { argb: C.GRAY_FG } }
    prepCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
    prepCell.fill     = solidFill('FFF8FAFC')

    ws.mergeCells('I3:N3')
    const dateCell    = ws.getCell('I3')
    dateCell.value    = `Export Date: ${asOfDate}`
    dateCell.font     = { name: 'Calibri', size: 10, bold: true, color: { argb: C.BLACK_FG } }
    dateCell.alignment = { vertical: 'middle', horizontal: 'right' }
    dateCell.fill     = solidFill('FFF8FAFC')

    // ═════════════════════════════════════════════════════
    // ROW 4 — KPI summary bar  (5 tiers, exact ranking scale)
    // ═════════════════════════════════════════════════════
    ws.getRow(4).height = 24

    // A4:B4  Total | C4:D4  Rank A | E4:F4  Rank B | G4:H4  Rank C | I4:J4  Rank D | K4:L4  Rank E | M4:N4  Avg
    const kpiDefs: [string, number | string, string, string][] = [
      [`Total: ${totalRecords}`,                      '', C.NAVY_BG,  C.NAVY_FG],
      [`A — Outstanding: ${rankACount}`,              '', C.A_BG,     C.A_FG],
      [`B — Very Good: ${rankBCount}`,                '', C.B_BG,     C.B_FG],
      [`C — Good: ${rankCCount}`,                     '', C.C_BG,     C.C_FG],
      [`D — Satisfactory: ${rankDCount}`,             '', C.D_BG,     C.D_FG],
      [`E — Needs Improvement: ${rankECount}`,        '', C.E_BG,     C.E_FG],
      [`Avg Score: ${avgScore.toFixed(1)}%`,          '', C.NAVY_BG,  C.NAVY_FG],
    ]
    const kpiRanges = ['A4:B4', 'C4:D4', 'E4:F4', 'G4:H4', 'I4:J4', 'K4:L4', 'M4:N4']

    kpiDefs.forEach(([label, , bg, fg], i) => {
      ws.mergeCells(kpiRanges[i])
      const cell     = ws.getCell(kpiRanges[i].split(':')[0])
      cell.value     = label
      cell.font      = { name: 'Calibri', size: 10, bold: true, color: { argb: fg } }
      cell.fill      = solidFill(bg)
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
      medBorders(cell)
    })

    // ═════════════════════════════════════════════════════
    // ROW 5 — Table column headers
    // ═════════════════════════════════════════════════════
    ws.getRow(5).height = 32

    const HEADERS = [
      'Employee Name',
      'Email',
      'Department',
      'Period Start',
      'Period End',
      'Tech Competence\n(40%)',
      'Productivity\n(30%)',
      'Punctuality\n(10%)',
      'Communication\n(5%)',
      'Reporting\n(5%)',
      'Adaptability\n(10%)',
      'Total Score',
      'Performance Level',
      'Grade',
    ]
    HEADERS.forEach((h, i) => {
      const cell = ws.getRow(5).getCell(i + 1)
      cell.value = h
      cell.font  = { name: 'Calibri', size: 11, bold: true, color: { argb: C.BLACK_FG } }
      cell.fill  = solidFill(C.SLATE_BG)
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      cell.border = { top: C.MED, bottom: C.MED, left: C.THIN, right: C.THIN }
    })

    // ═════════════════════════════════════════════════════
    // ROWS 6+ — Employee data
    // ═════════════════════════════════════════════════════
    rows.forEach((r, idx) => {
      const rowNum = 6 + idx
      const row    = ws.getRow(rowNum)
      row.height   = 20
      const band   = idx % 2 === 0 ? C.BAND_A : C.BAND_B

      // ── Col A: Employee Name
      const nameCell    = row.getCell(1)
      nameCell.value    = r.employee_name
      nameCell.font     = { name: 'Calibri', size: 10, bold: true, color: { argb: C.BLACK_FG } }
      nameCell.fill     = solidFill(band)
      nameCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
      allBorders(nameCell)

      // ── Col B: Email
      const emailCell    = row.getCell(2)
      emailCell.value    = r.employee_email
      emailCell.font     = { name: 'Calibri', size: 9, color: { argb: C.GRAY_FG } }
      emailCell.fill     = solidFill(band)
      emailCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
      allBorders(emailCell)

      // ── Col C: Department
      const deptCell    = row.getCell(3)
      deptCell.value    = r.department
      deptCell.font     = { name: 'Calibri', size: 9, color: { argb: C.BLACK_FG } }
      deptCell.fill     = solidFill(band)
      deptCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
      allBorders(deptCell)

      // ── Col D: Period Start (YYYY-MM-DD)
      const startCell    = row.getCell(4)
      startCell.value    = r.period_start !== '—' ? r.period_start : '—'
      startCell.font     = { name: 'Calibri', size: 9, color: { argb: C.BLACK_FG } }
      startCell.fill     = solidFill(band)
      startCell.alignment = { vertical: 'middle', horizontal: 'center' }
      allBorders(startCell)

      // ── Col E: Period End
      const endCell    = row.getCell(5)
      endCell.value    = r.period_end !== '—' ? r.period_end : '—'
      endCell.font     = { name: 'Calibri', size: 9, color: { argb: C.BLACK_FG } }
      endCell.fill     = solidFill(band)
      endCell.alignment = { vertical: 'middle', horizontal: 'center' }
      allBorders(endCell)

      // ── Cols F–K: Weighted score contributions (score × weight / 100)
      const scoreValues = [
        r.tech_weighted,   // F  40%
        r.prod_weighted,   // G  30%
        r.punc_weighted,   // H  10%
        r.comm_weighted,   // I   5%
        r.rep_weighted,    // J   5%
        r.adapt_weighted,  // K  10%
      ]
      scoreValues.forEach((val, ci) => {
        const cell     = row.getCell(6 + ci)
        cell.value     = parseFloat(val.toFixed(2))
        cell.numFmt    = '0.00'
        cell.font      = { name: 'Calibri', size: 10, color: { argb: C.BLACK_FG } }
        cell.fill      = solidFill(band)
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
        allBorders(cell)
      })

      // ── Col L: Total Score — Excel SUM formula (F:K for this row)
      const totalCell    = row.getCell(12)
      totalCell.value    = { formula: `SUM(F${rowNum}:K${rowNum})` }
      totalCell.numFmt   = '0.00'
      totalCell.font     = { name: 'Calibri', size: 10, bold: true, color: { argb: C.BLACK_FG } }
      totalCell.fill     = solidFill(band)
      totalCell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 }
      allBorders(totalCell)

      // ── Col M: Performance Level — 5-tier conditional fill (exact company scale)
      const [lvlBg, lvlFg] = tierColors(r.total_score)
      const needsFlag = r.total_score < 60
      const lvlCell = row.getCell(13)
      lvlCell.value    = needsFlag ? `⚠️ ${r.performance_level}` : r.performance_level
      lvlCell.font     = { name: 'Calibri', size: 10, bold: true, color: { argb: lvlFg } }
      lvlCell.fill     = solidFill(lvlBg)
      lvlCell.alignment = { vertical: 'middle', horizontal: 'center' }
      allBorders(lvlCell)

      // ── Col N: Grade (A / B / C / D / E)
      const gradeCell = row.getCell(14)
      gradeCell.value    = r.grade
      gradeCell.font     = { name: 'Calibri', size: 12, bold: true, color: { argb: lvlFg } }
      gradeCell.fill     = solidFill(lvlBg)
      gradeCell.alignment = { vertical: 'middle', horizontal: 'center' }
      allBorders(gradeCell)
    })

    // ── 3 blank placeholder rows ───────────────────────────
    const dataEndRow = 6 + rows.length
    for (let i = 0; i < 3; i++) {
      const rowNum = dataEndRow + i
      const row    = ws.getRow(rowNum)
      row.height   = 20
      for (let c = 1; c <= 14; c++) allBorders(row.getCell(c))
    }
    const footerRow = dataEndRow + 3

    // ── Performance Level Legend block (all 5 tiers + grades) ──
    const legendRow = footerRow - 1
    ws.getRow(legendRow).height = 18

    // 5 legend tiles: A–C (cols 1-3), D–F (4-6), G–I (7-9), J–K (10-11), L–N (12-14)
    const legendDefs: [string, number, number, string, string][] = [
      ['A — 90–100 · Outstanding',       1,  2,  C.A_BG, C.A_FG],
      ['B — 80–89  · Very Good',          3,  5,  C.B_BG, C.B_FG],
      ['C — 70–79  · Good',               6,  8,  C.C_BG, C.C_FG],
      ['D — 60–69  · Satisfactory',       9, 11,  C.D_BG, C.D_FG],
      ['E — < 60   · ⚠️ Needs Improvement', 12, 14, C.E_BG, C.E_FG],
    ]
    legendDefs.forEach(([text, colStart, colEnd, bg, fg]) => {
      const startAddr = `${colLetter(colStart)}${legendRow}`
      const endAddr   = `${colLetter(colEnd)}${legendRow}`
      ws.mergeCells(`${startAddr}:${endAddr}`)
      const cell    = ws.getCell(startAddr)
      cell.value    = text
      cell.font     = { name: 'Calibri', size: 9, bold: true, color: { argb: fg } }
      cell.fill     = solidFill(bg)
      cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
      allBorders(cell)
    })

    // ── Footer ──────────────────────────────────────────────
    ws.mergeCells(`A${footerRow}:N${footerRow}`)
    const footer    = ws.getCell(`A${footerRow}`)
    footer.value    = `Generated: ${asOfDate}  |  EF Architects & Engineers Consulting PLC  |  Human Resources & Procurement Department`
    footer.font     = { name: 'Calibri', size: 8, italic: true, color: { argb: C.MUTED_FG } }
    footer.fill     = solidFill(C.SLATE_BG)
    footer.alignment = { vertical: 'middle', horizontal: 'center' }
    ws.getRow(footerRow).height = 14

    // ── Stream workbook as binary attachment ──────────────
    const buffer = await wb.xlsx.writeBuffer()

    return new NextResponse(buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="EF_Performance_Evaluations_${fileDate}.xlsx"`,
        'Cache-Control':       'no-store, max-age=0',
      },
    })
  } catch (err) {
    console.error('[export-performance] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Export failed: ' + (err instanceof Error ? err.message : String(err)) },
      { status: 500 }
    )
  }
}

// ── Small helper: column index (1-based) → letter ─────────
function colLetter(n: number): string {
  let s = ''
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}
