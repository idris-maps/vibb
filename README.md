# Deno Web Server with Handlebars

A file-based web server using Deno and Handlebars templating engine.

## Project Structure

```
fake-php/
├── server.ts              # Main server file
├── deps.ts               # Dependencies management
├── pages/                # Page directories with index.html files
│   ├── index.html       # Home page
│   └── about/
│       └── index.html   # About page
├── templates/            # Handlebars templates
│   ├── layouts/
│   │   └── layout.hbs   # Base layout template
│   └── partials/        # Partial templates
├── static/              # Static assets (CSS, JS, images)
│   └── css/
│       └── style.css    # Main stylesheet
├── README.md            # This file
└── .env                 # Environment variables (optional)
```

## Features

- File-based routing from `/pages` directory
- Handlebars templating with layouts
- Static file serving
- Environment configuration
- Hot reload (development)

## Getting Started

1. Start the server:
   ```bash
   deno run --allow-net --allow-read --allow-env server.ts
   ```

2. Visit `http://localhost:8000`

## Routing

- `/` → `pages/index.html`
- `/about` → `pages/about/index.html`
- `/[path]` → `pages/[path]/index.html`

## Templates

- Pages: `index.html` files in `/pages` directories
- Layouts: Handlebars templates in `/templates/layouts/`
- Partials: Handlebars templates in `/templates/partials/`
- Data: Optional `get.yaml` files alongside `index.html` for data injection
