import { Handlebars } from "./deps.ts";
import { fetchPage } from "./fetch_page.js";
import { fetchData } from "./fetch_data.js";

// Initialize Handlebars
const handlebars = Handlebars.create();

// Load all layouts
/**
 * @returns {Promise<void>}
 */
async function loadLayouts() {
  try {
    const layoutFiles = await Deno.readDir("./templates/layouts");
    for await (const file of layoutFiles) {
      if (file.name.endsWith(".hbs")) {
        const layoutName = file.name.replace(".hbs", "");
        const layoutContent = await Deno.readTextFile(
          `./templates/layouts/${file.name}`,
        );
        handlebars.registerPartial(layoutName, layoutContent);
        console.log(`Loaded layout: ${layoutName}`);
      }
    }
  } catch (error) {
    console.log("No layouts directory found:", error.message);
  }
}

// Load all partials
/**
 * @returns {Promise<void>}
 */
async function loadPartials() {
  try {
    const partialFiles = await Deno.readDir("./templates/partials");
    for await (const file of partialFiles) {
      if (file.name.endsWith(".hbs")) {
        const partialName = file.name.replace(".hbs", "");
        const partialContent = await Deno.readTextFile(
          `./templates/partials/${file.name}`,
        );
        handlebars.registerPartial(partialName, partialContent);
        console.log(`Loaded partial: ${partialName}`);
      }
    }
  } catch (error) {
    console.log("No partials directory found:", error.message);
  }
}

// Load templates on module import
let templatesLoaded = false;
async function ensureTemplatesLoaded() {
  if (!templatesLoaded) {
    console.log("Loading templates...");
    await loadLayouts();
    await loadPartials();
    templatesLoaded = true;
  }
}

/**
 * Helper function to render pages
 * @param {string} path - URL path without leading slash
 * @param {Record<string, string>} query - Query parameters
 * @param {Function} log - Logging function
 * @param {Record<string, Function>} dataStrategies - Data strategies
 * @returns {Promise<Response>} HTTP response
 */
export async function renderPage(path, query = {}, log, dataStrategies) {
  try {
    // Ensure templates are loaded before rendering
    await ensureTemplatesLoaded();
    log({
      level: "info",
      message: `Rendering page for path: ${path}`,
      data: { path },
    });

    // Fetch page content and YAML data
    const pageResult = await fetchPage(path, log);
    if (!pageResult.found) {
      log({
        level: "warn",
        message: `Page not found for path: ${path}`,
        data: { path },
      });
      return new Response("Page not found", { status: 404 });
    }

    const { pageContent, yamlContent, params = {} } = pageResult;

    // Process YAML content and fetch data
    let data;
    if (yamlContent) {
      data = await fetchData({
        yamlContent,
        params,
        query,
        dataStrategies,
        log,
      });
    } else {
      log({
        level: "info",
        message: "No YAML data found, serving with parameters and query only",
        data: { params, query },
      });
      data = { params, query };
    }

    // Check if this is a pure HTML file (contains doctype)
    const isPureHtml = pageContent.trim().toLowerCase().startsWith(
      "<!doctype html",
    );

    if (isPureHtml) {
      // Serve pure HTML files directly without template processing
      log({
        level: "info",
        message: `Serving pure HTML file directly`,
        data: { path },
      });

      return new Response(pageContent, {
        headers: { "content-type": "text/html" },
      });
    }

    // Render with default layout for template files
    const templateData = {
      title: path ? path.charAt(0).toUpperCase() + path.slice(1) : "Home",
      body: pageContent,
      ...data,
    };

    log({
      level: "info",
      message: `Rendering with layout`,
      data: { dataKeys: Object.keys(templateData) },
    });

    // First render the body with data, then wrap in layout
    const renderedBody = handlebars.compile(pageContent)(data);
    const layoutData = {
      title: templateData.title,
      body: renderedBody,
      ...data,
    };

    const html = handlebars.compile("{{> layout}}")(layoutData);

    return new Response(html, {
      headers: { "content-type": "text/html" },
    });
  } catch (error) {
    log({
      level: "error",
      message: "Error rendering page",
      data: { error: error.message },
    });
    return new Response(`Internal server error: ${error.message}`, {
      status: 500,
    });
  }
}
