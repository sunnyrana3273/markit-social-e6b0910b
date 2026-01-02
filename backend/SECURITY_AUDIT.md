# SQL Injection Security Audit

## Executive Summary

This document provides a comprehensive security audit for SQL injection vulnerabilities, including validation schemas, safe query patterns, and test cases.

## Current Security Status

✅ **Good Practices Found:**
- Supabase client automatically parameterizes all queries
- Database functions use parameterized queries
- No raw SQL string concatenation found
- ORDER BY clauses use hardcoded column names

⚠️ **Areas Requiring Attention:**
- Input validation schemas needed for all user-controlled inputs
- Database function parameters should be validated
- Test cases needed to verify SQL injection protection

---

## Part A: Validation Schemas

All user-controlled inputs that interact with the database must be validated using these schemas.

### 1. UUID Validation

```typescript
import { z } from 'zod';

const uuidSchema = z.string().uuid({
  message: 'Invalid UUID format'
});

// Usage
const userId = uuidSchema.parse(req.body.user_id);
```

### 2. User ID Validation (must match authenticated user or be validated)

```typescript
const userIdSchema = z.string().uuid().refine(
  (id) => id === req.user.id || isAdmin(req.user),
  { message: 'Unauthorized user ID access' }
);
```

### 3. Community ID Validation

```typescript
const communityIdSchema = z.string().uuid({
  message: 'Invalid community ID format'
});
```

### 4. Discussion ID Validation

```typescript
const discussionIdSchema = z.string().uuid({
  message: 'Invalid discussion ID format'
});
```

### 5. Search Term Validation (for LIKE/ILIKE queries)

```typescript
const searchTermSchema = z.string()
  .max(200, { message: 'Search term too long' })
  .regex(/^[^%_]*$/, { message: 'Wildcard characters not allowed in search' })
  .transform((val) => val.trim())
  .pipe(
    z.string().min(1, { message: 'Search term cannot be empty' })
  );

// For LIKE queries, escape wildcards:
function escapeLikePattern(pattern: string): string {
  return pattern.replace(/[%_\\]/g, '\\$&');
}

// Usage:
const searchTerm = searchTermSchema.parse(req.query.search);
const escapedTerm = escapeLikePattern(searchTerm);
// Then use in query: .ilike(`%${escapedTerm}%`)
```

### 6. Plan Type Validation (for subscriptions)

```typescript
const planTypeSchema = z.enum(['free', 'plus', 'pro'], {
  errorMap: () => ({ message: 'Invalid plan type' })
});
```

### 7. Subscription Type Validation (for rewards)

```typescript
const subscriptionTypeSchema = z.enum(['plus', 'pro'], {
  errorMap: () => ({ message: 'Invalid subscription type' })
});
```

### 8. Integer Validation (for knowledge points, limits, etc.)

```typescript
const positiveIntegerSchema = z.coerce.number()
  .int({ message: 'Must be an integer' })
  .nonnegative({ message: 'Must be non-negative' })
  .max(1000000, { message: 'Value too large' });

const knowledgePointsSchema = positiveIntegerSchema.max(999999);
```

### 9. Text Field Validation (for names, titles, content)

```typescript
const nameSchema = z.string()
  .min(1, { message: 'Name cannot be empty' })
  .max(100, { message: 'Name too long' })
  .regex(/^[\p{L}\p{N}\s._-]+$/u, { message: 'Invalid characters in name' });

const titleSchema = z.string()
  .min(1, { message: 'Title cannot be empty' })
  .max(200, { message: 'Title too long' });

const contentSchema = z.string()
  .min(1, { message: 'Content cannot be empty' })
  .max(50000, { message: 'Content too long' });
```

### 10. Date/Date String Validation

```typescript
const dateStringSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  { message: 'Invalid date format (expected YYYY-MM-DD)' }
);

const isoDateSchema = z.string().datetime({
  message: 'Invalid ISO date format'
});
```

### 11. Sort Order Validation (for ORDER BY)

