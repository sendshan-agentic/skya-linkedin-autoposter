// Pulls genuinely fresh headlines for the news / geopolitics / controversy
// pillars using Gemini with Google Search grounding, so posts are built on
// real stories from this week instead of the model's stale memory.
// Returns [] on any failure; the caller then falls back to the live trend feed.
import { GoogleGenAI } from "@google/genai";
import { getTextModels } from "./models.mjs";

function extractJsonArray(text) {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function fetchFreshHeadlines(pillar, avoid = []) {
  if (!pillar.searchBrief) return [];
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const today = new Date().toISOString().slice(0, 10);
  const avoidText = avoid.length
    ? `\nDo NOT include any of these already-covered stories (or the same story reworded):\n${avoid.map((a) => `- ${a}`).join("\n")}\n`
    : "";

  const prompt = `Today is ${today}. Use Google Search to find 6 distinct, real, verifiable stories about ${pillar.searchBrief}.
Only stories published in the last 7 days. Each must be a different story, not variations of one event.${avoidText}
Return ONLY a JSON array, no prose, of objects:
[{"title": "<factual headline>", "description": "<2-3 sentences: what happened, key names and numbers, why it matters>", "source": "<publication name>", "date": "<YYYY-MM-DD>"}]`;

  for (const model of await getTextModels()) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] },
      });
      const arr = extractJsonArray(res.text || "");
      if (Array.isArray(arr) && arr.length) {
        return arr
          .filter((x) => x && x.title)
          .map((x) => ({
            title: String(x.title),
            description: `${x.description || ""}${x.source ? ` (Source: ${x.source}${x.date ? `, ${x.date}` : ""})` : ""}`,
            category: pillar.label,
          }));
      }
      console.warn(`[news] ${model} returned no parsable headlines, trying next...`);
    } catch (err) {
      console.warn(`[news] ${model} search failed (${(err.message || "").slice(0, 200)}), trying next...`);
    }
  }
  return [];
}
