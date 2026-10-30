-- Optional second factor for provisioned NTAG cards. Existing UID-only cards
-- remain readable during migration, while newly provisioned terminal cards use
-- a random credential whose digest is stored server-side.
ALTER TABLE public.rfid_cards
  ADD COLUMN IF NOT EXISTS credential_hash TEXT,
  ADD COLUMN IF NOT EXISTS security_level TEXT NOT NULL DEFAULT 'UID'
    CHECK (security_level IN ('UID', 'SHARED_SECRET', 'DESFIRE'));

ALTER TABLE public.rfid_capture_requests
  ADD COLUMN IF NOT EXISTS credential_hash TEXT;

ALTER TABLE public.rfid_cards
  ADD CONSTRAINT rfid_cards_credential_shape
  CHECK (
    (security_level = 'UID' AND credential_hash IS NULL)
    OR (security_level IN ('SHARED_SECRET', 'DESFIRE') AND credential_hash ~ '^[0-9a-f]{64}$')
  ) NOT VALID;

COMMENT ON COLUMN public.rfid_cards.security_level IS
  'UID is legacy/low assurance. SHARED_SECRET blocks UID-only clones. DESFIRE is reserved for cryptographic cards.';
