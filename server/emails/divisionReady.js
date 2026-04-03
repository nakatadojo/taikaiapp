/**
 * Division Ready Email Template
 * Sent to competitors when their division is called to the mat.
 */
module.exports = function divisionReady({ tournament, divisionName, matName, competitorName }) {
  const esc = (s) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
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
        <div style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);border-radius:12px;padding:16px 20px;margin-bottom:20px;">
          <p style="color:#fca5a5;font-size:18px;font-weight:700;margin:0;">🥋 Report to the mat now</p>
        </div>
        <h2 style="color:#ffffff;font-size:20px;font-weight:600;margin:0 0 12px;">Your division has been called</h2>
        <p style="color:#aaa;font-size:15px;line-height:1.6;margin:0 0 20px;">
          Hi ${competitorName ? `<strong style="color:#ddd;">${esc(competitorName)}</strong>` : 'competitor'},<br><br>
          <strong style="color:#ddd;">${esc(divisionName)}</strong> has been called to
          ${matName ? `<strong style="color:#ddd;">${esc(matName)}</strong>` : 'the mat'} at
          <strong style="color:#ddd;">${esc(tournament.name)}</strong>.
          Please report immediately.
        </p>
        <p style="color:#555;font-size:12px;margin-top:32px;line-height:1.5;">
          You're receiving this because you're registered for ${esc(tournament.name)}.
        </p>
      </div>
    </body>
    </html>
  `;
};
