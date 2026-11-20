// Content pillars. Posts rotate through these so the feed isn't the same
// "AI visibility" pitch every time. The pillar used least recently goes next.

export const PILLARS = [
  {
    id: "news",
    label: "AI news breakdown",
    searchBrief:
      "the most significant AI industry news of the past 7 days: model launches, major funding or acquisitions, big product shifts, earnings, leadership changes at AI companies",
    instructions: `Break down ONE specific, recent AI news story. State what actually happened (who, what, when, concrete numbers). Then give a sharp take on what it really means for businesses and marketers. Tie in Skya.one only in the last 2-3 lines, as one natural consequence ("this also changes what AI tells your buyers about you"), not as the point of the post.`,
    softCta: false,
  },
  {
    id: "geopolitics",
    label: "AI geopolitics",
    searchBrief:
      "AI geopolitics news from the past 7 days: US-China chip export controls, semiconductor supply chains, sovereign AI programs (including India's), AI regulation such as the EU AI Act, national AI strategies, data-centre and energy politics, government deals with AI labs",
    instructions: `Write an analytical post on ONE recent AI geopolitics story. Explain the stakes clearly and fairly: who gains, who loses, and the second-order effects on businesses, especially Indian and global brands that rely on US-built AI models. Be balanced. Present the strongest view on each side; don't take partisan political positions. Skya.one gets at most one line near the end, framed as "whoever controls the models shapes what buyers hear about your brand". Keep the CTA soft.`,
    softCta: true,
  },
  {
    id: "controversy",
    label: "AI controversy / debate",
    searchBrief:
      "controversial or hotly debated AI issues in the past 7 days: copyright and training-data lawsuits, deepfakes and misinformation, AI and job losses, AI safety disputes, bias, privacy breaches, AI energy and water use, lawsuits against AI companies, AI hallucination incidents with real consequences",
    instructions: `Take on ONE recent AI controversy and give the debate a real hearing. State the facts, steelman both sides in a sentence or two each, then give a clear, defensible point of view and end with a question that invites disagreement in the comments. Be provocative in framing but accurate in facts, with no fabricated quotes or numbers. Mention Skya.one only if there's a genuine link (e.g. hallucinations, misinformation, trust in AI answers); otherwise a single soft line at the end.`,
    softCta: true,
  },
  {
    id: "visibility",
    label: "AI visibility for brands",
    searchBrief: null, // uses the live trend feed + evergreen angles
    instructions: `Follow this 4-beat structure:
1. World Changed: open with the trend as a hook; buyers now ask ChatGPT/Perplexity/Gemini instead of Googling.
2. Problem Created: brands have zero visibility into what AI says about them (wrong pricing, outdated features, a competitor recommended instead).
3. Solution: introduce Skya.one naturally, leading with a concrete-sounding finding, not a feature list.
4. Close: a sharp question.`,
    softCta: false,
  },
];

export function pickPillar(history) {
  const forced = process.env.FORCE_PILLAR;
  if (forced) {
    const p = PILLARS.find((x) => x.id === forced);
    if (p) return p;
  }
  // Least-recently-used pillar wins; never-used pillars go first in list order.
  let best = PILLARS[0];
  let bestIdx = Infinity;
  for (const p of PILLARS) {
    const lastIdx = history.map((e) => e.pillar).lastIndexOf(p.id);
    if (lastIdx === -1) return p;
    if (lastIdx < bestIdx) {
      bestIdx = lastIdx;
      best = p;
    }
  }
  return best;
}
