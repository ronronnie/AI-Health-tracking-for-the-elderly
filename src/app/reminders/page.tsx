"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import {
  addDays,
  addMonths,
  format,
  formatDistanceToNow,
  isSameDay,
  isToday,
  isPast,
  startOfDay,
} from "date-fns";
import { Check, ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { db } from "@/lib/db";
import type { Reminder } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// ── Helpers ────────────────────────────────────────────────────────────────

function toDateTimeLocal(isoString: string): string {
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function relativeLabel(isoString: string): string {
  const date = new Date(isoString);
  if (isPast(date) && !isToday(date)) {
    return `Overdue by ${formatDistanceToNow(date)}`;
  }
  if (isToday(date)) return `Today at ${format(date, "h:mm a")}`;
  if (isSameDay(date, addDays(new Date(), 1))) {
    return `Tomorrow at ${format(date, "h:mm a")}`;
  }
  return formatDistanceToNow(date, { addSuffix: true });
}

function isOverdue(isoString: string): boolean {
  return isPast(new Date(isoString)) && !isToday(new Date(isoString));
}

// ── Section component ──────────────────────────────────────────────────────

function Section({
  title,
  overdue,
  children,
}: {
  title: string;
  overdue?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2
        className={cn(
          "text-sm font-semibold uppercase tracking-wider mb-2",
          overdue ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {title}
      </h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

// ── Reminder row ───────────────────────────────────────────────────────────

function ReminderRow({
  reminder,
  parentName,
  onCheck,
  onEdit,
}: {
  reminder: Reminder;
  parentName: string;
  onCheck: () => void;
  onEdit: () => void;
}) {
  const overdue = isOverdue(reminder.scheduledDate);

  return (
    <Card
      className="cursor-pointer hover:shadow-sm transition-shadow active:scale-[0.99]"
      onClick={onEdit}
    >
      <CardContent className="p-4 flex items-start gap-3">
        <button
          className={cn(
            "mt-0.5 h-6 w-6 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors",
            reminder.isCompleted
              ? "bg-primary border-primary text-primary-foreground"
              : "border-muted-foreground/30 hover:border-primary"
          )}
          onClick={(e) => {
            e.stopPropagation();
            onCheck();
          }}
          aria-label={reminder.isCompleted ? "Mark incomplete" : "Mark complete"}
        >
          {reminder.isCompleted && <Check className="h-3.5 w-3.5" />}
        </button>

        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "text-sm font-medium leading-snug",
              reminder.isCompleted && "line-through text-muted-foreground"
            )}
          >
            {reminder.title}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{parentName}</p>
          {reminder.notes && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {reminder.notes}
            </p>
          )}
          <p
            className={cn(
              "text-xs mt-1 font-medium",
              overdue && !reminder.isCompleted
                ? "text-destructive"
                : "text-muted-foreground"
            )}
          >
            {relativeLabel(reminder.scheduledDate)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function RemindersPage() {
  const router = useRouter();
  const [showCompleted, setShowCompleted] = useState(false);

  // ── Edit dialog state ────────────────────────────────────────────────────
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  function openEdit(r: Reminder) {
    setEditing(r);
    setEditTitle(r.title);
    setEditNotes(r.notes ?? "");
    setEditDate(toDateTimeLocal(r.scheduledDate));
  }

  function setQuickDate(months: number) {
    const d = addMonths(new Date(), months);
    d.setHours(9, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, "0");
    setEditDate(
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    );
  }

  async function saveEdit() {
    if (!editing || !editTitle.trim()) return;
    setEditSaving(true);
    try {
      await db.reminders.update(editing.id, {
        title: editTitle.trim(),
        notes: editNotes.trim() || undefined,
        scheduledDate: new Date(editDate).toISOString(),
      });
      toast.success("Reminder updated");
      setEditing(null);
    } catch {
      toast.error("Failed to update reminder");
    } finally {
      setEditSaving(false);
    }
  }

  async function deleteReminder(id: string) {
    try {
      await db.reminders.delete(id);
      toast.success("Reminder deleted");
      setEditing(null);
    } catch {
      toast.error("Failed to delete reminder");
    }
  }

  async function toggleComplete(r: Reminder) {
    await db.reminders.update(r.id, { isCompleted: !r.isCompleted });
  }

  // ── Data ─────────────────────────────────────────────────────────────────
  const data = useLiveQuery(async () => {
    const [reminders, parents] = await Promise.all([
      db.reminders.orderBy("scheduledDate").toArray(),
      db.parents.toArray(),
    ]);
    const parentMap = new Map(parents.map((p) => [p.id, p.name]));
    return { reminders, parentMap };
  });

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const { reminders, parentMap } = data;
  const active = reminders.filter((r) => !r.isCompleted);
  const completed = reminders.filter((r) => r.isCompleted);

  const todayStart = startOfDay(new Date());
  const tomorrowStart = addDays(todayStart, 1);
  const weekEnd = addDays(todayStart, 7);

  const overdue = active.filter((r) => new Date(r.scheduledDate) < todayStart);
  const todayItems = active.filter((r) => {
    const d = new Date(r.scheduledDate);
    return d >= todayStart && d < tomorrowStart;
  });
  const thisWeek = active.filter((r) => {
    const d = new Date(r.scheduledDate);
    return d >= tomorrowStart && d < weekEnd;
  });
  const later = active.filter((r) => new Date(r.scheduledDate) >= weekEnd);

  const isEmpty =
    overdue.length === 0 &&
    todayItems.length === 0 &&
    thisWeek.length === 0 &&
    later.length === 0 &&
    completed.length === 0;

  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b">
        <div className="flex h-14 items-center px-4">
          <h1 className="font-semibold text-lg tracking-tight">Reminders</h1>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 space-y-6 pb-8">
        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <p className="font-medium">No reminders yet</p>
            <p className="text-sm text-muted-foreground">
              Add reminders from a parent's profile page or from a report's
              next-steps section.
            </p>
          </div>
        )}

        {overdue.length > 0 && (
          <Section title="Overdue" overdue>
            {overdue.map((r) => (
              <ReminderRow
                key={r.id}
                reminder={r}
                parentName={parentMap.get(r.parentId) ?? "Unknown"}
                onCheck={() => toggleComplete(r)}
                onEdit={() => openEdit(r)}
              />
            ))}
          </Section>
        )}

        {todayItems.length > 0 && (
          <Section title="Today">
            {todayItems.map((r) => (
              <ReminderRow
                key={r.id}
                reminder={r}
                parentName={parentMap.get(r.parentId) ?? "Unknown"}
                onCheck={() => toggleComplete(r)}
                onEdit={() => openEdit(r)}
              />
            ))}
          </Section>
        )}

        {thisWeek.length > 0 && (
          <Section title="This week">
            {thisWeek.map((r) => (
              <ReminderRow
                key={r.id}
                reminder={r}
                parentName={parentMap.get(r.parentId) ?? "Unknown"}
                onCheck={() => toggleComplete(r)}
                onEdit={() => openEdit(r)}
              />
            ))}
          </Section>
        )}

        {later.length > 0 && (
          <Section title="Later">
            {later.map((r) => (
              <ReminderRow
                key={r.id}
                reminder={r}
                parentName={parentMap.get(r.parentId) ?? "Unknown"}
                onCheck={() => toggleComplete(r)}
                onEdit={() => openEdit(r)}
              />
            ))}
          </Section>
        )}

        {/* Completed section (collapsible) */}
        {completed.length > 0 && (
          <section>
            <button
              className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2"
              onClick={() => setShowCompleted((v) => !v)}
            >
              {showCompleted ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              Completed ({completed.length})
            </button>
            {showCompleted && (
              <div className="flex flex-col gap-2">
                {completed.map((r) => (
                  <ReminderRow
                    key={r.id}
                    reminder={r}
                    parentName={parentMap.get(r.parentId) ?? "Unknown"}
                    onCheck={() => toggleComplete(r)}
                    onEdit={() => openEdit(r)}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Reminder</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="edit-r-title">Title *</Label>
              <Input
                id="edit-r-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-r-notes">Notes</Label>
              <Textarea
                id="edit-r-notes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-r-date">Date & Time</Label>
              <Input
                id="edit-r-date"
                type="datetime-local"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="h-11"
              />
            </div>

            {/* Quick-pick */}
            <div className="flex flex-wrap gap-2">
              {[
                { label: "1 mo", months: 1 },
                { label: "3 mo", months: 3 },
                { label: "6 mo", months: 6 },
                { label: "1 yr", months: 12 },
              ].map(({ label, months }) => (
                <Button
                  key={months}
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => setQuickDate(months)}
                >
                  {label}
                </Button>
              ))}
            </div>

            {/* Danger zone */}
            <Button
              variant="destructive"
              className="w-full h-11"
              onClick={() => editing && deleteReminder(editing.id)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Reminder
            </Button>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="h-11"
              onClick={() => setEditing(null)}
            >
              Cancel
            </Button>
            <Button
              className="h-11"
              disabled={!editTitle.trim() || editSaving}
              onClick={saveEdit}
            >
              {editSaving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
