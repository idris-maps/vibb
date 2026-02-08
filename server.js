import { handlePostRequest } from "./handle_post.js";
import { requestStrategy } from "./request_strategy.js";
import { sqliteStrategy } from "./sqlite_strategy.js";
import { renderPage } from "./render_page.js";

/**
 * @typedef {Object} RequestContext
 * @property {Record<string, string>} params - URL parameters
 * @property {Record<string, string>} query - Query parameters
 */

/**
 * @typedef {Function} Strategy
 * @param {any} config - Strategy configuration
 * @param {RequestContext} context - Request context
 * @returns {Promise<any>} Strategy result
 */

// Data strategies map - defined in server and passed to fetch_data
/** @type {Record<string, Strategy>} */
const dataStrategies = {
  request: requestStrategy,
  sqlite: sqliteStrategy,
};

// Logging function
/**
 * @param {Object} logEntry - Log entry
 * @param {'info'|'warn'|'error'} logEntry.level - Log level
 * @param {string} logEntry.message - Log message
 * @param {Record<string, string>} [logEntry.data] - Additional log data
 */
function log({ level, message, data }) {
  console.log(
    JSON.stringify({
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
    }),
  );
}

// Static file serving
/**
 * @param {URL} url - Request URL
 * @returns {Promise<Response|null>} Static file response or null
 */
async function serveStatic(url) {
  if (url.pathname.startsWith("/static/")) {
    try {
      const filePath = "." + url.pathname;
      const content = await Deno.readFile(filePath);
      const ext = url.pathname.split(".").pop();
      const contentType = {
        "css": "text/css",
        "js": "application/javascript",
        "png": "image/png",
        "jpg": "image/jpeg",
        "gif": "image/gif",
        "svg": "image/svg+xml",
      }[ext] || "application/octet-stream";

      return new Response(content, {
        headers: { "content-type": contentType },
      });
    } catch (error) {
      console.error("Static file error:", error);
      return new Response("Static file not found", { status: 404 });
    }
  }
  return null;
}

// Request handler
/**
 * @param {Request} req - HTTP request
 * @returns {Promise<Response>} HTTP response
 */
async function handler(req) {
  const url = new URL(req.url);
  log({
    level: "info",
    message: `Request: ${req.method} ${url.pathname}`,
    data: {},
  });

  // Try static files first
  const staticResponse = await serveStatic(url);
  if (staticResponse) return staticResponse;

  // Extract path and query from URL
  const path = url.pathname.slice(1); // Remove leading slash
  const query = {};
  for (const [key, value] of url.searchParams) {
    query[key] = value;
  }

  // Handle POST requests
  if (req.method === "POST") {
    return await handlePostRequest(path, req, log, dataStrategies);
  }

  // Handle GET requests (default)
  return await renderPage(path, query, log, dataStrategies);
}

// Start server
const port = 8000;
console.log(`Server running on http://localhost:${port}`);

await Deno.serve({ port }, handler);
