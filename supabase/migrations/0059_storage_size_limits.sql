-- ============================================================================
-- Handoff — 0059 Storage Size Limits (Security Phase D)
-- Enforces a 10MB (10485760 bytes) file size limit on public buckets to prevent DoS.
-- ============================================================================

-- Note: The native file_size_limit column on storage.buckets allows us to easily
-- reject files that exceed a certain size limit at the storage API layer.

update storage.buckets
set file_size_limit = 10485760 -- 10MB
where id in ('avatars', 'attachments', 'documents');
