// ─────────────────────────────────────────────────────────────────────────────
// Automated Cron Alert Email Templates
//
// These are distinct from the manual DGM-composed templates in lib/email.ts.
// They are designed for the daily cron job that dispatches proactive warnings
// BEFORE a bond or EOT deadline expires — not post-expiry alerts.
//
// A. bondExpiryWarningEmailHtml  → sent to contractor + CC list
// B. eotDeadlineWarningEmailHtml → sent to department head + CC list
// ─────────────────────────────────────────────────────────────────────────────

// ── Shared helpers ────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function urgencyColor(daysRemaining: number): {
  badgeBg: string
  badgeText: string
  badgeBorder: string
  label: string
} {
  if (daysRemaining <= 7) {
    return { badgeBg: '#FEE2E2', badgeText: '#991B1B', badgeBorder: '#FCA5A5', label: 'CRITICAL' }
  }
  if (daysRemaining <= 15) {
    return { badgeBg: '#FEF3C7', badgeText: '#92400E', badgeBorder: '#FCD34D', label: 'HIGH PRIORITY' }
  }
  return { badgeBg: '#EFF6FF', badgeText: '#1E40AF', badgeBorder: '#93C5FD', label: 'ADVANCE NOTICE' }
}

// ── A. Contractor Bond Expiration Warning ─────────────────────────────────────

export interface BondExpiryWarningParams {
  contractorName: string
  projectName: string
  employerName: string
  bondType: string
  expiryDate: string        // ISO date string
  amount?: string           // formatted, e.g. "1,250,000 ETB"
  daysRemaining: number
  noticeUrl: string         // full token URL: <base>/notice/bond/<uuid> — only this bond, no auth
}

