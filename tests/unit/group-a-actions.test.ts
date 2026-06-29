import { describe, expect, it } from 'vitest';
import { parseCsv, toCsv } from '@/lib/csv';
import { guessProjectImportMapping, validateProjectImportRows } from '@/services/project-import.service';

describe('CSV helpers', () => {
  it('parses quoted commas and escaped quotes', () => {
    const parsed = parseCsv('Name,Code,Description\r\n"Ledger, Core",LGR,"Uses ""quotes"""');
    expect(parsed.headers).toEqual(['Name', 'Code', 'Description']);
    expect(parsed.rows).toEqual([
      { Name: 'Ledger, Core', Code: 'LGR', Description: 'Uses "quotes"' },
    ]);
  });

  it('escapes CSV output safely', () => {
    expect(toCsv(['name', 'notes'], [{ name: 'A,B', notes: 'Line "one"' }]))
      .toBe('name,notes\r\n"A,B","Line ""one"""');
  });
});

describe('project import validation', () => {
  it('guesses common project import headers', () => {
    const mapping = guessProjectImportMapping(['Project Name', 'Project Code', 'Target Date']);
    expect(mapping.name).toBe('Project Name');
    expect(mapping.code).toBe('Project Code');
    expect(mapping.target_end_date).toBe('Target Date');
  });

  it('rejects invalid rows without blocking valid rows', () => {
    const rows = validateProjectImportRows(
      [
        { Name: 'Valid Project', Code: 'VALID1', Priority: 'High', Status: 'Planning' },
        { Name: '', Code: 'bad code', Priority: 'Urgent', Status: 'Nope' },
        { Name: 'Duplicate', Code: 'VALID1', Priority: 'Low', Status: 'Active' },
      ],
      { name: 'Name', code: 'Code', priority: 'Priority', status: 'Status' },
      new Set(['EXISTS']),
    );

    expect(rows[0].status).toBe('VALID');
    expect(rows[0].mapped).toMatchObject({ name: 'Valid Project', code: 'VALID1', priority: 'HIGH', status: 'PLANNING' });
    expect(rows[1].status).toBe('INVALID');
    expect(rows[1].errors).toContain('Project name is required.');
    expect(rows[1].errors).toContain('Project code must be 1-20 uppercase letters or numbers.');
    expect(rows[2].status).toBe('INVALID');
    expect(rows[2].errors).toContain('Project code is duplicated in this CSV.');
  });

  it('rejects existing organization project codes', () => {
    const rows = validateProjectImportRows(
      [{ Name: 'Existing Project', Code: 'EXISTS' }],
      { name: 'Name', code: 'Code' },
      new Set(['EXISTS']),
    );
    expect(rows[0].status).toBe('INVALID');
    expect(rows[0].errors).toContain('Project code already exists in this organization.');
  });
});
