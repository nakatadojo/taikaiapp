/**
 * Password Reset Email Template
 *
 * @param {Object} opts
 * @param {string} opts.resetUrl
 * @returns {string} HTML
 */
module.exports = function passwordReset({ resetUrl }) {
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

    <!-- Card -->
    <div style="background:#1a1a24;border:1px solid rgba(124,58,237,0.25);border-radius:16px;padding:32px;margin-bottom:24px;">
      <div style="text-align:center;margin-bottom:20px;">
        <div style="display:inline-block;width:52px;height:52px;line-height:52px;border-radius:50%;background:rgba(124,58,237,0.15);font-size:26px;text-align:center;">&#128274;</div>
      </div>
      <h1 style="color:#f9fafb;font-size:22px;margin:0 0 12px;text-align:center;">Reset Your Password</h1>
      <p style="color:#9ca3af;font-size:15px;line-height:1.6;margin:0;text-align:center;">
        We received a request to reset the password for your Taikai account. Click the button below to choose a new password.
      </p>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${resetUrl}" style="display:inline-block;padding:14px 40px;background:#7c3aed;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;">Reset Password</a>
    </div>

    <!-- Security note -->
    <div style="background:#1a1a24;border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:20px 24px;margin-bottom:24px;">
      <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:0;">
        <strong style="color:#e5e7eb;">Didn't request this?</strong><br>
        If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:16px 0;">
      <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:0;">
        This link expires in 1 hour for security purposes.
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
