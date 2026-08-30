"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { BookOpen, Link2, Trash2, Upload } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { OmnidimSyncButton } from "@/components/omnidim/omnidim-sync-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useApiQuery } from "@/hooks/use-api-query";
import { useOmnidimSync } from "@/hooks/use-omnidim-sync";
import { api } from "@/lib/api-client";
import { mapAgentRow } from "@/lib/mappers";

type KbFile = {
  id?: number;
  filename?: string;
  file_name?: string;
  file_size?: number;
  created_at?: string;
};

export default function KnowledgeBasePage() {
  useOmnidimSync();
  const fileRef = useRef<HTMLInputElement>(null);
  const { data, loading, refetch } = useApiQuery<{ files?: KbFile[] }>(
    "/api/omnidim/knowledge-base",
  );
  const { data: agentsData } = useApiQuery<{ agents: Array<Record<string, unknown>> }>(
    "/api/agents",
  );

  const files = data?.files ?? [];
  const agents = useMemo(
    () => (agentsData?.agents ?? []).map(mapAgentRow),
    [agentsData],
  );

  const [attachOpen, setAttachOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<number | null>(null);
  const [agentId, setAgentId] = useState("");
  const [whenToUse, setWhenToUse] = useState("");
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Only PDF files are supported");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      await api.upload("/api/omnidim/knowledge-base", form);
      toast.success("PDF uploaded");
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const attach = async () => {
    if (!selectedFile || !agentId) return;
    try {
      await api.patch("/api/omnidim/knowledge-base", {
        agent_id: agentId,
        file_ids: [selectedFile],
        when_to_use: whenToUse || undefined,
      });
      toast.success("Attached to agent");
      setAttachOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const remove = async (fileId: number) => {
    if (!confirm("Delete this file from knowledge base?")) return;
    try {
      await api.delete(`/api/omnidim/knowledge-base/${fileId}`);
      toast.success("File deleted");
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Knowledge Base"
        description="PDF brochures and policies for voice agent knowledge during calls."
      >
        <div className="flex gap-2">
          <OmnidimSyncButton onSynced={refetch} />
          <Button
            size="sm"
            className="gap-2"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-4 w-4" /> Upload PDF
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
            }}
          />
        </div>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" /> Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading files…</p>
          ) : files.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No PDFs uploaded yet. Upload allergen sheets, wine lists, or catering brochures.
            </p>
          ) : (
            <ul className="divide-y">
              {files.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-3 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{f.filename ?? f.file_name ?? `File ${f.id}`}</p>
                    {f.file_size != null && (
                      <p className="text-xs text-muted-foreground">
                        {(f.file_size / 1024).toFixed(1)} KB
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => {
                      setSelectedFile(f.id ?? null);
                      setAttachOpen(true);
                    }}
                  >
                    <Link2 className="h-4 w-4" /> Attach
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => f.id && remove(f.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={attachOpen} onOpenChange={setAttachOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attach to agent</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Agent</Label>
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.omnidimAgentId} value={a.omnidimAgentId}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>When to use (optional)</Label>
              <Input
                value={whenToUse}
                onChange={(e) => setWhenToUse(e.target.value)}
                placeholder="Use for catering questions only"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttachOpen(false)}>
              Cancel
            </Button>
            <Button onClick={attach}>Attach</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
