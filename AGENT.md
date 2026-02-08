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
