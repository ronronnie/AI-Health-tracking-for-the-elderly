"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Home } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { cn } from "@/lib/utils";
import { db } from "@/lib/db";
import { startOfDay } from "date-fns";

export function BottomNav() {
  const pathname = usePathname();

  // Never show on onboarding
  if (pathname.startsWith("/onboarding")) return null;

  return <BottomNavInner pathname={pathname} />;
}

// Separate component so hooks only run when nav is shown
function BottomNavInner({ pathname }: { pathname: string }) {
  const overdueCount = useLiveQuery(async () => {
    const all = await db.reminders.toArray();
    const todayStart = startOfDay(new Date());
    return all.filter((r) => !r.isCompleted && new Date(r.scheduledDate) < todayStart).length;
  }, [], 0);

  const isReminders = pathname.startsWith("/reminders");

  return (
    <>
      {/* In-flow spacer — ensures the bottom of every page can scroll above the fixed nav */}
      <div
        aria-hidden="true"
        className="w-full shrink-0 pointer-events-none"
        style={{ height: "calc(3.5rem + env(safe-area-inset-bottom))" }}
      />

      {/* Fixed tab bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex h-14 max-w-xl mx-auto">
          <Link
            href="/"
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors",
              !isReminders ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Home className="h-5 w-5" />
            <span>Parents</span>
          </Link>

          <Link
            href="/reminders"
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors",
              isReminders ? "text-primary" : "text-muted-foreground"
            )}
          >
            <div className="relative">
              <Bell className="h-5 w-5" />
              {overdueCount ? (
                <span className="absolute -top-1 -right-2 h-4 min-w-4 px-0.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                  {overdueCount > 9 ? "9+" : overdueCount}
                </span>
              ) : null}
            </div>
            <span>Reminders</span>
          </Link>
        </div>
      </nav>
    </>
  );
}
