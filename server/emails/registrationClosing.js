/**
 * Registration Closing Warning Email Template
 * Sent 24 hours before registration deadline.
 */
module.exports = function registrationClosing({ tournament, registerUrl, hoursLeft, deadline }) {
  const esc = (s) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const deadlineStr = deadline
    ? new Date(deadline).toLocaleString('en-US', { weekday:'long', month:'long', day:'numeric', hour:'numeric', minute:'2-digit', timeZoneName:'short' })
    : 'soon';
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#0d0d0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
      <div style="max-width:520px;margin:40px auto;padding:32px 28px;background:#1a1a1e;border-radius:16px;border:1px solid rgba(255,255,255,0.08);">
        <div style="margin-bottom:24px;">
          <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Taikai</span>
          <span style="font-size:12px;color:#888;margin-left:8px;">by Kimesoft</span>
        </div>
        <div style="background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.4);border-radius:12px;padding:16px 20px;margin-bottom:20px;">
          <p style="color:#fcd34d;font-size:16px;font-weight:700;margin:0;">⏰ ${hoursLeft ? `${hoursLeft} hours left` : 'Registration closing soon'}</p>
        </div>
        <h2 style="color:#ffffff;font-size:20px;font-weight:600;margin:0 0 12px;">Last chance to register</h2>
        <p style="color:#aaa;font-size:15px;line-height:1.6;margin:0 0 20px;">
          Registration for <strong style="color:#ddd;">${esc(tournament.name)}</strong>
          closes on <strong style="color:#fcd34d;">${esc(deadlineStr)}</strong>.
          Register now before spots fill up.
        </p>
        <a href="${esc(registerUrl)}" style="display:inline-block;padding:14px 28px;background:#f59e0b;color:#000;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;">
          Register Now
        </a>
        <p style="color:#555;font-size:12px;margin-top:32px;line-height:1.5;">
          You're receiving this because you have an account on Taikai.
        </p>
      </div>
    </body>
    </html>
  `;
};
