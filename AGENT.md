# AGENT.md - Deno Web Server Project

## Project Overview

Building a file-based web server using Deno and Handlebars templating with
dynamic routing and data injection.

## Architecture

### Directory Structure

```
fake-php/
├── server.js             # Main server file using Deno.serve with JSDoc types
├── deps.ts               # Dependencies (Handlebars, YAML parser)
├── fetch_data.js         # Data fetching orchestration with JSDoc types
├── fetch_page.js         # Page content fetching with JSDoc types
├── handle_post.js        # POST request handling with JSDoc types
├── request_strategy.js   # HTTP request data strategy with JSDoc types
├── sqlite_strategy.js    # SQLite database strategy with JSDoc types
├── pages/                # Page directories with index.html files
│   ├── index.html       # Home page
│   ├── about/index.html # About page
│   ├── with-data/index.html # Page with YAML data
│   ├── [userId]/index.html # Parameterized page
│   └── test/[id1]/x/[id2]/index.html # Nested parameters
├── templates/            # Handlebars templates
│   ├── layouts/layout.hbs # Base layout
│   └── partials/        # Partial templates
├── static/              # Static assets
│   └── css/style.css    # Main stylesheet
└── README.md            # Documentation
```

### Core Features

#### 1. File-Based Routing

- Routes based on directory structure in `/pages`
- Each directory must contain `index.html`
- URL path maps to directory path: `/about` → `pages/about/index.html`

#### 2. URL Parameters

- Bracketed folder names `[paramName]` capture URL segments
- Example: `pages/[userId]/index.html` matches `/123`
- Parameters injected as `{ params: { userId: '123' } }`
- Supports nested parameters: `pages/test/[id1]/x/[id2]/index.html`

#### 3. Query Parameters

- URL query strings parsed and injected
- Example: `/123?name=Alice` → `{ query: { name: 'Alice' } }`
- Combined with params:
  `{ params: { userId: '123' }, query: { name: 'Alice' } }`

#### 4. POST Request Handling

- POST requests only allowed for endpoints with `post.yaml` in same directory
- Form data parsed from JSON, URL-encoded, or multipart formats
- `post.yaml` processed with Handlebars templates using `params`, `query`, and
  `formData`
- `send_data` key works like `fetch_data` but for sending/processing data
- Returns JSON responses instead of HTML
- Security: Only accepts POST from same endpoint as `index.html`

#### 5. Data Injection via YAML

- Optional `get.yaml` files alongside `index.html`
- YAML processed as Handlebars template before parsing
- Variables available: `{{params.*}}` and `{{query.*}}`
- Final data merged: `{ ...yamlData, params, query }`

#### 6. POST Data Processing

- Optional `post.yaml` files alongside `index.html` for POST handling
- YAML processed as Handlebars template before parsing
- Variables available: `{{params.*}}`, `{{query.*}}`, and `{{formData.*}}`
- `send_data` strategies executed for data processing/sending
- Returns JSON response with processed data

#### 7. Data Fetching System

- `fetch_data` key in YAML triggers data fetching
- Supports single config object or array of configs
- Each config requires `type` and `key` properties
- Fetched data injected under specified key

#### 8. Data Sending System (POST)

- `send_data` key in `post.yaml` triggers data processing
- Supports single config object or array of configs
- Each config requires `type` and `key` properties
- Processed data included in JSON response

##### Request Strategy (type: request)

- `url` (required): URL template with access to params/query
- `method` (optional): HTTP method, defaults to GET
- `headers` (optional): Key-value pairs, processed as templates
- `body` (optional): YAML converted to JSON, processed as template

##### Data Fetching Examples

```yaml
# Single fetch
fetch_data:
  type: request
  key: user
  url: "https://api.example.com/users/{{params.userId}}"
  method: GET
  headers:
    Authorization: "Bearer {{query.token}}"

# Multiple fetches
fetch_data:
  - type: request
    key: user
    url: "https://api.example.com/users/{{params.userId}}"
  - type: request
    key: posts
    url: "https://api.example.com/posts?userId={{params.userId}}"
    method: POST
    body:
      userId: "{{params.userId}}"
      limit: 10
```

#### 6. Plugin System for Data Strategies

- Modular strategy system using `Record<string, Strategy>` map
- Strategies are async functions that take processed config and return data
- Template processing handled in server before calling strategies
- Strategies receive fully processed configuration (no Handlebars needed)

##### Strategy Interface

```typescript
type Strategy = (config: any, context: RequestContext) => Promise<any>;
```

##### Data Fetching Module (`fetch_data.js`)

- Handles orchestration of data fetching strategies
- Uses JSDoc for type documentation in JavaScript
- Exports `fetchData()` function for use in server
- Manages strategy map and execution logic

##### Page Fetching Module (`fetch_page.js`)

- Handles page discovery and content loading
- Uses JSDoc for type documentation in JavaScript
- Exports `fetchPage()` function that returns structured page data
- Manages parameterized routing and file system operations
- Returns `{ found, pageContent, yamlContent, params }`

