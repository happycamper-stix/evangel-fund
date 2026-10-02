export function GET() {
  return Response.json(
    { error: "The prototype APIs are retired. Use the Evangel v0 protocol." },
    { status: 410 },
  );
}
export const POST = GET;
export const PUT = GET;
export const PATCH = GET;
export const DELETE = GET;
