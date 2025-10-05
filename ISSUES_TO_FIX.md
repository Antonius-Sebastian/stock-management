# Issues to Fix & Work Remaining

**Generated:** October 4, 2025
**Status:** Review Required Before Production
**Priority:** Address before first deployment

---

## 🔴 CRITICAL - Must Fix Before Production

### 1. ✅ FIXED: .gitignore Blocking .env.example

**Status:** ✅ **RESOLVED**
**Priority:** Critical
**Impact:** Development Setup

**Problem:**
The `.gitignore` file had `.env*` pattern which blocked `.env.example` from being committed to version control. This meant new developers couldn't see the environment variable template.

**Fix Applied:**
```diff
- .env*
+ .env
+ .env.local
+ .env.development.local
+ .env.test.local
+ .env.production.local
+
+ # Keep .env.example in git
+ !.env.example
```

**Verification:** Run `git status` - `.env.example` should now be tracked.

---

## 🟡 HIGH PRIORITY - Should Fix Before Production

### 2. Manual Testing Not Yet Completed

**Status:** ⏳ **PENDING**
**Priority:** High
**Impact:** Production Readiness
**Estimated Time:** 2-3 hours

**What Needs Testing:**
According to `STATUS.md`, the system is marked "Production Ready" but manual testing is still pending:

1. **Critical User Flows** (from `docs/guides/TESTING_GUIDE.md`):
   - User authentication (login/logout)
   - Raw material CRUD operations
   - Stock entry (IN/OUT) with validation
   - Batch creation with multi-material support
   - Batch deletion with stock restoration
   - Report generation and filtering
   - Inline cell editing in reports
   - Excel export functionality
   - Movement history accuracy

2. **Security Testing:**
   - Verify API endpoints require authentication
   - Test unauthorized access returns 401
   - Verify session timeout works
   - Test password change functionality

3. **Data Integrity Testing:**
   - Verify stock movements create audit trail
   - Test running balance calculations
   - Verify batch deletion restores stock correctly
   - Test negative stock prevention

**How to Fix:**
```bash
# Follow the comprehensive testing guide
open docs/guides/TESTING_GUIDE.md

# Run through all 8 test suites (80+ scenarios)
# Document results in a test report
```

**Acceptance Criteria:**
- All critical test scenarios pass
- No P0/P1 bugs discovered
- Test report document created
- Edge cases verified

---

### 3. Production Environment Not Configured

**Status:** ⏳ **PENDING**
**Priority:** High
**Impact:** Deployment Blocked
**Estimated Time:** 30 minutes

**What's Missing:**

1. **Production Secrets Not Generated:**
   ```bash
   # Current .env has development secrets
   NEXTAUTH_SECRET="dGcfdh+lXKgiXDA+jPxgIYwe4c8F/ebaMrtaJUbmZiA="

   # Need NEW production secrets
   openssl rand -base64 32
   ```

2. **Production Database Not Set:**
   - No production DATABASE_URL configured
   - Need Supabase production project or production PostgreSQL
   - Migration not run on production database

3. **Production URL Not Set:**
   - NEXTAUTH_URL still points to localhost
   - Need actual production domain

**How to Fix:**
Follow **Section 2** of `docs/guides/DEPLOYMENT.md`:

```bash
# 1. Generate new production secret
openssl rand -base64 32

# 2. Create .env.production
cp .env.example .env.production

# 3. Update with production values
# - DATABASE_URL (production database)
# - NEXTAUTH_SECRET (newly generated)
# - NEXTAUTH_URL (https://yourdomain.com)
# - AUTH_SECRET (same as NEXTAUTH_SECRET)

# 4. Set environment variables in hosting platform
# (Vercel/Netlify/VPS)
```

**Acceptance Criteria:**
- Unique production secrets generated
- Production database configured
- Environment variables set in hosting platform
- Test connection to production database

---

### 4. Default User Passwords Not Changed

**Status:** ⚠️ **SECURITY RISK**
**Priority:** High
**Impact:** Security
**Estimated Time:** 5 minutes

**Problem:**
After running `npx prisma db seed`, three users are created with default password `password123`:
- admin / password123
- factory / password123
- office / password123

**This is documented in:**
- README.md
- docs/QUICKSTART.md
- prisma/seed.ts

