// Bond submission notification email template
export function bondSubmissionEmailHtml(params: {
  submitterName: string
  submitterEmail: string
  projectName: string
  contractorName: string
  bondType: string
  expiryDate: string
  status: string
  amount?: string
}) {
  const { submitterName, submitterEmail, projectName, contractorName, bondType, expiryDate, status, amount } = params
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#eef1f6;font-family:Inter,Arial,sans-serif;color:#2b3247;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f6;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #dfe4ec;">
            <tr>
              <td style="background:#2b3247;padding:28px 36px;">
                <div style="font-family:Manrope,Arial,sans-serif;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">
                  EF <span style="color:#e0a341;">Architect &amp; Engineering</span>
                </div>
                <div style="font-size:13px;color:#aab3c5;margin-top:4px;">Project Bond Notification</div>
              </td>
            </tr>
            <tr>
              <td style="padding:36px;">
                <h1 style="font-family:Manrope,Arial,sans-serif;font-size:22px;margin:0 0 12px;color:#2b3247;">New Project Bond Logged</h1>
                <p style="font-size:15px;line-height:1.6;margin:0 0 16px;color:#4a5163;">
                  A new project bond has been logged in the system with the following details:
                </p>
                <table style="width:100%;margin:16px 0;border-collapse:collapse;">
                  <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;width:40%;">Submitted by:</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${submitterName} (${submitterEmail})</td></tr>
                  <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;">Project:</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${projectName}</td></tr>
                  <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;">Contractor:</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${contractorName}</td></tr>
                  <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;">Bond Type:</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${bondType}</td></tr>
                  <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;">Expiry Date:</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${expiryDate}</td></tr>
                  <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;">Status:</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${status}</td></tr>
                  ${amount ? `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;">Amount:</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${amount} ETB</td></tr>` : ''}
                </table>
                <p style="font-size:13px;line-height:1.6;margin:16px 0 0;color:#8a91a3;">
                  This notification was sent automatically from the EF Project Management System.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 36px;background:#f6f8fb;border-top:1px solid #dfe4ec;font-size:12px;color:#8a91a3;">
                EF Architect &amp; Engineering &middot; This is an automated message.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

// EOT submission notification email template
export function eotSubmissionEmailHtml(params: {
  submitterName: string
  submitterEmail: string
  projectName: string
  contractorName: string
  claimNumber: string
  daysApproved: string
  revisedDate: string
  status: string
  reason: string
}) {
  const { submitterName, submitterEmail, projectName, contractorName, claimNumber, daysApproved, revisedDate, status, reason } = params
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#eef1f6;font-family:Inter,Arial,sans-serif;color:#2b3247;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f6;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #dfe4ec;">
            <tr>
              <td style="background:#2b3247;padding:28px 36px;">
                <div style="font-family:Manrope,Arial,sans-serif;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">
                  EF <span style="color:#e0a341;">Architect &amp; Engineering</span>
                </div>
                <div style="font-size:13px;color:#aab3c5;margin-top:4px;">EOT Extension Notification</div>
              </td>
            </tr>
            <tr>
              <td style="padding:36px;">
                <h1 style="font-family:Manrope,Arial,sans-serif;font-size:22px;margin:0 0 12px;color:#2b3247;">New EOT Extension Logged</h1>
                <p style="font-size:15px;line-height:1.6;margin:0 0 16px;color:#4a5163;">
                  A new Extension of Time (EOT) has been logged in the system with the following details:
                </p>
                <table style="width:100%;margin:16px 0;border-collapse:collapse;">
                  <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;width:40%;">Submitted by:</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${submitterName} (${submitterEmail})</td></tr>
                  <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;">Project:</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${projectName}</td></tr>
                  <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;">Contractor:</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${contractorName}</td></tr>
                  <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;">Claim Number:</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${claimNumber}</td></tr>
                  <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;">Days Approved:</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${daysApproved}</td></tr>
                  <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;">Revised Completion:</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${revisedDate}</td></tr>
                  <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;">Status:</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${status}</td></tr>
                </table>
                <p style="font-size:15px;line-height:1.6;margin:16px 0;color:#4a5163;font-weight:600;">Reason for Extension:</p>
                <p style="font-size:14px;line-height:1.5;margin:0 0 16px;color:#4a5163;background:#f6f8fb;padding:12px;border-radius:6px;">${reason}</p>
                <p style="font-size:13px;line-height:1.6;margin:16px 0 0;color:#8a91a3;">
                  This notification was sent automatically from the EF Project Management System.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 36px;background:#f6f8fb;border-top:1px solid #dfe4ec;font-size:12px;color:#8a91a3;">
                EF Architect &amp; Engineering &middot; This is an automated message.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export function reminderEmailHtml(params: {
  periodLabel: string
  portalUrl: string
  dueDateLabel: string
  employeeName?: string
}) {
  const { periodLabel, portalUrl, dueDateLabel, employeeName } = params
  const greeting = employeeName ? `Hello ${employeeName},` : 'Hello,'
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#eef1f6;font-family:Inter,Arial,sans-serif;color:#2b3247;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f6;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #dfe4ec;">
            <tr>
              <td style="background:#2b3247;padding:28px 36px;">
                <div style="font-family:Manrope,Arial,sans-serif;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">
                  EF <span style="color:#e0a341;">Architect &amp; Engineering</span>
                </div>
                <div style="font-size:13px;color:#aab3c5;margin-top:4px;">Project Report Portal</div>
              </td>
            </tr>
            <tr>
              <td style="padding:36px;">
                <h1 style="font-family:Manrope,Arial,sans-serif;font-size:22px;margin:0 0 12px;color:#2b3247;">Report submission reminder</h1>
                <p style="font-size:15px;line-height:1.6;margin:0 0 16px;color:#4a5163;font-weight:600;">
                  ${greeting}
                </p>
                <p style="font-size:15px;line-height:1.6;margin:0 0 16px;color:#4a5163;">
                  This is a reminder to submit your project report for the
                  <strong>${periodLabel}</strong> reporting period. Submissions are due by
                  <strong>${dueDateLabel}</strong>.
                </p>
                <p style="font-size:15px;line-height:1.6;margin:0 0 28px;color:#4a5163;">
                  Please upload your report through the secure portal below. Include your name,
                  email, project code, and the correct reporting period.
                </p>
                <a href="${portalUrl}" style="display:inline-block;background:#e0a341;color:#2b1f08;text-decoration:none;font-weight:700;font-size:15px;padding:13px 26px;border-radius:8px;">
                  Submit your report
                </a>
                <p style="font-size:13px;line-height:1.6;margin:28px 0 0;color:#8a91a3;">
                  If you have already submitted for this period, no action is needed.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 36px;background:#f6f8fb;border-top:1px solid #dfe4ec;font-size:12px;color:#8a91a3;">
                EF Architect &amp; Engineering &middot; This is an automated message.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export function bondAlertEmailHtml(params: {
  projectName: string
  contractorName: string
  employerName: string
  bondType: string
  expiryDate: string
  amount?: string
  daysOverdue: number
  message: string
}) {
  const { projectName, contractorName, employerName, bondType, expiryDate, amount, daysOverdue, message } = params
  const formattedMessage = message.replace(/\n/g, '<br />')
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f6f8;font-family:Inter,Arial,sans-serif;color:#1e293b;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 6px -1px rgb(0 0 0 / 0.05);">
            <!-- Red Urgent Header Alert -->
            <tr>
              <td style="background:#ef4444;padding:24px 32px;">
                <div style="font-family:Manrope,Arial,sans-serif;font-size:14px;font-weight:700;color:#fee2e2;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">URGENT ALERT</div>
                <h1 style="font-family:Manrope,Arial,sans-serif;font-size:22px;font-weight:800;color:#ffffff;margin:0;letter-spacing:-0.5px;">Guarantee Bond Expired</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <!-- DGM Message Box -->
                <div style="background:#f8fafc;border-left:4px solid #ef4444;padding:20px;border-radius:0 8px 8px 0;margin-bottom:28px;">
                  <span style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:6px;">Message from DGM Office</span>
                  <p style="font-size:15px;line-height:1.6;margin:0;color:#334155;font-style:italic;">
                    ${formattedMessage}
                  </p>
                </div>

                <!-- Bond Details Table -->
                <h3 style="font-family:Manrope,Arial,sans-serif;font-size:15px;font-weight:700;color:#0f172a;margin:0 0 12px;border-bottom:1px solid #f1f5f9;padding-bottom:8px;">Bond Information</h3>
                <table style="width:100%;margin-bottom:28px;border-collapse:collapse;font-size:14px;">
                  <tr>
                    <td style="padding:10px 0;color:#64748b;font-weight:500;width:35%;border-bottom:1px solid #f8fafc;">Project Name</td>
                    <td style="padding:10px 0;color:#0f172a;font-weight:600;border-bottom:1px solid #f8fafc;">${projectName}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0;color:#64748b;font-weight:500;border-bottom:1px solid #f8fafc;">Contractor Name</td>
                    <td style="padding:10px 0;color:#0f172a;font-weight:600;border-bottom:1px solid #f8fafc;">${contractorName}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0;color:#64748b;font-weight:500;border-bottom:1px solid #f8fafc;">Employer Name</td>
                    <td style="padding:10px 0;color:#0f172a;font-weight:600;border-bottom:1px solid #f8fafc;">${employerName}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0;color:#64748b;font-weight:500;border-bottom:1px solid #f8fafc;">Bond Type</td>
                    <td style="padding:10px 0;color:#0f172a;font-weight:600;border-bottom:1px solid #f8fafc;">${bondType}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0;color:#64748b;font-weight:500;border-bottom:1px solid #f8fafc;">Expiry Date</td>
                    <td style="padding:10px 0;color:#ef4444;font-weight:700;border-bottom:1px solid #f8fafc;">${new Date(expiryDate).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  </tr>
                  ${amount ? `
                  <tr>
                    <td style="padding:10px 0;color:#64748b;font-weight:500;border-bottom:1px solid #f8fafc;">Bond Amount</td>
                    <td style="padding:10px 0;color:#0f172a;font-weight:600;border-bottom:1px solid #f8fafc;">${amount}</td>
                  </tr>` : ''}
                  <tr>
                    <td style="padding:10px 0;color:#64748b;font-weight:500;border-bottom:1px solid #f8fafc;">Status Calculation</td>
                    <td style="padding:10px 0;color:#ef4444;font-weight:700;border-bottom:1px solid #f8fafc;">Expired (${daysOverdue} days overdue)</td>
                  </tr>
                </table>

                <div style="text-align:center;margin-top:16px;">
                  <span style="font-size:12px;color:#94a3b8;display:block;margin-top:16px;">Please execute necessary supervision or guarantee actions immediately.</span>
                </div>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="padding:24px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;text-align:center;line-height:1.5;">
                <strong>EF Architects and Engineers Consulting PLC</strong><br />
                DGM Office &middot; Contract Administration Department<br />
                <span style="color:#94a3b8;font-size:11px;margin-top:4px;display:block;">This is an authenticated executive notification.</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export function eotAlertEmailHtml(params: {
  projectName: string
  contractorName: string
  revisedDate: string
  daysApproved: string
  claimNumber: string
  daysRemaining: number
  message: string
}) {
  const { projectName, contractorName, revisedDate, daysApproved, claimNumber, daysRemaining, message } = params
  const formattedMessage = message.replace(/\n/g, '<br />')
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f6f8;font-family:Inter,Arial,sans-serif;color:#1e293b;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 6px -1px rgb(0 0 0 / 0.05);">
            <!-- Amber Alert Header -->
            <tr>
              <td style="background:#f59e0b;padding:24px 32px;">
                <div style="font-family:Manrope,Arial,sans-serif;font-size:14px;font-weight:700;color:#fef3c7;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">TIMELINE EXPIRY ALERT</div>
                <h1 style="font-family:Manrope,Arial,sans-serif;font-size:22px;font-weight:800;color:#ffffff;margin:0;letter-spacing:-0.5px;">Contract Timeline Expirations</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <!-- DGM Message Box -->
                <div style="background:#f8fafc;border-left:4px solid #f59e0b;padding:20px;border-radius:0 8px 8px 0;margin-bottom:28px;">
                  <span style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:6px;">Message from DGM Office</span>
                  <p style="font-size:15px;line-height:1.6;margin:0;color:#334155;font-style:italic;">
                    ${formattedMessage}
                  </p>
                </div>

                <!-- EOT Details Table -->
                <h3 style="font-family:Manrope,Arial,sans-serif;font-size:15px;font-weight:700;color:#0f172a;margin:0 0 12px;border-bottom:1px solid #f1f5f9;padding-bottom:8px;">EOT Tracking Information</h3>
                <table style="width:100%;margin-bottom:28px;border-collapse:collapse;font-size:14px;">
                  <tr>
                    <td style="padding:10px 0;color:#64748b;font-weight:500;width:35%;border-bottom:1px solid #f8fafc;">Project Name</td>
                    <td style="padding:10px 0;color:#0f172a;font-weight:600;border-bottom:1px solid #f8fafc;">${projectName}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0;color:#64748b;font-weight:500;border-bottom:1px solid #f8fafc;">Contractor Name</td>
                    <td style="padding:10px 0;color:#0f172a;font-weight:600;border-bottom:1px solid #f8fafc;">${contractorName}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0;color:#64748b;font-weight:500;border-bottom:1px solid #f8fafc;">EOT Status</td>
                    <td style="padding:10px 0;color:#0f172a;font-weight:600;border-bottom:1px solid #f8fafc;">Claim #${claimNumber}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0;color:#64748b;font-weight:500;border-bottom:1px solid #f8fafc;">Days Approved</td>
                    <td style="padding:10px 0;color:#0f172a;font-weight:600;border-bottom:1px solid #f8fafc;">${daysApproved} Days</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0;color:#64748b;font-weight:500;border-bottom:1px solid #f8fafc;">Revised Deadline</td>
                    <td style="padding:10px 0;color:#b45309;font-weight:700;border-bottom:1px solid #f8fafc;">${new Date(revisedDate).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0;color:#64748b;font-weight:500;border-bottom:1px solid #f8fafc;">Status Calculation</td>
                    <td style="padding:10px 0;color:#b45309;font-weight:700;border-bottom:1px solid #f8fafc;">${daysRemaining} days remaining</td>
                  </tr>
                </table>

                <div style="text-align:center;margin-top:16px;">
                  <span style="font-size:12px;color:#94a3b8;display:block;margin-top:16px;">Verify site execution speed and execute necessary supervision actions.</span>
                </div>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="padding:24px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;text-align:center;line-height:1.5;">
                <strong>EF Architects and Engineers Consulting PLC</strong><br />
                DGM Office &middot; Contract Administration Department<br />
                <span style="color:#94a3b8;font-size:11px;margin-top:4px;display:block;">This is an authenticated executive notification.</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}
