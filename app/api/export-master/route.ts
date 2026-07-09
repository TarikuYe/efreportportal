import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ExcelJS from 'exceljs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function checkDGM(userId: string) {
  const admin = createAdminClient()
  const { data: employee } = await admin
    .from('employees')
    .select('role')
    .eq('id', userId)
    .maybeSingle()
  return employee?.role === 'dgm'
}

// Color palettes for formatting (AARRGGBB format)
const BRAND_HEADER_BG = 'FF1E3A8A' // Corporate Dark Blue #1e3a8a
const BRAND_HEADER_FG = 'FFFFFFFF' // White
const TABLE_HEADER_BG = 'FF3F4E66' // Soft navy/gray
const TABLE_HEADER_FG = 'FFFFFFFF' // White

const COLOR_SUCCESS_BG = 'FFDCFCE7' // Light green
const COLOR_SUCCESS_FG = 'FF15803D' // Dark green

const COLOR_WARNING_BG = 'FFFEF9C3' // Light yellow
const COLOR_WARNING_FG = 'FFA16207' // Dark yellow

const COLOR_DANGER_BG = 'FFFEE2E2' // Light red
const COLOR_DANGER_FG = 'FFB91C1C' // Dark red

const COLOR_INFO_BG = 'FFDBEAFE' // Light blue
const COLOR_INFO_FG = 'FF1D4ED8' // Dark blue

const COLOR_NEUTRAL_BG = 'FFF3F4F6' // Light gray
const COLOR_NEUTRAL_FG = 'FF374151' // Dark gray

