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
    <div className="min-h-screen flex items-center justify-center p-4">
      {step === 1 ? (
        <div className="w-full max-w-sm flex flex-col items-center gap-6">
          <div className="h-24 w-24 rounded-full bg-accent flex items-center justify-center">
            <HeartPulse className="h-12 w-12 text-primary" />
          </div>

          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">ParentCare</h1>
            <p className="text-lg text-muted-foreground">
              Track your parents&apos; health, together.
            </p>
          </div>

          <Card className="w-full rounded-2xl shadow-sm">
            <CardContent className="px-6 pt-6 text-base text-muted-foreground space-y-3 leading-relaxed">
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
            <CardFooter className="px-6 pb-6 pt-2">
              <Button
                className="w-full h-12 rounded-xl text-base px-8"
                onClick={handleGetStarted}
              >
                Get Started
              </Button>
            </CardFooter>
          </Card>
        </div>
      ) : (
        <Card className="w-full max-w-md rounded-2xl shadow-sm">
          <CardHeader className="pt-6 px-6">
            <h2 className="text-2xl font-semibold tracking-tight">
              A note before you start
            </h2>
          </CardHeader>
          <CardContent className="px-6">
            <div className="max-h-52 overflow-y-auto text-base text-muted-foreground space-y-3 pr-1 leading-relaxed">
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
            <p className="text-xs text-muted-foreground/70 mt-4 border-t pt-3">
              The AI service is configured separately by the app operator — no
              API keys needed from you.
            </p>
          </CardContent>
          <CardFooter className="px-6 pb-6 pt-2">
            <Button
              className="w-full h-12 rounded-xl text-base"
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
