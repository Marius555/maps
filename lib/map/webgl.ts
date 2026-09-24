/**
 * Can this browser draw a MapLibre map at all?
 *
 * MapLibre v6 needs WebGL2, and when the browser will not create a context it
 * does not throw. `_setupPainter` *fires* an `error` event from inside the
 * constructor, before anyone can have subscribed, so `Evented.fire` falls back
 * to `console.error` — the "GPUInitializationError" in Next's dev overlay — and
 * the constructor then returns early with no painter, no handlers and no style.
 * The object it hands back looks like a map and is not one: `resize()` and
 * `remove()` both dereference the missing painter and throw, and `load` never
 * fires, so the frame stays grey with nothing on screen to say why.
 *
 * So the question is asked before a map is built, on a canvas nobody sees. On
 * Windows the usual answer "no" means hardware acceleration is off or the GPU
 * process crashed and Chrome turned it off for the session — and since Chrome
 * 137 there is no software fallback for WebGL. `chrome://gpu` says which.
 *
 * Asked once per page load. It is a fact about the browser, and changing it
 * takes a browser restart anyway. A "yes" is not a guarantee — the real context
 * can still fail at Chrome's per-page limit — which is why `useMaplibre` checks
 * the painter after construction as well.
 */

let answer: boolean | undefined;

export function canRenderMaps(): boolean {
  if (answer !== undefined) return answer;

  const canvas = document.createElement("canvas");
  let reason = "";

  // Dispatched synchronously from inside `getContext`, which is what MapLibre
  // itself relies on to report the same thing.
  canvas.addEventListener(
    "webglcontextcreationerror",
    (event) => {
      reason = (event as WebGLContextEvent).statusMessage;
    },
    { once: true },
  );

  const gl = canvas.getContext("webgl2");
  answer = gl !== null;

  if (gl) {
    // Released at once, so the probe does not hold one of the ~16 contexts
    // Chrome allows a page until the garbage collector gets round to it.
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  } else {
    // A warning rather than an error: the page explains itself on screen, and
    // this is here for whoever is asked why.
    console.warn("[maplibre] WebGL2 unavailable", reason);
  }

  return answer;
}
