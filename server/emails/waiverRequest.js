/**
 * Waiver Request Email Template
 * Sent to the parent/guardian when a coach registers their child.
 *
 * @param {Object} opts
 * @param {string} opts.competitorName
 * @param {string} opts.tournamentName
 * @param {string} opts.tournamentDate
 * @param {string} opts.coachName
 * @param {string} opts.waiverUrl
 * @returns {string} HTML
 */
module.exports = function waiverRequest({ competitorName, tournamentName, tournamentDate, coachName, waiverUrl }) {
  const dateStr = tournamentDate
    ? new Date(typeof tournamentDate === 'string' && tournamentDate.length === 10 ? tournamentDate + 'T12:00:00' : tournamentDate)
        .toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0f12;">
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:40px 20px;">

    <!-- Logo -->
    <div style="text-align:center;margin-bottom:32px;">
      <span style="font-size:28px;font-weight:800;color:#7c3aed;letter-spacing:-0.5px;">Taikai</span>
    </div>

    <!-- Header -->
    <div style="background:#1a1a24;border:1px solid rgba(124,58,237,0.25);border-radius:16px;padding:32px;margin-bottom:24px;">
      <div style="text-align:center;margin-bottom:20px;">
        <div style="display:inline-block;width:52px;height:52px;line-height:52px;border-radius:50%;background:rgba(124,58,237,0.15);font-size:26px;text-align:center;">📋</div>
      </div>
      <h1 style="color:#f9fafb;font-size:22px;margin:0 0 12px;text-align:center;">Waiver Required</h1>
      <p style="color:#9ca3af;font-size:15px;line-height:1.6;margin:0;text-align:center;">
        Your child <strong style="color:#e5e7eb;">${competitorName}</strong> has been registered for
        <strong style="color:#e5e7eb;">${tournamentName}</strong>${dateStr ? ` on <strong style="color:#e5e7eb;">${dateStr}</strong>` : ''}
        by coach <strong style="color:#e5e7eb;">${coachName}</strong>.
      </p>
      <p style="color:#9ca3af;font-size:15px;line-height:1.6;margin:16px 0 0;text-align:center;">
        Please review and sign the participation waiver to complete the registration.
      </p>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${waiverUrl}"
         style="display:inline-block;padding:14px 36px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;">
        Sign Waiver
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:16px 0;">
      <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:0;">
        If you did not expect this email, please disregard it.
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
