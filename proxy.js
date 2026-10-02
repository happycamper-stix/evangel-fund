import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
// The legacy GOAT prototype included unsigned sessions, simulated payments and founder
// withdrawals. Keep its source as history, but never expose those endpoints in v0.
const identityMiddleware = clerkMiddleware();
export default function proxy(request, event) {
  if (
    process.env.VERCEL_ENV === "production" &&
    !process.env.CLERK_SECRET_KEY?.startsWith("sk_live_")
  ) {
    if (request.nextUrl.pathname === "/api/identity/verify")
      return NextResponse.json(
        { error: "Production identity verification is not configured." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    if (request.nextUrl.pathname === "/verify") return NextResponse.next();
  }
  if (
    request.nextUrl.pathname === "/verify" ||
    request.nextUrl.pathname.startsWith("/verify/") ||
    request.nextUrl.pathname === "/api/identity/verify"
  )
    return identityMiddleware(request, event);
  const path = request.nextUrl.pathname;
  if (
    path.startsWith("/api/") &&
    !path.startsWith("/api/solana/") &&
    path !== "/api/identity/verify"
  )
    return NextResponse.json(
      {
        error:
          "This prototype endpoint is retired. Use the current Evangel launchpad or funding APIs.",
      },
      { status: 410 },
    );
  if (
    [
      "/founder",
      "/oss",
      "/donor",
      "/investor",
      "/investor-donor",
      "/me",
      "/agent",
    ].some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
  )
    return NextResponse.redirect(new URL("/", request.url));
  return NextResponse.next();
}
export const config = {
  matcher: [
    "/verify/:path*",
    "/api/:path*",
    "/founder/:path*",
    "/oss/:path*",
    "/donor/:path*",
    "/investor/:path*",
    "/investor-donor/:path*",
    "/me/:path*",
    "/agent/:path*",
  ],
};
