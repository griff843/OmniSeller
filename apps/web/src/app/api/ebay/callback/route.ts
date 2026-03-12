export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = url.searchParams.toString();
  const r = await fetch(`http://localhost:3001/ebay/callback?${query}`);
  const text = await r.text();
  return new Response(text, { status: r.status, headers: { 'Content-Type': 'text/plain' } });
}
