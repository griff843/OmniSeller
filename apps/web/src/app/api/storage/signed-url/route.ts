import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireUser } from '@/lib/requireUser';

export async function POST(req: NextRequest) {
  await requireUser();
  const { fileName } = await req.json();

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;
  const BUCKET = process.env.STORAGE_BUCKET!;

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(fileName);

  if (error) {
    return new Response(error.message, { status: 400 });
  }

  return Response.json(data);
}
