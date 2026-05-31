"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { differenceInYears, parseISO, startOfDay } from "date-fns";
import { AlertCircle, ChevronRight, Plus, Settings, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/lib/db";

function ageLabel(dob: string) {
  return `${differenceInYears(new Date(), parseISO(dob))} years`;
}

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
    <div className="flex flex-col min-h-screen">
      {/* Sticky header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b">
        <div className="flex h-14 items-center justify-between px-4">
          <span className="font-semibold text-lg tracking-tight">
            ParentCare
          </span>
          <Link href="/settings">
            <Button variant="ghost" size="icon" className="h-11 w-11">
              <Settings className="h-5 w-5" />
              <span className="sr-only">Settings</span>
            </Button>
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 px-4 py-6 pb-28">
        {/* Overdue reminders banner */}
        {!!overdueCount && (
          <Link href="/reminders">
            <div className="flex items-center gap-3 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 mb-5 cursor-pointer hover:bg-destructive/15 transition-colors">
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

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-semibold">My Parents</h2>
          {/* Desktop add button */}
          <Button
            className="hidden sm:inline-flex h-11"
            onClick={() => router.push("/parents/new")}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Parent
          </Button>
        </div>

        {/* Loading or empty state */}
        {parents === undefined ? null : parents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <Users className="h-14 w-14 text-muted-foreground/30" />
            <div>
              <p className="font-medium">Add your first parent to get started</p>
              <p className="text-sm text-muted-foreground mt-1">
                Tap the button below to add a parent profile.
              </p>
            </div>
            <Button
              className="h-11 mt-2"
              onClick={() => router.push("/parents/new")}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Parent
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {parents.map((parent) => (
              <Card
                key={parent.id}
                className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.99] select-none"
                onClick={() => router.push(`/parents/${parent.id}`)}
              >
                <CardContent className="p-4 flex items-center justify-between min-h-[72px] gap-3">
                  <div className="space-y-1 min-w-0">
                    <p className="text-lg font-semibold leading-tight truncate">
                      {parent.name}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {parent.dateOfBirth && (
                        <span className="text-sm text-muted-foreground">
                          {ageLabel(parent.dateOfBirth)}
                        </span>
                      )}
                      {parent.gender && (
                        <Badge
                          variant="secondary"
                          className="capitalize text-xs"
                        >
                          {parent.gender}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Floating action button — mobile only, above bottom nav */}
      <div
        className="fixed right-6 sm:hidden"
        style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom) + 1rem)" }}
      >
        <Button
          size="icon"
          className="h-14 w-14 rounded-full shadow-lg"
          onClick={() => router.push("/parents/new")}
          aria-label="Add parent"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}
