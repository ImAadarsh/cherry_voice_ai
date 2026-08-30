import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { handleRouteError } from "@/lib/api-error";
import { requireOmnidimKey } from "@/lib/omnidim-api";
import { getOmnidim } from "@/lib/omnidim";
import { requireRestaurantId } from "@/lib/route-auth";
import { isOmnidimConfigured } from "@/lib/platform-config";
import { isNativeAgentType } from "@/lib/agent-constants";
import {
  deleteAgentIntegrations,
  deleteAgentMapping,
  listAgents,
  resolveAgentMapping,
  setPrimaryAgent,
  updateAgentMapping,
  upsertAgentMapping,
} from "@/lib/repositories/agents";
import { updateCherryVoiceSettings } from "@/lib/repositories/cherry-voice";
import { sanitizePlatformError } from "@/lib/platform-errors";
import { appendIntegrationToolsPrompt, provisionAgentWithIntegrations } from "@/lib/services/agent-provisioning";
import { applyAgentVoiceDefaults } from "@/lib/services/omnidim-agent-defaults";
import { updateNativeAgent } from "@/lib/services/native-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseAgentConfig(config: unknown): Record<string, unknown> {
  if (!config) return {};
  if (typeof config === "object") return config as Record<string, unknown>;
  try {
    return JSON.parse(String(config)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * GET /api/agents/[id]
 * Fetch a single agent's details (tenant-scoped).
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const mapping = await resolveAgentMapping(restaurantId, params.id);
  if (!mapping) return fail("Agent not found for this restaurant", 404);

  const agents = await listAgents(restaurantId);
  const row = agents.find((a) => Number(a.id) === mapping.id);
  const agentType = String(row?.agent_type ?? "platform");
  const isNative = isNativeAgentType(agentType, mapping.omnidim_agent_id);

  if (isNative) {
    const config = parseAgentConfig(row?.config);
    return ok({
      agent: {
        id: mapping.omnidim_agent_id,
        name: mapping.name,
        agent_type: "native",
        prompt: config.prompt,
        welcome_message: config.welcome_message,
        widget_position: config.widget_position,
        accent_color: config.accent_color,
        is_enabled: config.is_enabled,
        voice_id: row?.voice_id,
        context_breakdown: config.prompt
          ? [{ title: "Instructions", body: config.prompt, type: "text" }]
          : [],
      },
      mapping: { ...mapping, agent_type: "native" },
    });
  }

  if (!(await isOmnidimConfigured())) {
    return ok({ agent: null, mapping });
  }

  const key = await requireOmnidimKey();
  if (key instanceof Response) return key;

  try {
    const omnidim = await getOmnidim();
    const agent = await omnidim.agents.get(mapping.omnidim_agent_id);
    return ok({ agent, mapping: { ...mapping, agent_type: "platform" } });
  } catch (err) {
    const status = (err as { status?: number })?.status;
    return fail(
      `Failed to fetch agent: ${sanitizePlatformError((err as Error).message)}`,
      status && status >= 400 ? status : 502,
    );
  }
}

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  welcome_message: z.string().optional(),
  voice_id: z.union([z.string(), z.number()]).optional(),
  context_breakdown: z.array(z.record(z.string(), z.unknown())).optional(),
  prompt: z.string().optional(),
  is_primary: z.boolean().optional(),
  widget_position: z.enum(["bottom-right", "bottom-left"]).optional(),
  accent_color: z.string().optional(),
  is_enabled: z.boolean().optional(),
});

