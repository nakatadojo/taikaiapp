const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const creditQueries = require('../db/queries/credits');
const creditPackageQueries = require('../db/queries/creditPackages');
const roleQueries = require('../db/queries/roles');
const userQueries = require('../db/queries/users');
const { setAuthCookie } = require('../controllers/authController');
const pool = require('../db/pool');

const router = express.Router();

// Stop-impersonate must be before the role check — during impersonation,
// the JWT has the director's roles, not super_admin
router.post('/stop-impersonate', requireAuth, async (req, res, next) => {
  try {
    const originalUserId = req.user.originalUserId;
    if (!originalUserId) {
      return res.status(400).json({ error: 'Not currently impersonating anyone' });
    }

    // Look up original admin user
    const adminUser = await userQueries.findById(originalUserId);
    if (!adminUser) {
      return res.status(404).json({ error: 'Original admin user not found' });
    }

    const adminRoles = await roleQueries.getRolesForUser(originalUserId);
    setAuthCookie(res, adminUser, adminRoles);

    res.json({
      message: 'Impersonation ended',
      redirectUrl: '/admin',
    });
  } catch (err) {
    next(err);
  }
});

// All remaining super-admin routes require authentication + super_admin role
router.use(requireAuth, requireRole('super_admin'));

// ── Dashboard Stats ─────────────────────────────────────────────────────────

