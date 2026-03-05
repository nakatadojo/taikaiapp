/**
 * Tournament Published Email Template
 * Sent to the Event Director when they publish a tournament.
 *
 * @param {Object} opts
 * @param {Object} opts.tournament – { name, date, location, slug }
 * @param {string} opts.publicUrl  – full URL to the public tournament page
 * @returns {string} HTML
 */
module.exports = function tournamentPublished({ tournament, publicUrl }) {
  const tournamentDate = tournament.date
    ? new Date(typeof tournament.date === 'string' && tournament.date.length === 10 ? tournament.date + 'T12:00:00' : tournament.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : 'TBD';

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

    <!-- Header Card -->
    <div style="background:#1a1a24;border:1px solid rgba(124,58,237,0.25);border-radius:16px;padding:32px;margin-bottom:24px;">
      <div style="text-align:center;margin-bottom:20px;">
        <div style="display:inline-block;width:52px;height:52px;line-height:52px;border-radius:50%;background:rgba(124,58,237,0.15);font-size:26px;text-align:center;">&#128640;</div>
      </div>
      <h1 style="color:#f9fafb;font-size:22px;margin:0 0 8px;text-align:center;">Your Tournament Is Live!</h1>
      <p style="color:#9ca3af;font-size:15px;line-height:1.6;margin:0;text-align:center;">
        <strong style="color:#e5e7eb;">${tournament.name}</strong> is now published and accepting registrations.
      </p>
    </div>

    <!-- Tournament Details -->
    <div style="background:#1a1a24;border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:20px 24px;margin-bottom:24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="color:#9ca3af;font-size:13px;padding:6px 0;">Tournament</td>
          <td style="color:#e5e7eb;font-size:14px;text-align:right;padding:6px 0;font-weight:600;">${tournament.name}</td>
        </tr>
        <tr>
          <td style="color:#9ca3af;font-size:13px;padding:6px 0;">Date</td>
          <td style="color:#e5e7eb;font-size:14px;text-align:right;padding:6px 0;">${tournamentDate}</td>
        </tr>
        <tr>
          <td style="color:#9ca3af;font-size:13px;padding:6px 0;">Location</td>
          <td style="color:#e5e7eb;font-size:14px;text-align:right;padding:6px 0;">${tournament.location || 'TBD'}</td>
        </tr>
      </table>
    </div>

    <!-- CTA: View Public Page -->
    <div style="text-align:center;margin-bottom:16px;">
      <a href="${publicUrl}" style="display:inline-block;padding:14px 40px;background:#7c3aed;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;">View Public Page</a>
    </div>

    <!-- Share prompt -->
    <div style="background:#1a1a24;border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:20px 24px;margin-bottom:24px;">
      <h2 style="color:#f3f4f6;font-size:15px;margin:0 0 8px;font-weight:600;">Share your tournament</h2>
      <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:0 0 12px;">
        Copy the link below and share it with coaches, academies, and competitors:
      </p>
      <div style="background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.2);border-radius:8px;padding:10px 14px;">
        <code style="color:#a78bfa;font-size:13px;word-break:break-all;">${publicUrl}</code>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:16px 0;">
      <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:0;">
        You can unpublish your tournament at any time from your director dashboard.
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
