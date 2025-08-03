import { validateDeviceId } from '../../utils/validation.js';
import { executeCommand, buildSimctlCommand } from '../../utils/command.js';
import type { ToolResult } from '../../types/xcode.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

interface SimctlShutdownToolArgs {
  deviceId: string;
}

export async function simctlShutdownTool(args: any) {
  const { deviceId } = args as SimctlShutdownToolArgs;

  try {
    // Validate inputs
    validateDeviceId(deviceId);

    // Build shutdown command
    const command = buildSimctlCommand('shutdown', { deviceId });

    console.error(`[simctl-shutdown] Executing: ${command}`);

    // Execute shutdown command
    const startTime = Date.now();
    const result = await executeCommand(command, { 
      timeout: 60000, // 1 minute for shutdown
    });
    const duration = Date.now() - startTime;

    let shutdownStatus = {
      success: result.code === 0,
      command,
      output: result.stdout,
      error: result.stderr,
      exitCode: result.code,
      duration,
    };

    // Handle common shutdown scenarios
    if (!shutdownStatus.success) {
      // Device already shutdown
      if (result.stderr.includes('Unable to shutdown device in current state: Shutdown')) {
        shutdownStatus = {
          ...shutdownStatus,
          success: true,
          error: 'Device was already shut down',
        };
      }
      // Invalid device ID
      else if (result.stderr.includes('Invalid device')) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Invalid device ID: ${deviceId}`
        );
      }
    }

    // Format response
    const responseText = JSON.stringify(shutdownStatus, null, 2);

    return {
      content: [
        {
          type: 'text' as const,
          text: responseText,
        },
      ],
      isError: !shutdownStatus.success,
    };
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `simctl-shutdown failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}