import { createClient } from '@supabase/supabase-js';

const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const STORAGE_BUCKET = process.env.STORAGE_BUCKET ?? 'omniseller-images';
const LOCAL_STORAGE_PREFIX = '/local-uploads';

function isConfiguredSupabaseStorage() {
  return Boolean(NEXT_PUBLIC_SUPABASE_URL && SUPABASE_SERVICE_ROLE);
}

export function isLocalStorageFallbackEnabled() {
  return !isConfiguredSupabaseStorage() && process.env.NODE_ENV !== 'production';
}

export function createStorageAdminClient() {
  if (!isConfiguredSupabaseStorage()) {
    throw new Error('Supabase storage is not configured');
  }

  return createClient(NEXT_PUBLIC_SUPABASE_URL!, SUPABASE_SERVICE_ROLE!);
}

export async function createSignedUpload(storageKey: string) {
  if (isLocalStorageFallbackEnabled()) {
    const encodedKey = encodeURIComponent(storageKey);

    return {
      storageBucket: STORAGE_BUCKET,
      signedUploadUrl: `/api/storage/local-upload?key=${encodedKey}`,
      token: 'local-dev-upload',
      path: storageKey,
      publicUrl: `${LOCAL_STORAGE_PREFIX}/${storageKey}`,
    };
  }

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
