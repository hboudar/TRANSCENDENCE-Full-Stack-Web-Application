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


const transporter = isEmailConfigured ? nodemailer.createTransport({
    host: EMAIL_HOST,
    port: parseInt(EMAIL_PORT),
    secure: false, 
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASSWORD,
    },
    debug: true, 
    logger: true 
}) : null;


export function generateVerificationToken() {
    const token = crypto.randomBytes(32).toString('hex');
    const timestamp = Date.now();
    
    return `${token}.${timestamp}`;
}


export function isTokenExpired(tokenWithTimestamp) {
    if (!tokenWithTimestamp || !tokenWithTimestamp.includes('.')) {
        return true; 
    }
    
    const [token, timestamp] = tokenWithTimestamp.split('.');
    const tokenAge = Date.now() - parseInt(timestamp);
    const FIVE_MINUTES = 60 * 60 * 1000;
    
    return tokenAge > FIVE_MINUTES;
}


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
                    ⚠️ This link will expire in 5 minutes.
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
