# SMTP Email Integration Setup Guide

This guide walks you through configuring **Resend** as your email provider for Supabase authentication emails.

## Prerequisites

- ✅ Supabase Project created
- ✅ Resend account with API key (already have: `re_7TCY5dhy_3fB4dsLP6C7R2smoZ5SC7pPC`)
- ✅ Admin access to Supabase Dashboard

---

## Step 1: Get Your Resend API Key

You already have this in `.env`:
```
RESEND_API_KEY=re_7TCY5dhy_3fB4dsLP6C7R2smoZ5SC7pPC
```

**If you need a new one:**
1. Go to [https://resend.com/api-keys](https://resend.com/api-keys)
2. Click **"Create API Key"**
3. Name it "Supabase Email"
4. Copy the key (starts with `re_`)

---

## Step 2: Get Your Resend Domain

You have two options:

### Option A: Use Resend Test Domain (Easiest - Quick Setup)
- Email from: `onboarding@resend.dev`
- ✅ No verification needed
- ✅ Works immediately
- ⚠️ Only for testing (mentions "from Resend")

### Option B: Use Your Custom Domain (Recommended - Production)

If you have a custom domain (e.g., `yourdomain.com`):

1. Go to [https://resend.com/domains](https://resend.com/domains)
2. Click **"Add Domain"**
3. Enter your domain (e.g., `mail.yourdomain.com`)
4. Follow DNS verification steps
5. Once verified, copy the domain

**For this guide, we'll use Option A (test domain) for quick setup.**

---

## Step 3: Configure Supabase SMTP Settings

### Via Supabase Dashboard:

1. **Go to Supabase Dashboard**: https://app.supabase.com
2. **Select your project**: `ufrgklusakfzvpirzufm`
3. **Click "Authentication"** in left sidebar
4. **Click "Email Templates"** or **"Settings"** (depending on Supabase version)

### If you see "SMTP Settings" or "Custom Email":

5. **Fill in the following:**
   - **SMTP Host**: `smtp.resend.com`
   - **SMTP Port**: `465` (or `587` for TLS)
   - **SMTP Username**: `default` (or leave blank)
   - **SMTP Password**: `re_7TCY5dhy_3fB4dsLP6C7R2smoZ5SC7pPC` (your RESEND_API_KEY)
   - **From Email**: `noreply@resend.dev` (or your verified domain)
   - **From Name**: `EF Report Portal`
   - **Reply To**: `support@yourdomain.com` (optional)

6. **Click "Save"** or **"Test Connection"**

---

## Step 4: Alternative - Direct Supabase API Configuration

If Supabase Dashboard doesn't show SMTP settings, use the API:

### Via Supabase CLI:

1. **Install Supabase CLI** (if not already installed):
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**:
   ```bash
   supabase login
   ```
   Follow the prompts to authenticate.

3. **Update Auth Settings**:
   ```bash
   supabase projects list
   ```
   Find your project ID: `ufrgklusakfzvpirzufm`

4. **Create a settings file** (`auth-config.json`):
   ```json
   {
     "smtp": {
       "host": "smtp.resend.com",
       "port": 465,
       "user": "default",
       "pass": "re_7TCY5dhy_3fB4dsLP6C7R2smoZ5SC7pPC",
       "sender_email": "noreply@resend.dev",
       "sender_name": "EF Report Portal"
     }
   }
   ```

5. **Apply Configuration** (Note: Supabase API may require specific endpoints):
   ```bash
   supabase projects update YOUR_PROJECT_ID --settings auth-config.json
   ```

---

## Step 5: Verify Email Configuration

### Test Sending Email:

1. **Go to Supabase Dashboard**
2. **Authentication** → **Email Templates**
3. Look for "**Send Test Email**" button
4. Enter your test email address
5. Check if email arrives (may be in spam initially)

---

## Step 6: Update Resend Sender Configuration

Go to Resend Dashboard and ensure:

1. **Verified Sender Domain**: https://resend.com/domains
   - Add your domain if using production
   - Or use `onboarding@resend.dev` for testing

2. **Set Sender Identity**:
   - From: `noreply@resend.dev` (or your domain)
   - Name: `EF Report Portal`

---

## Step 7: Configure Email Templates (Optional)

Customize the email templates in Supabase:

1. **Authentication** → **Email Templates**
2. **Confirmation Email Template**:
   ```html
   <p>Welcome to EF Report Portal!</p>
   <p>Click the link below to confirm your email:</p>
   <a href="{{ .ConfirmationURL }}">Confirm Email</a>
   <p>This link expires in 24 hours.</p>
   ```

3. **Password Reset Template**:
   ```html
   <p>You requested a password reset.</p>
   <a href="{{ .RecoveryURL }}">Reset Password</a>
   <p>This link expires in 24 hours.</p>
   ```

---

## Step 8: Test the Full Flow

1. **Start dev server**:
   ```bash
   npm run dev
   ```

2. **Sign up at**: http://localhost:3000/auth/signup

3. **Enter test email**: `test@gmail.com`

4. **Check Resend logs**:
   - Go to https://resend.com
   - Click **"Logs"** or **"Activity"**
   - Verify email was sent

5. **Check your inbox**:
   - Look for confirmation email
   - If not in inbox, check spam/promotions

6. **Click confirmation link** in email to verify

---

## Troubleshooting

### Issue: "SMTP connection failed"
- ✅ Check API key is correct (starts with `re_`)
- ✅ Check host: `smtp.resend.com`
- ✅ Check port: `465` (SSL) or `587` (TLS)

### Issue: "Email not received"
- ✅ Check Resend logs: https://resend.com/logs
- ✅ Check spam/promotions folder
- ✅ Verify sender email is configured in Resend

### Issue: "Invalid sender domain"
- ✅ Use `onboarding@resend.dev` for testing
- ✅ Or verify your domain in Resend first

### Issue: "Rate limit exceeded"
- ✅ Supabase built-in SMTP has limits
- ✅ Configure Resend SMTP to bypass them
- ✅ Premium Resend plans have higher limits

---

## Production Checklist

- [ ] Set up custom domain in Resend
- [ ] Verify domain DNS records
- [ ] Update sender email to custom domain
- [ ] Test email delivery
- [ ] Monitor Resend logs
- [ ] Set up bounce/complaint handling
- [ ] Increase email rate limits if needed

---

## Quick Reference

| Setting | Value |
|---------|-------|
| **SMTP Host** | `smtp.resend.com` |
| **Port** | `465` or `587` |
| **Username** | `default` |
| **Password** | Your RESEND_API_KEY |
| **From Email** | `noreply@resend.dev` or verified domain |
| **From Name** | `EF Report Portal` |

---

## Resend Documentation

- [Resend SMTP Setup](https://resend.com/docs/send-with-smtp)
- [Resend API Keys](https://resend.com/api-keys)
- [Resend Domains](https://resend.com/domains)
- [Resend Logs](https://resend.com/logs)

## Supabase Documentation

- [Supabase Email Auth](https://supabase.com/docs/guides/auth/auth-email)
- [Custom SMTP in Supabase](https://supabase.com/docs/guides/auth/custom-smtp)
- [Email Templates](https://supabase.com/docs/guides/auth/email-templates)
