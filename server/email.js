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
  bracketPublished:         require('./emails/bracketPublished'),
  schedulePosted:           require('./emails/schedulePosted'),
  divisionReady:            require('./emails/divisionReady'),
  registrationClosing:      require('./emails/registrationClosing'),
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

/**
 * Send dojo invite email to a new passwordless user created via CSV import.
 * Uses dark tournament-branded theme.
 */
async function sendDojoInviteEmail({ toEmail, toName, dojoName, invitedByName, claimUrl }) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;background:#0d0d0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
      <div style="max-width:520px;margin:40px auto;padding:32px 28px;background:#1a1a1e;border-radius:16px;border:1px solid rgba(255,255,255,0.08);">
        <div style="margin-bottom:24px;">
          <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Taikai</span>
          <span style="font-size:12px;color:#888;margin-left:8px;">by Kimesoft</span>
        </div>
        <h2 style="color:#ffffff;font-size:20px;font-weight:600;margin:0 0 12px;">You've been added to ${escHtml(dojoName)}</h2>
        <p style="color:#aaa;font-size:15px;line-height:1.6;margin:0 0 24px;">
          Hi ${escHtml(toName)},<br><br>
          <strong style="color:#ddd;">${escHtml(invitedByName)}</strong> has added you to the
          <strong style="color:#ddd;">${escHtml(dojoName)}</strong> dojo on Taikai.
          Set up your account to view your profile, track your belt rank, and register for tournaments.
        </p>
        <a href="${claimUrl}" style="display:inline-block;padding:14px 28px;background:#e67e22;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;">
          Set up your account
        </a>
        <p style="color:#555;font-size:12px;margin-top:32px;line-height:1.5;">
          If you weren't expecting this, you can ignore this email. This link expires in 7 days.
        </p>
      </div>
    </body>
    </html>
  `;
  return sendEmail(toEmail, `You've been added to ${dojoName} on Taikai`, html);
}

/**
 * Send notification email to dojo head coach when a competitor auto-links via public registration.
 */
async function sendDojoMemberNotification({ toEmail, toName, dojoName, competitorName, tournamentName }) {
  const rosterUrl = `${APP_URL()}/account#dojo`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;background:#0d0d0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
      <div style="max-width:520px;margin:40px auto;padding:32px 28px;background:#1a1a1e;border-radius:16px;border:1px solid rgba(255,255,255,0.08);">
        <div style="margin-bottom:24px;">
          <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Taikai</span>
          <span style="font-size:12px;color:#888;margin-left:8px;">by Kimesoft</span>
        </div>
        <h2 style="color:#ffffff;font-size:20px;font-weight:600;margin:0 0 12px;">New member added to your dojo</h2>
        <p style="color:#aaa;font-size:15px;line-height:1.6;margin:0 0 24px;">
          Hi ${escHtml(toName || 'Coach')},<br><br>
          <strong style="color:#ddd;">${escHtml(competitorName)}</strong> registered for
          <strong style="color:#ddd;">${escHtml(tournamentName || 'a tournament')}</strong> and listed
          <strong style="color:#ddd;">${escHtml(dojoName)}</strong> as their dojo.
          They have been automatically added to your roster.
          You can remove them from your dojo dashboard if they don't belong.
        </p>
        <a href="${rosterUrl}" style="display:inline-block;padding:14px 28px;background:#e67e22;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;">
          View roster
        </a>
        <p style="color:#555;font-size:12px;margin-top:32px;line-height:1.5;">
          You received this because you are the head coach of ${escHtml(dojoName)} on Taikai.
        </p>
      </div>
    </body>
    </html>
  `;
  return sendEmail(toEmail, `New member added to your dojo: ${competitorName}`, html);
}

/**
 * Send team invite email to a competitor added to a team.
 * For members who don't have an account yet, includes a claim/setup link.
 */
async function sendCompetitorInviteEmail({ toEmail, toName, tournamentName, addedByName, claimUrl }) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;background:#0d0d0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
      <div style="max-width:520px;margin:40px auto;padding:32px 28px;background:#1a1a1e;border-radius:16px;border:1px solid rgba(255,255,255,0.08);">
        <div style="margin-bottom:24px;">
          <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Taikai</span>
          <span style="font-size:12px;color:#888;margin-left:8px;">by Kimesoft</span>
        </div>
        <h2 style="color:#ffffff;font-size:20px;font-weight:600;margin:0 0 12px;">You've been registered for ${escHtml(tournamentName)}</h2>
        <p style="color:#aaa;font-size:15px;line-height:1.6;margin:0 0 24px;">
          Hi ${escHtml(toName)},<br><br>
          <strong style="color:#ddd;">${escHtml(addedByName)}</strong> has pre-registered you for
          <strong style="color:#ddd;">${escHtml(tournamentName)}</strong>.
          Claim your account to view your registration, complete your profile, and stay up to date.
        </p>
        <a href="${claimUrl}" style="display:inline-block;padding:14px 28px;background:#dc2626;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;">
          Claim your account
        </a>
        <p style="color:#555;font-size:12px;margin-top:32px;line-height:1.5;">
          If you weren't expecting this, you can ignore this email. This link expires in 7 days.
        </p>
      </div>
    </body>
    </html>
  `;
  return sendEmail(toEmail, `You've been registered for ${tournamentName}`, html);
}

