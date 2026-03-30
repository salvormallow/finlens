export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: [
    // Protect all routes except auth, api/auth, api/setup, api/telegram, api/cron, and static files
    "/((?!login|api/auth|api/setup|api/telegram|api/cron|_next/static|_next/image|favicon.ico).*)",
  ],
};
