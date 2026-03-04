/**
 * Registration Confirmation Email Template
 * Sent after a successful tournament registration payment.
 *
 * @param {Object}   opts
 * @param {Object}   opts.tournament      – { name, date, location }
 * @param {Array}    opts.competitors     – [{ name, events: [{ name, price }], subtotal }]
 * @param {number}   opts.totalPaid
 * @param {number}   opts.discountAmount
 * @param {string}   opts.transactionId
 * @param {string}   opts.appUrl
 * @returns {string} HTML
 */
module.exports = function registrationConfirmation({ tournament, competitors, totalPaid, discountAmount, transactionId, appUrl }) {
  const tournamentDate = tournament.date
    ? new Date(tournament.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : 'TBD';

  const competitorRows = competitors.map(c => {
    const evtList = c.events.map(e =>
      `<li style="color:#d1d5db;font-size:14px;padding:3px 0;">${e.name} — $${e.price.toFixed(2)}</li>`
    ).join('');
    return `
      <div style="margin-bottom:14px;padding:14px;background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.2);border-radius:10px;">
        <strong style="color:#f3f4f6;font-size:15px;">${c.name}</strong>
        <ul style="margin:8px 0 0;padding-left:20px;list-style:disc;">${evtList}</ul>
        <p style="color:#e5e7eb;font-size:14px;margin:10px 0 0;font-weight:600;">Subtotal: $${c.subtotal.toFixed(2)}</p>
      </div>
    `;
  }).join('');

  const discountLine = discountAmount > 0
    ? `<p style="color:#a78bfa;font-size:15px;margin:8px 0;">Discount: -$${discountAmount.toFixed(2)}</p>`
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

    <!-- Header -->
    <div style="background:#1a1a24;border:1px solid rgba(124,58,237,0.25);border-radius:16px;padding:32px;margin-bottom:24px;">
      <div style="text-align:center;margin-bottom:20px;">
        <div style="display:inline-block;width:52px;height:52px;line-height:52px;border-radius:50%;background:rgba(124,58,237,0.15);font-size:26px;text-align:center;">&#10003;</div>
      </div>
      <h1 style="color:#f9fafb;font-size:22px;margin:0 0 8px;text-align:center;">Registration Confirmed</h1>
      <p style="color:#9ca3af;font-size:15px;line-height:1.6;margin:0;text-align:center;">
        Your registration for <strong style="color:#e5e7eb;">${tournament.name}</strong> is all set.
      </p>
    </div>

    <!-- Tournament Details -->
    <div style="background:#1a1a24;border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:20px 24px;margin-bottom:24px;">
      <table style="width:100%;border-collapse:collapse;">
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

    <!-- Competitors -->
    <div style="background:#1a1a24;border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:24px;margin-bottom:24px;">
      <h2 style="color:#f3f4f6;font-size:16px;margin:0 0 16px;font-weight:600;">Registered Competitors</h2>
      ${competitorRows}

      <div style="border-top:1px solid rgba(255,255,255,0.08);margin-top:16px;padding-top:16px;">
        ${discountLine}
        <p style="color:#f9fafb;font-size:20px;font-weight:700;margin:4px 0 0;">Total Paid: $${totalPaid.toFixed(2)}</p>
        <p style="color:#6b7280;font-size:12px;margin:8px 0 0;">Transaction ID: ${transactionId}</p>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:16px 0;">
      <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:0;">
        Need to make changes? Contact the tournament organizer directly.
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