```typescript
// Allowed column names (allowlist)
const ALLOWED_SORT_COLUMNS = [
  'created_at',
  'updated_at',
  'date',
  'joined_at',
  'course_category',
  'course_name',
] as const;

const sortColumnSchema = z.enum(ALLOWED_SORT_COLUMNS, {
  errorMap: () => ({ message: 'Invalid sort column' })
});

const sortDirectionSchema = z.enum(['asc', 'desc'], {
  errorMap: () => ({ message: 'Invalid sort direction' })
});

// Usage:
const sortBy = sortColumnSchema.parse(req.query.sort_by || 'created_at');
const sortDir = sortDirectionSchema.parse(req.query.sort_dir || 'desc');
// Then use: .order(sortBy, { ascending: sortDir === 'asc' })
```

### 12. Username Validation

```typescript
const usernameSchema = z.string()
  .min(3, { message: 'Username must be at least 3 characters' })
  .max(30, { message: 'Username too long' })
  .regex(/^[a-zA-Z0-9_]+$/, { message: 'Username can only contain letters, numbers, and underscores' })
  .transform((val) => val.toLowerCase().trim());
```

### 13. Email Validation

```typescript
const emailSchema = z.string()
  .email({ message: 'Invalid email format' })
  .max(255, { message: 'Email too long' })
  .transform((val) => val.toLowerCase().trim());
```

---

## Part B: Safe Query Code Examples

### Example 1: User Profile Query (Safe)

```typescript
// ✅ SAFE: Uses parameterized query via Supabase client
import { z } from 'zod';

const userIdSchema = z.string().uuid();

app.get('/api/user/:id', requireUser(), async (req, res) => {
  try {
    // Validate input
    const userId = userIdSchema.parse(req.params.id);
    
    // Verify authorization
    if (userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Safe query - Supabase automatically parameterizes
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, image_url')
      .eq('id', userId)  // ✅ Parameterized
      .single();
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: error.message });
  }
});
```

### Example 2: Search with LIKE Pattern (Safe)

```typescript
// ✅ SAFE: Escapes wildcards before using in LIKE query
import { z } from 'zod';

const searchTermSchema = z.string()
  .max(200)
  .regex(/^[^%_]*$/, { message: 'Wildcard characters not allowed' })
  .transform((val) => val.trim())
  .pipe(z.string().min(1));

function escapeLikePattern(pattern: string): string {
  return pattern.replace(/[%_\\]/g, '\\$&');
}

app.get('/api/search-discussions', requireUser(), async (req, res) => {
  try {
    // Validate input
    const searchTerm = searchTermSchema.parse(req.query.q);
    
    // Escape wildcards for LIKE query
    const escapedTerm = escapeLikePattern(searchTerm);
    
    // Safe query - Supabase parameterizes the escaped term
    const { data, error } = await supabase
      .from('community_discussions')
      .select('*')
      .ilike('title', `%${escapedTerm}%`)  // ✅ Parameterized
      .limit(50);
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: error.message });
  }
});
```

### Example 3: Dynamic ORDER BY (Safe with Allowlist)

```typescript
// ✅ SAFE: Uses allowlist for column names
import { z } from 'zod';

const ALLOWED_SORT_COLUMNS = ['created_at', 'updated_at', 'title'] as const;
const sortColumnSchema = z.enum(ALLOWED_SORT_COLUMNS);
const sortDirectionSchema = z.enum(['asc', 'desc']);

app.get('/api/discussions', requireUser(), async (req, res) => {
  try {
    // Validate sort parameters
    const sortBy = sortColumnSchema.parse(req.query.sort_by || 'created_at');
    const sortDir = sortDirectionSchema.parse(req.query.sort_dir || 'desc');
    
    // Safe query - column name from allowlist, direction validated
    const { data, error } = await supabase
      .from('community_discussions')
      .select('*')
      .order(sortBy, { ascending: sortDir === 'asc' });  // ✅ Column from allowlist
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: error.message });
  }
});
```

### Example 4: RPC Function Call (Safe)

