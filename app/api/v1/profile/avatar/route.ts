import { NextRequest } from 'next/server';
import { handle, ok } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/* ── POST /api/v1/profile/avatar ─── Upload profile picture ──── */
export async function POST(req: NextRequest) {
  return handle(async () => {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) throw Errors.unauthenticated();

  const formData = await req.formData();
  const file = formData.get('avatar') as File | null;

  if (!file) throw Errors.validation('No file provided.');

  // Validate file type against a whitelist, and derive both the stored
  // extension and the served content-type from that whitelist — never from the
  // client-supplied filename or MIME string, so neither can smuggle an
  // unexpected extension/content-type into the storage path.
  const MIME_TO_EXT: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  const ext = MIME_TO_EXT[file.type];
  if (!ext) {
    throw Errors.validation('Only JPEG, PNG, WebP, and GIF images are allowed.');
  }

  // Validate file size (max 2MB)
  if (file.size > 2 * 1024 * 1024) {
    throw Errors.validation('File size must be under 2MB.');
  }

  const filePath = `avatars/${user.id}.${ext}`;

  // Convert File to Buffer for Node.js Supabase client
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Upload to Supabase Storage
  const admin = createAdminClient();
  const { error: uploadErr } = await admin.storage
    .from('avatars')
    .upload(filePath, buffer, {
      upsert: true,
      contentType: file.type,
    });

  if (uploadErr) {
    throw Errors.internal(`Failed to upload avatar: ${uploadErr.message}`);
  }

  // Get public URL
  const { data: urlData } = admin.storage
    .from('avatars')
    .getPublicUrl(filePath);

  const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

  // Update profile
  await admin
    .from('profiles')
    .update({ avatar_path: avatarUrl })
    .eq('id', user.id);

  return ok({ avatarUrl });
  });
}

/* ── DELETE /api/v1/profile/avatar ─── Remove profile picture ── */
export async function DELETE() {
  return handle(async () => {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) throw Errors.unauthenticated();

  const admin = createAdminClient();

  // Remove the file from storage (try all common extensions)
  for (const ext of ['jpg', 'png', 'webp', 'gif', 'jpeg']) {
    await admin.storage.from('avatars').remove([`avatars/${user.id}.${ext}`]);
  }

  // Clear avatar_path in profile
  await admin
    .from('profiles')
    .update({ avatar_path: null })
    .eq('id', user.id);

  return ok({ message: 'Avatar removed.' });
  });
}
