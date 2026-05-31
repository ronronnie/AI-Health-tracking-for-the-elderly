"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { addMonths } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// ── Helpers ────────────────────────────────────────────────────────────────

function toDateTimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultDate(): string {
  // default to 3 months from now at 9:00 AM
  const d = addMonths(new Date(), 3);
  d.setHours(9, 0, 0, 0);
  return toDateTimeLocal(d);
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function AddReminderPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const parentId = params.id as string;

  const prefillTitle = searchParams.get("title") ?? "";

  const [title, setTitle] = useState(prefillTitle);
  const [notes, setNotes] = useState("");
  const [scheduledDate, setScheduledDate] = useState(defaultDate);
  const [saving, setSaving] = useState(false);

  function setQuickDate(months: number) {
    const d = addMonths(new Date(), months);
    d.setHours(9, 0, 0, 0);
    setScheduledDate(toDateTimeLocal(d));
  }

  async function handleSave() {
    if (!title.trim() || !scheduledDate) return;
    setSaving(true);
    try {
      await db.reminders.add({
        id: crypto.randomUUID(),
        parentId,
        title: title.trim(),
        notes: notes.trim() || undefined,
        scheduledDate: new Date(scheduledDate).toISOString(),
        isCompleted: false,
        createdAt: new Date().toISOString(),
      });
      toast.success("Reminder saved");
      router.back();
    } catch {
      toast.error("Failed to save reminder");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-40 bg-background border-b">
        <div className="flex h-14 items-center px-4 gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 shrink-0"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back</span>
          </Button>
          <h1 className="font-semibold text-base">New Reminder</h1>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 space-y-5">
        {/* Title */}
        <div className="space-y-1.5">
          <Label htmlFor="reminder-title">Title *</Label>
          <Input
            id="reminder-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Repeat lipid profile"
            className="h-11"
            autoFocus={!prefillTitle}
          />
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <Label htmlFor="reminder-notes">Notes</Label>
          <Textarea
            id="reminder-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional details…"
            rows={3}
            className="resize-none"
          />
        </div>

        {/* Date + time */}
        <div className="space-y-1.5">
          <Label htmlFor="reminder-date">Date & Time</Label>
          <Input
            id="reminder-date"
            type="datetime-local"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            className="h-11"
          />
        </div>

        {/* Quick-pick buttons */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Quick pick</p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { label: "In 1 month", months: 1 },
                { label: "In 3 months", months: 3 },
                { label: "In 6 months", months: 6 },
                { label: "In 1 year", months: 12 },
              ] as const
            ).map(({ label, months }) => (
              <Button
                key={months}
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => setQuickDate(months)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {/* Save */}
        <Button
          className="w-full h-11 mt-4"
          disabled={!title.trim() || !scheduledDate || saving}
          onClick={handleSave}
        >
          {saving ? "Saving…" : "Save Reminder"}
        </Button>
      </main>
    </div>
  );
}
