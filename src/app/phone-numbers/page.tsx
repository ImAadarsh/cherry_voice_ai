"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Phone, Search, ShoppingCart, Unlink } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { OmnidimSyncButton } from "@/components/omnidim/omnidim-sync-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiQuery } from "@/hooks/use-api-query";
import { useOmnidimSync } from "@/hooks/use-omnidim-sync";
import { api } from "@/lib/api-client";
import { mapAgentRow } from "@/lib/mappers";

type PhoneRow = {
  id?: number;
  phone_number?: string;
  agent_id?: number;
  agent_name?: string;
  health_score?: number;
};

type SearchResult = {
  phone_number?: string;
  monthly_rental_usd?: number;
  region?: string;
};

export default function PhoneNumbersPage() {
  useOmnidimSync();
  const { data, loading, refetch } = useApiQuery<{ phone_numbers?: PhoneRow[] }>(
    "/api/omnidim/phone-numbers",
  );
  const { data: agentsData, refetch: refetchAgents } = useApiQuery<{
    agents: Array<Record<string, unknown>>;
  }>("/api/agents");

  const numbers = data?.phone_numbers ?? [];
  const agents = useMemo(
    () => (agentsData?.agents ?? []).map(mapAgentRow),
    [agentsData],
  );

  const [region, setRegion] = useState<"US" | "IN">("US");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [attachAgent, setAttachAgent] = useState<Record<string, string>>({});

  const search = async () => {
    setSearching(true);
    try {
      const res = await api.get<{ numbers?: SearchResult[] }>(
        `/api/omnidim/phone-numbers/search?region=${region}`,
      );
      setSearchResults(res.numbers ?? []);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSearching(false);
    }
  };

  const purchase = async (phone: string) => {
    try {
      await api.post("/api/omnidim/phone-numbers/purchase", {
        phone_number: phone,
        region,
      });
      toast.success(`Purchased ${phone}`);
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const attach = async (phoneId: number, phoneNumber: string) => {
    const agentId = attachAgent[String(phoneId)];
    if (!agentId) {
      toast.error("Select an agent first");
      return;
    }
    try {
      await api.post("/api/omnidim/phone-numbers/attach", {
        phone_number_id: phoneId,
        agent_id: agentId,
        phone_number: phoneNumber,
      });
      toast.success("Number attached");
      refetch();
      refetchAgents();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const detach = async (phoneId: number) => {
    try {
      await api.post("/api/omnidim/phone-numbers/detach", { phone_number_id: phoneId });
      toast.success("Number detached");
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Phone Numbers"
        description="Search, purchase, and attach numbers to voice agents."
      >
        <OmnidimSyncButton onSynced={() => { refetch(); refetchAgents(); }} />
      </PageHeader>

      <Tabs defaultValue="owned">
        <TabsList>
          <TabsTrigger value="owned">Your numbers</TabsTrigger>
          <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
        </TabsList>

        <TabsContent value="owned" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-primary" /> Account numbers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : numbers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No numbers yet. Search the marketplace.</p>
              ) : (
                <ul className="divide-y">
                  {numbers.map((n) => (
                    <li key={n.id} className="flex flex-wrap items-center gap-3 py-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{n.phone_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {n.agent_name ? `Agent: ${n.agent_name}` : "Unassigned"}
                        </p>
                      </div>
                      {n.health_score != null && (
                        <Badge variant="outline">Health {n.health_score}</Badge>
                      )}
                      <Select
                        value={attachAgent[String(n.id)] ?? ""}
                        onValueChange={(v) =>
                          setAttachAgent((s) => ({ ...s, [String(n.id)]: v }))
                        }
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Attach agent" />
                        </SelectTrigger>
                        <SelectContent>
                          {agents.map((a) => (
                            <SelectItem key={a.omnidimAgentId} value={a.omnidimAgentId}>
                              {a.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => n.id && attach(n.id, n.phone_number ?? "")}
                      >
                        Attach
                      </Button>
                      {n.agent_id != null && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => n.id && detach(n.id)}
                        >
                          <Unlink className="h-4 w-4" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="marketplace" className="mt-4 space-y-4">
          <Card>
            <CardContent className="flex flex-wrap items-end gap-3 pt-6">
              <div className="space-y-1.5">
                <Label>Region</Label>
                <Select value={region} onValueChange={(v) => setRegion(v as "US" | "IN")}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="US">US</SelectItem>
                    <SelectItem value="IN">IN</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={search} disabled={searching} className="gap-2">
                <Search className="h-4 w-4" /> Search available
              </Button>
            </CardContent>
          </Card>

          {searchResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Available numbers</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {searchResults.map((n) => (
                    <li
                      key={n.phone_number}
                      className="flex items-center justify-between py-3"
                    >
                      <div>
                        <p className="font-semibold">{n.phone_number}</p>
                        {n.monthly_rental_usd != null && (
                          <p className="text-xs text-muted-foreground">
                            ${n.monthly_rental_usd}/mo
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        className="gap-1"
                        onClick={() => n.phone_number && purchase(n.phone_number)}
                      >
                        <ShoppingCart className="h-4 w-4" /> Buy
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
