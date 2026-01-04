# API Keys Security Audit

## 🚨 CRITICAL SECURITY ISSUES FOUND

### 1. **CRITICAL: Hardcoded OpenAI API Key in Backend**

**Location:** `backend/server.js:29`

```javascript
const OPENAI_API_KEY = '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';
```

**Risk Level:** 🔴 **CRITICAL**

**Impact:**
- Anyone with access to the code repository can see the API key
- If the repository is public or shared, the key is exposed
- Can lead to unauthorized API usage and financial loss
- Key cannot be easily rotated without code changes

**Recommendation:**
```javascript
// ❌ REMOVE THIS:
const OPENAI_API_KEY = 'sk-proj-...';

// ✅ USE THIS INSTEAD:
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}
```

**Action Required:** 
1. Move key to `.env` file (already in `.gitignore`)
2. Remove hardcoded key from code
3. **IMMEDIATELY ROTATE THE API KEY** in OpenAI dashboard
4. Add key to `.env` file

---

### 2. **CRITICAL: Hardcoded Supabase Service Key in Backend**

**Location:** `backend/server.js:38`

```javascript
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2c3B3c2tsdXFrcWVuaXd0b3FmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzMTMxMjksImV4cCI6MjA2ODg4OTEyOX0.JzU-bMUQM8K-MFER4c2Fybuo_orgSUAzeGSHnzCjeFU';
```

**Risk Level:** 🔴 **CRITICAL**

**Impact:**
- Service key has admin-level access to Supabase
- Can bypass Row Level Security (RLS)
- Can read/write/delete any data in the database
- If exposed, attacker has full database access

**Note:** The fallback key appears to be an `anon` key (based on the JWT payload showing `"role":"anon"`), but it's still a security risk to hardcode it.

**Recommendation:**
```javascript
// ❌ REMOVE THIS:
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '...hardcoded...';

// ✅ USE THIS INSTEAD:
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_SERVICE_KEY) {
  throw new Error('SUPABASE_SERVICE_KEY environment variable is required');
}
```

**Action Required:**
1. Remove hardcoded fallback key
2. Ensure `SUPABASE_SERVICE_KEY` is set in `.env`
3. If using anon key as fallback, remove it (use service key only)
4. Consider rotating Supabase keys if repository was ever public

---

### 3. **MEDIUM: Hardcoded Supabase Publishable Key in Client**

**Location:** `src/integrations/supabase/client.ts:6`

```typescript
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2c3B3c2tsdXFrcWVuaXd0b3FmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzMTMxMjksImV4cCI6MjA2ODg4OTEyOX0.JzU-bMUQM8K-MFER4c2Fybuo_orgSUAzeGSHnzCjeFU";
```

**Risk Level:** 🟡 **MEDIUM**

**Impact:**
- Publishable keys are designed to be public (client-side)
- However, hardcoding them makes it harder to:
  - Use different keys for different environments
  - Rotate keys without code changes
  - Follow best practices

**Recommendation:**
```typescript
// ✅ USE ENVIRONMENT VARIABLES:
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://wvspwskluqkqeniwtoqf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

if (!SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('VITE_SUPABASE_ANON_KEY environment variable is required');
}
```

**Action Required:**
1. Move to environment variables (`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`)
2. Add to `.env` file
3. Update build process to use env vars

---

### 4. **LOW: Debug Logging Endpoints**

**Locations:** 
- `src/pages/Onboarding.tsx:80`
- `src/pages/ProtectedRoute.tsx:189`

```typescript
fetch('http://127.0.0.1:7242/ingest/f2529eb3-e679-4510-9711-1234f7735f6e', {...})
```

**Risk Level:** 🟢 **LOW** (if localhost only)

**Impact:**
- Appears to be a debug/analytics endpoint
- Only accessible on localhost (127.0.0.1)
- UUID in URL suggests it's for development/debugging

**Recommendation:**
- Remove before production deployment
- Or gate behind `NODE_ENV !== 'production'` check
- Ensure this endpoint is not accessible in production builds