export function bondExpiryWarningEmailHtml(params: BondExpiryWarningParams): string {
  const {
    contractorName,
    projectName,
    employerName,
    bondType,
    expiryDate,
    amount,
    daysRemaining,
    noticeUrl,
  } = params

  const ctaUrl = noticeUrl

  const { badgeBg, badgeText, badgeBorder, label } = urgencyColor(daysRemaining)
  const formattedExpiry = formatDate(expiryDate)

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bond Renewal Notice — ${projectName}</title>
</head>
<body style="margin:0;padding:0;background-color:#F1F5F9;font-family:'Segoe UI',Inter,Arial,sans-serif;color:#0F172A;">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
    style="background-color:#F1F5F9;padding:36px 16px;">
    <tr>
      <td align="center">

        <!-- Card -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0"
          style="max-width:600px;width:100%;background:#FFFFFF;border-radius:16px;
                 overflow:hidden;border:1px solid #E2E8F0;
                 box-shadow:0 4px 24px rgba(0,0,0,0.07);">

          <!-- ░░ Header Banner ░░ -->
          <tr>
            <td style="background:#1E3A8A;padding:30px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font-size:11px;font-weight:700;color:#93C5FD;
                                text-transform:uppercase;letter-spacing:1.5px;
                                margin-bottom:8px;">
                      EF Architects &amp; Engineers Consulting — Official Notice
                    </div>
                    <div style="font-size:22px;font-weight:800;color:#FFFFFF;
                                letter-spacing:-0.4px;line-height:1.25;">
                      Guarantee Bond Renewal Required
                    </div>
                    <div style="margin-top:10px;font-size:13px;color:#BFDBFE;">
                      This is an automated expiry warning from the Contract Administration System.
                    </div>
                  </td>
                  <td align="right" valign="top" style="padding-left:16px;">
                    <!-- Urgency badge -->
                    <div style="background:${badgeBg};color:${badgeText};
                                border:1px solid ${badgeBorder};border-radius:20px;
                                padding:6px 14px;font-size:11px;font-weight:800;
                                text-transform:uppercase;letter-spacing:1px;
                                white-space:nowrap;">
                      ${label}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ░░ Greeting ░░ -->
          <tr>
            <td style="padding:36px 40px 0;">
              <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#1E3A8A;">
                Dear ${contractorName},
              </p>
              <p style="margin:0;font-size:14px;line-height:1.7;color:#475569;">
                This is a formal notice that a <strong>Guarantee Bond</strong> associated with
                your contract is approaching its expiry date. Please review the details below
                and take immediate action to submit renewal documentation.
              </p>
            </td>
          </tr>

          <!-- ░░ Warning Block ░░ -->
          <tr>
            <td style="padding:24px 40px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                style="background:${badgeBg};border:1px solid ${badgeBorder};
                       border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:20px 24px;">
                    <div style="font-size:12px;font-weight:700;color:${badgeText};
                                text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">
                      Expiry Warning
                    </div>
                    <div style="font-size:28px;font-weight:800;color:${badgeText};
                                letter-spacing:-0.5px;">
                      ${daysRemaining} Day${daysRemaining !== 1 ? 's' : ''} Remaining
                    </div>
                    <div style="font-size:13px;color:${badgeText};margin-top:4px;opacity:0.85;">
                      Bond expires on <strong>${formattedExpiry}</strong>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ░░ Bond Metrics Table ░░ -->
          <tr>
            <td style="padding:28px 40px 0;">
              <div style="font-size:13px;font-weight:700;color:#64748B;
                          text-transform:uppercase;letter-spacing:0.8px;
                          border-bottom:2px solid #E2E8F0;padding-bottom:8px;
                          margin-bottom:0;">
                Bond Details
              </div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                style="font-size:14px;border-collapse:collapse;">
                <tr>
                  <td style="padding:13px 0;color:#64748B;font-weight:500;
                             width:42%;border-bottom:1px solid #F1F5F9;">Project Name</td>
                  <td style="padding:13px 0;color:#0F172A;font-weight:600;
                             border-bottom:1px solid #F1F5F9;">${projectName}</td>
                </tr>
                <tr>
                  <td style="padding:13px 0;color:#64748B;font-weight:500;
                             border-bottom:1px solid #F1F5F9;">Employer / Client</td>
                  <td style="padding:13px 0;color:#0F172A;font-weight:600;
                             border-bottom:1px solid #F1F5F9;">${employerName}</td>
                </tr>
                <tr>
                  <td style="padding:13px 0;color:#64748B;font-weight:500;
                             border-bottom:1px solid #F1F5F9;">Bond Type</td>
                  <td style="padding:13px 0;color:#0F172A;font-weight:600;
                             border-bottom:1px solid #F1F5F9;">${bondType}</td>
                </tr>
                <tr>
                  <td style="padding:13px 0;color:#64748B;font-weight:500;
                             border-bottom:1px solid #F1F5F9;">Expiry Date</td>
                  <td style="padding:13px 0;font-weight:700;color:${badgeText};
                             border-bottom:1px solid #F1F5F9;">${formattedExpiry}</td>
                </tr>
                <tr>
                  <td style="padding:13px 0;color:#64748B;font-weight:500;
                             border-bottom:1px solid #F1F5F9;">Days Remaining</td>
                  <td style="padding:13px 0;font-weight:700;color:${badgeText};
                             border-bottom:1px solid #F1F5F9;">${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}</td>
                </tr>
                ${amount ? `
                <tr>
                  <td style="padding:13px 0;color:#64748B;font-weight:500;
                             border-bottom:1px solid #F1F5F9;">Bond Amount</td>
                  <td style="padding:13px 0;color:#0F172A;font-weight:600;
                             border-bottom:1px solid #F1F5F9;">${amount}</td>
                </tr>` : ''}
              </table>
            </td>
          </tr>

          <!-- ░░ CTA Button ░░ -->
          <!-- TODO: Re-enable in next update when bond renewal submission page is live -->
          <!--
          <tr>
            <td style="padding:32px 40px 0;text-align:center;">
              <a href="${ctaUrl}"
                style="display:inline-block;background:#1E3A8A;color:#FFFFFF;
                       text-decoration:none;font-size:15px;font-weight:700;
                       padding:14px 32px;border-radius:10px;
                       letter-spacing:0.2px;">
                Submit Bond Renewal Documentation →
              </a>
              <p style="margin:14px 0 0;font-size:12px;color:#94A3B8;">
                View your bond notice. This link is private to you and expires in 7 days.
              </p>
            </td>
          </tr>
          -->

          <!-- ░░ Reminder (temporary — replaces CTA button until renewal portal is live) ░░ -->
          <tr>
            <td style="padding:32px 40px 0;text-align:center;">
              <div style="display:inline-block;background:#F1F5F9;border:1px solid #E2E8F0;
                          border-radius:10px;padding:16px 28px;max-width:420px;">
                <p style="margin:0;font-size:14px;font-weight:700;color:#1E3A8A;">
                  Action Required — Contact Us to Renew
                </p>
                <p style="margin:8px 0 0;font-size:13px;line-height:1.6;color:#475569;">
                  Please contact the EF Contract Administration Department directly
                  to submit your bond renewal documentation before the expiry date.
                </p>
              </div>
            </td>
          </tr>

          <!-- ░░ Disclaimer ░░ -->
          <tr>
            <td style="padding:28px 40px 0;">
              <div style="background:#F8FAFC;border-radius:8px;
                          border:1px solid #E2E8F0;padding:16px 20px;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#64748B;">
                  <strong>Action Required:</strong> Failure to renew this bond before the
                  expiry date may result in a contractual default. If renewal has already been
                  submitted, please disregard this notice. Contact the Contract Administration
                  Department immediately if you require assistance.
                </p>
              </div>
            </td>
          </tr>

          <!-- ░░ Footer ░░ -->
          <tr>
            <td style="padding:32px 40px;border-top:1px solid #E2E8F0;margin-top:32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font-size:13px;font-weight:700;color:#1E3A8A;">
                      EF Architects and Engineers Consulting PLC
                    </div>
                    <div style="font-size:12px;color:#64748B;margin-top:4px;line-height:1.6;">
                      Contract Administration Department &middot; Deputy General Manager's Office<br />
                      Addis Ababa, Ethiopia
                    </div>
                  </td>
                  <td align="right" valign="top">
                    <div style="font-size:11px;color:#94A3B8;text-align:right;">
                      Automated notice<br />
                      Do not reply to this email
                    </div>
                  </td>
                </tr>
              </table>
              <div style="margin-top:16px;padding-top:16px;border-top:1px solid #F1F5F9;
                          font-size:11px;color:#94A3B8;line-height:1.5;">
                This message was generated automatically by the EF Contract Management System.
                It is confidential and intended solely for the named recipient. If you received
                this in error, please notify the sender and delete it immediately.
              </div>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>

</body>
</html>`
}

// ── B. EOT Revised Deadline Advisory (Internal — for Department Heads) ────────

export interface EotDeadlineWarningParams {
  recipientName?: string    // e.g. "Head of Contract Administration"
  projectName: string
  contractorName: string
  clientName: string
  eotNumber: number
  daysApproved: number
  revisedCompletionDate: string  // ISO date string
  daysRemaining: number
  noticeUrl: string         // full token URL: <base>/notice/eot/<uuid> — only this EOT, no auth
}

export function eotDeadlineWarningEmailHtml(params: EotDeadlineWarningParams): string {
  const {
    recipientName = 'Department Head',
    projectName,
    contractorName,
    clientName,
    eotNumber,
    daysApproved,
    revisedCompletionDate,
    daysRemaining,
    noticeUrl,
  } = params

  const ctaUrl = noticeUrl

  const { badgeBg, badgeText, badgeBorder, label } = urgencyColor(daysRemaining)
  const formattedDeadline = formatDate(revisedCompletionDate)

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>EOT Milestone Advisory — ${projectName}</title>
</head>
<body style="margin:0;padding:0;background-color:#F1F5F9;font-family:'Segoe UI',Inter,Arial,sans-serif;color:#0F172A;">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
    style="background-color:#F1F5F9;padding:36px 16px;">
    <tr>
      <td align="center">

        <!-- Card -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0"
          style="max-width:600px;width:100%;background:#FFFFFF;border-radius:16px;
                 overflow:hidden;border:1px solid #E2E8F0;
                 box-shadow:0 4px 24px rgba(0,0,0,0.07);">

          <!-- ░░ Header Banner ░░ -->
          <tr>
            <td style="background:#475569;padding:30px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font-size:11px;font-weight:700;color:#CBD5E1;
                                text-transform:uppercase;letter-spacing:1.5px;
                                margin-bottom:8px;">
                      Internal Project Milestone Advisory
                    </div>
                    <div style="font-size:22px;font-weight:800;color:#FFFFFF;
                                letter-spacing:-0.4px;line-height:1.25;">
                      EOT Window Closing — Action Required
                    </div>
                    <div style="margin-top:10px;font-size:13px;color:#CBD5E1;">
                      Confidential internal advisory from the Contract Administration System.
                    </div>
                  </td>
                  <td align="right" valign="top" style="padding-left:16px;">
                    <div style="background:${badgeBg};color:${badgeText};
                                border:1px solid ${badgeBorder};border-radius:20px;
                                padding:6px 14px;font-size:11px;font-weight:800;
                                text-transform:uppercase;letter-spacing:1px;
                                white-space:nowrap;">
                      ${label}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ░░ Greeting ░░ -->
          <tr>
            <td style="padding:36px 40px 0;">
              <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#334155;">
                Dear ${recipientName},
              </p>
              <p style="margin:0;font-size:14px;line-height:1.7;color:#475569;">
                This is an internal advisory to notify you that an approved
                <strong>Extension of Time (EOT)</strong> window is approaching its
                revised completion deadline. Supervision and contractual actions may
                be required before this window closes.
              </p>
            </td>
          </tr>

          <!-- ░░ Warning Block ░░ -->
          <tr>
            <td style="padding:24px 40px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                style="background:${badgeBg};border:1px solid ${badgeBorder};
                       border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:20px 24px;">
                    <div style="font-size:12px;font-weight:700;color:${badgeText};
                                text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">
                      Revised Deadline Closing In
                    </div>
                    <div style="font-size:28px;font-weight:800;color:${badgeText};
                                letter-spacing:-0.5px;">
                      ${daysRemaining} Day${daysRemaining !== 1 ? 's' : ''} Remaining
                    </div>
                    <div style="font-size:13px;color:${badgeText};margin-top:4px;opacity:0.85;">
                      EOT revised completion target: <strong>${formattedDeadline}</strong>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ░░ EOT Metrics Table ░░ -->
          <tr>
            <td style="padding:28px 40px 0;">
              <div style="font-size:13px;font-weight:700;color:#64748B;
                          text-transform:uppercase;letter-spacing:0.8px;
                          border-bottom:2px solid #E2E8F0;padding-bottom:8px;">
                EOT Record Summary
              </div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                style="font-size:14px;border-collapse:collapse;">
                <tr>
                  <td style="padding:13px 0;color:#64748B;font-weight:500;
                             width:42%;border-bottom:1px solid #F1F5F9;">Project Name</td>
                  <td style="padding:13px 0;color:#0F172A;font-weight:600;
                             border-bottom:1px solid #F1F5F9;">${projectName}</td>
                </tr>
                <tr>
                  <td style="padding:13px 0;color:#64748B;font-weight:500;
                             border-bottom:1px solid #F1F5F9;">Client / Employer</td>
                  <td style="padding:13px 0;color:#0F172A;font-weight:600;
                             border-bottom:1px solid #F1F5F9;">${clientName}</td>
                </tr>
                <tr>
                  <td style="padding:13px 0;color:#64748B;font-weight:500;
                             border-bottom:1px solid #F1F5F9;">Contractor</td>
                  <td style="padding:13px 0;color:#0F172A;font-weight:600;
                             border-bottom:1px solid #F1F5F9;">${contractorName}</td>
                </tr>
                <tr>
                  <td style="padding:13px 0;color:#64748B;font-weight:500;
                             border-bottom:1px solid #F1F5F9;">EOT Claim No.</td>
                  <td style="padding:13px 0;color:#0F172A;font-weight:600;
                             border-bottom:1px solid #F1F5F9;">#${eotNumber}</td>
                </tr>
                <tr>
                  <td style="padding:13px 0;color:#64748B;font-weight:500;
                             border-bottom:1px solid #F1F5F9;">Extension Granted</td>
                  <td style="padding:13px 0;color:#0F172A;font-weight:600;
                             border-bottom:1px solid #F1F5F9;">${daysApproved} calendar days</td>
                </tr>
                <tr>
                  <td style="padding:13px 0;color:#64748B;font-weight:500;
                             border-bottom:1px solid #F1F5F9;">Revised Deadline</td>
                  <td style="padding:13px 0;font-weight:700;color:${badgeText};
                             border-bottom:1px solid #F1F5F9;">${formattedDeadline}</td>
                </tr>
                <tr>
                  <td style="padding:13px 0;color:#64748B;font-weight:500;
                             border-bottom:1px solid #F1F5F9;">Days Remaining</td>
                  <td style="padding:13px 0;font-weight:700;color:${badgeText};
                             border-bottom:1px solid #F1F5F9;">${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ░░ CTA Button ░░ -->
          <!-- TODO: Re-enable in next update when EOT progress tracking page is live -->
          <!--
          <tr>
            <td style="padding:32px 40px 0;text-align:center;">
              <a href="${ctaUrl}"
                style="display:inline-block;background:#475569;color:#FFFFFF;
                       text-decoration:none;font-size:15px;font-weight:700;
                       padding:14px 32px;border-radius:10px;letter-spacing:0.2px;">
                View Project Tracking Dashboard →
              </a>
              <p style="margin:14px 0 0;font-size:12px;color:#94A3B8;">
                View this EOT record. This link is private to you and expires in 7 days.
              </p>
            </td>
          </tr>
          -->

          <!-- ░░ Reminder (temporary — replaces CTA button until EOT tracking page is live) ░░ -->
          <tr>
            <td style="padding:32px 40px 0;text-align:center;">
              <div style="display:inline-block;background:#F1F5F9;border:1px solid #E2E8F0;
                          border-radius:10px;padding:16px 28px;max-width:420px;">
                <p style="margin:0;font-size:14px;font-weight:700;color:#475569;">
                  Advisory — Review Project Progress
                </p>
                <p style="margin:8px 0 0;font-size:13px;line-height:1.6;color:#475569;">
                  Please verify site execution progress against the approved EOT programme
                  and report your findings to the Contract Administration Department.
                </p>
              </div>
            </td>
          </tr>

          <!-- ░░ Advisory Note ░░ -->
          <tr>
            <td style="padding:28px 40px 0;">
              <div style="background:#F8FAFC;border-radius:8px;
                          border:1px solid #E2E8F0;padding:16px 20px;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#64748B;">
                  <strong>Internal Advisory:</strong> Please verify site execution speed
                  against the revised programme. If the contractor is unlikely to achieve
                  substantial completion by the revised deadline, initiate the appropriate
                  contractual response (notice of delay, penalty assessment, or further
                  extension review) in accordance with the contract conditions.
                </p>
              </div>
            </td>
          </tr>

          <!-- ░░ Footer ░░ -->
          <tr>
            <td style="padding:32px 40px;border-top:1px solid #E2E8F0;margin-top:32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font-size:13px;font-weight:700;color:#475569;">
                      EF Architects and Engineers Consulting PLC
                    </div>
                    <div style="font-size:12px;color:#64748B;margin-top:4px;line-height:1.6;">
                      Contract Administration Department &middot; Deputy General Manager's Office<br />
                      Addis Ababa, Ethiopia
                    </div>
                  </td>
                  <td align="right" valign="top">
                    <div style="font-size:11px;color:#94A3B8;text-align:right;">
                      Confidential internal<br />
                      Do not reply to this email
                    </div>
                  </td>
                </tr>
              </table>
              <div style="margin-top:16px;padding-top:16px;border-top:1px solid #F1F5F9;
                          font-size:11px;color:#94A3B8;line-height:1.5;">
                This message was generated automatically by the EF Contract Management System.
                It is intended solely for authorised internal recipients. Do not forward or
                distribute outside the organisation without approval.
              </div>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>

</body>
</html>`
}
