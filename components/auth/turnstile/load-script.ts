/**
 * Cloudflare Turnstile's script, loaded once per page and only by a form that
 * renders a widget — never in the root layout, so no dashboard page pays for it.
 *
 * `render=explicit` because React owns the container: the script must not scan
 * the DOM for `.cf-turnstile` and render into something React may replace. The
 * URL is Cloudflare's own and must not be proxied or cached by us (their docs),
 * which is also why there is no npm wrapper here — §3 asks before adding one, and
 * this is the whole of what one would do.
 */

export type TurnstileRenderOptions = {
  sitekey: string;
  action?: string;
  theme?: "auto" | "light" | "dark";
  size?: "normal" | "flexible" | "compact";
  appearance?: "always" | "execute" | "interaction-only";
  "refresh-expired"?: "auto" | "manual" | "never";
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: (errorCode: string) => void;
};

export type TurnstileApi = {
  render(container: HTMLElement, options: TurnstileRenderOptions): string | undefined;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let loading: Promise<TurnstileApi> | null = null;

export function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loading) return loading;

  loading = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;

    script.onload = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error("Turnstile's script loaded without defining window.turnstile."));
    };

    // Forgotten, so the next form to mount tries again rather than inheriting a
    // rejection from a network blip — a blocked script is the one failure a
    // reload can fix.
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error("Couldn't load Cloudflare Turnstile."));
    };

    document.head.appendChild(script);
  });

  return loading;
}