##### POST Handling Module (`handle_post.js`)

- Handles POST request processing and validation
- Uses JSDoc for type documentation in JavaScript
- Exports `handlePost()`, `isPostAllowed()`, and `loadPostYaml()` functions
- Manages form data parsing (JSON, URL-encoded, multipart)
- Processes `post.yaml` configurations with `send_data` strategies
- Returns JSON responses for POST requests

##### Adding New Strategies

1. Create strategy file (e.g., `sql_strategy.ts`)
2. Export async function implementing the strategy
3. Import in `server.ts`
4. Add to `dataStrategies` map

##### Example Strategy Implementation

```typescript
// sql_strategy.ts
export async function sqlStrategy(
  config: any,
  context: RequestContext,
): Promise<any> {
  const { query, connection } = config;
  // Execute SQL query and return results
  return await executeSQL(query, connection);
}

// fetch_data.js
const dataStrategies = {
  request: requestStrategy,
  sql: sqlStrategy,
};
```

#### 7. Template Rendering

- Handlebars templating engine
- Layout system via `/templates/layouts/`
- Partials via `/templates/partials/`
- Two-stage rendering: YAML → HTML → Layout

### Technical Implementation

#### Dependencies

- `deno.serve` - Native HTTP server
- `handlebars` - Template engine (esm.sh)
- `std/yaml/parse` - YAML parsing
- `std/yaml/stringify` - YAML serialization for request bodies

#### Routing Algorithm

1. Parse URL path and query parameters
2. Recursively search `/pages` for matching directory structure
3. Priority: exact matches > parameterized matches
4. Extract parameters from bracketed folder names
5. Fetch page content and YAML using `fetchPage()`
6. Process YAML as Handlebars template with params/query
7. Parse processed YAML and extract fetch_data configs
8. Process fetch_data templates (URL, headers, body) with params/query
9. Execute data strategies with processed configs
10. Merge fetched results with YAML data, params, query
11. Render HTML template with merged data
12. Wrap in layout and serve

#### Error Handling

- 404: Page not found
- 500: Internal server errors with console logging
- Detailed logging for debugging routing and data injection

### Usage Examples

#### Basic Page

```
pages/index.html → /
pages/about/index.html → /about
```

#### Parameterized Page

```
pages/[userId]/index.html
URL: /123
Data: { params: { userId: '123' } }
Template: {{params.userId}}
```

#### Data Injection

```
pages/[userId]/get.yaml:
value: Hello {{query.name}} your ID is {{params.userId}}

URL: /123?name=Alice
Result: { value: "Hello Alice your ID is 123", params: { userId: '123' }, query: { name: 'Alice' } }
```

#### Nested Parameters

```
pages/test/[id1]/x/[id2]/index.html
URL: /test/123/x/456?name=Alice
Data: { params: { id1: '123', id2: '456' }, query: { name: 'Alice' } }
```

### Development Commands

```bash
# Start server
deno run --allow-net --allow-read --allow-write --allow-env server.js

# Server runs on http://localhost:8000

# Run unit tests
deno test --allow-read --allow-write

# Run specific test file
deno test --allow-read --allow-write fetch_data.test.js
deno test --allow-read fetch_page.test.js
deno test --allow-read --allow-write handle_post.test.js

# Run tests with coverage
deno test --allow-read --allow-write --coverage

# Run tests in watch mode during development
deno test --allow-read --allow-write --watch
```

### Testing

- Comprehensive unit tests for `fetch_data.js`, `fetch_page.js`, and
  `handle_post.js`
- Edge case coverage including error handling, malformed input, and parameter
  extraction
- Mock strategies and logging functions for isolated testing
- Tests cover routing, YAML processing, template variables, data fetching, and
  POST handling
- 45 total tests passing across all modules

## Quick Reference for Agents

### File Permissions Required

```bash
deno run --allow-net --allow-read --allow-write --allow-env server.js
```

### Module Responsibilities

- `server.js`: HTTP server, routing orchestration
- `fetch_page.js`: File discovery, parameter extraction
- `fetch_data.js`: Data fetching orchestration, strategy management
- `handle_post.js`: POST request processing, form handling
- `render_page.js`: Template rendering with Handlebars
- `request_strategy.js`: HTTP request data fetching
- `sqlite_strategy.js`: SQLite database operations

### Common File Patterns

```
pages/[route]/index.html        # Page template
pages/[route]/get.yaml          # Data injection for GET
pages/[route]/post.yaml         # POST processing logic
templates/layouts/layout.hbs    # Main layout template
static/css/style.css           # Stylesheets
```

### Testing Commands

```bash
# All tests
deno test --allow-read --allow-write

# Specific module
deno test fetch_data.test.js

# With coverage
deno test --coverage
```

## Agent-Specific Guidance

### Development Workflow

#### 1. Making Changes to Core Modules

When modifying core modules (`fetch_data.js`, `fetch_page.js`,
`handle_post.js`):

