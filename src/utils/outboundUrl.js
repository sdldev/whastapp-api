const dns = require('dns').promises;
const net = require('net');
const env = require('../config/env');
const { AppError } = require('./errors');

const BLOCKED_HOSTNAMES = new Set(['localhost', 'localhost.localdomain']);
const METADATA_IPV4 = new Set(['169.254.169.254']);

function isIpv4InCidr(ip, base, maskBits) {
  const ipParts = ip.split('.').map(Number);
  const baseParts = base.split('.').map(Number);
  if (ipParts.length !== 4 || baseParts.length !== 4) return false;

  const ipNumber = ipParts.reduce((acc, part) => ((acc << 8) + part) >>> 0, 0);
  const baseNumber = baseParts.reduce((acc, part) => ((acc << 8) + part) >>> 0, 0);
  const mask = maskBits === 0 ? 0 : (0xffffffff << (32 - maskBits)) >>> 0;
  return (ipNumber & mask) === (baseNumber & mask);
}

function isBlockedIpv4(ip) {
  if (METADATA_IPV4.has(ip)) return true;
  return [
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16],
    ['172.16.0.0', 12],
    ['192.0.0.0', 24],
    ['192.0.2.0', 24],
    ['192.168.0.0', 16],
    ['198.18.0.0', 15],
    ['198.51.100.0', 24],
    ['203.0.113.0', 24],
    ['224.0.0.0', 4],
    ['240.0.0.0', 4]
  ].some(([base, mask]) => isIpv4InCidr(ip, base, mask));
}

function isBlockedIpv6(ip) {
  const normalized = ip.toLowerCase();
  return normalized === '::'
    || normalized === '::1'
    || normalized.startsWith('fc')
    || normalized.startsWith('fd')
    || normalized.startsWith('fe80:')
    || normalized.startsWith('ff')
    || normalized.startsWith('2001:db8:');
}

function isPrivateAddress(address) {
  const family = net.isIP(address);
  if (family === 4) return isBlockedIpv4(address);
  if (family === 6) return isBlockedIpv6(address);
  return true;
}

function hostMatchesAllowed(hostname, allowedHost) {
  const host = hostname.toLowerCase();
  const allowed = String(allowedHost).toLowerCase();
  if (!allowed) return false;
  if (allowed.startsWith('*.')) {
    const suffix = allowed.slice(1);
    return host.endsWith(suffix) && host.length > suffix.length;
  }
  return host === allowed;
}

function assertAllowedHost(hostname) {
  if (!env.allowedOutboundHosts.length) return;
  if (env.allowedOutboundHosts.some((allowedHost) => hostMatchesAllowed(hostname, allowedHost))) return;
  throw new AppError('Outbound URL host is not allowed', 400, 'OUTBOUND_URL_HOST_NOT_ALLOWED');
}

async function assertSafeOutboundUrl(rawUrl, { requireHttps = false } = {}) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (error) {
    throw new AppError('Invalid outbound URL', 400, 'INVALID_OUTBOUND_URL');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new AppError('Outbound URL must use HTTP or HTTPS', 400, 'OUTBOUND_URL_PROTOCOL_NOT_ALLOWED');
  }

  if (requireHttps && parsed.protocol !== 'https:') {
    throw new AppError('Outbound URL must use HTTPS', 400, 'OUTBOUND_URL_HTTPS_REQUIRED');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname || BLOCKED_HOSTNAMES.has(hostname)) {
    throw new AppError('Outbound URL host is not allowed', 400, 'OUTBOUND_URL_HOST_NOT_ALLOWED');
  }

  assertAllowedHost(hostname);

  if (env.allowPrivateOutboundUrls) return parsed.toString();

  const directIpFamily = net.isIP(hostname);
  if (directIpFamily) {
    if (isPrivateAddress(hostname)) {
      throw new AppError('Outbound URL resolves to a private or reserved address', 400, 'OUTBOUND_URL_PRIVATE_ADDRESS');
    }
    return parsed.toString();
  }

  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch (error) {
    throw new AppError('Outbound URL host could not be resolved', 400, 'OUTBOUND_URL_DNS_FAILED');
  }

  if (!addresses.length || addresses.some((item) => isPrivateAddress(item.address))) {
    throw new AppError('Outbound URL resolves to a private or reserved address', 400, 'OUTBOUND_URL_PRIVATE_ADDRESS');
  }

  return parsed.toString();
}

module.exports = {
  assertSafeOutboundUrl,
  isPrivateAddress
};
