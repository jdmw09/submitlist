# Mailgun Setup Guide

## Overview

TaskManager uses Mailgun for sending transactional emails (verification, password reset, notifications).

**Mailgun Free Tier:** 1,000 emails/month for first 3 months

## Setup Steps

### 1. Create Mailgun Account

1. Go to https://www.mailgun.com/
2. Click "Sign Up" (free trial available)
3. Verify your email address

### 2. Get API Credentials

After signing up:

1. Go to **Settings → API Keys**
2. Copy your **Private API key**
3. Go to **Sending → Domains**
4. Copy your **Domain name** (e.g., `sandboxXXX.mailgun.org` or your custom domain)

### 3. Configure Environment Variables

Add these to your `.env` file:

```env
# Mailgun Configuration
MAILGUN_API_KEY=your_mailgun_api_key_here
MAILGUN_DOMAIN=sandboxXXX.mailgun.org
FROM_EMAIL=noreply@submitlist.space
FROM_NAME=TaskManager
APP_URL=https://submitlist.space
```

**Important:**
- `MAILGUN_API_KEY`: Your Private API key from Mailgun dashboard
- `MAILGUN_DOMAIN`: Your Mailgun domain (sandbox or verified domain)
- `FROM_EMAIL`: The email address emails will be sent from
- `FROM_NAME`: The name that appears in the "From" field
- `APP_URL`: Your production URL (used in email links)

### 4. Verify Domain (Optional - For Production)

**For Sandbox Domain (Testing):**
- Mailgun's sandbox domain works immediately
- You can only send to **authorized recipients** (must add their emails in Mailgun dashboard)
- 300 emails/day limit

**For Custom Domain (Production):**
1. Go to **Sending → Domains** → **Add New Domain**
2. Enter your domain (e.g., `submitlist.space`)
3. Add the DNS records Mailgun provides to your DNS provider
4. Wait for verification (usually 24-48 hours)
5. Once verified, you can send to any email address

### 5. Add Authorized Recipients (Sandbox Only)

If using sandbox domain for testing:

1. Go to **Sending → Domains** → Select your sandbox domain
2. Click **Authorized Recipients**
3. Add email addresses you want to test with
4. Recipients will receive a confirmation email

### 6. Test Email Sending

After configuration, restart your backend:

```bash
cd backend
npm install
npm run build
pm2 restart taskmanager-backend
```

Test by registering a new account - you should receive a verification email!

## Email Templates Included

1. **Email Verification** - Sent when user registers
2. **Password Reset (User-Initiated)** - Sent when user clicks "Forgot Password"
3. **Password Reset (Admin-Initiated)** - Sent when admin resets user password
4. **Password Changed** - Security notification when password is changed
5. **Email Verified** - Confirmation when email is successfully verified

## Troubleshooting

### Emails not sending?

Check backend logs:
```bash
pm2 logs taskmanager-backend
```

Look for:
- `✅ Mailgun initialized successfully` - Configuration is correct
- `⚠️ MAILGUN_API_KEY or MAILGUN_DOMAIN not configured` - Missing config
- `❌ Failed to send email` - Check API key and domain

### "Forbidden" error?

- Check that your API key is correct
- Ensure you're using the **Private API key**, not Public
- Verify domain is set up correctly

### Emails going to spam?

- Use a verified domain instead of sandbox
- Set up SPF and DKIM records (Mailgun provides these)
- Add DMARC record to your domain

### Sandbox limitations?

- Only 300 emails/day
- Can only send to authorized recipients
- To remove limits, verify your own domain

## Mailgun Dashboard

Access your dashboard at: https://app.mailgun.com/

**Useful sections:**
- **Dashboard** - Email statistics and usage
- **Sending → Logs** - View all sent emails and delivery status
- **Settings → API Keys** - Manage API keys
- **Sending → Domains** - Manage domains

## Cost After Free Trial

After 3 months free trial:
- **Foundation Plan**: $35/month (50,000 emails)
- **Scale Plan**: $80/month (100,000 emails)
- **Pay As You Go**: $0.80 per 1,000 emails

For TaskManager with moderate usage (notifications, resets), Foundation plan should be sufficient.

## Alternative: Use Your Own SMTP

If you prefer to use your own email server or another provider (Gmail, AWS SES, etc.), you can modify `/backend/src/services/emailService.ts` to use Nodemailer with SMTP instead.

## Support

- Mailgun Documentation: https://documentation.mailgun.com/
- Mailgun Support: https://www.mailgun.com/support/
