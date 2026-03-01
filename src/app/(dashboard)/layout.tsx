import { requireAuth } from "@/lib/auth/session";
import { Sidebar } from "@/components/layout/sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { SessionProvider } from "@/components/session-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuth();

  return (
    <SessionProvider>
      <ThemeProvider>
        <TooltipProvider>
          <div className="flex h-screen overflow-hidden bg-background">
            <Sidebar />
            <main className="flex-1 overflow-y-auto">
              <div className="p-6 lg:p-8">{children}</div>
            </main>
          </div>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
