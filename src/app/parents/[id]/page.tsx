"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import {
  differenceInYears,
  format,
  formatDistanceToNow,
  isToday,
  isPast,
  isSameDay,
  addDays,
  parseISO,
} from "date-fns";
import {
  Bell,
  Camera,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Pencil,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { db } from "@/lib/db";
import { parseReport, healthCheck } from "@/lib/services/api";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

// ── Constants ──────────────────────────────────────────────────────────────

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"];

const TRAFFIC_LIGHT_STYLES = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  yellow: "bg-amber-50 text-amber-700 border-amber-200",
  red: "bg-rose-50 text-rose-700 border-rose-200",
} as const;

// ── Types ──────────────────────────────────────────────────────────────────

type UploadPhase =
  | { phase: "idle" }
  | { phase: "choosing" }
  | { phase: "parsing" }
  | { phase: "error"; message: string; isNetwork?: boolean };

const PARSE_MESSAGES = [
  "Extracting text from the report…",
  "Identifying abnormal values…",
  "Looking up reference passages…",
  "Generating cited explanations…",
] as const;

// ── Helpers ────────────────────────────────────────────────────────────────

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function ageLabel(dob: string) {
  return `${differenceInYears(new Date(), parseISO(dob))} years`;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function ParentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  // ── Queries ──────────────────────────────────────────────────────────────
  const parent = useLiveQuery(
    async () => (await db.parents.get(id)) ?? null,
    [id]
  );

  const reports = useLiveQuery(
    async () => {
      const all = await db.reports.where("parentId").equals(id).toArray();
      return all.sort((a, b) => b.reportDate.localeCompare(a.reportDate));
    },
    [id]
  );

  const reminders = useLiveQuery(
    async () => {
      const all = await db.reminders.where("parentId").equals(id).toArray();
      return all
        .filter((r) => !r.isCompleted)
        .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
    },
    [id]
  );

  // ── Edit dialog state ────────────────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [bloodType, setBloodType] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editOpen) setConfirmDelete(false);
  }, [editOpen]);

  function openEdit() {
    if (!parent) return;
    setName(parent.name);
    setDob(parent.dateOfBirth ?? "");
    setGender(parent.gender ?? "");
    setBloodType(parent.bloodType ?? "");
    setNotes(parent.notes ?? "");
    setEditOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await db.parents.update(id, {
        name: name.trim(),
        dateOfBirth: dob || undefined,
        gender:
          gender && gender !== "_none"
            ? (gender as "male" | "female" | "other")
            : undefined,
        bloodType: bloodType || undefined,
        notes: notes.trim() || undefined,
      });
      toast.success("Changes saved");
      setEditOpen(false);
    } catch {
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteParent() {
    try {
      await db.transaction(
        "rw",
        [db.parents, db.reports, db.labValues, db.reminders],
        async () => {
          const allReports = await db.reports.where("parentId").equals(id).toArray();
          for (const r of allReports) {
            await db.labValues.where("reportId").equals(r.id).delete();
          }
          await db.reports.where("parentId").equals(id).delete();
          await db.reminders.where("parentId").equals(id).delete();
          await db.parents.delete(id);
        }
      );
      toast.success("Parent deleted");
      router.replace("/");
    } catch {
      toast.error("Failed to delete");
    }
  }

  // ── Upload / parse flow ──────────────────────────────────────────────────
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>({ phase: "idle" });
  const [parseMessageIndex, setParseMessageIndex] = useState(0);
  const [testingHealth, setTestingHealth] = useState(false);
  const [healthTestResult, setHealthTestResult] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (uploadPhase.phase !== "parsing") return;
    setParseMessageIndex(0);
    const interval = setInterval(() => {
      setParseMessageIndex((i) => (i + 1) % PARSE_MESSAGES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [uploadPhase.phase]);

  async function handleTestConnection() {
    setTestingHealth(true);
    setHealthTestResult(null);
    try {
      const result = await healthCheck();
      setHealthTestResult(
        `Backend is running · ${result.corpus_chunks} corpus chunks loaded`
      );
    } catch {
      setHealthTestResult("Backend not reachable — is it running?");
    } finally {
      setTestingHealth(false);
    }
  }

  async function processFile(file: File) {
    if (file.size > 20 * 1024 * 1024) {
      toast.warning("File is larger than 20 MB — saving may be slow.");
    }

    setUploadPhase({ phase: "parsing" });

    let parsed;
    try {
      parsed = await parseReport(file);
    } catch (err) {
      const isNetwork = err instanceof TypeError;
      const message = isNetwork
        ? "Couldn't reach the parser service. Make sure the backend is running at http://localhost:8000."
        : err instanceof Error
        ? err.message
        : "Something went wrong.";
      setUploadPhase({ phase: "error", message, isNetwork });
      return;
    }

    const reportId = crypto.randomUUID();
    const today = new Date().toISOString().split("T")[0];

    try {
      await db.transaction("rw", [db.reports, db.labValues], async () => {
        await db.reports.add({
          id: reportId,
          parentId: id,
          reportDate: parsed.patient.report_date ?? today,
          labName: parsed.patient.lab_name ?? undefined,
          testPanel: parsed.test_panel,
          originalFileName: file.name,
          originalFileBlob: file,
          trafficLight: parsed.summary.traffic_light,
          headline: parsed.summary.headline,
          abnormalCount: parsed.summary.abnormal_count,
          patternsDetected: parsed.summary.patterns_detected,
          nextSteps: parsed.summary.next_steps,
          disclaimer: parsed.disclaimer,
          parseCostInr: parsed.meta.rag_estimated_cost_inr,
          parsedJson: JSON.stringify(parsed),
          createdAt: new Date().toISOString(),
        });

        for (const v of parsed.values) {
          await db.labValues.add({
            id: crypto.randomUUID(),
            reportId,
            name: v.name,
            value: v.value,
            unit: v.unit || undefined,
            referenceRange: v.reference_range || undefined,
            status: v.status,
            explanation: v.explanation,
            citedExplanation: v.cited_explanation,
            sources: v.sources ? JSON.stringify(v.sources) : undefined,
            userEdited: false,
          });
        }
      });
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      console.error("Dexie save error:", e);
      setUploadPhase({
        phase: "error",
        message: `Parsed OK but save failed: ${detail}`,
      });
      return;
    }

    setUploadPhase({ phase: "idle" });
    router.push(`/parents/${id}/reports/${reportId}`);
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) processFile(file);
  }

  function handlePdfChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) processFile(file);
  }

  // ── Loading / not-found ──────────────────────────────────────────────────
  if (parent === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (parent === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground">Parent not found.</p>
        <Button onClick={() => router.replace("/")}>Go home</Button>
      </div>
    );
  }

  const subtitle = [
    parent.dateOfBirth ? ageLabel(parent.dateOfBirth) : null,
    parent.gender ? capitalize(parent.gender) : null,
    parent.bloodType ?? null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col flex-1">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="flex h-14 items-center justify-between px-3">
          <Button
            variant="ghost"
            className="gap-1 px-2 h-11 text-muted-foreground hover:text-foreground"
            onClick={() => router.back()}
          >
            <ChevronLeft className="h-5 w-5" />
            Back
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11"
            onClick={openEdit}
            aria-label="Edit parent"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 pb-28 space-y-6">
        {/* Hero card */}
        <Card className="rounded-2xl">
          <CardContent className="p-6 flex flex-col items-center text-center gap-3">
            <div className="h-16 w-16 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xl font-semibold">
              {initials(parent.name)}
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{parent.name}</h1>
              {subtitle && (
                <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
              )}
              {parent.notes && (
                <p className="text-sm text-foreground/70 mt-2 whitespace-pre-wrap leading-relaxed max-w-xs mx-auto">
                  {parent.notes}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Reports section */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold tracking-tight">Reports</h2>
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-xl"
              onClick={() => setUploadPhase({ phase: "choosing" })}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Report
            </Button>
          </div>
          <Separator className="mb-4" />

          {!reports || reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-center rounded-2xl border bg-muted/20">
              <FileText className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No reports yet</p>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl h-9"
                onClick={() => setUploadPhase({ phase: "choosing" })}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Report
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {reports.map((report) => (
                <Card
                  key={report.id}
                  className="cursor-pointer rounded-2xl hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 active:scale-[0.99]"
                  onClick={() =>
                    router.push(`/parents/${id}/reports/${report.id}`)
                  }
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
                        TRAFFIC_LIGHT_STYLES[report.trafficLight]
                      )}
                    >
                      {report.trafficLight === "green"
                        ? "Clear"
                        : report.trafficLight === "yellow"
                        ? "Review"
                        : "Attn"}
                    </span>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {format(parseISO(report.reportDate), "d MMM yyyy")}
                      </p>
                      {report.labName && (
                        <p className="text-xs text-muted-foreground truncate">
                          {report.labName}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {report.abnormalCount > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {report.abnormalCount} abnormal
                        </Badge>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Reminders section */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold tracking-tight">Reminders</h2>
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-xl"
              onClick={() => router.push(`/parents/${id}/reminders/new`)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Reminder
            </Button>
          </div>
          <Separator className="mb-4" />

          {!reminders || reminders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-center rounded-2xl border bg-muted/20">
              <Bell className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No reminders yet</p>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl h-9"
                onClick={() => router.push(`/parents/${id}/reminders/new`)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Reminder
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {reminders.map((r) => {
                const date = new Date(r.scheduledDate);
                const overdue = isPast(date) && !isToday(date);
                let label: string;
                if (overdue) {
                  label = `Overdue by ${formatDistanceToNow(date)}`;
                } else if (isToday(date)) {
                  label = `Today at ${format(date, "h:mm a")}`;
                } else if (isSameDay(date, addDays(new Date(), 1))) {
                  label = `Tomorrow at ${format(date, "h:mm a")}`;
                } else {
                  label = formatDistanceToNow(date, { addSuffix: true });
                }
                return (
                  <div
                    key={r.id}
                    className="flex items-start gap-3 rounded-xl border bg-card px-4 py-3"
                  >
                    <button
                      className="mt-0.5 h-6 w-6 shrink-0 rounded-full border-2 border-muted-foreground/30 hover:border-primary flex items-center justify-center transition-colors"
                      onClick={async () => {
                        await db.reminders.update(r.id, { isCompleted: true });
                        toast.success("Marked as done");
                      }}
                      aria-label="Mark complete"
                    >
                      <span className="sr-only">Done</span>
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug">{r.title}</p>
                      {r.notes && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {r.notes}
                        </p>
                      )}
                      <p
                        className={
                          overdue
                            ? "text-xs mt-1 font-medium text-destructive"
                            : "text-xs mt-1 text-muted-foreground"
                        }
                      >
                        {label}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* ── Hidden file inputs ──────────────────────────────────────────── */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        onChange={handlePhotoChange}
      />
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf"
        className="sr-only"
        tabIndex={-1}
        onChange={handlePdfChange}
      />

      {/* ── Upload choosing dialog ──────────────────────────────────────── */}
      <Dialog
        open={uploadPhase.phase === "choosing"}
        onOpenChange={(open) => {
          if (!open) setUploadPhase({ phase: "idle" });
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Add Report</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-1">
            <Button
              variant="outline"
              className="h-12 justify-start gap-3 text-base font-normal rounded-xl"
              onClick={() => {
                setUploadPhase({ phase: "idle" });
                setTimeout(() => photoInputRef.current?.click(), 100);
              }}
            >
              <Camera className="h-5 w-5 shrink-0" />
              Take photo or choose photo
            </Button>
            <Button
              variant="outline"
              className="h-12 justify-start gap-3 text-base font-normal rounded-xl"
              onClick={() => {
                setUploadPhase({ phase: "idle" });
                setTimeout(() => pdfInputRef.current?.click(), 100);
              }}
            >
              <FileText className="h-5 w-5 shrink-0" />
              Upload PDF
            </Button>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="h-11 rounded-xl"
              onClick={() => setUploadPhase({ phase: "idle" })}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Parsing overlay ─────────────────────────────────────────────── */}
      {uploadPhase.phase === "parsing" && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center gap-6 px-8 text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <div className="space-y-2 max-w-xs">
            <p className="text-lg font-semibold">Reading the report…</p>
            <p className="text-sm text-muted-foreground">
              This usually takes 30–60 seconds.
            </p>
            <p className="text-sm text-primary font-medium min-h-[1.25rem] transition-all">
              {PARSE_MESSAGES[parseMessageIndex]}
            </p>
          </div>
        </div>
      )}

      {/* ── Error dialog ────────────────────────────────────────────────── */}
      <Dialog
        open={uploadPhase.phase === "error"}
        onOpenChange={(open) => {
          if (!open) {
            setUploadPhase({ phase: "idle" });
            setHealthTestResult(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Could not parse report</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {uploadPhase.phase === "error" ? uploadPhase.message : ""}
            </p>
            {uploadPhase.phase === "error" && uploadPhase.isNetwork && (
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-xl w-full"
                  onClick={handleTestConnection}
                  disabled={testingHealth}
                >
                  {testingHealth ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                      Testing connection…
                    </>
                  ) : (
                    "Test connection"
                  )}
                </Button>
                {healthTestResult && (
                  <p
                    className={cn(
                      "text-xs px-3 py-2 rounded-lg",
                      healthTestResult.includes("running")
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-rose-50 text-rose-700"
                    )}
                  >
                    {healthTestResult}
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="h-11 rounded-xl"
              onClick={() => {
                setUploadPhase({ phase: "idle" });
                setHealthTestResult(null);
              }}
            >
              Cancel
            </Button>
            <Button
              className="h-11 rounded-xl"
              onClick={() => {
                setHealthTestResult(null);
                setUploadPhase({ phase: "choosing" });
              }}
            >
              Try again
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit dialog ─────────────────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit {parent.name}</DialogTitle>
          </DialogHeader>

          {!confirmDelete ? (
            <>
              <div className="space-y-4 py-1">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-name">Full Name *</Label>
                  <Input
                    id="edit-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-12 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-dob">Date of Birth</Label>
                  <Input
                    id="edit-dob"
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="h-12 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Gender</Label>
                  <Select
                    value={gender}
                    onValueChange={(v) => setGender(v ?? "")}
                  >
                    <SelectTrigger className="h-12 rounded-xl">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                      <SelectItem value="_none">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Blood Type</Label>
                  <Select
                    value={bloodType}
                    onValueChange={(v) => setBloodType(v ?? "")}
                  >
                    <SelectTrigger className="h-12 rounded-xl">
                      <SelectValue placeholder="Select blood type" />
                    </SelectTrigger>
                    <SelectContent>
                      {BLOOD_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-notes">Notes</Label>
                  <Textarea
                    id="edit-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="resize-none rounded-xl"
                  />
                </div>
                <Separator />
                <Button
                  variant="destructive"
                  className="w-full h-11 rounded-xl"
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete Parent
                </Button>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  className="h-11 rounded-xl"
                  onClick={() => setEditOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="h-11 rounded-xl"
                  onClick={handleSave}
                  disabled={!name.trim() || saving}
                >
                  {saving ? "Saving…" : "Save Changes"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <div className="py-2 space-y-4">
              <p className="text-sm text-muted-foreground">
                This will permanently delete{" "}
                <strong className="text-foreground">{parent.name}</strong> and
                all their reports and reminders. This cannot be undone.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 h-11 rounded-xl"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 h-11 rounded-xl"
                  onClick={handleDeleteParent}
                >
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
