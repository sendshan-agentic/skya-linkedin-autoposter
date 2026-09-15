// Talks to LinkedIn's CURRENT versioned REST API (/rest/posts, /rest/images).
// The old app used /v2/ugcPosts with shareMediaCategory hardcoded to "NONE" —
// that endpoint is legacy, has no clean image-attachment path, and is why
// images were never possible. This client fixes both.
//
// LinkedIn access tokens last 60 days. If your app's OAuth grant included a
// refresh token (see scripts/get-linkedin-token.mjs), this client will try
// to refresh automatically and print the new token so you can update the
// GitHub secret before the old one expires.

const LINKEDIN_VERSION = "202409"; // bump periodically per LinkedIn's versioning docs
const API_BASE = "https://api.linkedin.com";

function authHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "LinkedIn-Version": LINKEDIN_VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
  };
}

export async function maybeRefreshToken({ accessToken, refreshToken, clientId, clientSecret }) {
  if (!refreshToken) return { accessToken, refreshed: false };

  try {
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });
    const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    if (!res.ok) {
      console.warn(`[linkedin] Token refresh attempt failed (${res.status}) — falling back to existing access token.`);
      return { accessToken, refreshed: false };
    }
    const data = await res.json();
    if (data.access_token && data.access_token !== accessToken) {
      console.log("[linkedin] Access token was refreshed. Update the LINKEDIN_ACCESS_TOKEN GitHub secret with:");
      console.log(data.access_token);
      if (data.refresh_token) {
        console.log("New refresh token (update LINKEDIN_REFRESH_TOKEN too):");
        console.log(data.refresh_token);
      }
      return { accessToken: data.access_token, refreshToken: data.refresh_token || refreshToken, refreshed: true };
    }
    return { accessToken, refreshed: false };
  } catch (err) {
    console.warn(`[linkedin] Token refresh errored (${err.message}) — continuing with existing token.`);
    return { accessToken, refreshed: false };
  }
}

export async function resolvePersonUrn(accessToken) {
  const res = await fetch(`${API_BASE}/v2/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Could not resolve LinkedIn member id (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  if (!data.sub) throw new Error("LinkedIn userinfo response had no member id (sub).");
  return `urn:li:person:${data.sub}`;
}

// Registers an upload slot, PUTs the image bytes, and returns the
// urn:li:image:... asset id to attach to a post. Returns null on any
// failure so the caller can fall back to a text-only post.
export async function uploadImage(accessToken, authorUrn, imageBytes) {
  try {
    const initRes = await fetch(`${API_BASE}/rest/images?action=initializeUpload`, {
      method: "POST",
      headers: { ...authHeaders(accessToken), "Content-Type": "application/json" },
      body: JSON.stringify({ initializeUploadRequest: { owner: authorUrn } }),
    });
    if (!initRes.ok) {
      console.warn(`[linkedin] Image init failed (${initRes.status}): ${await initRes.text()}`);
      return null;
    }
    const initData = await initRes.json();
    const uploadUrl = initData?.value?.uploadUrl;
    const imageUrn = initData?.value?.image;
    if (!uploadUrl || !imageUrn) {
      console.warn("[linkedin] Image init response missing uploadUrl/image urn.");
      return null;
    }

    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "image/png" },
      body: imageBytes,
    });
    if (!putRes.ok && putRes.status !== 201) {
      console.warn(`[linkedin] Image binary upload failed (${putRes.status}).`);
      return null;
    }

    return imageUrn;
  } catch (err) {
    console.warn(`[linkedin] Image upload errored (${err.message}).`);
    return null;
  }
}

export async function publishPost(accessToken, authorUrn, commentary, imageUrn) {
  const body = {
    author: authorUrn,
    commentary,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  if (imageUrn) {
    body.content = { media: { id: imageUrn } };
  }

  const res = await fetch(`${API_BASE}/rest/posts`, {
    method: "POST",
    headers: { ...authHeaders(accessToken), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LinkedIn publish failed (${res.status}): ${errText}`);
  }

  // Successful creates return the new post's URN in the x-restli-id header.
  const postUrn = res.headers.get("x-restli-id") || null;
  return { postUrn };
}
