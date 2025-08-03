import { executeCommand } from '../../utils/command.js';
import type { ToolResult, OutputFormat } from '../../types/xcode.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

interface ShowSDKsToolArgs {
  outputFormat?: OutputFormat;
}

export async function xcodebuildShowSDKsTool(args: any) {
  const { outputFormat = 'json' } = args as ShowSDKsToolArgs;

  try {
    // Build command
    const command = outputFormat === 'json' ? 'xcodebuild -showsdks -json' : 'xcodebuild -showsdks';

    // Execute command
    const result = await executeCommand(command);

    if (result.code !== 0) {
      throw new McpError(ErrorCode.InternalError, `Failed to show SDKs: ${result.stderr}`);
    }

    let responseText: string;

    if (outputFormat === 'json') {
      try {
        // Parse and format JSON response
        const sdkInfo = JSON.parse(result.stdout);
        responseText = JSON.stringify(sdkInfo, null, 2);
      } catch (parseError) {
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to parse xcodebuild -showsdks output: ${parseError}`
        );
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
      `xcodebuild-showsdks failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
