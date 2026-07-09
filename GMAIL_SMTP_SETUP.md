# Gmail SMTP Setup for Supabase Email Authentication

Complete guide to use Gmail as your email provider via SMTP app password.

---

## Step 1: Enable 2-Factor Authentication on Gmail

1. Go to **https://myaccount.google.com**
2. Click **"Security"** in the left sidebar
3. Scroll down to **"How you sign in to Google"**
4. Enable **"2-Step Verification"** if not already enabled
   - Follow the prompts
   - You'll need to verify with your phone

---

## Step 2: Create App Password

1. Go back to **https://myaccount.google.com** → **Security**
2. Scroll down to **"App passwords"** (only appears after 2FA is enabled)
3. Select:
   - **App**: Google Mail
   - **Device**: Windows (or your OS)
4. Click **"Generate"**
5. **Copy the 16-character password** that appears (e.g., `abcd efgh ijkl mnop`)
   - Remove spaces when using: `abcdefghijklmnop`

---

## Step 3: Add Gmail Credentials to .env

Update your `.env` file with Gmail SMTP settings:

```env
# Gmail SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tariku25j@gmail.com
SMTP_PASSWORD=abcdefghijklmnop
SMTP_FROM_EMAIL=tariku25j@gmail.com
SMTP_FROM_NAME=EF Report Portal
```

---

## Step 4: Configure Supabase with Gmail SMTP

### Via Supabase Dashboard:

1. **Go to Supabase Dashboard**: https://app.supabase.com
2. **Select your project**: `ufrgklusakfzvpirzufm`
3. **Click "Authentication"** → **"Email"** (or Settings)
4. Look for **"SMTP Settings"** or **"Custom Email Provider"**

### Fill in these settings:

- **SMTP Host**: `smtp.gmail.com`
- **SMTP Port**: `587` (TLS) or `465` (SSL)
- **SMTP Username**: `tariku25j@gmail.com`
- **SMTP Password**: `abcd efgh ijkl mnop` (your app password)
- **From Email**: `tariku25j@gmail.com`
- **From Name**: `EF Report Portal`
- **Reply To**: `tariku25j@gmail.com` (optional)

5. Click **"Save"** or **"Test Connection"**

---

## Step 5: Update Application Code

### Revert Auto-Confirmation (Enable Email Verification)

Your signup route currently auto-confirms users. Let's revert it to require email confirmation:

**File**: `app/api/auth/signup/route.ts`

Replace this section:

```typescript
// DEVELOPMENT: Skip email confirmation to avoid rate limits
// In production, remove the emailConfirmationType line and ensure email sending is properly configured
const { data, error } = await supabase.auth.signUp({
  email: trimmedEmail,
  password,
  options: {
    emailRedirectTo: `${new URL(request.url).origin}/auth/callback`,
    // For development/testing: auto-confirm without sending email
    data: {
      email_confirmed: true,
    },
  },
})
```

With this:

```typescript
// Create the user via the server-side Supabase client (handles cookies properly)
const { data, error } = await supabase.auth.signUp({
  email: trimmedEmail,
  password,
  options: {
    emailRedirectTo: `${new URL(request.url).origin}/auth/callback`,
  },
})
```

---

## Step 6: Test Gmail SMTP Connection

### Option A: Via Supabase Dashboard

1. In Supabase, look for **"Send Test Email"** button
2. Enter a test email address
3. Check if you receive the confirmation email

### Option B: Manual Test

1. Start dev server:
   ```bash
   npm run dev
   ```

2. Go to: `http://localhost:3000/auth/signup`

3. Sign up with test email:
   - Email: `test@gmail.com` (or any email)
   - Password: `TestPassword123`

4. Check your inbox for confirmation email from `tariku25j@gmail.com`

5. Click the confirmation link to verify

---

## Step 7: Gmail Security Settings (Important!)

### Allow "Less Secure Apps" (if needed)

If you get "authentication failed" errors:

1. Go to **https://myaccount.google.com/lesssecureapps**
2. Toggle **"Allow less secure app access"** to **ON**

⚠️ **Note**: Google recommends using App Passwords instead. If you set up App Password correctly, you shouldn't need this.

### Gmail Security Alerts

You may see security alerts. This is normal:
- Click **"Review activity"** 
- Mark as "**This was me**" if prompted

---

## Step 8: Test Email Delivery

