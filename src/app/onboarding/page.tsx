"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HeartPulse } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);

  function handleGetStarted() {
    setStep(2);
  }

  function handleIUnderstand() {
    localStorage.setItem("parentcare_onboarded", "true");
    router.replace("/");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-indigo-100 flex items-center justify-center p-4">
      {step === 1 ? (
        <Card className="w-full max-w-sm shadow-lg">
          <CardHeader className="items-center text-center gap-3 pt-8">
            <div className="rounded-full bg-sky-100 p-4">
              <HeartPulse className="h-9 w-9 text-sky-600" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight">ParentCare</h1>
              <p className="text-muted-foreground text-sm">
                Track your parents&apos; health, together.
              </p>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground text-center space-y-3 px-6">
            <p>
              Keep all your parents&apos; lab reports in one place and get
              plain-English summaries powered by AI — no medical jargon
              required.
            </p>
            <p>
              Set reminders for re-tests and follow-ups, and stay coordinated
              with other family members who help with care.
            </p>
            <p>
              Everything stays private — reports are stored only on your device.
            </p>
          </CardContent>
          <CardFooter className="px-6 pb-8 bg-transparent border-0">
            <Button className="w-full h-12 text-base" onClick={handleGetStarted}>
              Get Started
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <Card className="w-full max-w-sm shadow-lg">
          <CardHeader className="pt-6">
            <h2 className="text-xl font-semibold">A note before you start</h2>
          </CardHeader>
          <CardContent className="px-6">
            <div className="max-h-52 overflow-y-auto text-sm text-muted-foreground space-y-3 pr-1">
              <p>
                ParentCare uses AI to help summarize lab reports in plain
                language.
              </p>
              <p>
                It is{" "}
                <strong className="text-foreground">NOT a medical device</strong>
                ,{" "}
                <strong className="text-foreground">NOT a doctor</strong>, and{" "}
                <strong className="text-foreground">
                  does NOT provide medical advice
                </strong>
                . Always discuss results with a qualified physician.
              </p>
              <p>
                Reports parsed here are stored only on this device — they are
                not uploaded to any cloud database or shared with us.
              </p>
            </div>
            <p className="text-xs text-muted-foreground/70 mt-3 border-t pt-3">
              The AI service is configured separately by the app operator — no
              API keys needed from you.
            </p>
          </CardContent>
          <CardFooter className="px-6 pb-8 bg-transparent border-0">
            <Button
              className="w-full h-12 text-base"
              onClick={handleIUnderstand}
            >
              I understand
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