async function sendTeamInviteEmail({ toEmail, toName, teamName, tournamentName, addedByName, claimUrl }) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;background:#0d0d0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
      <div style="max-width:520px;margin:40px auto;padding:32px 28px;background:#1a1a1e;border-radius:16px;border:1px solid rgba(255,255,255,0.08);">
        <div style="margin-bottom:24px;">
          <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Taikai</span>
          <span style="font-size:12px;color:#888;margin-left:8px;">by Kimesoft</span>
        </div>
        <h2 style="color:#ffffff;font-size:20px;font-weight:600;margin:0 0 12px;">You've been added to team <span style="color:#e67e22;">${escHtml(teamName)}</span></h2>
        <p style="color:#aaa;font-size:15px;line-height:1.6;margin:0 0 24px;">
          Hi ${escHtml(toName)},<br><br>
          <strong style="color:#ddd;">${escHtml(addedByName)}</strong> has added you to team
          <strong style="color:#ddd;">${escHtml(teamName)}</strong> for
          <strong style="color:#ddd;">${escHtml(tournamentName)}</strong>.
          Set up your account to view your team details and registration status.
        </p>
        <a href="${claimUrl}" style="display:inline-block;padding:14px 28px;background:#e67e22;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;">
          View your team &amp; set up account
        </a>
        <p style="color:#555;font-size:12px;margin-top:32px;line-height:1.5;">
          If you weren't expecting this, you can ignore this email. This link expires in 7 days.
        </p>
      </div>
    </body>
    </html>
  `;
  return sendEmail(toEmail, `You've been added to team ${teamName} at ${tournamentName}`, html);
}

/** Minimal HTML entity escaper for inline email templates. */
function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Tournament notification dedup log ────────────────────────────────────────
// Prevent the same notification type from being sent twice for the same entity.
// Stored in the DB in the email_notification_log table (migration 057).
// Falls back to fire-and-forget if the table doesn't exist yet.

const pool_email = require('./db/pool');

// ── Push notification integration ────────────────────────────────────────────
// Lazy-require to avoid circular deps and allow server to start without VAPID keys.
let _pushService = null;
function _push() {
  if (!_pushService) {
    try { _pushService = require('./services/pushService'); } catch (_) {}
  }
  return _pushService;
}

async function _checkNotificationSent(tournamentId, eventType, entityId) {
  try {
    const { rows } = await pool_email.query(
      `SELECT id FROM email_notification_log
       WHERE tournament_id = $1 AND event_type = $2 AND COALESCE(entity_id,'') = COALESCE($3,'')
       LIMIT 1`,
      [tournamentId, eventType, entityId || null]
    );
    return rows.length > 0;
  } catch { return false; }
}

