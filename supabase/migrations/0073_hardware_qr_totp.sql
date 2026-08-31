-- Add totp_secret column to trainees table for hardware QR attendance
ALTER TABLE public.trainees ADD COLUMN IF NOT EXISTS totp_secret TEXT;
