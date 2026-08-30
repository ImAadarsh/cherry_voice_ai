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
  Plus,
  Pencil,
  Trash2,
  Star,
  Copy,
  Check,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { OmnidimSyncButton } from "@/components/omnidim/omnidim-sync-button";
import { AgentWizardDialog } from "@/components/agents/agent-wizard-dialog";
import { CallDetailDrawer } from "@/components/calls/call-detail-drawer";
import { WebCallDialog } from "@/components/omnidim/web-call-dialog";
import { CherryVoiceWebCallDialog } from "@/components/cherry-voice/web-call-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  DialogDescription,
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
import { AGENT_TYPE_LABELS } from "@/lib/agent-constants";
import { INWORLD_VOICES } from "@/lib/voice/inworld-voices";
import { mapAgentRow, mapCallRow } from "@/lib/mappers";
import { formatDuration, formatRelativeTime } from "@/lib/utils";
import type { CallLog, VoiceAgent, VoiceAgentType } from "@/types";

type AgentFilter = "all" | VoiceAgentType;

export default function AgentsPage() {
  useOmnidimSync();
  const { data, loading, error, retry, refetch, errorObject } = useApiQuery<{
    agents: Array<Record<string, unknown>>;
    cherry_voice?: {
      demo_url?: string;
      embed_script?: string;
      isEnabled?: boolean;
    } | null;
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
  const [filter, setFilter] = useState<AgentFilter>("all");
  const [dispatchFor, setDispatchFor] = useState<VoiceAgent | null>(null);
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);
  const [webCallFor, setWebCallFor] = useState<VoiceAgent | null>(null);
  const [demoCallFor, setDemoCallFor] = useState<VoiceAgent | null>(null);
  const [cherryWebCallFor, setCherryWebCallFor] = useState<VoiceAgent | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editAgent, setEditAgent] = useState<VoiceAgent | null>(null);
  const [deleteAgent, setDeleteAgent] = useState<VoiceAgent | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  const filteredAgents = useMemo(() => {
    if (filter === "all") return agents;
    return agents.filter((a) => a.agentType === filter);
  }, [agents, filter]);

  const nativeCount = agents.filter((a) => a.agentType === "native").length;
  const platformCount = agents.filter((a) => a.agentType === "platform").length;
  const embedScript = data?.cherry_voice?.embed_script;

  const handleDelete = async () => {
    if (!deleteAgent) return;
    setDeleting(true);
    try {
      await api.delete(`/api/agents/${deleteAgent.omnidimAgentId}`);
      toast.success(`Deleted ${deleteAgent.name}`);
      setDeleteAgent(null);
      refetch();
      refetchCalls();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  const handleSetPrimary = async (agent: VoiceAgent) => {
    try {
      await api.patch(`/api/agents/${agent.omnidimAgentId}`, { is_primary: true });
      toast.success(`${agent.name} is now your primary agent`);
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleCleanupDuplicates = async () => {
    try {
      const preview = await api.post<{ toDelete: Array<{ id: number; name: string }> }>(
        "/api/agents/duplicates",
        { dryRun: true },
      );
      if (!preview.toDelete?.length) {
        toast.info("No duplicate agents found");
        return;
      }
      const res = await api.post<{ deleted: number[] }>("/api/agents/duplicates", {});
      toast.success(`Removed ${res.deleted?.length ?? 0} duplicate agent(s)`);
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const openCreate = () => {
    setEditAgent(null);
    setWizardOpen(true);
  };

  const openEdit = (agent: VoiceAgent) => {
    setEditAgent(agent);
    setWizardOpen(true);
  };

  const copyEmbed = async () => {
    if (!embedScript) return;
    await navigator.clipboard.writeText(embedScript);
    setCopiedEmbed(true);
    toast.success("Embed code copied");
    setTimeout(() => setCopiedEmbed(false), 2000);
  };

  const voiceLabel = (voiceId: string) =>
    INWORLD_VOICES.find((v) => v.id === voiceId)?.label ?? voiceId;

  const platformAgents = agents.filter((a) => a.agentType === "platform");

  const columns = useMemo<ColumnDef<VoiceAgent>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Agent",
        cell: ({ row }) => (
          <AgentNameCell agent={row.original} />
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
        header: "Channel",
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
          <PlatformAgentActions
            agent={row.original}
            onEdit={openEdit}
            onDelete={setDeleteAgent}
            onSetPrimary={handleSetPrimary}
            onWebCall={setWebCallFor}
            onDemoCall={setDemoCallFor}
            onDispatch={setDispatchFor}
          />
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
        description="Cherry Voice native agents and Phone & Web platform agents — create, configure, and go live."
      >
        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="gap-2 font-semibold" onClick={openCreate}>
            <Plus className="h-4 w-4" /> New agent
          </Button>
          <Button size="sm" variant="outline" className="gap-2 font-semibold" asChild>
            <Link href="/settings/cherry-voice">
              <Settings2 className="h-4 w-4" /> Widget settings
            </Link>
          </Button>
          <OmnidimSyncButton onSynced={handleSynced} />
          {agents.length > 1 && (
            <Button
              size="sm"
              variant="outline"
              className="gap-2 font-semibold"
              onClick={() => void handleCleanupDuplicates()}
            >
              <Trash2 className="h-4 w-4" /> Clean duplicates
            </Button>
          )}
          {platformAgents.length > 0 && (
            <Button
              size="sm"
              className="gap-2 font-semibold"
              onClick={() => setDispatchFor(platformAgents[0] ?? null)}
              disabled={!platformAgents.length}
            >
              <PhoneOutgoing className="h-4 w-4" /> Dispatch call
            </Button>
          )}
        </div>
      </PageHeader>

      {nativeCount === 0 && !loading && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">Create your Cherry Voice agent</p>
                <p className="text-sm text-muted-foreground">
                  Embed a native voice agent on your website — Deepgram, Gemini, and Inworld, fully
                  integrated with your menu and orders.
                </p>
              </div>
            </div>
            <Button onClick={openCreate} className="shrink-0 gap-2">
              <Plus className="h-4 w-4" /> Create Cherry Voice agent
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="agents">
        <TabsList>
          <TabsTrigger value="agents" className="font-semibold">
            Agents
          </TabsTrigger>
          <TabsTrigger value="calls" className="font-semibold">
            Call logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="mt-4 space-y-4">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as AgentFilter)}>
            <TabsList>
              <TabsTrigger value="all">All ({agents.length})</TabsTrigger>
              <TabsTrigger value="native">
                Cherry Voice ({nativeCount})
              </TabsTrigger>
              <TabsTrigger value="platform">
                Phone & Web ({platformCount})
              </TabsTrigger>
            </TabsList>
          </Tabs>

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
          ) : loading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : filteredAgents.length === 0 ? (
            <Card className="p-8 text-center">
              <Bot className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-semibold">No agents yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a Cherry Voice agent for your website or a Phone & Web agent for calls.
              </p>
              <Button className="mt-4 gap-2" onClick={openCreate}>
                <Plus className="h-4 w-4" /> New agent
              </Button>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredAgents.map((agent) =>
                agent.agentType === "native" ? (
                  <NativeAgentCard
                    key={agent.id}
                    agent={agent}
                    embedScript={embedScript}
                    voiceLabel={voiceLabel(agent.voice)}
                    onWebCall={() => setCherryWebCallFor(agent)}
                    onEdit={() => openEdit(agent)}
                    onDelete={() => setDeleteAgent(agent)}
                    onSetPrimary={() => void handleSetPrimary(agent)}
                    onCopyEmbed={copyEmbed}
                    copiedEmbed={copiedEmbed}
                  />
                ) : (
                  <PlatformAgentCard
                    key={agent.id}
                    agent={agent}
                    onEdit={() => openEdit(agent)}
                    onDelete={() => setDeleteAgent(agent)}
                    onSetPrimary={() => void handleSetPrimary(agent)}
                    onWebCall={() => setWebCallFor(agent)}
                    onDemoCall={() => setDemoCallFor(agent)}
                    onDispatch={() => setDispatchFor(agent)}
                  />
                ),
              )}
            </div>
          )}

          {platformCount > 0 && filter !== "native" && (
            <div className="pt-2">
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                Phone & Web agents — table view
              </h3>
              <DataTable
                columns={columns}
                data={filteredAgents.filter((a) => a.agentType === "platform")}
                loading={false}
                searchKey="name"
                searchPlaceholder="Search platform agents…"
                emptyTitle="No platform agents"
                emptyDescription="Create a Phone & Web agent for inbound phone and browser calls."
                pageSize={10}
              />
            </div>
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
                        {c.source === "cherry_voice" ? c.sessionId ?? c.customerPhone : c.customerPhone} ·{" "}
                        {formatRelativeTime(c.startedAt)}
                      </p>
                    </div>
                    {c.source === "cherry_voice" && (
                      <Badge variant="default" className="shrink-0 text-[10px]">
                        Cherry Voice
                      </Badge>
                    )}
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
        agents={platformAgents}
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

      <CherryVoiceWebCallDialog
        open={!!cherryWebCallFor}
        onOpenChange={(open) => {
          if (!open) {
            setCherryWebCallFor(null);
            refetchCalls();
          }
        }}
        agentId={cherryWebCallFor?.omnidimAgentId}
        agentName={cherryWebCallFor?.name}
      />

      <AgentWizardDialog
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        mode={editAgent ? "edit" : "create"}
        agent={editAgent}
        onSaved={() => {
          refetch();
          refetchCalls();
        }}
      />

      <Dialog open={!!deleteAgent} onOpenChange={(open) => !open && setDeleteAgent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteAgent?.name}?</DialogTitle>
            <DialogDescription>
              This permanently removes the agent.
              {deleteAgent?.agentType === "native"
                ? " Your website widget will be unlinked from this agent."
                : " Call history is kept, but this agent can no longer receive calls."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAgent(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={() => void handleDelete()}>
              Delete agent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AgentNameCell({ agent }: { agent: VoiceAgent }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
        <Bot className="h-4 w-4" />
      </div>
      <div>
        <p className="font-semibold">
          {agent.name}
          {agent.isPrimary ? (
            <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
              Primary
            </span>
          ) : null}
        </p>
        <div className="flex items-center gap-2">
          <Badge variant={agent.agentType === "native" ? "default" : "secondary"} className="text-[10px]">
            {AGENT_TYPE_LABELS[agent.agentType]}
          </Badge>
          <p className="text-xs font-medium text-muted-foreground">{agent.role}</p>
        </div>
      </div>
    </div>
  );
}

function NativeAgentCard({
  agent,
  embedScript,
  voiceLabel,
  onWebCall,
  onEdit,
  onDelete,
  onSetPrimary,
  onCopyEmbed,
  copiedEmbed,
}: {
  agent: VoiceAgent;
  embedScript?: string;
  voiceLabel: string;
  onWebCall: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSetPrimary: () => void;
  onCopyEmbed: () => void;
  copiedEmbed: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{agent.name}</p>
                {agent.isPrimary && (
                  <Badge variant="outline" className="text-[10px]">
                    Primary
                  </Badge>
                )}
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Badge>{AGENT_TYPE_LABELS.native}</Badge>
                <Badge variant={agent.widgetEnabled ? "success" : "secondary"}>
                  Widget {agent.widgetEnabled ? "live" : "off"}
                </Badge>
              </div>
            </div>
          </div>
          <AgentStatusDot status={agent.status} />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Voice</dt>
            <dd className="font-medium">{voiceLabel}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Channel</dt>
            <dd className="font-medium">Web & widget</dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" className="gap-1.5" onClick={onWebCall}>
            <Mic2 className="h-3.5 w-3.5" /> Web call
          </Button>
          {embedScript && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={onCopyEmbed}>
              {copiedEmbed ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              Widget embed
            </Button>
          )}
          <Button size="sm" variant="outline" className="gap-1.5" disabled title="Phone calls coming soon">
            <PhoneOutgoing className="h-3.5 w-3.5" /> Phone
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
          {!agent.isPrimary && (
            <Button size="sm" variant="ghost" className="gap-1.5" onClick={onSetPrimary}>
              <Star className="h-3.5 w-3.5" /> Set primary
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PlatformAgentCard({
  agent,
  onEdit,
  onDelete,
  onSetPrimary,
  onWebCall,
  onDemoCall,
  onDispatch,
}: {
  agent: VoiceAgent;
  onEdit: () => void;
  onDelete: () => void;
  onSetPrimary: () => void;
  onWebCall: () => void;
  onDemoCall: () => void;
  onDispatch: () => void;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-secondary text-foreground">
              <PhoneOutgoing className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">{agent.name}</p>
              <Badge variant="secondary" className="mt-1">
                {AGENT_TYPE_LABELS.platform}
              </Badge>
            </div>
          </div>
          <AgentStatusDot status={agent.status} />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Phone</dt>
            <dd className="font-medium">{agent.phoneNumber}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Calls today</dt>
            <dd className="font-medium tabular">{agent.callsToday}</dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={onWebCall}>
            <Mic2 className="h-3.5 w-3.5" /> Web call
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={onDemoCall}>
            <Headphones className="h-3.5 w-3.5" /> Demo
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5"
            disabled={agent.status === "offline"}
            onClick={onDispatch}
          >
            <PhoneOutgoing className="h-3.5 w-3.5" /> Dispatch
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PlatformAgentActions({
  agent,
  onEdit,
  onDelete,
  onSetPrimary,
  onWebCall,
  onDemoCall,
  onDispatch,
}: {
  agent: VoiceAgent;
  onEdit: (a: VoiceAgent) => void;
  onDelete: (a: VoiceAgent) => void;
  onSetPrimary: (a: VoiceAgent) => void;
  onWebCall: (a: VoiceAgent) => void;
  onDemoCall: (a: VoiceAgent) => void;
  onDispatch: (a: VoiceAgent) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/agents/${agent.omnidimAgentId}/versions`}>
            <History className="mr-2 h-4 w-4" /> Version history
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/agents/${agent.omnidimAgentId}/simulate`}>
            <FlaskConical className="mr-2 h-4 w-4" /> Simulate
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onWebCall(agent)}>
          <Mic2 className="mr-2 h-4 w-4" /> Web call
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onDemoCall(agent)}>
          <Headphones className="mr-2 h-4 w-4" /> Demo call
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onEdit(agent)}>
          <Pencil className="mr-2 h-4 w-4" /> Edit agent
        </DropdownMenuItem>
        {!agent.isPrimary && (
          <DropdownMenuItem onClick={() => onSetPrimary(agent)}>
            <Star className="mr-2 h-4 w-4" /> Set as primary
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => onDelete(agent)}
        >
          <Trash2 className="mr-2 h-4 w-4" /> Delete agent
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/phone-numbers">
            <Settings2 className="mr-2 h-4 w-4" /> Phone numbers
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={agent.status === "offline"}
          onClick={() => onDispatch(agent)}
        >
          <PhoneOutgoing className="mr-2 h-4 w-4" /> Dispatch call
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