**How to Fix:**

**For Development:**
- Acceptable to keep defaults
- Add note in documentation

**For Production:**
```bash
# Option A: After first deployment
1. Login as admin
2. (Navigate to user management - when UI is built)
3. Change passwords

# Option B: Before seeding production
# Edit prisma/seed.ts to use secure passwords
# Or seed with only admin user
```

**Recommendation:**
- Add "⚠️ CHANGE PASSWORDS" note to deployment checklist
- Consider creating only admin user in production seed
- Force password change on first login (future enhancement)

**Acceptance Criteria:**
- Default passwords changed in production
- Password change logged/documented
- Update docs to reflect production password policy

---

## 🟢 MEDIUM PRIORITY - Can Fix After Initial Deployment

### 5. Missing User Management UI

**Status:** 📋 **DOCUMENTED AS LIMITATION**
**Priority:** Medium
**Impact:** User Experience
**Estimated Time:** 4-6 hours

**Current State:**
- API endpoints exist (`/api/users/*`)
- All endpoints require authentication ✅
- No UI pages for user management

**Workaround:**
Users can be managed via API using cURL or Postman:
```bash
# List users
curl -X GET http://localhost:3000/api/users -b cookies.txt

# Create user
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"username":"newuser","password":"password123","name":"New User","role":"OFFICE"}'
```

**Documented In:**
- `docs/reference/KNOWN_ISSUES.md` - "No User Management UI" section
- `docs/reference/API.md` - Users section
- `docs/reference/ENHANCEMENT_PLAN.md` - Phase 1

**Recommendation:**
- Acceptable for MVP launch
- Add to Phase 1 post-MVP roadmap
- Admins can use API for now

---

### 6. RBAC Roles Not Enforced

**Status:** 📋 **DOCUMENTED AS LIMITATION**
**Priority:** Medium
**Impact:** Security (Low for MVP)
**Estimated Time:** 2-3 hours

**Current State:**
- User roles are stored in database (ADMIN, FACTORY, OFFICE)
- Authentication works ✅
- All authenticated users have full access (no role checks)

