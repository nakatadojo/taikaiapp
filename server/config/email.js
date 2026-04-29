const { Resend } = require('resend');

let resend = null;

if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
  console.log('✓ Resend email service configured');
} else {
  const msg = 'RESEND_API_KEY not set — email links will be logged to console';
  if (process.env.NODE_ENV === 'production') {
    console.error(`WARNING: ${msg}. Registration confirmations, password resets, and guardian emails will NOT be sent.`);
  } else {
    console.log(`ℹ ${msg}`);
  }
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
        <a href="${verifyUrl}" style="display:inline-block;margin:24px 0;padding:14px 32px;background:#cc0000;color:white;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;">Verify Email</a>
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
        <a href="${resetUrl}" style="display:inline-block;margin:24px 0;padding:14px 32px;background:#cc0000;color:white;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;">Reset Password</a>
        <p style="color:#999;font-size:13px;">This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
      </div>
    `,
  });
}

const APP_URL = () => process.env.APP_URL || 'http://localhost:3000';
const EMAIL_STYLE = 'font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;max-width:520px;margin:0 auto;padding:40px 20px;';
const CTA_STYLE = 'display:inline-block;margin:24px 0;padding:14px 32px;background:#cc0000;color:white;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;';

/**
 * Send account setup email to a coach-created user.
 */
async function sendAccountSetupEmail(email, token, coachName, academyName) {
  const setupUrl = `${APP_URL()}/setup-account.html?token=${token}`;

  if (!resend) {
    console.log('\n📧 ACCOUNT SETUP EMAIL (dev mode)');
    console.log(`   To: ${email}`);
    console.log(`   Coach: ${coachName}, Dojo: ${academyName}`);
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
    console.log(`   Dojo: ${academyName}`);
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
    console.log(`   Applicant: ${applicantName}, Dojo: ${academyName}\n`);
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

/**
 * Send registration confirmation email after successful payment.
 */
async function sendRegistrationConfirmationEmail(email, tournament, competitors, totalPaid, discountAmount, transactionId) {
  const competitorRows = competitors.map(c => {
    const evtList = c.events.map(e =>
      `<li style="color:#6e6e73;font-size:14px;padding:2px 0;">${e.name} — $${e.price.toFixed(2)}</li>`
    ).join('');
    return `
      <div style="margin-bottom:16px;padding:12px;background:#f5f5f7;border-radius:8px;">
        <strong style="color:#1d1d1f;">${c.name}</strong>
        <ul style="margin:8px 0 0;padding-left:20px;">${evtList}</ul>
        <p style="color:#1d1d1f;font-size:14px;margin:8px 0 0;font-weight:600;">Subtotal: $${c.subtotal.toFixed(2)}</p>
      </div>
    `;
  }).join('');

  const discountLine = discountAmount > 0
    ? `<p style="color:#cc0000;font-size:15px;">Discount: -$${discountAmount.toFixed(2)}</p>`
    : '';

  const tournamentDate = tournament.date
    ? new Date(typeof tournament.date === 'string' && tournament.date.length === 10 ? tournament.date + 'T12:00:00' : tournament.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : 'TBD';

  if (!resend) {
    console.log('\n📧 REGISTRATION CONFIRMATION EMAIL (dev mode)');
    console.log(`   To: ${email}`);
    console.log(`   Tournament: ${tournament.name}`);
    console.log(`   Competitors: ${competitors.map(c => c.name).join(', ')}`);
    console.log(`   Total: $${totalPaid.toFixed(2)}`);
    console.log(`   Transaction: ${transactionId}\n`);
    return;
  }

  await resend.emails.send({
    from: EMAIL_FROM,
    to: email,
    subject: `Registration Confirmed — ${tournament.name}`,
    html: `
      <div style="${EMAIL_STYLE}">
        <h2 style="color:#1d1d1f;margin-bottom:8px;">Registration Confirmed! ✓</h2>
        <p style="color:#6e6e73;font-size:15px;line-height:1.6;">Your registration for <strong>${tournament.name}</strong> has been confirmed.</p>

        <div style="margin:20px 0;padding:16px;background:#f0f0f2;border-radius:12px;">
          <p style="color:#6e6e73;font-size:14px;margin:0;"><strong>Date:</strong> ${tournamentDate}</p>
          <p style="color:#6e6e73;font-size:14px;margin:4px 0 0;"><strong>Location:</strong> ${tournament.location || 'TBD'}</p>
        </div>

        <h3 style="color:#1d1d1f;margin-bottom:12px;">Registered Competitors</h3>
        ${competitorRows}

        ${discountLine}
        <p style="color:#1d1d1f;font-size:18px;font-weight:700;margin:16px 0;">Total Paid: $${totalPaid.toFixed(2)}</p>
        <p style="color:#999;font-size:12px;">Transaction ID: ${transactionId}</p>

        <hr style="border:none;border-top:1px solid #e5e5e7;margin:24px 0;">
        <p style="color:#999;font-size:13px;">If you need to make changes to your registration, please contact the tournament organizer.</p>
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
  sendRegistrationConfirmationEmail,
};
