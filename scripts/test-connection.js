import "dotenv/config";
import { omnidim } from "../src/lib/omnidim.js";

const { bots } = await omnidim.agents.list({ pagesize: 5 });
console.log(`Connected. Found ${bots?.length ?? 0} agent(s).`);
if (bots?.length) {
  console.log(bots.map((a) => `- ${a.name} (id: ${a.id})`).join("\n"));
}
