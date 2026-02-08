import { parse } from "https://deno.land/std@0.207.0/yaml/parse.ts";
import { Handlebars } from "./deps.ts";
import { fetchPage, findPageWithParams } from "./fetch_page.js";

/**
 * @typedef {Object} RequestContext
 * @property {Record<string, string>} params - URL parameters
 * @property {Record<string, string>} query - Query parameters
 * @property {Record<string, any>} formData - POST form data
 */

/**
 * @typedef {Object} PostConfig
 * @property {string} yamlContent - Raw YAML content
 * @property {Record<string, string>} params - URL parameters
 * @property {Record<string, string>} query - Query parameters
 * @property {Record<string, any>} formData - POST form data
 * @property {Record<string, Function>} dataStrategies - Available data strategies
 * @property {Function} log - Logging function
 */

/**
 * @typedef {Function} Strategy
 * @param {any} config - Strategy configuration
 * @param {RequestContext} context - Request context
 * @returns {Promise<any>} Strategy result
 */

// Initialize Handlebars for this module
const handlebars = Handlebars.create();

/**
 * Execute individual send strategy using strategy map
 * @param {any} config - Send configuration
 * @param {RequestContext} context - Request context
 * @param {Record<string, Strategy>} dataStrategies - Available strategies
 * @param {Function} log - Logging function
 * @returns {Promise<any>} Strategy result
 */
async function executeSendStrategy(config, context, dataStrategies, log) {
  const { type } = config;

  const strategy = dataStrategies[type];
  if (!strategy) {
    log({
      level: "warn",
      message: `Unknown send strategy: ${type}`,
      data: { type },
    });
    return undefined;
  }

  try {
    return await strategy(config, context);
  } catch (error) {
    log({
      level: "error",
      message: `Send strategy execution failed: ${error.message}`,
      data: { type, error: error.message },
    });
    return undefined;
  }
}

/**
 * Data sending strategies
 * @param {any} sendConfig - Send configuration (object or array)
 * @param {RequestContext} context - Request context
 * @param {Record<string, Strategy>} dataStrategies - Available strategies
 * @param {Function} log - Logging function
 * @returns {Promise<Record<string, any>>} Sent data results
 */
async function sendDataStrategies(sendConfig, context, dataStrategies, log) {
  if (!sendConfig) return {};

  const results = {};

  // Handle array of send configs
  if (Array.isArray(sendConfig)) {
    for (const config of sendConfig) {
      const result = await executeSendStrategy(
        config,
        context,
        dataStrategies,
        log,
      );
      if (config.key && result !== undefined) {
        results[config.key] = result;
      }
    }
  } else if (typeof sendConfig === "object") {
    // Handle single send config
    const result = await executeSendStrategy(
      sendConfig,
      context,
      dataStrategies,
      log,
    );
    if (sendConfig.key && result !== undefined) {
      results[sendConfig.key] = result;
    }
  }

  return results;
}

/**
 * Process POST request with YAML configuration
 * @param {PostConfig} options - Processing options
 * @returns {Promise<Record<string, any>>} Processed data with sent results
 */
export async function handlePost(
  { yamlContent, params, query, formData, dataStrategies, log },
) {
  if (!yamlContent) {
    // No YAML content, return just context data
    return { params, query, formData };
  }

  log({
    level: "info",
    message: `Processing POST YAML content`,
    data: { hasContent: !!yamlContent },
  });

  try {
    // Process YAML with template variables (includes formData)
    const processedYaml = handlebars.compile(yamlContent)({
      params,
      query,
      formData,
    });
    log({
      level: "info",
      message: `Processed POST YAML template`,
      data: { processedLength: processedYaml.length },
    });

    // Parse processed YAML
    const yamlData = parse(processedYaml);
    log({
      level: "info",
      message: `Parsed POST YAML data`,
      data: { hasSendData: !!yamlData.send_data },
    });

    // Handle send_data if present
    if (yamlData.send_data) {
      log({
        level: "info",
        message: `Sending data using strategies`,
        data: {},
      });
      const context = { params, query, formData };
      const sentData = await sendDataStrategies(
        yamlData.send_data,
        context,
        dataStrategies,
        log,
      );
      // Remove send_data from yamlData and merge sent results
      const { send_data, ...restYamlData } = yamlData;
      const finalData = {
        ...restYamlData,
        ...sentData,
        params,
        query,
        formData,
      };
      log({
        level: "info",
        message: `Final data after send`,
        data: { dataKeys: Object.keys(finalData) },
      });
      return finalData;
    } else {
      // No send_data, just return parsed YAML with context
      log({
        level: "info",
        message: `No send_data found, returning parsed YAML`,
        data: {},
      });
      return { ...yamlData, params, query, formData };
    }
  } catch (error) {
    log({
      level: "error",
      message: `POST YAML processing failed: ${error.message}`,
      data: { error: error.message },
    });
    // Return context data even if processing fails
    return { params, query, formData };
  }
}

