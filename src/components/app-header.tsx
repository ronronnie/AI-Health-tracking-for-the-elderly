"use client";

import Link from "next/link";
import { HeartPulse, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border">
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <HeartPulse className="h-5 w-5 text-primary" />
          <span className="font-semibold text-lg tracking-tight">ParentCare</span>
        </div>
        <Link href="/settings">
          <Button variant="ghost" size="icon" className="h-11 w-11">
            <Settings className="h-5 w-5" />
            <span className="sr-only">Settings</span>
          </Button>
        </Link>
      </div>
    </header>
  );
}
