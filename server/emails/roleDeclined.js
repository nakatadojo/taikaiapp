/**
 * Role Declined Email Template
 * Sent to an applicant when their role application is declined.
 *
 * @param {Object} opts
 * @param {string} opts.applicantName
 * @param {string} opts.role
 * @param {string} opts.tournamentName
 * @param {string} opts.appUrl
 * @returns {string} HTML
 */
module.exports = function roleDeclined({ applicantName, role, tournamentName, appUrl }) {
  const roleLabels = { coach: 'Coach', judge: 'Judge', staff: 'Staff', parent: 'Parent / Guardian' };
  const roleLabel = roleLabels[role] || role;

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
      <h1 style="color:#111111;font-size:22px;margin:0 0 12px;text-align:center;">Application Update</h1>
      <p style="color:#555555;font-size:15px;line-height:1.6;margin:0;text-align:center;">
        Hi <strong style="color:#111111;">${applicantName}</strong>, unfortunately your application as
        <strong style="color:#111111;">${roleLabel}</strong>
        for <strong style="color:#111111;">${tournamentName}</strong> was not approved at this time.
      </p>
      <p style="color:#555555;font-size:14px;line-height:1.6;margin:16px 0 0;text-align:center;">
        If you have questions, please reach out to the tournament organizer directly.
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:16px 0;">
      <p style="color:#aaaaaa;font-size:12px;margin:0;">
        Taikai by Kimesoft &mdash; Tournament Management
      </p>
    </div>

  </div>
</body>
</html>
  `.trim();
};
