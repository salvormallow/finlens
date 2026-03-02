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
            <main className="flex-1 overflow-y-auto relative">
              {/* Ambient gradient glow */}
              <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
                <div className="absolute -top-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-primary/[0.07] blur-[120px]" />
                <div className="absolute -bottom-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-[oklch(0.6_0.15_200_/_0.05)] blur-[100px]" />
              </div>
              <div className="relative z-10 p-6 lg:p-8">{children}</div>
            </main>
          </div>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
