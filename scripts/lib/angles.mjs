// A rotating pool of distinct SKYA marketing angles, independent of any
// external "trending" feed. The live trend source (trends.mjs) sometimes
// returns the same top story for days at a time — it isn't a guaranteed
// continuously-updating feed — so relying on it alone for variety was the
// root cause of near-identical posts. Mixing these in guarantees genuine
// day-to-day variety even if the live feed is stale.
export const EVERGREEN_ANGLES = [
  {
    title: "AI engines hallucinate pricing and features for real companies",
    description: "ChatGPT and Gemini often cite outdated pricing pages, deprecated features, or specs that no longer exist — and the business has no idea until a lost customer mentions it.",
    category: "AI Accuracy",
  },
  {
    title: "AI assistants recommend a competitor instead of the brand being asked about",
    description: "When a buyer asks an AI which vendor to pick, the model sometimes names a rival brand instead — competitor displacement that's invisible to traditional analytics.",
    category: "Competitive Displacement",
  },
  {
    title: "Missing schema markup makes brands invisible to AI crawlers",
    description: "AI engines lean heavily on structured data to understand a page. Sites without proper schema often get skipped entirely in AI-generated answers, even when they rank well on Google.",
    category: "Technical SEO/AEO",
  },
  {
    title: "Zero-click search is quietly replacing the funnel top",
    description: "A growing share of buyer research now happens entirely inside an AI chat window — no click to the brand's site at all, which breaks traditional web-analytics-based marketing attribution.",
    category: "Search Behavior",
  },
  {
    title: "Perplexity and other answer engines cite outdated review-site data",
    description: "AI answer engines often pull from older cached review pages, meaning a brand's current reputation and offering can be represented by stale, sometimes inaccurate, secondhand data.",
    category: "AI Accuracy",
  },
  {
    title: "AI shopping agents are starting to complete purchases without a storefront visit",
    description: "As agentic AI shopping features roll out, a bot may compare, choose, and even purchase on a buyer's behalf — meaning the brand's true 'storefront' is now inside someone else's AI, not their own website.",
    category: "Agentic Commerce",
  },
  {
    title: "Voice assistants give one answer, not ten blue links",
    description: "When someone asks Alexa or Google Assistant which business to choose, only one gets said out loud — there's no 'page two' in voice search, raising the stakes of AI visibility to a binary outcome.",
    category: "Voice Search",
  },
  {
    title: "Traditional rank trackers can't see what AI models are actually saying",
    description: "SEO tools built for the ten-blue-links era show nothing about how a brand is described, summarized, or omitted inside an AI-generated answer.",
    category: "Tooling Gap",
  },
  {
    title: "AI models blend a brand's real facts with a competitor's in the same answer",
    description: "Retrieval-based AI answers sometimes merge details from multiple sources, attributing a competitor's feature or price to the wrong company entirely.",
    category: "AI Accuracy",
  },
  {
    title: "Enterprise buyers now vet vendors through an AI chat before a sales call",
    description: "By the time a prospect books a demo, they've often already 'interviewed' the brand through ChatGPT — meaning first impressions are increasingly made by an AI's summary, not the sales team.",
    category: "B2B Buying Behavior",
  },
  {
    title: "Google's AI Overviews reshuffle who gets seen for high-intent queries",
    description: "AI Overviews synthesize a single answer above all search results, and getting cited (or not) there can matter more than a page-one ranking used to.",
    category: "Search Behavior",
  },
  {
    title: "A single outdated press release can misinform an AI model for months",
    description: "AI training and retrieval windows mean an old press release announcing a since-changed price or feature can keep resurfacing in AI answers long after it's obsolete.",
    category: "AI Accuracy",
  },
  {
    title: "AI models struggle to tell a franchise location apart from the parent brand",
    description: "Multi-location and franchise businesses often get blended into one generic answer by AI engines, losing the specific details that actually matter to a local searcher.",
    category: "Local/Multi-location",
  },
  {
    title: "Brand sentiment inside an AI answer is invisible without direct testing",
    description: "An AI model might describe a brand in a subtly negative or lukewarm way — there's no dashboard that flags this the way review-monitoring tools do for star ratings.",
    category: "Brand Sentiment",
  },
  {
    title: "Marketing teams are flying blind on which AI models even know their brand exists",
    description: "ChatGPT, Gemini, Claude, and Perplexity don't share the same training data or retrieval sources — a brand can be well-represented in one and completely absent in another.",
    category: "AI Visibility",
  },
];
