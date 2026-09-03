-- Add totp_secret column to profiles table for hardware QR attendance (available to all users)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS totp_secret TEXT;
