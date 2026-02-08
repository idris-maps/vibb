import { parse } from "https://deno.land/std@0.207.0/yaml/parse.ts";
import { Handlebars } from "./deps.ts";

/**
 * @typedef {Object} RequestContext
 * @property {Record<string, string>} params - URL parameters
 * @property {Record<string, string>} query - Query parameters
 */

/**
 * @typedef {Object} FetchConfig
 * @property {string} type - Strategy type
 * @property {string} key - Result key
 * @property {any} [config] - Strategy-specific configuration
 */

/**
 * @typedef {Function} Strategy
 * @param {any} config - Strategy configuration
 * @param {RequestContext} context - Request context
 * @returns {Promise<any>} Strategy result
 */

/**
 * @typedef {Object} FetchDataOptions
 * @property {string} yamlContent - Raw YAML content
 * @property {Record<string, string>} params - URL parameters
 * @property {Record<string, string>} query - Query parameters
 * @property {Record<string, Strategy>} dataStrategies - Available data strategies
 * @property {Function} log - Logging function
 */

// Initialize Handlebars for this module
const handlebars = Handlebars.create();

/**
 * Execute individual fetch strategy using strategy map
 * @param {FetchConfig} config - Fetch configuration
 * @param {RequestContext} context - Request context
 * @param {Record<string, Strategy>} dataStrategies - Available strategies
 * @returns {Promise<any>} Strategy result
 */
async function executeFetchStrategy(config, context, dataStrategies, log) {
  const { type } = config;

  const strategy = dataStrategies[type];
  if (!strategy) {
    log({
      level: "warn",
      message: `Unknown fetch strategy: ${type}`,
      data: { type },
    });
    return undefined;
  }

  try {
    return await strategy(config, context);
  } catch (error) {
    log({
      level: "error",
      message: `Strategy execution failed: ${error.message}`,
      data: { type, error: error.message },
    });
    return undefined;
  }
}

/**
 * Data fetching strategies
 * @param {any} fetchConfig - Fetch configuration (object or array)
 * @param {RequestContext} context - Request context
 * @param {Record<string, Strategy>} dataStrategies - Available strategies
 * @returns {Promise<Record<string, any>>} Fetched data results
 */
async function fetchDataStrategies(fetchConfig, context, dataStrategies, log) {
  if (!fetchConfig) return {};

  const results = {};

  // Handle array of fetch configs
  if (Array.isArray(fetchConfig)) {
    for (const config of fetchConfig) {
      const result = await executeFetchStrategy(
        config,
        context,
        dataStrategies,
        log,
      );
      if (config.key && result !== undefined) {
        results[config.key] = result;
      }
    }
  } else if (typeof fetchConfig === "object") {
    // Handle single fetch config
    const result = await executeFetchStrategy(
      fetchConfig,
      context,
      dataStrategies,
      log,
    );
    if (fetchConfig.key && result !== undefined) {
      results[fetchConfig.key] = result;
    }
  }

  return results;
}

/**
 * Process YAML content and fetch data
 * @param {FetchDataOptions} options - Processing options
 * @returns {Promise<Record<string, any>>} Processed data with fetched results
 */
export async function fetchData(
  { yamlContent, params, query, dataStrategies, log },
) {
  if (!yamlContent) {
    // No YAML content, return just params and query
    return { params, query };
  }

  log({
    level: "info",
    message: `Processing YAML content`,
    data: { hasContent: !!yamlContent },
  });

  try {
    // Process YAML with template variables
    const processedYaml = handlebars.compile(yamlContent)({ params, query });
    log({
      level: "info",
      message: `Processed YAML template`,
      data: { processedLength: processedYaml.length },
    });

    // Parse processed YAML
    const yamlData = parse(processedYaml);
    log({
      level: "info",
      message: `Parsed YAML data`,
      data: { hasFetchData: !!yamlData.fetch_data },
    });

    // Handle fetch_data if present
    if (yamlData.fetch_data) {
      log({
        level: "info",
        message: `Fetching data using strategies`,
        data: {},
      });
      const fetchedData = await fetchDataStrategies(
        yamlData.fetch_data,
        { params, query },
        dataStrategies,
        log,
      );
      // Remove fetch_data from yamlData and merge fetched results
      // deno-lint-ignore no-unused-vars
      const { fetch_data, ...restYamlData } = yamlData;
      const finalData = { ...restYamlData, ...fetchedData, params, query };
      log({
        level: "info",
        message: `Final data after fetch`,
        data: { dataKeys: Object.keys(finalData) },
      });
      return finalData;
    } else {
      // No fetch_data, just return parsed YAML with params and query
      log({
        level: "info",
        message: `No fetch_data found, returning parsed YAML`,
        data: {},
      });
      return { ...yamlData, params, query };
    }
  } catch (error) {
    log({
      level: "error",
      message: `YAML processing failed: ${error.message}`,
      data: { error: error.message },
    });
    // Return params and query even if processing fails
    return { params, query };
  }
}
