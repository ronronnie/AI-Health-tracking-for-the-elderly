"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { startOfDay } from "date-fns";
import { AlertCircle, HeartPulse, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { AppHeader } from "@/components/app-header";
import { ParentCard } from "@/components/parent-card";

export default function HomePage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("parentcare_onboarded")) {
      router.replace("/onboarding");
    } else {
      setChecked(true);
    }
  }, [router]);

  const parents = useLiveQuery(
    () => db.parents.orderBy("createdAt").toArray(),
    []
  );

  const overdueCount = useLiveQuery(async () => {
    const all = await db.reminders.toArray();
    const todayStart = startOfDay(new Date());
    return all.filter((r) => !r.isCompleted && new Date(r.scheduledDate) < todayStart)
      .length;
  }, [], 0);

  if (!checked) return null;

  return (
    <div className="flex flex-col flex-1">
      <AppHeader />

      <main className="flex-1 px-4 py-6 pb-28">
        {!!overdueCount && (
          <Link href="/reminders">
            <div className="flex items-center gap-3 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 mb-5 cursor-pointer hover:bg-destructive/15 transition-colors">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-destructive">
                  {overdueCount} overdue reminder{overdueCount !== 1 ? "s" : ""}
                </p>
                <p className="text-xs text-destructive/70">Tap to view</p>
              </div>
            </div>
          </Link>
        )}

        <div className="flex items-center justify-between mt-2 mb-5">
          <h2 className="text-3xl font-semibold tracking-tight">My Parents</h2>
          <Button
            className="rounded-xl h-10"
            onClick={() => router.push("/parents/new")}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Parent
          </Button>
        </div>

        {parents === undefined ? null : parents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-5 text-center">
            <div className="h-20 w-20 rounded-full bg-accent flex items-center justify-center">
              <HeartPulse className="h-10 w-10 text-primary opacity-70" />
            </div>
            <div className="space-y-2 max-w-xs">
              <p className="text-xl font-semibold tracking-tight">Welcome to ParentCare</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Start by adding the parents you care for — you can add as many as you&apos;d like.
              </p>
            </div>
            <Button
              className="h-12 rounded-xl px-6 mt-2"
              onClick={() => router.push("/parents/new")}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Your First Parent
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {parents.map((parent) => (
              <ParentCard
                key={parent.id}
                parent={parent}
                onClick={() => router.push(`/parents/${parent.id}`)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
