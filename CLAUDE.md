# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

XC-MCP is a Model Context Protocol (MCP) server that provides intelligent access to Xcode command-line tools with advanced caching and progressive disclosure features. It wraps `xcodebuild` and `simctl` commands to solve token overflow issues while maintaining full functionality.

## Development Commands

### Build and Development
- **npm run build** - Compile TypeScript to JavaScript in `dist/`
- **npm run dev** - Development mode with TypeScript watch compilation
- **npm start** - Start the MCP server from compiled JavaScript
- **npm run clean** - Remove `dist/` build artifacts

### Code Quality
- **npm run lint** - Run ESLint on TypeScript source files
- **npm run lint:fix** - Auto-fix ESLint issues where possible
- **npm run format** - Format code with Prettier
- **npm run format:check** - Check code formatting without making changes
- **npm test** - Run Jest test suite

### MCP Server Testing
- **node dist/index.js** - Run the MCP server directly after building
- Use stdio transport for MCP client testing

## Architecture Overview

### Core Components
- **src/index.ts** - Main MCP server with tool registration and request routing
- **src/tools/** - Tool implementations organized by command category:
  - `xcodebuild/` - Build, clean, list, version tools with intelligent defaults
  - `simctl/` - Simulator management with progressive disclosure
  - `cache/` - Cache management and statistics tools
- **src/state/** - Intelligent caching system:
  - `simulator-cache.ts` - Simulator state with usage tracking and performance metrics
  - `project-cache.ts` - Project configuration memory and build history
- **src/utils/** - Shared utilities for command execution and validation
- **src/types/** - TypeScript definitions for Xcode data structures

### Key Architectural Features
- **Progressive Disclosure**: Returns concise summaries by default, full details on demand via cache IDs
- **Intelligent Caching**: 3-layer cache system (simulator, project, response) with smart invalidation
- **Performance Tracking**: Boot times, build metrics, and usage patterns for optimization
- **Smart Defaults**: Learns from successful builds and suggests optimal configurations

### Cache System Design
- **SimulatorCache**: 1-hour default retention, tracks device usage and boot performance
- **ProjectCache**: Remembers successful build configurations per project
- **ResponseCache**: 30-minute retention for progressive disclosure of large outputs
- All caches support configurable timeouts and selective clearing

### Tool Response Pattern
Tools return structured responses with:
- **Success indicators** and error handling
- **Cache IDs** for progressive disclosure when outputs exceed token limits
- **Smart recommendations** based on usage history
- **Performance metrics** for optimization insights

## Development Guidelines

### Code Style
- Uses ESLint + Prettier with TypeScript configuration
- 100-character line width, 2-space indentation, single quotes
- ES2020+ features with Node.js environment targeting

### Error Handling
- All tools validate Xcode installation before execution
- Proper async/await patterns with comprehensive error catching
- MCP-compliant error responses with appropriate error codes

### Cache Management
- Cache validity checks based on file modification times
- Configurable cache timeouts via tool parameters
- Graceful degradation when caches are invalid or missing

### Progressive Disclosure Implementation
- Large command outputs (>token limits) automatically cached with unique IDs
- Summary responses provide key information upfront
- Detail retrieval tools allow drilling down into cached full outputs
- Smart filtering and pagination for large datasets

## Testing and Quality Assurance

### Pre-commit Requirements
- All TypeScript must compile without errors
- ESLint must pass with no errors (warnings acceptable)
- Prettier formatting must be applied
- Tests must pass before commits

### Xcode Environment Dependencies
- Requires macOS with Xcode command-line tools installed
- Tools validate Xcode installation on startup
- Compatible with Xcode 15+ and iOS simulators

## MCP Integration

### Server Configuration
- Uses `@modelcontextprotocol/sdk` for MCP protocol compliance
- Stdio transport for Claude Desktop integration
- Tool schema definitions with comprehensive parameter validation

### Client Setup Example
```json
{
  "mcpServers": {
    "xc-mcp": {
      "command": "node",
      "args": ["/path/to/xc-mcp/dist/index.js"]
    }
  }
}
```

### Tool Categories
- **Project Discovery**: `xcodebuild-list`, `xcodebuild-showsdks`, `xcodebuild-version`
- **Build Operations**: `xcodebuild-build`, `xcodebuild-clean`, `xcodebuild-get-details`
- **Simulator Management**: `simctl-list`, `simctl-get-details`, `simctl-boot`, `simctl-shutdown`
- **Cache Management**: `cache-get-stats`, `cache-set-config`, `cache-clear`, `list-cached-responses`