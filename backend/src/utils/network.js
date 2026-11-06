import net from "node:net";

const MIN_PREFIX = { 4: 16, 6: 48 };
const BITS = { 4: 32, 6: 128 };

const parseV4 = (input) => {
  const parts = input.split(".");
  if (parts.length !== 4) return null;

  let value = 0n;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part) || Number(part) > 255) return null;
    value = (value << 8n) | BigInt(part);
  }

  return value;
};

const parseV6 = (input) => {
  let text = input.split("%")[0];
  if (!net.isIPv6(text)) return null;

  const tail = text.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (tail) {
    const v4 = parseV4(tail[1]);
    if (v4 === null) return null;
    text =
      text.slice(0, -tail[1].length) +
      (v4 >> 16n).toString(16) +
      ":" +
      (v4 & 0xffffn).toString(16);
  }

  let groups;
  if (text.includes("::")) {
    const [head, rest] = text.split("::");
    const left = head ? head.split(":") : [];
    const right = rest ? rest.split(":") : [];
    groups = [...left, ...Array(8 - left.length - right.length).fill("0"), ...right];
  } else {
    groups = text.split(":");
  }

  if (groups.length !== 8) return null;

  return groups.reduce((value, group) => (value << 16n) | BigInt(`0x${group}`), 0n);
};

export const parseIp = (input, { unmap = true } = {}) => {
  if (typeof input !== "string") return null;

  const text = input.trim();

  if (net.isIPv4(text)) {
    const value = parseV4(text);
    return value === null ? null : { family: 4, value };
  }

  const value = parseV6(text);
  if (value === null) return null;

  if (unmap && value >> 32n === 0xffffn) {
    return { family: 4, value: value & 0xffffffffn };
  }

  return { family: 6, value };
};

const formatV4 = (value) =>
  [24n, 16n, 8n, 0n].map((shift) => Number((value >> shift) & 255n)).join(".");

const formatV6 = (value) => {
  const groups = Array.from({ length: 8 }, (_, i) =>
    Number((value >> BigInt((7 - i) * 16)) & 0xffffn),
  );

  let bestStart = -1;
  let bestLength = 0;
  for (let i = 0; i < 8; ) {
    if (groups[i] !== 0) {
      i++;
      continue;
    }
    let j = i;
    while (j < 8 && groups[j] === 0) j++;
    if (j - i > bestLength) {
      bestStart = i;
      bestLength = j - i;
    }
    i = j;
  }

  const hex = groups.map((group) => group.toString(16));
  if (bestLength < 2) return hex.join(":");

  return `${hex.slice(0, bestStart).join(":")}::${hex.slice(bestStart + bestLength).join(":")}`;
};

const maskFor = (bits, prefix) =>
  ((1n << BigInt(bits)) - 1n) ^ ((1n << BigInt(bits - prefix)) - 1n);

export const parseCidr = (input) => {
  if (typeof input !== "string") return null;

  const text = input.trim();
  const slash = text.indexOf("/");
  const hasPrefix = slash >= 0;
  const address = hasPrefix ? text.slice(0, slash) : text;

  const ip = parseIp(address, { unmap: !hasPrefix });
  if (!ip) return null;

  const bits = BITS[ip.family];
  let prefix = bits;

  if (hasPrefix) {
    const raw = text.slice(slash + 1);
    if (!/^\d{1,3}$/.test(raw) || Number(raw) > bits) return null;
    prefix = Number(raw);
  }

  const network = ip.value & maskFor(bits, prefix);
  const formatted = ip.family === 4 ? formatV4(network) : formatV6(network);

  return {
    cidr: `${formatted}/${prefix}`,
    family: ip.family,
    network,
    prefix,
    tooBroad: prefix < MIN_PREFIX[ip.family],
  };
};

export const matchesAnyCidr = (ipText, cidrs) => {
  const ip = parseIp(ipText);
  if (!ip) return false;

  const bits = BITS[ip.family];

  return cidrs.some((text) => {
    const parsed = parseCidr(text);
    if (!parsed || parsed.family !== ip.family) return false;

    const shift = BigInt(bits - parsed.prefix);
    return ip.value >> shift === parsed.network >> shift;
  });
};

export const describeIp = (ipText) => {
  const ip = parseIp(ipText);
  if (!ip) return null;

  const normalized = ip.family === 4 ? formatV4(ip.value) : formatV6(ip.value);
  const suggested = parseCidr(ip.family === 4 ? `${normalized}/32` : `${normalized}/64`);

  return { ip: normalized, family: ip.family, suggested_cidr: suggested.cidr };
};
