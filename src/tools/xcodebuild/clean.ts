import { validateProjectPath, validateScheme } from '../../utils/validation.js';
import { executeCommand, buildXcodebuildCommand } from '../../utils/command.js';
import type { ToolResult } from '../../types/xcode.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

interface CleanToolArgs {
  projectPath: string;
  scheme: string;
  configuration?: string;
}

export async function xcodebuildCleanTool(args: any) {
  const { 
    projectPath, 
    scheme, 
    configuration 
  } = args as CleanToolArgs;

  try {
    // Validate inputs
    await validateProjectPath(projectPath);
    validateScheme(scheme);

    // Build command
    const command = buildXcodebuildCommand('clean', projectPath, {
      scheme,
      configuration,
    });

    console.error(`[xcodebuild-clean] Executing: ${command}`);

    // Execute command
    const startTime = Date.now();
    const result = await executeCommand(command, { 
      timeout: 180000, // 3 minutes for clean
    });
    const duration = Date.now() - startTime;

    // Format response
    const responseText = JSON.stringify({
      success: result.code === 0,
      command,
      duration,
      output: result.stdout,
      error: result.stderr,
      exitCode: result.code,
    }, null, 2);

    return {
      content: [
        {
          type: 'text' as const,
          text: responseText,
        },
      ],
      isError: result.code !== 0,
    };
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `xcodebuild-clean failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}