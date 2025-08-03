# XC-MCP: Xcode CLI MCP Server

A Model Context Protocol (MCP) server that provides structured access to Xcode command-line tools for iOS and macOS development workflows with intelligent progressive disclosure to prevent token overflow.

## 🚀 Proven Performance

**Real-world test results from production iOS app build:**
- ✅ **99.6% Token Reduction**: 135,229 tokens → 500 tokens  
- ⚡ **7.075s Build Time** with real-time feedback
- 🧠 **Smart Error Detection**: 1 warning automatically flagged and categorized
- 📊 **Progressive Disclosure**: Full 88KB build log cached for on-demand access

## Features

### Project Discovery & Information
- **xcodebuild-list**: Discover project structure, targets, schemes, and configurations
- **xcodebuild-showsdks**: List all available SDKs for development
- **xcodebuild-version**: Get Xcode and SDK version information

### Build & Compilation (with Smart Progressive Disclosure)
- **xcodebuild-build**: Build iOS/macOS projects with concise summaries and drill-down capability
- **xcodebuild-clean**: Clean build artifacts and derived data
- **xcodebuild-get-details**: Retrieve cached build logs, errors, warnings, or metadata

### iOS Simulator Management
- **simctl-list**: List available simulators, devices, and runtimes
- **simctl-boot**: Boot simulator devices with status monitoring
- **simctl-shutdown**: Gracefully shutdown simulators

### Cache Management & Progressive Disclosure
- **list-cached-responses**: View recent build/test results with summaries
- **Smart Response Caching**: Large outputs automatically cached with unique IDs
- **Token-Efficient Responses**: Concise summaries prevent MCP token limits
- **Drill-Down Pattern**: Progressive disclosure for detailed information

## 📈 Key Benefits

### Before XC-MCP
- ❌ Build logs exceeded MCP token limits (135k+ tokens)
- ❌ No structured error/warning extraction  
- ❌ All-or-nothing verbose output
- ❌ Manual command construction and escaping

### After XC-MCP
- ✅ **99.6% token reduction** with smart summaries
- ✅ **Instant feedback** with progressive drill-down
- ✅ **Structured error detection** and categorization
- ✅ **Secure command execution** with input validation
- ✅ **Guided workflows** with actionable next steps

## Installation

### Prerequisites
- macOS with Xcode command-line tools installed
- Node.js 18+ and npm
- Xcode 15+ recommended

### Install Xcode Command Line Tools
```bash
xcode-select --install
```

### Install Dependencies
```bash
npm install
```

### Build the Server
```bash
npm run build
```

## Usage

### Running the Server
```bash
npm start
```

### Development Mode
```bash
npm run dev
```

## Tool Usage Examples

### Project Discovery
```json
{
  "tool": "xcodebuild-list",
  "arguments": {
    "projectPath": "/path/to/MyApp.xcworkspace",
    "outputFormat": "json"
  }
}
```

### Building a Project (Smart Progressive Disclosure)
```json
{
  "tool": "xcodebuild-build",
  "arguments": {
    "projectPath": "/path/to/MyApp.xcworkspace",
    "scheme": "MyApp",
    "configuration": "Release",
    "destination": "platform=iOS Simulator,name=iPhone 15 Pro"
  }
}
```

**Successful Build Response (Real Example):**
```json
{
  "buildId": "fff6ec25-b5ad-4e0f-9c47-4c71819e51bd",
  "success": true,
  "summary": {
    "success": true,
    "errorCount": 0,
    "warningCount": 1,
    "duration": 7075,
    "target": "grapla",
    "buildSizeBytes": 89234
  },
  "nextSteps": [
    "✅ Build completed successfully in 7075ms",
    "Use 'xcodebuild-get-details' with buildId 'fff6ec25-b5ad-4e0f-9c47-4c71819e51bd' for full logs"
  ],
  "availableDetails": [
    "full-log", "errors-only", "warnings-only", "summary", "command"
  ]
}
```

**Failed Build Response (Example):**
```json
{
  "buildId": "abc-123-def",
  "success": false,
  "summary": {
    "success": false,
    "errorCount": 3,
    "warningCount": 1,
    "duration": 45000,
    "firstError": "Use of undeclared identifier 'invalidVariable'"
  },
  "nextSteps": [
    "❌ Build failed with 3 errors, 1 warnings",
    "First error: Use of undeclared identifier 'invalidVariable'",
    "Use 'xcodebuild-get-details' with buildId 'abc-123-def' for full logs and errors"
  ],
  "availableDetails": [
    "full-log", "errors-only", "warnings-only", "summary", "command"
  ]
}
```

### Getting Detailed Build Information
```json
{
  "tool": "xcodebuild-get-details",
  "arguments": {
    "buildId": "fff6ec25-b5ad-4e0f-9c47-4c71819e51bd",
    "detailType": "warnings-only",
    "maxLines": 50
  }
}
```

**Real Warning Response:**
```json
{
  "buildId": "fff6ec25-b5ad-4e0f-9c47-4c71819e51bd",
  "detailType": "warnings-only",
  "warningCount": 1,
  "warnings": [
    "note: Skipping duplicate AppIntents metadata extraction..."
  ],
  "truncated": false
}
```

### Cache Management
```json
{
  "tool": "list-cached-responses",
  "arguments": {
    "tool": "xcodebuild-build",
    "limit": 5
  }
}
```

### Managing Simulators
```json
{
  "tool": "simctl-list",
  "arguments": {
    "deviceType": "iPhone",
    "availability": "available"
  }
}
```

```json
{
  "tool": "simctl-boot",
  "arguments": {
    "deviceId": "ABCD1234-5678-90EF-GHIJ-KLMNOPQRSTUV",
    "waitForBoot": true
  }
}
```

## Configuration

### Environment Variables
- `XCODE_CLI_MCP_TIMEOUT`: Default timeout for operations (default: 300s)
- `XCODE_CLI_MCP_LOG_LEVEL`: Logging verbosity (error|warn|info|debug)

### MCP Client Configuration
Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "xc-mcp": {
      "command": "/path/to/xc-mcp/dist/index.js"
    }
  }
}
```

For Claude Desktop, add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

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

## Error Handling

The server provides structured error responses:

```json
{
  "error": "INVALID_PROJECT_PATH",
  "message": "Project file not found at path: /path/to/project.xcodeproj",
  "code": "E002"
}
```

Common error codes:
- `E001`: Xcode not found
- `E002`: Invalid project path
- `E003`: Build failed
- `E004`: Invalid device ID

## Security

- Input validation prevents path traversal attacks
- Command injection prevention through proper argument escaping
- File system permission validation
- Sandbox compatibility

## Development

### Project Structure
```
src/
├── index.ts                 # Main MCP server entry
├── tools/
│   ├── xcodebuild/         # Build-related tools
│   └── simctl/             # Simulator tools
├── utils/                  # Common utilities
├── validators/             # Input validation
└── types/                  # TypeScript type definitions
```

### Running Tests
```bash
npm test
```

### Linting
```bash
npm run lint
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- Check the [troubleshooting guide](XCODE_CLI_MCP_PLAN.md)
- Open an issue on GitHub
- Review the detailed implementation plan in `XCODE_CLI_MCP_PLAN.md`