import { executeCommand } from '../../utils/command.js';
import type { ToolResult, OutputFormat } from '../../types/xcode.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

interface VersionToolArgs {
  sdk?: string;
  outputFormat?: OutputFormat;
}

export async function xcodebuildVersionTool(args: any) {
  const { sdk, outputFormat = 'json' } = args as VersionToolArgs;

  try {
    // Build command
    let command = 'xcodebuild -version';
    
    if (sdk) {
      command += ` -sdk ${sdk}`;
    }
    
    if (outputFormat === 'json') {
      command += ' -json';
    }

    // Execute command
    const result = await executeCommand(command);

    if (result.code !== 0) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get version information: ${result.stderr}`
      );
    }

    let responseText: string;

    if (outputFormat === 'json') {
      try {
        // Parse and format JSON response
        const versionInfo = JSON.parse(result.stdout);
        responseText = JSON.stringify(versionInfo, null, 2);
      } catch (parseError) {
        // If JSON parsing fails, the output might be plain text
        // This can happen with older Xcode versions
        responseText = JSON.stringify({ 
          version: result.stdout,
          format: 'text' 
        }, null, 2);
      }
    } else {
      responseText = result.stdout;
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: responseText,
        },
      ],
    };
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `xcodebuild-version failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}