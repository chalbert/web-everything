/** Non-error throttle result shared by pass readers without importing the gh runner. */
export function isGhDeferred(value) {
  if (typeof value === 'string' || Buffer.isBuffer(value)) {
    try { value = JSON.parse(String(value)); } catch { return false; }
  }
  return value?.outcome === 'deferred-low-budget';
}

