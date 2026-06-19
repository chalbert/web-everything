// design-refs/providers/transformers-vlm.mjs — Tier-2 in-browser small-VLM vision provider
// (backlog #1082, epic #1073 slice C).
//
// The Tier-2 analogue of the Tier-1 reference provider (anthropic-vision.mjs): where Tier 1 calls a
// hosted vision model for a closed-set VERDICT, this provider runs a small VLM **in-browser via
// Transformers.js + WebGPU** (ONNX Runtime Web) to produce the #1080 RICH-output envelope
// (`{ description, tags, regions }`) behind the same `registerVisionProvider` seam. Per #475 no-leakage:
// only the outputs cross the seam, never the model; no vendor lives in the design-refs core — this module
// is loaded on demand via DESIGN_REFS_VISION_PROVIDER_MODULE, exactly like the Tier-1 reference.
//
// Model: Florence-2 (#1081 eval recommendation — native region/detection head + smallest footprint),
// overridable with DESIGN_REFS_VLM_MODEL. Florence-2 is task-prompted: a detailed-caption task yields the
// description, an object-detection task yields localized regions; tags are derived from the detected
// labels. Device-gated: WebGPU is required (Florence-2-base is ~2 GB of weights), the download is opt-in,
// and the provider NEVER runs by default or on mobile — it throws a clear, actionable error instead.
//
// The prompt catalog and the response→envelope mapping are PURE exported functions
// (FLORENCE_TASKS / mapFlorenceResponse / boxToUnit / tagsFromDetection), so the #1080 contract mapping is
// unit-tested without the model, a browser, or WebGPU; the registered provider is the thin wrapper that
// lazily loads `@huggingface/transformers` and wires them together.

import { registerVisionProvider, normalizeRichOutput } from '../vision.mjs';

/** Default Florence-2 ONNX build (Transformers.js-compatible). The operator's call, overridable via env. */
export const DEFAULT_MODEL = 'onnx-community/Florence-2-base-ft';

/**
 * The Florence-2 task prompts this provider runs, mapped to the rich-output facet each fills:
 *   - `<MORE_DETAILED_CAPTION>` → `description` (free-text surface description).
 *   - `<OD>` (object detection) → `regions` (label + pixel bbox) and, derived, `tags`.
 * Both are run per frame; the results are merged by {@link mapFlorenceResponse}.
 */
export const FLORENCE_TASKS = Object.freeze({
  caption: '<MORE_DETAILED_CAPTION>',
  detection: '<OD>',
});

/**
 * Convert one Florence-2 object-detection bbox — pixel `[x1, y1, x2, y2]` — into the #1080 contract's
 * normalized `{ x, y, w, h }` in 0..1, given the source image `{ width, height }`. Returns null for a
 * malformed bbox or non-positive dims (the region normalizer then drops the box, keeping the label).
 */
export function boxToUnit(bbox, dims) {
  if (!Array.isArray(bbox) || bbox.length !== 4) return null;
  const W = Number(dims?.width);
  const H = Number(dims?.height);
  if (!(W > 0) || !(H > 0)) return null;
  const [x1, y1, x2, y2] = bbox.map(Number);
  if (![x1, y1, x2, y2].every(Number.isFinite)) return null;
  return { x: x1 / W, y: y1 / H, w: (x2 - x1) / W, h: (y2 - y1) / H };
}

/** Derive deduped lower-cased loose `tags` from the detected region labels (the OD label set). */
export function tagsFromDetection(labels = []) {
  return [...new Set((Array.isArray(labels) ? labels : []).map((l) => String(l).trim().toLowerCase()).filter(Boolean))];
}

/**
 * Map Florence-2's raw task outputs into the #1080 rich envelope, then normalize. `raw` carries the two
 * task results keyed by their task token; `dims` is the source image size for pixel→unit box conversion.
 * Tolerant of a missing task (a caption-only or detection-only run still yields a valid envelope).
 *
 * @param {{ [task: string]: any }} raw  Florence-2 results, e.g. `{ '<MORE_DETAILED_CAPTION>': '…',
 *   '<OD>': { bboxes: [[x1,y1,x2,y2]], labels: ['button'] } }`.
 * @param {{ width: number, height: number }} dims  Source image dimensions (pixels).
 */
