"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import {
  PhoneOutgoing,
  PlayCircle,
  Settings2,
  Bot,
  MoreHorizontal,
  History,
  FlaskConical,
  Mic2,
  Headphones,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { OmnidimSyncButton } from "@/components/omnidim/omnidim-sync-button";
import { CallDetailDrawer } from "@/components/calls/call-detail-drawer";
import { WebCallDialog } from "@/components/omnidim/web-call-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AgentStatusDot,
  CallOutcomeBadge,
} from "@/components/shared/status-badge";
import { ErrorState } from "@/components/shared/states";
import { useApiQuery } from "@/hooks/use-api-query";
import { isDatabaseConnectionError } from "@/lib/api-client";
import { useOmnidimSync } from "@/hooks/use-omnidim-sync";
import { api } from "@/lib/api-client";
import { mapAgentRow, mapCallRow } from "@/lib/mappers";
import { formatDuration, formatRelativeTime } from "@/lib/utils";
import type { CallLog, VoiceAgent } from "@/types";

export default function AgentsPage() {
  useOmnidimSync();
  const { data, loading, error, retry, refetch, errorObject } = useApiQuery<{
    agents: Array<Record<string, unknown>>;
  }>("/api/agents");
  const { data: callsData, refetch: refetchCalls } = useApiQuery<{
    data: Array<Record<string, unknown>>;
  }>("/api/calls?limit=50");
  const agents = useMemo(
    () => (data?.agents ?? []).map((row) => mapAgentRow(row)),
    [data],
  );
  const callLogs = useMemo(
    () => (callsData?.data ?? []).map((row) => mapCallRow(row)),
    [callsData],
  );
  const [dispatchFor, setDispatchFor] = useState<VoiceAgent | null>(null);
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);
  const [webCallFor, setWebCallFor] = useState<VoiceAgent | null>(null);
  const [demoCallFor, setDemoCallFor] = useState<VoiceAgent | null>(null);

  const columns = useMemo<ColumnDef<VoiceAgent>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Agent",
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <p className="font-semibold">{row.original.name}</p>
              <p className="text-xs font-medium text-muted-foreground">
                {row.original.role}
              </p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <AgentStatusDot status={row.original.status} />,
      },
      {
        accessorKey: "callsToday",
        header: "Calls today",
        cell: ({ row }) => (
          <span className="tabular font-bold">{row.original.callsToday}</span>
        ),
      },
      {
        accessorKey: "phoneNumber",
        header: "Phone",
        cell: ({ row }) => (
          <span className="font-medium text-muted-foreground">
            {row.original.phoneNumber}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/agents/${row.original.omnidimAgentId}/versions`}>
                  <History className="mr-2 h-4 w-4" /> Version history
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/agents/${row.original.omnidimAgentId}/simulate`}>
                  <FlaskConical className="mr-2 h-4 w-4" /> Simulate
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setWebCallFor(row.original)}>
                <Mic2 className="mr-2 h-4 w-4" /> Web call
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDemoCallFor(row.original)}>
                <Headphones className="mr-2 h-4 w-4" /> Demo call
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/phone-numbers">
                  <Settings2 className="mr-2 h-4 w-4" /> Phone numbers
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={row.original.status === "offline"}
                onClick={() => setDispatchFor(row.original)}
              >
                <PhoneOutgoing className="mr-2 h-4 w-4" /> Dispatch call
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [],
  );

  const handleSynced = () => {
    refetch();
    refetchCalls();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Voice Agents"
        description="Your Omnidim AI agents, live status and call activity."
      >
        <div className="flex gap-2">
          <OmnidimSyncButton onSynced={handleSynced} />
          <Button
            size="sm"
            variant="outline"
            className="gap-2 font-semibold"
            onClick={() => setDemoCallFor(agents[0] ?? null)}
            disabled={!agents.length}
          >
            <Headphones className="h-4 w-4" /> Demo call
          </Button>
          <Button
            size="sm"
            className="gap-2 font-semibold"
            onClick={() => setDispatchFor(agents[0] ?? null)}
            disabled={!agents.length}
          >
            <PhoneOutgoing className="h-4 w-4" /> Dispatch call
          </Button>
        </div>
      </PageHeader>

      <Tabs defaultValue="agents">
        <TabsList>
          <TabsTrigger value="agents" className="font-semibold">
            Agents
          </TabsTrigger>
          <TabsTrigger value="calls" className="font-semibold">
            Call logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="mt-4">
          {error ? (
            <ErrorState
              title={
                errorObject && isDatabaseConnectionError(errorObject)
                  ? "Database unavailable"
                  : "Something went wrong"
              }
              description={
                errorObject && isDatabaseConnectionError(errorObject)
                  ? "Cannot connect to the database. Start local MySQL (XAMPP) or check DB_HOST in .env, then try again."
                  : "We couldn't load agents. Please try again."
              }
              onRetry={retry}
            />
          ) : (
            <DataTable
              columns={columns}
              data={agents}
              loading={loading}
              searchKey="name"
              searchPlaceholder="Search agents…"
              emptyTitle="No agents"
              emptyDescription="Connect Omnidim to sync your voice agents."
              pageSize={10}
              mobileCard={(a) => (
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                        <Bot className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold">{a.name}</p>
                        <p className="text-xs font-medium text-muted-foreground">
                          {a.phoneNumber}
                        </p>
                      </div>
                    </div>
                    <AgentStatusDot status={a.status} />
                  </div>
                  <p className="mt-3 text-sm font-bold">
                    {a.callsToday} calls today
                  </p>
                </Card>
              )}
            />
          )}
        </TabsContent>

        <TabsContent value="calls">
          <Card>
            <CardHeader>
              <CardTitle>Recent calls</CardTitle>
            </CardHeader>
            <CardContent className="px-2">
              <ul className="divide-y">
                {callLogs.map((c) => (
                  <li
                    key={c.id}
                    className="flex cursor-pointer items-center gap-3 px-3 py-3 hover:bg-muted/40"
                    onClick={() => setSelectedCall(c)}
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted">
                      <Bot className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {c.customerName}{" "}
                        <span className="font-medium text-muted-foreground">
                          · {c.agentName}
                        </span>
                      </p>
                      <p className="truncate text-xs font-medium text-muted-foreground">
                        {c.customerPhone} · {formatRelativeTime(c.startedAt)}
                      </p>
                    </div>
                    <CallOutcomeBadge outcome={c.outcome} />
                    <span className="tabular hidden w-12 text-right text-sm font-medium text-muted-foreground sm:block">
                      {c.duration ? formatDuration(c.duration) : "—"}
                    </span>
                    {c.recordingUrl ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCall(c);
                        }}
                        aria-label="Play recording"
                      >
                        <PlayCircle className="h-5 w-5 text-primary" />
                      </Button>
                    ) : (
                      <span className="w-10" />
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <DispatchDialog
        agent={dispatchFor}
        agents={agents}
        onClose={() => setDispatchFor(null)}
        onDispatched={handleSynced}
      />

      <CallDetailDrawer
        callId={selectedCall?.id ?? null}
        fallback={selectedCall ?? undefined}
        onClose={() => setSelectedCall(null)}
      />

      <WebCallDialog
        open={!!webCallFor}
        onOpenChange={(open) => !open && setWebCallFor(null)}
        agentId={webCallFor?.omnidimAgentId ?? ""}
        agentName={webCallFor?.name}
        mode="web"
      />
      <WebCallDialog
        open={!!demoCallFor}
        onOpenChange={(open) => !open && setDemoCallFor(null)}
        agentId={demoCallFor?.omnidimAgentId ?? ""}
        agentName={demoCallFor?.name}
        mode="demo"
      />
    </div>
  );
}

function DispatchDialog({
  agent,
  agents,
  onClose,
  onDispatched,
}: {
  agent: VoiceAgent | null;
  agents: VoiceAgent[];
  onClose: () => void;
  onDispatched?: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [agentId, setAgentId] = useState(agent?.omnidimAgentId ?? "");
  const [dispatching, setDispatching] = useState(false);

  useEffect(() => {
    if (agent) setAgentId(agent.omnidimAgentId);
  }, [agent]);

  const dispatch = async () => {
    if (!phone || !agentId) return;
    setDispatching(true);
    try {
      await api.post("/api/calls/dispatch", {
        agent_id: agentId,
        to_number: phone,
      });
      toast.success("Call dispatched", { description: `Dialing ${phone}…` });
      setPhone("");
      onDispatched?.();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDispatching(false);
    }
  };

  return (
    <Dialog open={!!agent} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dispatch outbound call</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Agent</Label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {agents
                  .filter((a) => a.status !== "offline")
                  .map((a) => (
                    <SelectItem key={a.omnidimAgentId} value={a.omnidimAgentId}>
                      {a.name} · {a.role}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Customer phone (E.164)</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+15551234567"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!phone || dispatching} onClick={dispatch}>
            <PhoneOutgoing className="h-4 w-4" /> Start call
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
