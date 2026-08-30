"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, FlaskConical, Play, AlertTriangle, Mic2, Headphones } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WebCallPanel } from "@/components/omnidim/web-call-panel";
import { useApiQuery } from "@/hooks/use-api-query";
import { api } from "@/lib/api-client";

export default function AgentSimulatePage() {
  const params = useParams();
  const agentId = String(params.id);
  const { data } = useApiQuery<{
    simulations?: unknown;
    available?: boolean;
    message?: string;
  }>("/api/omnidim/simulations");

  const available = data?.available !== false;
  const [name, setName] = useState("Pre-deploy test");
  const [busy, setBusy] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);

  const createAndStart = async () => {
    setBusy(true);
    try {
      const created = await api.post<{ simulation?: { id?: number }; available?: boolean }>(
        "/api/omnidim/simulations",
        {
          agent_id: agentId,
          name,
          scenarios: [
            { name: "Order a margherita pizza", expected: "Takes order politely" },
            { name: "Ask about allergens", expected: "References knowledge base" },
          ],
        },
      );
      const simId = (created.simulation as { id?: number })?.id;
      if (simId) {
        setLastId(String(simId));
        await api.post(`/api/omnidim/simulations/${simId}/start`);
        toast.success("Simulation started");
      } else {
        toast.success("Simulation created");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agent simulations"
        description="Run pre-deploy test scenarios or try a live browser demo call."
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/agents">
            <ArrowLeft className="mr-2 h-4 w-4" /> Agents
          </Link>
        </Button>
      </PageHeader>

      <Tabs defaultValue="demo">
        <TabsList>
          <TabsTrigger value="demo" className="gap-1.5">
            <Headphones className="h-4 w-4" /> Live demo
          </TabsTrigger>
          <TabsTrigger value="simulate" className="gap-1.5">
            <FlaskConical className="h-4 w-4" /> Batch simulation
          </TabsTrigger>
          <TabsTrigger value="web" className="gap-1.5">
            <Mic2 className="h-4 w-4" /> Web call
          </TabsTrigger>
        </TabsList>

        <TabsContent value="demo" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Browser demo call</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">
                Talk to your agent in the browser — no phone number required. Uses Cherry Voice AI browser sessions.
              </p>
              <WebCallPanel agentId={agentId} mode="demo" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="web" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Web call</CardTitle>
            </CardHeader>
            <CardContent>
              <WebCallPanel agentId={agentId} mode="web" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="simulate" className="mt-4 space-y-4">
          {!available && (
            <Card className="border-warning/40 bg-warning/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Simulations API unavailable
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {data?.message ??
                    "The agent simulations endpoint is not available on this account yet. Use the Live demo tab for browser testing."}
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FlaskConical className="h-5 w-5 text-primary" /> Automated test suite
                <Badge variant={available ? "success" : "outline"}>
                  {available ? "API connected" : "Unavailable"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Simulation name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="text-sm font-semibold">Default scenarios</p>
                <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
                  <li>Order a margherita pizza — expects polite order taking</li>
                  <li>Ask about allergens — expects knowledge base reference</li>
                </ul>
              </div>

              <Button disabled={busy || !available} className="gap-2" onClick={createAndStart}>
                <Play className="h-4 w-4" />
                Create & start simulation
              </Button>

              {lastId && (
                <p className="text-xs text-muted-foreground">
                  Last simulation ID: <code className="rounded bg-muted px-1">{lastId}</code>
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
