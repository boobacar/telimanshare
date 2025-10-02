// Serverless proxy for Office Viewer: normalizes headers and streams file from Firebase URL
// Usage: /api/office-proxy?u=<encoded_source_url>&name=<filename>

export default async function handler(req, res) {
  try {
    const { u, name } = req.query || {};
    if (!u) {
      res.status(400).json({ error: "missing 'u' param" });
      return;
    }

    // Fetch upstream
    const upstream = await fetch(u, { method: "GET" });
    if (!upstream.ok || !upstream.body) {
      res.status(502).json({ error: `upstream_${upstream.status}` });
      return;
    }

    const ct = upstream.headers.get("content-type") || "application/octet-stream";
    const len = upstream.headers.get("content-length");
    res.setHeader("Content-Type", ct);
    if (len) res.setHeader("Content-Length", len);
    res.setHeader("Accept-Ranges", "bytes");
    const fname = typeof name === "string" && name ? name : "document";
    res.setHeader(
      "Content-Disposition",
      `inline; filename*=UTF-8''${encodeURIComponent(fname)}`
    );
    res.setHeader("Cache-Control", "public, max-age=300");

    res.statusCode = 200;
    const reader = upstream.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (e) {
    try {
      res.status(500).json({ error: String(e?.message || e) });
    } catch {}
  }
}

