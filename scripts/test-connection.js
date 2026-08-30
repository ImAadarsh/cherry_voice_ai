import "dotenv/config";
import OmniDimension from "@omnidim-ai/sdk";

const apiKey = process.env.OMNIDIM_API_KEY;
if (!apiKey) {
  throw new Error("OMNIDIM_API_KEY is not set. Copy .env.example to .env and add your key.");
}

const omnidim = new OmniDimension({ apiKey });
const { bots } = await omnidim.agents.list({ pagesize: 5 });
console.log(`Connected. Found ${bots?.length ?? 0} agent(s).`);
if (bots?.length) {
  console.log(bots.map((a) => `- ${a.name} (id: ${a.id})`).join("\n"));
}
