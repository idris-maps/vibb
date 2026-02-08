import {
  assert,
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.207.0/assert/mod.ts";
import { handlePostRequest } from "./handle_post.js";
import { requestStrategy } from "./request_strategy.js";
import { sqliteStrategy } from "./sqlite_strategy.js";

// Mock data strategies for testing
const mockDataStrategies = {
  request: requestStrategy,
  sqlite: sqliteStrategy,
};

// Mock logging function
function mockLog() {
  const logs = [];
  return {
    log: ({ level, message, data }) => {
      logs.push({ level, message, data, timestamp: new Date().toISOString() });
    },
    getLogs: () => logs,
    clearLogs: () => logs.length = 0,
  };
}

Deno.test({
  name: "handlePostRequest - page not found",
  async fn() {
    const { log, getLogs } = mockLog();

    // Create a mock request with a path that won't match any routes
    const request = new Request("http://localhost:8000/nonexistent/deep/path", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ test: "data" }),
    });

    const response = await handlePostRequest(
      "nonexistent/deep/path",
      request,
      log,
      mockDataStrategies,
    );

    assertEquals(response.status, 404);
    assertEquals(await response.text(), "Page not found");

    const logs = getLogs();
    const warnLogs = logs.filter((log) => log.level === "warn");
    assertEquals(warnLogs.length, 1);
    assertEquals(
      warnLogs[0].message,
      "Page not found for POST: nonexistent/deep/path",
    );
  },
});

Deno.test({
  name: "handlePostRequest - POST not allowed (no post.yaml)",
  async fn() {
    const { log, getLogs } = mockLog();

    // Test with a page that exists but has no post.yaml (like about page)
    const request = new Request("http://localhost:8000/about", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ test: "data" }),
    });

    const response = await handlePostRequest(
      "about",
      request,
      log,
      mockDataStrategies,
    );

    assertEquals(response.status, 405);
    assertEquals(await response.text(), "Method not allowed");

    const logs = getLogs();
    const warnLogs = logs.filter((log) => log.level === "warn");
    assertEquals(warnLogs.length, 1);
    assertEquals(warnLogs[0].message, "POST not allowed for path: about");
  },
});

Deno.test({
  name: "handlePostRequest - POST allowed with JSON data",
  async fn() {
    const { log, getLogs } = mockLog();

    const formData = {
      name: "Test User",
      age: "25",
      email: "test@example.com",
      message: "Hello World",
    };

    const request = new Request("http://localhost:8000/form", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(formData),
    });

    const response = await handlePostRequest(
      "form",
      request,
      log,
      mockDataStrategies,
    );

    assertEquals(response.status, 200);
    assertEquals(response.headers.get("content-type"), "application/json");

    const responseData = await response.json();
    assertExists(responseData.processedData);
    assertEquals(responseData.processedData.name, "Test User");
    assertEquals(responseData.processedData.age, "25");
    assertEquals(responseData.processedData.email, "test@example.com");
    assertEquals(responseData.processedData.message, "Hello World");
    assertEquals(responseData.processedData.status, "processed");

    const logs = getLogs();
    const infoLogs = logs.filter((log) => log.level === "info");
    assertExists(
      infoLogs.find((log) => log.message.includes("Handling POST request")),
    );
    assertExists(
      infoLogs.find((log) => log.message.includes("POST allowed check")),
    );
    assertExists(
      infoLogs.find((log) => log.message.includes("Parsed form data")),
    );
  },
});

Deno.test({
  name: "handlePostRequest - POST with URL-encoded form data",
  async fn() {
    const { log, getLogs } = mockLog();

    const formData = "name=Test%20User&age=25&email=test%40example.com";

    const request = new Request("http://localhost:8000/form", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: formData,
    });

    const response = await handlePostRequest(
      "form",
      request,
      log,
      mockDataStrategies,
    );

    assertEquals(response.status, 200);

    const responseData = await response.json();
    assertExists(responseData.processedData);
    assertEquals(responseData.processedData.name, "Test User");
    assertEquals(responseData.processedData.age, "25");
    assertEquals(responseData.processedData.email, "test@example.com");
  },
});

Deno.test({
  name: "handlePostRequest - POST with multipart form data",
  async fn() {
    const { log, getLogs } = mockLog();

    // Create a mock multipart form data
    const formData = new FormData();
    formData.append("name", "Test User");
    formData.append("age", "25");

    const request = new Request("http://localhost:8000/form", {
      method: "POST",
      body: formData,
    });

    const response = await handlePostRequest(
      "form",
      request,
      log,
      mockDataStrategies,
    );

    assertEquals(response.status, 200);

    const responseData = await response.json();
    assertExists(responseData.processedData);
    assertEquals(responseData.processedData.name, "Test User");
    assertEquals(responseData.processedData.age, "25");
  },
});

Deno.test({
  name: "handlePostRequest - POST with invalid JSON",
  async fn() {
    const { log, getLogs } = mockLog();

    const request = new Request("http://localhost:8000/form", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "invalid json {",
    });

    const response = await handlePostRequest(
      "form",
      request,
      log,
      mockDataStrategies,
    );

    assertEquals(response.status, 200);

    const responseData = await response.json();
    // Should process empty form data
    assertEquals(responseData.formData, {});
  },
});

Deno.test({
  name: "handlePostRequest - POST with no content type",
  async fn() {
    const { log, getLogs } = mockLog();

    const request = new Request("http://localhost:8000/form", {
      method: "POST",
      body: "some data",
    });

    const response = await handlePostRequest(
      "form",
      request,
      log,
      mockDataStrategies,
    );

    assertEquals(response.status, 200);

    const responseData = await response.json();
    // Should return empty form data when no content type is specified
    assertEquals(responseData.formData, {});
  },
});

Deno.test({
  name: "handlePostRequest - POST executes data strategies",
  async fn() {
    const { log, getLogs } = mockLog();

    const formData = {
      name: "Strategy Test",
      age: "30",
    };

    const request = new Request("http://localhost:8000/form", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(formData),
    });

    const response = await handlePostRequest(
      "form",
      request,
      log,
      mockDataStrategies,
    );

    assertEquals(response.status, 200);

    const responseData = await response.json();

    // Check that request strategy was executed (emailConfirmation)
    assertExists(responseData.emailConfirmation);
    assertEquals(
      responseData.emailConfirmation.url,
      "https://httpbin.org/post",
    );

    // Check that logEntry strategy was executed
    assertExists(responseData.logEntry);
    assertEquals(responseData.logEntry.url, "https://httpbin.org/put");
  },
});

Deno.test({
  name: "handlePostRequest - logging function is called correctly",
  async fn() {
    const { log, getLogs } = mockLog();

    const formData = { test: "data" };
    const request = new Request("http://localhost:8000/form", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(formData),
    });

    await handlePostRequest(
      "form",
      request,
      log,
      mockDataStrategies,
    );

    const logs = getLogs();

    // Should have multiple log entries
    assert(logs.length >= 4);

    // Check for specific log messages
    const logMessages = logs.map((log) => log.message);
    assertExists(
      logMessages.find((msg) => msg.includes("Handling POST request")),
    );
    assertExists(logMessages.find((msg) => msg.includes("POST allowed check")));
    assertExists(logMessages.find((msg) => msg.includes("Parsed form data")));

    // Check that data is included in logs
    const handlingLog = logs.find((log) =>
      log.message.includes("Handling POST request")
    );
    assertEquals(handlingLog.data.path, "form");

    const formDataLog = logs.find((log) =>
      log.message.includes("Parsed form data")
    );
    assertExists(formDataLog.data.formDataKeys);
  },
});
