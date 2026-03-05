const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const userQueries = require('../db/queries/users');
const roleQueries = require('../db/queries/roles');
const profileQueries = require('../db/queries/profiles');
const pool = require('../db/pool');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../email');

const BCRYPT_ROUNDS = 12;
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

/**
 * Build JWT payload and set httpOnly cookie.
 */
function setAuthCookie(res, user, roles) {
  const payload = {
    id: user.id,
    email: user.email,
    roles,
    emailVerified: user.email_verified,
  };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRY });

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });

  return payload;
}

/**
 * POST /api/auth/signup
 * Creates a new user, assigns roles, sends verification email.
 */
async function signup(req, res, next) {
  try {
    const { email, password, firstName, lastName, phone, dateOfBirth, gender, roles, accountType, organizationName } = req.body;

    // Validate account type if provided
    const validAccountTypes = ['competitor', 'guardian', 'both', 'event_director'];
    const acctType = accountType && validAccountTypes.includes(accountType) ? accountType : null;

    // If accountType includes competitor, validate 18+ age
    if (acctType && (acctType === 'competitor' || acctType === 'both') && dateOfBirth) {
      const dob = new Date(typeof dateOfBirth === 'string' && dateOfBirth.length === 10 ? dateOfBirth + 'T12:00:00' : dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
      if (age < 18) {
        return res.status(400).json({
          error: 'Competitors must be 18 or older to create an account. If you are a minor, your parent or guardian should create an account and add you as a competitor.',
        });
      }
    }

    // Check for existing user
    const existing = await userQueries.findByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
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
      dateOfBirth,
      verificationToken,
      verificationTokenExpires,
    });

    // Set account_type and organization_name on user record
    if (acctType || organizationName) {
      const setClauses = [];
      const setParams = [];
      let pIdx = 1;
      if (acctType) { setClauses.push(`account_type = $${pIdx++}`); setParams.push(acctType); }
      if (organizationName) { setClauses.push(`organization_name = $${pIdx++}`); setParams.push(organizationName); }
      setParams.push(user.id);
      await pool.query(
        `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${pIdx}`,
        setParams
      );
    }

    // Assign roles based on accountType
    let selectedRoles;
    if (acctType === 'event_director') {
      selectedRoles = ['event_director'];
    } else if (acctType === 'competitor') {
      selectedRoles = ['competitor'];
    } else if (acctType === 'guardian') {
      selectedRoles = ['competitor']; // Guardians still get competitor role for system access
    } else if (acctType === 'both') {
      selectedRoles = ['competitor'];
    } else {
      // Fallback: use provided roles or default
      const validRoles = ['competitor', 'coach', 'judge', 'assistant_coach'];
      selectedRoles = (roles || ['competitor']).filter(r => validRoles.includes(r));
      if (selectedRoles.length === 0) selectedRoles.push('competitor');
    }
    await roleQueries.addRoles(user.id, selectedRoles);

    // Auto-create self-profile for competitors
    if (acctType === 'competitor' || acctType === 'both') {
      try {
        await profileQueries.create({
          userId: user.id,
          firstName,
          lastName,
          dateOfBirth: dateOfBirth || '2000-01-01',
          gender: gender || 'male',
          isSelf: true,
        });
      } catch (profileErr) {
        console.warn('Failed to auto-create self-profile:', profileErr.message);
      }
    }

    // Send verification email (director-specific template for event directors)
    try {
      await sendVerificationEmail(email, verificationToken, {
        accountType: acctType,
        organizationName,
      });
    } catch (emailErr) {
      console.error('Verification email failed:', emailErr.message);
    }

    res.status(201).json({
      message: 'Account created. Please check your email to verify your address.',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        roles: selectedRoles,
        accountType: acctType,
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

    // Redirect to login page with success flag
    const appUrl = process.env.APP_URL || '';
    res.redirect(`${appUrl}/public.html?verified=1`);
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

    // Check email verification
    if (!user.email_verified) {
      return res.status(403).json({
        error: 'Please verify your email address before logging in',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    // Load roles
    const roles = await roleQueries.getRolesForUser(user.id);

    // Set auth cookie and return profile
    const payload = setAuthCookie(res, user, roles);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        dateOfBirth: user.date_of_birth,
        profilePhotoUrl: user.profile_photo_url,
        roles,
        emailVerified: user.email_verified,
        accountType: user.account_type,
        organizationName: user.organization_name,
        creditBalance: user.credit_balance || 0,
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

    const roles = await roleQueries.getRolesForUser(user.id);

    const response = {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        dateOfBirth: user.date_of_birth,
        profilePhotoUrl: user.profile_photo_url,
        roles,
        emailVerified: user.email_verified,
        accountType: user.account_type,
        organizationName: user.organization_name,
        creditBalance: user.credit_balance || 0,
        settings: user.settings || {},
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
    const { firstName, lastName, phone, dateOfBirth } = req.body;

    // Map camelCase request body → snake_case DB columns
    const updates = {};
    if (firstName !== undefined) updates.first_name = firstName;
    if (lastName !== undefined) updates.last_name = lastName;
    if (phone !== undefined) updates.phone = phone;
    if (dateOfBirth !== undefined) updates.date_of_birth = dateOfBirth;

    const user = await userQueries.updateProfile(req.user.id, updates);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const roles = await roleQueries.getRolesForUser(user.id);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        dateOfBirth: user.date_of_birth,
        profilePhotoUrl: user.profile_photo_url,
        roles,
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