/**
 * Check if POST is allowed for this endpoint
 * @param {string} pagePath - Path to the index.html file
 * @param {string} requestPath - Request path for validation
 * @returns {Promise<boolean>} Whether POST is allowed
 */
export async function isPostAllowed(pagePath, requestPath) {
  // POST is only allowed if post.yaml exists in the same directory as index.html
  try {
    const pageDir = pagePath.replace("/index.html", "");
    const postYamlPath = `${pageDir}/post.yaml`;
    await Deno.stat(postYamlPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Load POST YAML content
 * @param {string} pagePath - Path to the index.html file
 * @returns {Promise<string|null>} YAML content or null
 */
export async function loadPostYaml(pagePath) {
  try {
    const pageDir = pagePath.replace("/index.html", "");
    const postYamlPath = `${pageDir}/post.yaml`;
    return await Deno.readTextFile(postYamlPath);
  } catch {
    return null;
  }
}

/**
 * Helper function to parse form data
 * @param {Request} req - HTTP request
 * @returns {Promise<Record<string, any>>} Parsed form data
 */
async function parseFormData(req) {
  const contentType = req.headers.get("content-type");

  if (contentType?.includes("application/json")) {
    // Handle JSON form data
    const body = await req.text();
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  } else if (contentType?.includes("application/x-www-form-urlencoded")) {
    // Handle URL-encoded form data
    const body = await req.text();
    const formData = new URLSearchParams(body);
    const result = {};
    for (const [key, value] of formData) {
      result[key] = value;
    }
    return result;
  } else if (contentType?.includes("multipart/form-data")) {
    // Handle multipart form data (simplified version)
    const formData = await req.formData();
    const result = {};
    for (const [key, value] of formData) {
      if (typeof value === "string") {
        result[key] = value;
      } else {
        // For files, we'll just store the filename for now
        result[key] = { filename: value.name, type: value.type };
      }
    }
    return result;
  }

  return {};
}

/**
 * Helper function to handle POST requests
 * @param {string} path - URL path without leading slash
 * @param {Request} req - HTTP request
 * @param {Function} log - Logging function
 * @param {Record<string, Function>} dataStrategies - Data strategies
 * @returns {Promise<Response>} HTTP response
 */
export async function handlePostRequest(path, req, log, dataStrategies) {
  log({
    level: "info",
    message: `Handling POST request for path: ${path}`,
    data: { path },
  });

  // Find matching page first to get pagePath
  const match = await findPageWithParams(path);
  if (!match) {
    log({
      level: "warn",
      message: `Page not found for POST: ${path}`,
      data: { path },
    });
    return new Response("Page not found", { status: 404 });
  }

  const { pagePath, params = {} } = match;

  // Check if POST is allowed for this endpoint
  const postAllowed = await isPostAllowed(pagePath, path);
  log({
    level: "info",
    message: `POST allowed check`,
    data: { pagePath, path, postAllowed },
  });

  if (!postAllowed) {
    log({
      level: "warn",
      message: `POST not allowed for path: ${path}`,
      data: { pagePath, path },
    });
    return new Response("Method not allowed", { status: 405 });
  }

  // Parse form data
  const formData = await parseFormData(req);
  log({
    level: "info",
    message: `Parsed form data`,
    data: { formDataKeys: Object.keys(formData) },
  });

  // Load POST YAML configuration
  const postYamlContent = await loadPostYaml(pagePath);

  // Process POST request
  let data;
  if (postYamlContent) {
    data = await handlePost({
      yamlContent: postYamlContent,
      params,
      query: {},
      formData,
      dataStrategies,
      log,
    });
  } else {
    log({
      level: "warn",
      message: "No post.yaml found, but POST was allowed",
      data: {},
    });
    data = { params, query: {}, formData };
  }

  // Return JSON response for POST requests
  return new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json" },
  });
}
