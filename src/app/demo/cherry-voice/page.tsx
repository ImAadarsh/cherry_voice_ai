"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function CherryVoiceDemoInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const restaurant = searchParams.get("restaurant") ?? "";
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    if (!token && !restaurant) return;
    loaded.current = true;

    const script = document.createElement("script");
    script.src = "/widget/cherry-voice.js";
    if (token) script.setAttribute("data-token", token);
    if (restaurant) script.setAttribute("data-restaurant", restaurant);
    script.setAttribute("data-base-url", window.location.origin);
    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, [token, restaurant]);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <PageHeader
        title="Cherry Voice Demo"
        description="Test the embeddable website voice widget. Allow microphone access when prompted."
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Widget preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          {!token && !restaurant ? (
            <p>
              Add <code>?token=YOUR_WIDGET_TOKEN</code> or{" "}
              <code>?restaurant=your-slug</code> to the URL, or configure the widget in Settings →
              Website Voice Widget.
            </p>
          ) : (
            <>
              <p>
                The floating microphone button should appear in the corner. Click it, then press{" "}
                <strong>Start call</strong> to begin a voice session.
              </p>
              <p>
                Pipeline: browser mic → Deepgram Nova 3 STT → Gemini (with restaurant tools) →
                Inworld streaming TTS.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function CherryVoiceDemoPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading demo…</div>}>
      <CherryVoiceDemoInner />
    </Suspense>
  );
}
