/**
 * @typedef {Object} PageResult
 * @property {boolean} found - Whether the page was found
 * @property {string} [pageContent] - Content of index.html if found
 * @property {string} [yamlContent] - Content of get.yaml if found
 * @property {Record<string,string>} [params] - Path params
 */

/**
 * @typedef {Object} PageMatch
 * @property {string} pagePath - Path to the index.html file
 * @property {Record<string, string>} params - Extracted URL parameters
 */

/**
 * Find matching page and extract parameters
 * @param {string} path - URL path without leading slash
 * @returns {Promise<PageMatch|null>} Page match with parameters or null
 */
async function findPageWithParams(path) {
  const pathSegments = path.split("/").filter(Boolean);

  // Try exact match first
  const exactPath = `./pages/${path}/index.html`;
  try {
    await Deno.stat(exactPath);
    return { pagePath: exactPath, params: {} };
  } catch {
    // Continue to parameter matching
  }

  // Recursively search for parameterized paths
  async function searchPath(segments, currentPath = "./pages", params = {}) {
    if (segments.length === 0) {
      const indexPath = `${currentPath}/index.html`;
      try {
        await Deno.stat(indexPath);
        return { pagePath: indexPath, params };
      } catch {
        return null;
      }
    }

    const [segment, ...remainingSegments] = segments;

    try {
      const entries = await Deno.readDir(currentPath);
      for await (const entry of entries) {
        if (!entry.isDirectory) continue;

        if (entry.name === segment) {
          // Exact match
          const result = await searchPath(
            remainingSegments,
            `${currentPath}/${segment}`,
            params,
          );
          if (result) return result;
        } else if (entry.name.startsWith("[") && entry.name.endsWith("]")) {
          // Parameter match
          const paramName = entry.name.slice(1, -1);
          const result = await searchPath(
            remainingSegments,
            `${currentPath}/${entry.name}`,
            { ...params, [paramName]: segment },
          );
          if (result) return result;
        }
      }
    } catch {
      // Directory doesn't exist
    }

    return null;
  }

  return await searchPath(pathSegments);
}

/**
 * Fetch page content and YAML data
 * @param {string} path - URL path without leading slash
 * @param {Function} log - Logging function
 * @returns {Promise<PageResult>} Page result with content
 */
export { findPageWithParams };
export async function fetchPage(path, log) {
  log({
    level: "info",
    message: `Fetching page for path: ${path}`,
    data: { path },
  });

  // Find matching page with parameters
  const match = await findPageWithParams(path);
  if (!match) {
    log({
      level: "warn",
      message: `Page not found for path: ${path}`,
      data: { path },
    });
    return { found: false };
  }

  const { pagePath, params } = match;
  log({
    level: "info",
    message: `Found page with parameters`,
    data: { pagePath, params },
  });

  try {
    // Load page content
    const pageContent = await Deno.readTextFile(pagePath);
    log({
      level: "info",
      message: `Loaded page content`,
      data: { contentLength: pageContent.length },
    });

    // Check for get.yaml file
    let yamlContent = null;
    try {
      const pageDir = pagePath.replace("/index.html", "");
      const yamlPath = `${pageDir}/get.yaml`;
      yamlContent = await Deno.readTextFile(yamlPath);
      log({ level: "info", message: `Found YAML data`, data: { yamlPath } });
    } catch {
      log({ level: "info", message: "No YAML data found", data: {} });
    }

    return {
      found: true,
      pageContent,
      yamlContent,
      params,
    };
  } catch (error) {
    log({
      level: "error",
      message: "Error fetching page",
      data: { error: error.message },
    });
    return { found: false };
  }
}
