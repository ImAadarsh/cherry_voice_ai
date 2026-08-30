import "server-only";
import type { CustomApiIntegrationInput } from "@omnidim-ai/sdk";
import { env } from "@/lib/env";
import { buildIntegrationUrl } from "@/lib/app-base-url";
import { getOmnidim } from "@/lib/omnidim";
import {
  getOrCreateIntegrationApiKey,
  listAgentIntegrations,
  upsertAgentIntegration,
} from "@/lib/repositories/integration-keys";
import { INTEGRATION_TOOLS_PROMPT } from "@/lib/integration-tools";

export interface CherryVoiceToolDef {
  name: string;
  method: CustomApiIntegrationInput["method"];
  path: string;
  description: string;
  query_params?: CustomApiIntegrationInput["query_params"];
  body_params?: CustomApiIntegrationInput["body_params"];
}

export const CHERRY_VOICE_TOOLS: CherryVoiceToolDef[] = [
  {
    name: "create_order",
    method: "POST",
    path: "/api/integrations/omnidim/create-order",
    description: "Place a new order for the caller. Saves items to the restaurant database.",
    body_params: [
      { key: "phone", description: "Customer phone (E.164)", type: "string", required: true },
      { key: "name", description: "Customer name", type: "string" },
      { key: "order_type", description: "pickup or delivery", type: "string" },
      {
        key: "items",
        description: "JSON array of {name, quantity, sku?, notes?}",
        type: "string",
        required: true,
      },
      { key: "notes", description: "Order notes", type: "string" },
    ],
  },
  {
    name: "get_menu",
    method: "GET",
    path: "/api/integrations/omnidim/menu",
    description: "Read the current menu with categories, prices, and availability.",
  },
  {
    name: "lookup_customer",
    method: "GET",
    path: "/api/integrations/omnidim/customer",
    description: "Look up a customer by phone number and return profile plus recent orders.",
    query_params: [
      { key: "phone", description: "Customer phone (E.164)", type: "string", required: true },
    ],
  },
  {
    name: "send_payment_link",
    method: "POST",
    path: "/api/integrations/omnidim/send-payment-link",
    description: "Generate a payment link for an order and send it via SMS or email.",
    body_params: [
      { key: "order_id", description: "Order id from create_order", type: "number", required: true },
      { key: "phone", description: "Override SMS destination", type: "string" },
      { key: "email", description: "Override email destination", type: "string" },
    ],
  },
  {
    name: "create_reservation",
    method: "POST",
    path: "/api/integrations/omnidim/create-reservation",
    description: "Book a table reservation for the caller.",
    body_params: [
      { key: "customer_name", description: "Guest name", type: "string", required: true },
      { key: "customer_phone", description: "Guest phone", type: "string", required: true },
      { key: "party_size", description: "Number of guests", type: "number", required: true },
      { key: "reserved_at", description: "ISO datetime for reservation", type: "string", required: true },
      { key: "notes", description: "Special requests", type: "string" },
    ],
  },
  {
    name: "get_restaurant_info",
    method: "GET",
    path: "/api/integrations/omnidim/restaurant",
    description: "Get hours, delivery area, policies, and restaurant details.",
  },
];

function extractIntegrationId(res: Record<string, unknown>): number | null {
  const integration = res.integration as Record<string, unknown> | undefined;
  if (integration?.id != null) return Number(integration.id);
  if (res.integration_id != null) return Number(res.integration_id);
  if (res.id != null && typeof res.id === "number") return res.id;
  return null;
}

function buildToolIntegration(
  tool: CherryVoiceToolDef,
  baseUrl: string,
  apiKey: string,
): CustomApiIntegrationInput {
  return {
    name: tool.name,
    url: buildIntegrationUrl(baseUrl, tool.path),
    method: tool.method,
    description: tool.description,
    headers: [
      { key: "Authorization", value: `Bearer ${apiKey}` },
      { key: "X-Restaurant-Key", value: apiKey },
    ],
    query_params: tool.query_params,
    body_params: tool.body_params,
    request_timeout: 30,
  };
}

