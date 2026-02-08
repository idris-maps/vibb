// deno-lint-ignore-file
import {
  assertEquals,
  assertExists,
  assertFalse,
} from "https://deno.land/std@0.207.0/assert/mod.ts";
import { fetchPage } from "./fetch_page.js";

// Mock logging function
const mockLog = () => {};

Deno.test("fetchPage - found exact match", async () => {
  const result = await fetchPage("", mockLog);

  assertEquals(result.found, true);
  assertExists(result.pageContent);
  assertExists(result.params);
  assertEquals(typeof result.pageContent, "string");
});

Deno.test("fetchPage - not found for non-existent path", async () => {
  const result = await fetchPage("definitely-non-existent/deep/path", mockLog);

  assertEquals(result.found, false);
  // Should not have content properties when not found
  assertEquals(result.pageContent, undefined);
  assertEquals(result.yamlContent, undefined);
  assertEquals(result.params, undefined);
});

Deno.test("fetchPage - parameterized route match", async () => {
  const result = await fetchPage("123", mockLog);

  assertEquals(result.found, true);
  assertExists(result.pageContent);
  assertExists(result.params);
  assertEquals(result.params.userId, "123");
});

Deno.test("fetchPage - nested parameterized route match", async () => {
  const result = await fetchPage("test/456/x/789", mockLog);

  assertEquals(result.found, true);
  assertExists(result.pageContent);
  assertExists(result.params);
  assertEquals(result.params.id1, "456");
  assertEquals(result.params.id2, "789");
});

Deno.test("fetchPage - YAML content found", async () => {
  const result = await fetchPage("with-data", mockLog);

  assertEquals(result.found, true);
  assertExists(result.yamlContent);
  assertEquals(typeof result.yamlContent, "string");
});

Deno.test("fetchPage - no YAML content", async () => {
  const result = await fetchPage("about", mockLog);

  assertEquals(result.found, true);
  assertFalse(result.yamlContent);
});

Deno.test("fetchPage - empty path handling", async () => {
  const result = await fetchPage("", mockLog);

  assertEquals(result.found, true);
  assertExists(result.pageContent);
});

Deno.test("fetchPage - path with leading slash", async () => {
  const result = await fetchPage("/about", mockLog);

  assertEquals(result.found, true);
  assertExists(result.pageContent);
});

Deno.test("fetchPage - path with trailing slash", async () => {
  const result = await fetchPage("about/", mockLog);

  assertEquals(result.found, true);
  assertExists(result.pageContent);
});

Deno.test("fetchPage - complex nested parameters", async () => {
  const result = await fetchPage("test/abc/x/def", mockLog);

  assertEquals(result.found, true);
  assertEquals(result.params.id1, "abc");
  assertEquals(result.params.id2, "def");
});

Deno.test("fetchPage - parameter extraction with special characters", async () => {
  const result = await fetchPage("test/user-123/x/post-456", mockLog);

  assertEquals(result.found, true);
  assertEquals(result.params.id1, "user-123");
  assertEquals(result.params.id2, "post-456");
});

Deno.test("fetchPage - logging function is called", async () => {
  let logCalls = [];
  const testLog = ({ level, message, data }) => {
    logCalls.push({ level, message, data });
  };

  await fetchPage("test", testLog);

  // Should have multiple log calls for different operations
  assertExists(logCalls.find((call) => call.message.includes("Fetching page")));
  assertExists(logCalls.find((call) => call.level === "info"));
});

Deno.test("fetchPage - error handling for invalid directory", async () => {
  // Test with a path that might cause file system errors
  const result = await fetchPage("../../../etc/passwd", mockLog);

  // Should handle gracefully and return found: false
  assertEquals(result.found, false);
});
