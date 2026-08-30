import "dotenv/config";
import OmniDimension from "@omnidim-ai/sdk";

const apiKey = process.env.OMNIDIM_API_KEY;

if (!apiKey) {
  throw new Error("OMNIDIM_API_KEY is not set. Copy .env.example to .env and add your key.");
}

export const omnidim = new OmniDimension({ apiKey });
