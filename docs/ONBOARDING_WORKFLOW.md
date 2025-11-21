# User Onboarding Workflow

## Overview

This document outlines a comprehensive onboarding experience for new users using the existing email/password authentication system. The goal is to create a smooth, intuitive first-time user experience that helps users understand the platform and get started quickly.

---

## Current State

### Existing Registration Flow
1. User navigates to `/register`
2. Enters: email, password, name
3. Clicks "Register"
4. Redirected to login or dashboard

### Problems
- No guidance after registration
- No organization setup
- No introduction to features
- Users don't know what to do first
- No profile completion
- No email verification

---

## Proposed Onboarding Flow

### Journey Map

```
Registration → Welcome → Organization Setup → Profile Setup → Feature Tour → First Task → Dashboard
```

### Detailed User Journey

---

## Step 1: Enhanced Registration

### Page: `/register`

**UI Layout:**
```
┌─────────────────────────────────────────┐
│  🎯 Welcome to TaskManager              │
│                                         │
│  Create your account to get started    │
├─────────────────────────────────────────┤
│                                         │
│  Full Name *                            │
│  [John Doe_________________]            │
│                                         │
│  Email Address *                        │
│  [john@company.com_________]            │
│                                         │
│  Password * (min 8 characters)          │
│  [••••••••••••••___________] 👁         │
│  ✓ 8+ characters                        │
│  ✓ Uppercase letter                     │
│  ✓ Lowercase letter                     │
│  ✓ Number                               │
│                                         │
│  Confirm Password *                     │
│  [••••••••••••••___________] 👁         │
│                                         │
│  [✓] I agree to Terms of Service       │
│      and Privacy Policy                 │
│                                         │
│  [Create Account →]                     │
│                                         │
│  Already have an account? [Sign In]    │
└─────────────────────────────────────────┘
```

**Validation:**
- Real-time password strength indicator
- Email format validation
- Duplicate email check
- Password match confirmation
- Terms acceptance required

**Backend Changes:**
```typescript
// Add to users table
ALTER TABLE users ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN onboarding_step INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN terms_accepted_at TIMESTAMP;
```

---

## Step 2: Welcome & Email Verification

### Page: `/welcome`

**UI Layout:**
```
┌─────────────────────────────────────────┐
│  🎉 Welcome, John!                      │
├─────────────────────────────────────────┤
│                                         │
│  Thanks for joining TaskManager!        │
│                                         │
│  📧 We've sent a verification email to: │
│                                         │
│     john@company.com                    │
│                                         │
│  Please check your inbox and click the │
│  verification link to continue.         │
│                                         │
│  Didn't receive it?                     │
│  [Resend Verification Email]            │
│                                         │
│  [I'll verify later - Continue →]      │
└─────────────────────────────────────────┘
```

**Email Template:**
```html
Subject: Verify your TaskManager account

Hi John,

Welcome to TaskManager! Click the button below to verify your email address:

[Verify Email Address]
(Link valid for 24 hours)

If you didn't create an account, you can safely ignore this email.

Thanks,
The TaskManager Team
```

**Backend Implementation:**
```typescript
// Generate verification token
const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Store token in database
CREATE TABLE IF NOT EXISTS email_verifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

// Verification endpoint
router.get('/auth/verify-email/:token', async (req, res) => {
  const { token } = req.params;

  const verification = await query(
    'SELECT * FROM email_verifications WHERE token = $1 AND expires_at > NOW()',
    [token]
  );

  if (verification.rows.length === 0) {
    return res.status(400).json({ error: 'Invalid or expired token' });
  }

  await query(
    'UPDATE users SET email_verified = TRUE WHERE id = $1',
    [verification.rows[0].user_id]
  );

  await query(
    'UPDATE email_verifications SET verified_at = NOW() WHERE id = $1',
    [verification.rows[0].id]
  );

  res.redirect('/onboarding?step=organization');
});
```

---

## Step 3: Organization Setup

### Page: `/onboarding?step=organization`

