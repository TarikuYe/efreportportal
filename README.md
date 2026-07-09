# EF A&E Report Portal

> **EF Architects and Engineers Consulting PLC** — Internal Management & Report Submission Portal

A full-stack web application built with **Next.js 16**, **Supabase**, and **TypeScript** for managing project reports, employee timesheets, correspondence, contractor bonds, EOT claims, and performance evaluations.

---

## ✅ Completed & Working Functionality

### 1. 🔐 Authentication System

| Feature | Status |
|---|---|
| Email/Password Sign In | ✅ Done |
| Supabase Auth integration (SSR) | ✅ Done |
| Auth callback route (`/auth/callback`) | ✅ Done |
| Sign Out (server action + client button) | ✅ Done |
| Unauthorized access page (`/auth/unauthorized`) | ✅ Done |
| Auto-provisioning of employee record on first sign-in | ✅ Done |
| DGM email detection for automatic role assignment | ✅ Done |
| Role-based redirect on login (engineer / admin / dgm) | ✅ Done |

---

### 2. 🏠 Public Landing Page (`/`)

- Hero section with portal description
- Features overview cards:
  - **Secure & Private** — Encrypted file storage, access controlled
  - **Automated Reminders** — Monthly email notifications
  - **Full Audit Trail** — Timestamped submission tracking
- CTA section linking to Sign In
- Authenticated users are redirected automatically to `/dashboard`

---

### 3. 👷 Employee Workspace (`/dashboard`)

The default view for **engineer** role users.

#### 3a. Weekly Timesheet Logger

| Feature | Status |
|---|---|
| Weekly calendar navigation (Mon–Sun) | ✅ Done |
| Previous / Next week navigation | ✅ Done |
| Auto-seeded empty rows for every day of the week | ✅ Done |
| Fields: Assigned Tasks, Actual Work Done, Hours Worked, Actual Working Hour, Completion %, Done at Home, Remark, Office Entrance/Leave Time | ✅ Done |
| Split-day task rows (add multiple tasks per day) | ✅ Done |
| Remove split rows (with guard: cannot remove last row of a day or approved row) | ✅ Done |
| Save all rows for the week in batch | ✅ Done |
| Approval status display per row (`Pending`, `Approved`, `Returned`) | ✅ Done |
| Head comments display on returned rows | ✅ Done |
| Validation before save (requires tasks + work description) | ✅ Done |
| Real-time data fetch with SWR (auto-refresh on week change) | ✅ Done |
| Day-of-week auto-populated by database trigger | ✅ Done |

#### 3b. Settings Tab (Account)

| Feature | Status |
|---|---|
| Change Password form | ✅ Done |
| Current password verification before update | ✅ Done |
| New password ≥ 8 characters validation | ✅ Done |
| Password confirmation match check | ✅ Done |
| Same password rejection | ✅ Done |
| Show/hide toggle on all password fields | ✅ Done |
| Success confirmation message on password change | ✅ Done |

---

### 4. 🗂️ Admin (Registrar) Dashboard (`/dashboard/registrar`)

Available to users with the **admin** role. Contains a multi-tab interface.

#### 4a. Correspondence Register Tab

| Feature | Status |
|---|---|
| Register new incoming/outgoing letters | ✅ Done |
| Fields: Letter Ref No, Date Logged, Direction, Counterparty, Subject, Category, Response Required | ✅ Done |
| Categories: NOC, General, RFI, EOT Claim, Variation, Payment | ✅ Done |
| Auto-calculated Response Due Date (Date Logged + 7 days) | ✅ Done |
| Cross-reference linked response with autocomplete suggestions | ✅ Done |
| Response Sent Date field (closes the letter) | ✅ Done |
| Edit existing correspondence records | ✅ Done |
| Delete correspondence records | ✅ Done |
| Live status: `Open`, `Overdue`, `Closed`, `Not Required` (auto-calculated by DB trigger) | ✅ Done |
| Direction badge (Incoming / Outgoing) | ✅ Done |
| Table view of all correspondence | ✅ Done |

