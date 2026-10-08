import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";

const root = resolve(process.cwd(), "web/out");
const port = Number(process.env.ARCHIVE_PREVIEW_PORT || 4173);
const basePath = process.env.ARCHIVE_PREVIEW_BASE_PATH?.replace(/\/$/, "") || "";
const contentTypes = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript", ".json": "application/json", ".xml": "application/xml", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".txt": "text/plain; charset=utf-8", ".webmanifest": "application/manifest+json" };

const server = createServer(async (request, response) => {
  try {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" }).end();
      return;
    }
    const incomingUrl = new URL(request.url || "/", `http://127.0.0.1:${port}`);
    let path = decodeURIComponent(incomingUrl.pathname);
    if (basePath && path !== basePath && !path.startsWith(`${basePath}/`)) {
      response.writeHead(307, { Location: `${basePath}${incomingUrl.pathname}${incomingUrl.search}` }).end();
      return;
    }
    if (basePath && (path === basePath || path.startsWith(`${basePath}/`))) path = path.slice(basePath.length) || "/";
    let target = resolve(root, `.${path}`);
    if (target !== root && !target.startsWith(`${root}${sep}`)) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    try {
      if ((await stat(target)).isDirectory()) target = resolve(target, "index.html");
      const body = await readFile(target);
      response.writeHead(200, { "Content-Type": contentTypes[extname(target)] || "application/octet-stream", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" });
      response.end(request.method === "HEAD" ? undefined : body);
    } catch (error) {
      if (!error || typeof error !== "object" || !("code" in error) || !["ENOENT", "ENOTDIR"].includes(error.code)) throw error;
      response.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      const body = await readFile(resolve(root, "404.html")).catch(() => Buffer.from("Not found"));
      response.end(request.method === "HEAD" ? undefined : body);
    }
  } catch {
    response.writeHead(400).end("Invalid request");
  }
});
server.listen(port, "127.0.0.1", () => console.log(`Archive preview: http://127.0.0.1:${port}${basePath}/`));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => process.exit(0)));
