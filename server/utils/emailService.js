import nodemailer from 'nodemailer';
import crypto from 'crypto';

const {
    EMAIL_HOST,
    EMAIL_PORT,
    EMAIL_USER,
    EMAIL_PASSWORD,
    EMAIL_FROM,
    CLIENT_URL
} = process.env;

// Check if email configuration is present
const isEmailConfigured = EMAIL_HOST && EMAIL_PORT && EMAIL_USER && EMAIL_PASSWORD && EMAIL_FROM;

if (!isEmailConfigured) {
    console.warn('⚠️  EMAIL CONFIGURATION MISSING!');
    console.warn('Please configure the following in your .env file:');
    console.warn('- EMAIL_HOST (e.g., smtp.gmail.com)');
    console.warn('- EMAIL_PORT (e.g., 587)');
    console.warn('- EMAIL_USER (your email address)');
    console.warn('- EMAIL_PASSWORD (your email password or app password)');
    console.warn('- EMAIL_FROM (sender name and email)');
    console.warn('Emails will NOT be sent until configured!\n');
}

// Create reusable transporter
const transporter = isEmailConfigured ? nodemailer.createTransport({
    host: EMAIL_HOST,
    port: parseInt(EMAIL_PORT),
    secure: false, // true for 465, false for other ports
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASSWORD,
    },
    debug: true, // Enable debug output
    logger: true // Log to console
}) : null;

// Generate verification token with timestamp
export function generateVerificationToken() {
    const token = crypto.randomBytes(32).toString('hex');
    const timestamp = Date.now();
    // Combine token and timestamp: token.timestamp
    return `${token}.${timestamp}`;
}

// Check if token is expired (10 minutes = 600000 ms)
export function isTokenExpired(tokenWithTimestamp) {
    if (!tokenWithTimestamp || !tokenWithTimestamp.includes('.')) {
        return true; // Invalid format
    }
    
    const [token, timestamp] = tokenWithTimestamp.split('.');
    const tokenAge = Date.now() - parseInt(timestamp);
    const TEN_MINUTES = 10 * 60 * 1000; // 10 minutes in milliseconds
    
    return tokenAge > TEN_MINUTES;
}

// Send verification email
export async function sendVerificationEmail(email, token, name) {
    if (!transporter) {
        console.error('❌ Cannot send verification email: Email service not configured');
        return false;
    }

    const verificationUrl = `${CLIENT_URL}/verify-email?token=${token}`;
    
    const mailOptions = {
        from: EMAIL_FROM,
        to: email,
        subject: 'Verify Your Email Address',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #4c7cf3;">Welcome to Our Platform!</h2>
                <p>Hi ${name},</p>
                <p>Thank you for registering! Please verify your email address by clicking the button below:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${verificationUrl}" 
                       style="background-color: #4c7cf3; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                        Verify Email
                    </a>
                </div>
                <p>Or copy and paste this link into your browser:</p>
                <p style="color: #666; word-break: break-all;">${verificationUrl}</p>
                <p style="color: #ff6b6b; margin-top: 20px;">
                    ⚠️ This link will expire in 10 minutes for security reasons.
                </p>
                <p style="color: #999; font-size: 12px; margin-top: 30px;">
                    If you didn't create an account, please ignore this email.
                </p>
            </div>
        `
    };

    try {
        console.log('📧 Attempting to send verification email to:', email);
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Verification email sent successfully!');
        console.log('   Message ID:', info.messageId);
        console.log('   To:', email);
        return true;
    } catch (error) {
        console.error('❌ Error sending verification email:');
        console.error('   Error:', error.message);
        console.error('   Code:', error.code);
        console.error('   To:', email);
        return false;
    }
}

// Send password reset email
export async function sendPasswordResetEmail(email, token, name) {
    if (!transporter) {
        console.error('❌ Cannot send password reset email: Email service not configured');
        return false;
    }

    const resetUrl = `${CLIENT_URL}/reset-password?token=${token}`;
    
    const mailOptions = {
        from: EMAIL_FROM,
        to: email,
        subject: 'Reset Your Password',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #4c7cf3;">Password Reset Request</h2>
                <p>Hi ${name},</p>
                <p>We received a request to reset your password. Click the button below to create a new password:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetUrl}"
                       style="background-color: #4c7cf3; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                        Reset Password
                    </a>
                </div>
                <p>Or copy and paste this link into your browser:</p>
                <p style="color: #666; word-break: break-all;">${resetUrl}</p>
                <p style="color: #ff6b6b; margin-top: 20px;">
                    ⚠️ This link will expire in 10 minutes for security reasons.
                </p>
                <p style="color: #999; font-size: 12px; margin-top: 30px;">
                    If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
                </p>
            </div>
        `
    };

    try {
        console.log('📧 Attempting to send password reset email to:', email);
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Password reset email sent successfully!');
        console.log('   Message ID:', info.messageId);
        console.log('   To:', email);
        return true;
    } catch (error) {
        console.error('❌ Error sending password reset email:');
        console.error('   Error:', error.message);
        console.error('   Code:', error.code);
        console.error('   To:', email);
        return false;
    }
}
