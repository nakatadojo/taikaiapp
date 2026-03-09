const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const userQueries = require('../db/queries/users');
const roleQueries = require('../db/queries/roles');
const pool = require('../db/pool');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../email');

// Read from environment — allows tuning without code changes
// Default: 12 rounds (good balance of security vs. speed; increase in .env for higher security)
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
// Default: 8h (shorter than 24h to limit exposure window if a token is stolen)
const JWT_EXPIRY = process.env.JWT_EXPIRY || '8h';
// Parse JWT_EXPIRY string into milliseconds so the cookie maxAge matches exactly.
// Supports h (hours), d (days), m (minutes). Defaults to 8h if format is unrecognised.
const JWT_EXPIRY_MS = (() => {
  const m = JWT_EXPIRY.match(/^(\d+)(h|d|m)$/);
  if (!m) return 8 * 60 * 60 * 1000;
  const n = parseInt(m[1], 10);
  return m[2] === 'h' ? n * 3_600_000 : m[2] === 'd' ? n * 86_400_000 : n * 60_000;
})();

/**
 * Build JWT payload and set httpOnly cookie.
 */
function setAuthCookie(res, user, roles, extra = {}) {
  // Only include platform-level roles (admin/super_admin) in JWT
  const platformRoles = (roles || []).filter(r => ['admin', 'super_admin'].includes(r));
  const payload = {
    id: user.id,
    email: user.email,
    roles: platformRoles,
    emailVerified: user.email_verified,
    ...extra,
  };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRY });

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: JWT_EXPIRY_MS, // matches JWT expiry so stale cookies auto-clear
  });

  return payload;
}

/**
 * POST /api/auth/signup
 * Creates a new user, assigns roles, sends verification email.
 */
