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

  if (pathname.startsWith("/onboarding")) return null;

  return <BottomNavInner pathname={pathname} />;
}

function BottomNavInner({ pathname }: { pathname: string }) {
  const overdueCount = useLiveQuery(async () => {
    const all = await db.reminders.toArray();
    const todayStart = startOfDay(new Date());
    return all.filter((r) => !r.isCompleted && new Date(r.scheduledDate) < todayStart).length;
  }, [], 0);

  const isReminders = pathname.startsWith("/reminders");

  return (
    <>
      <div
        aria-hidden="true"
        className="w-full shrink-0 pointer-events-none"
        style={{ height: "calc(4rem + env(safe-area-inset-bottom))" }}
      />

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 backdrop-blur-xl bg-background/75 border-t border-border"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex h-16 max-w-2xl lg:max-w-5xl mx-auto">
          <Link
            href="/"
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors duration-150",
              !isReminders ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Home className="h-5 w-5" />
            <span>Parents</span>
            {!isReminders && (
              <span className="h-1 w-1 bg-primary rounded-full mt-0.5" />
            )}
          </Link>

          <Link
            href="/reminders"
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors duration-150",
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
            {isReminders && (
              <span className="h-1 w-1 bg-primary rounded-full mt-0.5" />
            )}
          </Link>
        </div>
      </nav>
    </>
  );
}
