import { API_BASE_URL } from '@/lib/api-base';
import { requireUser } from '@/lib/requireUser';

export async function GET() {
  const user = await requireUser();
  const response = await fetch(`${API_BASE_URL}/ebay/authorize`, {
    redirect: 'manual',
    headers: {
      'x-omniseller-user-id': user.id,
    },
  });

  const location = response.headers.get('location');

  if (!location) {
    return new Response(await response.text(), { status: response.status });
  }

  return Response.redirect(location, 302);
}
