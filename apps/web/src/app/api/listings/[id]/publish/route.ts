export async function POST(_: Request, { params }: { params: { id: string } }) {
  const r = await fetch(`http://localhost:3001/listings/${params.id}/publish?marketplace=ebay`, {
    method: 'POST',
  });
  const text = await r.text();
  return new Response(text, {
    status: r.status,
    headers: {
      'content-type': r.headers.get('content-type') ?? 'application/json; charset=utf-8',
    },
  });
}