```typescript
// ✅ SAFE: RPC parameters are automatically parameterized
import { z } from 'zod';

const userIdSchema = z.string().uuid();

app.post('/api/track-usage', requireUser(), async (req, res) => {
  try {
    // Validate input
    const userId = userIdSchema.parse(req.body.user_id || req.user.id);
    
    // Verify user can only track their own usage (unless admin)
    if (userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Safe RPC call - parameters are automatically parameterized
    const { data, error } = await supabase.rpc('track_api_usage', {
      p_user_id: userId  // ✅ Parameterized by Supabase
    });
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: error.message });
  }
});
```

### Example 5: Database Function with Input Validation (PostgreSQL)

```sql
-- ✅ SAFE: Validates input and uses parameterized queries
CREATE OR REPLACE FUNCTION public.track_api_usage(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date;
  v_count integer;
  v_result jsonb;
BEGIN
  -- Validate that the user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Invalid user_id: %', p_user_id;
  END IF;
  
  v_today := CURRENT_DATE;
  
  -- ✅ SAFE: Uses parameterized INSERT with VALUES clause
  INSERT INTO public.api_usage (user_id, date, query_count)
  VALUES (p_user_id, v_today, 1)
  ON CONFLICT (user_id, date) 
  DO UPDATE SET 
    query_count = api_usage.query_count + 1,
    updated_at = now()
  RETURNING query_count, date INTO v_count, v_today;
  
  -- Return as JSON
  v_result := jsonb_build_object(
    'query_count', v_count,
    'date', v_today
  );
  
  RETURN v_result;
END;
$$;
```

### Example 6: ❌ UNSAFE Pattern (DO NOT USE)

```typescript
// ❌ NEVER DO THIS: String concatenation in SQL
const userId = req.params.id;  // No validation!
const query = `SELECT * FROM profiles WHERE id = '${userId}'`;
// ⚠️ SQL INJECTION VULNERABILITY!

// ❌ NEVER DO THIS: Dynamic table/column names from user input
const tableName = req.query.table;  // No validation!
const { data } = await supabase.from(tableName).select('*');
// ⚠️ Can be exploited to access any table!

// ❌ NEVER DO THIS: ORDER BY with user input
const sortBy = req.query.sort;  // No validation!
const { data } = await supabase.from('discussions').order(sortBy);
// ⚠️ SQL INJECTION if sortBy contains SQL fragments!

// ✅ INSTEAD: Use allowlists and validation (see Example 3)
```

---

## Part C: SQL Injection Test Cases

All test cases must verify that SQL injection payloads are treated as literal values and cannot change the query structure.

### Test Framework Setup

```typescript
import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app from '../server.js';

describe('SQL Injection Protection Tests', () => {
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    // Setup: Create test user and get auth token
    // ... (implementation depends on your auth setup)
  });

  // Test cases below...
});
```

### Test Case 1: UUID Parameter Injection

