import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;
const STORAGE_BUCKET = process.env.STORAGE_BUCKET ?? 'omniseller-images';

export function createStorageAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE);
}

export async function createSignedUpload(storageKey: string) {
  const supabase = createStorageAdminClient();
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUploadUrl(storageKey);

  if (error) {
    throw new Error(error.message);
  }

  const { data: publicData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storageKey);

  return {
    storageBucket: STORAGE_BUCKET,
    signedUploadUrl: data.signedUrl,
    token: data.token,
    path: data.path,
    publicUrl: publicData.publicUrl,
  };
}
