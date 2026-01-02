/**
 * Input validation schemas for database query parameters
 * Prevents SQL injection by validating all user-controlled inputs
 * 
 * Requires: npm install zod
 * 
 * @module validation
 */

import { z } from 'zod';

/**
 * UUID Validation Schema
 * Validates UUID format
 */
export const uuidSchema = z.string().uuid({
  message: 'Invalid UUID format'
});

/**
 * User ID Validation Schema
 * Validates UUID and optionally checks authorization
 */
export function createUserIdSchema(expectedUserId) {
  return z.string().uuid().refine(
    (id) => id === expectedUserId,
    { message: 'Unauthorized user ID access' }
  );
}

/**
 * Search Term Validation Schema
 * Validates search terms for LIKE/ILIKE queries
 * Rejects wildcard characters to prevent injection
 */
export const searchTermSchema = z.string()
  .max(200, { message: 'Search term too long' })
  .regex(/^[^%_]*$/, { message: 'Wildcard characters not allowed in search' })
  .transform((val) => val.trim())
  .pipe(
    z.string().min(1, { message: 'Search term cannot be empty' })
  );

/**
 * Escape wildcard characters for LIKE/ILIKE patterns
 * This is a secondary defense; validation should reject wildcards
 * @param {string} pattern - The pattern to escape
 * @returns {string} - Escaped pattern
 */
export function escapeLikePattern(pattern) {
  if (typeof pattern !== 'string') {
    throw new Error('Pattern must be a string');
  }
  // Escape backslash, percent, and underscore
  return pattern.replace(/[%_\\]/g, '\\$&');
}

/**
 * Plan Type Validation Schema
 */
export const planTypeSchema = z.enum(['free', 'plus', 'pro'], {
  errorMap: () => ({ message: 'Invalid plan type' })
});

/**
 * Subscription Type Validation Schema (for rewards)
 */
export const subscriptionTypeSchema = z.enum(['plus', 'pro'], {
  errorMap: () => ({ message: 'Invalid subscription type' })
});

/**
 * Positive Integer Validation Schema
 */
export const positiveIntegerSchema = z.coerce.number()
  .int({ message: 'Must be an integer' })
  .nonnegative({ message: 'Must be non-negative' })
  .max(1000000, { message: 'Value too large' });

/**
 * Knowledge Points Validation Schema
 */
export const knowledgePointsSchema = positiveIntegerSchema.max(999999);

/**
 * Name Validation Schema
 */
export const nameSchema = z.string()
  .min(1, { message: 'Name cannot be empty' })
  .max(100, { message: 'Name too long' })
  .regex(/^[\p{L}\p{N}\s._-]+$/u, { message: 'Invalid characters in name' });

/**
 * Title Validation Schema
 */
export const titleSchema = z.string()
  .min(1, { message: 'Title cannot be empty' })
  .max(200, { message: 'Title too long' });

/**
 * Content Validation Schema
 */
export const contentSchema = z.string()
  .min(1, { message: 'Content cannot be empty' })
  .max(50000, { message: 'Content too long' });

/**
 * Date String Validation Schema (YYYY-MM-DD)
 */
export const dateStringSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  { message: 'Invalid date format (expected YYYY-MM-DD)' }
);

/**
 * ISO Date String Validation Schema
 */
export const isoDateSchema = z.string().datetime({
  message: 'Invalid ISO date format'
});

/**
 * Allowed sort columns (allowlist for ORDER BY)
 * Add new columns here as needed
 * This is an allowlist to prevent SQL injection via ORDER BY
 */
export const ALLOWED_SORT_COLUMNS = [
  'created_at',
  'updated_at',
  'date',
  'joined_at',
  'course_category',
  'course_name',
  'title',
  'last_active_at',
  'last_seen',
];

/**
 * Sort Column Validation Schema
 * Uses allowlist to prevent SQL injection
 */
export const sortColumnSchema = z.enum(ALLOWED_SORT_COLUMNS, {
  errorMap: () => ({ message: 'Invalid sort column' })
});

/**
 * Sort Direction Validation Schema
 */
export const sortDirectionSchema = z.enum(['asc', 'desc'], {
  errorMap: () => ({ message: 'Invalid sort direction' })
});

/**
 * Username Validation Schema
 */
export const usernameSchema = z.string()
  .min(3, { message: 'Username must be at least 3 characters' })
  .max(30, { message: 'Username too long' })
  .regex(/^[a-zA-Z0-9_]+$/, { message: 'Username can only contain letters, numbers, and underscores' })
  .transform((val) => val.toLowerCase().trim());

/**
 * Email Validation Schema
 */
export const emailSchema = z.string()
  .email({ message: 'Invalid email format' })
  .max(255, { message: 'Email too long' })
  .transform((val) => val.toLowerCase().trim());

/**
 * Community ID Validation Schema
 */
export const communityIdSchema = uuidSchema;

/**
 * Discussion ID Validation Schema
 */
export const discussionIdSchema = uuidSchema;

/**
 * Friend ID Validation Schema
 */
export const friendIdSchema = uuidSchema;

/**
 * Validation helper function
 * Wraps Zod validation with error handling
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @param {any} data - Data to validate
 * @returns {object} - { success: boolean, data?: any, error?: string }
 */
export function validateInput(schema, data) {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0]?.message || 'Validation failed'
      };
    }
    return {
      success: false,
      error: error.message || 'Validation failed'
    };
  }
}

/**
 * Middleware helper for Express
 * Validates request parameter/query/body against schema
 * @param {z.ZodSchema} schema - Schema to validate against
 * @param {string} source - Source of data: 'params', 'query', or 'body'
 * @returns {Function} - Express middleware
 */
export function validateRequest(schema, source = 'body') {
  return (req, res, next) => {
    const validation = validateInput(schema, req[source]);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }
    
    // Replace with validated data
    req[source] = validation.data;
    next();
  };
}

