"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { db } from "@/lib/db";
import { hasParentSlotsLeft } from "@/lib/limits";
import { LimitReachedDialog } from "@/components/limit-reached-dialog";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"];

export default function NewParentPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [bloodType, setBloodType] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);

    if (!(await hasParentSlotsLeft())) {
      setLimitOpen(true);
      setSaving(false);
      return;
    }

    try {
      await db.parents.add({
        id: crypto.randomUUID(),
        name: name.trim(),
        dateOfBirth: dob || undefined,
        gender:
          gender && gender !== "_none"
            ? (gender as "male" | "female" | "other")
            : undefined,
        bloodType: bloodType || undefined,
        notes: notes.trim() || undefined,
        createdAt: new Date().toISOString(),
      });
      toast.success(`${name.trim()} added!`);
      router.push("/");
    } catch {
      toast.error("Failed to save. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col flex-1">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="flex h-14 items-center gap-1 px-3">
          <Button
            variant="ghost"
            className="gap-1 px-2 h-11 text-muted-foreground hover:text-foreground"
            onClick={() => router.back()}
          >
            <ChevronLeft className="h-5 w-5" />
            Back
          </Button>
          <h1 className="font-semibold text-lg ml-1">Add Parent</h1>
        </div>
      </header>

      <main className="flex-1 px-4 py-6">
        <Card className="rounded-2xl">
          <CardContent className="p-6 space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm font-medium">Full Name *</Label>
              <Input
                id="name"
                placeholder="e.g. Margaret Johnson"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-12 rounded-xl text-base"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dob" className="text-sm font-medium">Date of Birth</Label>
              <Input
                id="dob"
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="h-12 rounded-xl text-base"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Gender</Label>
              <Select value={gender} onValueChange={(v) => setGender(v ?? "")}>
                <SelectTrigger className="h-12 rounded-xl text-base">
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
              <Label className="text-sm font-medium">Blood Type</Label>
              <Select value={bloodType} onValueChange={(v) => setBloodType(v ?? "")}>
                <SelectTrigger className="h-12 rounded-xl text-base">
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
              <Label htmlFor="notes" className="text-sm font-medium">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Existing conditions, medications, allergies — anything to remember"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="rounded-xl resize-none text-base"
              />
            </div>
          </CardContent>
        </Card>

        <div className="h-4" />
      </main>

      <div
        className="sticky bottom-0 bg-background/80 backdrop-blur-xl border-t border-border px-4 pt-3"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <Button
          className="w-full h-12 rounded-xl text-base"
          onClick={handleSave}
          disabled={!name.trim() || saving}
        >
          {saving ? "Saving…" : "Save Parent"}
        </Button>
      </div>

      <LimitReachedDialog
        open={limitOpen}
        onOpenChange={setLimitOpen}
        kind="parents"
      />
    </div>
  );
}
