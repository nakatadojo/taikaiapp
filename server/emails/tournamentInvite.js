/**
 * Tournament Invite Email Template
 * Sent when a tournament owner invites someone by email to serve as coach/judge/staff.
 *
 * @param {Object} opts
 * @param {string} opts.tournamentName
 * @param {string} opts.role
 * @param {string} opts.inviterName
 * @param {string} opts.signupUrl   - URL to register/login (includes invite token)
 * @param {boolean} opts.hasAccount - Whether the invitee already has an account
 * @returns {string} HTML
 */
module.exports = function tournamentInvite({ tournamentName, role, inviterName, signupUrl, hasAccount }) {
  const roleLabels = { coach: 'Coach', judge: 'Judge', staff: 'Staff' };
  const roleLabel = roleLabels[role] || role;

  const actionText = hasAccount
    ? 'You\'ve been added automatically. View your events below.'
    : 'Create your free account to accept this invitation.';

  const btnText = hasAccount ? 'View My Events' : 'Accept Invitation';

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0f12;">
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:40px 20px;">

    <!-- Logo -->
    <div style="text-align:center;margin-bottom:32px;">
      <span style="font-size:28px;font-weight:800;color:#dc2626;letter-spacing:-0.5px;">Taikai</span>
    </div>

    <!-- Header -->
    <div style="background:#1a1a24;border:1px solid rgba(220,38,38,0.25);border-radius:16px;padding:32px;margin-bottom:24px;">
      <div style="text-align:center;margin-bottom:20px;">
        <div style="display:inline-block;width:52px;height:52px;line-height:52px;border-radius:50%;background:rgba(59,130,246,0.15);font-size:26px;text-align:center;">&#9993;</div>
      </div>
      <h1 style="color:#f9fafb;font-size:22px;margin:0 0 12px;text-align:center;">You're Invited!</h1>
      <p style="color:#9ca3af;font-size:15px;line-height:1.6;margin:0;text-align:center;">
        <strong style="color:#e5e7eb;">${inviterName}</strong> has invited you to join
        <strong style="color:#e5e7eb;">${tournamentName}</strong> as a
        <strong style="color:#60a5fa;">${roleLabel}</strong>.
      </p>
      <p style="color:#6b7280;font-size:14px;line-height:1.5;margin:16px 0 0;text-align:center;">
        ${actionText}
      </p>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${signupUrl}"
         style="display:inline-block;padding:14px 36px;background:#dc2626;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;">
        ${btnText}
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:16px 0;">
      <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:0;">
        If you didn't expect this invitation, you can safely ignore this email.
      </p>
      <p style="color:#4b5563;font-size:12px;margin:16px 0 0;">
        Taikai by Kimesoft &mdash; Tournament Management
      </p>
    </div>

  </div>
</body>
</html>
  `.trim();
};
