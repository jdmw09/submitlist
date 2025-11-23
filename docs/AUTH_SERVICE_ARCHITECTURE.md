# Authentication Service Architecture

## Executive Summary

This document outlines the transition from the current basic email/password authentication to a modern, production-ready authentication service. This upgrade will provide enterprise-grade security, scalability, and user experience while reducing maintenance burden.

---

## Current State Analysis

### Existing Implementation (Updated v2.4.0)
- **Method**: Custom JWT-based email/password authentication
- **Database**: PostgreSQL users table with bcrypt password hashing
- **Email Service**: Mailgun integration for transactional emails
- **Current Features**:
  - Email verification with token-based flow
  - Password reset functionality via email
  - Admin user creation with pre-verification
  - Audit logging for admin actions
  - Username field (separate from email)
  - Account status management (active/suspended/deleted)
  - Role-based access control (member/admin/super_admin)
- **Remaining Limitations**:
  - No social login options
  - No MFA/2FA support
  - No OAuth2/OIDC compliance

### Security Concerns (Remaining)
1. No rate limiting on authentication endpoints
2. No account lockout after failed attempts
3. No session management/revocation (JWT-only)
4. No OAuth2/OIDC compliance
5. No MFA/2FA support

---

## Auth Service Comparison

### 1. Supabase Auth ⭐ **RECOMMENDED**

**Pros:**
- **Free tier**: 50,000 MAU (Monthly Active Users)
- **Open source**: Can self-host if needed
- **PostgreSQL native**: Seamless integration with existing DB
- **Built-in features**:
  - Email verification
  - Password reset
  - Magic links
  - Social auth (Google, GitHub, etc.)
  - Phone/SMS auth
  - MFA/2FA
  - Row Level Security (RLS)
  - Realtime subscriptions
- **Easy migration**: Can run alongside existing auth during transition
- **Admin dashboard**: User management UI
- **Pricing**: $25/month Pro plan (100,000 MAU)

**Cons:**
- Newer than competitors (but rapidly growing)
- Some advanced features require Pro plan

**Best For:**
- PostgreSQL-based apps
- Budget-conscious startups
- Teams wanting flexibility to self-host later

---

### 2. Auth0 by Okta

**Pros:**
- **Enterprise-grade**: Industry standard
- **Extensive features**: Everything you'd ever need
- **Excellent docs**: Best-in-class documentation
- **Compliance**: SOC 2, GDPR, HIPAA ready
- **Customization**: Highly customizable UI/UX
- **Built-in features**:
  - Universal Login
  - Passwordless auth
  - Social connections (40+)
  - Enterprise SSO (SAML, LDAP)
  - MFA
  - Anomaly detection
  - Bot detection
  - Advanced user management

**Cons:**
- **Expensive**: $240/month minimum for production
- **Complex**: Steeper learning curve
- **Vendor lock-in**: Harder to migrate away
- **Free tier**: Only 7,000 MAU

**Best For:**
- Enterprise applications
- Apps requiring extensive compliance
- Large user bases with budget

---

### 3. Firebase Authentication

**Pros:**
- **Free tier**: Generous limits
- **Easy integration**: Simple SDK
- **Google backing**: Reliable infrastructure
- **Built-in features**:
  - Email/password
  - Phone auth
  - Social auth (Google, Facebook, etc.)
  - Anonymous auth
  - Custom tokens
  - User management dashboard

**Cons:**
- **Google vendor lock-in**: Harder to switch
- **Limited customization**: Less flexible than Auth0
- **NoSQL-centric**: Not ideal for PostgreSQL apps
- **Scaling costs**: Can get expensive at scale

**Best For:**
- Google Cloud Platform users
- Mobile-first applications
- Rapid prototyping

---

### 4. AWS Cognito

**Pros:**
- **AWS integration**: Perfect if already on AWS
- **Scalable**: Handles millions of users
- **Compliance**: SOC, PCI DSS, HIPAA compliant
- **Free tier**: 50,000 MAU
- **Features**:
  - User pools
  - Identity pools
  - Social/SAML auth
  - MFA
  - Advanced security

