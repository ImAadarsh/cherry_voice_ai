"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, GitCompare, History, RotateCcw, Save } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useApiQuery } from "@/hooks/use-api-query";
import { api } from "@/lib/api-client";

type Version = {
  version_number?: number;
  name?: string;
  note?: string;
  version_type?: string;
  created_at?: string;
};

type DiffGroup = {
  area?: string;
  changes?: Array<{ field?: string; label?: string; old?: string; new?: string }>;
};

export default function AgentVersionsPage() {
  const params = useParams();
  const agentId = String(params.id);
  const { data, refetch } = useApiQuery<{
    agent?: { name?: string };
    versions?: { versions?: Version[] };
  }>(`/api/omnidim/agents/${agentId}/versions`);

  const versions = data?.versions?.versions ?? [];
  const agentName = data?.agent?.name ?? "Agent";

  const [saveOpen, setSaveOpen] = useState(false);
  const [versionName, setVersionName] = useState("");
  const [versionNote, setVersionNote] = useState("");
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffGroups, setDiffGroups] = useState<DiffGroup[]>([]);
  const [diffTitle, setDiffTitle] = useState("");

  const saveVersion = async () => {
    try {
      await api.post(`/api/omnidim/agents/${agentId}/versions`, {
        name: versionName || `Snapshot ${new Date().toLocaleDateString()}`,
        note: versionNote || undefined,
      });
      toast.success("Version saved");
      setSaveOpen(false);
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const showDiff = async (version: number) => {
    try {
      const res = await api.get<{ diff: { groups?: DiffGroup[]; changed?: boolean } }>(
        `/api/omnidim/agents/${agentId}/versions/${version}/diff`,
      );
      setDiffGroups(res.diff?.groups ?? []);
      setDiffTitle(`Version ${version}`);
      setDiffOpen(true);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const restore = async (version: number) => {
    if (!confirm(`Restore version ${version}? Current config will be backed up first.`)) return;
    try {
      await api.post(`/api/omnidim/agents/${agentId}/versions/${version}/restore`);
      toast.success(`Restored version ${version}`);
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${agentName} — Version history`}
        description="Timeline of prompt and config snapshots with diff and restore."
      >
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/agents">
              <ArrowLeft className="mr-2 h-4 w-4" /> Agents
            </Link>
          </Button>
          <Button size="sm" className="gap-2" onClick={() => setSaveOpen(true)}>
            <Save className="h-4 w-4" /> Save snapshot
          </Button>
        </div>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" /> Versions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No saved versions yet. Save a snapshot before editing your agent prompt.
            </p>
          ) : (
            <ul className="divide-y">
              {versions.map((v) => (
                <li key={v.version_number} className="flex flex-wrap items-center gap-3 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      v{v.version_number} · {v.name ?? "Untitled"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {v.note ?? v.created_at ?? ""}
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {v.version_type ?? "manual"}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => v.version_number && showDiff(v.version_number)}
                  >
                    <GitCompare className="h-4 w-4" /> Diff
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => v.version_number && restore(v.version_number)}
                  >
                    <RotateCcw className="h-4 w-4" /> Restore
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save version snapshot</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={versionName}
                onChange={(e) => setVersionName(e.target.value)}
                placeholder="Pre-Diwali menu"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Note</Label>
              <Input
                value={versionNote}
                onChange={(e) => setVersionNote(e.target.value)}
                placeholder="Optional note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveVersion}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={diffOpen} onOpenChange={setDiffOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Diff — {diffTitle}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-96">
            {diffGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">No changes in this version.</p>
            ) : (
              <div className="space-y-4 pr-4">
                {diffGroups.map((g, i) => (
                  <div key={i}>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      {g.area}
                    </p>
                    <ul className="mt-2 space-y-2">
                      {(g.changes ?? []).map((c, j) => (
                        <li key={j} className="rounded-lg border bg-muted/20 p-2 text-sm">
                          <p className="font-medium">{c.label ?? c.field}</p>
                          <p className="text-xs text-destructive line-through">{c.old}</p>
                          <p className="text-xs text-primary">{c.new}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