**UI Layout:**
```
┌─────────────────────────────────────────┐
│  Step 1 of 3: Organization              │
│  ████████░░░░░░░░░░░░░░░░░░░░░░░ 33%    │
├─────────────────────────────────────────┤
│                                         │
│  How would you like to get started?     │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ 🏢 Create New Organization        │ │
│  │                                   │ │
│  │ Start fresh and invite your team  │ │
│  │                                   │ │
│  │ [Select]                          │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ 👥 Join Existing Organization     │ │
│  │                                   │ │
│  │ Have an invite code? Join now     │ │
│  │                                   │ │
│  │ [Select]                          │ │
│  └───────────────────────────────────┘ │
│                                         │
│  [← Back]          [Skip for now →]    │
└─────────────────────────────────────────┘
```

**Option A: Create Organization**
```
┌─────────────────────────────────────────┐
│  Create Your Organization               │
├─────────────────────────────────────────┤
│                                         │
│  Organization Name *                    │
│  [Acme Inc._________________]           │
│                                         │
│  What describes your team best?         │
│  ( ) Small team (2-10 people)           │
│  (•) Medium team (11-50 people)         │
│  ( ) Large team (50+ people)            │
│                                         │
│  Industry (optional)                    │
│  [Select..._______________▼]            │
│                                         │
│  [← Back]          [Create & Continue]  │
└─────────────────────────────────────────┘
```

**Option B: Join Organization**
```
┌─────────────────────────────────────────┐
│  Join Organization                      │
├─────────────────────────────────────────┤
│                                         │
│  Enter your invite code:                │
│                                         │
│  [ACME-2024-XYZABC_____]                │
│                                         │
│  [Validate Code]                        │
│                                         │
│  Don't have an invite code?             │
│  Contact your organization admin        │
│                                         │
│  [← Back]          [Join Organization]  │
└─────────────────────────────────────────┘
```

**Backend Changes:**
```typescript
// Add invite system
CREATE TABLE IF NOT EXISTS organization_invites (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  code VARCHAR(50) UNIQUE NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  max_uses INTEGER DEFAULT 1,
  used_count INTEGER DEFAULT 0,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

// Generate invite code
const generateInviteCode = (orgName: string) => {
  const prefix = orgName.substring(0, 4).toUpperCase();
  const year = new Date().getFullYear();
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${year}-${random}`;
};
```

---

## Step 4: Profile Customization

### Page: `/onboarding?step=profile`

**UI Layout:**
```
┌─────────────────────────────────────────┐
│  Step 2 of 3: Your Profile              │
│  ████████████████░░░░░░░░░░░░░░ 66%    │
├─────────────────────────────────────────┤
│                                         │
│  Let's personalize your profile         │
│                                         │
│  Profile Picture                        │
│  ┌─────────┐                            │
│  │         │                            │
│  │   JD    │  [Upload Photo]            │
│  │         │  [Choose Avatar]           │
│  └─────────┘                            │
│                                         │
│  Display Name *                         │
│  [John Doe__________________]           │
│                                         │
│  Job Title (optional)                   │
│  [Product Manager__________]            │
│                                         │
│  Timezone                               │
│  [America/New_York_________▼]           │
│                                         │
│  Notification Preferences               │
│  [✓] Email notifications                │
│  [✓] Task assignments                   │
│  [✓] Task due reminders                 │
│  [ ] Daily digest                       │
│                                         │
│  [← Back]          [Continue →]         │
└─────────────────────────────────────────┘
```

**Backend Changes:**
```typescript
// Add to users table
ALTER TABLE users ADD COLUMN avatar_url TEXT;
ALTER TABLE users ADD COLUMN job_title VARCHAR(100);
ALTER TABLE users ADD COLUMN timezone VARCHAR(50) DEFAULT 'UTC';
ALTER TABLE users ADD COLUMN notification_preferences JSONB DEFAULT '{"email": true, "assignments": true, "reminders": true, "digest": false}';
```

---

## Step 5: Interactive Tutorial

### Page: `/onboarding?step=tutorial`

**UI Layout:**
```
┌─────────────────────────────────────────┐
│  Step 3 of 3: Quick Tour                │
│  ████████████████████████████████ 100%  │
├─────────────────────────────────────────┤
│                                         │
│  🎓 Learn the Basics                    │
│                                         │
│  Take a 2-minute tour to learn how to:  │
│                                         │
│  ✓ Create and assign tasks              │
│  ✓ Track progress with requirements     │
│  ✓ Collaborate with your team           │
│  ✓ Stay organized with schedules        │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ 📹 [Watch Video Tour] (2 min)     │ │
│  └───────────────────────────────────┘ │
│                                         │
│  Or                                     │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ 🚀 [Start Interactive Tutorial]   │ │
│  └───────────────────────────────────┘ │
│                                         │
│  [Skip Tutorial - Go to Dashboard →]    │
└─────────────────────────────────────────┘
```

**Interactive Tutorial Steps (using react-joyride):**

**Step 1: Navigation**
```
Target: Sidebar
Message: "This is your main navigation. Access tasks, organizations, and notifications from here."
```

**Step 2: Create Task**
```
Target: "Create Task" button
Message: "Click here to create a new task. Let's create your first task together!"
Action: Opens create task form
```

**Step 3: Task Form**
```
Target: Task form
Message: "Fill in task details: title, description, due date, and assign to team members."
Action: Pre-fill sample task
```

**Step 4: Requirements**
```
Target: Requirements section
Message: "Add requirements (checklist items) to break down tasks into manageable steps."
```

**Step 5: Submit**
```
Target: Create button
Message: "Click to create your first task!"
Action: Creates sample task
```

**Step 6: Task Detail**
```
Target: Created task
Message: "Great! This is your task detail view. Track progress and add completions here."
```

**Step 7: Complete**
```
Message: "🎉 You're all set! You can now create, assign, and track tasks with your team."
```

**Implementation:**
```typescript
// Install react-joyride
npm install react-joyride