```bash
# 1. Run relevant tests first to ensure baseline
deno test --allow-read --allow-write fetch_data.test.js

# 2. Make your changes
# 3. Run tests again to verify no regressions
deno test --allow-read --allow-write fetch_data.test.js

# 4. Run all tests to check integration
deno test --allow-read --allow-write

# 5. Start server and test manually
deno run --allow-net --allow-read --allow-write --allow-env server.js
```

#### 2. Adding New Features

1. **New Data Strategy**: Create strategy file, add to `dataStrategies` map in
   `server.js`
2. **New Route Types**: Modify `fetch_page.js` routing algorithm
3. **New Template Features**: Update `render_page.js` and add tests

#### 3. Debugging Common Issues

##### Routing Problems

```bash
# Check page discovery
deno test --allow-read fetch_page.test.js

# Manual test specific route
curl -v http://localhost:8000/your-test-route
```

##### YAML Processing Issues

```bash
# Check YAML parsing and template processing
deno test --allow-read --allow-write fetch_data.test.js

# Enable debug logging in server.js by setting DEBUG=true
DEBUG=true deno run --allow-net --allow-read --allow-write --allow-env server.js
```

##### Data Fetching Failures

```bash
# Test specific strategy
deno test --allow-read --allow-write fetch_data.test.js

# Check network permissions (ensure --allow-net is included)
deno run --allow-net --allow-read --allow-write --allow-env server.js
```

### Code Conventions

#### 1. Module Structure

```javascript
// Export single main function
export async function mainFunction(config, context) {
  // Implementation
}

// Export helper functions if needed (prefixed with _)
export function _helperFunction() {
  // Implementation
}
```

#### 2. JSDoc Documentation

```javascript
/**
 * Fetches data based on strategy configuration
 * @param {Object} config - Strategy configuration
 * @param {Object} context - Request context with params, query, etc.
 * @returns {Promise<any>} - Fetched data
 */
export async function fetchData(config, context) {
  // Implementation
}
```

#### 3. Error Handling

```javascript
// Always validate inputs
if (!config || typeof config !== "object") {
  throw new Error("Invalid config: must be an object");
}

// Handle async errors with try-catch
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  console.error("Operation failed:", error);
  throw error; // Re-throw for caller to handle
}
```

#### 4. Testing Patterns

```javascript
// Test file structure
Deno.test("Module Name - specific behavior", async () => {
  // Arrange
  const input = {/* test data */};
  const expected = {/* expected result */};

  // Act
  const result = await functionUnderTest(input);

  // Assert
  assertEquals(result, expected);
});

// Test error cases
Deno.test("Module Name - error handling", async () => {
  await assertRejects(
    () => functionUnderTest(invalidInput),
    Error,
    "Expected error message",
  );
});
```

### Common Development Tasks

#### Adding a New Page Type

1. Create directory in `/pages`
2. Add `index.html` and optional `get.yaml`/`post.yaml`
3. Add tests in `fetch_page.test.js` for new routing logic

#### Adding a New Data Strategy

1. Create strategy file following `request_strategy.js` pattern
2. Add comprehensive tests
3. Import in `server.js` and add to `dataStrategies` map
4. Update documentation

#### Fixing Performance Issues

1. Profile with `console.time()` around slow operations
2. Check for unnecessary file reads in loops
3. Consider caching in strategy implementations
4. Run tests to ensure no regressions

### Troubleshooting Guide

#### Server Won't Start

```bash
# Check Deno version
deno --version

# Check file permissions
ls -la server.js

# Verify dependencies
deno info deps.ts
```

#### Routes Not Working

1. Verify directory structure matches expected pattern
2. Check file permissions on pages directory
3. Ensure `index.html` exists in route directories
4. Test with `fetch_page.test.js`

#### Templates Not Rendering

1. Check Handlebars syntax in templates
2. Verify layout files exist in `/templates/layouts/`
3. Check data structure being passed to templates
4. Enable debug logging to see template context

#### Data Not Fetching

1. Verify `fetch_data` configuration in YAML
2. Check network connectivity for external APIs
3. Ensure proper permissions (`--allow-net`)
4. Test strategies individually with unit tests

#### POST Requests Failing

1. Verify `post.yaml` exists and is valid YAML
2. Check form data parsing logic in `handle_post.js`
3. Ensure POST endpoint has corresponding `index.html`
4. Test with form data from browser or curl

### Environment Setup

#### Development Environment

```bash
# Install Deno (if not already installed)
curl -fsSL https://deno.land/x/install/install.sh | sh

# Verify installation
deno --version

# Set up development permissions in shell
# Deno requires explicit permissions for security
alias dev-server="deno run --allow-net --allow-read --allow-write --allow-env server.js"
```

#### IDE Configuration

Recommended VS Code extensions:

- Deno language server
- Better Handlebars
- YAML support

Configure `.vscode/settings.json`:

```json
{
  "deno.enable": true,
  "deno.lint": true,
  "deno.unstable": false
}
```
