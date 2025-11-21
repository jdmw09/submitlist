import Mailgun from 'mailgun.js';
import formData from 'form-data';

// Configuration
const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY || '';
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN || '';
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@submitlist.space';
const FROM_NAME = process.env.FROM_NAME || 'TaskManager';
const APP_URL = process.env.APP_URL || 'https://submitlist.space';

// Initialize Mailgun
let mailgunClient: any = null;

if (MAILGUN_API_KEY && MAILGUN_DOMAIN) {
  const mailgun = new Mailgun(formData);
  mailgunClient = mailgun.client({
    username: 'api',
    key: MAILGUN_API_KEY,
  });
  console.log('✅ Mailgun initialized successfully');
} else {
  console.warn('⚠️  MAILGUN_API_KEY or MAILGUN_DOMAIN not configured. Email functionality will be disabled.');
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send an email using Mailgun
 */
export const sendEmail = async (options: EmailOptions): Promise<void> => {
  if (!mailgunClient) {
    console.log('📧 Email would be sent (Mailgun not configured):', options.subject, 'to', options.to);
    return;
  }

  try {
    const messageData = {
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || stripHtml(options.html),
    };

    await mailgunClient.messages.create(MAILGUN_DOMAIN, messageData);

    console.log('✅ Email sent successfully:', options.subject, 'to', options.to);
  } catch (error: any) {
    console.error('❌ Failed to send email:', error);
    if (error.message) {
      console.error('Mailgun error:', error.message);
    }
    throw new Error('Failed to send email');
  }
};

/**
 * Send email verification link
 */
export const sendVerificationEmail = async (
  email: string,
  name: string,
  token: string
): Promise<void> => {
  const verificationUrl = `${APP_URL}/verify-email/${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">TaskManager</h1>
        </div>

        <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Welcome, ${name}!</h2>

          <p style="font-size: 16px; color: #555;">
            Thank you for signing up. Please verify your email address to complete your registration.
          </p>

          <div style="text-align: center; margin: 35px 0;">
            <a href="${verificationUrl}"
               style="background: #2196F3; color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; display: inline-block;">
              Verify Email Address
            </a>
          </div>

          <p style="font-size: 14px; color: #777; margin-top: 30px;">
            Or copy and paste this link into your browser:
          </p>
          <p style="font-size: 13px; color: #2196F3; word-break: break-all; background: #f5f5f5; padding: 12px; border-radius: 4px;">
            ${verificationUrl}
          </p>

          <p style="font-size: 13px; color: #999; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
            This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
          </p>
        </div>

        <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
          <p>© ${new Date().getFullYear()} TaskManager. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  const text = `
Welcome, ${name}!

Thank you for signing up for TaskManager. Please verify your email address to complete your registration.

Verify your email by clicking this link:
${verificationUrl}

This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.

© ${new Date().getFullYear()} TaskManager. All rights reserved.
  `.trim();

  await sendEmail({
    to: email,
    subject: 'Verify Your Email Address - TaskManager',
    html,
    text,
  });
};

/**
 * Send password reset email (user-initiated)
 */
export const sendPasswordResetEmail = async (
  email: string,
  name: string,
  token: string
): Promise<void> => {
  const resetUrl = `${APP_URL}/reset-password/${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">TaskManager</h1>
        </div>

        <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Reset Your Password</h2>

          <p style="font-size: 16px; color: #555;">
            Hi ${name},
          </p>

          <p style="font-size: 16px; color: #555;">
            We received a request to reset your password. Click the button below to create a new password:
          </p>

          <div style="text-align: center; margin: 35px 0;">
            <a href="${resetUrl}"
               style="background: #f44336; color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; display: inline-block;">
              Reset Password
            </a>
          </div>

          <p style="font-size: 14px; color: #777; margin-top: 30px;">
            Or copy and paste this link into your browser:
          </p>
          <p style="font-size: 13px; color: #f44336; word-break: break-all; background: #f5f5f5; padding: 12px; border-radius: 4px;">
            ${resetUrl}
          </p>

          <p style="font-size: 13px; color: #999; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
            This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.
          </p>
        </div>

        <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
          <p>© ${new Date().getFullYear()} TaskManager. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  const text = `
Reset Your Password

Hi ${name},

We received a request to reset your password. Click the link below to create a new password:

${resetUrl}

This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.

© ${new Date().getFullYear()} TaskManager. All rights reserved.
  `.trim();

  await sendEmail({
    to: email,
    subject: 'Reset Your Password - TaskManager',
    html,
    text,
  });
};

/**
 * Send password reset notification (admin-initiated)
 */
export const sendAdminPasswordResetEmail = async (
  email: string,
  name: string,
  token: string,
  adminName: string
): Promise<void> => {
  const resetUrl = `${APP_URL}/reset-password/${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset Required</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">TaskManager</h1>
        </div>

        <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Password Reset Required</h2>

          <p style="font-size: 16px; color: #555;">
            Hi ${name},
          </p>

          <p style="font-size: 16px; color: #555;">
            An administrator (${adminName}) has initiated a password reset for your account. Please click the button below to set a new password:
          </p>

          <div style="text-align: center; margin: 35px 0;">
            <a href="${resetUrl}"
               style="background: #FF9800; color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; display: inline-block;">
              Set New Password
            </a>
          </div>

          <p style="font-size: 14px; color: #777; margin-top: 30px;">
            Or copy and paste this link into your browser:
          </p>
          <p style="font-size: 13px; color: #FF9800; word-break: break-all; background: #f5f5f5; padding: 12px; border-radius: 4px;">
            ${resetUrl}
          </p>

          <p style="font-size: 13px; color: #999; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
            This link will expire in 1 hour. If you have any questions, please contact your administrator.
          </p>
        </div>

        <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
          <p>© ${new Date().getFullYear()} TaskManager. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  const text = `
Password Reset Required

Hi ${name},

An administrator (${adminName}) has initiated a password reset for your account. Please use the link below to set a new password:

${resetUrl}

This link will expire in 1 hour. If you have any questions, please contact your administrator.

© ${new Date().getFullYear()} TaskManager. All rights reserved.
  `.trim();

  await sendEmail({
    to: email,
    subject: 'Password Reset Required - TaskManager',
    html,
    text,
  });
};

/**
 * Send password changed notification
 */
export const sendPasswordChangedEmail = async (
  email: string,
  name: string
): Promise<void> => {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Changed</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #4CAF50 0%, #8BC34A 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">TaskManager</h1>
        </div>

        <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">✓ Password Changed Successfully</h2>

          <p style="font-size: 16px; color: #555;">
            Hi ${name},
          </p>

          <p style="font-size: 16px; color: #555;">
            This is a confirmation that your password was successfully changed.
          </p>

          <p style="font-size: 14px; color: #f44336; background: #ffebee; padding: 15px; border-left: 4px solid #f44336; border-radius: 4px; margin: 25px 0;">
            <strong>Important:</strong> If you did not make this change, please contact support immediately and consider securing your account.
          </p>

          <p style="font-size: 13px; color: #999; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
            This is an automated security notification. Please do not reply to this email.
          </p>
        </div>

        <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
          <p>© ${new Date().getFullYear()} TaskManager. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  const text = `
Password Changed Successfully

Hi ${name},

This is a confirmation that your password was successfully changed.

IMPORTANT: If you did not make this change, please contact support immediately and consider securing your account.

This is an automated security notification. Please do not reply to this email.

© ${new Date().getFullYear()} TaskManager. All rights reserved.
  `.trim();

  await sendEmail({
    to: email,
    subject: 'Password Changed - TaskManager',
    html,
    text,
  });
};

/**
 * Send email verified success notification
 */
export const sendEmailVerifiedEmail = async (
  email: string,
  name: string
): Promise<void> => {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verified</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">TaskManager</h1>
        </div>

        <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">✓ Email Verified!</h2>

          <p style="font-size: 16px; color: #555;">
            Hi ${name},
          </p>

          <p style="font-size: 16px; color: #555;">
            Your email address has been successfully verified. You now have full access to all TaskManager features!
          </p>

          <div style="text-align: center; margin: 35px 0;">
            <a href="${APP_URL}"
               style="background: #2196F3; color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; display: inline-block;">
              Go to Dashboard
            </a>
          </div>

          <p style="font-size: 13px; color: #999; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
            Thank you for joining TaskManager. We're excited to have you on board!
          </p>
        </div>

        <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
          <p>© ${new Date().getFullYear()} TaskManager. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  const text = `
Email Verified!

Hi ${name},

Your email address has been successfully verified. You now have full access to all TaskManager features!

Visit your dashboard: ${APP_URL}

Thank you for joining TaskManager. We're excited to have you on board!

© ${new Date().getFullYear()} TaskManager. All rights reserved.
  `.trim();

  await sendEmail({
    to: email,
    subject: 'Email Verified - Welcome to TaskManager!',
    html,
    text,
  });
};

/**
 * Strip HTML tags from a string (basic implementation)
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
