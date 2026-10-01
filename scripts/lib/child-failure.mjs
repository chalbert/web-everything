/** Preserve the child's diagnosis across planner → tick → daemon error boundaries. */
export function childFailure(error, { singleLine = false } = {}) {
  const message = String(error?.message || error);
  const stderr = String(error?.stderr || '').trim();
  const details = [error?.code, error?.signal && `signal=${error.signal}`, error?.status != null && `status=${error.status}`].filter(Boolean).join(', ');
  const diagnostic = `${message}${details ? ` [${details}]` : ''}${stderr && !message.includes(stderr) ? `\n${stderr}` : ''}`;
  return singleLine ? diagnostic.replace(/\r?\n/g, ' | ') : diagnostic;
}
