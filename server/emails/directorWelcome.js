/**
 * Director Welcome / Email Verification Template
 *
 * Sent when a new Event Director signs up.
 * Also provides a simpler `verificationOnly()` variant for
 * non-director users (competitors, guardians, coaches).
 *
 * @param {Object} opts
 * @param {string} opts.verifyUrl
 * @param {string} [opts.organizationName]
 * @returns {string} HTML
 */

function directorWelcome({ verifyUrl, organizationName }) {
  const orgLine = organizationName
    ? `<p style="color:#9ca3af;font-size:15px;line-height:1.6;margin:0 0 4px;">Organization: <strong style="color:#e5e7eb;">${organizationName}</strong></p>`
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

    <!-- Welcome Card -->
    <div style="background:#1a1a24;border:1px solid rgba(124,58,237,0.25);border-radius:16px;padding:32px;margin-bottom:24px;">
      <h1 style="color:#f9fafb;font-size:22px;margin:0 0 12px;text-align:center;">Welcome to Taikai!</h1>
      <p style="color:#9ca3af;font-size:15px;line-height:1.6;margin:0 0 8px;text-align:center;">
        Your Event Director account has been created. Verify your email to get started.
      </p>
      ${orgLine ? `<div style="text-align:center;margin-top:8px;">${orgLine}</div>` : ''}
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${verifyUrl}" style="display:inline-block;padding:14px 40px;background:#7c3aed;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;">Verify Email Address</a>
    </div>

    <!-- What's Next -->
    <div style="background:#1a1a24;border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:24px;margin-bottom:24px;">
      <h2 style="color:#f3f4f6;font-size:16px;margin:0 0 16px;font-weight:600;">What you can do</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 12px 8px 0;vertical-align:top;color:#7c3aed;font-size:18px;">&#9733;</td>
          <td style="padding:8px 0;">
            <strong style="color:#e5e7eb;font-size:14px;">Create Tournaments</strong>
            <p style="color:#9ca3af;font-size:13px;margin:2px 0 0;">Use the wizard to build tournaments with divisions, pricing, and more.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 12px 8px 0;vertical-align:top;color:#7c3aed;font-size:18px;">&#128176;</td>
          <td style="padding:8px 0;">
            <strong style="color:#e5e7eb;font-size:14px;">Manage Credits</strong>
            <p style="color:#9ca3af;font-size:13px;margin:2px 0 0;">Purchase credits to enable online registration for your events.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 12px 8px 0;vertical-align:top;color:#7c3aed;font-size:18px;">&#128640;</td>
          <td style="padding:8px 0;">
            <strong style="color:#e5e7eb;font-size:14px;">Publish &amp; Share</strong>
            <p style="color:#9ca3af;font-size:13px;margin:2px 0 0;">Publish your tournament and share the public page with competitors.</p>
          </td>
        </tr>
      </table>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:16px 0;">
      <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:0;">
        This link expires in 24 hours. If you didn't create this account, ignore this email.
      </p>
      <p style="color:#4b5563;font-size:12px;margin:16px 0 0;">
        Taikai by Kimesoft &mdash; Tournament Management
      </p>
    </div>

  </div>
</body>
</html>
  `.trim();
}

/**
 * Simple verification-only variant for non-director users.
 */
directorWelcome.verificationOnly = function ({ verifyUrl }) {
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
      <h1 style="color:#f9fafb;font-size:22px;margin:0 0 12px;text-align:center;">Verify Your Email</h1>
      <p style="color:#9ca3af;font-size:15px;line-height:1.6;margin:0;text-align:center;">
        Click the button below to verify your email and activate your Taikai account.
      </p>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${verifyUrl}" style="display:inline-block;padding:14px 40px;background:#7c3aed;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;">Verify Email Address</a>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:16px 0;">
      <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:0;">
        This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
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

module.exports = directorWelcome;
