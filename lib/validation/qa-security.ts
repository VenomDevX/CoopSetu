import { z } from 'zod';

export const createBugSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().optional(),
  project_id: z.string().uuid('Valid project is required'),
  environment: z.string().optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  steps_to_reproduce: z.string().optional(),
  expected_result: z.string().optional(),
  actual_result: z.string().optional(),
  task_id: z.string().uuid().optional(),
  release_id: z.string().uuid().optional(),
  primary_assignee_member_id: z.string().uuid('Valid primary assignee is required'),
  additional_assignee_ids: z.array(z.string().uuid()).optional(),
  attachment_ids: z.array(z.string().uuid()).optional(),
});

export const createTestPlanSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  project_id: z.string().uuid('Valid project is required'),
  sprint_id: z.string().uuid().optional(),
  release_id: z.string().uuid().optional(),
  owner_member_id: z.string().uuid('Valid QA owner is required'),
  reviewer_ids: z.array(z.string().uuid()).optional(),
  task_ids: z.array(z.string().uuid()).optional(),
  environment: z.string().optional(),
  scope: z.string().optional(),
  acceptance_criteria: z.string().optional(),
  due_date: z.string().optional(),
  test_cases: z.array(z.object({
    title: z.string().min(1, 'Test case title is required'),
    preconditions: z.string().optional(),
    steps: z.string().optional(),
    expected_result: z.string().optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  })).optional(),
});

export const createSecurityReviewSchema = z.object({
  title: z.string().min(1, 'Review title is required').max(200),
  project_id: z.string().uuid('Valid project is required'),
  repository_id: z.string().uuid().optional(),
  release_id: z.string().uuid().optional(),
  task_id: z.string().uuid().optional(),
  reviewer_member_id: z.string().uuid('Valid primary reviewer is required'),
  additional_reviewer_ids: z.array(z.string().uuid()).optional(),
  risk_level: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  scope: z.string().optional(),
  description: z.string().optional(),
  due_date: z.string().optional(),
});