**Cons:**
- **Complexity**: Steep learning curve
- **AWS-centric**: Best if committed to AWS ecosystem
- **UX**: UI/UX not as polished as competitors
- **Pricing**: Can get expensive with advanced features

**Best For:**
- AWS-based infrastructure
- Enterprise apps on AWS
- Apps needing AWS service integration

---

## Recommendation: **Supabase Auth**

### Why Supabase?

1. **PostgreSQL Native**: Your app already uses PostgreSQL
2. **Cost-Effective**: Free tier covers development + small production
3. **Flexibility**: Can self-host if needed (true ownership)
4. **Migration Path**: Run alongside existing auth during transition
5. **Feature-Rich**: Everything needed for MVP to enterprise
6. **Developer Experience**: Excellent DX with modern tooling
7. **Open Source**: Community-driven, transparent development

### Implementation Strategy

#### Phase 1: Setup & Preparation (Week 1)
1. **Supabase Project Setup**
   - Create Supabase project
   - Configure authentication providers
   - Set up email templates
   - Configure redirect URLs

2. **Database Schema Updates**
   ```sql
   -- Add Supabase user UUID to existing users table
   ALTER TABLE users ADD COLUMN supabase_user_id UUID;
   ALTER TABLE users ADD COLUMN username VARCHAR(50) UNIQUE;
   ALTER TABLE users ADD COLUMN avatar_url TEXT;
   ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;

   -- Create auth event logging table
   CREATE TABLE auth_events (
     id SERIAL PRIMARY KEY,
     user_id INTEGER REFERENCES users(id),
     event_type VARCHAR(50) NOT NULL, -- login, logout, password_reset, etc.
     ip_address INET,
     user_agent TEXT,
     success BOOLEAN NOT NULL,
     error_message TEXT,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );

   CREATE INDEX idx_auth_events_user_id ON auth_events(user_id);
   CREATE INDEX idx_auth_events_created_at ON auth_events(created_at);
   ```

3. **Environment Configuration**
   ```bash
   # .env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_KEY=your-service-key

   # Keep existing for migration period
   JWT_SECRET=existing-secret
   ```

#### Phase 2: Frontend Integration (Week 2)

1. **Install Supabase Client**
   ```bash
   # Web
   cd web && npm install @supabase/supabase-js

   # Mobile
   cd mobile && npm install @supabase/supabase-js @react-native-async-storage/async-storage
   ```

2. **Create Supabase Client**
   ```typescript
   // web/src/lib/supabase.ts
   import { createClient } from '@supabase/supabase-js'

   const supabaseUrl = process.env.REACT_APP_SUPABASE_URL!
   const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY!

   export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
     auth: {
       autoRefreshToken: true,
       persistSession: true,
       detectSessionInUrl: true
     }
   })
   ```

3. **Update Auth Context**
   ```typescript
   // web/src/contexts/AuthContext.tsx
   import { supabase } from '../lib/supabase'

   interface AuthContextType {
     user: User | null
     supabaseUser: any | null // Supabase auth user
     signUp: (email: string, password: string, username: string) => Promise<void>
     signIn: (email: string, password: string) => Promise<void>
     signInWithGoogle: () => Promise<void>
     signOut: () => Promise<void>
     resetPassword: (email: string) => Promise<void>
     updateProfile: (updates: any) => Promise<void>
   }

   // Implement auth methods using Supabase
   ```

4. **New Authentication Flows**
   - Sign up with email verification
   - Login with username or email
   - Password reset flow
   - Social login (Google, GitHub)
   - Magic link authentication
   - Profile completion wizard

#### Phase 3: Backend Integration (Week 2-3)

1. **Create Auth Middleware**
   ```typescript
   // backend/src/middleware/supabaseAuth.ts
   import { createClient } from '@supabase/supabase-js'

   export const verifySupabaseToken = async (req, res, next) => {
     const token = req.headers.authorization?.split(' ')[1]

     if (!token) {
       return res.status(401).json({ error: 'No token provided' })
     }

     const { data: { user }, error } = await supabase.auth.getUser(token)

     if (error || !user) {
       return res.status(401).json({ error: 'Invalid token' })
     }

     // Link to existing user in database
     const dbUser = await query(
       'SELECT * FROM users WHERE supabase_user_id = $1',
       [user.id]
     )

     req.user = dbUser.rows[0]
     req.supabaseUser = user
     next()
   }
   ```