// GET /api/super-admin/stats — Aggregate dashboard stats
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await pool.query(`
      SELECT
        (SELECT COUNT(DISTINCT u.id) FROM users u JOIN user_roles ur ON ur.user_id = u.id WHERE ur.role = 'event_director') AS total_directors,
        (SELECT COUNT(*) FROM tournaments) AS total_tournaments,
        (SELECT COUNT(*) FROM tournaments WHERE status = 'published') AS active_tournaments,
        (SELECT COALESCE(SUM(amount), 0) FROM credit_transactions WHERE type = 'purchase' AND amount > 0) AS total_revenue_credits,
        (SELECT COALESCE(SUM(CASE WHEN ct.type = 'purchase' THEN ct.amount ELSE 0 END), 0) FROM credit_transactions ct) AS total_credits_purchased,
        (SELECT COUNT(DISTINCT r.profile_id) FROM registrations r WHERE r.status != 'cancelled') AS total_registrations
    `);

    // Recent director signups (last 10)
    const recentDirectors = await pool.query(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.organization_name, u.created_at
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id AND ur.role = 'event_director'
      ORDER BY u.created_at DESC
      LIMIT 10
    `);

    // Recent tournaments (last 10)
    const recentTournaments = await pool.query(`
      SELECT t.id, t.name, t.status, t.created_at,
             u.first_name AS director_first_name, u.last_name AS director_last_name
      FROM tournaments t
      LEFT JOIN users u ON u.id = t.created_by
      ORDER BY t.created_at DESC
      LIMIT 10
    `);

    res.json({
      stats: stats.rows[0],
      recentDirectors: recentDirectors.rows,
      recentTournaments: recentTournaments.rows,
    });
  } catch (err) {
    next(err);
  }
});

// ── Revenue / Payments ──────────────────────────────────────────────────────

// GET /api/super-admin/revenue — Payment/revenue data
router.get('/revenue', async (req, res, next) => {
  try {
    // All purchase transactions with director info
    const transactions = await pool.query(`
      SELECT ct.*, u.email, u.first_name, u.last_name, u.organization_name
      FROM credit_transactions ct
      JOIN users u ON u.id = ct.user_id
      ORDER BY ct.created_at DESC
      LIMIT 200
    `);

    // Monthly revenue breakdown (last 12 months)
    const monthlyRevenue = await pool.query(`
      SELECT
        TO_CHAR(created_at, 'YYYY-MM') AS month,
        SUM(CASE WHEN type = 'purchase' THEN amount ELSE 0 END)::int AS credits_purchased,
        COUNT(CASE WHEN type = 'purchase' THEN 1 END)::int AS purchase_count,
        SUM(CASE WHEN type = 'grant' THEN amount ELSE 0 END)::int AS credits_granted,
        SUM(CASE WHEN type = 'usage' THEN ABS(amount) ELSE 0 END)::int AS credits_used
      FROM credit_transactions
      WHERE created_at >= NOW() - INTERVAL '12 months'
      GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ORDER BY month DESC
    `);

    res.json({
      transactions: transactions.rows,
      monthlyRevenue: monthlyRevenue.rows,
    });
  } catch (err) {
    next(err);
  }
});

// ── Directors ───────────────────────────────────────────────────────────────

// GET /api/super-admin/directors — List all Event Directors with credit balances
router.get('/directors', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.organization_name,
              u.credit_balance, u.created_at, u.email_verified,
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

// GET /api/super-admin/directors/:id — Single director detail
router.get('/directors/:id', async (req, res, next) => {
  try {
    const user = await userQueries.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Director not found' });
    }

    const roles = await roleQueries.getRolesForUser(user.id);

    // Get their tournaments
    const tournaments = await pool.query(
      `SELECT id, name, status, created_at FROM tournaments WHERE created_by = $1 ORDER BY created_at DESC`,
      [user.id]
    );

    // Get their credit history
    const creditHistory = await creditQueries.getTransactions(user.id, { limit: 50 });

    res.json({
      director: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        organizationName: user.organization_name,
        creditBalance: user.credit_balance,
        emailVerified: user.email_verified,
        createdAt: user.created_at,
        roles,
      },
      tournaments: tournaments.rows,
      creditHistory,
    });
  } catch (err) {
    next(err);
  }
});

// ── Credits Grant ───────────────────────────────────────────────────────────

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

// ── Tournaments ─────────────────────────────────────────────────────────────

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

// ── Impersonation ───────────────────────────────────────────────────────────

// POST /api/super-admin/impersonate/:userId — Start impersonation
router.post('/impersonate/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Verify target user exists
    const targetUser = await userQueries.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify they have event_director role
    const targetRoles = await roleQueries.getRolesForUser(userId);
    if (!targetRoles.includes('event_director')) {
      return res.status(400).json({ error: 'Can only impersonate event directors' });
    }

    // Build impersonation JWT — target user's identity + impersonation flag
    const jwt = require('jsonwebtoken');
    const payload = {
      id: targetUser.id,
      email: targetUser.email,
      roles: targetRoles,
      emailVerified: targetUser.email_verified,
      impersonating: true,
      originalUserId: req.user.id,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '2h' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 2 * 60 * 60 * 1000, // 2 hours
    });

    res.json({
      message: `Now impersonating ${targetUser.first_name} ${targetUser.last_name}`,
      redirectUrl: '/director.html',
    });
  } catch (err) {
    next(err);
  }
});

// ── Credit Packages CRUD ────────────────────────────────────────────────────

// GET /api/super-admin/credit-packages — List all packages
router.get('/credit-packages', async (req, res, next) => {
  try {
    const packages = await creditPackageQueries.getAll();
    res.json({ packages });
  } catch (err) {
    next(err);
  }
});

// POST /api/super-admin/credit-packages — Create a package
router.post('/credit-packages',
  [
    body('slug').trim().notEmpty().withMessage('Slug is required'),
    body('credits').isInt({ min: 1 }).withMessage('Credits must be a positive integer'),
    body('priceInCents').isInt({ min: 0 }).withMessage('Price must be a non-negative integer'),
    body('label').trim().notEmpty().withMessage('Label is required'),
    body('active').optional().isBoolean(),
    body('sortOrder').optional().isInt(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { slug, credits, priceInCents, label, active, sortOrder } = req.body;
      const pkg = await creditPackageQueries.create({ slug, credits, priceInCents, label, active, sortOrder });
      res.status(201).json({ package: pkg });
    } catch (err) {
      if (err.code === '23505') { // unique violation
        return res.status(409).json({ error: 'A package with this slug already exists' });
      }
      next(err);
    }
  }
);

// PUT /api/super-admin/credit-packages/:id — Update a package
router.put('/credit-packages/:id',
  [
    body('slug').optional().trim().notEmpty(),
    body('credits').optional().isInt({ min: 1 }),
    body('priceInCents').optional().isInt({ min: 0 }),
    body('label').optional().trim().notEmpty(),
    body('active').optional().isBoolean(),
    body('sortOrder').optional().isInt(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { slug, credits, priceInCents, label, active, sortOrder } = req.body;
      const fields = {};
      if (slug !== undefined) fields.slug = slug;
      if (credits !== undefined) fields.credits = credits;
      if (priceInCents !== undefined) fields.price_in_cents = priceInCents;
      if (label !== undefined) fields.label = label;
      if (active !== undefined) fields.active = active;
      if (sortOrder !== undefined) fields.sort_order = sortOrder;

      const pkg = await creditPackageQueries.update(req.params.id, fields);
      if (!pkg) {
        return res.status(404).json({ error: 'Package not found' });
      }
      res.json({ package: pkg });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/super-admin/credit-packages/:id — Delete a package
router.delete('/credit-packages/:id', async (req, res, next) => {
  try {
    const deleted = await creditPackageQueries.remove(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Package not found' });
    }
    res.json({ message: 'Package deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
