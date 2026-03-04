const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const creditQueries = require('../db/queries/credits');
const tournamentQueries = require('../db/queries/tournaments');
const pool = require('../db/pool');

const router = express.Router();

// All super-admin routes require authentication + super_admin role
router.use(requireAuth, requireRole('super_admin'));

// POST /api/super-admin/credits/grant — Grant credits to an Event Director
router.post('/credits/grant',
  [
    body('userId').isUUID().withMessage('Valid user ID is required'),
    body('amount').isInt({ min: 1 }).withMessage('Amount must be a positive integer'),
    body('description').optional().trim(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { userId, amount, description } = req.body;

      // Verify target user exists
      const userResult = await pool.query(
        'SELECT id, email, first_name, last_name FROM users WHERE id = $1',
        [userId]
      );
      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = userResult.rows[0];
      const newBalance = await creditQueries.addCredits(
        userId, amount, 'grant',
        description || `${amount} credits granted by admin`
      );

      res.json({
        message: `Granted ${amount} credits to ${user.first_name} ${user.last_name}`,
        user: { id: user.id, email: user.email },
        credits: amount,
        newBalance,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/super-admin/directors — List all Event Directors with credit balances
router.get('/directors', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.organization_name,
              u.credit_balance, u.created_at,
              COUNT(t.id)::int AS tournament_count
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id AND ur.role = 'event_director'
       LEFT JOIN tournaments t ON t.created_by = u.id
       GROUP BY u.id
       ORDER BY u.created_at DESC`
    );
    res.json({ directors: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/super-admin/tournaments — List ALL tournaments across all directors
router.get('/tournaments', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT t.*,
              u.first_name AS director_first_name,
              u.last_name AS director_last_name,
              u.email AS director_email,
              COALESCE(reg.competitor_count, 0)::int AS competitor_count
       FROM tournaments t
       LEFT JOIN users u ON u.id = t.created_by
       LEFT JOIN (
         SELECT tournament_id, COUNT(DISTINCT profile_id) AS competitor_count
         FROM registrations WHERE status != 'cancelled'
         GROUP BY tournament_id
       ) reg ON reg.tournament_id = t.id
       ORDER BY t.created_at DESC`
    );
    res.json({ tournaments: result.rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
