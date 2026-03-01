export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: [
    // Protect all routes except auth, api/auth, api/setup, and static files
    "/((?!login|api/auth|api/setup|_next/static|_next/image|favicon.ico).*)",
  ],
};
