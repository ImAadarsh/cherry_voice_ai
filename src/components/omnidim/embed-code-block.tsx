"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApiQuery } from "@/hooks/use-api-query";

type EmbedCodeBlockProps = {
  agentId: string;
};

export function EmbedCodeBlock({ agentId }: EmbedCodeBlockProps) {
  const { data, loading } = useApiQuery<{
    embed_script?: string | null;
    embed_html?: string | null;
    iframe_url?: string | null;
    available?: boolean;
    agent?: { name?: string };
  }>(agentId ? `/api/omnidim/web-calls/embed?agent_id=${encodeURIComponent(agentId)}` : null);

  const [copied, setCopied] = useState(false);
  const code = data?.embed_script ?? data?.embed_html ?? "";

  const copy = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Embed code copied");
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading embed code…</p>;
  }

  if (!data?.available || !code) {
    return (
      <p className="text-sm text-muted-foreground">
        Widget embed is not configured for this agent yet. Use the Sessions API web call
        below, or enable the web widget in the Omnidim dashboard.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Paste this on your restaurant website to let customers talk to{" "}
        <span className="font-medium text-foreground">{data.agent?.name ?? "your agent"}</span>.
      </p>
      <pre className="max-h-48 overflow-auto rounded-lg border bg-muted/40 p-3 text-xs">
        {code}
      </pre>
      <Button variant="outline" size="sm" className="gap-2" onClick={copy}>
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copied" : "Copy embed code"}
      </Button>
      {data.iframe_url && (
        <p className="text-xs text-muted-foreground">
          Direct URL:{" "}
          <a
            href={data.iframe_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-2 hover:underline"
          >
            {data.iframe_url}
          </a>
        </p>
      )}
    </div>
  );
}