// GET /api/export-master
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const isUserDgm = await checkDGM(user.id)
    if (!isUserDgm) {
      return NextResponse.json({ error: 'DGM access required.' }, { status: 403 })
    }

    const admin = createAdminClient()
    const todayStr = new Date().toLocaleDateString('en-US', { dateStyle: 'medium' })
    const todayISO = new Date().toISOString().split('T')[0]

    // Fetch all trackers
    const [
      { data: logs },
      { data: letters },
      { data: bonds },
      { data: eots },
      { data: evals }
    ] = await Promise.all([
      admin.from('daily_work_logs').select('*, employees(full_name, email, department)').eq('approval_status', 'Approved').order('log_date', { ascending: false }),
      admin.from('correspondence_register').select('*').order('date_logged', { ascending: false }),
      admin.from('project_bonds').select('*').order('expiry_date', { ascending: true }),
      admin.from('eot_tracker').select('*').order('revised_completion_date', { ascending: true }),
      admin.from('performance_evaluations').select('*, employees(full_name, email, department)').order('evaluation_period_end', { ascending: false })
    ])

    // Create Excel Workbook
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'EF Architects & Engineers Consulting PLC'
    workbook.created = new Date()

    // Setup helper style applier for table headers on other sheets
    const applyTableHeaders = (worksheet: ExcelJS.Worksheet, headers: string[]) => {
      // Title row
      worksheet.mergeCells(1, 1, 1, headers.length)
      const titleCell = worksheet.getCell(1, 1)
      titleCell.value = `EF Architects & Engineers Consulting - ${worksheet.name} (As of ${todayISO})`
      titleCell.font = { name: 'Inter', size: 14, bold: true, color: { argb: BRAND_HEADER_FG } }
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_HEADER_BG } }
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
      worksheet.getRow(1).height = 40

      // Table Header Row
      const headerRow = worksheet.getRow(3)
      headerRow.values = headers
      headerRow.height = 28
      
      for (let i = 1; i <= headers.length; i++) {
        const cell = headerRow.getCell(i)
        cell.font = { name: 'Inter', size: 11, bold: true, color: { argb: TABLE_HEADER_FG } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TABLE_HEADER_BG } }
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
        cell.border = {
          top: { style: 'thin' },
          bottom: { style: 'medium' },
          left: { style: 'thin' },
          right: { style: 'thin' }
        }
      }
    }

    // Helper to style data rows uniformly
    const applyRowStyles = (row: ExcelJS.Row, colsCount: number) => {
      for (let i = 1; i <= colsCount; i++) {
        const cell = row.getCell(i)
        cell.border = {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' }
        }
        if (!cell.font) {
          cell.font = { name: 'Inter', size: 10 }
        }
      }
    }

    const applyStatusStyle = (cell: ExcelJS.Cell, bg: string, fg: string) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
      cell.font = { name: 'Inter', size: 10, bold: true, color: { argb: fg } }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
    }

    const autoFitColumns = (worksheet: ExcelJS.Worksheet) => {
      worksheet.columns.forEach(column => {
        let maxLen = 0
        column.eachCell!({ includeEmpty: true }, cell => {
          if (cell.row === 1 || cell.row === 2) return // ignore title and spacer rows
          
          let cellText = ''
          if (cell.value && typeof cell.value === 'object') {
            if ('text' in cell.value) {
              cellText = String(cell.value.text)
            } else if (cell.value instanceof Date) {
              cellText = cell.value.toISOString().split('T')[0]
            } else {
              cellText = JSON.stringify(cell.value)
            }
          } else {
            cellText = cell.value ? String(cell.value) : ''
          }
          
          const lines = cellText.split('\n')
          lines.forEach(line => {
            if (line.length > maxLen) {
              maxLen = line.length
            }
          })
        })
        column.width = Math.max(12, Math.min(60, maxLen + 4))
      })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // ────────────────────────────────────────────────────────
    // 0. SHEET: Audit Diagnostics (FIRST TAB, Index 0)
    // ────────────────────────────────────────────────────────
    const wsDiag = workbook.addWorksheet('Audit Diagnostics')
    wsDiag.views = [{ showGridLines: true }]
    wsDiag.columns = [{ width: 42 }, { width: 58 }]
    
    // Header for diagnostic sheet
    wsDiag.mergeCells('A1:B1')
    const diagTitle = wsDiag.getCell('A1')
    diagTitle.value = 'EF Architects & Engineers - Executive Audit & Verification Log'
    diagTitle.font = { name: 'Inter', size: 14, bold: true, color: { argb: BRAND_HEADER_FG } }
    diagTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_HEADER_BG } }
    diagTitle.alignment = { vertical: 'middle', horizontal: 'center' }
    wsDiag.getRow(1).height = 40

    // Dynamic timestamp generation
    const formatTimestamp = (date: Date) => {
      const pad = (num: number) => String(num).padStart(2, '0')
      return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} UTC`
    }
    const nowTimestamp = formatTimestamp(new Date())
    
    wsDiag.addRow([]) // Row 2: blank spacer
    wsDiag.addRow(['Audit Parameter', 'Audit Evidence / Timestamp Value']) // Row 3: Headers
    wsDiag.getRow(3).font = { name: 'Inter', size: 11, bold: true }
    
    wsDiag.addRow(['Audit Review Status', 'VERIFIED & LOCKED']) // Row 4
    wsDiag.addRow(['Audit Review Completed By DGM on', nowTimestamp]) // Row 5
    wsDiag.addRow(['Database Query Filter Enforcement', 'daily_work_logs.approval_status = \'Approved\'']) // Row 6
    wsDiag.addRow(['System Verification Signature', 'DGM CONTROL TOWER EXECUTIVE SECURE EXPORT GATE']) // Row 7
    wsDiag.addRow(['Export Date', todayISO]) // Row 8

    // Style the diagnostic sheet rows & borders
    for (let r = 3; r <= 8; r++) {
      const row = wsDiag.getRow(r)
      row.getCell(1).border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
      row.getCell(2).border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
      row.getCell(1).font = { name: 'Inter', size: 11, bold: r === 3 }
      row.getCell(2).font = { name: 'Inter', size: 11, bold: r === 3 }
      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' }
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' }
    }

    // Highlight the status cell in light green and dark green text
    const reviewStatusValueCell = wsDiag.getCell('B4')
    reviewStatusValueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBBF7D0' } }
    reviewStatusValueCell.font = { name: 'Inter', size: 11, bold: true, color: { argb: 'FF166534' } }

    // ────────────────────────────────────────────────────────
    // 1. SHEET: Daily Work Logs
    // ────────────────────────────────────────────────────────
    const wsLogs = workbook.addWorksheet('Daily Work Logs')
    wsLogs.views = [{ showGridLines: true }]
    const headersLogs = [
      'Log Date', 'Day of Week', 'Employee Name', 'Department', 'Assigned Tasks', 
      'Actual Work Done', 'Hours Worked', 'Onsite Hours', 'Completion %', 
      'Done at Home', 'Office Entrance', 'Office Leave', 'Approval Status', 
      'Head Comments', 'Remark'
    ]
    applyTableHeaders(wsLogs, headersLogs)

    if (!logs || logs.length === 0) {
      // Empty template fallback warning message
      wsLogs.mergeCells('A4:O4')
      const msgCell = wsLogs.getCell('A4')
      msgCell.value = 'No approved data logs found for this period.'
      msgCell.font = { name: 'Inter', size: 12, bold: true, color: { argb: COLOR_WARNING_FG } }
      msgCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_WARNING_BG } }
      msgCell.alignment = { vertical: 'middle', horizontal: 'center' }
      wsLogs.getRow(4).height = 40
      
      // Set cell borders for merged empty row
      for (let c = 1; c <= 15; c++) {
        wsLogs.getCell(4, c).border = {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' }
        }
      }
    } else {
      let rowIdx = 4
      for (const log of logs) {
        const row = wsLogs.getRow(rowIdx)
        const emp = log.employees ?? {}
        
        row.getCell(1).value = log.log_date
        row.getCell(2).value = log.day_of_week
        row.getCell(3).value = emp.full_name ?? '—'
        row.getCell(4).value = emp.department ?? '—'
        row.getCell(5).value = log.assigned_tasks
        row.getCell(6).value = log.actual_work_done
        row.getCell(7).value = Number(log.hours_worked)
        row.getCell(8).value = Number(log.actual_working_hour)
        row.getCell(9).value = Number(log.completion_percentage) // Stored as decimal e.g. 0.95
        row.getCell(10).value = log.done_at_home ? 'Yes' : 'No'
        row.getCell(11).value = log.office_entrance_time || '—'
        row.getCell(12).value = log.office_leave_time || '—'
        row.getCell(13).value = log.approval_status
        row.getCell(14).value = log.head_comments || '—'
        row.getCell(15).value = log.remark || '—'

        // Apply general styles and thin borders
        applyRowStyles(row, 15)

        // Formatting
        row.getCell(1).numFmt = 'yyyy-mm-dd'
        row.getCell(7).numFmt = '0.00'
        row.getCell(8).numFmt = '0.00'
        row.getCell(9).numFmt = '0%'

        // Alignments
        row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
        row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' }
        row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' }
        row.getCell(4).alignment = { horizontal: 'left', vertical: 'middle' }
        row.getCell(5).alignment = { horizontal: 'left', vertical: 'top', wrapText: true }
        row.getCell(6).alignment = { horizontal: 'left', vertical: 'top', wrapText: true }
        row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' }
        row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' }
        row.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' }
        row.getCell(10).alignment = { horizontal: 'center', vertical: 'middle' }
        row.getCell(11).alignment = { horizontal: 'center', vertical: 'middle' }
        row.getCell(12).alignment = { horizontal: 'center', vertical: 'middle' }
        row.getCell(13).alignment = { horizontal: 'center', vertical: 'middle' }
        row.getCell(14).alignment = { horizontal: 'left', vertical: 'top', wrapText: true }
        row.getCell(15).alignment = { horizontal: 'left', vertical: 'top', wrapText: true }

        // Status styling
        const statusCell = row.getCell(13)
        if (log.approval_status === 'Approved') {
          applyStatusStyle(statusCell, COLOR_SUCCESS_BG, COLOR_SUCCESS_FG)
        } else if (log.approval_status === 'Returned') {
          applyStatusStyle(statusCell, COLOR_DANGER_BG, COLOR_DANGER_FG)
        } else {
          applyStatusStyle(statusCell, COLOR_WARNING_BG, COLOR_WARNING_FG)
        }

        rowIdx++
      }
    }
    autoFitColumns(wsLogs)

    // ────────────────────────────────────────────────────────
    // 2. SHEET: Correspondence Register
    // ────────────────────────────────────────────────────────
    const wsCorr = workbook.addWorksheet('Correspondence Register')
    wsCorr.views = [{ showGridLines: true }]
    const headersCorr = [
      'Letter Ref No', 'Date Logged', 'Direction', 'Counterparty', 
      'Subject', 'Category', 'Response Required', 'Response Due Date', 
      'Linked Response Ref', 'Response Sent Date', 'Calculated Status'
    ]
    applyTableHeaders(wsCorr, headersCorr)

    let rowIdx = 4
    for (const letter of letters ?? []) {
      const row = wsCorr.getRow(rowIdx)
      row.getCell(1).value = letter.letter_ref_no
      row.getCell(2).value = letter.date_logged
      row.getCell(3).value = letter.direction
      row.getCell(4).value = letter.counterparty
      row.getCell(5).value = letter.subject
      row.getCell(6).value = letter.category
      row.getCell(7).value = letter.response_required ? 'Yes' : 'No'
      row.getCell(8).value = letter.response_due_date || '—'
      row.getCell(9).value = letter.linked_response_ref || '—'
      row.getCell(10).value = letter.response_sent_date || '—'

      // Calculate dynamic status
      let calcStatus = letter.status
      if (letter.response_required && !letter.response_sent_date) {
        if (letter.response_due_date && letter.response_due_date < todayISO) {
          calcStatus = 'Overdue'
        }
      }
      row.getCell(11).value = calcStatus

      // Apply styles and borders
      applyRowStyles(row, 11)

      // Formatting
      row.getCell(2).numFmt = 'yyyy-mm-dd'
      if (letter.response_due_date) row.getCell(8).numFmt = 'yyyy-mm-dd'
      if (letter.response_sent_date) row.getCell(10).numFmt = 'yyyy-mm-dd'

      // Alignments
      row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' }
      row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' }
      row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' }
      row.getCell(4).alignment = { horizontal: 'left', vertical: 'middle' }
      row.getCell(5).alignment = { horizontal: 'left', vertical: 'top', wrapText: true }
      row.getCell(6).alignment = { horizontal: 'left', vertical: 'middle' }
      row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' }
      row.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' }
      row.getCell(9).alignment = { horizontal: 'left', vertical: 'middle' }
      row.getCell(10).alignment = { horizontal: 'center', vertical: 'middle' }
      row.getCell(11).alignment = { horizontal: 'center', vertical: 'middle' }

      // Status formatting
      const statusCell = row.getCell(11)
      if (calcStatus === 'Closed') {
        applyStatusStyle(statusCell, COLOR_SUCCESS_BG, COLOR_SUCCESS_FG)
      } else if (calcStatus === 'Overdue') {
        applyStatusStyle(statusCell, COLOR_DANGER_BG, COLOR_DANGER_FG)
      } else if (calcStatus === 'Open') {
        applyStatusStyle(statusCell, COLOR_WARNING_BG, COLOR_WARNING_FG)
      } else {
        applyStatusStyle(statusCell, COLOR_NEUTRAL_BG, COLOR_NEUTRAL_FG)
      }

      rowIdx++
    }
    autoFitColumns(wsCorr)

    // ────────────────────────────────────────────────────────
    // 3. SHEET: Project Bonds
    // ────────────────────────────────────────────────────────
    const wsBonds = workbook.addWorksheet('Project Bonds')
    wsBonds.views = [{ showGridLines: true }]
    const headersBonds = [
      'Employer Name', 'Project Name', 'Contractor Name', 'Bond Type', 
      'Issue Date', 'Expiry Date', 'Amount (ETB)', 'Days Remaining', 'Status'
    ]
    applyTableHeaders(wsBonds, headersBonds)

    rowIdx = 4
    for (const bond of bonds ?? []) {
      const row = wsBonds.getRow(rowIdx)
      
      const expDate = new Date(bond.expiry_date)
      expDate.setHours(0, 0, 0, 0)
      const diffTime = expDate.getTime() - today.getTime()
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      let finalStatus = bond.status
      if (bond.status !== 'Released') {
        finalStatus = daysRemaining <= 0 ? 'Expired' : 'Active'
      }

      row.getCell(1).value = bond.employer_name
      row.getCell(2).value = bond.project_name
      row.getCell(3).value = bond.contractor_name
      row.getCell(4).value = bond.bond_type
      row.getCell(5).value = bond.issue_date || '—'
      row.getCell(6).value = bond.expiry_date
      row.getCell(7).value = bond.amount ? Number(bond.amount) : null
      row.getCell(8).value = daysRemaining
      row.getCell(9).value = finalStatus

      // Apply general styles and borders
      applyRowStyles(row, 9)

      // Formatting
      if (bond.issue_date) row.getCell(5).numFmt = 'yyyy-mm-dd'
      row.getCell(6).numFmt = 'yyyy-mm-dd'
      row.getCell(7).numFmt = '#,##0.00'
      row.getCell(8).numFmt = '#,##0'

      // Alignments
      row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' }
      row.getCell(2).alignment = { horizontal: 'left', vertical: 'top', wrapText: true }
      row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' }
      row.getCell(4).alignment = { horizontal: 'left', vertical: 'middle' }
      row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' }
      row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' }
      row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' }
      row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' }
      row.getCell(9).alignment = { horizontal: 'center', vertical: 'middle' }

      // Status formatting
      const statusCell = row.getCell(9)
      if (finalStatus === 'Active') {
        applyStatusStyle(statusCell, COLOR_SUCCESS_BG, COLOR_SUCCESS_FG)
      } else if (finalStatus === 'Expired') {
        applyStatusStyle(statusCell, COLOR_DANGER_BG, COLOR_DANGER_FG)
      } else {
        applyStatusStyle(statusCell, COLOR_NEUTRAL_BG, COLOR_NEUTRAL_FG)
      }

      rowIdx++
    }
    autoFitColumns(wsBonds)

    // ────────────────────────────────────────────────────────
    // 4. SHEET: EOT Tracker
    // ────────────────────────────────────────────────────────
    const wsEots = workbook.addWorksheet('EOT Tracker')
    wsEots.views = [{ showGridLines: true }]
    const headersEots = [
      'Client Name', 'Project Name', 'Contractor Name', 'EOT No.', 
      'Days Approved', 'Revised Completion Date', 'Status', 'Reason for EOT', 
      'Alert Status', 'Days Remaining'
    ]
    applyTableHeaders(wsEots, headersEots)

    rowIdx = 4
    for (const eot of eots ?? []) {
      const row = wsEots.getRow(rowIdx)

      const compDate = new Date(eot.revised_completion_date)
      compDate.setHours(0, 0, 0, 0)
      const diffTime = compDate.getTime() - today.getTime()
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      let alert = 'OK'
      if (daysRemaining <= 0) {
        alert = 'Expired'
      } else if (daysRemaining <= 30) {
        alert = 'Nearly Expired'
      }

      row.getCell(1).value = eot.client_name
      row.getCell(2).value = eot.project_name
      row.getCell(3).value = eot.contractor_name
      row.getCell(4).value = Number(eot.eot_number)
      row.getCell(5).value = Number(eot.days_approved)
      row.getCell(6).value = eot.revised_completion_date
      row.getCell(7).value = eot.status
      row.getCell(8).value = eot.reason_for_eot
      row.getCell(9).value = alert
      row.getCell(10).value = daysRemaining

      // Apply general styles and borders
      applyRowStyles(row, 10)

      // Formatting
      row.getCell(6).numFmt = 'yyyy-mm-dd'
      row.getCell(4).numFmt = '#,##0'
      row.getCell(5).numFmt = '#,##0'
      row.getCell(10).numFmt = '#,##0'

      // Alignments
      row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' }
      row.getCell(2).alignment = { horizontal: 'left', vertical: 'top', wrapText: true }
      row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' }
      row.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' }
      row.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' }
      row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' }
      row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' }
      row.getCell(8).alignment = { horizontal: 'left', vertical: 'top', wrapText: true }
      row.getCell(9).alignment = { horizontal: 'center', vertical: 'middle' }
      row.getCell(10).alignment = { horizontal: 'right', vertical: 'middle' }

      // Status formatting
      const statusCell = row.getCell(7)
      if (eot.status === 'Approved') {
        applyStatusStyle(statusCell, COLOR_SUCCESS_BG, COLOR_SUCCESS_FG)
      } else if (eot.status === 'Rejected') {
        applyStatusStyle(statusCell, COLOR_DANGER_BG, COLOR_DANGER_FG)
      } else if (eot.status === 'Pending') {
        applyStatusStyle(statusCell, COLOR_WARNING_BG, COLOR_WARNING_FG)
      } else {
        applyStatusStyle(statusCell, COLOR_INFO_BG, COLOR_INFO_FG)
      }

      // Alert cell formatting
      const alertCell = row.getCell(9)
      if (alert === 'OK') {
        applyStatusStyle(alertCell, COLOR_SUCCESS_BG, COLOR_SUCCESS_FG)
      } else if (alert === 'Nearly Expired') {
        applyStatusStyle(alertCell, COLOR_WARNING_BG, COLOR_WARNING_FG)
      } else {
        applyStatusStyle(alertCell, COLOR_DANGER_BG, COLOR_DANGER_FG)
      }

      rowIdx++
    }
    autoFitColumns(wsEots)

    // ────────────────────────────────────────────────────────
    // 5. SHEET: Performance Evaluations
    // ────────────────────────────────────────────────────────
    const wsEvals = workbook.addWorksheet('Performance Evaluations')
    wsEvals.views = [{ showGridLines: true }]
    const headersEvals = [
      'Employee Name', 'Email', 'Department', 'Period Start', 'Period End',
      'Tech Competence (40%)', 'Productivity (30%)', 'Punctuality (10%)',
      'Communication (5%)', 'Reporting (5%)', 'Adaptability (10%)',
      'Total Score', 'Performance Level'
    ]
    applyTableHeaders(wsEvals, headersEvals)

    rowIdx = 4
    for (const evalRow of evals ?? []) {
      const row = wsEvals.getRow(rowIdx)
      const emp = evalRow.employees ?? {}

      row.getCell(1).value = emp.full_name ?? '—'
      row.getCell(2).value = emp.email ?? '—'
      row.getCell(3).value = emp.department ?? '—'
      row.getCell(4).value = evalRow.evaluation_period_start
      row.getCell(5).value = evalRow.evaluation_period_end
      row.getCell(6).value = Number(evalRow.tech_competence_score)
      row.getCell(7).value = Number(evalRow.productivity_score)
      row.getCell(8).value = Number(evalRow.punctuality_score)
      row.getCell(9).value = Number(evalRow.communication_score)
      row.getCell(10).value = Number(evalRow.reporting_score)
      row.getCell(11).value = Number(evalRow.adaptability_score)
      row.getCell(12).value = Number(evalRow.total_score)
      row.getCell(13).value = evalRow.performance_level

      // Apply general styles and borders
      applyRowStyles(row, 13)

      // Formatting
      row.getCell(4).numFmt = 'yyyy-mm-dd'
      row.getCell(5).numFmt = 'yyyy-mm-dd'
      row.getCell(6).numFmt = '0.0'
      row.getCell(7).numFmt = '0.0'
      row.getCell(8).numFmt = '0.0'
      row.getCell(9).numFmt = '0.0'
      row.getCell(10).numFmt = '0.0'
      row.getCell(11).numFmt = '0.0'
      row.getCell(12).numFmt = '0.00'

      // Alignments
      row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' }
      row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' }
      row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' }
      row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' }
      row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' }
      row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' }
      row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' }
      row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' }
      row.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' }
      row.getCell(10).alignment = { horizontal: 'right', vertical: 'middle' }
      row.getCell(11).alignment = { horizontal: 'right', vertical: 'middle' }
      row.getCell(12).alignment = { horizontal: 'right', vertical: 'middle' }
      row.getCell(13).alignment = { horizontal: 'center', vertical: 'middle' }

      // Level formatting
      const levelCell = row.getCell(13)
      if (evalRow.performance_level === 'Outstanding') {
        applyStatusStyle(levelCell, COLOR_SUCCESS_BG, COLOR_SUCCESS_FG)
      } else if (evalRow.performance_level === 'Very Good') {
        applyStatusStyle(levelCell, COLOR_INFO_BG, COLOR_INFO_FG)
      } else if (evalRow.performance_level === 'Good') {
        applyStatusStyle(levelCell, COLOR_WARNING_BG, COLOR_WARNING_FG)
      } else if (evalRow.performance_level === 'Satisfactory') {
        applyStatusStyle(levelCell, COLOR_NEUTRAL_BG, COLOR_NEUTRAL_FG)
      } else {
        applyStatusStyle(levelCell, COLOR_DANGER_BG, COLOR_DANGER_FG)
      }

      rowIdx++
    }
    autoFitColumns(wsEvals)

    // Write buffer and respond
    const buffer = await workbook.xlsx.writeBuffer()
    const safeDateStr = new Date().toISOString().split('T')[0]
    
    return new NextResponse(buffer as any, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="EF_Master_Log_${safeDateStr}.xlsx"`,
        'Cache-Control': 'no-store, max-age=0'
      }
    })
  } catch (err) {
    console.error('[export-master] GET unexpected:', err)
    return NextResponse.json({ error: 'Unexpected server error: ' + (err instanceof Error ? err.message : String(err)) }, { status: 500 })
  }
}

