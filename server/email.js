/**
 * Shared Email Service — Taikai by Kimesoft
 *
 * Initialises the Resend client once and exports a generic sendEmail() helper
 * plus convenience wrappers used by the rest of the application.
 *
 * All emails send from:  Taikai <noreply@taikaiapp.com>
 */

const { Resend } = require('resend');

let resend = null;

if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
  console.log('✓ Resend email service configured');
} else {
  console.log('ℹ RESEND_API_KEY not set — emails will be logged to console');
}

console.log(`  Email from: ${process.env.RESEND_FROM_EMAIL || 'Taikai <noreply@taikaiapp.com>'}`);
console.log(`  APP_URL:    ${process.env.APP_URL || '(not set — defaulting to http://localhost:3000)'}`);

const EMAIL_FROM = 'Taikai <noreply@taikaiapp.com>';
const APP_URL = () => process.env.APP_URL || 'http://localhost:3000';

// ── Templates ────────────────────────────────────────────────────────────────

const templates = {
  registrationConfirmation: require('./emails/registrationConfirmation'),
  directorWelcome:          require('./emails/directorWelcome'),
  passwordReset:            require('./emails/passwordReset'),
  tournamentPublished:      require('./emails/tournamentPublished'),
  roleRequest:              require('./emails/roleRequest'),
  roleApproved:             require('./emails/roleApproved'),
  roleDeclined:             require('./emails/roleDeclined'),
  waiverRequest:            require('./emails/waiverRequest'),
  waiverSigned:             require('./emails/waiverSigned'),
  tournamentInvite:         require('./emails/tournamentInvite'),
};

// ── Core send helper ─────────────────────────────────────────────────────────

/**
 * Send an email via Resend.
 * Falls back to console logging when RESEND_API_KEY is not configured.
 *
 * @param {string} to      – recipient address
 * @param {string} subject – email subject line
 * @param {string} html    – rendered HTML body
 * @returns {Promise<object|undefined>}
 */
async function sendEmail(to, subject, html) {
  if (!resend) {
    console.log(`\n📧 EMAIL (dev mode)`);
    console.log(`   To:      ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   HTML:    ${html.length} chars\n`);
    return;
  }

  try {
    const result = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      html,
    });

    if (result.error) {
      console.error('✗ Resend API error:', result.error);
      throw new Error(result.error.message || 'Email send failed');
    }

    console.log(`✓ Email sent to ${to}: "${subject}"`);
    return result;
  } catch (err) {
    console.error(`✗ Failed to send email to ${to}:`, err.message || err);
    throw err;
  }
}

// ── Convenience wrappers ─────────────────────────────────────────────────────

/**
 * Send verification email to a new user.
 */
async function sendVerificationEmail(email, token, opts = {}) {
  const verifyUrl = `${APP_URL()}/api/auth/verify-email?token=${token}`;
  const html = templates.directorWelcome.verificationOnly({ verifyUrl });
  return sendEmail(email, 'Verify your Taikai account', html);
}

/**
 * Send password reset email.
 */
async function sendPasswordResetEmail(email, token) {
  const resetUrl = `${APP_URL()}/reset-password.html?token=${token}`;
  const html = templates.passwordReset({ resetUrl });
  return sendEmail(email, 'Reset Your Taikai Password', html);
}

/**
 * Send registration confirmation after payment.
 */
async function sendRegistrationConfirmationEmail(email, tournament, competitors, totalPaid, discountAmount, transactionId) {
  const html = templates.registrationConfirmation({
    tournament,
    competitors,
    totalPaid,
    discountAmount,
    transactionId,
    appUrl: APP_URL(),
  });
  return sendEmail(email, `Registration Confirmed — ${tournament.name}`, html);
}

/**
 * Send email to the director when their tournament goes live.
 */
async function sendTournamentPublishedEmail(email, tournament) {
  const publicUrl = `${APP_URL()}/tournaments/${tournament.slug}`;
  const html = templates.tournamentPublished({ tournament, publicUrl });
  return sendEmail(email, `Your Tournament Is Live — ${tournament.name}`, html);
}

/**
 * Send email to director when someone applies for a role.
 */
async function sendRoleRequestEmail(directorEmail, opts) {
  const html = templates.roleRequest({ ...opts, appUrl: APP_URL() });
  return sendEmail(directorEmail, `New ${opts.role} Application — ${opts.tournamentName}`, html);
}

/**
 * Send email to applicant when their role is approved.
 */
async function sendRoleApprovedEmail(applicantEmail, opts) {
  const html = templates.roleApproved({ ...opts, appUrl: APP_URL() });
  return sendEmail(applicantEmail, `You're Approved — ${opts.tournamentName}`, html);
}

/**
 * Send email to applicant when their role is declined.
 */
async function sendRoleDeclinedEmail(applicantEmail, opts) {
  const html = templates.roleDeclined({ ...opts, appUrl: APP_URL() });
  return sendEmail(applicantEmail, `Application Update — ${opts.tournamentName}`, html);
}

/**
 * Send waiver request email to a parent/guardian.
 */
async function sendWaiverRequestEmail(parentEmail, opts) {
  const waiverUrl = `${APP_URL()}/waiver.html?token=${opts.token}`;
  const html = templates.waiverRequest({ ...opts, waiverUrl });
  return sendEmail(parentEmail, `Waiver Required — ${opts.tournamentName}`, html);
}

/**
 * Send waiver signed notification email to the coach.
 */
async function sendWaiverSignedEmail(coachEmail, opts) {
  const html = templates.waiverSigned(opts);
  return sendEmail(coachEmail, `Waiver Signed — ${opts.competitorName}`, html);
}

/**
 * Send tournament invitation email.
 */
async function sendTournamentInviteEmail(email, { tournamentName, role, inviterName, hasAccount, token }) {
  const signupUrl = hasAccount
    ? `${APP_URL()}/account.html#events`
    : `${APP_URL()}/register.html?invite=${token}`;
  const html = templates.tournamentInvite({ tournamentName, role, inviterName, signupUrl, hasAccount });
  return sendEmail(email, `You're Invited — ${tournamentName}`, html);
}

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendRegistrationConfirmationEmail,
  sendTournamentPublishedEmail,
  sendRoleRequestEmail,
  sendRoleApprovedEmail,
  sendRoleDeclinedEmail,
  sendWaiverRequestEmail,
  sendWaiverSignedEmail,
  sendTournamentInviteEmail,
  APP_URL,
  EMAIL_FROM,
  templates,
};
