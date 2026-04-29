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
<body style="margin:0;padding:0;background:#f4f4f5;">
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:40px 20px;">

    <!-- Logo -->
    <div style="text-align:center;margin-bottom:32px;">
      <span style="font-size:30px;font-weight:900;color:#111111;letter-spacing:-1px;">TAI<span style="color:#cc0000;">KAI</span></span>
    </div>

    <!-- Header -->
    <div style="background:#ffffff;border-radius:16px;border-radius:16px;padding:32px;margin-bottom:24px;">
      <div style="text-align:center;margin-bottom:20px;">
        <div style="display:inline-block;width:52px;height:52px;line-height:52px;border-radius:50%;background:#fff0f0;font-size:26px;text-align:center;">📋</div>
      </div>
      <h1 style="color:#111111;font-size:22px;margin:0 0 12px;text-align:center;">Waiver Required</h1>
      <p style="color:#555555;font-size:15px;line-height:1.6;margin:0;text-align:center;">
        Your child <strong style="color:#111111;">${competitorName}</strong> has been registered for
        <strong style="color:#111111;">${tournamentName}</strong>${dateStr ? ` on <strong style="color:#111111;">${dateStr}</strong>` : ''}
        by coach <strong style="color:#111111;">${coachName}</strong>.
      </p>
      <p style="color:#555555;font-size:15px;line-height:1.6;margin:16px 0 0;text-align:center;">
        Please review and sign the participation waiver to complete the registration.
      </p>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${waiverUrl}"
         style="display:inline-block;padding:14px 36px;background:#cc0000;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;">
        Sign Waiver
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:16px 0;">
      <p style="color:#888888;font-size:13px;line-height:1.6;margin:0;">
        If you did not expect this email, please disregard it.
      </p>
      <p style="color:#aaaaaa;font-size:12px;margin:16px 0 0;">
        Taikai by Kimesoft &mdash; Tournament Management
      </p>
    </div>

  </div>
</body>
</html>
  `.trim();
};