2. **Migration Route**
   ```typescript
   // POST /api/auth/migrate
   // Migrates existing user to Supabase
   export const migrateToSupabase = async (req, res) => {
     const { email, password } = req.body

     // 1. Verify with old auth
     const user = await verifyOldAuth(email, password)

     // 2. Create Supabase user
     const { data, error } = await supabase.auth.admin.createUser({
       email: user.email,
       password: password,
       email_confirm: true,
       user_metadata: {
         name: user.name,
         username: user.username || generateUsername(user.email)
       }
     })

     // 3. Link accounts
     await query(
       'UPDATE users SET supabase_user_id = $1 WHERE id = $2',
       [data.user.id, user.id]
     )

     // 4. Return Supabase session
     return res.json({ user: data.user, session: data.session })
   }
   ```

#### Phase 4: Feature Enhancement (Week 3-4)

1. **Email Verification**
   - Customize email templates in Supabase dashboard
   - Add verification required middleware
   - Block unverified users from certain actions

2. **Username System**
   ```typescript
   // Separate username from email
   // Username requirements:
   // - 3-50 characters
   // - Alphanumeric + underscore/hyphen
   // - Unique across platform
   // - Case-insensitive storage
   ```

3. **Social Authentication**
   ```typescript
   // Google OAuth
   const { data, error } = await supabase.auth.signInWithOAuth({
     provider: 'google',
     options: {
       redirectTo: `${window.location.origin}/auth/callback`
     }
   })

   // GitHub OAuth
   const { data, error } = await supabase.auth.signInWithOAuth({
     provider: 'github',
     options: {
       redirectTo: `${window.location.origin}/auth/callback`
     }
   })
   ```

4. **MFA/2FA Setup**
   ```typescript
   // Enable TOTP
   const { data, error } = await supabase.auth.mfa.enroll({
     factorType: 'totp'
   })

   // Verify TOTP
   const { data, error } = await supabase.auth.mfa.verify({
     factorId: data.id,
     code: userInputCode
     })
   ```

5. **Session Management**
   - Session timeout configuration
   - Device tracking
   - Active sessions viewer
   - Logout from all devices

#### Phase 5: Security Hardening (Week 4)

1. **Rate Limiting**
   ```typescript
   // Use express-rate-limit
   import rateLimit from 'express-rate-limit'

   const authLimiter = rateLimit({
     windowMs: 15 * 60 * 1000, // 15 minutes
     max: 5, // 5 requests per window
     message: 'Too many auth attempts, please try again later'
   })

   router.post('/login', authLimiter, loginHandler)
   ```

2. **Password Policy**
   - Minimum 8 characters
   - Require uppercase, lowercase, number, special char
   - Check against common password lists
   - Implement pwned password check (HaveIBeenPwned API)

3. **Account Security**
   - Failed login attempt tracking
   - Account lockout after 5 failed attempts
   - IP-based anomaly detection
   - Email alerts for suspicious activity

4. **Audit Logging**
   - Log all auth events
   - IP address tracking
   - Device fingerprinting
   - User activity timeline

#### Phase 6: Migration & Deployment (Week 5)

1. **User Migration Plan**
   ```typescript
   // Option A: Automatic migration on login
   // - User logs in with old credentials
   // - System creates Supabase account
   // - Links accounts
   // - Issues new token

   // Option B: Forced migration
   // - Send email to all users
   // - Require password reset
   // - Creates Supabase account during reset

   // Option C: Gradual migration
   // - Both auth systems run in parallel
   // - New users use Supabase
   // - Old users migrate on next login
   // - Deprecate old auth after 90 days
   ```

2. **Deployment Checklist**
   - [ ] Set up Supabase production project
   - [ ] Configure custom SMTP for emails
   - [ ] Set up custom domain for auth
   - [ ] Enable RLS policies
   - [ ] Configure CORS
   - [ ] Set up monitoring/alerts
   - [ ] Test all auth flows in staging
   - [ ] Prepare rollback plan
   - [ ] Document migration process
   - [ ] Train team on new system

