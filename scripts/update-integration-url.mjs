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
  { name: "create_order", method: "POST", path: "/api/integrations/omnidim/create-order" },
  { name: "get_menu", method: "GET", path: "/api/integrations/omnidim/menu" },
  { name: "lookup_customer", method: "GET", path: "/api/integrations/omnidim/customer" },
  { name: "send_payment_link", method: "POST", path: "/api/integrations/omnidim/send-payment-link" },
  { name: "create_reservation", method: "POST", path: "/api/integrations/omnidim/create-reservation" },
  { name: "get_restaurant_info", method: "GET", path: "/api/integrations/omnidim/restaurant" },
];

function parseArg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.split("=").slice(1).join("=") ?? null;
}

function buildUrl(base, path) {
  return `${base.replace(/\/$/, "")}${path}`;
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
      const liveByName = new Map((live.integrations ?? []).map((i) => [i.name, i]));

      const [dbRows] = await conn.query(
        "SELECT tool_name, omnidim_integration_id FROM omnidim_agent_integrations WHERE restaurant_id = ? AND omnidim_agent_id = ?",
        [rid, agentId],
      );
      const dbByTool = new Map(dbRows.map((r) => [r.tool_name, r.omnidim_integration_id]));

      for (const tool of CHERRY_VOICE_TOOLS) {
        const expectedUrl = buildUrl(baseUrl, tool.path);
        const current = liveByName.get(tool.name);
        const knownId = dbByTool.get(tool.name);

        if (current?.url === expectedUrl) {
          console.log(`  ✓ ${tool.name} already at ${expectedUrl}`);
          continue;
        }

        if (knownId) {
          try {
            await omnidim.integrations.removeFromAgent(agentId, knownId);
            console.log(`  - removed stale ${tool.name} (${knownId})`);
          } catch (err) {
            console.warn(`  ! could not remove ${tool.name}: ${err.message}`);
          }
        }

        const created = await omnidim.integrations.createCustomApi({
          name: tool.name,
          url: expectedUrl,
          method: tool.method,
          description: tool.name,
          headers: [
            { key: "Authorization", value: `Bearer ${apiKey}` },
            { key: "X-Restaurant-Key", value: apiKey },
          ],
          request_timeout: 30,
        });
        const newId =
          created?.integration?.id ?? created?.integration_id ?? created?.id ?? null;
        if (!newId) throw new Error(`No integration id returned for ${tool.name}`);

        await omnidim.integrations.addToAgent(agentId, newId);
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
