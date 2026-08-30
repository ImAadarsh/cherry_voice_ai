import "server-only";
import type { CustomApiIntegrationInput } from "@omnidim-ai/sdk";
import { env } from "@/lib/env";
import { buildIntegrationUrl } from "@/lib/app-base-url";
import {
  buildIntegrationNameCandidates,
  integrationApiKeyMatches,
} from "@/lib/integrations/integration-scope";
import { getOmnidim } from "@/lib/omnidim";
import { findAgentByOmnidimId } from "@/lib/repositories/agents";
import { getRestaurant } from "@/lib/repositories/settings";
import {
  getOrCreateIntegrationApiKey,
  listAgentIntegrations,
  upsertAgentIntegration,
} from "@/lib/repositories/integration-keys";
import { INTEGRATION_TOOLS_PROMPT, VOICE_STYLE_PROMPT } from "@/lib/integration-tools";
import { applyAgentVoiceDefaults } from "@/lib/services/omnidim-agent-defaults";

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
    description:
      "Place a new order after collecting customer phone, name, pickup/delivery, and all items with quantities.",
    body_params: [
      {
        key: "phone",
        description: "Customer phone number with country code (required before calling)",
        type: "string",
        required: true,
      },
      {
        key: "name",
        description: "Customer full name",
        type: "string",
        required: true,
      },
      {
        key: "order_type",
        description: "pickup or delivery",
        type: "string",
        required: true,
      },
      {
        key: "items",
        description:
          'JSON array of order line items, e.g. [{"name":"Pepperoni Pizza","quantity":1}]',
        type: "string",
        required: true,
      },
      { key: "notes", description: "Special instructions or allergies", type: "string" },
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

type OmnidimClient = Awaited<ReturnType<typeof getOmnidim>>;
type IntegrationHeader = { key?: string; value?: string };

type OrgIntegration = {
  id: number;
  name: string;
  url?: string;
  method?: string;
  headers?: IntegrationHeader[];
  body_params?: IntegrationParam[];
  query_params?: IntegrationParam[];
};

function extractIntegrationId(res: Record<string, unknown>): number | null {
  const integration = res.integration as Record<string, unknown> | undefined;
  if (integration?.id != null) return Number(integration.id);
  if (res.integration_id != null) return Number(res.integration_id);
  if (res.id != null && typeof res.id === "number") return res.id;
  return null;
}

function normalizeUrl(url: string | undefined): string {
  return (url ?? "").replace(/\/$/, "");
}

type IntegrationParam = NonNullable<CustomApiIntegrationInput["body_params"]>[number];

function paramsMatchExpected(
  actual: IntegrationParam[] | undefined,
  expected: IntegrationParam[] | undefined,
): boolean {
  if (!expected?.length) return true;
  const actualParams = actual ?? [];
  for (const param of expected) {
    const hit = actualParams.find((row) => row.key === param.key);
    if (!hit) return false;
    if (param.required && !hit.required) return false;
  }
  return true;
}

function integrationMatchesToolSchema(
  integration: { body_params?: IntegrationParam[]; query_params?: IntegrationParam[]; method?: string; url?: string },
  tool: CherryVoiceToolDef,
  expectedUrl: string,
): boolean {
  if (integration.method && integration.method !== tool.method) return false;
  if (!integrationUrlMatchesTool(integration.url, tool.path, expectedUrl)) return false;
  if (!paramsMatchExpected(integration.body_params, tool.body_params)) return false;
  if (!paramsMatchExpected(integration.query_params, tool.query_params)) return false;
  return true;
}

function integrationUrlMatchesTool(
  url: string | undefined,
  toolPath: string,
  expectedUrl: string,
): boolean {
  if (!url) return false;
  if (normalizeUrl(url) === normalizeUrl(expectedUrl)) return true;
  try {
    const path = new URL(url).pathname;
    return path === toolPath || path.endsWith(toolPath);
  } catch {
    return url.endsWith(toolPath);
  }
}

function isDuplicateIntegrationSignal(err: unknown, body?: Record<string, unknown>): boolean {
  const parts: string[] = [];
  if (err instanceof Error) parts.push(err.message);
  if (body) {
    for (const key of ["error", "message", "error_description", "detail"]) {
      const val = body[key];
      if (typeof val === "string") parts.push(val);
    }
  }
  const msg = parts.join(" ").toLowerCase();
  return (
    msg.includes("already exists") ||
    msg.includes("duplicate") ||
    msg.includes("name must be unique") ||
    msg.includes("integration with this name")
  );
}

function buildToolIntegration(
  tool: CherryVoiceToolDef,
  baseUrl: string,
  apiKey: string,
  integrationName = tool.name,
): CustomApiIntegrationInput {
  return {
    name: integrationName,
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

type LiveIntegration = {
  id: number;
  name: string;
  url?: string;
  method?: string;
  headers?: IntegrationHeader[];
  body_params?: IntegrationParam[];
  query_params?: IntegrationParam[];
};

async function fetchAgentIntegrations(omnidim: OmnidimClient, agentId: string): Promise<LiveIntegration[]> {
  const res = (await omnidim.integrations.listForAgent(agentId)) as {
    integrations?: LiveIntegration[];
  };
  return res.integrations ?? [];
}

async function fetchAgentIntegrationMap(
  omnidim: OmnidimClient,
  agentId: string,
): Promise<Map<string, { id: number; url?: string }>> {
  const map = new Map<string, { id: number; url?: string }>();
  for (const row of await fetchAgentIntegrations(omnidim, agentId)) {
    if (row.name) map.set(row.name, { id: row.id, url: row.url });
  }
  return map;
}

function findAttachedIntegration(
  liveIntegrations: LiveIntegration[],
  tool: CherryVoiceToolDef,
  expectedUrl: string,
  apiKey: string,
): LiveIntegration | null {
  const normalizedExpected = normalizeUrl(expectedUrl);
  for (const row of liveIntegrations) {
    if (normalizeUrl(row.url) !== normalizedExpected) continue;
    if (!integrationUrlMatchesTool(row.url, tool.path, expectedUrl)) continue;
    if (!integrationMatchesToolSchema(row, tool, expectedUrl)) continue;
    if (!integrationApiKeyMatches(row.headers, apiKey)) continue;
    return row;
  }
  return null;
}

async function fetchOrgIntegrations(omnidim: OmnidimClient): Promise<OrgIntegration[]> {
  const res = (await omnidim.integrations.list()) as {
    integrations?: OrgIntegration[];
  };
  return res.integrations ?? [];
}

function findReusableOrgIntegration(
  orgIntegrations: OrgIntegration[],
  tool: CherryVoiceToolDef,
  expectedUrl: string,
  nameCandidates: string[],
  apiKey: string,
): OrgIntegration | undefined {
  const normalizedExpected = normalizeUrl(expectedUrl);

  for (const name of nameCandidates) {
    const hit = orgIntegrations.find((row) => row.name === name);
    if (!hit) continue;
    if (normalizeUrl(hit.url) !== normalizedExpected) continue;
    if (!integrationMatchesToolSchema(hit, tool, expectedUrl)) continue;
    if (!integrationApiKeyMatches(hit.headers, apiKey)) continue;
    return hit;
  }

  for (const integration of orgIntegrations) {
    if (normalizeUrl(integration.url) !== normalizedExpected) continue;
    if (!integrationMatchesToolSchema(integration, tool, expectedUrl)) continue;
    if (!integrationApiKeyMatches(integration.headers, apiKey)) continue;
    return integration;
  }

  return undefined;
}

async function tryCreateCustomApi(
  omnidim: OmnidimClient,
  payload: CustomApiIntegrationInput,
): Promise<number | null> {
  try {
    const created = (await omnidim.integrations.createCustomApi(payload)) as Record<string, unknown>;
    const integrationId = extractIntegrationId(created);
    if (integrationId != null) return integrationId;
    if (isDuplicateIntegrationSignal(null, created)) {
      console.warn(
        `[agent-provisioning] createCustomApi for "${payload.name}" returned no id (likely duplicate)`,
      );
      return null;
    }
    console.warn(
      `[agent-provisioning] createCustomApi for "${payload.name}" returned no integration id`,
      created,
    );
    return null;
  } catch (err) {
    if (isDuplicateIntegrationSignal(err)) {
      console.warn(
        `[agent-provisioning] Integration "${payload.name}" already exists at org level`,
        err instanceof Error ? err.message : err,
      );
      return null;
    }
    throw err;
  }
}

async function resolveIntegrationId(
  omnidim: OmnidimClient,
  tool: CherryVoiceToolDef,
  baseUrl: string,
  apiKey: string,
  restaurantId: number,
): Promise<number> {
  const expectedUrl = buildIntegrationUrl(baseUrl, tool.path);
  const nameCandidates = buildIntegrationNameCandidates(tool.name, restaurantId);

  for (const name of nameCandidates) {
    const integrationId = await tryCreateCustomApi(
      omnidim,
      buildToolIntegration(tool, baseUrl, apiKey, name),
    );
    if (integrationId != null) {
      console.info(
        `[agent-provisioning] Created ${tool.name} as "${name}" (id ${integrationId}) for restaurant ${restaurantId}`,
      );
      return integrationId;
    }

    const orgIntegrations = await fetchOrgIntegrations(omnidim);
    const reusable = findReusableOrgIntegration(
      orgIntegrations,
      tool,
      expectedUrl,
      nameCandidates,
      apiKey,
    );
    if (reusable) {
      console.info(
        `[agent-provisioning] Reusing integration ${reusable.id} ("${reusable.name}") for ${tool.name} (restaurant ${restaurantId})`,
      );
      return reusable.id;
    }
  }

  throw new Error(
    `Voice AI platform did not return an integration id for ${tool.name} (restaurant ${restaurantId})`,
  );
}

async function attachIntegrationToAgent(
  omnidim: OmnidimClient,
  agentId: string,
  integrationId: number,
): Promise<void> {
  try {
    await omnidim.integrations.addToAgent(agentId, integrationId);
  } catch (err) {
    const live = await fetchAgentIntegrationMap(omnidim, agentId);
    const alreadyAttached = [...live.values()].some((row) => row.id === integrationId);
    if (!alreadyAttached) throw err;
  }
}

async function resolveAndAttachIntegration(
  omnidim: OmnidimClient,
  tool: CherryVoiceToolDef,
  agentId: string,
  baseUrl: string,
  apiKey: string,
  restaurantId: number,
): Promise<number> {
  const integrationId = await resolveIntegrationId(omnidim, tool, baseUrl, apiKey, restaurantId);
  await attachIntegrationToAgent(omnidim, agentId, integrationId);
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
 * Idempotent: reuses org-level integrations when names collide or URLs already match.
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
  let liveIntegrations = await fetchAgentIntegrations(omnidim, agentId);
  const integrationIds: Record<string, number> = {};

  for (const tool of CHERRY_VOICE_TOOLS) {
    const expectedUrl = buildIntegrationUrl(baseUrl, tool.path);
    const knownId = existingByTool.get(tool.name);
    const attached = findAttachedIntegration(liveIntegrations, tool, expectedUrl, apiKey);

    if (attached != null) {
      integrationIds[tool.name] = attached.id;
      if (knownId !== attached.id) {
        await upsertAgentIntegration({
          restaurantId,
          omnidimAgentId: agentId,
          omnidimIntegrationId: attached.id,
          toolName: tool.name,
        });
      }
      continue;
    }

    const staleIds = new Set<number>();
    if (knownId != null) staleIds.add(knownId);
    for (const row of liveIntegrations) {
      if (!integrationUrlMatchesTool(row.url, tool.path, expectedUrl)) continue;
      if (integrationApiKeyMatches(row.headers, apiKey)) continue;
      staleIds.add(row.id);
    }
    for (const row of liveIntegrations) {
      if (integrationUrlMatchesTool(row.url, tool.path, expectedUrl)) staleIds.add(row.id);
    }
    for (const staleId of staleIds) {
      try {
        await omnidim.integrations.removeFromAgent(agentId, staleId);
      } catch {
        /* old integration may already be detached */
      }
    }

    integrationIds[tool.name] = await resolveAndAttachIntegration(
      omnidim,
      tool,
      agentId,
      baseUrl,
      apiKey,
      restaurantId,
    );
    liveIntegrations = await fetchAgentIntegrations(omnidim, agentId);
  }

  await upsertAgentPromptBlocks(agentId, restaurantId);
  await applyAgentVoiceDefaults(agentId);

  return { integrationIds, apiKey };
}

function buildRestaurantContextPrompt(
  restaurantName: string,
  currency: string,
): string {
  return `## Restaurant context
You represent **${restaurantName}** only. All menu prices and items are in **${currency}**.
Never mention dishes, prices, or policies from other restaurants. Use get_menu and get_restaurant_info for this restaurant's live data.`;
}

const MANAGED_PROMPT_TITLES = ["Voice style", "API Tools", "Restaurant context"] as const;

function isManagedPromptTitle(title: unknown): boolean {
  if (typeof title !== "string") return false;
  const normalized = title.toLowerCase();
  return MANAGED_PROMPT_TITLES.some((managed) => normalized.includes(managed.toLowerCase()));
}

/** Upsert voice-style, API-tool, and restaurant context prompt blocks (best-effort). */
export async function upsertAgentPromptBlocks(
  omnidimAgentId: string | number,
  restaurantId?: number,
): Promise<void> {
  const omnidim = await getOmnidim();
  try {
    let resolvedRestaurantId = restaurantId;
    if (resolvedRestaurantId == null) {
      const mapping = await findAgentByOmnidimId(String(omnidimAgentId));
      resolvedRestaurantId = mapping?.restaurant_id;
    }

    let restaurantContext = buildRestaurantContextPrompt("this restaurant", "local currency");
    if (resolvedRestaurantId != null) {
      const restaurant = await getRestaurant(resolvedRestaurantId);
      if (restaurant?.name) {
        restaurantContext = buildRestaurantContextPrompt(
          restaurant.name,
          restaurant.currency ?? "USD",
        );
      }
    }

    const managedBlocks = [
      { title: "Restaurant context", body: restaurantContext },
      { title: "Voice style", body: VOICE_STYLE_PROMPT },
      { title: "API Tools", body: INTEGRATION_TOOLS_PROMPT },
    ];

    const agent = (await omnidim.agents.get(omnidimAgentId)) as Record<string, unknown>;
    const breakdown = (agent.context_breakdown as Array<Record<string, unknown>> | undefined) ?? [];
    const preserved = breakdown.filter((block) => !isManagedPromptTitle(block.title ?? block.context_title));
    await omnidim.agents.update(omnidimAgentId, {
      context_breakdown: [
        ...preserved,
        ...managedBlocks.map((block) => ({
          title: block.title,
          body: block.body,
          type: "text",
          is_enabled: true,
        })),
      ],
    } as never);
  } catch {
    /* non-fatal — agent still has integrations attached */
  }
}

/** @deprecated Use upsertAgentPromptBlocks */
export async function appendIntegrationToolsPrompt(omnidimAgentId: string | number): Promise<void> {
  await upsertAgentPromptBlocks(omnidimAgentId);
}
