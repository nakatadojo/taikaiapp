const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { sendEmail, templates } = require('../email');

const router = express.Router();

/**
 * GET /api/email/test?to=your@email.com&template=directorWelcome
 *
 * Admin-only route that sends a test email using one of the templates.
 * Defaults to the directorWelcome template if none specified.
 *
 * Query params:
 *   to       – recipient email (required)
 *   template – one of: registrationConfirmation, directorWelcome,
 *              passwordReset, tournamentPublished (default: directorWelcome)
 */
router.get(
  '/test',
  requireAuth,
  requireRole('super_admin'),
  async (req, res, next) => {
    try {
      const { to, template } = req.query;

      if (!to) {
        return res.status(400).json({ error: 'Query parameter "to" is required (recipient email)' });
      }

      const templateName = template || 'directorWelcome';

      // Build sample data per template
      let subject, html;

      switch (templateName) {
        case 'directorWelcome': {
          subject = '[TEST] Welcome to Taikai';
          html = templates.directorWelcome({
            verifyUrl: 'https://taikaiapp.com/#test-verify',
            organizationName: 'Test Academy',
          });
          break;
        }
        case 'passwordReset': {
          subject = '[TEST] Reset Your Password';
          html = templates.passwordReset({
            resetUrl: 'https://taikaiapp.com/reset-password.html?token=test',
          });
          break;
        }
        case 'registrationConfirmation': {
          subject = '[TEST] Registration Confirmed';
          html = templates.registrationConfirmation({
            tournament: { name: 'Test Tournament 2026', date: '2026-06-15', location: '123 Main St, Los Angeles, CA' },
            competitors: [
              {
                name: 'Jane Doe',
                events: [
                  { name: 'Kata — Junior Female Advanced', price: 45 },
                  { name: 'Kumite — Junior Female Advanced', price: 45 },
                ],
                subtotal: 90,
              },
              {
                name: 'John Doe',
                events: [
                  { name: 'Kumite — Senior Male Intermediate', price: 50 },
                ],
                subtotal: 50,
              },
            ],
            totalPaid: 126,
            discountAmount: 14,
            transactionId: 'test_txn_123456',
            appUrl: 'https://taikaiapp.com',
          });
          break;
        }
        case 'tournamentPublished': {
          subject = '[TEST] Tournament Published';
          html = templates.tournamentPublished({
            tournament: { name: 'Test Tournament 2026', date: '2026-06-15', location: '123 Main St, Los Angeles, CA', slug: 'test-tournament-2026' },
            publicUrl: 'https://taikaiapp.com/tournaments/test-tournament-2026',
          });
          break;
        }
        default:
          return res.status(400).json({
            error: `Unknown template "${templateName}". Available: directorWelcome, passwordReset, registrationConfirmation, tournamentPublished`,
          });
      }

      await sendEmail(to, subject, html);

      res.json({
        message: `Test email sent to ${to} using template "${templateName}"`,
        template: templateName,
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