/**
 * PATCH /api/agents/[id]
 * Update agent — native agents update locally; platform agents sync to voice platform.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const restaurantId = await requireRestaurantId(req);
    if (restaurantId instanceof Response) return restaurantId;

    const mapping = await resolveAgentMapping(restaurantId, params.id);
    if (!mapping) return fail("Agent not found for this restaurant", 404);

    const body = await readJson(req);
    const parsed = patchSchema.safeParse(body ?? {});
    if (!parsed.success) return fail("Invalid update payload", 422, { issues: parsed.error.issues });

    const agents = await listAgents(restaurantId);
    const row = agents.find((a) => Number(a.id) === mapping.id);
    const agentType = String(row?.agent_type ?? "platform");
    const isNative = isNativeAgentType(agentType, mapping.omnidim_agent_id);
    const localId = Number(mapping.id);

    if (isNative) {
      const prompt =
        parsed.data.prompt ??
        parsed.data.context_breakdown?.find((b) => b.body)?.body?.toString();

      await updateNativeAgent(restaurantId, localId, {
        name: parsed.data.name,
        voiceId: parsed.data.voice_id != null ? String(parsed.data.voice_id) : undefined,
        prompt,
        welcomeMessage: parsed.data.welcome_message,
        widgetPosition: parsed.data.widget_position,
        accentColor: parsed.data.accent_color,
        isEnabled: parsed.data.is_enabled,
        isPrimary: parsed.data.is_primary,
      });

      if (parsed.data.is_primary) {
        await setPrimaryAgent(restaurantId, localId);
      }

      const updatedAgents = await listAgents(restaurantId);
      const updated = updatedAgents.find((a) => Number(a.id) === localId);
      const config = parseAgentConfig(updated?.config);

      return ok({
        agent: {
          id: mapping.omnidim_agent_id,
          name: parsed.data.name ?? mapping.name,
          agent_type: "native",
          prompt: config.prompt,
        },
        mapping: updated,
      });
    }

    if (!(await isOmnidimConfigured())) {
      return fail("Voice AI platform is not configured. Contact support.", 503);
    }

    const omnidim = await getOmnidim();
    const updatePayload: Record<string, unknown> = {};

    if (parsed.data.name) updatePayload.name = parsed.data.name;
    if (parsed.data.welcome_message) updatePayload.welcome_message = parsed.data.welcome_message;
    if (parsed.data.voice_id != null) updatePayload.voice_id = parsed.data.voice_id;

    const prompt = parsed.data.prompt;
    if (parsed.data.context_breakdown) {
      updatePayload.context_breakdown = parsed.data.context_breakdown;
    } else if (prompt) {
      updatePayload.context_breakdown = [{ title: "Instructions", body: prompt, type: "text" }];
    }

    if (Object.keys(updatePayload).length) {
      await provisionAgentWithIntegrations(restaurantId, mapping.omnidim_agent_id);
      await omnidim.agents.update(mapping.omnidim_agent_id, updatePayload as never);
      await applyAgentVoiceDefaults(mapping.omnidim_agent_id);
      await appendIntegrationToolsPrompt(mapping.omnidim_agent_id);
    }

    await updateAgentMapping(restaurantId, localId, {
      name: parsed.data.name,
      voiceId: parsed.data.voice_id != null ? String(parsed.data.voice_id) : undefined,
    });

    if (parsed.data.is_primary) {
      await setPrimaryAgent(restaurantId, localId);
    }

    const updated = await omnidim.agents.get(mapping.omnidim_agent_id);
    await upsertAgentMapping({
      restaurantId,
      omnidimAgentId: mapping.omnidim_agent_id,
      name: parsed.data.name ?? mapping.name,
      agentType: "platform",
      config: updated,
    });

    return ok({ agent: updated, mapping });
  } catch (err) {
    console.error("[agents] Failed to update agent:", err);
    return fail(`Failed to update agent: ${sanitizePlatformError((err as Error).message)}`, 502);
  }
}

/**
 * DELETE /api/agents/[id]
 * Delete agent — native agents are local-only; platform agents also delete remotely.
 */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const restaurantId = await requireRestaurantId(req);
    if (restaurantId instanceof Response) return restaurantId;

    const mapping = await resolveAgentMapping(restaurantId, params.id);
    if (!mapping) return fail("Agent not found for this restaurant", 404);

    const agents = await listAgents(restaurantId);
    const row = agents.find((a) => Number(a.id) === mapping.id);
    const agentType = String(row?.agent_type ?? "platform");
    const isNative = isNativeAgentType(agentType, mapping.omnidim_agent_id);

    if (!isNative && (await isOmnidimConfigured())) {
      try {
        const omnidim = await getOmnidim();
        await omnidim.agents.delete(mapping.omnidim_agent_id);
      } catch (err) {
        const status = (err as { status?: number })?.status;
        if (status !== 404) {
          console.error("[agents] Failed to delete remote agent:", err);
          return fail(
            `Failed to delete agent: ${sanitizePlatformError((err as Error).message)}`,
            status && status >= 400 ? status : 502,
          );
        }
      }
      await deleteAgentIntegrations(restaurantId, mapping.omnidim_agent_id);
    }

    if (isNative) {
      await updateCherryVoiceSettings(restaurantId, { agentId: null });
    }

    await deleteAgentMapping(restaurantId, mapping.id);

    return ok({ deleted: true, id: mapping.id });
  } catch (err) {
    return handleRouteError(err);
  }
}
