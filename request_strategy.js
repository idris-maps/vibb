// Request strategy implementation
/**
 * @typedef {Object} RequestContext
 * @property {Record<string, string>} params - URL parameters
 * @property {Record<string, string>} query - Query parameters
 */

/**
 * @typedef {Object} RequestConfig
 * @property {string} url - Request URL
 * @property {string} [method='GET'] - HTTP method
 * @property {Record<string, string>} [headers={}] - Request headers
 * @property {any} [body] - Request body
 */

/**
 * Execute HTTP request strategy
 * @param {RequestConfig} config - Request configuration
 * @returns {Promise<any>} Response data
 */
export async function requestStrategy(config) {
  const { url, method = "GET", headers = {}, body } = config;

  console.log(`[RequestStrategy] Fetching data from: ${url}`);

  // Prepare request options
  const requestOptions = {
    method: method.toUpperCase(),
    headers: headers,
  };

  // Process body if present
  if (body) {
    requestOptions.body = body;
    console.log(`[RequestStrategy] Request body:`, body);
  }

  try {
    const response = await fetch(url, requestOptions);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type");
    let data;

    if (contentType?.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    console.log(`[RequestStrategy] Fetch successful:`, data);
    return data;
  } catch (error) {
    console.error(`[RequestStrategy] Fetch error for ${url}:`, error);
    throw error;
  }
}
