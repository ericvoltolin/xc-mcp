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
import { getCacheStatsTool, setCacheConfigTool, clearCacheTool, getCacheConfigTool } from './tools/cache/cache-management.js';
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
            description: `Build an Xcode project or workspace with intelligent defaults.

Features smart caching that remembers your last successful build configuration and suggests optimal simulators.

Examples:
- Basic build: {"projectPath": "./MyApp.xcodeproj", "scheme": "MyApp"}
- With simulator: {"projectPath": "./MyApp.xcworkspace", "scheme": "MyApp", "destination": "platform=iOS Simulator,name=iPhone 15"}
- Release build: {"projectPath": "./MyApp.xcodeproj", "scheme": "MyApp", "configuration": "Release"}

Common destinations:
- "platform=iOS Simulator,name=iPhone 15"
- "platform=iOS Simulator,name=iPad Air"
- "generic/platform=iOS" (for archive)
- "platform=iOS,id=<DEVICE_UDID>" (for device)

Use simctl-list to see available simulators.`,
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
                  description: 'Build destination. If not provided, uses intelligent defaults based on project history and available simulators.',
                },
                sdk: {
                  type: 'string',
                  description: 'SDK to use for building (e.g., "iphonesimulator", "iphoneos")',
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
            description: `List available iOS simulators and devices with intelligent caching.

Results are cached for 1 hour for faster performance. Shows recently used simulators first and includes performance metrics.

Examples:
- List all available simulators: {}
- Find iPhone simulators: {"deviceType": "iPhone"}
- iOS 17 simulators only: {"runtime": "17"}
- Show unavailable devices: {"availability": "unavailable"}

Device types: iPhone, iPad, Apple Watch, Apple TV
Runtime examples: "iOS 17.0", "17", "16.4"

Output includes:
- Device UDID (for use with simctl-boot, simctl-shutdown)
- Availability status and state
- Recently used indicators and performance metrics
- Boot history and reliability scores`,
            inputSchema: {
              type: 'object',
              properties: {
                deviceType: {
                  type: 'string',
                  description: 'Filter by device type (iPhone, iPad, Apple Watch, Apple TV)',
                },
                runtime: {
                  type: 'string',
                  description: 'Filter by iOS runtime version (e.g., "17", "iOS 17.0", "16.4")',
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
            description: `Boot an iOS simulator device with performance tracking.

Automatically tracks boot times and device performance metrics for optimization. Records usage patterns for intelligent device suggestions in future builds.

Examples:
- Boot specific device: {"deviceId": "A1B2C3D4-E5F6-7890-ABCD-EF1234567890"}
- Boot and wait: {"deviceId": "A1B2C3D4-E5F6-7890-ABCD-EF1234567890", "waitForBoot": true}
- Boot any device: {"deviceId": "booted"} (if already booted)

Get device UUIDs from simctl-list tool.
Boot times are recorded for performance optimization and device recommendations.`,
            inputSchema: {
              type: 'object',
              properties: {
                deviceId: {
                  type: 'string',
                  description: 'Device UDID (from simctl-list) or "booted" for any currently booted device',
                },
                waitForBoot: {
                  type: 'boolean',
                  default: true,
                  description: 'Wait for device to finish booting completely',
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
          {
            name: 'cache-get-stats',
            description: `Get comprehensive statistics about all cache systems (simulator, project, response).

Shows cache hit rates, expiry times, storage usage, and performance metrics across all caching layers.

Useful for:
- Monitoring cache effectiveness
- Debugging performance issues
- Understanding usage patterns
- Cache optimization decisions`,
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'cache-get-config',
            description: 'Get current cache configuration settings',
            inputSchema: {
              type: 'object',
              properties: {
                cacheType: {
                  type: 'string',
                  enum: ['simulator', 'project', 'response', 'all'],
                  default: 'all',
                  description: 'Which cache configuration to retrieve',
                },
              },
            },
          },
          {
            name: 'cache-set-config',
            description: `Configure cache maximum age settings. Default is 1 hour for simulator and project caches.

Examples:
- Set 30 minutes: {"cacheType": "all", "maxAgeMinutes": 30}
- Set 2 hours for simulators: {"cacheType": "simulator", "maxAgeHours": 2}  
- Set 5 minutes: {"cacheType": "project", "maxAgeMinutes": 5}

Common Workflow:
1. cache-get-stats → check current cache status
2. cache-set-config → adjust cache timeouts
3. cache-clear → force refresh when needed
4. Your normal xcodebuild/simctl operations (now faster!)`,
            inputSchema: {
              type: 'object',
              properties: {
                cacheType: {
                  type: 'string',
                  enum: ['simulator', 'project', 'response', 'all'],
                  description: 'Which cache to configure',
                },
                maxAgeMs: {
                  type: 'number',
                  description: 'Maximum cache age in milliseconds',
                },
                maxAgeMinutes: {
                  type: 'number',
                  description: 'Maximum cache age in minutes (alternative to maxAgeMs)',
                },
                maxAgeHours: {
                  type: 'number',
                  description: 'Maximum cache age in hours (alternative to maxAgeMs)',
                },
              },
              required: ['cacheType'],
            },
          },
          {
            name: 'cache-clear',
            description: 'Clear cached data to force fresh data retrieval',
            inputSchema: {
              type: 'object',
              properties: {
                cacheType: {
                  type: 'string',
                  enum: ['simulator', 'project', 'response', 'all'],
                  description: 'Which cache to clear',
                },
              },
              required: ['cacheType'],
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
          case 'cache-get-stats':
            return await getCacheStatsTool(args);
          case 'cache-get-config':
            return await getCacheConfigTool(args);
          case 'cache-set-config':
            return await setCacheConfigTool(args);
          case 'cache-clear':
            return await clearCacheTool(args);
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