async function _markNotificationSent(tournamentId, eventType, entityId, recipientCount) {
  try {
    await pool_email.query(
      `INSERT INTO email_notification_log (tournament_id, event_type, entity_id, recipient_count)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tournament_id, event_type, COALESCE(entity_id,'')) DO NOTHING`,
      [tournamentId, eventType, entityId || null, recipientCount || 0]
    );
  } catch (e) { console.warn('[email] dedup log failed:', e.message); }
}

/**
 * Send bracket-published notification to all competitors in a division.
 * Fire-and-forget — never blocks the caller.
 */
async function sendBracketPublishedEmails(tournamentId, bracketId, divisionName) {
  try {
    const alreadySent = await _checkNotificationSent(tournamentId, 'bracket_published', bracketId);
    if (alreadySent) return;

    // Get tournament info and all competitor emails for this division
    const { rows: tRows } = await pool_email.query(
      `SELECT t.name, t.slug FROM tournaments t WHERE t.id = $1`,
      [tournamentId]
    );
    if (!tRows[0]) return;
    const tournament = tRows[0];
    const bracketsUrl = `${APP_URL()}/tournaments/${tournament.slug}#results`;

    // Get emails of registered competitors in this division
    const { rows: compRows } = await pool_email.query(
      `SELECT DISTINCT COALESCE(u.email, cp.guardian_email) AS email,
              cp.first_name AS first_name
       FROM registrations r
       LEFT JOIN competitor_profiles cp ON cp.id = r.profile_id
       LEFT JOIN users u ON u.id = r.user_id
       LEFT JOIN registration_events re ON re.registration_id = r.id
       WHERE r.tournament_id = $1
         AND r.status != 'cancelled'
         AND r.payment_status IN ('paid', 'waived')
         AND (re.assigned_division = $2 OR $2 IS NULL)
         AND COALESCE(u.email, cp.guardian_email) IS NOT NULL`,
      [tournamentId, divisionName || null]
    );

    let sent = 0;
    for (const c of compRows) {
      if (!c.email) continue;
      const html = templates.bracketPublished({
        tournament: { name: tournament.name },
        divisionName: divisionName || 'your division',
        bracketsUrl,
        competitorName: c.first_name,
      });
      sendEmail(c.email, `Bracket posted — ${divisionName || tournament.name}`, html)
        .catch(e => console.warn('[email] bracketPublished send failed:', e.message));
      sent++;
    }
    if (sent > 0) await _markNotificationSent(tournamentId, 'bracket_published', bracketId, sent);

    // Push notification: "Your bracket is ready"
    try {
      const ps = _push();
      if (ps && ps.pushEnabled) {
        await ps.sendToAll(tournamentId, {
          title: tournament.name,
          body: `Your bracket is ready — ${divisionName || 'check the app'}`,
          url: bracketsUrl,
          icon: '/icons/icon-192.png',
        });
      }
    } catch (pushErr) {
      console.warn('[push] bracketPublished notification failed:', pushErr.message);
    }
  } catch (err) {
    console.warn('[email] sendBracketPublishedEmails failed:', err.message);
  }
}

/**
 * Send schedule-posted notification to all registered competitors.
 * Fire-and-forget.
 */
async function sendSchedulePostedEmails(tournamentId) {
  try {
    const alreadySent = await _checkNotificationSent(tournamentId, 'schedule_posted', null);
    if (alreadySent) return;

    const { rows: tRows } = await pool_email.query(
      `SELECT name, slug FROM tournaments WHERE id = $1`, [tournamentId]
    );
    if (!tRows[0]) return;
    const tournament = tRows[0];
    const scheduleUrl = `${APP_URL()}/tournaments/${tournament.slug}#schedule`;

    const { rows: compRows } = await pool_email.query(
      `SELECT DISTINCT COALESCE(u.email, cp.guardian_email) AS email, cp.first_name
       FROM registrations r
       LEFT JOIN competitor_profiles cp ON cp.id = r.profile_id
       LEFT JOIN users u ON u.id = r.user_id
       WHERE r.tournament_id = $1
         AND r.status != 'cancelled'
         AND r.payment_status IN ('paid','waived')
         AND COALESCE(u.email, cp.guardian_email) IS NOT NULL`,
      [tournamentId]
    );

    let sent = 0;
    for (const c of compRows) {
      if (!c.email) continue;
      const html = templates.schedulePosted({
        tournament: { name: tournament.name },
        scheduleUrl,
        competitorName: c.first_name,
      });
      sendEmail(c.email, `Schedule posted — ${tournament.name}`, html)
        .catch(e => console.warn('[email] schedulePosted send failed:', e.message));
      sent++;
    }
    if (sent > 0) await _markNotificationSent(tournamentId, 'schedule_posted', null, sent);
  } catch (err) {
    console.warn('[email] sendSchedulePostedEmails failed:', err.message);
  }
}