// TutorialProvider.tsx
import Joyride, { Step } from 'react-joyride';

const tutorialSteps: Step[] = [
  {
    target: '[data-tour="sidebar"]',
    content: 'This is your main navigation...',
    placement: 'right'
  },
  {
    target: '[data-tour="create-task"]',
    content: 'Click here to create a new task...',
    placement: 'bottom'
  },
  // ... more steps
];

export const TutorialProvider = ({ children }) => {
  const [run, setRun] = useState(false);

  return (
    <>
      <Joyride
        steps={tutorialSteps}
        run={run}
        continuous
        showProgress
        showSkipButton
        styles={{
          options: {
            primaryColor: '#2196F3'
          }
        }}
      />
      {children}
    </>
  );
};
```

---

## Step 6: First Task Creation

### Page: `/onboarding/first-task`

**Guided Task Creation:**
```
┌─────────────────────────────────────────┐
│  Create Your First Task                 │
├─────────────────────────────────────────┤
│                                         │
│  Let's create a task together!          │
│                                         │
│  💡 Tip: Be specific with your title    │
│                                         │
│  Task Title *                           │
│  [Complete team onboarding_]            │
│                                         │
│  💡 Tip: Add context and details        │
│                                         │
│  Details                                │
│  [Help new team members get            │
│   set up with accounts and tools]       │
│                                         │
│  💡 Tip: Set a realistic deadline       │
│                                         │
│  Due Date *                             │
│  [2024-12-15___________📅]              │
│                                         │
│  💡 Tip: Break it into steps            │
│                                         │
│  Requirements                           │
│  ✓ [Create user accounts______]        │
│  ✓ [Send welcome email________]        │
│  ✓ [Schedule kickoff meeting__]        │
│  [+ Add requirement]                    │
│                                         │
│  Assign To                              │
│  [John Doe (You)___________▼]           │
│                                         │
│  [← Back]          [Create Task →]      │
└─────────────────────────────────────────┘
```

---

## Step 7: Dashboard Welcome

### Page: `/` (After onboarding)

**First-time Dashboard:**
```
┌─────────────────────────────────────────┐
│  Welcome to your Dashboard, John! 🎉    │
├─────────────────────────────────────────┤
│                                         │
│  🎯 Your Quick Start Checklist          │
│  ┌───────────────────────────────────┐ │
│  │ ✓ Account created                 │ │
│  │ ✓ Organization setup              │ │
│  │ ✓ Profile customized              │ │
│  │ ✓ First task created              │ │
│  │ □ Invite team members             │ │
│  │ □ Create recurring tasks          │ │
│  └───────────────────────────────────┘ │
│                                         │
│  📊 Quick Stats                         │
│  ┌─────────┬─────────┬─────────┐      │
│  │ 1 Task  │ 0 Done  │ 1 Active│      │
│  └─────────┴─────────┴─────────┘      │
│                                         │
│  📋 Recent Tasks                        │
│  ┌───────────────────────────────────┐ │
│  │ • Complete team onboarding        │ │
│  │   Due: Dec 15 • Assigned to You   │ │
│  └───────────────────────────────────┘ │
│                                         │
│  💡 Helpful Resources                   │
│  [📖 User Guide] [🎥 Video Tutorials]  │
│  [💬 Get Support] [⚙️ Settings]        │
└─────────────────────────────────────────┘
```

---

## Onboarding State Management

### Database Schema
```sql
-- Track onboarding progress
ALTER TABLE users ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN onboarding_step INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN onboarding_skipped_steps JSONB DEFAULT '[]';
ALTER TABLE users ADD COLUMN onboarding_completed_at TIMESTAMP;

