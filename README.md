# Deno Web Server with Handlebars

A file-based web server using Deno and Handlebars templating with dynamic routing, data injection, and modular architecture.

## Project Structure

```
fake-php/
├── server.js                    # Main server file using Deno.serve
├── deps.ts                      # Dependencies management
├── fetch_data.js               # Data fetching orchestration
├── fetch_page.js               # Page content discovery and loading
├── handle_post.js              # POST request processing
├── render_page.js              # Template rendering logic
├── request_strategy.js         # HTTP request data strategy
├── sqlite_strategy.js          # SQLite database strategy
├── pages/                      # Page directories with index.html files
│   ├── index.html             # Home page
│   ├── about/index.html       # About page
│   ├── [userId]/index.html    # Parameterized page
│   ├── with-data/             # Page with YAML data injection
│   │   ├── index.html
│   │   └── get.yaml
│   ├── form/                  # Form with POST handling
│   │   ├── index.html
│   │   └── post.yaml
│   └── test/[id1]/x/[id2]/index.html # Nested parameters
├── templates/                  # Handlebars templates
│   ├── layouts/
│   │   └── layout.hbs         # Base layout template
│   └── partials/             # Partial templates
├── static/                    # Static assets
│   └── css/
│       └── style.css         # Main stylesheet
├── *.test.js                  # Unit tests for all modules
├── AGENT.md                   # Agent-specific documentation
└── README.md                  # This file
```

## Features

- **File-based routing** from `/pages` directory with automatic parameter extraction
- **URL parameters** using bracketed folder names `[paramName]`
- **Query parameter parsing** and injection
- **Handlebars templating** with layouts and partials
- **Data injection** via YAML files with Handlebars template processing
- **POST request handling** with form data processing
- **Data fetching system** with pluggable strategies (HTTP requests, SQLite)
- **Data sending system** for POST processing
- **Static file serving**
- **Comprehensive unit testing** (45 tests passing)
- **Modular architecture** with separate modules for each concern

## Getting Started

1. Start the server:
   ```bash
   deno run --allow-net --allow-read --allow-write --allow-env server.js
   ```

2. Visit `http://localhost:8000`

3. Run tests (optional):
   ```bash
   deno test --allow-read --allow-write
   ```

## Core Features

### File-Based Routing

- Routes based on directory structure in `/pages`
- Each directory must contain `index.html`
- URL path maps to directory path: `/about` → `pages/about/index.html`
- Priority: exact matches > parameterized matches

### URL Parameters

- Bracketed folder names `[paramName]` capture URL segments
- Example: `pages/[userId]/index.html` matches `/123`
- Parameters injected as `{ params: { userId: '123' } }`
- Supports nested parameters: `pages/test/[id1]/x/[id2]/index.html`

### Query Parameters

- URL query strings parsed and injected
- Example: `/123?name=Alice` → `{ query: { name: 'Alice' } }`
- Combined with params: `{ params: { userId: '123' }, query: { name: 'Alice' } }`

### POST Request Handling

- POST requests only allowed for endpoints with `post.yaml` in same directory
- Form data parsed from JSON, URL-encoded, or multipart formats
- `post.yaml` processed with Handlebars templates using `params`, `query`, and `formData`
- Returns JSON responses instead of HTML
- Security: Only accepts POST from same endpoint as `index.html`

### Data Injection via YAML

- Optional `get.yaml` files alongside `index.html`
- YAML processed as Handlebars template before parsing
- Variables available: `{{params.*}}` and `{{query.*}}`
- Final data merged: `{ ...yamlData, params, query }`

### Data Fetching System

- `fetch_data` key in YAML triggers data fetching
- Supports multiple data strategies:
  - **HTTP requests**: Fetch data from external APIs
  - **SQLite**: Query local database
- Pluggable strategy system for adding new data sources

## Templates

- **Pages**: `index.html` files in `/pages` directories
- **Layouts**: Handlebars templates in `/templates/layouts/`
- **Partials**: Handlebars templates in `/templates/partials/`
- **Data**: Optional `get.yaml` files alongside `index.html` for data injection
- **POST**: Optional `post.yaml` files for POST handling

## Development

### Testing

```bash
# Run all tests
deno test --allow-read --allow-write

# Run specific test file
deno test --allow-read --allow-write fetch_data.test.js
deno test --allow-read fetch_page.test.js
deno test --allow-read --allow-write handle_post.test.js
```

### Adding New Data Strategies

1. Create strategy file (e.g., `my_strategy.js`)
2. Export async function implementing the strategy
3. Import in `server.js`
4. Add to `dataStrategies` map

## Example Usage

See `AGENT.md` for detailed examples and API documentation.
