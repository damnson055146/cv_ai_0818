export function resolveBackendBase(raw: string | undefined | null): string {
  const trimmed = String(raw || "").trim().replace(/\/$/, "");
  if (!trimmed) {
    return "";
  }

  if (process.client) {
    try {
      const current = window.location;
      const resolved = new URL(trimmed, current.href);

      // If the configured host matches the current host (even if the port differs),
      // prefer same-origin relative paths to reuse the reverse proxy and avoid CORS.
      if (resolved.hostname === current.hostname) {
        return "";
      }

      // Special-case our known proxy pair (101 <-> 52) so traffic keeps the
      // origin that the browser is using instead of reaching backend directly.
      const knownBackends = new Set(["52.76.179.88"]);
      const knownProxies = new Set(["101.201.60.17", "52.76.179.88"]);
      if (knownBackends.has(resolved.hostname) && knownProxies.has(current.hostname)) {
        return "";
      }

    } catch {
      // ignore malformed values; fall back to the original string
    }
  }

  return trimmed;
}
