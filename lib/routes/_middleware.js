// Middleware to check if the user is authenticated
export function isAuthenticated(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

// Middleware to check if the user is authenticated and is an admin
export function isAuthenticatedAdmin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!req.session.admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// Middleware for routes restricted to non-admin users (e.g. roll call)
export function isAuthenticatedNonAdmin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (req.session.admin) {
    return res.status(403).json({ error: 'This page is not available for admin accounts' });
  }
  next();
}

// Default export for backward compatibility
export default isAuthenticated;