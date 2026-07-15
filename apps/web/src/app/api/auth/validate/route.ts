import { requireUser } from '@/lib/requireUser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireUser();
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ message: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
}
