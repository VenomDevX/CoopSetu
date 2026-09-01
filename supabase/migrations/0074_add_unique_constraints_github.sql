-- Add unique constraints to pull_requests and commits for ON CONFLICT upserts
alter table public.pull_requests add constraint pull_requests_repository_id_external_id_key unique (repository_id, external_id);
alter table public.commits add constraint commits_repository_id_external_hash_key unique (repository_id, external_hash);
