import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.207.0/assert/mod.ts";

Deno.test("Form endpoint - GET request", async () => {
  const response = await fetch("http://localhost:8000/form");
  assertEquals(response.status, 200);
  assertEquals(response.headers.get("content-type"), "text/html");

  const html = await response.text();
  assertExists(html.includes("Contact Form"));
  assertExists(html.includes('name="name"'));
  assertExists(html.includes('name="age"'));
});

Deno.test("Form endpoint - POST request with JSON", async () => {
  const formData = {
    name: "Test User",
    age: "25",
    email: "test@example.com",
    message: "This is a test message",
  };

  const response = await fetch("http://localhost:8000/form", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(formData),
  });

  assertEquals(response.status, 200);
  assertEquals(response.headers.get("content-type"), "application/json");

  const result = await response.json();
  assertExists(result.processedData);
  assertEquals(result.processedData.name, "Test User");
  assertEquals(result.processedData.age, "25");
  assertEquals(result.processedData.email, "test@example.com");
  assertEquals(result.processedData.message, "This is a test message");
});

Deno.test("Form endpoint - POST request validation", async () => {
  // Test with missing required fields
  const formData = {
    name: "Test User",
    // Missing age, email, message
  };

  const response = await fetch("http://localhost:8000/form", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(formData),
  });

  // Should still process but with missing fields
  assertEquals(response.status, 200);

  const result = await response.json();
  assertExists(result.processedData);
  assertEquals(result.processedData.name, "Test User");
});
