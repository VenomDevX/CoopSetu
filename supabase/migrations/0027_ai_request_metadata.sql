-- AI request metadata: record which model/intent produced each AI response and
-- when it completed. Additive only — existing rows keep working. The shared AI
-- layer (lib/ai/*) writes provider_mode='gemini', the resolved model name, the
-- intent, and stamps completed_at only on successful completion.

alter table public.ai_requests add column if not exists model_name text;
alter table public.ai_requests add column if not exists intent text;
alter table public.ai_requests add column if not exists completed_at timestamptz;
