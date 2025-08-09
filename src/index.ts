#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { RiveDocsClient } from './rive-client.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class RiveDocsMcpServer {
  private server: Server;
  private client: RiveDocsClient;

  constructor() {
    this.server = new Server(
      {
        name: 'rive-docs-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.client = new RiveDocsClient();
    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'list_docs',
          description: 'List top-level sections in the Rive documentation',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
        {
          name: 'get_documentation',
          description: 'Get a Rive documentation page by path',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Documentation path like "getting-started/introduction"',
              },
            },
            required: ['path'],
          },
        },
        {
          name: 'search_docs',
          description: 'Search Rive documentation for a text query',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search text' },
              maxResults: {
                type: 'number',
                description: 'Maximum results to return (default: 20)',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'check_updates',
          description: 'Check for available updates from the git repository',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case 'list_docs':
            return await this.handleListDocs();
          case 'get_documentation':
            return await this.handleGetDocumentation(request.params.arguments);
          case 'search_docs':
            return await this.handleSearchDocs(request.params.arguments);
          case 'check_updates':
            return await this.handleCheckUpdates();
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Error executing tool: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  private async handleListDocs() {
    const paths = await this.client.getSitemap();
    const sections: Record<string, number> = {};
    paths.forEach((p) => {
      const first = p.split('/')[0];
      if (first) sections[first] = (sections[first] || 0) + 1;
    });

    const content = ['# Rive Documentation Sections'];
    Object.entries(sections).forEach(([name, count]) => {
      content.push(`• **${name}** - ${count} pages`);
    });

    return {
      content: [
        {
          type: 'text',
          text: content.join('\n'),
        },
      ],
    };
  }

  private async handleGetDocumentation(args: any) {
    const { path } = args;
    const page = await this.client.getPage(path);
    const text = [`# ${page.title}`, page.content].join('\n');
    return {
      content: [
        {
          type: 'text',
          text,
        },
      ],
    };
  }

  private async handleSearchDocs(args: any) {
    const { query, maxResults = 20 } = args;
    const results = await this.client.search(query, maxResults);

    const content = [
      `# Search Results for "${query}"`,
      `**Found:** ${results.length} results`,
      '',
    ];

    results.forEach((r, i) => {
      content.push(`### ${i + 1}. ${r.title}`);
      content.push(`**Path:** \`${r.path}\``);
      if (r.snippet) content.push(r.snippet);
      content.push('');
    });

    if (results.length === 0) {
      content.push('No results found');
    } else {
      content.push('*Use `get_documentation` with any path above to see the full page*');
    }

    return {
      content: [
        {
          type: 'text',
          text: content.join('\n'),
        },
      ],
    };
  }

  private async handleCheckUpdates() {
    try {
      await execAsync('git fetch origin');
      const { stdout: currentBranch } = await execAsync('git branch --show-current');
      const branch = currentBranch.trim();
      const { stdout: behind } = await execAsync(`git rev-list --count HEAD..origin/${branch}`);
      const { stdout: ahead } = await execAsync(`git rev-list --count origin/${branch}..HEAD`);
      const behindCount = parseInt(behind.trim());
      const aheadCount = parseInt(ahead.trim());
      const { stdout: localCommit } = await execAsync('git log -1 --format="%h %s (%an, %ar)"');
      const { stdout: remoteCommit } = await execAsync(`git log -1 --format="%h %s (%an, %ar)" origin/${branch}`);

      let status = '';
      let icon = '';

      if (behindCount === 0 && aheadCount === 0) {
        status = 'Up to date';
        icon = '✅';
      } else if (behindCount > 0 && aheadCount === 0) {
        status = `${behindCount} update${behindCount > 1 ? 's' : ''} available`;
        icon = '🔄';
      } else if (behindCount === 0 && aheadCount > 0) {
        status = `${aheadCount} local change${aheadCount > 1 ? 's' : ''} ahead`;
        icon = '🚀';
      } else {
        status = `${behindCount} update${behindCount > 1 ? 's' : ''} available, ${aheadCount} local change${aheadCount > 1 ? 's' : ''} ahead`;
        icon = '⚡';
      }

      const content = [
        `# ${icon} Git Repository Status\n`,
        `**Branch:** ${branch}`,
        `**Status:** ${status}\n`,
        `## Current State`,
        `**Local commit:** ${localCommit.trim()}`,
        `**Remote commit:** ${remoteCommit.trim()}\n`,
      ];

      if (behindCount > 0) {
        content.push(`## 💡 Available Updates`);
        content.push(`There ${behindCount === 1 ? 'is' : 'are'} **${behindCount}** new commit${behindCount > 1 ? 's' : ''} available.`);
        content.push(`**To update:** Run \`git pull origin ${branch}\` in your terminal, then restart the MCP server.\n`);
      }

      if (aheadCount > 0) {
        content.push(`## 🚀 Local Changes`);
        content.push(`You have **${aheadCount}** local commit${aheadCount > 1 ? 's' : ''} that haven't been pushed.`);
        content.push(`**To share:** Run \`git push origin ${branch}\` in your terminal.\n`);
      }

      if (behindCount === 0 && aheadCount === 0) {
        content.push(`## 🎉 All Good!`);
        content.push(`Your local repository is in sync with the remote repository.`);
      }

      return {
        content: [
          {
            type: 'text',
            text: content.join('\n'),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: [
              `# ❌ Git Update Check Failed\n`,
              `Unable to check for updates from the git repository.`,
              `\n**Error:** ${error instanceof Error ? error.message : String(error)}`,
              `\n**Common Issues:**`,
              `• Not in a git repository`,
              `• No internet connection`,
              `• Git not installed or configured`,
              `• Repository access issues`,
            ].join('\n'),
          },
        ],
      };
    }
  }

  private async checkAndDisplayUpdates() {
    try {
      await execAsync('git fetch origin', { timeout: 5000 });
      const { stdout: currentBranch } = await execAsync('git branch --show-current');
      const branch = currentBranch.trim();
      const { stdout: behind } = await execAsync(`git rev-list --count HEAD..origin/${branch}`);
      const behindCount = parseInt(behind.trim());
      if (behindCount > 0) {
        console.error(`🔄 ${behindCount} update${behindCount > 1 ? 's' : ''} available! Use 'check_updates' tool for details and update instructions.`);
      }
    } catch {
      // silent
    }
  }

  async run() {
    await this.checkAndDisplayUpdates();
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Rive Documentation MCP server running on stdio');
  }
}

const server = new RiveDocsMcpServer();
server.run().catch(console.error);