-- Steps:
-- 0: Not started
-- 1: Email verification
-- 2: Organization setup
-- 3: Profile setup
-- 4: Tutorial
-- 5: First task
-- 6: Completed
```

### Frontend State (Context)
```typescript
// OnboardingContext.tsx
interface OnboardingState {
  currentStep: number;
  stepsCompleted: number[];
  stepsSkipped: number[];
  isComplete: boolean;
  userData: {
    email: string;
    name: string;
    organizationId?: number;
    profileComplete: boolean;
  };
}

const OnboardingContext = createContext<OnboardingState>(null);

export const OnboardingProvider = ({ children }) => {
  const [state, setState] = useState<OnboardingState>({
    currentStep: 0,
    stepsCompleted: [],
    stepsSkipped: [],
    isComplete: false,
    userData: {}
  });

  const completeStep = async (step: number) => {
    setState(prev => ({
      ...prev,
      stepsCompleted: [...prev.stepsCompleted, step],
      currentStep: step + 1
    }));

    await api.post('/onboarding/progress', { step });
  };

  const skipStep = async (step: number) => {
    setState(prev => ({
      ...prev,
      stepsSkipped: [...prev.stepsSkipped, step],
      currentStep: step + 1
    }));

    await api.post('/onboarding/skip', { step });
  };

  return (
    <OnboardingContext.Provider value={{ state, completeStep, skipStep }}>
      {children}
    </OnboardingContext.Provider>
  );
};
```

---

## Email Templates

### 1. Welcome Email (After Registration)
```
Subject: Welcome to TaskManager!

Hi {{name}},

Welcome to TaskManager! We're excited to have you on board.

To get started, please verify your email address:

[Verify Email Address]

Once verified, you'll be able to:
✓ Create and manage tasks
✓ Collaborate with your team
✓ Track progress in real-time

Need help? Reply to this email or visit our Help Center.

Best regards,
The TaskManager Team
```

### 2. Onboarding Follow-up (Day 1)
```
Subject: Getting the most out of TaskManager

Hi {{name}},

Thanks for joining TaskManager! Here are some tips to help you get started:

1️⃣ Create your first task
   Start with a simple task to get familiar with the platform.

2️⃣ Invite your team
   TaskManager is better with your team. Invite members from your organization settings.

3️⃣ Explore features
   Check out recurring tasks, requirements, and file uploads.

[Go to Dashboard]

Questions? We're here to help!

Best,
The TaskManager Team
```

### 3. Feature Discovery (Day 3)
```
Subject: 3 TaskManager features you should try

Hi {{name}},

Here are 3 powerful features that will boost your productivity:

📋 Requirements & Checklists
   Break tasks into smaller, manageable steps. Perfect for complex projects.

📅 Recurring Tasks
   Set up tasks that repeat daily, weekly, or monthly. Never forget routine work.

✅ Task Completions
   Track what's been done with photos, videos, and documents.

[Learn More]