#### 4b. Project Bonds Tracker Tab

| Feature | Status |
|---|---|
| Log new contractor bonds | ✅ Done |
| Fields: Employer, Project Name, Contractor, Bond Type, Issue Date, Expiry Date, Amount (ETB), Status | ✅ Done |
| Bond Types: Advance Payment Bond, Performance Bond | ✅ Done |
| Bond Statuses: Active, Expired, Released | ✅ Done |
| Edit and delete existing bonds | ✅ Done |
| Visual status badges per bond | ✅ Done |
| Table view of all bonds | ✅ Done |

#### 4c. EOT Tracker Tab (Extension of Time)

| Feature | Status |
|---|---|
| Register approved EOT claims | ✅ Done |
| Fields: Client, Project Name, Contractor, EOT Number, Days Approved, Revised Completion Date, Status, Reason | ✅ Done |
| EOT Statuses: Pending, Approved, Rejected, Under Review | ✅ Done |
| EOT Alert statuses: OK, Nearly Expired, Expired (DB-computed) | ✅ Done |
| Edit and delete EOT records | ✅ Done |
| Color-coded status badges | ✅ Done |
| Table view of all EOT claims | ✅ Done |

#### 4d. Performance Evaluations Tab

| Feature | Status |
|---|---|
| Create employee performance evaluations | ✅ Done |
| Fields: Employee, Evaluation Period (Start/End), 6 score dimensions | ✅ Done |
| Score dimensions: Technical Competence (40%), Productivity (30%), Punctuality (10%), Communication (5%), Reporting (5%), Adaptability (10%) | ✅ Done |
| Auto-calculated Total Score via DB trigger | ✅ Done |
| Auto-assigned Performance Level: Outstanding / Very Good / Good / Satisfactory / Needs Improvement | ✅ Done |
| Edit existing evaluation records | ✅ Done |
| Table view with performance tier badges | ✅ Done |

#### 4e. Employee Management Tab (Registrar)

> Shared with Admin Dashboard — see Section 5 below.

---

### 5. 👥 Employee Management (Admin & Registrar)

| Feature | Status |
|---|---|
| List all employees with name, email, department, status | ✅ Done |
| Add new employee (creates Supabase Auth user + DB record) | ✅ Done |
| One-time password displayed in modal after creation | ✅ Done |
| Copy one-time password to clipboard | ✅ Done |
| Edit employee name and department inline | ✅ Done |
| Activate / Deactivate employee accounts | ✅ Done |
| Expand employee row to manage project assignments | ✅ Done |
| Toggle project assignment per employee per project | ✅ Done |
| Reset employee password (generate new temporary password) | ✅ Done |

---

### 6. 📁 Project Management (Admin Dashboard)

| Feature | Status |
|---|---|
| Create new projects (code + name) | ✅ Done |
| Edit project names inline | ✅ Done |
| Archive / Restore projects (toggle active status) | ✅ Done |
| Delete projects | ✅ Done |
| Projects list used across all modules (submissions, employee assignments) | ✅ Done |

---

### 7. 📊 Admin Submissions Dashboard (Submissions Tab)

