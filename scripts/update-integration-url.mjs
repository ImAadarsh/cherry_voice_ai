#!/usr/bin/env node
/**
 * Re-point Omnidim custom API integrations to the current APP_BASE_URL.
 *
 * Omnidim cloud cannot call localhost — use ngrok/Cloudflare Tunnel for local dev:
 *   ngrok http 3000
 *   APP_BASE_URL=https://xxxx.ngrok-free.app node scripts/update-integration-url.mjs
 *
 * Usage:
 *   node scripts/update-integration-url.mjs [--restaurant-id=4] [--agent-id=246365] [--base-url=https://...]
 */
import "dotenv/config";
import mysql from "mysql2/promise";
import OmniDimension from "@omnidim-ai/sdk";

const CHERRY_VOICE_TOOLS = [
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
  { name: "get_menu", method: "GET", path: "/api/integrations/omnidim/menu", description: "Read menu." },
  {
    name: "lookup_customer",
    method: "GET",
    path: "/api/integrations/omnidim/customer",
    description: "Look up customer by phone.",
    query_params: [{ key: "phone", description: "Phone", type: "string", required: true }],
  },
  {
    name: "send_payment_link",
    method: "POST",
    path: "/api/integrations/omnidim/send-payment-link",
    description: "Send payment link.",
    body_params: [{ key: "order_id", description: "Order id", type: "number", required: true }],
  },
  {
    name: "create_reservation",
    method: "POST",
    path: "/api/integrations/omnidim/create-reservation",
    description: "Book a table.",
    body_params: [
      { key: "customer_name", description: "Name", type: "string", required: true },
      { key: "customer_phone", description: "Phone", type: "string", required: true },
      { key: "party_size", description: "Guests", type: "number", required: true },
      { key: "reserved_at", description: "ISO datetime", type: "string", required: true },
    ],
  },
  {
    name: "get_restaurant_info",
    method: "GET",
    path: "/api/integrations/omnidim/restaurant",
    description: "Get hours and policies.",
  },
];

function parseArg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.split("=").slice(1).join("=") ?? null;
}

function buildUrl(base, path) {
  return `${base.replace(/\/$/, "")}${path}`;
}

function normalizeUrl(url) {
  return (url ?? "").replace(/\/$/, "");
}

function isUnreachableFromCloud(baseUrl) {
  try {
    const { hostname } = new URL(baseUrl);
    const host = hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local")) {
      return true;
    }
    if (/^10\./.test(host)) return true;
    if (/^192\.168\./.test(host)) return true;
    const m = host.match(/^172\.(\d+)\./);
    if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
    return false;
  } catch {
    return true;
  }
}

function paramsMatchExpected(actual, expected) {
  if (!expected?.length) return true;
  const actualParams = actual ?? [];
  for (const param of expected) {
    const hit = actualParams.find((row) => row.key === param.key);
    if (!hit) return false;
    if (param.required && !hit.required) return false;
  }
  return true;
}

function integrationMatchesToolSchema(integration, tool, expectedUrl) {
  if (integration.method && integration.method !== tool.method) return false;
  if (!integrationUrlMatchesTool(integration.url, tool.path, expectedUrl)) return false;
  if (!paramsMatchExpected(integration.body_params, tool.body_params)) return false;
  if (!paramsMatchExpected(integration.query_params, tool.query_params)) return false;
  return true;
}

function integrationUrlMatchesTool(url, toolPath, expectedUrl) {
  if (!url) return false;
  if (normalizeUrl(url) === normalizeUrl(expectedUrl)) return true;
  try {
    const path = new URL(url).pathname;
    return path === toolPath || path.endsWith(toolPath);
  } catch {
    return url.endsWith(toolPath);
  }
}

