"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Headphones, Mic2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { WebCallPanel } from "@/components/omnidim/web-call-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorState } from "@/components/shared/states";
import { useApiQuery } from "@/hooks/use-api-query";
import { useOmnidimSync } from "@/hooks/use-omnidim-sync";
import { mapAgentRow } from "@/lib/mappers";
export default function DemoPage() {
  useOmnidimSync();
  const { data, loading, error, retry } = useApiQuery<{
    agents: Array<Record<string, unknown>>;
  }>("/api/agents");

  const agents = useMemo(
    () => (data?.agents ?? []).map((row) => mapAgentRow(row)),
    [data],
  );

  const [selectedId, setSelectedId] = useState<string>("");
  const activeId = selectedId || agents[0]?.omnidimAgentId || "";
  const activeAgent = agents.find((a) => a.omnidimAgentId === activeId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Try your agent"
        description="Browser voice demo powered by Omnidim Sessions — no phone number needed."
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/agents">Back to agents</Link>
        </Button>
      </PageHeader>

      {error ? (
        <ErrorState onRetry={retry} />
      ) : loading ? (
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      ) : agents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No agents yet.{" "}
            <Link href="/onboarding" className="text-primary hover:underline">
              Complete onboarding
            </Link>{" "}
            to create one.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">Select agent</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={activeId} onValueChange={setSelectedId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.omnidimAgentId} value={a.omnidimAgentId}>
                      {a.name} · {a.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Uses Omnidim <code className="rounded bg-muted px-1">POST /sessions/create</code>{" "}
                with the <code className="rounded bg-muted px-1">@omnidim-ai/client</code> Web SDK.
              </p>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Headphones className="h-5 w-5 text-primary" />
                Live browser call
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="demo">
                <TabsList>
                  <TabsTrigger value="demo" className="gap-1.5">
                    <Mic2 className="h-4 w-4" /> Demo call
                  </TabsTrigger>
                  <TabsTrigger value="web">Web call</TabsTrigger>
                </TabsList>
                <TabsContent value="demo" className="mt-4">
                  {activeId && (
                    <WebCallPanel
                      key={`demo-${activeId}`}
                      agentId={activeId}
                      agentName={activeAgent?.name}
                      mode="demo"
                    />
                  )}
                </TabsContent>
                <TabsContent value="web" className="mt-4">
                  {activeId && (
                    <WebCallPanel
                      key={`web-${activeId}`}
                      agentId={activeId}
                      agentName={activeAgent?.name}
                      mode="web"
                    />
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
