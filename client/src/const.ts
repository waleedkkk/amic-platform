import { OAUTH_STATE_COOKIE, encodeOAuthState } from "@shared/const";

export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Start the Manus OAuth login. Call this from an event handler or effect at the
// moment you want to navigate, e.g. `onClick={() => startLogin()}`.
//
// It has SIDE EFFECTS — it mints a one-time nonce, writes the __Host- state
// cookie, and navigates immediately — so the cookie nonce always matches the
// `state` it sends. Do NOT call it during render (no `href={startLogin()}` /
// `loginUrl={...}`): each call overwrites the cookie, so a stray render-phase
// call would desync it from an in-flight login and the callback would reject it
// with "invalid oauth state". It returns void by design, so there is no URL to
// stash across renders.
//
// Guards:
// - Fails loudly (returns a message string) when VITE_OAUTH_PORTAL_URL /
//   VITE_APP_ID are missing, so a misconfigured deployment never shows a dead
//   button.
// - The state cookie is only marked Secure when the page is actually HTTPS; on
//   plain HTTP (e.g. the self-hosted IP build) the OAuth round-trip cannot
//   persist a session anyway, so we report a clear reason instead of silently
//   dropping the cookie.
export const startLogin = (): string | null => {
  const oauthPortalUrl = (import.meta.env.VITE_OAUTH_PORTAL_URL as string) ?? "";
  const appId = (import.meta.env.VITE_APP_ID as string) ?? "";

  if (!oauthPortalUrl || !appId) {
    return "تعذّر بدء تسجيل الدخول: إعدادات بوابة الدخول غير مهيّأة في هذه البيئة. إذا كنت تدير نسختك الخاصة فتأكد من ضبط VITE_APP_ID وVITE_OAUTH_PORTAL_URL.";
  }

  const isSecureContext = window.isSecureContext ?? window.location.protocol === "https:";
  if (!isSecureContext) {
    return "يتطلب تسجيل الدخول اتصالًا آمنًا (HTTPS) لحفظ جلسة الدخول. افتح المنصة عبر HTTPS أو عبر النسخة المنشورة الرسمية.";
  }

  const redirectUri = `${window.location.origin}/api/oauth/callback`;

  const nonce = crypto.randomUUID();
  document.cookie = `${OAUTH_STATE_COOKIE}=${nonce}; Path=/; Max-Age=600; ${isSecureContext ? "SameSite=None; " : "SameSite=Lax; "}Secure`;
  const state = encodeOAuthState({ redirectUri, nonce });

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  window.location.href = url.toString();
  return null;
};