3. **Rollback Strategy**
   - Keep old auth system for 90 days
   - Feature flags for auth system selection
   - Database backups before migration
   - Ability to re-issue old JWT tokens

---

## Username Implementation

### Requirements
- **Username field**: Separate from email
- **Format**: 3-50 characters, alphanumeric + _ -
- **Uniqueness**: Case-insensitive unique
- **Generation**: Auto-generate from email if not provided
- **Validation**: Real-time availability check
- **Display**: Show username instead of email in UI

### Database Changes
```sql
ALTER TABLE users ADD COLUMN username VARCHAR(50) UNIQUE;
CREATE UNIQUE INDEX idx_users_username_lower ON users(LOWER(username));

-- Migrate existing users
UPDATE users SET username = LOWER(SPLIT_PART(email, '@', 1)) WHERE username IS NULL;

-- Add conflict resolution for duplicates
UPDATE users SET username = username || '_' || id WHERE username IN (
  SELECT username FROM users GROUP BY username HAVING COUNT(*) > 1
);
```

### Validation Rules
```typescript
const validateUsername = (username: string): boolean => {
  // 3-50 characters
  if (username.length < 3 || username.length > 50) return false

  // Alphanumeric + underscore + hyphen only
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) return false

  // Cannot start/end with special chars
  if (/^[_-]|[_-]$/.test(username)) return false

  // Reserved usernames
  const reserved = ['admin', 'root', 'system', 'api', 'app']
  if (reserved.includes(username.toLowerCase())) return false

  return true
}
```

---

## Onboarding Workflow

### New User Journey

1. **Registration Page**
   ```
   ┌─────────────────────────────┐
   │  Create Your Account        │
   ├─────────────────────────────┤
   │  Email: [input]             │
   │  Username: [input] ✓        │
   │  Password: [input] 🔒       │
   │  Confirm: [input]           │
   │                             │
   │  [Continue with Google]     │
   │  [Continue with GitHub]     │
   │                             │
   │  [x] I agree to Terms       │
   │                             │
   │  [Create Account →]         │
   └─────────────────────────────┘
   ```

2. **Email Verification**
   ```
   ┌─────────────────────────────┐
   │  📧 Check Your Email        │
   ├─────────────────────────────┤
   │  We sent a verification     │
   │  link to:                   │
   │                             │
   │  your@email.com             │
   │                             │
   │  Click the link to verify   │
   │  your account.              │
   │                             │
   │  [Resend Email]             │
   │  [Change Email]             │
   └─────────────────────────────┘
   ```

3. **Welcome & Profile Setup**
   ```
   ┌─────────────────────────────┐
   │  Welcome! Let's set up      │
   │  your profile               │
   ├─────────────────────────────┤
   │  Step 1 of 3: Basic Info    │
   │                             │
   │  Full Name: [input]         │
   │  Profile Picture: [upload]  │
   │                             │
   │  [Skip] [Next →]            │
   └─────────────────────────────┘

   ┌─────────────────────────────┐
   │  Step 2 of 3: Organization  │
   ├─────────────────────────────┤
   │  ( ) Create organization    │
   │      Org Name: [input]      │
   │                             │
   │  ( ) Join organization      │
   │      Invite Code: [input]   │
   │                             │
   │  [Back] [Next →]            │
   └─────────────────────────────┘

   ┌─────────────────────────────┐
   │  Step 3 of 3: Security      │
   ├─────────────────────────────┤
   │  Enable 2FA (recommended)   │
   │                             │
   │  [ ] Email notifications    │
   │  [ ] Desktop notifications  │
   │  [ ] Mobile push            │
   │                             │
   │  [Back] [Complete Setup]    │
   └─────────────────────────────┘
   ```

4. **Interactive Tutorial** (Optional)
   - Product tour using react-joyride
   - Highlight key features
   - Create first task walkthrough
   - Skip option

---

## Cost Analysis

### Supabase Pricing (Recommended)

| Tier | Monthly Cost | MAU | Features |
|------|-------------|-----|----------|
| Free | $0 | 50,000 | All features, 500MB database, 1GB file storage |
| Pro | $25 | 100,000 | More storage, better support, no pausing |
| Team | $599 | 100,000+ | Dedicated infrastructure, SLA |

