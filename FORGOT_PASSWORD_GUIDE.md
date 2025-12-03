# Forgot Password Feature - Implementation Guide

## Overview
Complete forgot password functionality with email verification using Nodemailer. Includes special handling for Google OAuth users who don't have passwords.

## Features Implemented

### ✅ Backend (Server)

1. **Database Schema** (`server/server.js`)
   - New table: `password_reset_tokens`
   - Stores: user_id, token, expires_at, created_at
   - Tokens expire after 1 hour

2. **Email Service** (`server/utils/emailService.js`)
   - `sendPasswordResetEmail()` function
   - Professional HTML email template
   - Reset link with 1-hour expiration notice

3. **API Endpoints** (`server/routes/authroute.js`)
   
   **POST `/api/forgot-password`**
   - Validates email exists in database
   - **Google OAuth Protection**: Returns error if user signed up with Google
   - Generates secure JWT token (1-hour expiration)
   - Sends reset link via email
   - Security: Generic success message for non-existent emails
   
   **POST `/api/reset-password`**
   - Validates JWT token signature and expiration
   - Checks token exists in database and hasn't expired
   - Verifies user still exists
   - **Google OAuth Protection**: Prevents setting password on Google accounts
   - Updates password with bcrypt hashing (8 rounds)
   - Deletes used token (prevents reuse)
   - Validates password requirements (6-16 characters)

### ✅ Frontend (Client)

1. **Login Page Enhancement** (`client/app/login/page.tsx`)
   - Added "Forgot Password?" link below password field
   - Links to `/forgot-password`

2. **Forgot Password Page** (`client/app/forgot-password/page.tsx`)
   - Email input field
   - Back to Login link
   - Success/error message display
   - Loading state
   - Same email validation as signup (max 36 chars)

3. **Reset Password Page** (`client/app/reset-password/page.tsx`)
   - Token extraction from URL query parameter
   - Two password fields (new password + confirmation)
   - Show/hide password toggles
   - Password validation (6-16 characters, must match)
   - Success/error message display
   - Auto-redirect to login after successful reset
   - Loading and disabled states

## Security Features

### 🔒 Protection Against:

1. **Email Enumeration**
   - Generic success message for non-existent emails
   - Exception: Google OAuth users get specific error (UX trade-off)

2. **Token Reuse**
   - Tokens deleted after use
   - Old tokens cleared when new ones are generated

3. **Token Expiration**
   - JWT expires after 1 hour
   - Database also tracks expiration
   - Double validation

4. **Google OAuth Account Protection**
   - Cannot request reset for Google accounts
   - Cannot set password even with valid token
   - Clear error messages

5. **User Deletion Edge Case**
   - Validates user still exists before password reset
   - Checks `this.changes` to verify UPDATE affected a row

6. **Brute Force**
   - Rate limiting already configured (100 req/min)
   - Token complexity prevents guessing

## Email Configuration

### Required Environment Variables

Add these to your `.env` file:

```env
# Email Configuration for Nodemailer
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password-here
EMAIL_FROM="Your App Name <your-email@gmail.com>"
```

### Gmail Setup (Recommended for Development)

1. **Enable 2-Factor Authentication**
   - Go to Google Account settings
   - Security → 2-Step Verification → Turn On

2. **Generate App Password**
   - Visit: https://myaccount.google.com/apppasswords
   - Select "Mail" and your device
   - Copy the 16-character password
   - Use this as `EMAIL_PASSWORD` (not your regular password)

3. **Configure .env**
   ```env
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=xxxx xxxx xxxx xxxx  # App password (remove spaces)
   EMAIL_FROM="Your App <your-email@gmail.com>"
   ```

### Alternative Email Providers

#### Outlook/Hotmail
```env
EMAIL_HOST=smtp-mail.outlook.com
EMAIL_PORT=587
EMAIL_USER=your-email@outlook.com
EMAIL_PASSWORD=your-password
```

#### SendGrid (Production Recommended)
```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASSWORD=your_sendgrid_api_key
```

#### Mailgun
```env
EMAIL_HOST=smtp.mailgun.org
EMAIL_PORT=587
EMAIL_USER=your-mailgun-username
EMAIL_PASSWORD=your-mailgun-password
```

## User Flow

### Regular User (Email/Password Account)

1. User clicks "Forgot Password?" on login page
2. Enters email address
3. Receives email with reset link
4. Clicks link → Redirected to reset password page
5. Enters new password (twice, 6-16 chars)
6. Password reset successfully
7. Auto-redirected to login page
8. Logs in with new password

### Google OAuth User