async function signup(req, res, next) {
  try {
    const { email, password, firstName, lastName, phone, organizationName } = req.body;

    // Check for existing user — return a generic message to avoid email enumeration
    const existing = await userQueries.findByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Unable to create account. Please try a different email address, or log in if you already have an account.' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Generate verification token (32 random bytes → hex string)
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user
    const user = await userQueries.create({
      email,
      passwordHash,
      firstName,
      lastName,
      phone,
      verificationToken,
      verificationTokenExpires,
    });

    // Set organization_name on user record if provided
    if (organizationName) {
      await pool.query(
        'UPDATE users SET organization_name = $1 WHERE id = $2',
        [organizationName, user.id]
      );
    }

    // No global roles assigned — roles are contextual (per-tournament, per-dojo)

    // Auto-accept any pending tournament invitations for this email
    try {
      const pendingInvites = await pool.query(
        `SELECT id, tournament_id, role FROM tournament_invitations
         WHERE email = $1 AND status = 'pending'`,
        [email.toLowerCase()]
      );
      for (const inv of pendingInvites.rows) {
        // Create tournament member with approved status
        await pool.query(
          `INSERT INTO tournament_members (user_id, tournament_id, role, status, applied_at, reviewed_at)
           VALUES ($1, $2, $3::user_role, 'approved', NOW(), NOW())
           ON CONFLICT (user_id, tournament_id, role) DO NOTHING`,
          [user.id, inv.tournament_id, inv.role]
        );
        // Mark invitation as accepted
        await pool.query(
          `UPDATE tournament_invitations SET status = 'accepted', accepted_at = NOW() WHERE id = $1`,
          [inv.id]
        );
      }
      if (pendingInvites.rows.length > 0) {
        console.log(`Auto-accepted ${pendingInvites.rows.length} tournament invitation(s) for ${email}`);
      }
    } catch (invErr) {
      console.error('Auto-accept invitations failed:', invErr.message);
      // Don't fail signup — invitations can be accepted later
    }

    // Send verification email
    try {
      await sendVerificationEmail(email, verificationToken, { organizationName });
    } catch (emailErr) {
      console.error('Verification email failed:', emailErr.message);
    }

    // Set auth cookie (no roles — JWT will only include admin/super_admin if applicable)
    setAuthCookie(res, user, []);

    res.status(201).json({
      message: 'Account created. Please check your email to verify your address.',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        roles: [],
        profileCompleted: true,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/auth/verify-email?token=...
 * Verifies email and redirects to login page with success message.
 */
async function verifyEmail(req, res, next) {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    const user = await userQueries.verifyEmail(token);
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    // Redirect to landing page with success flag
    const appUrl = process.env.APP_URL || '';
    res.redirect(`${appUrl}/?verified=1`);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/login
 * Authenticates user, sets JWT cookie, returns profile.
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    // Find user (includes password_hash via findByEmail)
    const user = await userQueries.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Compare password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Load roles and filter to platform-level only
    const allRoles = await roleQueries.getRolesForUser(user.id);
    const platformRoles = allRoles.filter(r => ['admin', 'super_admin'].includes(r));

    // Set auth cookie and return profile
    setAuthCookie(res, user, allRoles);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        dateOfBirth: user.date_of_birth,
        profilePhotoUrl: user.profile_photo_url,
        roles: platformRoles,
        emailVerified: user.email_verified,
        organizationName: user.organization_name,
        creditBalance: user.credit_balance || 0,
        profileCompleted: true,
        timezone: user.timezone || 'America/New_York',
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/select-role
 * Sets the user's role after account creation (new multi-step signup flow).
 */
async function selectRole(req, res, next) {
  try {
    // No-op: global roles are no longer assigned. Kept for backward compatibility.
    const userId = req.user.id;
    const user = await userQueries.findById(userId);
    const roles = await roleQueries.getRolesForUser(userId);

    res.json({
      message: 'Role selection is no longer required. All features are available to all users.',
      user: {
        id: user.id,
        email: user.email,
        roles: roles.filter(r => ['admin', 'super_admin'].includes(r)),
        profileCompleted: true,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/auth/complete-profile
 * Completes the user's profile after role selection (new multi-step signup flow).
 */
async function completeProfile(req, res, next) {
  try {
    const userId = req.user.id;
    const { phone, dateOfBirth, gender } = req.body;

    const user = await userQueries.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Build update map — accept optional profile fields
    const updates = { profile_completed: true };
    if (phone !== undefined) updates.phone = phone;
    if (dateOfBirth !== undefined) updates.date_of_birth = dateOfBirth;

    const updatedUser = await userQueries.updateProfile(userId, updates);

    // Refresh auth cookie
    const roles = await roleQueries.getRolesForUser(userId);
    setAuthCookie(res, updatedUser, roles);

    res.json({
      message: 'Profile completed successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        phone: updatedUser.phone,
        roles: roles.filter(r => ['admin', 'super_admin'].includes(r)),
        profileCompleted: true,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/forgot-password
 * Generates reset token and sends email. Always returns 200 (no email enumeration).
 */
async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;

    // Always return success (prevents email enumeration)
    const successMsg = { message: 'If an account with that email exists, a password reset link has been sent.' };

    const user = await userQueries.findByEmail(email);
    if (!user) {
      return res.json(successMsg);
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await userQueries.setResetToken(email, resetToken, expires);

    // Send email but don't fail the request if email service is down
    try {
      await sendPasswordResetEmail(email, resetToken);
    } catch (emailErr) {
      console.error('Password reset email failed:', emailErr.message);
    }

    res.json(successMsg);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/reset-password
 * Validates token, updates password.
 */
async function resetPassword(req, res, next) {
  try {
    const { token, password } = req.body;

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await userQueries.resetPassword(token, passwordHash);

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    res.json({ message: 'Password has been reset successfully. You can now log in.' });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/auth/me
 * Returns current user profile + roles.
 */
async function getMe(req, res, next) {
  try {
    const user = await userQueries.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const allRoles = await roleQueries.getRolesForUser(user.id);
    const platformRoles = allRoles.filter(r => ['admin', 'super_admin'].includes(r));

    // Count owned tournaments for context-based UI
    const ownedResult = await pool.query(
      'SELECT COUNT(*)::int AS count FROM tournaments WHERE created_by = $1',
      [user.id]
    );
    const ownedTournamentCount = ownedResult.rows[0]?.count || 0;

    // Check if user has a dojo
    const dojoResult = await pool.query(
      'SELECT id, name FROM academies WHERE head_coach_id = $1 LIMIT 1',
      [user.id]
    );
    const dojo = dojoResult.rows[0] || null;

    const response = {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        dateOfBirth: user.date_of_birth,
        profilePhotoUrl: user.profile_photo_url,
        roles: platformRoles,
        emailVerified: user.email_verified,
        organizationName: user.organization_name,
        creditBalance: user.credit_balance || 0,
        profileCompleted: true,
        settings: user.settings || {},
        timezone: user.timezone || 'America/New_York',
        ownedTournamentCount,
        dojo,
      },
    };

    // Pass through impersonation flags if present
    if (req.user.impersonating) {
      response.user.impersonating = true;
      response.user.originalUserId = req.user.originalUserId;
    }

    res.json(response);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/auth/me
 * Updates current user profile fields.
 */
async function updateMe(req, res, next) {
  try {
    const { firstName, lastName, phone, dateOfBirth, timezone } = req.body;

    // Map camelCase request body → snake_case DB columns
    const updates = {};
    if (firstName !== undefined) updates.first_name = firstName;
    if (lastName !== undefined) updates.last_name = lastName;
    if (phone !== undefined) updates.phone = phone;
    if (dateOfBirth !== undefined) updates.date_of_birth = dateOfBirth;
    if (timezone !== undefined) updates.timezone = timezone;

    const user = await userQueries.updateProfile(req.user.id, updates);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const allRoles = await roleQueries.getRolesForUser(user.id);
    const platformRoles = allRoles.filter(r => ['admin', 'super_admin'].includes(r));

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        dateOfBirth: user.date_of_birth,
        profilePhotoUrl: user.profile_photo_url,
        roles: platformRoles,
        emailVerified: user.email_verified,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/logout
 * Clears auth cookie.
 */
async function logout(req, res) {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
  res.json({ message: 'Logged out successfully' });
}

/**
 * POST /api/auth/setup-account
 * Sets password + verifies email for coach-created (passwordless) accounts.
 * Accepts { token, password } — the token is the verification_token from the user's setup email.
 */
async function setupAccount(req, res, next) {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await userQueries.setupAccount(token, passwordHash);

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired setup token' });
    }

    res.json({
      message: 'Account setup complete. You can now log in.',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/auth/settings
 * Returns the current user's settings.
 */
async function getSettings(req, res, next) {
  try {
    const settings = await userQueries.getSettings(req.user.id);
    res.json({ settings });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/auth/settings
 * Updates the current user's settings (partial merge).
 * Supports: defaultEventTypes, pricingDefaults, matchDurationDefaults,
 *           ringSetup, scoreboardPreferences, divisionTemplates
 */
async function updateSettings(req, res, next) {
  try {
    const {
      defaultEventTypes,
      pricingDefaults,
      matchDurationDefaults,
      ringSetup,
      scoreboardPreferences,
      divisionTemplates,
    } = req.body;

    // --- Validate defaultEventTypes ---
    const validTypes = ['kata', 'kumite', 'weapons', 'team-kata'];
    if (defaultEventTypes !== undefined) {
      if (!Array.isArray(defaultEventTypes)) {
        return res.status(400).json({ error: 'defaultEventTypes must be an array' });
      }
      const invalid = defaultEventTypes.filter(t => !validTypes.includes(t));
      if (invalid.length > 0) {
        return res.status(400).json({ error: `Invalid event types: ${invalid.join(', ')}` });
      }
    }

    // --- Validate pricingDefaults ---
    if (pricingDefaults !== undefined) {
      if (typeof pricingDefaults !== 'object' || pricingDefaults === null) {
        return res.status(400).json({ error: 'pricingDefaults must be an object' });
      }
      const { baseEventPrice, addonEventPrice } = pricingDefaults;
      if (baseEventPrice !== undefined && (isNaN(baseEventPrice) || baseEventPrice < 0)) {
        return res.status(400).json({ error: 'baseEventPrice must be a non-negative number' });
      }
      if (addonEventPrice !== undefined && (isNaN(addonEventPrice) || addonEventPrice < 0)) {
        return res.status(400).json({ error: 'addonEventPrice must be a non-negative number' });
      }
    }

    // --- Validate matchDurationDefaults ---
    if (matchDurationDefaults !== undefined) {
      if (typeof matchDurationDefaults !== 'object' || matchDurationDefaults === null) {
        return res.status(400).json({ error: 'matchDurationDefaults must be an object' });
      }
      for (const [key, val] of Object.entries(matchDurationDefaults)) {
        if (val !== null && (isNaN(val) || val < 0 || val > 600)) {
          return res.status(400).json({ error: `Invalid duration for ${key}: must be 0-600 seconds` });
        }
      }
    }

    // --- Validate ringSetup ---
    if (ringSetup !== undefined) {
      if (typeof ringSetup !== 'object' || ringSetup === null) {
        return res.status(400).json({ error: 'ringSetup must be an object' });
      }
      if (ringSetup.count !== undefined && (!Number.isInteger(ringSetup.count) || ringSetup.count < 1 || ringSetup.count > 20)) {
        return res.status(400).json({ error: 'ringSetup.count must be 1-20' });
      }
      if (ringSetup.names !== undefined && !Array.isArray(ringSetup.names)) {
        return res.status(400).json({ error: 'ringSetup.names must be an array' });
      }
    }

    // --- Validate scoreboardPreferences ---
    if (scoreboardPreferences !== undefined) {
      if (typeof scoreboardPreferences !== 'object' || scoreboardPreferences === null) {
        return res.status(400).json({ error: 'scoreboardPreferences must be an object' });
      }
      const validSystems = ['wkf', 'aau'];
      if (scoreboardPreferences.defaultScoringSystem && !validSystems.includes(scoreboardPreferences.defaultScoringSystem)) {
        return res.status(400).json({ error: 'defaultScoringSystem must be wkf or aau' });
      }
      if (scoreboardPreferences.defaultOvertimeDuration !== undefined) {
        const ot = scoreboardPreferences.defaultOvertimeDuration;
        if (isNaN(ot) || ot < 0 || ot > 300) {
          return res.status(400).json({ error: 'defaultOvertimeDuration must be 0-300 seconds' });
        }
      }
    }

    // --- Validate divisionTemplates ---
    if (divisionTemplates !== undefined) {
      if (!Array.isArray(divisionTemplates)) {
        return res.status(400).json({ error: 'divisionTemplates must be an array' });
      }
      for (const tmpl of divisionTemplates) {
        if (!tmpl.name || typeof tmpl.name !== 'string') {
          return res.status(400).json({ error: 'Each division template must have a name' });
        }
      }
    }

    // Fetch current settings, merge, save
    const current = await userQueries.getSettings(req.user.id);
    const merged = {
      ...current,
      ...(defaultEventTypes !== undefined && { defaultEventTypes }),
      ...(pricingDefaults !== undefined && { pricingDefaults }),
      ...(matchDurationDefaults !== undefined && { matchDurationDefaults }),
      ...(ringSetup !== undefined && { ringSetup }),
      ...(scoreboardPreferences !== undefined && { scoreboardPreferences }),
      ...(divisionTemplates !== undefined && { divisionTemplates }),
    };

    const result = await userQueries.updateSettings(req.user.id, merged);
    res.json({ settings: result.settings });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/resend-verification
 * Generates a new verification token and sends the email again.
 */
async function resendVerification(req, res, next) {
  try {
    const { email } = req.body;

    // Always return success (no email enumeration)
    const successMsg = { message: 'If an unverified account with that email exists, a new verification link has been sent.' };

    const user = await userQueries.findByEmail(email);
    if (!user || user.email_verified) {
      return res.json(successMsg);
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await pool.query(
      `UPDATE users SET verification_token = $1, verification_token_expires = $2, updated_at = NOW() WHERE id = $3`,
      [verificationToken, verificationTokenExpires, user.id]
    );

    try {
      await sendVerificationEmail(email, verificationToken, {
        accountType: user.account_type,
        organizationName: user.organization_name,
      });
    } catch (emailErr) {
      console.error('Resend verification email failed:', emailErr.message);
    }

    res.json(successMsg);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  signup,
  verifyEmail,
  login,
  selectRole,
  completeProfile,
  forgotPassword,
  resetPassword,
  resendVerification,
  getMe,
  updateMe,
  logout,
  setupAccount,
  getSettings,
  updateSettings,
  setAuthCookie,
};
