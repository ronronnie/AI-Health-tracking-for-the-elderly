"use client";

import { ChevronRight } from "lucide-react";
import { differenceInYears, parseISO } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import type { Parent } from "@/lib/db";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function ageLabel(dob: string): string {
  return `${differenceInYears(new Date(), parseISO(dob))} years`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface ParentCardProps {
  parent: Parent;
  onClick: () => void;
}

export function ParentCard({ parent, onClick }: ParentCardProps) {
  const subtitle = [
    parent.dateOfBirth ? ageLabel(parent.dateOfBirth) : null,
    parent.gender ? capitalize(parent.gender) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card
      className="cursor-pointer rounded-2xl border hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 select-none active:scale-[0.99]"
      onClick={onClick}
    >
      <CardContent className="p-5 flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-base font-semibold shrink-0">
          {initials(parent.name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold tracking-tight truncate">
            {parent.name}
          </p>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
      </CardContent>
    </Card>
  );
}
