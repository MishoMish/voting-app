/**
 * Session utility functions for managing user sessions
 */

/**
 * Check if user is authenticated
 */
export function isAuthenticated(req) {
  return req.session && req.session.userId;
}

/**
 * Check if user is admin
 */
export function isAdmin(req) {
  return req.session && req.session.isAdmin;
}

/**
 * Get user ID from session
 */
export function getUserId(req) {
  return req.session?.userId;
}

/**
 * Get username from session
 */
export function getUsername(req) {
  return req.session?.username;
}

/**
 * Create user session
 */
export function createUserSession(req, userId, username, isAdmin = false) {
  req.session.userId = userId;
  req.session.username = username;
  req.session.isAdmin = isAdmin;
  req.session.loginTime = new Date().toISOString();
}

/**
 * Destroy user session
 */
export function destroyUserSession(req) {
  return new Promise((resolve, reject) => {
    if (!req || !req.session || typeof req.session.destroy !== 'function') {
      // No session to destroy or session is not properly initialized
      resolve();
      return;
    }
    
    req.session.destroy((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Authentication middleware
 */
export function requireAuth(req, res, next) {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

/**
 * Admin authentication middleware
 */
export function requireAdmin(req, res, next) {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: 'Admin privileges required' });
  }
  next();
}

export default {
  isAuthenticated,
  isAdmin,
  getUserId,
  getUsername,
  createUserSession,
  destroyUserSession,
  requireAuth,
  requireAdmin
};
