import type { SupabaseClient } from '@supabase/supabase-js';
import { Errors } from '@/lib/api/errors';
import { createAuditLog } from '@/lib/audit/create-audit-log';
import { parseCsv } from '@/lib/csv';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ProjectImportMapping } from '@/lib/validation/group-a-actions';

const MAX_IMPORT_BYTES = 1024 * 1024;
const ALLOWED_MIME = new Set(['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain', '']);
const PRIORITIES = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const STATUSES = new Set(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']);

export interface ProjectImportRowResult {
  rowNumber: number;
  raw: Record<string, string>;
  mapped: Record<string, string>;
  status: 'VALID' | 'INVALID';
  errors: string[];
}

export interface ProjectImportPreview {
  importId: string;
  headers: string[];
  mapping: ProjectImportMapping;
  rows: ProjectImportRowResult[];
  summary: { valid: number; invalid: number; total: number };
}

function normalizeHeader(header: string) {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function guessProjectImportMapping(headers: string[]): ProjectImportMapping {
  const byName = new Map(headers.map((header) => [normalizeHeader(header), header]));
  const pick = (...names: string[]) => names.map((name) => byName.get(name)).find(Boolean);
  return {
    name: pick('name', 'projectname', 'title') ?? headers[0] ?? '',
    code: pick('code', 'projectcode', 'key') ?? headers[1] ?? headers[0] ?? '',
    description: pick('description', 'desc') ?? '',
    priority: pick('priority') ?? '',
    status: pick('status') ?? '',
    start_date: pick('startdate', 'start') ?? '',
    target_end_date: pick('targetdate', 'targetenddate', 'enddate') ?? '',
  };
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function read(raw: Record<string, string>, header?: string) {
  return header ? (raw[header] ?? '').trim() : '';
}

export function validateProjectImportRows(
  rows: Record<string, string>[],
  mapping: ProjectImportMapping,
  existingCodes: Set<string> = new Set(),
): ProjectImportRowResult[] {
  const seen = new Set<string>();
  return rows.map((raw, idx) => {
    const errors: string[] = [];
    const name = read(raw, mapping.name);
    const code = read(raw, mapping.code).toUpperCase();
    const description = read(raw, mapping.description);
    const priority = (read(raw, mapping.priority) || 'MEDIUM').toUpperCase();
    const status = (read(raw, mapping.status) || 'PLANNING').toUpperCase();
    const startDate = read(raw, mapping.start_date);
    const targetDate = read(raw, mapping.target_end_date);

    if (!name) errors.push('Project name is required.');
    if (name.length > 160) errors.push('Project name must be 160 characters or fewer.');
    if (!code) errors.push('Project code is required.');
    if (code && !/^[A-Z0-9]{1,20}$/.test(code)) errors.push('Project code must be 1-20 uppercase letters or numbers.');
    if (code && seen.has(code)) errors.push('Project code is duplicated in this CSV.');
    if (code && existingCodes.has(code)) errors.push('Project code already exists in this organization.');
    if (!PRIORITIES.has(priority)) errors.push('Priority must be LOW, MEDIUM, HIGH, or CRITICAL.');
    if (!STATUSES.has(status)) errors.push('Status must be PLANNING, ACTIVE, ON_HOLD, COMPLETED, or CANCELLED.');
    if (description.length > 5000) errors.push('Description must be 5000 characters or fewer.');
    if (startDate && !isIsoDate(startDate)) errors.push('Start date must use YYYY-MM-DD.');
    if (targetDate && !isIsoDate(targetDate)) errors.push('Target date must use YYYY-MM-DD.');
    if (code) seen.add(code);

    const mapped: Record<string, string> = { name, code, priority, status };
    if (description) mapped.description = description;
    if (startDate) mapped.start_date = startDate;
    if (targetDate) mapped.target_end_date = targetDate;

    return {
      rowNumber: idx + 2,
      raw,
      mapped,
      status: errors.length ? 'INVALID' : 'VALID',
      errors,
    };
  });
}

async function existingProjectCodes(supabase: SupabaseClient, orgId: string) {
  const { data, error } = await supabase.from('projects').select('code').eq('organization_id', orgId);
  if (error) throw Errors.internal(error.message);
  return new Set((data ?? []).map((row) => row.code));
}

export async function previewProjectImport(
  supabase: SupabaseClient,
  orgId: string,
  actorMemberId: string,
  file: File,
): Promise<ProjectImportPreview> {
  if (!file.name.toLowerCase().endsWith('.csv')) throw Errors.validation('Only .csv files are supported.');
  if (!ALLOWED_MIME.has(file.type)) throw Errors.validation('Only CSV files are supported.');
  if (file.size <= 0) throw Errors.validation('CSV file is empty.');
  if (file.size > MAX_IMPORT_BYTES) throw Errors.validation('CSV file must be 1 MB or smaller.');

  const text = await file.text();
  const parsed = parseCsv(text);
  const mapping = guessProjectImportMapping(parsed.headers);
  const existingCodes = await existingProjectCodes(supabase, orgId);
  const results = validateProjectImportRows(parsed.rows, mapping, existingCodes);
  const valid = results.filter((row) => row.status === 'VALID').length;
  const invalid = results.length - valid;

  const { data: job, error: jobError } = await supabase
    .from('import_jobs')
    .insert({
      organization_id: orgId,
      created_by_member_id: actorMemberId,
      import_type: 'PROJECTS',
      file_name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
      status: 'PREVIEWED',
      mapping,
      summary: { valid, invalid, total: results.length },
    })
    .select('id')
    .single();
  if (jobError) throw Errors.internal(jobError.message);

  const { error: rowsError } = await supabase.from('import_rows').insert(results.map((row) => ({
    import_job_id: job.id,
    row_number: row.rowNumber,
    raw_data: row.raw,
    mapped_data: row.mapped,
    status: row.status,
    errors: row.errors,
  })));
  if (rowsError) throw Errors.internal(rowsError.message);

  return {
    importId: job.id,
    headers: parsed.headers,
    mapping,
    rows: results.slice(0, 20),
    summary: { valid, invalid, total: results.length },
  };
}

export async function confirmProjectImport(
  supabase: SupabaseClient,
  orgId: string,
  actorMemberId: string,
  importId: string,
  mapping: ProjectImportMapping,
) {
  const { data: job, error: jobError } = await supabase
    .from('import_jobs')
    .select('id, status, import_type')
    .eq('id', importId)
    .eq('organization_id', orgId)
    .eq('created_by_member_id', actorMemberId)
    .maybeSingle();
  if (jobError) throw Errors.internal(jobError.message);
  if (!job) throw Errors.notFound('Import job not found.');
  if (job.import_type !== 'PROJECTS') throw Errors.validation('This import job is not for projects.');
  if (job.status !== 'PREVIEWED') throw Errors.conflict('This import job has already been confirmed or closed.');

  const { data: rawRows, error: rowsError } = await supabase
    .from('import_rows')
    .select('id, row_number, raw_data')
    .eq('import_job_id', importId)
    .order('row_number', { ascending: true });
  if (rowsError) throw Errors.internal(rowsError.message);

  const existingCodes = await existingProjectCodes(supabase, orgId);
  const results = validateProjectImportRows(
    (rawRows ?? []).map((row) => row.raw_data as Record<string, string>),
    mapping,
    existingCodes,
  );
  const validRows = results.filter((row) => row.status === 'VALID');
  const invalidRows = results.filter((row) => row.status === 'INVALID');

  const admin = createAdminClient();
  let created: { id: string; code: string; name: string }[] = [];
  if (validRows.length > 0) {
    const { data: inserted, error: insertError } = await admin
      .from('projects')
      .insert(validRows.map((row) => ({
        organization_id: orgId,
        name: row.mapped.name,
        code: row.mapped.code,
        description: row.mapped.description || null,
        priority: row.mapped.priority || 'MEDIUM',
        status: row.mapped.status || 'PLANNING',
        start_date: row.mapped.start_date || null,
        target_end_date: row.mapped.target_end_date || null,
      })))
      .select('id, code, name');
    if (insertError) throw Errors.internal(insertError.message);
    created = inserted ?? [];
  }

  const createdByCode = new Map(created.map((row) => [row.code, row.id]));
  await Promise.all((rawRows ?? []).map(async (row, idx) => {
    const result = results[idx];
    const createdId = result.status === 'VALID' ? createdByCode.get(result.mapped.code) ?? null : null;
    const nextStatus = result.status === 'INVALID' ? 'SKIPPED' : 'CREATED';
    const { error } = await supabase
      .from('import_rows')
      .update({
        mapped_data: result.mapped,
        status: nextStatus,
        errors: result.errors,
        created_resource_id: createdId,
      })
      .eq('id', row.id);
    if (error) throw Errors.internal(error.message);
  }));

  const summary = {
    created: created.length,
    skipped: invalidRows.length,
    failed: 0,
    total: results.length,
  };

  const { error: updateError } = await supabase
    .from('import_jobs')
    .update({ status: 'CONFIRMED', mapping, summary })
    .eq('id', importId)
    .eq('organization_id', orgId)
    .eq('created_by_member_id', actorMemberId);
  if (updateError) throw Errors.internal(updateError.message);

  await createAuditLog(supabase, {
    organizationId: orgId,
    actorMemberId,
    action: 'project.imported',
    resourceType: 'import_job',
    resourceId: importId,
    newValue: summary,
    metadata: {
      created_project_ids: created.map((row) => row.id),
      skipped_rows: invalidRows.map((row) => ({ rowNumber: row.rowNumber, errors: row.errors })),
    },
  });

  return {
    importId,
    summary,
    rows: results.map((row) => ({
      ...row,
      created_resource_id: row.status === 'VALID' ? createdByCode.get(row.mapped.code) ?? null : null,
    })),
  };
}
