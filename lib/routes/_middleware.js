import storage from '../storage/index.js';

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

export async function resolveSessionUserType(req) {
  if (req.session.userType) {
    return req.session.userType;
  }

  const seniorCounselor = await storage.model('SeniorCounselor').findById(req.session.userId).select('_id');
  const userType = seniorCounselor ? 'seniorCounselor' : 'user';
  req.session.userType = userType;
  return userType;
}

// Middleware for routes restricted to senior counselor accounts
export async function isSeniorCounselor(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const userType = await resolveSessionUserType(req);
  if (userType !== 'seniorCounselor') {
    return res.status(403).json({ error: 'Senior counselor account required' });
  }
  next();
}

// Roll call: non-admin senior counselors only
export async function isSeniorCounselorNonAdmin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (req.session.admin) {
    return res.status(403).json({ error: 'This page is not available for admin accounts' });
  }

  const userType = await resolveSessionUserType(req);
  if (userType !== 'seniorCounselor') {
    return res.status(403).json({ error: 'Senior counselor account required' });
  }
  next();
}

// Default export for backward compatibility
export default isAuthenticated;
