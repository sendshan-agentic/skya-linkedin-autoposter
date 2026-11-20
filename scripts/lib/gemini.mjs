import { GoogleGenAI, Type } from "@google/genai";

// gemini-flash-latest is an alias Google keeps pointed at their current
// recommended flash model, so it won't go stale the way a pinned version
// eventually will. The other two are named fallbacks for when "latest" is
// itself under high demand. gemini-3.1-pro-preview was deliberately left
// out — it's paid-tier only (0 quota on the free tier), so retrying it is
// pure wasted time on a free API key.
import { getTextModels } from "./models.mjs";

// Gemini's image generation happens through the regular generateContent
// call (the model returns an inline image part), not the older
// generateImages/Imagen "predict" API. Confirmed by listing this account's
// actual models — see scripts/list-image-models.mjs. Only used when
// ENABLE_IMAGES=true (off by default — needs billing enabled).
const IMAGE_MODELS = ["gemini-2.5-flash-image", "gemini-3.1-flash-image"];

const MAX_ATTEMPTS_PER_MODEL = 3;
const RETRY_DELAYS_MS = [8000, 16000];
const TOTAL_PASSES = 2;
const BETWEEN_PASS_DELAY_MS = 30000;

// LinkedIn hard-caps a post's "commentary" at 3000 characters. We stay well
// under that so hashtags never push the text over the limit and get
// silently truncated by the API.
const MAX_POST_CHARS = 2600;

const HARD_CTA =
  'Audit what major AI models say about your brand in real time at Skya.one (7-day free trial, no card required).';
const SOFT_CTA = "A short, low-key line pointing to Skya.one (e.g. \"We track this at Skya.one.\"), no hard sell.";

function buildPrompt(topics, history = [], pillar) {
  const context = topics
    .slice(0, 6)
    .map((t, i) => `${i + 1}. [${t.category || "AI"}] ${t.title}: ${t.description}`)
    .join("\n");

  const recent = history.slice(-15);
  const avoidance = recent.length
    ? `\n\nALREADY POSTED (do NOT reuse these stories, products, model names, hooks or opening lines, even reworded):\n${recent
        .map((h) => `- ${h.hook || h.title}${h.opening ? ` | opened with: "${h.opening.slice(0, 140)}"` : ""}`)
        .join("\n")}\n`
    : "";

  const ctaRule = pillar?.softCta
    ? `End with ${SOFT_CTA}`
    : `End with a sharp question, then this exact CTA: "${HARD_CTA}"`;

  return `You are an elite LinkedIn ghostwriter for Santanu Raychaudhuri, founder of Skya.one (SKYA), the first AI Visibility Intelligence platform. It reveals what ChatGPT, Gemini, Perplexity, Claude, and Google AI Overviews say about a brand in real time, flagging hallucinations, competitor displacement, and missing schema.

Today's post type: ${pillar ? pillar.label.toUpperCase() : "AI VISIBILITY"}

CANDIDATE STORIES (pick exactly ONE as the core of the post):
${context}${avoidance}

How to write it:
${pillar ? pillar.instructions : ""}

Rules:
- Open with a fresh first line that does NOT start with "X just released/launched". Vary the hook style: a stat, a contrarian claim, a question, a short scene, or a prediction.
- Use only facts given in the candidate story. Never invent numbers, quotes or events.
- Never say "AEO tool", "visibility tracker", or "made in India".
- Short, confident sentences, one idea per line. Real specifics beat abstractions.
- ${ctaRule}
- Total length of "content" MUST be under ${MAX_POST_CHARS} characters.
- 5-6 relevant hashtags, always including #Skya; add #AIVisibilityIntelligence only on AI-visibility posts.
- "sourceTopic": copy the exact title of the candidate story you chose.
- "imagePrompt": a clean, abstract tech/business illustration fitting the theme (no text, no real people or logos), square, dark modern SaaS aesthetic.

Return strictly valid JSON matching the schema.`;
}

