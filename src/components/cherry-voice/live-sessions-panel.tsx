"use client";

import { useEffect, useState } from "react";
import { Loader2, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";

type LiveSession = {
  session_id: string;
  state: string;
  turn_count: number;
};

export function LiveSessionsPanel() {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = () => {
      api
        .get<{ sessions: LiveSession[] }>("/api/cherry-voice/live-sessions")
        .then((res) => mounted && setSessions(res.sessions ?? []))
        .catch(() => {})
        .finally(() => mounted && setLoading(false));
    };
    load();
    const interval = setInterval(load, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Radio className="h-4 w-4 text-primary" /> Live Cherry Voice sessions
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        )}
        {!loading && sessions.length === 0 && (
          <p className="text-sm text-muted-foreground">No active voice sessions.</p>
        )}
        <div className="space-y-2">
          {sessions.map((s) => (
            <div key={s.session_id} className="rounded-lg border bg-muted/20 p-3 text-sm">
              <Badge variant="outline" className="capitalize">{s.state}</Badge>
              <span className="ml-2 font-mono text-xs">{s.session_id}</span>
              <span className="ml-2 text-muted-foreground">{s.turn_count} turns</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