**Estimated Cost for MVP**: $0 - $25/month

### Auth0 Pricing (Alternative)

| Tier | Monthly Cost | MAU | Features |
|------|-------------|-----|----------|
| Free | $0 | 7,000 | Basic features |
| Essentials | $240 | 500 | Social auth, custom domains |
| Professional | $1,200+ | 1,000+ | Advanced security, MFA |

**Estimated Cost for MVP**: $240/month minimum

### Cost Savings: **$2,580/year** by choosing Supabase over Auth0

---

## Risk Assessment

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Migration data loss | Low | High | Comprehensive backups, parallel auth systems |
| User confusion | Medium | Medium | Clear communication, migration guides |
| Downtime during migration | Low | High | Blue-green deployment, gradual rollout |
| Third-party dependency | Medium | Medium | Self-hosting option available |
| Breaking changes | Low | Medium | Version pinning, testing |

### Business Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| User churn during migration | Low | High | Seamless migration, user communication |
| Increased costs | Low | Low | Supabase very cost-effective |
| Vendor lock-in | Medium | Medium | Open-source, self-host option |
| Compliance issues | Low | High | Supabase SOC 2 Type 2 compliant |

---

## Success Metrics

### KPIs to Track

1. **Authentication Metrics**
   - Login success rate (target: >99%)
   - Average login time (target: <2s)
   - Failed login attempts (monitor for attacks)
   - Session duration
   - Password reset requests

2. **User Experience**
   - Registration completion rate (target: >80%)
   - Email verification rate (target: >90%)
   - Social login adoption (target: >30%)
   - Onboarding completion (target: >75%)

3. **Security Metrics**
   - Account takeover attempts blocked
   - Suspicious login detections
   - MFA adoption rate (target: >50%)
   - Average password strength

4. **Technical Metrics**
   - Auth endpoint response time
   - Token refresh failures
   - API error rates
   - Session storage failures

---

## Timeline & Milestones

### 5-Week Implementation Plan

**Week 1: Setup & Planning**
- [x] Supabase project creation
- [x] Database schema updates
- [x] Environment configuration
- [ ] Team training

**Week 2: Frontend Integration**
- [ ] Install Supabase client
- [ ] Update AuthContext
- [ ] New registration flow
- [ ] Login page updates
- [ ] Social auth buttons

**Week 3: Backend Integration**
- [ ] Supabase middleware
- [ ] Migration route
- [ ] Parallel auth support
- [ ] Username system
- [ ] Email verification

**Week 4: Features & Security**
- [ ] Password reset flow
- [ ] MFA implementation
- [ ] Rate limiting
- [ ] Audit logging
- [ ] Security hardening

**Week 5: Migration & Launch**
- [ ] User migration
- [ ] Testing & QA
- [ ] Deployment
- [ ] Monitoring setup
- [ ] User communication

---

## Next Steps

### Immediate Actions (Next 3 Days)

1. **Create Supabase Account**
   - Sign up at https://supabase.com
   - Create development project
   - Note credentials for .env

2. **Database Preparation**
   - Review schema changes
   - Create migration scripts
   - Test in development

3. **Frontend Preparation**
   - Install @supabase/supabase-js
   - Create basic auth context
   - Design new auth UI pages

4. **Documentation**
   - Document current auth flow
   - Create migration guide for users
   - Prepare announcement

### Week 1 Deliverables

- [ ] Supabase dev project configured
- [ ] Database migrations created
- [ ] Supabase client integrated
- [ ] Basic sign up/login working in dev
- [ ] Team aligned on plan

---

## Conclusion

Migrating to Supabase Auth provides a production-ready authentication system that:
- ✅ Eliminates security concerns with custom auth
- ✅ Adds enterprise features (MFA, social login, email verification)
- ✅ Reduces maintenance burden
- ✅ Costs $0-25/month for MVP stage
- ✅ Provides path to scale
- ✅ Can self-host if needed
- ✅ Integrates seamlessly with existing PostgreSQL database

**Recommendation**: Proceed with Supabase Auth implementation following the 5-week plan outlined above.
