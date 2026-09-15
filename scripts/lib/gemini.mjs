import { GoogleGenAI, Type } from "@google/genai";

// gemini-3.1-pro-preview is paid-tier only (0 quota on the free tier), so it
// isn't a useful fallback for a free API key — kept last in case billing is
// ever enabled, but gemini-3.6-flash is retried first since transient
// "high demand" (503) errors there are usually short-lived.
const TEXT_MODELS = ["gemini-3.6-flash", "gemini-3.1-pro-preview"];
const IMAGE_MODEL = "imagen-4.0-generate-001";
const MAX_ATTEMPTS_PER_MODEL = 3;
const RETRY_DELAYS_MS = [8000, 16000];

// LinkedIn hard-caps a post's "commentary" at 3000 characters. We stay well
// under that so hashtags never push the text over the limit and get
// silently truncated by the API.
const MAX_POST_CHARS = 2600;

function buildPrompt(topics) {
  const context = topics
    .slice(0, 5)
    .map((t, i) => `${i + 1}. [${t.category || "AI"}] ${t.title}: ${t.description}`)
    .join("\n");

  return `You are an elite LinkedIn ghostwriter for Skya.one (also called SKYA), the first AI Visibility Intelligence platform. It reveals what ChatGPT, Gemini, Perplexity, Claude, and Google AI Overviews say about a brand in real time, running specialized agents that flag hallucinations, competitor displacement, and missing schema, and produce client-ready reports.

TODAY'S TRENDING AI CONTEXT (use ONE of these as the hook, pick the most relevant to marketing/brand visibility):
${context}

Write ONE LinkedIn post following this 4-beat structure:
1. World Changed: open with the trend as a hook, then note that buyers now ask ChatGPT/Perplexity/Gemini instead of Googling.
2. Problem Created: brands/agencies have zero visibility into what AI says about them right now — wrong pricing, outdated features, or a competitor being recommended instead.
3. Solution: introduce Skya.one naturally, lead with a concrete-sounding finding, not a feature list.
4. Close: a sharp question, then this exact CTA: "Audit what major AI models say about your brand in real time at Skya.one (7-day free trial, no card required)."

Rules:
- Never say "AEO tool", "visibility tracker", or "made in India".
- Short, confident sentences. Real specifics beat abstractions.
- Total length of "content" (including hashtags) MUST be under ${MAX_POST_CHARS} characters.
- 5-6 relevant hashtags, always including #Skya and #AIVisibilityIntelligence.
- Also write "imagePrompt": a description for a clean, professional, abstract tech/business illustration (NOT a screenshot, NOT text-in-image, NOT any real person or logo) that visually fits the post's theme — e.g. glowing network nodes, a brand signal being picked up on a radar, etc. Square composition, dark modern SaaS aesthetic, no readable text.

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
      const canRetry = isRetryableError(message) && attempt < MAX_ATTEMPTS_PER_MODEL;
      if (!canRetry) throw lastErr;
      const waitMs = RETRY_DELAYS_MS[attempt - 1] || 16000;
      console.warn(`[gemini] ${model} attempt ${attempt} failed (${message.slice(0, 140)}), retrying in ${waitMs / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  throw lastErr;
}

export async function generatePostText(topics) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt = buildPrompt(topics);

  const schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      content: { type: Type.STRING },
      hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
      imagePrompt: { type: Type.STRING },
    },
    required: ["title", "content", "hashtags", "imagePrompt"],
  };

  let lastErr;
  for (const model of TEXT_MODELS) {
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
        modelUsed: model,
      };
    } catch (err) {
      lastErr = err;
      console.warn(`[gemini] Model ${model} failed after retries (${err.message.slice(0, 140)}), trying next...`);
    }
  }
  throw new Error(`All text models failed to generate a post: ${lastErr?.message}`);
}

// Returns { bytes: Buffer, mimeType: string } or null if generation fails —
// callers should treat a null image as "publish text-only today", not a
// fatal error.
export async function generatePostImage(imagePrompt) {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateImages({
      model: IMAGE_MODEL,
      prompt: imagePrompt,
      config: { numberOfImages: 1, aspectRatio: "1:1" },
    });
    const img = response?.generatedImages?.[0]?.image;
    if (!img?.imageBytes) return null;
    return { bytes: Buffer.from(img.imageBytes, "base64"), mimeType: "image/png" };
  } catch (err) {
    console.warn(`[gemini] Image generation failed (${err.message}). Publishing without an image.`);
    return null;
  }
}
