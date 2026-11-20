// Asks Google which models this API key can actually use, instead of
// hardcoding names (Google retires model names regularly, e.g.
// gemini-2.5-flash now returns 404 for new users). Result is cached per run.
import { GoogleGenAI } from "@google/genai";

const PREFERRED_ALIASES = ["gemini-flash-latest", "gemini-flash-lite-latest"];
let cached = null;

function versionOf(name) {
  const m = name.match(/gemini-(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

export async function getTextModels() {
  if (cached) return cached;
  const found = [];
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const pager = await ai.models.list({ config: { pageSize: 200 } });
    for await (const m of pager) {
      const name = String(m.name || "").replace(/^models\//, "");
      const actions = m.supportedActions || m.supportedGenerationMethods || [];
      if (!name.includes("flash")) continue;
      if (/image|tts|audio|live|embedding|thinking-exp|preview-\d{2}-\d{2}/.test(name)) continue;
      if (actions.length && !actions.includes("generateContent")) continue;
      found.push(name);
    }
  } catch (err) {
    console.warn(`[models] Could not list models (${(err.message || "").slice(0, 150)}); using defaults.`);
  }
  const concrete = found
    .filter((n) => !PREFERRED_ALIASES.includes(n))
    .sort((a, b) => versionOf(b) - versionOf(a) || a.includes("lite") - b.includes("lite"));
  // Aliases first, then the newest concrete flash models; cap the list so a
  // fully exhausted quota fails in a couple of minutes, not ten.
  cached = [...PREFERRED_ALIASES, ...concrete].filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 5);
  console.log(`[models] Using: ${cached.join(", ")}`);
  return cached;
}