Happy task managing!
The TaskManager Team
```

---

## Completion Criteria

A user is considered "onboarded" when they have:
- ✅ Verified their email
- ✅ Joined or created an organization
- ✅ Completed basic profile setup
- ✅ Viewed tutorial (or skipped it)
- ✅ Created at least one task

Once onboarded:
- Set `onboarding_completed = TRUE`
- Record `onboarding_completed_at` timestamp
- Stop showing onboarding prompts
- Show normal dashboard

---

## Re-engagement for Incomplete Onboarding

### Users who don't complete onboarding:

**Day 1 Email:**
```
Subject: Finish setting up your TaskManager account

Hi {{name}},

We noticed you haven't finished setting up your account. It only takes 2 minutes!

[Complete Setup]

Need help? Let us know!
```

**Day 3 Email:**
```
Subject: Your team is waiting for you on TaskManager

Hi {{name}},

Your organization {{org_name}} is already using TaskManager. Complete your setup to start collaborating!

[Join Your Team]
```

**Day 7: Final nudge**
```
Subject: We'll miss you!

Hi {{name}},

This is our last reminder to complete your TaskManager setup.

After this, we won't send more emails unless you request them.

[Complete Setup] | [Unsubscribe]
```

---

## Metrics to Track

### Onboarding Funnel
```
Registration       → 100% baseline
Email Verified     → Target: 90%
Org Created/Joined → Target: 85%
Profile Completed  → Target: 80%
Tutorial Viewed    → Target: 70%
First Task Created → Target: 75%
Fully Onboarded    → Target: 70%
```

### Engagement Metrics
- Time to complete onboarding (Target: <10 minutes)
- Steps skipped (Monitor which steps are frequently skipped)
- Drop-off points (Where users abandon onboarding)
- First task created within 24 hours (Target: >60%)
- Return rate after 7 days (Target: >50%)

---

## Mobile App Considerations

### Simplified Mobile Onboarding
Due to smaller screens, mobile onboarding should be:
1. **Shorter**: Combine steps where possible
2. **Swipe-based**: Use swipe gestures for navigation
3. **Progressive**: Allow users to skip and come back later

**Mobile Flow:**
```
Registration → Welcome (email verification) → Quick Setup (org + profile in one) → Dashboard
```

**Mobile UI:**
- Use full-screen onboarding cards
- Add swipe indicators (dots)
- Allow "Skip" on every step
- Save progress automatically

---

## Success Criteria

### User completes onboarding successfully when:
- [x] Account created
- [x] Email verified
- [x] Organization setup (created or joined)
- [x] Basic profile completed
- [x] Tutorial viewed or skipped with awareness
- [x] First task created

### Business goals:
- 70%+ completion rate
- <10 minutes average time
- 60%+ create first task within 24 hours
- 50%+ return after 7 days

---

## Implementation Timeline

### Week 1: Foundation
- [x] Database schema updates
- [ ] Email verification system
- [ ] Onboarding state management
- [ ] Basic UI pages (welcome, email verify)

### Week 2: Core Steps
- [ ] Organization setup flow
- [ ] Profile customization
- [ ] Progress tracking
- [ ] Navigation between steps

### Week 3: Polish
- [ ] Interactive tutorial (react-joyride)
- [ ] Guided first task creation
- [ ] Email templates
- [ ] Analytics tracking

### Week 4: Testing & Launch
- [ ] User testing
- [ ] Bug fixes
- [ ] Performance optimization
- [ ] Soft launch to beta users

---

## Next Steps

1. **Review & Approve**: Get stakeholder approval on flow
2. **Design Mockups**: Create detailed UI designs
3. **Implement Backend**: Add database changes and API endpoints
4. **Build Frontend**: Create onboarding pages and components
5. **Test**: User testing with real users
6. **Launch**: Roll out to all new users
7. **Monitor**: Track metrics and iterate

---

## Conclusion

This onboarding workflow:
- ✅ Uses existing email/password auth
- ✅ Guides users through essential setup
- ✅ Educates without overwhelming
- ✅ Creates engagement through first task
- ✅ Tracks progress for follow-up
- ✅ Sets users up for long-term success

**Goal**: Transform new signups into active, engaged users who understand and use the platform effectively.
