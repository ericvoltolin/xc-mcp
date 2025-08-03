import { execSync } from 'child_process';
import { access, constants, stat } from 'fs/promises';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

export async function validateXcodeInstallation(): Promise<void> {
  try {
    execSync('which xcodebuild', { stdio: 'ignore' });
  } catch {
    throw new McpError(
      ErrorCode.InternalError,
      'Xcode command line tools not found. Please install with: xcode-select --install'
    );
  }
}

export async function validateProjectPath(projectPath: string): Promise<void> {
  try {
    await access(projectPath, constants.F_OK);
    const stats = await stat(projectPath);

    if (!stats.isDirectory()) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Project path is not a directory: ${projectPath}`
      );
    }

    const isXcodeProject =
      projectPath.endsWith('.xcodeproj') || projectPath.endsWith('.xcworkspace');
    if (!isXcodeProject) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid Xcode project path. Must end with .xcodeproj or .xcworkspace: ${projectPath}`
      );
    }
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InvalidParams,
      `Project path not found or inaccessible: ${projectPath}`
    );
  }
}

export function validateScheme(scheme: string): void {
  if (!scheme || scheme.trim().length === 0) {
    throw new McpError(ErrorCode.InvalidParams, 'Scheme name is required and cannot be empty');
  }
}

export function validateDeviceId(deviceId: string): void {
  if (!deviceId || deviceId.trim().length === 0) {
    throw new McpError(ErrorCode.InvalidParams, 'Device ID is required and cannot be empty');
  }
}

export function sanitizePath(path: string): string {
  // Basic path sanitization to prevent injection
  return path.replace(/[;&|`$(){}[\]]/g, '');
}

export function escapeShellArg(arg: string): string {
  // Escape shell arguments to prevent command injection
  return `"${arg.replace(/[\\$"`]/g, '\\$&')}"`;
}