function isDuplicateIntegrationSignal(err, body) {
  const parts = [];
  if (err?.message) parts.push(err.message);
  if (body) {
    for (const key of ["error", "message", "error_description", "detail"]) {
      if (typeof body[key] === "string") parts.push(body[key]);
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

function buildIntegrationNameCandidates(toolName, restaurantId) {
  const primary = `${toolName}_r${restaurantId}`;
  return [primary, `${primary}_v2`, `${primary}_v3`];
}

function extractIntegrationApiKey(headers) {
  if (!headers?.length) return null;
  for (const row of headers) {
    const key = row.key?.trim().toLowerCase();
    if (key === "x-restaurant-key" && row.value?.trim()) return row.value.trim();
  }
  for (const row of headers) {
    const key = row.key?.trim().toLowerCase();
    if (key === "authorization" && row.value?.trim()) {
      const match = row.value.trim().match(/^Bearer\s+(.+)$/i);
      if (match?.[1]?.trim()) return match[1].trim();
    }
  }
  return null;
}

function integrationApiKeyMatches(headers, expectedApiKey) {
  const actual = extractIntegrationApiKey(headers);
  return actual != null && actual === expectedApiKey;
}

function extractIntegrationId(res) {
  return res?.integration?.id ?? res?.integration_id ?? res?.id ?? null;
}

async function fetchOrgIntegrations(omnidim) {
  const res = await omnidim.integrations.list();
  return res.integrations ?? [];
}

function findReusableOrgIntegration(orgIntegrations, tool, expectedUrl, nameCandidates, apiKey) {
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

async function tryCreateCustomApi(omnidim, payload) {
  try {
    const created = await omnidim.integrations.createCustomApi(payload);
    const integrationId = extractIntegrationId(created);
    if (integrationId != null) return integrationId;
    if (isDuplicateIntegrationSignal(null, created)) {
      console.warn(`  ! createCustomApi for "${payload.name}" returned no id (likely duplicate)`);
      return null;
    }
    console.warn(`  ! createCustomApi for "${payload.name}" returned no integration id`);
    return null;
  } catch (err) {
    if (isDuplicateIntegrationSignal(err)) {
      console.warn(`  ! Integration "${payload.name}" already exists at org level`);
      return null;
    }
    throw err;
  }
}

async function resolveIntegrationId(omnidim, tool, baseUrl, apiKey, restaurantId) {
  const expectedUrl = buildUrl(baseUrl, tool.path);
  const nameCandidates = buildIntegrationNameCandidates(tool.name, restaurantId);

  for (const name of nameCandidates) {
    const integrationId = await tryCreateCustomApi(omnidim, {
      name,
      url: expectedUrl,
      method: tool.method,
      description: tool.description ?? tool.name,
      headers: [
        { key: "Authorization", value: `Bearer ${apiKey}` },
        { key: "X-Restaurant-Key", value: apiKey },
      ],
      query_params: tool.query_params,
      body_params: tool.body_params,
      request_timeout: 30,
    });
    if (integrationId != null) {
      console.log(`  + created ${tool.name} as "${name}" (id ${integrationId})`);
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
      console.log(`  ~ reusing integration ${reusable.id} ("${reusable.name}") for ${tool.name}`);
      return reusable.id;
    }
  }

  throw new Error(`No integration id returned for ${tool.name} (restaurant ${restaurantId})`);
}

async function attachIntegrationToAgent(omnidim, agentId, integrationId) {
  try {
    await omnidim.integrations.addToAgent(agentId, integrationId);
  } catch (err) {
    const live = await omnidim.integrations.listForAgent(agentId);
    const alreadyAttached = (live.integrations ?? []).some((row) => row.id === integrationId);
    if (!alreadyAttached) throw err;
  }
}

function findAttachedIntegration(liveIntegrations, tool, expectedUrl, apiKey) {
  for (const row of liveIntegrations) {
    if (normalizeUrl(row.url) !== normalizeUrl(expectedUrl)) continue;
    if (!integrationMatchesToolSchema(row, tool, expectedUrl)) continue;
    if (!integrationApiKeyMatches(row.headers, apiKey)) continue;
    return row;
  }
  return null;
}

async function getDb() {
  return mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
}

async function resolveApiKey(omnidim, agentId, conn, restaurantId) {
  if (restaurantId) {
    const [keyRows] = await conn.query(
      "SELECT api_key FROM restaurant_integration_keys WHERE restaurant_id = ? LIMIT 1",
      [restaurantId],
    );
    if (keyRows[0]?.api_key) return keyRows[0].api_key;
  }

  const agentsRes = await omnidim.agents.list({ pagesize: 100 });
  const bots = agentsRes.bots ?? agentsRes.agents ?? [];
  const agent = bots.find((b) => String(b.id) === String(agentId));
  const headerKey = agent?.integrations?.[0]?.headers?.find(
    (h) => h.key?.toLowerCase() === "x-restaurant-key",
  )?.value;
  if (headerKey) {
    console.log("  Using API key from Omnidim agent integration headers");
    if (restaurantId) {
      await conn.query(
        `INSERT INTO restaurant_integration_keys (restaurant_id, api_key) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE api_key = VALUES(api_key)`,
        [restaurantId, headerKey],
      );
    }
    return headerKey;
  }

  return null;
}

async function main() {
  const baseUrl = parseArg("base-url") || process.env.APP_BASE_URL;
  if (!baseUrl) throw new Error("Set APP_BASE_URL or pass --base-url=https://...");

  if (/localhost|127\.0\.0\.1/i.test(baseUrl)) {
    console.warn(
      "WARNING: APP_BASE_URL is localhost — Omnidim cloud CANNOT reach it during web/phone calls.",
    );
    console.warn("Use ngrok:  ngrok http 3000  →  APP_BASE_URL=https://<id>.ngrok-free.app");
  }

  const omnidim = new OmniDimension({ apiKey: process.env.OMNIDIM_API_KEY });
  const conn = await getDb();

  try {
    const restaurantId = parseArg("restaurant-id");
    const agentIdArg = parseArg("agent-id");

    let agents = [];
    if (agentIdArg) {
      const [rows] = await conn.query(
        "SELECT restaurant_id, omnidim_agent_id FROM omnidim_agents WHERE omnidim_agent_id = ? LIMIT 1",
        [agentIdArg],
      );
      agents = rows.length
        ? rows
        : [{ restaurant_id: restaurantId, omnidim_agent_id: agentIdArg }];
    } else {
      const sql = restaurantId
        ? "SELECT restaurant_id, omnidim_agent_id FROM omnidim_agents WHERE restaurant_id = ?"
        : "SELECT restaurant_id, omnidim_agent_id FROM omnidim_agents";
      const [rows] = await conn.query(sql, restaurantId ? [restaurantId] : []);
      agents = rows;
    }

    if (!agents.length) {
      console.error("No omnidim_agents rows found. Run setup or onboarding first.");
      process.exit(1);
    }

    for (const row of agents) {
      const agentId = String(row.omnidim_agent_id);
      const rid = Number(row.restaurant_id);
      console.log(`\nAgent ${agentId} (restaurant ${rid}) → ${baseUrl}`);

      let apiKey = await resolveApiKey(omnidim, agentId, conn, rid || null);
      if (!apiKey) throw new Error(`No integration API key for agent ${agentId}`);

      const live = await omnidim.integrations.listForAgent(agentId);
      const liveIntegrations = live.integrations ?? [];

      const [dbRows] = await conn.query(
        "SELECT tool_name, omnidim_integration_id FROM omnidim_agent_integrations WHERE restaurant_id = ? AND omnidim_agent_id = ?",
        [rid, agentId],
      );
      const dbByTool = new Map(dbRows.map((r) => [r.tool_name, r.omnidim_integration_id]));

      for (const tool of CHERRY_VOICE_TOOLS) {
        const expectedUrl = buildUrl(baseUrl, tool.path);
        const attached = findAttachedIntegration(liveIntegrations, tool, expectedUrl, apiKey);
        const knownId = dbByTool.get(tool.name);

        if (attached != null) {
          console.log(`  ✓ ${tool.name} attached with correct tenant key at ${expectedUrl}`);
          if (knownId !== attached.id) {
            await conn.query(
              `INSERT INTO omnidim_agent_integrations (restaurant_id, omnidim_agent_id, omnidim_integration_id, tool_name)
               VALUES (?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE omnidim_integration_id = VALUES(omnidim_integration_id)`,
              [rid, agentId, attached.id, tool.name],
            );
          }
          continue;
        }

        const staleIds = new Set();
        if (knownId) staleIds.add(knownId);
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
            console.log(`  - removed stale ${tool.name} (${staleId})`);
          } catch (err) {
            console.warn(`  ! could not remove ${tool.name}: ${err.message}`);
          }
        }

        const newId = await resolveIntegrationId(omnidim, tool, baseUrl, apiKey, rid);
        await attachIntegrationToAgent(omnidim, agentId, newId);
        await conn.query(
          `INSERT INTO omnidim_agent_integrations (restaurant_id, omnidim_agent_id, omnidim_integration_id, tool_name)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE omnidim_integration_id = VALUES(omnidim_integration_id)`,
          [rid, agentId, newId, tool.name],
        );
        console.log(`  + ${tool.name} → ${expectedUrl} (id ${newId})`);
      }
    }

    console.log("\nDone. Verify with a web call or:");
    console.log(`  curl -H "Authorization: Bearer <key>" ${buildUrl(baseUrl, "/api/integrations/omnidim/menu")}`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
