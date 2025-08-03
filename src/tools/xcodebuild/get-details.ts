import { responseCache } from '../../utils/response-cache.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

interface GetDetailsArgs {
  buildId: string;
  detailType: 'full-log' | 'errors-only' | 'warnings-only' | 'summary' | 'command' | 'metadata';
  maxLines?: number;
}

export async function xcodebuildGetDetailsTool(args: any) {
  const { buildId, detailType, maxLines = 100 } = args as GetDetailsArgs;

  try {
    if (!buildId) {
      throw new McpError(ErrorCode.InvalidParams, 'buildId is required');
    }

    const cached = responseCache.get(buildId);
    if (!cached) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Build ID '${buildId}' not found or expired. Use a recent build ID from xcodebuild-build.`
      );
    }

    let responseText: string;

    switch (detailType) {
      case 'full-log':
        const fullLog =
          cached.fullOutput + (cached.stderr ? '\n--- STDERR ---\n' + cached.stderr : '');
        const lines = fullLog.split('\n');
        if (lines.length > maxLines) {
          responseText = JSON.stringify(
            {
              buildId,
              detailType,
              totalLines: lines.length,
              showing: `Last ${maxLines} lines`,
              content: lines.slice(-maxLines).join('\n'),
              note: `Use maxLines parameter to see more. Total: ${lines.length} lines available.`,
            },
            null,
            2
          );
        } else {
          responseText = JSON.stringify(
            {
              buildId,
              detailType,
              totalLines: lines.length,
              content: fullLog,
            },
            null,
            2
          );
        }
        break;

      case 'errors-only':
        const allOutput = cached.fullOutput + '\n' + cached.stderr;
        const errorLines = allOutput
          .split('\n')
          .filter(
            line =>
              line.includes('error:') ||
              line.includes('** BUILD FAILED **') ||
              line.toLowerCase().includes('fatal error')
          );
        responseText = JSON.stringify(
          {
            buildId,
            detailType,
            errorCount: errorLines.length,
            errors: errorLines.slice(0, maxLines),
            truncated: errorLines.length > maxLines,
          },
          null,
          2
        );
        break;

      case 'warnings-only':
        const warningLines = (cached.fullOutput + '\n' + cached.stderr)
          .split('\n')
          .filter(line => line.includes('warning:'));
        responseText = JSON.stringify(
          {
            buildId,
            detailType,
            warningCount: warningLines.length,
            warnings: warningLines.slice(0, maxLines),
            truncated: warningLines.length > maxLines,
          },
          null,
          2
        );
        break;

      case 'summary':
        responseText = JSON.stringify(
          {
            buildId,
            detailType,
            ...cached.metadata,
            command: cached.command,
            exitCode: cached.exitCode,
            timestamp: cached.timestamp,
            tool: cached.tool,
          },
          null,
          2
        );
        break;

      case 'command':
        responseText = JSON.stringify(
          {
            buildId,
            detailType,
            command: cached.command,
            exitCode: cached.exitCode,
            executedAt: cached.timestamp,
          },
          null,
          2
        );
        break;

      case 'metadata':
        responseText = JSON.stringify(
          {
            buildId,
            detailType,
            metadata: cached.metadata,
            cacheInfo: {
              tool: cached.tool,
              timestamp: cached.timestamp,
              outputSize: cached.fullOutput.length,
              stderrSize: cached.stderr.length,
            },
          },
          null,
          2
        );
        break;

      default:
        throw new McpError(
          ErrorCode.InvalidParams,
          `Invalid detailType: ${detailType}. Must be one of: full-log, errors-only, warnings-only, summary, command, metadata`
        );
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
      `xcodebuild-get-details failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