export function mapFlorenceResponse(raw = {}, dims) {
  const description = raw[FLORENCE_TASKS.caption];
  const od = raw[FLORENCE_TASKS.detection] ?? {};
  const bboxes = Array.isArray(od.bboxes) ? od.bboxes : [];
  const labels = Array.isArray(od.labels) ? od.labels : [];
  const regions = labels.map((label, i) => ({ label, box: boxToUnit(bboxes[i], dims) }));
  return normalizeRichOutput({
    description: typeof description === 'string' ? description : null,
    tags: tagsFromDetection(labels),
    regions,
  });
}

/**
 * Whether WebGPU is available in this environment — the hard device gate. Accepts an injected `nav`
 * (defaults to the ambient `navigator`) so it is testable in Node. Florence-2 is too heavy for the WASM
 * fallback, so a missing `navigator.gpu` means the provider must not run.
 */
export function isWebGPUAvailable(nav = typeof navigator !== 'undefined' ? navigator : undefined) {
  return !!nav && typeof nav.gpu === 'object' && nav.gpu !== null;
}

/** Throw an actionable error if this device can't run the Tier-2 VLM (the opt-in/never-mobile gate). */
export function assertDeviceCapable(nav) {
  if (!isWebGPUAvailable(nav)) {
    throw new Error(
      'transformers-vlm (Tier-2) requires WebGPU — navigator.gpu is unavailable. This provider runs a '
      + '~2 GB in-browser VLM (Florence-2) and is opt-in on a WebGPU-capable desktop; it never runs by '
      + 'default or on mobile. Use the Tier-1 hosted provider where WebGPU is absent.',
    );
  }
}

// Lazy model handle — built once on first analyze, on a WebGPU device. The heavy import + ~2 GB download
// happens here, never at module load, so importing this file (e.g. to unit-test the pure mappers) is cheap.
let modelPromise = null;
async function getModel(modelId) {
  if (!modelPromise) {
    assertDeviceCapable();
    // Computed specifier: keep the optional dep a true runtime import so a bundler won't try to resolve
    // `@huggingface/transformers` at build time (it isn't installed by default).
    const pkg = '@huggingface/transformers';
    modelPromise = import(pkg)
      .then(async (t) => {
        const id = modelId || process.env.DESIGN_REFS_VLM_MODEL || DEFAULT_MODEL;
        const [model, processor, tokenizer] = await Promise.all([
          t.Florence2ForConditionalGeneration.from_pretrained(id, { dtype: 'fp32', device: 'webgpu' }),
          t.AutoProcessor.from_pretrained(id),
          t.AutoTokenizer.from_pretrained(id),
        ]);
        return { t, model, processor, tokenizer };
      })
      .catch((e) => {
        modelPromise = null; // let a later call retry once the dep/device is available
        throw new Error(
          `transformers-vlm: failed to load Florence-2 via @huggingface/transformers (${e?.message ?? e}). `
          + 'Install it (`npm i @huggingface/transformers`) and run on a WebGPU-capable browser.',
        );
      });
  }
  return modelPromise;
}

/** Run one Florence-2 task on an image and return its post-processed result. */
async function runTask({ t, model, processor, tokenizer }, image, task) {
  const inputs = await processor(image, task);
  const ids = await model.generate({ ...inputs, max_new_tokens: 256, num_beams: 1 });
  const text = tokenizer.batch_decode(ids, { skip_special_tokens: false })[0];
  return processor.post_process_generation(text, task, image.size);
}

registerVisionProvider('transformers-vlm', {
  async analyzeRich(input) {
    assertDeviceCapable();
    const handle = await getModel();
    // input carries a PNG (base64) + dims; Transformers.js RawImage reads a data URL in the browser.
    const { RawImage } = handle.t;
    const image = await RawImage.fromURL(`data:image/png;base64,${input.pngBase64}`);
    const dims = { width: image.width, height: image.height };
    const [caption, detection] = await Promise.all([
      runTask(handle, image, FLORENCE_TASKS.caption),
      runTask(handle, image, FLORENCE_TASKS.detection),
    ]);
    return mapFlorenceResponse(
      { [FLORENCE_TASKS.caption]: caption?.[FLORENCE_TASKS.caption], [FLORENCE_TASKS.detection]: detection?.[FLORENCE_TASKS.detection] },
      dims,
    );
  },
});
