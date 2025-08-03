import { randomUUID } from 'crypto';

export interface CachedResponse {
  id: string;
  tool: string;
  timestamp: Date;
  fullOutput: string;
  stderr: string;
  exitCode: number;
  command: string;
  metadata: Record<string, any>;
}

class ResponseCache {
  private cache = new Map<string, CachedResponse>();
  private readonly maxAge = 1000 * 60 * 30; // 30 minutes
  private readonly maxEntries = 100;

  store(data: Omit<CachedResponse, 'id' | 'timestamp'>): string {
    const id = randomUUID();
    const cached: CachedResponse = {
      ...data,
      id,
      timestamp: new Date(),
    };

    this.cache.set(id, cached);
    this.cleanup();
    return id;
  }

  get(id: string): CachedResponse | undefined {
    const cached = this.cache.get(id);
    if (!cached) return undefined;

    // Check if expired
    if (Date.now() - cached.timestamp.getTime() > this.maxAge) {
      this.cache.delete(id);
      return undefined;
    }

    return cached;
  }

  getRecentByTool(tool: string, limit = 5): CachedResponse[] {
    return Array.from(this.cache.values())
      .filter(c => c.tool === tool)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  delete(id: string): boolean {
    return this.cache.delete(id);
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    // Remove expired entries
    const now = Date.now();
    for (const [id, cached] of this.cache) {
      if (now - cached.timestamp.getTime() > this.maxAge) {
        this.cache.delete(id);
      }
    }

    // Remove oldest entries if over limit
    if (this.cache.size > this.maxEntries) {
      const entries = Array.from(this.cache.entries()).sort(
        ([, a], [, b]) => a.timestamp.getTime() - b.timestamp.getTime()
      );

      const toRemove = entries.slice(0, this.cache.size - this.maxEntries);
      for (const [id] of toRemove) {
        this.cache.delete(id);
      }
    }
  }

  getStats(): { totalEntries: number; byTool: Record<string, number> } {
    const byTool: Record<string, number> = {};
    for (const cached of this.cache.values()) {
      byTool[cached.tool] = (byTool[cached.tool] || 0) + 1;
    }

    return {
      totalEntries: this.cache.size,
      byTool,
    };
  }
}

// Global cache instance
export const responseCache = new ResponseCache();

// Helper functions for common response patterns
export function extractBuildSummary(output: string, stderr: string, exitCode: number) {
  const lines = (output + '\n' + stderr).split('\n');

  // Extract key metrics
  const errors = lines.filter(
    line => line.includes('error:') || line.includes('** BUILD FAILED **')
  );

  const warnings = lines.filter(line => line.includes('warning:'));

  // Look for build success indicator
  const successIndicators = lines.filter(
    line => line.includes('** BUILD SUCCEEDED **') || line.includes('Build completed')
  );

  // Extract timing info if available
  const timingMatch = output.match(/Total time: (\d+\.\d+) seconds/);
  const duration = timingMatch ? parseFloat(timingMatch[1]) : undefined;

  // Extract target/scheme info
  const targetMatch = output.match(/Building target (.+?) with configuration/);
  const target = targetMatch ? targetMatch[1] : undefined;

  return {
    success: exitCode === 0 && successIndicators.length > 0,
    exitCode,
    errorCount: errors.length,
    warningCount: warnings.length,
    duration,
    target,
    hasErrors: errors.length > 0,
    hasWarnings: warnings.length > 0,
    firstError: errors[0]?.trim(),
    buildSizeBytes: output.length + stderr.length,
  };
}

export function extractTestSummary(output: string, stderr: string, exitCode: number) {
  const lines = (output + '\n' + stderr).split('\n');

  // Extract test results
  const testResults = lines.filter(
    line =>
      line.includes('Test Suite') ||
      line.includes('executed') ||
      line.includes('passed') ||
      line.includes('failed')
  );

  // Look for test completion
  const completionMatch = output.match(/Test Suite .+ (passed|failed)/);
  const passed = completionMatch?.[1] === 'passed';

  // Extract test counts
  const testsRun = (output.match(/(\d+) tests?/g) || [])
    .map(match => parseInt(match.match(/(\d+)/)?.[1] || '0'))
    .reduce((sum, count) => sum + count, 0);

  return {
    success: exitCode === 0 && passed,
    exitCode,
    testsRun,
    passed: passed ?? false,
    resultSummary: testResults.slice(-3), // Last few result lines
  };
}
