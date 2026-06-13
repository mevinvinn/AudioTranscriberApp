import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = process.env.SUPABASE_BUCKET || 'audio';

export async function uploadAudioFile(
  buffer: Buffer,
  originalName: string,
  mimetype: string
): Promise<{ path: string; url: string }> {
  const ext = path.extname(originalName).toLowerCase();
  const filePath = `${uuidv4()}${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(filePath, buffer, {
    contentType: mimetype,
    upsert: false,
  });

  if (error) {
    throw new Error(`Failed to upload audio file: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  return { path: filePath, url: data.publicUrl };
}

export async function deleteAudioFile(filePath: string): Promise<void> {
  if (!filePath) return;
  await supabase.storage.from(BUCKET).remove([filePath]);
}
