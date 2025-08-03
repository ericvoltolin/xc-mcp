import { validateProjectPath } from '../../utils/validation.js';
import { executeCommand, buildXcodebuildCommand } from '../../utils/command.js';
import type { XcodeProject, OutputFormat } from '../../types/xcode.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

interface ListToolArgs {
  projectPath: string;
  outputFormat?: OutputFormat;
}

export async function xcodebuildListTool(args: any) {
  const { projectPath, outputFormat = 'json' } = args as ListToolArgs;

  try {
    // Validate inputs
    await validateProjectPath(projectPath);

    // Build command
    const command = buildXcodebuildCommand('-list', projectPath, { 
      json: outputFormat === 'json' 
    });

    // Execute command
    const result = await executeCommand(command);

    if (result.code !== 0) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to list project information: ${result.stderr}`
      );
    }

    let responseText: string;

    if (outputFormat === 'json') {
      try {
        // Parse and format JSON response
        const projectInfo: XcodeProject = JSON.parse(result.stdout);
        responseText = JSON.stringify(projectInfo, null, 2);
      } catch (parseError) {
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to parse xcodebuild output: ${parseError}`
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
      `xcodebuild-list failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}