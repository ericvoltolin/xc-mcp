import { simulatorCache } from '../../state/simulator-cache.js';
import { projectCache } from '../../state/project-cache.js';
import { responseCache } from '../../utils/response-cache.js';
import type { ToolResult } from '../../types/xcode.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

interface CacheStatsArgs {
  // No arguments needed
}

export async function getCacheStatsTool(args: any): Promise<ToolResult> {
  try {
    const simulatorStats = simulatorCache.getCacheStats();
    const projectStats = projectCache.getCacheStats();
    const responseStats = responseCache.getStats();

    const stats = {
      simulator: simulatorStats,
      project: projectStats,
      response: responseStats,
      timestamp: new Date().toISOString(),
    };

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(stats, null, 2),
        },
      ],
    };
  } catch (error) {
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to get cache stats: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

interface SetCacheConfigArgs {
  cacheType: 'simulator' | 'project' | 'response' | 'all';
  maxAgeMs?: number;
  maxAgeMinutes?: number;
  maxAgeHours?: number;
}

export async function setCacheConfigTool(args: any): Promise<ToolResult> {
  try {
    const { cacheType, maxAgeMs, maxAgeMinutes, maxAgeHours } = args as SetCacheConfigArgs;

    if (!['simulator', 'project', 'response', 'all'].includes(cacheType)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'cacheType must be one of: simulator, project, response, all'
      );
    }

    // Calculate max age in milliseconds
    let maxAge: number;
    if (maxAgeMs !== undefined) {
      maxAge = maxAgeMs;
    } else if (maxAgeMinutes !== undefined) {
      maxAge = maxAgeMinutes * 60 * 1000;
    } else if (maxAgeHours !== undefined) {
      maxAge = maxAgeHours * 60 * 60 * 1000;
    } else {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Must specify one of: maxAgeMs, maxAgeMinutes, or maxAgeHours'
      );
    }

    if (maxAge < 1000) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Cache max age must be at least 1000ms (1 second)'
      );
    }

    const results: Record<string, string> = {};

    if (cacheType === 'simulator' || cacheType === 'all') {
      simulatorCache.setCacheMaxAge(maxAge);
      results.simulator = `Set to ${formatDuration(maxAge)}`;
    }

    if (cacheType === 'project' || cacheType === 'all') {
      projectCache.setCacheMaxAge(maxAge);
      results.project = `Set to ${formatDuration(maxAge)}`;
    }

    if (cacheType === 'response' || cacheType === 'all') {
      // Note: responseCache doesn't have setCacheMaxAge yet, we'd need to implement it
      results.response = 'Response cache config is fixed at 30 minutes';
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              message: 'Cache configuration updated',
              results,
              timestamp: new Date().toISOString(),
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to set cache config: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

interface ClearCacheArgs {
  cacheType: 'simulator' | 'project' | 'response' | 'all';
}

export async function clearCacheTool(args: any): Promise<ToolResult> {
  try {
    const { cacheType } = args as ClearCacheArgs;

    if (!['simulator', 'project', 'response', 'all'].includes(cacheType)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'cacheType must be one of: simulator, project, response, all'
      );
    }

    const results: Record<string, string> = {};

    if (cacheType === 'simulator' || cacheType === 'all') {
      simulatorCache.clearCache();
      results.simulator = 'Cleared successfully';
    }

    if (cacheType === 'project' || cacheType === 'all') {
      projectCache.clearCache();
      results.project = 'Cleared successfully';
    }

    if (cacheType === 'response' || cacheType === 'all') {
      responseCache.clear();
      results.response = 'Cleared successfully';
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              message: 'Cache cleared successfully',
              results,
              timestamp: new Date().toISOString(),
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to clear cache: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

interface GetCacheConfigArgs {
  cacheType?: 'simulator' | 'project' | 'response' | 'all';
}

export async function getCacheConfigTool(args: any): Promise<ToolResult> {
  try {
    const { cacheType = 'all' } = args as GetCacheConfigArgs;

    if (!['simulator', 'project', 'response', 'all'].includes(cacheType)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'cacheType must be one of: simulator, project, response, all'
      );
    }

    const config: Record<string, any> = {};

    if (cacheType === 'simulator' || cacheType === 'all') {
      const maxAge = simulatorCache.getCacheMaxAge();
      config.simulator = {
        maxAgeMs: maxAge,
        maxAgeHuman: formatDuration(maxAge),
      };
    }

    if (cacheType === 'project' || cacheType === 'all') {
      const maxAge = projectCache.getCacheMaxAge();
      config.project = {
        maxAgeMs: maxAge,
        maxAgeHuman: formatDuration(maxAge),
      };
    }

    if (cacheType === 'response' || cacheType === 'all') {
      config.response = {
        maxAgeMs: 30 * 60 * 1000, // Fixed 30 minutes
        maxAgeHuman: '30m',
        note: 'Response cache duration is currently fixed',
      };
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              cacheConfiguration: config,
              timestamp: new Date().toISOString(),
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to get cache config: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}