---

## Summary of Issues

| Issue | Location | Risk | Status |
|-------|----------|------|--------|
| Hardcoded OpenAI API Key | `backend/server.js:29` | 🔴 CRITICAL | **MUST FIX** |
| Hardcoded Supabase Service Key | `backend/server.js:38` | 🔴 CRITICAL | **MUST FIX** |
| Hardcoded Supabase Publishable Key | `src/integrations/supabase/client.ts:6` | 🟡 MEDIUM | Should Fix |
| Debug Logging Endpoints | `src/pages/Onboarding.tsx`, `src/pages/ProtectedRoute.tsx` | 🟢 LOW | Review |

---

## Immediate Action Items

### 🔴 Priority 1: Critical (Do Immediately)

1. **Rotate OpenAI API Key**
   - Go to https://platform.openai.com/api-keys
   - Revoke the exposed key: `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`
   - Create a new key
   - Add to `.env` file

2. **Fix Backend Server Code**
   - Remove hardcoded OpenAI key
   - Remove hardcoded Supabase service key fallback
   - Use environment variables only

3. **Check Repository Access**
   - If repository is/was public, assume keys are compromised
   - Rotate all exposed keys
   - Review git history for key exposure

### 🟡 Priority 2: Medium (Do Soon)

4. **Move Supabase Keys to Environment Variables**
   - Update `src/integrations/supabase/client.ts`
   - Use `VITE_` prefix for Vite environment variables
   - Update build documentation

### 🟢 Priority 3: Low (Review)

5. **Remove Debug Endpoints**
   - Remove or gate debug logging endpoints
   - Ensure they don't ship to production

---

## Code Fixes

### Fix 1: Backend Server (backend/server.js)

```javascript
// ❌ REMOVE THESE LINES:
const OPENAI_API_KEY = 'sk-proj-...';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJ...';

// ✅ REPLACE WITH:
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}

const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_SERVICE_KEY) {
  throw new Error('SUPABASE_SERVICE_KEY environment variable is required');
}
```

### Fix 2: Frontend Client (src/integrations/supabase/client.ts)

```typescript
// ❌ REMOVE:
const SUPABASE_URL = "https://wvspwskluqkqeniwtoqf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJ...";

// ✅ REPLACE WITH:
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://wvspwskluqkqeniwtoqf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('VITE_SUPABASE_ANON_KEY environment variable is required');
}
```

### Fix 3: Environment Variables (.env files)

**backend/.env:**
```env
OPENAI_API_KEY=your_new_openai_key_here
SUPABASE_URL=https://wvspwskluqkqeniwtoqf.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key_here
```

**.env (root for frontend):**
```env
VITE_SUPABASE_URL=https://wvspwskluqkqeniwtoqf.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

---

## Verification Checklist

- [ ] OpenAI API key rotated and removed from code
- [ ] Supabase service key removed from code
- [ ] All keys moved to environment variables
- [ ] `.env` files added to `.gitignore` (verify)
- [ ] `.env.example` files created with placeholder values
- [ ] Debug endpoints removed or gated
- [ ] Repository access reviewed
- [ ] Git history checked for key exposure
- [ ] Documentation updated with environment variable requirements

---

## Prevention

1. **Use Environment Variables Always**
   - Never hardcode secrets in code
   - Use `.env` files for local development
   - Use secure secret management in production (AWS Secrets Manager, etc.)

2. **Gitignore Check**
   - Ensure `.env` is in `.gitignore`
   - Never commit `.env` files
   - Use `.env.example` for documentation

3. **Code Review**
   - Add pre-commit hooks to detect secrets
   - Use tools like `git-secrets` or `truffleHog`
   - Review all commits for secret exposure

4. **Monitoring**
   - Monitor API usage for unusual patterns
   - Set up alerts for unexpected API calls
   - Regularly rotate keys

---

## Additional Resources

- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/platform/security)
- [OpenAI API Key Security](https://platform.openai.com/docs/guides/safety-best-practices)


