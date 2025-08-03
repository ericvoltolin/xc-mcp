import { responseCache } from '../../utils/response-cache.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

interface ListCachedArgs {
  tool?: string;
  limit?: number;
}

export async function listCachedResponsesTool(args: any) {
  const { tool, limit = 10 } = args as ListCachedArgs;

  try {
    const stats = responseCache.getStats();

    let recentResponses;
    if (tool) {
      recentResponses = responseCache.getRecentByTool(tool, limit);
    } else {
      // Get recent from all tools
      const allTools = Object.keys(stats.byTool);
      recentResponses = allTools
        .flatMap(toolName =>
          responseCache.getRecentByTool(toolName, Math.ceil(limit / allTools.length))
        )
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, limit);
    }

    const responseData = {
      cacheStats: stats,
      recentResponses: recentResponses.map(cached => ({
        id: cached.id,
        tool: cached.tool,
        timestamp: cached.timestamp,
        exitCode: cached.exitCode,
        outputSize: cached.fullOutput.length,
        stderrSize: cached.stderr.length,
        summary: cached.metadata.summary || {},
        projectPath: cached.metadata.projectPath,
        scheme: cached.metadata.scheme,
      })),
      usage: {
        totalCached: stats.totalEntries,
        availableTools: Object.keys(stats.byTool),
        note: 'Use xcodebuild-get-details with any ID to retrieve full details',
      },
    };

    const responseText = JSON.stringify(responseData, null, 2);

    return {
      content: [
        {
          type: 'text' as const,
          text: responseText,
        },
      ],
    };
  } catch (error) {
    throw new McpError(
      ErrorCode.InternalError,
      `list-cached-responses failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