function isRetryableError(message) {
  return (
    message.includes('"code":429') ||
    message.includes('"code":503') ||
    message.includes("UNAVAILABLE") ||
    message.includes("RESOURCE_EXHAUSTED")
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateWithRetries(ai, model, prompt, schema) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_MODEL; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: schema },
      });
      if (!response.text) throw new Error("Empty response from model");
      return response.text;
    } catch (err) {
      lastErr = err;
      const message = err.message || "";
      // A daily-quota 429 won't clear in 16 seconds — skip straight to the next model.
      const dailyQuota = /PerDay|per day|daily/i.test(message);
      const canRetry = isRetryableError(message) && !dailyQuota && attempt < MAX_ATTEMPTS_PER_MODEL;
      if (!canRetry) throw lastErr;
      const waitMs = RETRY_DELAYS_MS[attempt - 1] || 16000;
      console.warn(`[gemini] ${model} attempt ${attempt} failed (${message.slice(0, 140)}), retrying in ${waitMs / 1000}s...`);
      await sleep(waitMs);
    }
  }
  throw lastErr;
}

export async function generatePostText(topics, history = [], pillar = null) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt = buildPrompt(topics, history, pillar);

  const schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      content: { type: Type.STRING },
      hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
      imagePrompt: { type: Type.STRING },
      sourceTopic: { type: Type.STRING },
    },
    required: ["title", "content", "hashtags", "imagePrompt", "sourceTopic"],
  };

  let lastErr;
  for (let pass = 1; pass <= TOTAL_PASSES; pass++) {
    for (const model of await getTextModels()) {
      try {
        const text = await generateWithRetries(ai, model, prompt, schema);
        const parsed = JSON.parse(text);
        let content = String(parsed.content || "").trim();
        if (content.length > MAX_POST_CHARS) {
          content = content.slice(0, MAX_POST_CHARS - 1).trim() + "…";
          console.warn(`[gemini] Post exceeded ${MAX_POST_CHARS} chars, trimmed.`);
        }
        return {
          title: parsed.title || "SKYA daily post",
          content,
          hashtags:
            Array.isArray(parsed.hashtags) && parsed.hashtags.length > 0
              ? parsed.hashtags
              : ["#Skya", "#AIVisibilityIntelligence", "#B2BMarketing", "#MarketingStrategy"],
          imagePrompt: parsed.imagePrompt || "Abstract glowing network signal, dark modern SaaS aesthetic, no text",
          sourceTopic: parsed.sourceTopic || "",
          modelUsed: model,
        };
      } catch (err) {
        lastErr = err;
        console.warn(`[gemini] Model ${model} failed (${(err.message || "").slice(0, 300)}), trying next...`);
      }
    }
    if (pass < TOTAL_PASSES) {
      console.warn(`[gemini] All models failed on pass ${pass}, waiting ${BETWEEN_PASS_DELAY_MS / 1000}s before a second full pass...`);
      await sleep(BETWEEN_PASS_DELAY_MS);
    }
  }
  throw new Error(`All text models failed across ${TOTAL_PASSES} passes: ${lastErr?.message}`);
}

// Returns { bytes: Buffer, mimeType: string } or null if generation fails —
// callers should treat a null image as "publish text-only today", not a
// fatal error. Tries each image-capable model in turn.
export async function generatePostImage(imagePrompt) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  for (const model of IMAGE_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: imagePrompt,
      });
      const parts = response?.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find((p) => p.inlineData?.data);
      if (imagePart) {
        return {
          bytes: Buffer.from(imagePart.inlineData.data, "base64"),
          mimeType: imagePart.inlineData.mimeType || "image/png",
        };
      }
      console.warn(`[gemini] ${model} returned no image data, trying next...`);
    } catch (err) {
      console.warn(`[gemini] Image model ${model} failed (${err.message.slice(0, 140)}), trying next...`);
    }
  }
  console.warn("[gemini] All image models failed. Publishing without an image.");
  return null;
}
