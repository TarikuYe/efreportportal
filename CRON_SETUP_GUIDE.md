# Automated Email Reminders Setup Guide

This guide explains how to schedule and automate the report reminder email workflow.

---

## How the Automation Works

The reminder script runs at `/api/send-reminders`. When triggered, it:
1. Queries the database for all **active employees**.
2. Checks who has **already submitted** a report for the current period.
3. Sends a personalized reminder email (via **Gmail SMTP**) to anyone who has not submitted yet.

---

## 1. Production Scheduling (Recommended: Vercel Crons)

If you host the application on **Vercel**, it will automatically pick up the cron configuration specified in your `vercel.json` file.

### Step-by-Step Configuration:

1. **Configure vercel.json** (already in your codebase):
   ```json
   {
     "crons": [
       {
         "path": "/api/send-reminders",
         "schedule": "0 9 * * *"
       }
     ]
   }
   ```
   *   `0 9 * * *`: Runs daily at 9:00 AM UTC.
   *   To change to monthly (e.g., the 25th of the month at 9:00 AM UTC), change the schedule to `0 9 25 * *`.

2. **Configure Environment Variables in Vercel Dashboard**:
   Add the following secrets to your Vercel project environment variables:
   *   `CRON_SECRET`: Choose a secure password (e.g. `your-secure-cron-secret-123`).
   *   `SMTP_HOST`: `smtp.gmail.com`
   *   `SMTP_PORT`: `465`
   *   `SMTP_USER`: `tarikuneg911@gmail.com`
   *   `SMTP_PASSWORD`: `mkxy molk bumm bnqz` (Gmail App Password)

Vercel will automatically call `POST /api/send-reminders` on the defined schedule, passing the `CRON_SECRET` in the headers to authorize the request.

---

## 2. Local Automation (Windows Task Scheduler)

To automate this locally on a Windows development machine, you can create a scheduled task that triggers the API.

### Step 1: Create a Trigger Script
Create a file named `trigger.ps1` on your machine:
```powershell
$headers = @{ Authorization = "Bearer your-cron-secret" }
Invoke-RestMethod -Uri "http://localhost:3000/api/send-reminders" -Method Post -Headers $headers
```

### Step 2: Set up Windows Task Scheduler
1. Press `Win + R`, type `taskschd.msc`, and press Enter.
2. Click **"Create Basic Task"** in the right sidebar.
3. **Name**: `EF Report Portal Reminder Trigger`.
4. **Trigger**: Select **Daily** (or Weekly/Monthly) and set your preferred time.
5. **Action**: Select **"Start a program"**.
6. **Program/script**: Enter `powershell.exe`.
7. **Add arguments**: `-ExecutionPolicy Bypass -File "C:\Users\User\Desktop\New folder\Tutorial\Python\trigger.ps1"`.
8. Click **Finish**.

---

## 3. Alternative Production Automation (GitHub Actions)


If you host your app somewhere else, you can use a free GitHub Action cron job to hit the endpoint.

Create a file at `.github/workflows/reminders.yml`:
```yaml
name: Monthly Reminder Trigger

on:
  schedule:
    - cron: '0 9 25 * *' # 9:00 AM UTC on the 25th of every month

jobs:
  trigger:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Send-Reminders Endpoint
        run: |
          curl -X POST "https://your-production-domain.com/api/send-reminders" \
          -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

---

## Security (Cron Protection)

To prevent random internet users from triggering emails, the endpoint is protected. 

It will only execute if:
*   The caller is logged in as the **Admin/DGM** (via session cookie).
*   **OR** the caller provides the correct `CRON_SECRET` in the headers:
    `Authorization: Bearer <your-cron-secret>`