**Impact:**
- Factory staff can delete materials (shouldn't)
- Office staff can create batches (might be ok)
- No audit of who did what based on role

**Documented In:**
- `docs/reference/KNOWN_ISSUES.md` - "No Role-Based Access Control" section
- `STATUS.md` - Known Limitations

**How to Fix (Future):**
```typescript
// Example: In API routes
const session = await auth()
if (session.user.role !== 'ADMIN') {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

**Recommendation:**
- Acceptable for MVP if all users are trusted
- Document who has access
- Add to Phase 1 enhancement plan

---

### 7. Batch Materials Cannot Be Edited

**Status:** 📋 **DOCUMENTED AS DESIGN DECISION**
**Priority:** Medium
**Impact:** User Experience
**Estimated Time:** 6-8 hours (if implementing edit)

**Current State:**
- Batch materials are read-only after creation
- User must delete entire batch and recreate to fix mistakes
- This preserves audit trail integrity

**Documented In:**
- `docs/reference/KNOWN_ISSUES.md` - Issue #10 with detailed workarounds
- Edit dialog shows: "Raw materials cannot be modified after creation"

**Workarounds Available:**
1. Delete batch → recreates it with correct materials
2. Manual stock adjustment for small corrections

**Recommendation:**
- Acceptable for MVP
- Consider "Clone Batch" feature (easier than full edit)
- Fully document the workaround in user training

---

## 🔵 LOW PRIORITY - Minor Issues

### 8. ESLint Warnings (Intentional)

**Status:** ✅ **DOCUMENTED AS EXPECTED**
**Priority:** Low
**Impact:** None (intentional)

**Warnings:**
```
src/app/reports/page.tsx:93
  - Missing dependency: 'fetchReport'

src/components/stock/stock-entry-dialog.tsx:139
  - Missing dependency: 'fetchItems'
```

**Why Intentional:**
Adding these dependencies would cause infinite render loops. The current implementation is correct.

**Documented In:**
- `docs/reference/KNOWN_ISSUES.md` - ESLint Warning section
- Build output shows these as warnings, not errors

**Action:** None required.

---

### 9. No Error Monitoring Setup

**Status:** 💡 **RECOMMENDED FOR PRODUCTION**
**Priority:** Low (but recommended)
**Impact:** Debugging & Monitoring
**Estimated Time:** 30 minutes

**Current State:**
- No error tracking service configured
- Console errors only
- No production monitoring

**Recommendation:**
Set up Sentry or similar:
```bash
# Install Sentry
npm install @sentry/nextjs
npx @sentry/wizard -i nextjs

# Add to .env.production
SENTRY_DSN="your-dsn"
```

**Documented In:**
- `docs/guides/DEPLOYMENT.md` - Monitoring section
- `STATUS.md` - Recommended enhancements

**Benefits:**
- Catch production errors
- User session replay
- Performance monitoring
- Alert on critical errors

---

## 📋 Documentation Gaps (Minor)

### 10. No Backup/Restore Procedures Tested

**Status:** 📝 **DOCUMENTED BUT UNTESTED**
**Priority:** Low
**Impact:** Disaster Recovery

**Current State:**
- Backup procedures documented in `docs/guides/DEPLOYMENT.md`
- Not actually tested
- No restore verification

**Recommendation:**
```bash
# Before production, test:
1. Create backup: pg_dump > backup.sql
2. Drop database
3. Restore: psql < backup.sql
4. Verify data integrity
```

**Acceptance Criteria:**
- Successful backup created
- Successful restore verified
- Documented in operations manual

---

### 11. No Load Testing Performed

**Status:** 📊 **NOT TESTED**
**Priority:** Low (for MVP)
**Impact:** Performance Under Load

**Current State:**
- Tested with small datasets (< 500 materials)
- Not tested with:
  - Concurrent users
  - Large datasets (10,000+ movements)
  - Heavy report generation

**Recommendation:**
- Acceptable for MVP with small user base
- Monitor performance in production
- Add load testing before scaling

---

## ✅ Summary: What's Production Ready

### Already Working ✅
1. All core features implemented
2. Authentication secured (user management APIs protected)
3. All critical QA issues fixed
4. Build successful (no errors)
5. Database schema correct
6. Documentation comprehensive
7. .gitignore fixed
8. Seed script working

### Must Do Before Production 🔴
1. **Complete manual testing** (2-3 hours)
2. **Configure production environment** (30 min)
3. **Change default passwords** (5 min)

### Should Do Before Production 🟡
4. Set up error monitoring (30 min)
5. Test backup/restore (15 min)

### Can Wait for Post-MVP 🟢
6. User management UI
7. RBAC enforcement
8. Batch material editing
9. Load testing

---

## 🎯 Recommended Action Plan

### Week 1: Pre-Production
- [ ] Day 1-2: Manual testing (follow TESTING_GUIDE.md)
- [ ] Day 3: Fix any P0/P1 bugs found
- [ ] Day 4: Configure production environment
- [ ] Day 5: Deploy to staging, test, deploy to production

### Week 1 Post-Deployment:
- [ ] Change default passwords
- [ ] Set up error monitoring
- [ ] Monitor for issues
- [ ] Gather user feedback

### Week 2-4: Post-MVP Enhancements
- [ ] User management UI
- [ ] RBAC enforcement
- [ ] User-reported issues
- [ ] Performance optimization

---

## 📞 Questions to Answer

Before production deployment, clarify:

1. **User Count:**
   - How many concurrent users expected?
   - Single location or remote access?

2. **Data Volume:**
   - How many materials expected?
   - How many batches per day?
   - How long to keep history?

3. **Access Control:**
   - Are all users trusted?
   - Need RBAC immediately or can wait?
   - Who should be able to delete batches?

4. **Support:**
   - Who will handle user issues?
   - Who has access to database?
   - Backup schedule needed?

---

## 🏁 Current Status

**Code:** ✅ Ready (with fixes applied)
**Documentation:** ✅ Complete
**Testing:** ⏳ Pending
**Production Setup:** ⏳ Pending
**Deployment:** ⏳ Blocked by testing

**Overall:** **85% Ready** - Need manual testing + production config

---

**Report Generated:** October 4, 2025
**Next Review:** After manual testing complete
**Estimated Time to Production:** 3-4 hours
