#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

// Import tool implementations
import { xcodebuildListTool } from './tools/xcodebuild/list.js';
import { xcodebuildBuildTool } from './tools/xcodebuild/build.js';
import { xcodebuildCleanTool } from './tools/xcodebuild/clean.js';
import { xcodebuildShowSDKsTool } from './tools/xcodebuild/showsdks.js';
import { xcodebuildVersionTool } from './tools/xcodebuild/version.js';
import { xcodebuildGetDetailsTool } from './tools/xcodebuild/get-details.js';
import { simctlListTool } from './tools/simctl/list.js';
import { simctlBootTool } from './tools/simctl/boot.js';
import { simctlShutdownTool } from './tools/simctl/shutdown.js';
import { listCachedResponsesTool } from './tools/cache/list-cached.js';
import { validateXcodeInstallation } from './utils/validation.js';

class XcodeCLIMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'xc-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          // Project Discovery Tools
          {
            name: 'xcodebuild-list',
            description: 'List targets, schemes, and configurations for an Xcode project or workspace',
            inputSchema: {
              type: 'object',
              properties: {
                projectPath: {
                  type: 'string',
                  description: 'Path to .xcodeproj or .xcworkspace file',
                },
                outputFormat: {
                  type: 'string',
                  enum: ['json', 'text'],
                  default: 'json',
                  description: 'Output format preference',
                },
              },
              required: ['projectPath'],
            },
          },
          {
            name: 'xcodebuild-showsdks',
            description: 'Show available SDKs for development',
            inputSchema: {
              type: 'object',
              properties: {
                outputFormat: {
                  type: 'string',
                  enum: ['json', 'text'],
                  default: 'json',
                  description: 'Output format preference',
                },
              },
            },
          },
          {
            name: 'xcodebuild-version',
            description: 'Get Xcode and SDK version information',
            inputSchema: {
              type: 'object',
              properties: {
                sdk: {
                  type: 'string',
                  description: 'Specific SDK to query (optional)',
                },
                outputFormat: {
                  type: 'string',
                  enum: ['json', 'text'],
                  default: 'json',
                  description: 'Output format preference',
                },
              },
            },
          },
          // Build Tools
          {
            name: 'xcodebuild-build',
            description: 'Build an Xcode project or workspace',
            inputSchema: {
              type: 'object',
              properties: {
                projectPath: {
                  type: 'string',
                  description: 'Path to .xcodeproj or .xcworkspace file',
                },
                scheme: {
                  type: 'string',
                  description: 'Build scheme name',
                },
                configuration: {
                  type: 'string',
                  default: 'Debug',
                  description: 'Build configuration (Debug, Release, etc.)',
                },
                destination: {
                  type: 'string',
                  description: 'Build destination (simulator, device, etc.)',
                },
                sdk: {
                  type: 'string',
                  description: 'SDK to use for building',
                },
                derivedDataPath: {
                  type: 'string',
                  description: 'Custom derived data path',
                },
              },
              required: ['projectPath', 'scheme'],
            },
          },
          {
            name: 'xcodebuild-clean',
            description: 'Clean build artifacts for an Xcode project',
            inputSchema: {
              type: 'object',
              properties: {
                projectPath: {
                  type: 'string',
                  description: 'Path to .xcodeproj or .xcworkspace file',
                },
                scheme: {
                  type: 'string',
                  description: 'Scheme to clean',
                },
                configuration: {
                  type: 'string',
                  description: 'Configuration to clean',
                },
              },
              required: ['projectPath', 'scheme'],
            },
          },
          {
            name: 'xcodebuild-get-details',
            description: 'Get detailed information from cached build results',
            inputSchema: {
              type: 'object',
              properties: {
                buildId: {
                  type: 'string',
                  description: 'Build ID from previous xcodebuild-build call',
                },
                detailType: {
                  type: 'string',
                  enum: ['full-log', 'errors-only', 'warnings-only', 'summary', 'command', 'metadata'],
                  description: 'Type of details to retrieve',
                },
                maxLines: {
                  type: 'number',
                  default: 100,
                  description: 'Maximum number of lines to return for logs',
                },
              },
              required: ['buildId', 'detailType'],
            },
          },
          // Simulator Tools
          {
            name: 'simctl-list',
            description: 'List available iOS simulators and devices',
            inputSchema: {
              type: 'object',
              properties: {
                deviceType: {
                  type: 'string',
                  description: 'Filter by device type (iPhone, iPad, etc.)',
                },
                runtime: {
                  type: 'string',
                  description: 'Filter by iOS runtime version',
                },
                availability: {
                  type: 'string',
                  enum: ['available', 'unavailable', 'all'],
                  default: 'available',
                  description: 'Filter by device availability',
                },
                outputFormat: {
                  type: 'string',
                  enum: ['json', 'text'],
                  default: 'json',
                  description: 'Output format preference',
                },
              },
            },
          },
          {
            name: 'simctl-boot',
            description: 'Boot an iOS simulator device',
            inputSchema: {
              type: 'object',
              properties: {
                deviceId: {
                  type: 'string',
                  description: 'Device UDID or "booted" for any booted device',
                },
                waitForBoot: {
                  type: 'boolean',
                  default: true,
                  description: 'Wait for device to finish booting',
                },
              },
              required: ['deviceId'],
            },
          },
          {
            name: 'simctl-shutdown',
            description: 'Shutdown iOS simulator devices',
            inputSchema: {
              type: 'object',
              properties: {
                deviceId: {
                  type: 'string',
                  description: 'Device UDID, "booted" for all booted devices, or "all" for all devices',
                },
              },
              required: ['deviceId'],
            },
          },
          // Cache Management Tools
          {
            name: 'list-cached-responses',
            description: 'List recent cached build/test results for progressive disclosure',
            inputSchema: {
              type: 'object',
              properties: {
                tool: {
                  type: 'string',
                  description: 'Filter by specific tool (optional)',
                },
                limit: {
                  type: 'number',
                  default: 10,
                  description: 'Maximum number of cached responses to return',
                },
              },
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Validate Xcode installation for all tools
        await validateXcodeInstallation();

        switch (name) {
          case 'xcodebuild-list':
            return await xcodebuildListTool(args);
          case 'xcodebuild-showsdks':
            return await xcodebuildShowSDKsTool(args);
          case 'xcodebuild-version':
            return await xcodebuildVersionTool(args);
          case 'xcodebuild-build':
            return await xcodebuildBuildTool(args);
          case 'xcodebuild-clean':
            return await xcodebuildCleanTool(args);
          case 'xcodebuild-get-details':
            return await xcodebuildGetDetailsTool(args);
          case 'simctl-list':
            return await simctlListTool(args);
          case 'simctl-boot':
            return await simctlBootTool(args);
          case 'simctl-shutdown':
            return await simctlShutdownTool(args);
          case 'list-cached-responses':
            return await listCachedResponsesTool(args);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  private setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Xcode CLI MCP server running on stdio');
  }
}

const server = new XcodeCLIMCPServer();
server.run().catch(console.error);