/**
 * Send division-ready (mat-call) email to a single competitor.
 * Called from the check-in mat-call endpoint.
 */
async function sendDivisionReadyEmail({ competitorEmail, competitorName, tournament, divisionName, matName, userId }) {
  if (!competitorEmail) return;
  try {
    const html = templates.divisionReady({
      tournament,
      divisionName,
      matName,
      competitorName,
    });
    await sendEmail(competitorEmail, `Report to the mat — ${divisionName}`, html);

    // Push notification: "Report to mat now"
    if (userId) {
      try {
        const ps = _push();
        if (ps && ps.pushEnabled) {
          await ps.sendToUser(userId, {
            title: 'Report to the mat now!',
            body: `${divisionName}${matName ? ` — ${matName}` : ''}`,
            icon: '/icons/icon-192.png',
          });
        }
      } catch (pushErr) {
        console.warn('[push] divisionReady notification failed:', pushErr.message);
      }
    }
  } catch (err) {
    console.warn('[email] sendDivisionReadyEmail failed:', err.message);
  }
}

/**
 * Send registration-closing warning emails to all users who have an account
 * but haven't registered yet for a tournament closing within 24h.
 * Intended to be called from a periodic check (e.g. hourly interval).
 */
async function sendRegistrationClosingEmails(tournamentId) {
  try {
    const alreadySent = await _checkNotificationSent(tournamentId, 'registration_closing', null);
    if (alreadySent) return;

    const { rows: tRows } = await pool_email.query(
      `SELECT name, slug, registration_deadline FROM tournaments
       WHERE id = $1 AND published = true AND registration_deadline IS NOT NULL`,
      [tournamentId]
    );
    if (!tRows[0]) return;
    const tournament = tRows[0];
    const deadline = new Date(tournament.registration_deadline);
    const hoursLeft = Math.ceil((deadline - Date.now()) / 3600000);
    if (hoursLeft < 0 || hoursLeft > 26) return; // only within 26h window

    const registerUrl = `${APP_URL()}/tournaments/${tournament.slug}#register`;

    // Target: users who have an account but are not yet registered
    const { rows: userRows } = await pool_email.query(
      `SELECT u.email FROM users u
       WHERE u.email IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM registrations r
           WHERE r.tournament_id = $1
             AND r.user_id = u.id
             AND r.status != 'cancelled'
         )
       LIMIT 500`,
      [tournamentId]
    );

    let sent = 0;
    for (const u of userRows) {
      if (!u.email) continue;
      const html = templates.registrationClosing({
        tournament: { name: tournament.name },
        registerUrl,
        hoursLeft,
        deadline,
      });
      sendEmail(u.email, `Registration closing in ${hoursLeft}h — ${tournament.name}`, html)
        .catch(e => console.warn('[email] registrationClosing send failed:', e.message));
      sent++;
    }
    if (sent > 0) await _markNotificationSent(tournamentId, 'registration_closing', null, sent);
  } catch (err) {
    console.warn('[email] sendRegistrationClosingEmails failed:', err.message);
  }
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
  sendDojoInviteEmail,
  sendDojoMemberNotification,
  sendTeamInviteEmail,
  sendCompetitorInviteEmail,
  // Tournament-day notification triggers
  sendBracketPublishedEmails,
  sendSchedulePostedEmails,
  sendDivisionReadyEmail,
  sendRegistrationClosingEmails,
  APP_URL,
  EMAIL_FROM,
  templates,
};
