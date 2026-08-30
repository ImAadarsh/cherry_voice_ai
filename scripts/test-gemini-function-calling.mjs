/**
 * Smoke test: Gemini function calling with user-role functionResponse,
 * thoughtSignature preservation when replaying model functionCall parts,
 * streaming path (aggregated response drops signatures), and multi-turn history.
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

function normalizeToolName(name) {
  return name.replace(/^default_api:/, "");
}

function parseToolCalls(parts) {
  return parts
    .filter((p) => p.functionCall?.name)
    .map((p) => ({
      name: normalizeToolName(p.functionCall.name),
      args: p.functionCall.args ?? {},
      thoughtSignature: p.thoughtSignature ?? p.thought_signature,
      id: p.functionCall.id,
    }));
}

function buildFunctionCallPart(tc) {
  if (!tc.thoughtSignature) return null;
  return {
    functionCall: {
      name: tc.name,
      args: tc.args,
      ...(tc.id ? { id: tc.id } : {}),
    },
    thoughtSignature: tc.thoughtSignature,
  };
}

function accumulateStreamParts(accumulated, incoming) {
  if (!incoming?.length) return;
  for (const part of incoming) {
    if (part.functionCall?.name) {
      const sig = part.thoughtSignature ?? part.thought_signature;
      const idx = accumulated.findIndex((p) => {
        if (part.functionCall.id && p.functionCall?.id) return p.functionCall.id === part.functionCall.id;
        return p.functionCall?.name === part.functionCall.name;
      });
      if (idx >= 0) {
        if (sig) accumulated[idx] = { ...accumulated[idx], ...part, thoughtSignature: sig };
      } else {
        accumulated.push(part);
      }
    }
  }
}

async function streamToolCalls(userText) {
  const accumulated = [];
  const stream = await model.generateContentStream({
    contents: [{ role: "user", parts: [{ text: userText }] }],
  });
  for await (const chunk of stream.stream) {
    accumulateStreamParts(accumulated, chunk.candidates?.[0]?.content?.parts);
  }
  const response = await stream.response;
  const responseParts = response.candidates?.[0]?.content?.parts ?? [];
  const parts = accumulated.length ? accumulated : responseParts;
  return parseToolCalls(parts);
}

console.log(`Testing ${modelName} function calling...`);

// Step 1: non-streaming tool call
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

// Step 2: replay with signature (single-turn tool loop)
const reconstructedModelParts = toolCalls.map(buildFunctionCallPart).filter(Boolean);
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
console.log("Step 2 response:", step2Text?.slice(0, 120));

// Step 3: streaming must preserve thoughtSignature from chunks
const streamToolCallsResult = await streamToolCalls("Show me the menu please");
if (streamToolCallsResult.length === 0) {
  console.log("Step 3: streaming returned no tool call (model answered directly)");
} else if (!streamToolCallsResult[0].thoughtSignature) {
  console.error("FAIL: streaming path lost thoughtSignature on functionCall");
  process.exit(1);
} else {
  console.log("Step 3: streaming preserved thoughtSignature");
}

// Step 4: multi-turn history replay (position 4 = model functionCall on turn 2)
const turn1User = { role: "user", parts: [{ text: "Hi, I'd like to order" }] };
const turn1Model = { role: "model", parts: [{ text: "Sure! What would you like today?" }] };
const turn2User = { role: "user", parts: [{ text: "1 chicken dinner today" }] };
const turn2StreamCalls = await streamToolCalls("1 chicken dinner today");
if (turn2StreamCalls.length === 0) {
  console.log("Step 4: turn 2 did not call get_menu (model may answer without tools)");
} else {
  const turn2ModelParts = turn2StreamCalls.map(buildFunctionCallPart).filter(Boolean);
  if (turn2ModelParts.length === 0) {
    console.error("FAIL: turn 2 tool call missing thoughtSignature for history replay");
    process.exit(1);
  }
  const historyContents = [
    turn1User,
    turn1Model,
    turn2User,
    { role: "model", parts: turn2ModelParts },
    {
      role: "user",
      parts: [
        {
          functionResponse: {
            name: turn2StreamCalls[0].name,
            response: {
              ok: true,
              data: { items: [{ name: "Chicken Dinner", price: 14.99 }] },
            },
          },
        },
      ],
    },
  ];
  console.log("Step 4: replaying", historyContents.length, "content items (functionCall at index 3)");
  const step4 = await model.generateContent({ contents: historyContents });
  const step4Text = step4.response.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("")
    .trim();
  console.log("Step 4 response:", step4Text?.slice(0, 120));
}

console.log("PASS: function calling preserves thoughtSignature (stream + multi-turn)");