async function fetchAgentIntegrationMap(
  omnidim: Awaited<ReturnType<typeof getOmnidim>>,
  agentId: string,
): Promise<Map<string, { id: number; url?: string }>> {
  const res = (await omnidim.integrations.listForAgent(agentId)) as {
    integrations?: Array<{ id: number; name: string; url?: string }>;
  };
  const map = new Map<string, { id: number; url?: string }>();
  for (const row of res.integrations ?? []) {
    if (row.name) map.set(row.name, { id: row.id, url: row.url });
  }
  return map;
}

async function createAndAttachIntegration(
  omnidim: Awaited<ReturnType<typeof getOmnidim>>,
  tool: CherryVoiceToolDef,
  agentId: string,
  baseUrl: string,
  apiKey: string,
  restaurantId: number,
): Promise<number> {
  const payload = buildToolIntegration(tool, baseUrl, apiKey);
  const created = (await omnidim.integrations.createCustomApi(payload)) as Record<string, unknown>;
  const integrationId = extractIntegrationId(created);
  if (integrationId == null) {
    throw new Error(`Omnidim did not return an integration id for ${tool.name}`);
  }
  await omnidim.integrations.addToAgent(agentId, integrationId);
  await upsertAgentIntegration({
    restaurantId,
    omnidimAgentId: agentId,
    omnidimIntegrationId: integrationId,
    toolName: tool.name,
  });
  return integrationId;
}

/**
 * Create Omnidim custom API integrations for all Cherry Voice tools and attach
 * them to the agent. Re-provisions any tool whose URL no longer matches APP_BASE_URL.
 */
export async function provisionAgentWithIntegrations(
  restaurantId: number,
  omnidimAgentId: string | number,
): Promise<{ integrationIds: Record<string, number>; apiKey: string }> {
  const omnidim = await getOmnidim();
  const agentId = String(omnidimAgentId);
  const apiKey = await getOrCreateIntegrationApiKey(restaurantId);
  const baseUrl = env.APP_BASE_URL;
  const existing = await listAgentIntegrations(restaurantId, agentId);
  const existingByTool = new Map(existing.map((row) => [row.tool_name, row.omnidim_integration_id]));
  const liveIntegrations = await fetchAgentIntegrationMap(omnidim, agentId);
  const integrationIds: Record<string, number> = {};

  for (const tool of CHERRY_VOICE_TOOLS) {
    const expectedUrl = buildIntegrationUrl(baseUrl, tool.path);
    const knownId = existingByTool.get(tool.name);
    const live = knownId != null ? liveIntegrations.get(tool.name) : undefined;

    if (knownId != null && live?.url === expectedUrl) {
      integrationIds[tool.name] = knownId;
      continue;
    }

    if (knownId != null) {
      try {
        await omnidim.integrations.removeFromAgent(agentId, knownId);
      } catch {
        /* old integration may already be detached */
      }
    }

    integrationIds[tool.name] = await createAndAttachIntegration(
      omnidim,
      tool,
      agentId,
      baseUrl,
      apiKey,
      restaurantId,
    );
  }

  await appendIntegrationToolsPrompt(agentId);

  return { integrationIds, apiKey };
}

/** Append tool usage instructions to the agent context (best-effort). */
export async function appendIntegrationToolsPrompt(omnidimAgentId: string | number): Promise<void> {
  const omnidim = await getOmnidim();
  try {
    const agent = (await omnidim.agents.get(omnidimAgentId)) as Record<string, unknown>;
    const breakdown = (agent.context_breakdown as Array<Record<string, unknown>> | undefined) ?? [];
    const hasTools = breakdown.some(
      (block) => typeof block.title === "string" && block.title.toLowerCase().includes("api tools"),
    );
    if (hasTools) return;

    await omnidim.agents.update(omnidimAgentId, {
      context_breakdown: [
        ...breakdown,
        { title: "API Tools", body: INTEGRATION_TOOLS_PROMPT, type: "text" },
      ],
    } as never);
  } catch {
    /* non-fatal — agent still has integrations attached */
  }
}
