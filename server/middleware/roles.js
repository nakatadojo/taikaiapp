/**
 * Middleware that checks if the authenticated user has at least one of the allowed roles.
 * Must be used after requireAuth middleware.
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const userRoles = req.user.roles || [];
    const hasRole = allowedRoles.some(role => userRoles.includes(role));
    if (!hasRole) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

/**
 * Middleware that requires the authenticated user to have a verified email.
 * Must be used after requireAuth middleware.
 */
function requireVerified(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!req.user.emailVerified) {
    return res.status(403).json({ error: 'Email verification required. Please check your email for a verification link.' });
  }
  next();
}

module.exports = { requireRole, requireVerified };
