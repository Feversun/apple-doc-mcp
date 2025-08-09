# Rive Doc MCP

A Model Context Protocol (MCP) server that exposes the official [Rive](https://rive.app/docs) documentation to your AI assistant. It can list available documentation sections, fetch individual pages, search across the docs and check this repository for updates.

## Features
- **List documentation sections** via the `list_docs` tool.
- **Retrieve pages** with `get_documentation`.
- **Search the docs** using `search_docs`.
- **Check for repository updates** using `check_updates`.

## Installation
1. **Clone the repository**
   ```bash
   git clone https://github.com/MightyDillah/apple-doc-mcp.git
   cd apple-doc-mcp
   ```
2. **Install dependencies**
   ```bash
   npm install
   ```
3. **Build the server**
   ```bash
   npm run build
   ```

## Configure Your MCP Client
Add the server to your MCP configuration. Example:
```json
{
  "mcpServers": {
    "rive-doc-mcp": {
      "command": "node",
      "args": ["/path/to/apple-doc-mcp/dist/index.js"]
    }
  }
}
```
Replace `/path/to/apple-doc-mcp` with the absolute path to this project.

## Usage
After configuring and restarting your AI client you can issue natural language requests. Examples:
- "List Rive documentation sections"
- "Get documentation for getting-started/introduction"
- "Search Rive docs for state machine"

## Development
- `npm run build` – compile TypeScript
- `npm start` – run the server directly

## License
MIT
