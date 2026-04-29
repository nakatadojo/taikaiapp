/**
 * Role Request Email Template
 * Sent to the tournament director when someone applies for a role.
 *
 * @param {Object} opts
 * @param {string} opts.applicantName
 * @param {string} opts.role
 * @param {string} opts.staffRole     – optional sub-role for staff
 * @param {string} opts.tournamentName
 * @param {string} opts.tournamentId
 * @param {string} opts.appUrl
 * @returns {string} HTML
 */
module.exports = function roleRequest({ applicantName, role, staffRole, tournamentName, tournamentId, appUrl }) {
  const roleLabels = { coach: 'Coach', judge: 'Judge', staff: 'Staff', parent: 'Parent / Guardian' };
  const roleLabel = roleLabels[role] || role;
  const staffDetail = staffRole ? ` (${staffRole})` : '';

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
      <h1 style="color:#111111;font-size:22px;margin:0 0 12px;text-align:center;">New Role Application</h1>
      <p style="color:#555555;font-size:15px;line-height:1.6;margin:0;text-align:center;">
        <strong style="color:#111111;">${applicantName}</strong> has applied to serve as
        <strong style="color:#dc2626;">${roleLabel}${staffDetail}</strong>
        for <strong style="color:#111111;">${tournamentName}</strong>.
      </p>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${appUrl}/director.html#approvals?tournamentId=${tournamentId}"
         style="display:inline-block;padding:14px 36px;background:#cc0000;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;">
        Review Application
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:16px 0;">
      <p style="color:#888888;font-size:13px;line-height:1.6;margin:0;">
        You can approve or decline this application from your director dashboard.
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