### Check Gmail Sent Folder

1. Go to `https://mail.google.com`
2. Look in **"Sent Mail"**
3. You should see emails sent from Supabase

### Monitor Supabase Logs

1. Go to Supabase Dashboard
2. Click **"Logs"** → **"API"**
3. Search for "auth/signup" or "send_email"
4. Look for any errors

### Gmail Activity Log

1. Go to **https://myaccount.google.com/security**
2. Scroll to **"Your devices"**
3. Check recent activity from Supabase

---

## Troubleshooting

### Issue: "Authentication failed"
**Solution:**
```
1. Verify app password is correct (16 characters)
2. Remove spaces from password
3. Check SMTP_USER = your Gmail address
4. Ensure 2FA is enabled on Gmail account
5. Check "Allow less secure apps" if needed
```

### Issue: "Connection refused" or "Port denied"
**Solution:**
```
Try different port:
- Port 587 (TLS) - most compatible
- Port 465 (SSL) - alternative
- Port 25 (SMTP) - rarely works
```

### Issue: "Email not received"
**Solution:**
```
1. Check Gmail Sent folder (mail.google.com)
2. Check recipient spam folder
3. Verify SMTP_FROM_EMAIL in Supabase matches sender
4. Check Supabase logs for errors
5. Try sending manually from Gmail to test
```

### Issue: "Too many failed login attempts"
**Solution:**
```
1. Wait 24 hours (Google locks account temporarily)
2. Check app password is correct
3. Go to https://accounts.google.com/DisplayUnlockCaptcha
4. Complete the verification
```

### Issue: Supabase Dashboard doesn't show SMTP Settings
**Solution:**
```
1. Check Supabase version (older versions may not support SMTP UI)
2. Use Supabase CLI instead:
   supabase projects update YOUR_PROJECT_ID --smtp ...
3. Or contact Supabase support
```

---

## Gmail SMTP Quick Reference

| Setting | Value |
|---------|-------|
| **SMTP Host** | `smtp.gmail.com` |
| **SMTP Port** | `587` (TLS) or `465` (SSL) |
| **SMTP Username** | `tariku25j@gmail.com` |
| **SMTP Password** | Your 16-char app password |
| **From Email** | `tariku25j@gmail.com` |
| **From Name** | `EF Report Portal` |
| **TLS Required** | Yes |
| **Authentication** | PLAIN or LOGIN |

---

## Security Best Practices

✅ **Do:**
- Use App Password (not your actual Gmail password)
- Enable 2-Factor Authentication
- Keep `.env` file private (never commit to Git)
- Use HTTPS in production
- Rotate app password every 90 days

❌ **Don't:**
- Share your app password
- Use your main Gmail password
- Store credentials in code
- Commit `.env` to version control

---

## Production Considerations

1. **Use a business email** instead of personal Gmail
   - Create `noreply@yourdomain.com` or similar
   - Set up forwarding if needed

2. **Monitor email deliverability**
   - Check Gmail activity logs regularly
   - Monitor bounce rates

3. **Set up email templates**
   - Customize confirmation email
   - Add company branding
   - Professional subject lines

4. **Consider email service providers**
   - After testing, migrate to SendGrid, Mailgun, or AWS SES
   - Better for production scale

---

## Alternative Email Providers

If Gmail SMTP doesn't work, try:

- **SendGrid**: `smtp.sendgrid.net:587`
- **Mailgun**: `smtp.mailgun.org:587`
- **AWS SES**: `email-smtp.region.amazonaws.com:587`
- **Zoho Mail**: `smtp.zoho.com:587`
- **Brevo (Sendinblue)**: `smtp-relay.brevo.com:587`

---

## Next Steps

1. **Create Gmail App Password** (Step 1-2 above)
2. **Update `.env`** with Gmail SMTP settings (Step 3)
3. **Configure Supabase** (Step 4)
4. **Revert auto-confirmation** in code (Step 5)
5. **Test full signup flow** (Step 6)
6. **Monitor delivery** (Step 8)

**Done! Your app should now send confirmation emails via Gmail SMTP.** 🎉

---

## Need Help?

Check these resources:
- [Gmail App Password Help](https://support.google.com/accounts/answer/185833)
- [Supabase Email Auth Docs](https://supabase.com/docs/guides/auth/auth-email)
- [Gmail SMTP Settings](https://support.google.com/mail/answer/7126229)
