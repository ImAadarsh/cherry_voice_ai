import "server-only";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool, query, queryOne } from "../db";
import type { FlowStep, FlowTemplate } from "../agent-flow-types";

interface FlowRow extends RowDataPacket {
  id: number;
  restaurant_id: number;
  name: string;
  template: FlowTemplate;
  steps: string | FlowStep[];
  generated_prompt: string | null;
  is_active: number;
  applied_agent_id: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: FlowRow) {
  const steps =
    typeof row.steps === "string"
      ? (JSON.parse(row.steps) as FlowStep[])
      : (row.steps as FlowStep[]);
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    name: row.name,
    template: row.template,
    steps,
    generatedPrompt: row.generated_prompt,
    isActive: Boolean(row.is_active),
    appliedAgentId: row.applied_agent_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listAgentFlows(restaurantId: number) {
  const rows = await query<FlowRow>(
    "SELECT * FROM agent_flows WHERE restaurant_id = ? ORDER BY updated_at DESC",
    [restaurantId],
  );
  return rows.map(mapRow);
}

export async function getAgentFlow(restaurantId: number, flowId: number) {
  const row = await queryOne<FlowRow>(
    "SELECT * FROM agent_flows WHERE id = ? AND restaurant_id = ? LIMIT 1",
    [flowId, restaurantId],
  );
  return row ? mapRow(row) : null;
}

export interface CreateAgentFlowInput {
  name: string;
  template: FlowTemplate;
  steps: FlowStep[];
  isActive?: boolean;
}

export async function createAgentFlow(restaurantId: number, input: CreateAgentFlowInput) {
  const [res] = await pool.query<ResultSetHeader>(
    `INSERT INTO agent_flows (restaurant_id, name, template, steps, is_active)
     VALUES (?, ?, ?, ?, ?)`,
    [
      restaurantId,
      input.name,
      input.template,
      JSON.stringify(input.steps),
      input.isActive !== false ? 1 : 0,
    ],
  );
  return getAgentFlow(restaurantId, res.insertId);
}

export interface UpdateAgentFlowInput {
  name?: string;
  template?: FlowTemplate;
  steps?: FlowStep[];
  generatedPrompt?: string | null;
  isActive?: boolean;
  appliedAgentId?: string | null;
}

export async function updateAgentFlow(
  restaurantId: number,
  flowId: number,
  patch: UpdateAgentFlowInput,
) {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (patch.name !== undefined) {
    sets.push("name = ?");
    params.push(patch.name);
  }
  if (patch.template !== undefined) {
    sets.push("template = ?");
    params.push(patch.template);
  }
  if (patch.steps !== undefined) {
    sets.push("steps = ?");
    params.push(JSON.stringify(patch.steps));
  }
  if (patch.generatedPrompt !== undefined) {
    sets.push("generated_prompt = ?");
    params.push(patch.generatedPrompt);
  }
  if (patch.isActive !== undefined) {
    sets.push("is_active = ?");
    params.push(patch.isActive ? 1 : 0);
  }
  if (patch.appliedAgentId !== undefined) {
    sets.push("applied_agent_id = ?");
    params.push(patch.appliedAgentId);
  }
  if (sets.length === 0) return getAgentFlow(restaurantId, flowId);
  params.push(flowId, restaurantId);
  await pool.query(
    `UPDATE agent_flows SET ${sets.join(", ")} WHERE id = ? AND restaurant_id = ?`,
    params,
  );
  return getAgentFlow(restaurantId, flowId);
}

export async function deleteAgentFlow(restaurantId: number, flowId: number) {
  const [res] = await pool.query<ResultSetHeader>(
    "DELETE FROM agent_flows WHERE id = ? AND restaurant_id = ?",
    [flowId, restaurantId],
  );
  return res.affectedRows > 0;
}
