/**
 * Subscription plan configuration and helper functions
 */

export const PLAN_CONFIG = {
  free: {
    maxDailyQueries: 20,
    canUploadTextbookPDFs: true,
    maxPagesPerPDF: 20,
    maxDollarLimit: 1, // Maximum dollars for AI chat usage
  },
  plus: {
    maxDailyQueries: 200,
    canUploadTextbookPDFs: true,
    maxPagesPerPDF: 200,
    maxDollarLimit: 5, // Maximum dollars for AI chat usage
  },
  pro: {
    maxDailyQueries: 1000,
    canUploadTextbookPDFs: true,
    maxPagesPerPDF: 1000,
    maxDollarLimit: 10, // Maximum dollars for AI chat usage
  },
};

/**
 * Admin configuration (unlimited everything)
 */
const ADMIN_CONFIG = {
  maxDailyQueries: Infinity,
  canUploadTextbookPDFs: true,
  maxPagesPerPDF: Infinity,
  maxDollarLimit: Infinity, // Admins get unlimited dollar usage
};

/**
 * Get plan configuration for a user
 * @param {Object} user - User object with role and plan properties
 * @returns {Object} Plan configuration object
 */
export function getPlanConfig(user) {
  if (!user) {
    // Default to free plan if no user
    return PLAN_CONFIG.free;
  }

  // Admins get unlimited access
  if (user.role === 'admin') {
    return ADMIN_CONFIG;
  }

  // Check if plan has expired
  if (user.plan_expires_at) {
    const expiresAt = new Date(user.plan_expires_at);
    const now = new Date();
    if (expiresAt < now) {
      // Plan expired, downgrade to free
      return PLAN_CONFIG.free;
    }
  }

  // Return plan config based on user's plan
  return PLAN_CONFIG[user.plan] || PLAN_CONFIG.free;
}

/**
 * Assert that a user has access to a specific feature
 * @param {Object} user - User object
 * @param {string} feature - Feature name to check
 * @throws {Error} If feature is not available for user's plan
 */
export function assertFeature(user, feature) {
  const config = getPlanConfig(user);
  
  if (config[feature] === false || (feature === 'maxDailyQueries' && !Number.isFinite(config[feature]))) {
    throw new Error(`Forbidden: your plan does not include this feature (${feature}).`);
  }
  
  // For numeric limits, we check them separately in usage tracking
  // This function is mainly for boolean features
  if (typeof config[feature] === 'boolean' && !config[feature]) {
    throw new Error(`Forbidden: your plan does not include this feature (${feature}).`);
  }
}

/**
 * Check if user is an admin
 * @param {Object} user - User object
 * @returns {boolean} True if user is admin
 */
export function isAdmin(user) {
  return user?.role === 'admin';
}

/**
 * Check if user's plan has expired and needs downgrade
 * @param {Object} user - User object
 * @returns {boolean} True if plan has expired
 */
export function isPlanExpired(user) {
  if (!user?.plan_expires_at) {
    return false; // Free plans don't expire
  }
  
  const expiresAt = new Date(user.plan_expires_at);
  const now = new Date();
  return expiresAt < now;
}

/**
 * Get user's effective plan (downgrades to free if expired)
 * @param {Object} user - User object
 * @returns {string} Effective plan name
 */
export function getEffectivePlan(user) {
  if (!user) {
    return 'free';
  }
  
  if (user.role === 'admin') {
    return 'admin';
  }
  
  if (isPlanExpired(user)) {
    return 'free';
  }
  
  return user.plan || 'free';
}

