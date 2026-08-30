/**
 * Smoke test: Gemini function calling with user-role functionResponse
 * and thoughtSignature preservation when replaying model functionCall parts.
 * Run: node scripts/test-gemini-function-calling.mjs
 */
import "dotenv/config";
import { GoogleGenerativeAI, FunctionCallingMode, SchemaType } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
const modelName = process.env.CHERRY_VOICE_GEMINI_MODEL || "gemini-3.5-flash-lite";

if (!apiKey) {
  console.error("GEMINI_API_KEY not set");
  process.exit(1);
}

const tools = [
  {
    name: "get_menu",
    description: "Fetch the restaurant menu",
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
];

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({
  model: modelName,
  tools: [{ functionDeclarations: tools }],
  toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.AUTO } },
});

function parseToolCalls(parts) {
  return parts
    .filter((p) => p.functionCall?.name)
    .map((p) => ({
      name: p.functionCall.name,
      args: p.functionCall.args ?? {},
      thoughtSignature: p.thoughtSignature ?? p.thought_signature,
      id: p.functionCall.id,
    }));
}

function buildFunctionCallPart(tc) {
  const part = {
    functionCall: {
      name: tc.name,
      args: tc.args,
      ...(tc.id ? { id: tc.id } : {}),
    },
  };
  if (tc.thoughtSignature) part.thoughtSignature = tc.thoughtSignature;
  return part;
}

console.log(`Testing ${modelName} function calling...`);

// Step 1: User asks for menu
const step1 = await model.generateContent({
  contents: [{ role: "user", parts: [{ text: "What's on the menu?" }] }],
});
const step1Parts = step1.response.candidates?.[0]?.content?.parts ?? [];
const toolCalls = parseToolCalls(step1Parts);
console.log("Step 1 tool calls:", toolCalls.map((t) => t.name));

if (toolCalls.length === 0) {
  console.log("No tool call returned (model may have answered directly):", step1Parts);
  process.exit(0);
}

if (!toolCalls[0].thoughtSignature) {
  console.error("FAIL: model did not return thoughtSignature on functionCall");
  process.exit(1);
}

// Step 2: Replay reconstructed parts (mirrors gemini-llm.ts messagesToContents)
const reconstructedModelParts = toolCalls.map(buildFunctionCallPart);
const step2 = await model.generateContent({
  contents: [
    { role: "user", parts: [{ text: "What's on the menu?" }] },
    { role: "model", parts: reconstructedModelParts },
    {
      role: "user",
      parts: [
        {
          functionResponse: {
            name: toolCalls[0].name,
            response: {
              ok: true,
              data: { items: [{ name: "Margherita Pizza", price: 12.99 }] },
            },
          },
        },
      ],
    },
  ],
});
const step2Text = step2.response.candidates?.[0]?.content?.parts
  ?.map((p) => p.text ?? "")
  .join("")
  .trim();
console.log("Step 2 response:", step2Text?.slice(0, 200));
console.log("PASS: function calling loop preserves thoughtSignature on replay");
