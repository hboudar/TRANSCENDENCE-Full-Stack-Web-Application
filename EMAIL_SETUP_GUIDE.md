# Email Configuration Setup Guide

## ⚠️ Current Issue: Emails Not Being Sent

The emails are not being sent because the email service is **not configured**. You need to set up the email environment variables in your `.env` file.

## Quick Setup (Gmail - Recommended for Development)

### Step 1: Create `.env` file

In the `server/` directory, create a `.env` file:

```bash
cd server
cp .env.example .env
```

### Step 2: Configure Gmail App Password

**⚠️ IMPORTANT:** You CANNOT use your regular Gmail password. You must use an **App Password**.

1. **Enable 2-Factor Authentication**
   - Go to: https://myaccount.google.com/security
   - Find "2-Step Verification" and turn it ON
   - Follow the setup process

2. **Generate App Password**
   - Go to: https://myaccount.google.com/apppasswords
   - If you don't see this option, make sure 2FA is enabled
   - Select "Mail" as the app
   - Select your device type
   - Click "Generate"
   - Copy the 16-character password (remove spaces)

3. **Update `.env` file**

Edit `server/.env`:

```env
# Your actual Gmail address
EMAIL_USER=your.email@gmail.com

# The 16-character app password (NOT your regular password)
EMAIL_PASSWORD=abcd efgh ijkl mnop

# Sender name and email
EMAIL_FROM="Your App Name <your.email@gmail.com>"

# Gmail SMTP settings (already correct)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587

# Your frontend URL
CLIENT_URL=http://localhost:3000

# Your JWT secret
JWT_SECRET=your_secret_key_here
```

### Step 3: Restart Your Server

```bash
# Stop the server (Ctrl+C)
# Then restart it
npm start
```

### Step 4: Check Console Output

When the server starts, you should see:

✅ **If configured correctly:**
```
Connected to SQLite DB
Server listening at http://0.0.0.0:3000
```

❌ **If NOT configured:**
```
⚠️  EMAIL CONFIGURATION MISSING!
Please configure the following in your .env file:
- EMAIL_HOST (e.g., smtp.gmail.com)
- EMAIL_PORT (e.g., 587)
- EMAIL_USER (your email address)
- EMAIL_PASSWORD (your email password or app password)
- EMAIL_FROM (sender name and email)
Emails will NOT be sent until configured!
```

## Testing Email Functionality

### Test Forgot Password:

1. Go to login page
2. Click "Forgot Password?"
3. Enter a registered email
4. Check console output for:

```
📧 Attempting to send password reset email to: user@example.com
✅ Password reset email sent successfully!
   Message ID: <...>
   To: user@example.com
```

5. Check your email inbox (might be in spam folder)

### If Email Fails:

Check console for error messages:

```
❌ Error sending password reset email:
   Error: [error message here]
   Code: [error code]
   To: user@example.com
```

## Common Errors & Solutions

### 1. "Invalid login: 535-5.7.8 Username and Password not accepted"

**Problem:** Using regular Gmail password instead of App Password

**Solution:** 
- Enable 2FA
- Generate App Password
- Use App Password in EMAIL_PASSWORD

### 2. "connect ECONNREFUSED"

**Problem:** Wrong EMAIL_HOST or EMAIL_PORT

**Solution:**
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
```

### 3. "self signed certificate"

**Problem:** SSL/TLS issues

**Solution:** Make sure `secure: false` for port 587

### 4. "Cannot send email: Email service not configured"

**Problem:** Environment variables not loaded

**Solution:**
- Make sure `.env` file exists in `server/` directory
- Restart the server
- Check for typos in variable names

### 5. Email Goes to Spam

**Solution:**
- Check spam folder
- In production, use a verified domain
- Use professional email service (SendGrid, Mailgun)

## Alternative Email Providers

### Outlook/Hotmail

```env
EMAIL_HOST=smtp-mail.outlook.com
EMAIL_PORT=587
EMAIL_USER=your-email@outlook.com
EMAIL_PASSWORD=your-outlook-password
EMAIL_FROM="Your App <your-email@outlook.com>"
```

### SendGrid (Production Recommended)

1. Sign up at https://sendgrid.com
2. Create an API Key
3. Configure:

```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASSWORD=your_sendgrid_api_key
EMAIL_FROM="Your App <verified@yourdomain.com>"
```

## Debug Checklist

- [ ] `.env` file exists in `server/` directory
- [ ] All EMAIL_* variables are set
- [ ] Using Gmail App Password (not regular password)
- [ ] 2FA enabled on Gmail account
- [ ] No typos in EMAIL_USER (your email address)
- [ ] No spaces in EMAIL_PASSWORD (app password)
- [ ] Server restarted after changing .env
- [ ] Check console output when sending email
- [ ] Check spam folder in email

## Current Email Flow

1. **User requests password reset**
   - Enters email on forgot password page
   - Server checks if email exists
   - If exists and not Google account, generates reset token

2. **Server sends email**
   - Creates HTML email with reset link
   - Sends via SMTP (Gmail, SendGrid, etc.)
   - Console shows success or error

3. **User receives email**
   - Clicks reset link
   - Redirected to reset password page
   - Enters new password

4. **Password updated**
   - Token validated
   - Password updated in database
   - User redirected to login

## Need Help?

If emails still don't work after following this guide:

1. Check server console for detailed error messages
2. Verify all environment variables are set correctly
3. Try with a different email provider
4. Make sure firewall isn't blocking port 587
5. Test with a simple nodemailer test script

## Quick Test Script

Create `test-email.js` in server directory:

```javascript
import nodemailer from 'nodemailer';
import 'dotenv/config';

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT),
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
});

const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: process.env.EMAIL_USER, // Send to yourself
    subject: 'Test Email',
    text: 'If you receive this, email is configured correctly!'
};

transporter.sendMail(mailOptions)
    .then(info => {
        console.log('✅ Test email sent!');
        console.log('Message ID:', info.messageId);
    })
    .catch(error => {
        console.error('❌ Test email failed:');
        console.error(error);
    });
```

Run with:
```bash
node test-email.js
```

---

**After configuration, all password reset emails will be sent automatically!** 📧
