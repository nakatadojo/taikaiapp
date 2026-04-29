/**
 * Bracket Published Email Template
 * Sent to competitors when their division bracket is published.
 */
module.exports = function bracketPublished({ tournament, divisionName, bracketsUrl, competitorName }) {
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
        <h2 style="color:#ffffff;font-size:20px;font-weight:600;margin:0 0 12px;">Your bracket is up!</h2>
        <p style="color:#aaa;font-size:15px;line-height:1.6;margin:0 0 20px;">
          Hi ${competitorName ? `<strong style="color:#ddd;">${esc(competitorName)}</strong>` : 'competitor'},<br><br>
          The bracket for <strong style="color:#ddd;">${esc(divisionName)}</strong> at
          <strong style="color:#ddd;">${esc(tournament.name)}</strong> has been published.
          See who you're competing against and check your match order.
        </p>
        <a href="${esc(bracketsUrl)}" style="display:inline-block;padding:14px 28px;background:#cc0000;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;">
          View Bracket
        </a>
        <p style="color:#555;font-size:12px;margin-top:32px;line-height:1.5;">
          You're receiving this because you're registered for ${esc(tournament.name)}.
        </p>
      </div>
    </body>
    </html>
  `;
};
