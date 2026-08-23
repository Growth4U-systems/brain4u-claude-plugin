const MONEY_PATTERN = /^(0|[1-9][0-9]*)(?:\.([0-9]{1,16}))?$/;
const SCALE = 10_000_000_000_000_000n;

export function parseMoney(value, field = 'money') {
  if (typeof value !== 'string') throw new Error(`${field} must be a decimal string`);
  const match = MONEY_PATTERN.exec(value);
  if (!match) throw new Error(`${field} must be a non-negative decimal with at most 16 decimal places`);
  const fraction = (match[2] ?? '').padEnd(16, '0');
  return BigInt(match[1]) * SCALE + BigInt(fraction || '0');
}

export function assertWithinLimit(actual, limit, field = 'monthly price') {
  if (parseMoney(actual, field) > parseMoney(limit, 'infrastructure.maxMonthlyGross')) {
    throw new Error(`${field} ${actual} exceeds configured monthly limit ${limit}`);
  }
}

export function normalizeMoney(value) {
  const units = parseMoney(value);
  return formatUnits(units);
}

function formatUnits(units) {
  const whole = units / SCALE;
  const fraction = String(units % SCALE).padStart(16, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : String(whole);
}

export function addMoney(...values) {
  return formatUnits(values.reduce((total, value) => total + parseMoney(value), 0n));
}
