const TOKEN_PATTERNS = [
  /xox[baprs]-[A-Za-z0-9-]+/g,
  /sk-ant-[A-Za-z0-9_-]+/g,
  /sk-or-v1-[A-Za-z0-9_-]+/g,
  /AIza[A-Za-z0-9_-]+/g,
];

export function redact(value, secrets = []) {
  let result = String(value ?? '');
  for (const secret of secrets.filter(Boolean)) {
    result = result.split(secret).join('[REDACTED]');
  }
  for (const pattern of TOKEN_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}
