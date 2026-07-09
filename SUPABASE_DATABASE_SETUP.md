# Supabase Database & Storage Setup

Complete guide to set up the required database tables and storage bucket.

---

## Step 1: Create the `report_submissions` Table

1. Go to **Supabase Dashboard**: https://app.supabase.com
2. Select your project: `ufrgklusakfzvpirzufm`
3. Click **"SQL Editor"** on the left sidebar
4. Click **"New Query"**
5. **Copy and paste this SQL:**

```sql
-- Create the report_submissions table
CREATE TABLE report_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_name VARCHAR(255) NOT NULL,
  employee_email VARCHAR(255) NOT NULL,
  project_code VARCHAR(100) NOT NULL,
  reporting_period VARCHAR(50) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  submission_status VARCHAR(50) DEFAULT 'pending' CHECK (submission_status IN ('pending', 'approved', 'rejected')),
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by VARCHAR(255),
  reviewer_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX idx_employee_email ON report_submissions(employee_email);
CREATE INDEX idx_reporting_period ON report_submissions(reporting_period);
CREATE INDEX idx_project_code ON report_submissions(project_code);
CREATE INDEX idx_status ON report_submissions(submission_status);
CREATE INDEX idx_submitted_at ON report_submissions(submitted_at DESC);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE report_submissions ENABLE ROW LEVEL SECURITY;

-- Create a policy so users can only see their own submissions (optional)
CREATE POLICY "Users can view their own submissions"
  ON report_submissions
  FOR SELECT
  USING (auth.jwt() ->> 'email' = employee_email OR auth.jwt() ->> 'email' = 'dgm@gmail.com');

-- Create a policy so users can insert their own submissions
CREATE POLICY "Users can insert their own submissions"
  ON report_submissions
  FOR INSERT
  WITH CHECK (auth.jwt() ->> 'email' = employee_email);
```

6. Click **"Run"** or **"Execute"**
7. You should see: **"Success. No rows returned"**

---

## Step 2: Create the `reports` Storage Bucket

1. **In Supabase Dashboard**, click **"Storage"** on the left sidebar
2. Click **"Create a new bucket"**
3. **Bucket name**: `reports` (must be lowercase)
4. **Public bucket**: Toggle **OFF** (keep private)
5. Click **"Create bucket"**

---

## Step 3: Set Storage Permissions (Optional but Recommended)

### Create Upload Policy:

1. Click on the **`reports` bucket**
2. Click **"Policies"** tab
3. Click **"New Policy"** or **"Add Policy"**
4. Select **"For inserts"**
5. Paste this policy:

```sql
CREATE POLICY "Authenticated users can upload"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'reports' 
    AND auth.role() = 'authenticated'
  );
```

6. Click **"Review"** → **"Save policy"**

### Create Download Policy:

1. Click **"New Policy"** again
2. Select **"For selects"**
3. Paste this policy:

```sql
CREATE POLICY "Authenticated users can download"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'reports' 
    AND auth.role() = 'authenticated'
  );
```

4. Click **"Review"** → **"Save policy"**

---

## Step 4: Test the Setup

1. **Restart your dev server**:
   ```bash
   npm run dev
   ```

2. **Go to your dashboard**: http://localhost:3000/dashboard

3. **Try submitting a report**:
   - Fill in: Name, Email, Project Code, Period
   - Attach a file (PDF, DOC, etc.)
   - Click **"Submit"**

4. **Check if it works**:
   - You should see success message
   - The report should appear in your submissions list

---

## Step 5: Verify in Supabase Dashboard

### Check the Database:

1. Go to **Supabase Dashboard** → **"SQL Editor"**
2. Run this query:
   ```sql
   SELECT * FROM report_submissions ORDER BY submitted_at DESC LIMIT 10;
   ```
3. You should see your submissions

### Check Storage:

1. Go to **Storage** → **`reports` bucket**
2. You should see files organized by period/project code

---

## Troubleshooting

### Issue: "Table does not exist"
**Solution:**
```
1. Make sure the SQL query ran successfully
2. Check the SQL Editor for error messages
3. Re-run the CREATE TABLE query
```

### Issue: "Storage bucket not found"
**Solution:**
```
1. Go to Storage and manually create "reports" bucket
2. Make sure bucket name is lowercase
3. Refresh your browser
```

### Issue: "Permission denied" when uploading
**Solution:**
```
1. Go to Storage → reports bucket → Policies
2. Add the upload policy from Step 3
3. Make sure "Public bucket" is OFF
```

### Issue: "Can't download files"
**Solution:**
```
1. Add the download policy from Step 3
2. Files need signed URLs (already handled in code)
```

---

## Database Schema Reference

```
report_submissions
├── id (UUID, primary key)
├── employee_name (VARCHAR)
├── employee_email (VARCHAR) - must match authenticated user
├── project_code (VARCHAR)
├── reporting_period (VARCHAR)
├── file_path (VARCHAR) - path in storage bucket
├── submission_status (VARCHAR) - pending/approved/rejected
├── submitted_at (TIMESTAMP)
├── reviewed_at (TIMESTAMP)
├── reviewed_by (VARCHAR)
├── reviewer_notes (TEXT)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)
```

---

## Optional: Seed Test Data

Run this SQL to add sample submissions (optional):

```sql
INSERT INTO report_submissions 
(employee_name, employee_email, project_code, reporting_period, file_path, submission_status)
VALUES 
  ('John Doe', 'toohmeti@gmail.com', 'PROJ-001', 'July 2026', 'July 2026/PROJ-001/1719979200000-john_doe.pdf', 'pending'),
  ('Jane Smith', 'tariku25j@gmail.com', 'PROJ-002', 'July 2026', 'July 2026/PROJ-002/1719979300000-jane_smith.pdf', 'approved');
```

---

## Next Steps

1. ✅ Create `report_submissions` table (Step 1)
2. ✅ Create `reports` storage bucket (Step 2)
3. ✅ Set up storage policies (Step 3)
4. ✅ Restart dev server (Step 4)
5. ✅ Test submission (Step 5)

**Your dashboard should now work!** 🚀
