import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmployerService } from '@/services/employer.service';
import type { SupabaseClient } from '@supabase/supabase-js';

const ORG = '00000000-0000-0000-0000-0000000000a0';

function chainBuilder(terminal: () => Promise<{ data: any; error: any }>) {
  const builder: any = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    order: vi.fn(() => builder),
    single: () => terminal(),
    then: (resolve: any) => terminal().then(resolve),
  };
  return builder;
}

describe('EmployerService', () => {
  let mockSupabase: SupabaseClient;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listEmployers() returns employers scoped to the constructor org', async () => {
    const rows = [{ id: 'e1', company_name: 'Acme Co', organization_id: ORG }];
    mockSupabase = { from: vi.fn(() => chainBuilder(() => Promise.resolve({ data: rows, error: null }))) } as unknown as SupabaseClient;

    const svc = new EmployerService(mockSupabase, ORG);
    const result = await svc.listEmployers();

    expect(mockSupabase.from).toHaveBeenCalledWith('employers');
    expect(result).toEqual(rows);
  });

  it('listEmployers() throws on a query error', async () => {
    mockSupabase = { from: vi.fn(() => chainBuilder(() => Promise.resolve({ data: null, error: new Error('boom') }))) } as unknown as SupabaseClient;

    const svc = new EmployerService(mockSupabase, ORG);
    await expect(svc.listEmployers()).rejects.toThrow('boom');
  });

  it('createEmployer() inserts with the constructor org attached', async () => {
    const created = { id: 'e2', company_name: 'New Co', organization_id: ORG, user_id: 'u1' };
    let insertedPayload: any;
    mockSupabase = {
      from: vi.fn(() => {
        const builder: any = {
          insert: vi.fn((payload: any) => { insertedPayload = payload; return builder; }),
          select: vi.fn(() => builder),
          single: () => Promise.resolve({ data: created, error: null }),
        };
        return builder;
      }),
    } as unknown as SupabaseClient;

    const svc = new EmployerService(mockSupabase, ORG);
    const result = await svc.createEmployer({ user_id: 'u1', company_name: 'New Co' });

    expect(insertedPayload).toMatchObject({ user_id: 'u1', company_name: 'New Co', organization_id: ORG });
    expect(result).toEqual(created);
  });

  it('createEmployer() throws on a query error (e.g. RLS rejection)', async () => {
    mockSupabase = {
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: () => Promise.resolve({ data: null, error: new Error('new row violates row-level security policy') }),
          })),
        })),
      })),
    } as unknown as SupabaseClient;

    const svc = new EmployerService(mockSupabase, ORG);
    await expect(svc.createEmployer({ user_id: 'u1', company_name: 'New Co' }))
      .rejects.toThrow('row-level security');
  });

  it('updateEmployer() updates the row by id and stamps updated_at', async () => {
    const updated = { id: 'e1', company_name: 'Renamed Co' };
    let updatedPayload: any;
    let filteredId: any;
    mockSupabase = {
      from: vi.fn(() => {
        const builder: any = {
          update: vi.fn((payload: any) => { updatedPayload = payload; return builder; }),
          eq: vi.fn((_col: string, val: any) => { filteredId = val; return builder; }),
          select: vi.fn(() => builder),
          single: () => Promise.resolve({ data: updated, error: null }),
        };
        return builder;
      }),
    } as unknown as SupabaseClient;

    const svc = new EmployerService(mockSupabase, ORG);
    const result = await svc.updateEmployer('e1', { company_name: 'Renamed Co' });

    expect(filteredId).toBe('e1');
    expect(updatedPayload.company_name).toBe('Renamed Co');
    expect(updatedPayload.updated_at).toBeTruthy();
    expect(result).toEqual(updated);
  });
});
