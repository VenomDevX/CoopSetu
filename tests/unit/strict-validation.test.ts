import { describe, it, expect } from 'vitest';
import { createTaskSchema, updateTaskSchema } from '@/lib/validation/task';
import { createProjectSchema } from '@/lib/validation/project';
import { createCommentSchema } from '@/lib/validation/comment';
import { createStudentTeamSchema } from '@/lib/validation/student-team';
import { updateOrganizationSchema } from '@/lib/validation/organization';
import { createReleaseSchema } from '@/lib/validation/delivery';
import { createBugSchema } from '@/lib/validation/qa-security';

/**
 * Proves the trust-boundary property: every request-body schema now rejects
 * (not silently drops) fields a legitimate client would never send —
 * especially ones shaped like privilege/ownership escalation attempts
 * (organization_id, role, is_admin, permissions, user_id).
 */
describe('.strict() trust-boundary rejection', () => {
  it('createTaskSchema rejects an injected organization_id', () => {
    const result = createTaskSchema.safeParse({
      project_id: '11111111-1111-1111-1111-111111111111',
      title: 'Valid task',
      organization_id: '22222222-2222-2222-2222-222222222222',
    });
    expect(result.success).toBe(false);
  });

  it('updateTaskSchema rejects an injected is_admin/role field', () => {
    const result = updateTaskSchema.safeParse({
      title: 'Renamed task',
      is_admin: true,
      role: 'ORG_ADMIN',
    });
    expect(result.success).toBe(false);
  });

  it('createProjectSchema rejects an unexpected field', () => {
    const result = createProjectSchema.safeParse({
      name: 'Project X',
      code: 'PX1',
      created_by: 'someone-elses-user-id',
    });
    expect(result.success).toBe(false);
  });

  it('createCommentSchema rejects an injected author/member id', () => {
    const result = createCommentSchema.safeParse({
      body: 'Hello world',
      author_member_id: '33333333-3333-3333-3333-333333333333',
    });
    expect(result.success).toBe(false);
  });

  it('createStudentTeamSchema rejects an injected role/permission override', () => {
    const result = createStudentTeamSchema.safeParse({
      name: 'Team Rocket',
      maxTeamSize: 5,
      roleCode: 'STUDENT_TEAM_LEAD',
    });
    expect(result.success).toBe(false);
  });

  it('updateOrganizationSchema rejects a client-supplied id override', () => {
    const result = updateOrganizationSchema.safeParse({
      name: 'Renamed Org',
      id: '44444444-4444-4444-4444-444444444444',
    });
    expect(result.success).toBe(false);
  });

  it('createReleaseSchema rejects a client-supplied approval override', () => {
    const result = createReleaseSchema.safeParse({
      project_id: '55555555-5555-5555-5555-555555555555',
      name: 'Release 1.0',
      version: '1.0.0',
      status: 'APPROVED',
    });
    expect(result.success).toBe(false);
  });

  it('createBugSchema rejects an injected assignee bypass field', () => {
    const result = createBugSchema.safeParse({
      title: 'Bug title',
      project_id: '66666666-6666-6666-6666-666666666666',
      primary_assignee_member_id: '77777777-7777-7777-7777-777777777777',
      assigned_by_admin_override: true,
    });
    expect(result.success).toBe(false);
  });

  it('legitimate, fully-conforming payloads still parse successfully', () => {
    expect(createCommentSchema.safeParse({ body: 'A normal comment' }).success).toBe(true);
    expect(
      createStudentTeamSchema.safeParse({ name: 'Team Rocket', maxTeamSize: 5 }).success,
    ).toBe(true);
    expect(updateOrganizationSchema.safeParse({ name: 'Renamed Org' }).success).toBe(true);
  });
});
