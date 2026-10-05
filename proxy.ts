import { NextResponse, type NextRequest } from "next/server";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/token";

const publicPaths = new Set(["/login", "/register", "/forgot-password", "/reset-password"]);

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const session = await verifySessionToken(request.cookies.get(sessionCookieName)?.value).catch(() => null);
  const isPublic = publicPaths.has(pathname);
  if (!session && !isPublic) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ success: false, error: { message: "Authentication required" } }, { status: 401 });
    return NextResponse.redirect(new URL("/login", request.url));
  }
  // Keep sign-in and recovery accessible when a password reset revokes a cookie.
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|icon.png|logo.png|main-logo.png|favicon.ico).*)"] };
