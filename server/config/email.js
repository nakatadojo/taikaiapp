const { Resend } = require('resend');

let resend = null;

if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
  console.log('✓ Resend email service configured');
} else {
  console.log('ℹ RESEND_API_KEY not set — email links will be logged to console');
}

const EMAIL_FROM = process.env.EMAIL_FROM || 'Tournament Manager <noreply@tournament.local>';

/**
 * Send email verification link to a new user.
 */
async function sendVerificationEmail(email, token) {
  const verifyUrl = `${process.env.APP_URL || 'http://localhost:3000'}/api/auth/verify-email?token=${token}`;

  if (!resend) {
    console.log('\n📧 VERIFICATION EMAIL (dev mode)');
    console.log(`   To: ${email}`);
    console.log(`   Link: ${verifyUrl}\n`);
    return;
  }

  await resend.emails.send({
    from: EMAIL_FROM,
    to: email,
    subject: 'Verify your email address',
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 20px;">
        <h2 style="color:#1d1d1f;margin-bottom:16px;">Welcome to Tournament Manager</h2>
        <p style="color:#6e6e73;font-size:15px;line-height:1.6;">Click the button below to verify your email address and activate your account.</p>
        <a href="${verifyUrl}" style="display:inline-block;margin:24px 0;padding:14px 32px;background:#e67e22;color:white;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;">Verify Email</a>
        <p style="color:#999;font-size:13px;">This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
      </div>
    `,
  });
}

/**
 * Send password reset link.
 */
async function sendPasswordResetEmail(email, token) {
  const resetUrl = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password.html?token=${token}`;

  if (!resend) {
    console.log('\n📧 PASSWORD RESET EMAIL (dev mode)');
    console.log(`   To: ${email}`);
    console.log(`   Link: ${resetUrl}\n`);
    return;
  }

  await resend.emails.send({
    from: EMAIL_FROM,
    to: email,
    subject: 'Reset your password',
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 20px;">
        <h2 style="color:#1d1d1f;margin-bottom:16px;">Password Reset</h2>
        <p style="color:#6e6e73;font-size:15px;line-height:1.6;">Click the button below to reset your password.</p>
        <a href="${resetUrl}" style="display:inline-block;margin:24px 0;padding:14px 32px;background:#e67e22;color:white;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;">Reset Password</a>
        <p style="color:#999;font-size:13px;">This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
      </div>
    `,
  });
}

const APP_URL = () => process.env.APP_URL || 'http://localhost:3000';
const EMAIL_STYLE = 'font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;max-width:520px;margin:0 auto;padding:40px 20px;';
const CTA_STYLE = 'display:inline-block;margin:24px 0;padding:14px 32px;background:#e67e22;color:white;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;';

/**
 * Send account setup email to a coach-created user.
 */
async function sendAccountSetupEmail(email, token, coachName, academyName) {
  const setupUrl = `${APP_URL()}/setup-account.html?token=${token}`;

  if (!resend) {
    console.log('\n📧 ACCOUNT SETUP EMAIL (dev mode)');
    console.log(`   To: ${email}`);
    console.log(`   Coach: ${coachName}, Academy: ${academyName}`);
    console.log(`   Link: ${setupUrl}\n`);
    return;
  }

  await resend.emails.send({
    from: EMAIL_FROM,
    to: email,
    subject: `${coachName} registered you for ${academyName}`,
    html: `
      <div style="${EMAIL_STYLE}">
        <h2 style="color:#1d1d1f;margin-bottom:16px;">You've been registered!</h2>
        <p style="color:#6e6e73;font-size:15px;line-height:1.6;"><strong>${coachName}</strong> from <strong>${academyName}</strong> has registered you on Tournament Manager. Click the button below to set your password and activate your account.</p>
        <a href="${setupUrl}" style="${CTA_STYLE}">Set Up Your Account</a>
        <p style="color:#999;font-size:13px;">This link expires in 7 days. If you weren't expecting this, you can safely ignore this email.</p>
      </div>
    `,
  });
}

/**
 * Send assistant coach invite email.
 */
async function sendAssistantCoachInviteEmail(email, token, academyName) {
  const setupUrl = `${APP_URL()}/setup-account.html?token=${token}`;

  if (!resend) {
    console.log('\n📧 ASSISTANT COACH INVITE EMAIL (dev mode)');
    console.log(`   To: ${email}`);
    console.log(`   Academy: ${academyName}`);
    console.log(`   Link: ${setupUrl}\n`);
    return;
  }

  await resend.emails.send({
    from: EMAIL_FROM,
    to: email,
    subject: `You've been added as assistant coach at ${academyName}`,
    html: `
      <div style="${EMAIL_STYLE}">
        <h2 style="color:#1d1d1f;margin-bottom:16px;">Assistant Coach Invitation</h2>
        <p style="color:#6e6e73;font-size:15px;line-height:1.6;">You've been added as an assistant coach at <strong>${academyName}</strong>. Click the button below to set your password and access your account.</p>
        <a href="${setupUrl}" style="${CTA_STYLE}">Set Up Your Account</a>
        <p style="color:#999;font-size:13px;">This link expires in 7 days.</p>
      </div>
    `,
  });
}

/**
 * Send guardian confirmation email.
 */
async function sendGuardianConfirmationEmail(guardianEmail, token, minorName, relationship) {
  const confirmUrl = `${APP_URL()}/guardian-confirm.html?token=${token}`;

  if (!resend) {
    console.log('\n📧 GUARDIAN CONFIRMATION EMAIL (dev mode)');
    console.log(`   To: ${guardianEmail}`);
    console.log(`   Minor: ${minorName}, Relationship: ${relationship}`);
    console.log(`   Link: ${confirmUrl}\n`);
    return;
  }

  await resend.emails.send({
    from: EMAIL_FROM,
    to: guardianEmail,
    subject: `Confirm guardianship for ${minorName}`,
    html: `
      <div style="${EMAIL_STYLE}">
        <h2 style="color:#1d1d1f;margin-bottom:16px;">Guardian Confirmation Required</h2>
        <p style="color:#6e6e73;font-size:15px;line-height:1.6;"><strong>${minorName}</strong> has been registered for a tournament and you have been listed as their ${relationship}. Please confirm this by clicking the button below.</p>
        <a href="${confirmUrl}" style="${CTA_STYLE}">Confirm Guardianship</a>
        <p style="color:#999;font-size:13px;">This link expires in 72 hours. If you weren't expecting this, you can safely ignore this email.</p>
      </div>
    `,
  });
}

/**
 * Send notification to coach when guardian confirms.
 */
async function sendGuardianConfirmedEmail(coachEmail, minorName, guardianName) {
  if (!resend) {
    console.log('\n📧 GUARDIAN CONFIRMED EMAIL (dev mode)');
    console.log(`   To: ${coachEmail}`);
    console.log(`   Minor: ${minorName}, Guardian: ${guardianName}\n`);
    return;
  }

  await resend.emails.send({
    from: EMAIL_FROM,
    to: coachEmail,
    subject: `Guardian confirmed for ${minorName}`,
    html: `
      <div style="${EMAIL_STYLE}">
        <h2 style="color:#1d1d1f;margin-bottom:16px;">Guardian Confirmed</h2>
        <p style="color:#6e6e73;font-size:15px;line-height:1.6;"><strong>${guardianName}</strong> has confirmed guardianship for <strong>${minorName}</strong>. Their registration is now active.</p>
      </div>
    `,
  });
}

/**
 * Send membership request notification to coach.
 */
async function sendMembershipRequestEmail(coachEmail, applicantName, academyName) {
  if (!resend) {
    console.log('\n📧 MEMBERSHIP REQUEST EMAIL (dev mode)');
    console.log(`   To: ${coachEmail}`);
    console.log(`   Applicant: ${applicantName}, Academy: ${academyName}\n`);
    return;
  }

  await resend.emails.send({
    from: EMAIL_FROM,
    to: coachEmail,
    subject: `New membership request for ${academyName}`,
    html: `
      <div style="${EMAIL_STYLE}">
        <h2 style="color:#1d1d1f;margin-bottom:16px;">New Membership Request</h2>
        <p style="color:#6e6e73;font-size:15px;line-height:1.6;"><strong>${applicantName}</strong> has requested to join <strong>${academyName}</strong>. Log in to your dashboard to review the request.</p>
        <a href="${APP_URL()}/index.html" style="${CTA_STYLE}">Review Request</a>
      </div>
    `,
  });
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendAccountSetupEmail,
  sendAssistantCoachInviteEmail,
  sendGuardianConfirmationEmail,
  sendGuardianConfirmedEmail,
  sendMembershipRequestEmail,
};
