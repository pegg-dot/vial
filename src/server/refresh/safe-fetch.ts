import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import type { SafeFetchResult } from "./types";

export class SafeFetchError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "SafeFetchError";
  }
}

function ipv4Number(address: string) {
  return address.split(".").reduce((value, part) => (value << 8) + Number(part), 0) >>> 0;
}

function inIpv4Range(address: string, base: string, bits: number) {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipv4Number(address) & mask) === (ipv4Number(base) & mask);
}

export function isPublicAddress(address: string) {
  const kind = net.isIP(address);
  if (kind === 4) {
    const blocked: Array<[string, number]> = [
      ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
      ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
      ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
      ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
    ];
    return !blocked.some(([base, bits]) => inIpv4Range(address, base, bits));
  }
  if (kind === 6) {
    const normalized = address.toLowerCase();
    if (normalized === "::" || normalized === "::1") return false;
    if (normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return false;
    if (normalized.startsWith("ff")) return false;
    if (normalized.startsWith("2001:db8:")) return false;
    const mapped = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPublicAddress(mapped[1]);
    return true;
  }
  return false;
}

/**
 * Build the DNS `lookup` shim that pins a connection to a pre-validated IP. Node's
 * http agent may call it with `{ all: true }` (expecting an array) or without
 * (expecting address + family). Honoring only one form makes the request throw
 * "Invalid IP address: undefined" against hosts that trigger the other — so both
 * are handled here, and this is unit-tested to prevent regression.
 */
export function pinnedLookup(resolvedIp: string): net.LookupFunction {
  return ((_hostname: string, lookupOptions: { all?: boolean }, callback: (err: NodeJS.ErrnoException | null, address: string | Array<{ address: string; family: number }>, family?: number) => void) => {
    if (lookupOptions && typeof lookupOptions === "object" && lookupOptions.all === true) {
      callback(null, [{ address: resolvedIp, family: net.isIP(resolvedIp) }]);
    } else {
      callback(null, resolvedIp, net.isIP(resolvedIp));
    }
  }) as unknown as net.LookupFunction;
}

export async function validateFetchUrl(value: string, allowedHostnames: string[]) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) throw new SafeFetchError("Only HTTP and HTTPS sources are supported", "unsupported-protocol");
  if (url.username || url.password) throw new SafeFetchError("Source URLs cannot contain credentials", "credentials-forbidden");
  const port = url.port || (url.protocol === "https:" ? "443" : "80");
  if (!["80", "443"].includes(port)) throw new SafeFetchError("Source URL uses a disallowed port", "port-forbidden");
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  const allowlist = allowedHostnames.map((host) => host.toLowerCase().replace(/\.$/, ""));
  if (!allowlist.includes(hostname)) throw new SafeFetchError("Source hostname is not allowlisted", "hostname-forbidden");
  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!records.length) throw new SafeFetchError("Source hostname did not resolve", "dns-empty");
  for (const record of records) {
    if (!isPublicAddress(record.address)) throw new SafeFetchError("Source resolved to a private or reserved network", "private-address");
  }
  return { url, addresses: records.map((record) => record.address), hostname };
}

interface FetchOptions {
  allowedHostnames: string[];
  allowedContentTypes: string[];
  timeoutMs: number;
  maxResponseBytes: number;
  etag?: string;
  lastModified?: string;
  maxRedirects?: number;
}

async function requestOnce(value: string, options: FetchOptions): Promise<SafeFetchResult & { location?: string }> {
  const validated = await validateFetchUrl(value, options.allowedHostnames);
  // Prefer an already-validated IPv4 address for the connection (many sandboxes and
  // hosts lack an IPv6 route; Cloudflare-fronted vendors return IPv6 first). Every
  // address here passed isPublicAddress, so the anti-rebinding pin still holds.
  const resolvedIp = validated.addresses.find((address) => net.isIP(address) === 4) ?? validated.addresses[0];
  const transport = validated.url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const request = transport.request(validated.url, {
      method: "GET",
      headers: {
        accept: options.allowedContentTypes.join(", "),
        "user-agent": "VIAL-Source-Monitor/0.3 (+https://vial.local/methodology)",
        ...(options.etag ? { "if-none-match": options.etag } : {}),
        ...(options.lastModified ? { "if-modified-since": options.lastModified } : {}),
      },
      lookup: pinnedLookup(resolvedIp),
      servername: validated.hostname,
      timeout: options.timeoutMs,
    }, (response) => {
      const status = response.statusCode ?? 0;
      const location = response.headers.location;
      if (status >= 300 && status < 400 && location) {
        response.resume();
        resolve({
          url: validated.url.toString(), status, contentType: "", body: "", bytes: 0,
          resolvedIp, notModified: false, redirects: [], location: new URL(location, validated.url).toString(),
        });
        return;
      }
      if (status === 304) {
        response.resume();
        resolve({
          url: validated.url.toString(), status, contentType: String(response.headers["content-type"] ?? ""), body: "", bytes: 0,
          etag: response.headers.etag, lastModified: response.headers["last-modified"], resolvedIp, notModified: true, redirects: [],
        });
        return;
      }
      if (status < 200 || status >= 300) {
        response.resume();
        reject(new SafeFetchError(`Source returned HTTP ${status}`, "http-error"));
        return;
      }
      const contentType = String(response.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
      if (!options.allowedContentTypes.includes(contentType)) {
        response.resume();
        reject(new SafeFetchError(`Source returned unsupported content type: ${contentType || "unknown"}`, "content-type-forbidden"));
        return;
      }
      const chunks: Buffer[] = [];
      let bytes = 0;
      response.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > options.maxResponseBytes) {
          request.destroy(new SafeFetchError("Source exceeded the configured response-size limit", "response-too-large"));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => resolve({
        url: validated.url.toString(), status, contentType, body: Buffer.concat(chunks).toString("utf8"), bytes,
        etag: response.headers.etag, lastModified: response.headers["last-modified"], resolvedIp, notModified: false, redirects: [],
      }));
    });
    request.on("timeout", () => request.destroy(new SafeFetchError("Source request timed out", "timeout")));
    request.on("error", (error) => reject(error instanceof SafeFetchError ? error : new SafeFetchError(error.message, "network-error")));
    request.end();
  });
}

export async function safeFetch(value: string, options: FetchOptions): Promise<SafeFetchResult> {
  const redirects: string[] = [];
  let current = value;
  const maxRedirects = options.maxRedirects ?? 3;
  for (let index = 0; index <= maxRedirects; index += 1) {
    const result = await requestOnce(current, options);
    if (!result.location) return { ...result, redirects };
    if (index === maxRedirects) throw new SafeFetchError("Source exceeded the redirect limit", "redirect-limit");
    redirects.push(result.location);
    current = result.location;
  }
  throw new SafeFetchError("Source refresh failed unexpectedly", "unknown");
}
