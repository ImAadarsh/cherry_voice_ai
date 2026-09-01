import "server-only";
import { SchemaType } from "@google/generative-ai";
import { CHERRY_VOICE_TOOL_DECLARATIONS } from "./tools";

type JsonSchema = Record<string, unknown>;

function geminiSchemaToJsonSchema(schema: JsonSchema): JsonSchema {
  const out: JsonSchema = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === "type" && typeof value === "string") {
      out.type = value.toLowerCase();
    } else if (key === "properties" && value && typeof value === "object") {
      const props: Record<string, JsonSchema> = {};
      for (const [propKey, propVal] of Object.entries(value as Record<string, JsonSchema>)) {
        props[propKey] = geminiSchemaToJsonSchema(propVal);
      }
      out.properties = props;
    } else if (key === "items" && value && typeof value === "object") {
      out.items = geminiSchemaToJsonSchema(value as JsonSchema);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** OpenAI Realtime API tool format (flat name/description/parameters). */
export const CHERRY_VOICE_REALTIME_TOOLS = CHERRY_VOICE_TOOL_DECLARATIONS.map((decl) => ({
  type: "function" as const,
  name: decl.name,
  description: decl.description,
  parameters: geminiSchemaToJsonSchema(decl.parameters as JsonSchema),
}));