```typescript
describe('UUID Parameter Injection Tests', () => {
  const sqlInjectionPayloads = [
    "'; DROP TABLE profiles; --",
    "' OR '1'='1",
    "admin'--",
    "') UNION SELECT * FROM profiles WHERE '1'='1",
    "1' UNION SELECT NULL, NULL, NULL--",
    "\\'; DROP TABLE profiles; --",
    "'); DELETE FROM profiles; --",
    "' OR 1=1--",
    "' UNION SELECT password FROM users--",
  ];

  it.each(sqlInjectionPayloads)(
    'should reject SQL injection in user ID parameter: %s',
    async (payload) => {
      const response = await request(app)
        .get(`/api/user/${encodeURIComponent(payload)}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400); // Should return 400 (validation error), not 500 or execute SQL
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).not.toContain('syntax error');
      expect(response.body.error).not.toContain('unexpected');
    }
  );
});
```

**Expected Result:** All requests should return 400 (Bad Request) with validation error, NOT execute SQL.

### Test Case 2: Search Term Injection (LIKE Queries)

```typescript
describe('Search Term Injection Tests', () => {
  const sqlInjectionPayloads = [
    "' OR '1'='1",
    "'; DROP TABLE discussions; --",
    "%'; DELETE FROM discussions; --",
    "_'; UPDATE profiles SET role='admin'--",
    "' UNION SELECT * FROM profiles--",
    "\\'; DROP TABLE discussions; --",
    "' OR 1=1--",
  ];

  it.each(sqlInjectionPayloads)(
    'should escape wildcards and reject SQL injection in search: %s',
    async (payload) => {
      const response = await request(app)
        .get('/api/search-discussions')
        .query({ q: payload })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400); // Should return 400 (validation error)
      
      expect(response.body).toHaveProperty('error');
      // Verify no SQL was executed
      // (Add database state verification if needed)
    }
  );
});
```

**Expected Result:** Requests should either:
- Return 400 if wildcards are rejected by validation
- Return empty results if wildcards are escaped (no SQL execution)

### Test Case 3: ORDER BY Injection

```typescript
describe('ORDER BY Injection Tests', () => {
  const sqlInjectionPayloads = [
    "created_at; DROP TABLE discussions; --",
    "created_at) UNION SELECT * FROM profiles--",
    "1; DELETE FROM discussions; --",
    "created_at, (SELECT * FROM profiles)--",
    "created_at; UPDATE profiles SET role='admin'--",
  ];

  it.each(sqlInjectionPayloads)(
    'should reject SQL injection in ORDER BY: %s',
    async (payload) => {
      const response = await request(app)
        .get('/api/discussions')
        .query({ sort_by: payload })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400); // Should return 400 (validation error)
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid sort column');
    }
  );
});
```

**Expected Result:** All requests should return 400 with "Invalid sort column" error.

### Test Case 4: RPC Function Parameter Injection

```typescript
describe('RPC Function Parameter Injection Tests', () => {
  const sqlInjectionPayloads = [
    "'; DROP TABLE api_usage; --",
    "' OR '1'='1",
    "') UNION SELECT * FROM profiles--",
    "\\'; DELETE FROM api_usage; --",
  ];

  it.each(sqlInjectionPayloads)(
    'should reject SQL injection in RPC parameter: %s',
    async (payload) => {
      const response = await request(app)
        .post('/api/track-usage')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ user_id: payload })
        .expect(400); // Should return 400 (validation error)
      
      expect(response.body).toHaveProperty('error');
    }
  );
});
```

**Expected Result:** All requests should return 400 (UUID validation error).

### Test Case 5: Text Field Injection (Names, Titles)

```typescript
describe('Text Field Injection Tests', () => {
  const sqlInjectionPayloads = [
    "'; DROP TABLE profiles; --",
    "' OR '1'='1",
    "'); DELETE FROM discussions; --",
    "' UNION SELECT * FROM profiles--",
    "\\'; UPDATE profiles SET role='admin'--",
  ];

  it.each(sqlInjectionPayloads)(
    'should safely handle SQL injection in text field: %s',
    async (payload) => {
      const response = await request(app)
        .post('/api/create-discussion')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: payload,
          content: 'Test content',
          community_id: 'valid-uuid-here'
        })
        .expect((res) => {
          // Should either reject (400) or accept as literal text (200)
          expect([200, 400]).toContain(res.status);
        });
      
      // If accepted, verify it was stored as literal text
      if (response.status === 200) {
        expect(response.body.title).toBe(payload); // Stored as-is, not executed
      }
    }
  );
});
```

**Expected Result:** Text should be stored as literal values, not executed as SQL.

### Test Case 6: Integer Parameter Injection

```typescript
describe('Integer Parameter Injection Tests', () => {
  const sqlInjectionPayloads = [
    "1; DROP TABLE profiles; --",
    "1 OR 1=1",
    "1 UNION SELECT * FROM profiles--",
    "1; DELETE FROM api_usage; --",
  ];

  it.each(sqlInjectionPayloads)(
    'should reject SQL injection in integer parameter: %s',
    async (payload) => {
      const response = await request(app)
        .post('/api/redeem-subscription')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          subscription_type: 'plus',
          knowledge_points_cost: payload
        })
        .expect(400); // Should return 400 (validation error)
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('integer');
    }
  );
});
```

**Expected Result:** All requests should return 400 with integer validation error.

### Test Case 7: Array Parameter Injection (for IN clauses)

```typescript
describe('Array Parameter Injection Tests', () => {
  it('should safely handle array of IDs', async () => {
    const maliciousPayloads = [
      ["'; DROP TABLE profiles; --"],
      ["' OR '1'='1"],
      ["valid-uuid", "'; DELETE FROM profiles; --"],
    ];

    for (const payload of maliciousPayloads) {
      const response = await request(app)
        .post('/api/get-multiple-profiles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ user_ids: payload })
        .expect((res) => {
          expect([200, 400]).toContain(res.status);
        });
      
      // If 400, verify it's a validation error, not SQL error
      if (response.status === 400) {
        expect(response.body.error).not.toContain('syntax error');
      }
    }
  });
});
```

**Expected Result:** Invalid UUIDs should return 400, valid UUIDs should work safely.

### Test Case 8: Database Function Direct Test

```sql
-- Test SQL injection in PostgreSQL function directly
-- These should all raise exceptions without executing malicious SQL

-- Test 1: Malicious UUID
SELECT public.track_api_usage('''; DROP TABLE profiles; --');
-- Expected: ERROR: invalid input syntax for type uuid

-- Test 2: SQL injection in text parameter
SELECT public.create_call_notification(
  'valid-uuid',
  'valid-uuid',
  '''; DROP TABLE notifications; --'
);
-- Expected: Function executes, but text is stored as literal (no SQL execution)

-- Test 3: SQL injection attempt in function
-- (Should not be possible if function uses parameterized queries correctly)
```

### Test Case 9: End-to-End Query Structure Verification

```typescript
describe('Query Structure Verification', () => {
  it('should maintain query structure regardless of payload', async () => {
    // This test verifies that malicious payloads don't change the query structure
    // by checking that the response format remains consistent
    
    const normalResponse = await request(app)
      .get('/api/discussions')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);
    
    const normalStructure = Object.keys(normalResponse.body[0] || {});
    
    const maliciousPayloads = [
      "'; DROP TABLE discussions; --",
      "' OR '1'='1",
      "') UNION SELECT * FROM profiles--",
    ];
    
    for (const payload of maliciousPayloads) {
      const response = await request(app)
        .get(`/api/discussions`)
        .query({ search: payload })
        .set('Authorization', `Bearer ${authToken}`)
        .expect((res) => {
          // Should not crash or change response structure
          expect([200, 400]).toContain(res.status);
        });
      
      if (response.status === 200 && Array.isArray(response.body)) {
        // Verify response structure is unchanged
        if (response.body.length > 0) {
          const responseStructure = Object.keys(response.body[0]);
          expect(responseStructure).toEqual(normalStructure);
        }
      }
    }
  });
});
```

---

## Implementation Checklist

- [ ] Implement validation schemas using Zod for all user inputs
- [ ] Add validation middleware to all API endpoints
- [ ] Verify all database queries use Supabase client (no raw SQL)
- [ ] Add allowlists for dynamic column/table names (ORDER BY, etc.)
- [ ] Escape wildcards in LIKE/ILIKE queries
- [ ] Add input length limits to prevent DoS
- [ ] Implement rate limiting on all endpoints
- [ ] Add logging for validation failures (security monitoring)
- [ ] Write and run all SQL injection test cases
- [ ] Code review all database functions for parameterization
- [ ] Document any exceptions or special cases

---

## Security Best Practices Summary

1. **Always use parameterized queries** (Supabase client does this automatically)
2. **Validate all user input** using strict schemas before database interaction
3. **Use allowlists** for dynamic identifiers (table/column names, ORDER BY)
4. **Escape wildcards** for LIKE/ILIKE patterns (or reject them)
5. **Never use string concatenation** for SQL queries
6. **Validate data types** (UUID, integer, text, etc.)
7. **Set length limits** on all text inputs
8. **Verify authorization** before database operations
9. **Log security events** (failed validations, suspicious patterns)
10. **Test with SQL injection payloads** regularly

---

## Installation Requirements

To use the validation schemas, install the required dependency:

```bash
npm install zod
```

The validation schemas in `backend/lib/validation.js` use Zod for schema validation. If you prefer a different validation library, adapt the schemas accordingly.

---

## Additional Resources

- [OWASP SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/database/postgres/security)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/security.html)
- [Zod Documentation](https://zod.dev/)

