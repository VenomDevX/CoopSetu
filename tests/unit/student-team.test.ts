import { describe, it, expect } from 'vitest';
import {
  createStudentTeamSchema,
  createSoloWorkspaceSchema,
  joinCodeSchema,
  updateMemberLabelsSchema,
} from '@/lib/validation/student-team';

describe('student-team validation', () => {
  describe('createStudentTeamSchema', () => {
    it('accepts a valid team payload', () => {
      const result = createStudentTeamSchema.safeParse({
        name: 'Byte Bandits',
        eventName: 'HackNYC',
        maxTeamSize: 5,
      });
      expect(result.success).toBe(true);
    });

    it('rejects maxTeamSize above the platform cap of 50', () => {
      const result = createStudentTeamSchema.safeParse({ name: 'Team', maxTeamSize: 51 });
      expect(result.success).toBe(false);
    });

    it('rejects maxTeamSize of 0 or negative', () => {
      expect(createStudentTeamSchema.safeParse({ name: 'Team', maxTeamSize: 0 }).success).toBe(false);
      expect(createStudentTeamSchema.safeParse({ name: 'Team', maxTeamSize: -1 }).success).toBe(false);
    });

    it('requires a name at least 2 characters', () => {
      expect(createStudentTeamSchema.safeParse({ name: 'A', maxTeamSize: 5 }).success).toBe(false);
    });
  });

  describe('createSoloWorkspaceSchema', () => {
    it('accepts a name-only payload', () => {
      expect(createSoloWorkspaceSchema.safeParse({ name: 'My Workspace' }).success).toBe(true);
    });
  });

  describe('joinCodeSchema', () => {
    it('accepts a well-formed code', () => {
      expect(joinCodeSchema.safeParse({ code: 'TEAM-7K4M-Q9PX' }).success).toBe(true);
    });

    it('rejects an empty code', () => {
      expect(joinCodeSchema.safeParse({ code: '' }).success).toBe(false);
    });
  });

  describe('updateMemberLabelsSchema', () => {
    it('accepts up to 10 labels', () => {
      const labels = Array.from({ length: 10 }, (_, i) => `Label ${i}`);
      expect(updateMemberLabelsSchema.safeParse({ labels }).success).toBe(true);
    });

    it('rejects more than 10 labels', () => {
      const labels = Array.from({ length: 11 }, (_, i) => `Label ${i}`);
      expect(updateMemberLabelsSchema.safeParse({ labels }).success).toBe(false);
    });

    it('rejects a label over 60 characters', () => {
      const labels = ['x'.repeat(61)];
      expect(updateMemberLabelsSchema.safeParse({ labels }).success).toBe(false);
    });
  });
});
