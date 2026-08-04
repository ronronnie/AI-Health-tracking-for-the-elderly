"use client";

import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CONTACT_EMAIL,
  MAX_GENERATIONS,
  MAX_PARENTS,
  upgradeMailtoHref,
} from "@/lib/limits";

type LimitKind = "parents" | "generations";

const COPY: Record<LimitKind, { title: string; body: string }> = {
  parents: {
    title: "Parent limit reached",
    body: `ParentCare is free for up to ${MAX_PARENTS} parents. To care for more, send us a quick email and we'll open up your account.`,
  },
  generations: {
    title: "Report limit reached",
    body: `You've used all ${MAX_GENERATIONS} free report generations. Send us a quick email and we'll top you up.`,
  },
};

export function LimitReachedDialog({
  open,
  onOpenChange,
  kind,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: LimitKind;
}) {
  const { title, body } = COPY[kind];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border bg-muted/30 px-4 py-3">
          <p className="text-xs text-muted-foreground">Email us at</p>
          <p className="text-sm font-medium break-all">{CONTACT_EMAIL}</p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="h-11 rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            Not now
          </Button>
          <Button className="h-11 rounded-xl" render={<a href={upgradeMailtoHref(kind)} />}>
            <Mail className="h-4 w-4 mr-1" />
            Email us
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
