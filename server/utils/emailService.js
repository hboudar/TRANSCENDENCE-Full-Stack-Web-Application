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

// Create reusable transporter
const transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASSWORD,
    },
});

// Generate verification token with timestamp
export function generateVerificationToken() {
    const token = crypto.randomBytes(32).toString('hex');
    const timestamp = Date.now();
    // Combine token and timestamp: token.timestamp
    return `${token}.${timestamp}`;
}

// Check if token is expired (5 minutes = 300000 ms)
export function isTokenExpired(tokenWithTimestamp) {
    if (!tokenWithTimestamp || !tokenWithTimestamp.includes('.')) {
        return true; // Invalid format
    }
    
    const [token, timestamp] = tokenWithTimestamp.split('.');
    const tokenAge = Date.now() - parseInt(timestamp);
    const FIVE_MINUTES = 5 * 60 * 1000; // 5 minutes in milliseconds
    
    return tokenAge > FIVE_MINUTES;
}

// Send verification email
export async function sendVerificationEmail(email, token, name) {
    const verificationUrl = `https://localhost/verify-email-result?token=${token}`;
    
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
                <p style="color: #999; font-size: 12px; margin-top: 30px;">
                    If you didn't create an account, please ignore this email.
                </p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('✅ Verification email sent to:', email);
        return true;
    } catch (error) {
        console.error('❌ Error sending verification email:', error.message);
        return false;
    }
}
