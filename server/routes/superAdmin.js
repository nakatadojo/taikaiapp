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
        (SELECT COUNT(*) FROM users) AS total_users,
        (SELECT COUNT(*) FROM academies) AS total_dojos,
        (SELECT COUNT(*) FROM tournaments) AS total_tournaments,
        (SELECT COUNT(*) FROM tournaments WHERE published = true) AS active_tournaments,
        (SELECT COUNT(DISTINCT r.profile_id) FROM registrations r WHERE r.status != 'cancelled') AS total_registrations
    `);

    // Recent user signups (last 10)
    const recentUsers = await pool.query(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.created_at
      FROM users u
      ORDER BY u.created_at DESC
      LIMIT 10
    `);

    // Recent tournaments (last 10)
    const recentTournaments = await pool.query(`
      SELECT t.id, t.name, t.published, t.created_at,
             u.first_name AS director_first_name, u.last_name AS director_last_name
      FROM tournaments t
      LEFT JOIN users u ON u.id = t.created_by
      ORDER BY t.created_at DESC
      LIMIT 10
    `);

    res.json({
      stats: stats.rows[0],
      recentUsers: recentUsers.rows,
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

// ── Users ───────────────────────────────────────────────────────────────────

// GET /api/super-admin/users — List all users with aggregated info
router.get('/users', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.first_name, u.last_name,
              u.credit_balance, u.created_at, u.email_verified,
              COUNT(DISTINCT t.id)::int AS owned_count,
              COUNT(DISTINCT r.tournament_id)::int AS registered_count,
              (COUNT(DISTINCT t.id) + COUNT(DISTINCT r.tournament_id))::int AS tournament_count,
              (SELECT a.name FROM academies a WHERE a.head_coach_id = u.id LIMIT 1) AS dojo_name,
              (SELECT a.id FROM academies a WHERE a.head_coach_id = u.id LIMIT 1) AS dojo_id
       FROM users u
       LEFT JOIN tournaments t ON t.created_by = u.id
       LEFT JOIN registrations r ON r.user_id = u.id AND r.status NOT IN ('cancelled')
       GROUP BY u.id
       ORDER BY u.created_at DESC`
    );
    res.json({ users: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/super-admin/users/:id — Detailed user view
router.get('/users/:id', async (req, res, next) => {
  try {
    const user = await userQueries.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const roles = await roleQueries.getRolesForUser(user.id);

    // Tournaments they created
    const tournaments = await pool.query(
      `SELECT id, name, published, date, created_at,
              COALESCE((SELECT COUNT(DISTINCT profile_id) FROM registrations WHERE tournament_id = t.id AND status != 'cancelled'), 0)::int AS competitor_count
       FROM tournaments t WHERE created_by = $1 ORDER BY created_at DESC`,
      [user.id]
    );

    // Dojos they own
    const dojos = await pool.query(
      `SELECT a.id, a.name, a.city, a.state, a.created_at,
              COUNT(am.id)::int AS member_count
       FROM academies a
       LEFT JOIN academy_members am ON am.academy_id = a.id
       WHERE a.head_coach_id = $1
       GROUP BY a.id`,
      [user.id]
    );

    // Tournament memberships (coach/judge/staff roles)
    const memberships = await pool.query(
      `SELECT tm.id, tm.role, tm.staff_role, tm.status, tm.applied_at,
              t.name AS tournament_name, t.date AS tournament_date
       FROM tournament_members tm
       JOIN tournaments t ON t.id = tm.tournament_id
       WHERE tm.user_id = $1
       ORDER BY tm.applied_at DESC`,
      [user.id]
    );

    // Credit history
    const creditHistory = await creditQueries.getTransactions(user.id, { limit: 50 });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        creditBalance: user.credit_balance,
        emailVerified: user.email_verified,
        createdAt: user.created_at,
        roles,
      },
      tournaments: tournaments.rows,
      dojos: dojos.rows,
      memberships: memberships.rows,
      creditHistory,
    });
  } catch (err) {
    next(err);
  }
});

// ── Dojos ───────────────────────────────────────────────────────────────────

// GET /api/super-admin/dojos — List all dojos with owner info
router.get('/dojos', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT a.id, a.name, a.city, a.state, a.website, a.logo_url, a.created_at,
              u.id AS owner_id, u.first_name AS owner_first_name,
              u.last_name AS owner_last_name, u.email AS owner_email,
              COUNT(am.id)::int AS member_count
       FROM academies a
       LEFT JOIN users u ON u.id = a.head_coach_id
       LEFT JOIN academy_members am ON am.academy_id = a.id
       GROUP BY a.id, u.id
       ORDER BY a.name ASC`
    );
    res.json({ dojos: result.rows });
  } catch (err) {
    next(err);
  }
});

// ── Credits Grant ───────────────────────────────────────────────────────────

// POST /api/super-admin/credits/grant — Grant credits to a user
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

// GET /api/super-admin/tournaments — List ALL tournaments
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

    const targetRoles = await roleQueries.getRolesForUser(userId);
    const platformRoles = targetRoles.filter(r => ['admin', 'super_admin'].includes(r));

    // Build impersonation JWT — target user's identity + impersonation flag
    const jwt = require('jsonwebtoken');
    const payload = {
      id: targetUser.id,
      email: targetUser.email,
      roles: platformRoles,
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
      redirectUrl: '/',
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
