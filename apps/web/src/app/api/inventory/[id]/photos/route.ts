export async function POST() {
  return new Response('Legacy photo attach route retired. Use the upload-request and complete photo flow.', {
    status: 410,
  });
}