1. User clicks "Forgot Password?" on login page
2. Enters Google-associated email
3. Receives error: *"This account was created with Google Sign-In, so no password exists. Please sign in with Google."*
4. User clicks "Sign in with Google" button on login page

### Non-Existent Email

1. User enters non-registered email
2. Receives generic success message (security)
3. No email is sent
4. User doesn't know if account exists (prevents enumeration)

## Testing

### Test Cases

1. **Valid Reset Flow**
   ```
   ✓ Enter registered email
   ✓ Receive email with link
   ✓ Click link
   ✓ Enter valid new password
   ✓ Password updates successfully
   ```

2. **Google OAuth User**
   ```
   ✓ Enter Google account email
   ✓ Receive specific error message
   ✓ Cannot proceed with reset
   ```

3. **Invalid Token**
   ```
   ✓ Use expired token (>1 hour)
   ✓ Use already-used token
   ✓ Modify token manually
   ✓ All show "Invalid or expired token" error
   ```

4. **Password Validation**
   ```
   ✓ Too short (<6 chars) → Error
   ✓ Too long (>16 chars) → Error
   ✓ Passwords don't match → Error
   ✓ Valid password → Success
   ```

5. **Edge Cases**
   ```
   ✓ User deleted after token generated
   ✓ Multiple reset requests (old tokens cleared)
   ✓ Token reuse attempt
   ```

## Database Schema

### New Table: `password_reset_tokens`

```sql
CREATE TABLE password_reset_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## API Documentation

### POST `/api/forgot-password`

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Password reset link has been sent to your email."
}
```

**Google OAuth User (400):**
```json
{
  "error": "This account was created with Google Sign-In, so no password exists. Please sign in with Google."
}
```

**Error Response (500):**
```json
{
  "error": "Failed to send reset email. Please try again later."
}
```

### POST `/api/reset-password`

**Request Body:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "newPassword": "newpassword123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Password has been reset successfully"
}
```

**Error Responses:**

Invalid/Expired Token (400):
```json
{
  "error": "Invalid or expired reset token"
}
```

User Deleted (400):
```json
{
  "error": "User account no longer exists"
}
```

Google OAuth Account (400):
```json
{
  "error": "This account was created with Google Sign-In, so no password exists. Please sign in with Google."
}
```

## Troubleshooting

### Email Not Sending

1. **Check Console Logs**
   ```
   ❌ Error sending password reset email: [error message]
   ```

2. **Common Issues**
   - Wrong email credentials
   - Gmail: Must use App Password (not regular password)
   - 2FA not enabled for Gmail
   - Firewall blocking port 587
   - Wrong EMAIL_HOST or EMAIL_PORT

3. **Test Email Configuration**
   - Send a test email manually
   - Check email service status
   - Verify credentials

### Token Issues

1. **Token Expired**
   - Tokens are valid for 1 hour only
   - Request new reset link

2. **Token Already Used**
   - Each token can only be used once
   - Request new reset link

3. **Token Not Found**
   - Token was cleared from database
   - Request new reset link

### Password Requirements Not Met

- Minimum: 6 characters
- Maximum: 16 characters
- Same as signup requirements
- Must match confirmation field

## Production Recommendations

1. **Email Service**
   - Use professional service (SendGrid, Mailgun, AWS SES)
   - Don't use Gmail for production
   - Monitor email delivery rates

2. **Security**
   - Enable HTTPS (already handled by nginx)
   - Monitor failed reset attempts
   - Consider CAPTCHA for forgot password form
   - Log all password reset attempts

3. **User Experience**
   - Consider shorter token expiration (30 minutes)
   - Add email verification before allowing password login
   - Send confirmation email after successful reset
   - Show password strength indicator

4. **Monitoring**
   - Track password reset success/failure rates
   - Alert on unusual patterns
   - Log all reset attempts

## Files Modified/Created

### Backend
- ✅ `server/server.js` - Added password_reset_tokens table
- ✅ `server/routes/authroute.js` - Added forgot/reset endpoints
- ✅ `server/utils/emailService.js` - Added sendPasswordResetEmail
- ✅ `server/.env.example` - Email configuration template

### Frontend
- ✅ `client/app/login/page.tsx` - Added forgot password link
- ✅ `client/app/forgot-password/page.tsx` - New page
- ✅ `client/app/reset-password/page.tsx` - New page

## Dependencies

Already installed:
- ✅ `nodemailer` - Email sending
- ✅ `jsonwebtoken` - Token generation
- ✅ `bcryptjs` - Password hashing

No additional packages needed!

---

**Implementation Complete** ✨
