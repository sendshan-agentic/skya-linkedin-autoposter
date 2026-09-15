// Pulls "what's trending in AI" context to ground each day's post.
// Primary source: the same public Supabase project the original AI Studio
// app used (it powers https://ai-trend-checker-twitter-content.onrender.com/).
// If that's unreachable (Render free-tier cold start, outage, schema change),
// we fall back to a small built-in list so the pipeline never produces a
// generic/empty post.

const SUPABASE_URL = "https://jbkbgbjihzyqalsrwrgf.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impia2JnYmppaHp5cWFsc3J3cmdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzMzAwMTcsImV4cCI6MjEwMzkwNjAxN30.EUK8HjAU4IJdKSyGqEakfvNxcWuvAqYgPDNcr5R1dH8";

const FALLBACK_TOPICS = [
  {
    title: "Enterprises can no longer see what AI search engines say about them",
    description:
      "As ChatGPT, Perplexity, and Google AI Overviews become a primary discovery surface, brands have no visibility into whether these engines cite them accurately, cite a competitor instead, or hallucinate wrong details.",
    category: "AI Visibility",
    viral_score: 90,
  },
  {
    title: "AI answer engines are replacing the first page of Google for buyers",
    description:
      "B2B and B2C buyers increasingly ask an AI assistant for recommendations instead of scrolling search results, shifting where brand discovery actually happens.",
    category: "Search Behavior",
    viral_score: 88,
  },
  {
    title: "LLMs frequently hallucinate outdated pricing and features for real companies",
    description:
      "Businesses are discovering, often from a lost customer, that ChatGPT or Gemini gave a prospect wrong pricing, deprecated features, or a competitor's name instead of theirs.",
    category: "AI Accuracy",
    viral_score: 85,
  },
];

async function fetchTable(table, order, limit, headers, signal) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=*&order=${order}&limit=${limit}`;
  const res = await fetch(url, { headers, signal });
  if (!res.ok) throw new Error(`${table} fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchTrendContext() {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const topics = await fetchTable(
      "trending_topics",
      "viral_score.desc",
      10,
      headers,
      controller.signal
    );
    clearTimeout(timeout);
    if (Array.isArray(topics) && topics.length > 0) {
      return { topics, source: "live" };
    }
    return { topics: FALLBACK_TOPICS, source: "fallback-empty" };
  } catch (err) {
    console.warn(`[trends] Live fetch failed (${err.message}), using fallback topics.`);
    return { topics: FALLBACK_TOPICS, source: "fallback-error" };
  }
}
