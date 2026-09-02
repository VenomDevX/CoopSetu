# 🚀 Transform HANDOFF → NCCT Cooperative Training Hub (CoopSetu)

Transform the existing HANDOFF project management platform into a **national-level Cooperative Training ERP + LMS + Employment Exchange** as per [REQUIREMENT.MD](file:///f:/Projects/SIH%2026087/REQUIREMENT.MD), while retaining existing enterprise/employee features and removing all student/hackathon-specific features.

## Current State Summary

The app is a **Next.js + Supabase** project management tool ("HANDOFF") with:
- **KEEP**: Projects, Tasks, Sprints, Teams, Incidents, QA/Security, Analytics, Documents, Approvals, Calendar, My Work, AI Hub, Settings, Releases, Repositories — all employee/enterprise features
- **REMOVE**: Student workspace onboarding (`/onboarding/student/*`), student team APIs (`/api/v1/student-teams/*`, `/api/v1/student-workspaces/*`), hackathon references, `STUDENT_SOLO`/`STUDENT_TEAM` workspace types
- **ADD (New Modules from REQUIREMENT.MD)**: Training ERP, LMS, Attendance (QR/Face), Certificates, Skill Passport, Employment Exchange, AI Career Chatbot, Employer Portal, Analytics Dashboard (national stats), Multilingual (i18n)

---

## User Review Required

> [!IMPORTANT]
> **Massive Scope**: The REQUIREMENT.MD describes ~19 phases of a complete cooperative training ecosystem. Building ALL of them at once is not feasible in a single pass. The plan below covers the **core architectural transformation + MVP modules** (Phases 1-8 from the requirements). Advanced AI (RAG, dropout prediction), hardware (ESP32), and offline PWA can be added incrementally later.

> [!WARNING]  
> **Database Changes**: New Supabase tables for training, LMS, attendance, certificates, skills, jobs, and employers will be created. Existing tables (projects, tasks, teams, etc.) remain untouched.

> [!IMPORTANT]
> **Branding**: The app will be rebranded from "HANDOFF" to "CoopSetu" (or your preferred name). The existing minimalist/brutalist UI design language will be preserved.

---

## Open Questions

> [!IMPORTANT]
> 1. **App Name**: Should we rebrand to "CoopSetu" as mentioned in REQUIREMENT.MD, or a different name?
> 2. **Roles Mapping**: The requirements define 5 roles (Super Admin, Institute Admin, Trainer, Trainee, Employer). Should these be **new roles** added alongside existing ones (ORG_OWNER, ORG_ADMIN, PROJECT_MANAGER, EMPLOYEE), or should we **replace** the existing role system?
> 3. **Should existing enterprise features (Projects, Tasks, Sprints, etc.) remain accessible to ALL roles**, or only to Admin/Institute Admin roles?
> 4. **Priority Modules**: Which of these should be built first? (Recommend: Training ERP → LMS → Attendance → Certificates → Employer Portal → AI)

---

## Proposed Changes

### Phase 1: Remove Student/Hackathon Features

Remove all student-specific onboarding, APIs, services, and UI references.

#### [DELETE] Student onboarding pages
- `app/onboarding/student/` (entire directory — `client.tsx`, `page.tsx`, `team/`, `solo/`)

#### [DELETE] Student API routes
- `app/api/v1/student-teams/` (entire directory)
- `app/api/v1/student-workspaces/` (entire directory)

#### [DELETE] Student service
- `services/student-workspace.service.ts`

#### [DELETE] Student onboarding component
- `components/onboarding/student-workspace-choices.tsx`

#### [MODIFY] [client.tsx](file:///f:/Projects/SIH%2026087/app/onboarding/workspace-path/client.tsx)
- Remove the "For Study / Hackathons" button entirely
- Keep only the "For Work" enterprise path (auto-redirect to company onboarding)

#### [MODIFY] [get-current-membership.ts](file:///f:/Projects/SIH%2026087/lib/auth/get-current-membership.ts)
- Remove `STUDENT_SOLO` and `STUDENT_TEAM` from `workspaceType` type
- Clean up any student workspace type references

---

### Phase 2: Rebranding & Navigation Restructuring

#### [MODIFY] [shell.tsx](file:///f:/Projects/SIH%2026087/components/dashboard/shell.tsx)
- Rebrand "HANDOFF" → "CoopSetu" in sidebar logo
- Add new navigation groups for cooperative training modules:
  ```
  Training_ERP: Institutions, Programmes, Batches, Trainers, Trainees
  Learning_LMS: Courses, Assessments, Certificates
  Employment: Employer Portal, Jobs, Applications
  Cooperative_AI: Career Chatbot, Skill Analysis
  ```
- Keep existing nav groups (Ops_MGT, Eng_Core, Data_Knowledge, Admin_Level) as-is

#### [MODIFY] [logo.tsx](file:///f:/Projects/SIH%2026087/components/logo.tsx)
- Update branding from HANDOFF to CoopSetu

#### [MODIFY] [page.tsx](file:///f:/Projects/SIH%2026087/app/page.tsx) (landing page)
- Transform marketing copy from "project management tool" to "National Cooperative Training Hub"
- Update hero, features, and CTA sections to reflect cooperative training ecosystem
- Keep the existing design system (dark/light, brutalist style, motion animations)

---

### Phase 3: Database — New Tables (Supabase Migrations)

Create new Supabase migration files for:

#### [NEW] `supabase/migrations/XXXX_cooperative_training_tables.sql`

**Core Training Tables:**
```sql
institutions (id, name, code, type, location, capacity, status, organization_id)
programmes (id, title, description, institution_id, duration, start_date, end_date, capacity, status)
batches (id, programme_id, name, start_date, end_date, trainer_id, capacity, status)
trainees (id, user_id, education, location, languages, experience, profile_photo, digital_literacy_level, employment_status, organization_id)
trainers (id, user_id, specialization, institution_id, organization_id)
enrollments (id, trainee_id, programme_id, batch_id, status, enrolled_at)
```

**LMS Tables:**
```sql
courses (id, programme_id, title, description, trainer_id, duration, order_index)
modules (id, course_id, title, type, content_url, duration, order_index)
assessments (id, course_id, title, type, max_score, passing_score, duration)
assessment_results (id, assessment_id, trainee_id, score, passed, submitted_at)
```

**Attendance Tables:**
```sql
attendance_sessions (id, batch_id, date, session_type, qr_token, qr_expires_at, trainer_id)
attendance_records (id, session_id, trainee_id, method, status, timestamp)
```

**Skills & Certificates:**
```sql
skills (id, name, category, description)
trainee_skills (trainee_id, skill_id, proficiency, verified, source)
certificates (id, trainee_id, programme_id, certificate_number, issued_at, qr_code, status)
```

**Employment:**
```sql
employers (id, user_id, company_name, industry, location, description, organization_id)
jobs (id, employer_id, title, description, location, salary_min, salary_max, employment_type, status)
job_skills (job_id, skill_id)
job_applications (id, job_id, trainee_id, match_score, status, applied_at)
```

---

### Phase 4: New Dashboard Pages — Training ERP

#### [NEW] `app/dashboard/institutions/page.tsx`
- List all training institutions (VAMNICOM, RICM, ICM, etc.)
- CRUD for institutions (admin only)
- Stats: total trainees, active programmes, capacity

#### [NEW] `app/dashboard/programmes/page.tsx`
- List all training programmes
- Create programme flow: title → duration → capacity → assign institution → assign trainers → create batch
- Status filters: Active, Upcoming, Completed

#### [NEW] `app/dashboard/batches/page.tsx`
- List batches per programme
- Manage trainee enrollments
- View timetable/schedule

#### [NEW] `app/dashboard/trainees/page.tsx`
- List all registered trainees
- Trainee profile: education, skills, certificates, enrollment history
- Registration approval workflow

#### [NEW] `app/dashboard/trainers/page.tsx`
- List trainers with specializations
- Assign to programmes/batches

---

### Phase 5: New Dashboard Pages — LMS

#### [NEW] `app/dashboard/courses/page.tsx`
- Course catalog with modules (Video, PDF, Quiz)
- Progress tracking per trainee
- Assessment submission and scoring

#### [NEW] `app/dashboard/assessments/page.tsx`
- Assessment management (create, grade, view results)
- Quiz builder (MCQ, short answer)

---

### Phase 6: New Dashboard Pages — Attendance

#### [NEW] `app/dashboard/attendance/page.tsx`
- QR attendance: generate time-limited QR per session
- Attendance records with filters (date, batch, method)
- Stats: attendance rate per trainee/batch/programme

---

### Phase 7: New Dashboard Pages — Certificates & Skills

#### [NEW] `app/dashboard/certificates/page.tsx`
- Certificate generation after programme completion
- Unique certificate ID with QR verification
- Public verification page

#### [NEW] `app/dashboard/skill-passport/page.tsx`
- Digital Skill Passport view per trainee
- Skill proficiency bars
- Employment readiness score

---

### Phase 8: New Dashboard Pages — Employer Portal

#### [NEW] `app/dashboard/employers/page.tsx`
- Employer company profiles
- Job posting management
- Candidate matching (AI skill-match score)
- Application tracking

#### [NEW] `app/dashboard/jobs/page.tsx`
- Job listings with skill requirements
- AI-recommended candidates
- Application status tracking

---

### Phase 9: New API Routes

#### [NEW] API routes for each module:
```
app/api/v1/institutions/route.ts
app/api/v1/programmes/route.ts
app/api/v1/batches/route.ts
app/api/v1/trainees/route.ts
app/api/v1/trainers/route.ts
app/api/v1/enrollments/route.ts
app/api/v1/courses/route.ts
app/api/v1/modules/route.ts
app/api/v1/assessments/route.ts
app/api/v1/attendance/route.ts
app/api/v1/attendance/qr/route.ts
app/api/v1/certificates/route.ts
app/api/v1/certificates/verify/route.ts
app/api/v1/skills/route.ts
app/api/v1/employers/route.ts
app/api/v1/jobs/route.ts
app/api/v1/job-applications/route.ts
```

---

### Phase 10: New Services

#### [NEW] Services for each module:
```
services/institution.service.ts
services/programme.service.ts
services/batch.service.ts
services/trainee.service.ts
services/trainer.service.ts
services/enrollment.service.ts
services/course.service.ts
services/assessment.service.ts
services/attendance.service.ts
services/certificate.service.ts
services/skill.service.ts
services/employer.service.ts
services/job.service.ts
services/job-matching.service.ts
```

---

### Phase 11: New Roles & Permissions

#### [MODIFY] [dashboard-persona.ts](file:///f:/Projects/SIH%2026087/lib/auth/dashboard-persona.ts)
- Add new personas: `INSTITUTE_ADMIN`, `TRAINER`, `TRAINEE`, `EMPLOYER`
- Update resolver to include cooperative training roles

#### [NEW] New role codes to seed in Supabase:
```
INSTITUTE_ADMIN, TRAINER, TRAINEE, EMPLOYER
```

#### [NEW] New permissions:
```
institution:view, institution:manage
programme:view, programme:manage
batch:view, batch:manage
trainee:view, trainee:manage
trainer:view, trainer:manage
course:view, course:manage
assessment:view, assessment:manage
attendance:view, attendance:manage
certificate:view, certificate:manage
skill:view, skill:manage
employer:view, employer:manage
job:view, job:manage
```

---

### Phase 12: Updated Dashboard Overview

#### [MODIFY] [page.tsx](file:///f:/Projects/SIH%2026087/app/dashboard/page.tsx)
- Add cooperative training KPIs alongside existing ones:
  - Total Trainees, Active Programmes, Training Institutes, Certificates Issued, Employment Rate
- Add training-specific charts (enrollment trends, completion rates, employment pipeline)
- Keep existing project/task metrics for admin/employee personas

---

## Verification Plan

### Automated Tests
- `npm run build` — ensure no TypeScript compilation errors
- `npm run lint` — verify no lint issues
- `npm run test` — run existing unit tests to ensure nothing breaks

### Manual Verification
- Navigate through all new dashboard pages
- Verify sidebar navigation shows new cooperative training modules
- Confirm student/hackathon onboarding is removed
- Confirm existing enterprise features (Projects, Tasks, etc.) still work
- Test role-based visibility of new navigation items

---

## Implementation Order (Recommended)

1. **Remove student features** (cleanup)
2. **Rebrand + restructure navigation** (shell, logo, landing)
3. **Database migrations** (new tables)
4. **New services** (business logic)
5. **New API routes** (endpoints)
6. **New roles & permissions** (RBAC)
7. **Training ERP pages** (institutions, programmes, batches, trainees, trainers)
8. **LMS pages** (courses, assessments)
9. **Attendance pages** (QR attendance)
10. **Certificates & Skills pages**
11. **Employer Portal pages** (jobs, applications)
12. **Updated dashboard overview** (KPIs + charts)

> [!TIP]
> This plan focuses on the **MVP modules** (Phases 1-8 from REQUIREMENT.MD). Advanced features like Face Recognition, RAG Chatbot, Dropout Prediction, Offline PWA, and Hardware Integration can be added as follow-up phases.