| Feature | Status |
|---|---|
| View all report submissions in a table | ✅ Done |
| Metrics overview: Total employees, Active this period, Pending review, Approved | ✅ Done |
| Missing reports alert (employees who haven't submitted for the current period) | ✅ Done |
| Filter submissions by reporting period | ✅ Done |
| Filter submissions by project | ✅ Done |
| Update submission status inline: `Submitted` → `Under Review` → `Approved` / `Returned` | ✅ Done |
| Download submitted files (signed URL from Supabase Storage) | ✅ Done |
| Trigger email reminders manually (force-send) | ✅ Done |
| Refresh data button | ✅ Done |
| Employee directory grouped view | ✅ Done |

---

### 8. 📈 DGM Control Tower (`/dashboard/admin/analytics`)

Exclusive to users with the **dgm** role.

| Feature | Status |
|---|---|
| Correspondence mailbox count + overdue actions count | ✅ Done |
| Active guarantee bonds count + released/expired count | ✅ Done |
| Engineer average commitment/completion rate (%) | ✅ Done |
| **Critical Bond Expired Alerts** panel (real-time, auto-refreshes every 10s) | ✅ Done |
| **Nearly Expired Contract Timeline** panel (EOTs expiring within 30 days) | ✅ Done |
| One-click mailto link generation for overdue bond alerts (pre-filled email body) | ✅ Done |
| One-click mailto link generation for EOT expiry alerts (pre-filled email body) | ✅ Done |
| **Export Master Log** — downloads full Excel workbook | ✅ Done |
| Manual refresh button | ✅ Done |

---

### 9. 📧 Email Reminder System

| Feature | Status |
|---|---|
| HTML email template for report submission reminders | ✅ Done |
| Personalized greeting with employee name | ✅ Done |
| Branded email design (EF A&E colors and typography) | ✅ Done |
| SMTP email sending via Nodemailer (Gmail SMTP) | ✅ Done |
| Resend.com integration (alternative email provider) | ✅ Done |
| Manual trigger via Admin Dashboard | ✅ Done |
| Automated CRON schedule support (configured externally) | ✅ Done |
| Email sent only if the reporting period is active | ✅ Done |

---

### 10. 📥 Report Submission System

| Feature | Status |
|---|---|
| Employee report file upload form | ✅ Done |
| Fields: Employee Name, Email, Project, Reporting Period, File Upload | ✅ Done |
| File stored in Supabase Storage (encrypted, private bucket) | ✅ Done |
| Submission record stored in database with metadata | ✅ Done |
| Submission history visible to employees | ✅ Done |
| Status tracking: `submitted` → `under_review` → `approved` / `returned` | ✅ Done |
| Admin can update status and download files | ✅ Done |

---

### 11. 📤 Export System

| Feature | Status |
|---|---|
| Master Excel export via `/api/export-master` | ✅ Done |
| Built with ExcelJS library | ✅ Done |
| Downloadable by DGM from the Control Tower dashboard | ✅ Done |

---

### 12. 🗄️ Database Schema (Supabase / PostgreSQL)

| Table | Description | Status |
|---|---|---|
| `employees` | User profiles, roles (engineer/admin/dgm), department | ✅ Done |
| `daily_work_logs` | Weekly timesheets with approval lifecycle | ✅ Done |
| `correspondence_register` | Incoming/outgoing letter tracking | ✅ Done |
| `project_bonds` | Contractor bond tracking (advance & performance) | ✅ Done |
| `eot_tracker` | Extension of Time claims | ✅ Done |
| `performance_evaluations` | Multi-dimension employee evaluations | ✅ Done |

#### Database Triggers & Functions

| Trigger | Effect | Status |
|---|---|---|
| `trg_set_day_of_week` | Auto-fills `day_of_week` on `daily_work_logs` insert/update | ✅ Done |
| `trg_calculate_performance_eval` | Calculates weighted total score + assigns performance level on evaluation save | ✅ Done |
| `trg_handle_correspondence_status` | Auto-sets `response_due_date` (+7 days) and `status` on correspondence insert/update | ✅ Done |

#### Row Level Security (RLS)

| Table | Policy |
|---|---|
| `employees` | Authenticated users can read all; only self or admin/dgm can write |
| `daily_work_logs` | Employees see own logs; admin/dgm see all |
| `correspondence_register` | All authenticated users can read; only admin/dgm can write |
| `project_bonds` | All authenticated users can read; only admin/dgm can write |
| `eot_tracker` | All authenticated users can read; only admin/dgm can write |
| `performance_evaluations` | Employees see own; admin/dgm manage all |

---

### 13. 🔌 REST API Endpoints

| Endpoint | Methods | Description |
|---|---|---|
| `/api/submissions` | `GET, POST, PATCH` | Report submissions CRUD + file download URLs |
| `/api/projects` | `GET, POST, PATCH, DELETE` | Project management |
| `/api/employees` | `GET, POST, PATCH` | Employee management + provisioning |
| `/api/daily-work-logs` | `GET, POST, PATCH, DELETE` | Timesheet log CRUD |
| `/api/correspondence` | `GET, POST, PATCH, DELETE` | Correspondence register |
| `/api/bonds` | `GET, POST, PATCH, DELETE` | Project bonds tracker |
| `/api/eot` | `GET, POST, PATCH, DELETE` | EOT claims tracker |
| `/api/evaluations` | `GET, POST, PATCH, DELETE` | Performance evaluations |
| `/api/analytics` | `GET` | DGM analytics metrics + alerts |
| `/api/export-master` | `GET` | Excel export download |
| `/api/send-reminders` | `POST` | Trigger reminder emails |
| `/api/auth` | `GET` | Current session info |

---

### 14. 🎨 UI / Design System

| Feature | Status |
|---|---|
| Shadcn/UI component library | ✅ Done |
| TailwindCSS v4 styling | ✅ Done |
| Dark/light mode theming via `next-themes` | ✅ Done |
| Toast notifications via Sonner | ✅ Done |
| Lucide React icons | ✅ Done |
| Responsive layout (mobile-first) | ✅ Done |
| Site header with navigation and sign-out | ✅ Done |
| Status badge component for visual state display | ✅ Done |
| Optimistic UI updates (SWR mutations without full reload) | ✅ Done |
| Loading states and spinner indicators | ✅ Done |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (SSR) |
| File Storage | Supabase Storage |
| Styling | TailwindCSS v4 + Shadcn/UI |
| Email | Nodemailer (Gmail SMTP) / Resend |
| Excel Export | ExcelJS |
| Data Fetching | SWR |
| Deployment | Vercel |

---

## 🗂️ Project Structure

```
efreportportal/
├── app/
│   ├── page.tsx                    # Public landing page
│   ├── auth/                       # Sign in, sign up, callback, unauthorized
│   ├── dashboard/
│   │   ├── page.tsx                # Engineer workspace entry (role redirect)
│   │   ├── registrar/page.tsx      # Admin/Registrar full management center
│   │   └── admin/analytics/        # DGM Control Tower
│   └── api/                        # All REST API routes
├── components/
│   ├── admin-dashboard.tsx         # Submissions + Projects + Employees tabs
│   ├── employee-workspace.tsx      # Timesheet logger + Settings
│   ├── employee-manager.tsx        # Employee CRUD + project assignments
│   ├── project-manager.tsx         # Project CRUD
│   ├── submission-form.tsx         # Report upload form
│   ├── site-header.tsx             # Top navigation bar
│   └── ui/                         # Shadcn UI primitives
├── lib/
│   ├── supabase/                   # Client, server, and admin Supabase clients
│   ├── email.ts                    # HTML email template generator
│   ├── reports.ts                  # Shared types, period helpers, formatters
│   └── utils.ts                    # Utility helpers
└── db_migration.sql                # Full database schema + triggers + RLS
```

---

## ⚙️ Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=         # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # Supabase anon/public key
SUPABASE_SERVICE_ROLE_KEY=        # Supabase service role key (server only)
DGM_EMAIL=                        # Email address auto-assigned dgm role
SMTP_HOST=                        # SMTP server (e.g. smtp.gmail.com)
SMTP_PORT=                        # SMTP port (e.g. 587)
SMTP_USER=                        # SMTP sender email
SMTP_PASS=                        # SMTP app password
RESEND_API_KEY=                   # (Optional) Resend.com API key
NEXT_PUBLIC_APP_URL=              # Public base URL for email links
```

See [`GMAIL_SMTP_SETUP.md`](./GMAIL_SMTP_SETUP.md), [`SMTP_SETUP.md`](./SMTP_SETUP.md), and [`SUPABASE_DATABASE_SETUP.md`](./SUPABASE_DATABASE_SETUP.md) for detailed configuration guides.

---

## 🚀 Running Locally

```bash
pnpm install
pnpm dev
```

Visit `http://localhost:3000`

---

*© EF Architect & Engineering. Internal use only.*
