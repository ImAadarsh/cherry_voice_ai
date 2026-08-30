"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GitBranch, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApiQuery } from "@/hooks/use-api-query";
import { api } from "@/lib/api-client";
import type { AgentFlow, FlowStep, FlowTemplate } from "@/lib/agent-flow-types";

const templates: { value: FlowTemplate; label: string }[] = [
  { value: "restaurant_order", label: "Restaurant Order" },
  { value: "reservation", label: "Reservation" },
  { value: "combined", label: "Combined" },
  { value: "custom", label: "Custom" },
];

const stepTypes = ["greeting", "question", "branch", "action", "closing"] as const;

export default function AgentFlowsSettingsPage() {
  const { data, refetch } = useApiQuery<{ flows: AgentFlow[] }>("/api/agent-flows");
  const { data: agentsData } = useApiQuery<{
    agents: Array<{ omnidim_agent_id?: string; name?: string }>;
  }>("/api/agents");

  const flows = data?.flows ?? [];
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [template, setTemplate] = useState<FlowTemplate>("restaurant_order");
  const [steps, setSteps] = useState<FlowStep[]>([]);
  const [prompt, setPrompt] = useState("");
  const [agentId, setAgentId] = useState("");

  const selected = flows.find((f) => f.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) return;
    setName(selected.name);
    setTemplate(selected.template);
    setSteps(selected.steps);
    setPrompt(selected.generatedPrompt ?? "");
    if (selected.appliedAgentId) setAgentId(selected.appliedAgentId);
  }, [selected]);

  const createFlow = async () => {
    try {
      const res = await api.post<{ flow: AgentFlow }>("/api/agent-flows", {
        name: `New ${template.replace("_", " ")} flow`,
        template,
      });
      toast.success("Flow created");
      await refetch();
      setSelectedId(res.flow.id);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const saveFlow = async () => {
    if (!selectedId) return;
    try {
      await api.patch(`/api/agent-flows/${selectedId}`, { name, template, steps });
      toast.success("Flow saved");
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const generatePrompt = async () => {
    if (!selectedId) return;
    try {
      const res = await api.post<{ prompt: string }>(`/api/agent-flows/${selectedId}/generate-prompt`);
      setPrompt(res.prompt);
      toast.success("Prompt generated");
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const applyToAgent = async () => {
    if (!selectedId || !agentId) {
      toast.error("Select an agent first");
      return;
    }
    try {
      await api.post(`/api/agent-flows/${selectedId}/apply-to-agent`, { agentId });
      toast.success("Flow applied to agent");
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const deleteFlow = async () => {
    if (!selectedId) return;
    try {
      await api.delete(`/api/agent-flows/${selectedId}`);
      toast.success("Flow deleted");
      setSelectedId(null);
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const updateStep = (index: number, patch: Partial<FlowStep>) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const addStep = () => {
    setSteps((prev) => [
      ...prev,
      {
        id: `step-${Date.now()}`,
        type: "question",
        title: "New step",
        message: "What would you like to ask?",
      },
    ]);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Agent Flows"
        description="Build structured conversation flows and generate Omnidim prompts."
      >
        <Button size="sm" className="gap-1.5" onClick={createFlow}>
          <Plus className="h-4 w-4" /> New flow
        </Button>
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Flows</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {flows.length === 0 && (
              <p className="text-sm text-muted-foreground">No flows yet. Create one to get started.</p>
            )}
            {flows.map((flow) => (
              <button
                key={flow.id}
                type="button"
                onClick={() => setSelectedId(flow.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  selectedId === flow.id
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted"
                }`}
              >
                <p className="font-medium">{flow.name}</p>
                <p className="text-xs capitalize text-muted-foreground">
                  {flow.template.replace("_", " ")} · {flow.steps.length} steps
                </p>
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {!selected ? (
            <Card>
              <CardContent className="flex min-h-[280px] items-center justify-center p-8 text-center text-muted-foreground">
                <div>
                  <GitBranch className="mx-auto mb-3 h-8 w-8 opacity-50" />
                  <p>Select a flow or create a new one.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    Flow editor
                    <Badge variant="outline" className="capitalize">
                      {template.replace("_", " ")}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Name</Label>
                      <Input value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Template</Label>
                      <Select value={template} onValueChange={(v) => setTemplate(v as FlowTemplate)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {templates.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {steps.map((step, index) => (
                      <div key={step.id} className="rounded-xl border bg-muted/20 p-4">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <Badge variant="secondary">{index + 1}. {step.type}</Badge>
                          <Select
                            value={step.type}
                            onValueChange={(v) =>
                              updateStep(index, { type: v as FlowStep["type"] })
                            }
                          >
                            <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {stepTypes.map((t) => (
                                <SelectItem key={t} value={t}>
                                  {t}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-3">
                          <Input
                            value={step.title}
                            onChange={(e) => updateStep(index, { title: e.target.value })}
                            placeholder="Step title"
                          />
                          <Textarea
                            value={step.message}
                            onChange={(e) => updateStep(index, { message: e.target.value })}
                            rows={3}
                            placeholder="Message template"
                          />
                          {step.type === "action" && (
                            <Input
                              value={step.action ?? ""}
                              onChange={(e) => updateStep(index, { action: e.target.value })}
                              placeholder="Action key (e.g. send_payment_link)"
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={addStep} className="gap-1.5">
                      <Plus className="h-4 w-4" /> Add step
                    </Button>
                    <Button onClick={saveFlow}>Save flow</Button>
                    <Button variant="outline" onClick={deleteFlow} className="gap-1.5 text-destructive">
                      <Trash2 className="h-4 w-4" /> Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" /> Generated prompt
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={8} />
                  <div className="flex flex-wrap items-end gap-3">
                    <Button variant="outline" onClick={generatePrompt} className="gap-1.5">
                      <Wand2 className="h-4 w-4" /> Generate prompt
                    </Button>
                    <div className="min-w-[200px] flex-1 space-y-1.5">
                      <Label>Apply to agent</Label>
                      <Select value={agentId} onValueChange={setAgentId}>
                        <SelectTrigger><SelectValue placeholder="Select agent" /></SelectTrigger>
                        <SelectContent>
                          {agentsData?.agents?.map((a) => (
                            <SelectItem key={a.omnidim_agent_id} value={a.omnidim_agent_id ?? ""}>
                              {a.name ?? a.omnidim_agent_id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={applyToAgent}>Apply to agent</Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
