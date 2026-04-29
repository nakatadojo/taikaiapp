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
<body style="margin:0;padding:0;background:#f4f4f5;">
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:40px 20px;">

    <!-- Logo -->
    <div style="text-align:center;margin-bottom:28px;">
      <span style="font-size:30px;font-weight:900;color:#111111;letter-spacing:-1px;">TAI<span style="color:#cc0000;">KAI</span></span>
    </div>

    <!-- Card -->
    <div style="background:#ffffff;border-radius:16px;padding:36px 32px;margin-bottom:20px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
      <div style="text-align:center;margin-bottom:20px;">
        <div style="display:inline-block;width:56px;height:56px;line-height:56px;border-radius:50%;background:#fff0f0;font-size:28px;text-align:center;">&#128274;</div>
      </div>
      <h1 style="color:#111111;font-size:22px;font-weight:700;margin:0 0 12px;text-align:center;">Reset Your Password</h1>
      <p style="color:#555555;font-size:15px;line-height:1.6;margin:0;text-align:center;">
        We received a request to reset the password for your Taikai account. Click the button below to choose a new password.
      </p>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:20px;">
      <a href="${resetUrl}" style="display:inline-block;padding:15px 44px;background:#cc0000;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;letter-spacing:0.3px;">Reset Password</a>
    </div>

    <!-- Security note -->
    <div style="background:#ffffff;border-radius:12px;padding:20px 24px;margin-bottom:24px;box-shadow:0 1px 6px rgba(0,0,0,0.06);">
      <p style="color:#555555;font-size:13px;line-height:1.6;margin:0;">
        <strong style="color:#111111;">Didn't request this?</strong><br>
        If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:8px 0;">
      <p style="color:#888888;font-size:13px;line-height:1.6;margin:0;">
        This link expires in 1 hour for security purposes.
      </p>
      <p style="color:#aaaaaa;font-size:12px;margin:12px 0 0;">
        Taikai by Kimesoft &mdash; Tournament Management
      </p>
    </div>

  </div>
</body>
</html>
  `.trim();
};
