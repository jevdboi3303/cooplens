// Service worker — handles OAuth (stays alive when popup closes)

const SUPABASE_URL = "https://qaufwdmqjhospyyecifm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhdWZ3ZG1xamhvc3B5eWVjaWZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1OTk3NTUsImV4cCI6MjA5NjE3NTc1NX0.yyLtq_iqdtPxHeZh87DNRZToTqdEcUepCuUYn9uhGrg";

// ── PKCE helpers ─────────────────────────────────────────────────────────────

function generateVerifier(length = 64) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => chars[b % chars.length]).join("");
}

async function generateChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// ── Google OAuth flow (runs in service worker, survives popup close) ─────────

async function startGoogleSignIn() {
  const redirectURL = chrome.identity.getRedirectURL("google");
  const verifier = generateVerifier();
  const challenge = await generateChallenge(verifier);

  const oauthURL =
    `${SUPABASE_URL}/auth/v1/authorize?provider=google` +
    `&redirect_to=${encodeURIComponent(redirectURL)}` +
    `&code_challenge=${encodeURIComponent(challenge)}` +
    `&code_challenge_method=S256`;

  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: oauthURL, interactive: true },
      async (redirectUrl) => {
        if (chrome.runtime.lastError || !redirectUrl) {
          reject(new Error(chrome.runtime.lastError?.message || "Auth cancelled"));
          return;
        }

        const url = new URL(redirectUrl);
        const code = url.searchParams.get("code");
        if (!code) { reject(new Error("No authorization code")); return; }

        try {
          const resp = await fetch(
            `${SUPABASE_URL}/auth/v1/token?grant_type=pkce`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "apikey": SUPABASE_ANON_KEY,
              },
              body: new URLSearchParams({
                auth_code: code,
                code_verifier: verifier,
              }).toString(),
            }
          );
          const data = await resp.json();
          if (!resp.ok) throw new Error(data.error_description || data.msg || "Token exchange failed");

          // Store token so popup can pick it up on next open
          await chrome.storage.local.set({ cl_token: data.access_token });
          resolve({ access_token: data.access_token });
        } catch (e) {
          reject(e);
        }
      }
    );
  });
}

// ── Message handler ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "GET_TOKEN") {
    chrome.storage.local.get("cl_token", (r) => sendResponse({ token: r.cl_token || null }));
    return true;
  }

  if (msg.type === "GET_RESUME_EMBEDDING") {
    chrome.storage.local.get("cl_resume", (r) => sendResponse({ resume: r.cl_resume || null }));
    return true;
  }

  if (msg.type === "GOOGLE_SIGN_IN") {
    startGoogleSignIn()
      .then(({ access_token }) => sendResponse({ ok: true, access_token }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true; // keep channel open for async response
  }
});

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") chrome.action.openPopup?.();
});
