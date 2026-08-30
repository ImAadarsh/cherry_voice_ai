import "server-only";
import { omnidimRawRequest } from "./omnidim-api";

export type OmnidimSession = {
  session_id?: number;
  token?: string;
  expires_at?: string;
  ws_url?: string;
};

type CreateSessionInput = {
  agentId: number;
  customVariables?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

/** Create a browser voice session via POST /sessions/create (OpenAPI only). */
export async function createOmnidimSession(input: CreateSessionInput): Promise<OmnidimSession> {
  return omnidimRawRequest<OmnidimSession>("/sessions/create", {
    method: "POST",
    body: JSON.stringify({
      agent_id: input.agentId,
      type: "voice",
      custom_variables: input.customVariables,
      metadata: input.metadata,
    }),
  });
}
