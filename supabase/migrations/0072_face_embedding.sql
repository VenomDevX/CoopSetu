-- Add face_embedding column to trainees table for face recognition
-- Stores a 128-dimensional float vector as JSONB array
ALTER TABLE public.trainees ADD COLUMN IF NOT EXISTS face_embedding JSONB;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_trainees_face_embedding ON public.trainees USING GIN (face_embedding) WHERE face_embedding IS NOT NULL;
