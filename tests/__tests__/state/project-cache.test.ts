import { jest } from '@jest/globals';

// Mock fs module completely
const mockStat = jest.fn() as jest.MockedFunction<any>;
const mockReadFile = jest.fn() as jest.MockedFunction<any>;

jest.mock('fs', () => ({
  promises: {
    stat: mockStat,
    readFile: mockReadFile,
  },
}));

jest.mock('path', () => ({
  join: (...parts: string[]) => parts.join('/'),
  dirname: (path: string) => path.split('/').slice(0, -1).join('/') || '/',
}));

import { ProjectCache, BuildConfig, BuildMetrics } from '../../../src/state/project-cache.js';
import { XcodeProject } from '../../../src/types/xcode.js';

jest.mock('../../../src/utils/command.js', () => ({
  executeCommand: jest.fn(),
  buildXcodebuildCommand: jest.fn(),
}));

import { executeCommand, buildXcodebuildCommand } from '../../../src/utils/command.js';
const mockExecuteCommand = executeCommand as jest.MockedFunction<typeof executeCommand>;
const mockBuildXcodebuildCommand = buildXcodebuildCommand as jest.MockedFunction<
  typeof buildXcodebuildCommand
>;

describe('ProjectCache', () => {
  let cache: ProjectCache;

  // Mock project data
  const mockXcodeProject: XcodeProject = {
    information: {
      LastUpgradeCheck: '1500',
    },
    project: {
      configurations: ['Debug', 'Release'],
      name: 'MyApp',
      schemes: ['MyApp', 'MyAppTests'],
      targets: ['MyApp', 'MyAppTests'],
    },
  };

  const mockWorkspaceProject: XcodeProject = {
    information: {
      LastUpgradeCheck: '1500',
    },
    workspace: {
      name: 'MyWorkspace',
      schemes: ['MyWorkspace', 'MyWorkspaceTests'],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    cache = new ProjectCache();

    // Setup default mocks
    mockBuildXcodebuildCommand.mockReturnValue('xcodebuild -project MyApp.xcodeproj -list -json');
    mockExecuteCommand.mockResolvedValue({
      code: 0,
      stdout: JSON.stringify(mockXcodeProject),
      stderr: '',
    });

    mockStat.mockResolvedValue({
      mtime: new Date('2023-12-01T10:00:00Z'),
    });
  });

  describe('cache management', () => {
    it('should set and get cache max age', () => {
      const maxAge = 30 * 60 * 1000; // 30 minutes
      cache.setCacheMaxAge(maxAge);
      expect(cache.getCacheMaxAge()).toBe(maxAge);
    });

    it('should clear all cache data', () => {
      cache.setCacheMaxAge(5000);

      // Add some data to cache (we can't directly access private members, so we do it through methods)
      const buildConfig: BuildConfig = {
        scheme: 'MyApp',
        configuration: 'Debug',
      };

      const buildMetrics: Omit<BuildMetrics, 'config'> = {
        timestamp: new Date(),
        success: true,
        duration: 1000,
        errorCount: 0,
        warningCount: 2,
        buildSizeBytes: 1024,
      };

      cache.recordBuildResult('/test/project', buildConfig, buildMetrics);

      cache.clearCache();

      // Cache should be empty - getBuildHistory should return empty array
      expect(cache.getBuildHistory('/test/project')).toHaveLength(0);
    });
  });

  describe('getProjectInfo', () => {
    it('should fetch and cache project info for .xcodeproj', async () => {
      const projectPath = '/path/to/MyApp.xcodeproj';

      const result = await cache.getProjectInfo(projectPath);

      expect(mockBuildXcodebuildCommand).toHaveBeenCalledWith('list', projectPath, { json: true });
      expect(mockExecuteCommand).toHaveBeenCalledWith(
        'xcodebuild -project MyApp.xcodeproj -list -json'
      );
      expect(result.path).toBe(projectPath);
      expect(result.projectData).toEqual(mockXcodeProject);
      expect(result.lastModified).toEqual(new Date('2023-12-01T10:00:00Z'));
    });

    it('should fetch project info for .xcworkspace', async () => {
      const projectPath = '/path/to/MyWorkspace.xcworkspace';

      mockExecuteCommand.mockResolvedValueOnce({
        code: 0,
        stdout: JSON.stringify(mockWorkspaceProject),
        stderr: '',
      });

      const result = await cache.getProjectInfo(projectPath);

      expect(mockBuildXcodebuildCommand).toHaveBeenCalledWith('list', projectPath, {
        workspace: true,
        json: true,
      });
      expect(result.projectData).toEqual(mockWorkspaceProject);
    });

    it('should return cached data on subsequent calls', async () => {
      const projectPath = '/path/to/MyApp.xcodeproj';

      // First call
      await cache.getProjectInfo(projectPath);
      expect(mockExecuteCommand).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await cache.getProjectInfo(projectPath);
      expect(mockExecuteCommand).toHaveBeenCalledTimes(1);
    });

    it('should force refresh when requested', async () => {
      const projectPath = '/path/to/MyApp.xcodeproj';

      // First call
      await cache.getProjectInfo(projectPath);
      expect(mockExecuteCommand).toHaveBeenCalledTimes(1);

      // Force refresh
      await cache.getProjectInfo(projectPath, true);
      expect(mockExecuteCommand).toHaveBeenCalledTimes(2);
    });

    it('should handle command execution errors', async () => {
      const projectPath = '/path/to/MyApp.xcodeproj';

      mockExecuteCommand.mockResolvedValueOnce({
        code: 1,
        stdout: '',
        stderr: 'Project not found',
      });

      await expect(cache.getProjectInfo(projectPath)).rejects.toThrow(
        'Failed to get project info: Project not found'
      );
    });

    it('should normalize project paths', async () => {
      const projectPath = '/path/to/MyApp.xcodeproj/';
      const normalizedPath = '/path/to/MyApp.xcodeproj';

      await cache.getProjectInfo(projectPath);

      // The normalized path should be used internally
      // We can verify this by calling again with the normalized path and checking it uses cache
      await cache.getProjectInfo(normalizedPath);
      expect(mockExecuteCommand).toHaveBeenCalledTimes(1);
    });

    it('should invalidate cache when project file is modified', async () => {
      const projectPath = '/path/to/MyApp.xcodeproj';

      // First call
      await cache.getProjectInfo(projectPath);
      expect(mockExecuteCommand).toHaveBeenCalledTimes(1);

      // Mock file modification
      mockStat.mockResolvedValueOnce({
        mtime: new Date('2023-12-01T11:00:00Z'), // Different time
      });

      // Second call should refresh due to modification
      await cache.getProjectInfo(projectPath);
      expect(mockExecuteCommand).toHaveBeenCalledTimes(2);
    });

    it('should preserve existing preferences when refreshing', async () => {
      const projectPath = '/path/to/MyApp.xcodeproj';

      // First call to populate cache
      const initial = await cache.getProjectInfo(projectPath);

      // Simulate some preferences being set
      initial.preferredScheme = 'CustomScheme';
      initial.lastSuccessfulConfig = {
        scheme: 'CustomScheme',
        configuration: 'Release',
      };

      // Force refresh
      const refreshed = await cache.getProjectInfo(projectPath, true);

      expect(refreshed.preferredScheme).toBe('CustomScheme');
      expect(refreshed.lastSuccessfulConfig?.scheme).toBe('CustomScheme');
    });
  });

  describe('getPreferredBuildConfig', () => {
    it('should return last successful config when available', async () => {
      const projectPath = '/path/to/MyApp.xcodeproj';

      // Set up a project with a successful config
      const projectInfo = await cache.getProjectInfo(projectPath);
      projectInfo.lastSuccessfulConfig = {
        scheme: 'MyApp',
        configuration: 'Release',
        destination: 'platform=iOS Simulator,name=iPhone 15',
      };

      const config = await cache.getPreferredBuildConfig(projectPath);

      expect(config).toEqual({
        scheme: 'MyApp',
        configuration: 'Release',
        destination: 'platform=iOS Simulator,name=iPhone 15',
      });
    });

    it('should generate smart defaults when no successful config exists', async () => {
      const projectPath = '/path/to/MyApp.xcodeproj';

      const config = await cache.getPreferredBuildConfig(projectPath);

      expect(config).toEqual({
        scheme: 'MyApp', // Matches project name
        configuration: 'Debug',
      });
    });

    it('should use first scheme when project name does not match any scheme', async () => {
      const projectPath = '/path/to/MyApp.xcodeproj';

      // Mock project with different name
      const differentProject: XcodeProject = {
        ...mockXcodeProject,
        project: {
          ...mockXcodeProject.project!,
          name: 'DifferentName',
          schemes: ['FirstScheme', 'SecondScheme'],
        },
      };

      mockExecuteCommand.mockResolvedValueOnce({
        code: 0,
        stdout: JSON.stringify(differentProject),
        stderr: '',
      });

      const config = await cache.getPreferredBuildConfig(projectPath);

      expect(config?.scheme).toBe('FirstScheme');
    });

    it('should return null when no schemes are available', async () => {
      const projectPath = '/path/to/MyApp.xcodeproj';

      // Mock project with no schemes
      const noSchemesProject: XcodeProject = {
        ...mockXcodeProject,
        project: {
          ...mockXcodeProject.project!,
          schemes: [],
        },
      };

      mockExecuteCommand.mockResolvedValueOnce({
        code: 0,
        stdout: JSON.stringify(noSchemesProject),
        stderr: '',
      });

      const config = await cache.getPreferredBuildConfig(projectPath);

      expect(config).toBeNull();
    });

    it('should handle workspace projects', async () => {
      const projectPath = '/path/to/MyWorkspace.xcworkspace';

      mockExecuteCommand.mockResolvedValueOnce({
        code: 0,
        stdout: JSON.stringify(mockWorkspaceProject),
        stderr: '',
      });

      const config = await cache.getPreferredBuildConfig(projectPath);

      expect(config?.scheme).toBe('MyWorkspace');
    });
  });

  describe('recordBuildResult', () => {
    it('should record build metrics', () => {
      const projectPath = '/path/to/MyApp.xcodeproj';
      const buildConfig: BuildConfig = {
        scheme: 'MyApp',
        configuration: 'Debug',
      };
      const buildMetrics: Omit<BuildMetrics, 'config'> = {
        timestamp: new Date('2023-12-01T10:00:00Z'),
        success: true,
        duration: 5000,
        errorCount: 0,
        warningCount: 2,
        buildSizeBytes: 1024 * 1024,
      };

      cache.recordBuildResult(projectPath, buildConfig, buildMetrics);

      const history = cache.getBuildHistory(projectPath);
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        ...buildMetrics,
        config: buildConfig,
      });
    });

    it('should limit build history to 20 entries', () => {
      const projectPath = '/path/to/MyApp.xcodeproj';
      const buildConfig: BuildConfig = {
        scheme: 'MyApp',
        configuration: 'Debug',
      };

      // Record 25 builds using timestamps that increment by minutes
      for (let i = 0; i < 25; i++) {
        const buildMetrics: Omit<BuildMetrics, 'config'> = {
          timestamp: new Date(`2023-12-01T10:${i.toString().padStart(2, '0')}:00Z`),
          success: i % 2 === 0, // Alternate success/failure
          duration: 1000 + i * 100,
          errorCount: i % 2,
          warningCount: i,
          buildSizeBytes: 1024 * (i + 1),
        };

        cache.recordBuildResult(projectPath, buildConfig, buildMetrics);
      }

      const history = cache.getBuildHistory(projectPath, 25);
      expect(history).toHaveLength(20); // Limited to 20

      // Should have the most recent 20 builds (last recorded first)
      expect(history[0].timestamp).toEqual(new Date('2023-12-01T10:24:00Z')); // Most recent (i=24)
      expect(history[19].timestamp).toEqual(new Date('2023-12-01T10:05:00Z')); // 20th most recent (i=5)
    });

    it('should update last successful config on successful build', async () => {
      const projectPath = '/path/to/MyApp.xcodeproj';

      // First, get project info to populate cache
      await cache.getProjectInfo(projectPath);

      const buildConfig: BuildConfig = {
        scheme: 'MyApp',
        configuration: 'Release',
        destination: 'platform=iOS Simulator,name=iPhone 15',
      };

      const buildMetrics: Omit<BuildMetrics, 'config'> = {
        timestamp: new Date(),
        success: true,
        duration: 5000,
        errorCount: 0,
        warningCount: 0,
        buildSizeBytes: 1024,
      };

      cache.recordBuildResult(projectPath, buildConfig, buildMetrics);

      const config = await cache.getPreferredBuildConfig(projectPath);
      expect(config).toEqual(buildConfig);
    });

    it('should not update last successful config on failed build', async () => {
      const projectPath = '/path/to/MyApp.xcodeproj';

      // First, get project info to populate cache
      await cache.getProjectInfo(projectPath);

      const buildConfig: BuildConfig = {
        scheme: 'MyApp',
        configuration: 'Release',
      };

      const buildMetrics: Omit<BuildMetrics, 'config'> = {
        timestamp: new Date(),
        success: false,
        duration: 2000,
        errorCount: 5,
        warningCount: 2,
        buildSizeBytes: 512,
      };

      cache.recordBuildResult(projectPath, buildConfig, buildMetrics);

      // Should still return smart defaults, not the failed config
      const config = await cache.getPreferredBuildConfig(projectPath);
      expect(config?.configuration).toBe('Debug'); // Default
    });
  });

  describe('getBuildHistory', () => {
    it('should return build history in reverse chronological order', () => {
      const projectPath = '/path/to/MyApp.xcodeproj';
      const buildConfig: BuildConfig = {
        scheme: 'MyApp',
        configuration: 'Debug',
      };

      // Record multiple builds
      const builds = [
        { timestamp: new Date('2023-12-01T10:00:00Z'), success: true },
        { timestamp: new Date('2023-12-01T11:00:00Z'), success: false },
        { timestamp: new Date('2023-12-01T12:00:00Z'), success: true },
      ];

      builds.forEach(build => {
        cache.recordBuildResult(projectPath, buildConfig, {
          ...build,
          duration: 1000,
          errorCount: 0,
          warningCount: 0,
          buildSizeBytes: 1024,
        });
      });

      const history = cache.getBuildHistory(projectPath);

      expect(history).toHaveLength(3);
      expect(history[0].timestamp).toEqual(new Date('2023-12-01T12:00:00Z')); // Most recent first
      expect(history[1].timestamp).toEqual(new Date('2023-12-01T11:00:00Z'));
      expect(history[2].timestamp).toEqual(new Date('2023-12-01T10:00:00Z'));
    });

    it('should respect limit parameter', () => {
      const projectPath = '/path/to/MyApp.xcodeproj';
      const buildConfig: BuildConfig = {
        scheme: 'MyApp',
        configuration: 'Debug',
      };

      // Record 5 builds
      for (let i = 0; i < 5; i++) {
        cache.recordBuildResult(projectPath, buildConfig, {
          timestamp: new Date(`2023-12-01T${10 + i}:00:00Z`),
          success: true,
          duration: 1000,
          errorCount: 0,
          warningCount: 0,
          buildSizeBytes: 1024,
        });
      }

      const history = cache.getBuildHistory(projectPath, 3);
      expect(history).toHaveLength(3);
      expect(history[0].timestamp).toEqual(new Date('2023-12-01T14:00:00Z')); // Most recent
    });

    it('should return empty array for unknown project', () => {
      const history = cache.getBuildHistory('/unknown/project');
      expect(history).toHaveLength(0);
    });
  });

  describe('getPerformanceTrends', () => {
    beforeEach(() => {
      const projectPath = '/path/to/MyApp.xcodeproj';
      const buildConfig: BuildConfig = {
        scheme: 'MyApp',
        configuration: 'Debug',
      };

      // Record some build history
      const builds = [
        { success: true, duration: 5000, errorCount: 0 },
        { success: false, duration: undefined, errorCount: 3 },
        { success: true, duration: 4000, errorCount: 0 },
        { success: true, duration: 6000, errorCount: 0 },
        { success: false, duration: undefined, errorCount: 2 },
        { success: true, duration: 3000, errorCount: 0 },
        { success: true, duration: 4500, errorCount: 0 },
        { success: true, duration: 5500, errorCount: 0 },
      ];

      builds.forEach((build, index) => {
        cache.recordBuildResult(projectPath, buildConfig, {
          timestamp: new Date(`2023-12-01T${10 + index}:00:00Z`),
          success: build.success,
          duration: build.duration,
          errorCount: build.errorCount,
          warningCount: 1,
          buildSizeBytes: 1024,
        });
      });
    });

    it('should calculate performance trends correctly', () => {
      const projectPath = '/path/to/MyApp.xcodeproj';
      const trends = cache.getPerformanceTrends(projectPath);

      expect(trends.successRate).toBeCloseTo(0.75); // 6 successful out of 8
      expect(trends.avgBuildTime).toBeCloseTo(4666.67, 0); // Average of successful builds
      expect(trends.recentErrorCount).toBe(2); // Last 5 builds: [0,2,0,0,0] = 2 total
    });

    it('should calculate build time improvement', () => {
      const projectPath = '/path/to/MyApp.xcodeproj';
      const trends = cache.getPerformanceTrends(projectPath);

      // Recent builds (last 3 successful): [5500, 4500, 3000] = avg 4333.33
      // Older builds (next 3 successful): [6000, 4000, 5000] = avg 5000
      // Improvement: ((5000 - 4333.33) / 5000) * 100 = 13.33%
      expect(trends.buildTimeImprovement).toBeCloseTo(13.33, 1);
    });

    it('should return zero metrics for empty history', () => {
      const trends = cache.getPerformanceTrends('/unknown/project');

      expect(trends.successRate).toBe(0);
      expect(trends.recentErrorCount).toBe(0);
      expect(trends.avgBuildTime).toBeUndefined();
      expect(trends.buildTimeImprovement).toBeUndefined();
    });

    it('should handle insufficient data for build time improvement', () => {
      const projectPath = '/path/to/SmallProject.xcodeproj';
      const buildConfig: BuildConfig = {
        scheme: 'SmallProject',
        configuration: 'Debug',
      };

      // Record only 3 successful builds
      for (let i = 0; i < 3; i++) {
        cache.recordBuildResult(projectPath, buildConfig, {
          timestamp: new Date(`2023-12-01T${10 + i}:00:00Z`),
          success: true,
          duration: 1000 + i * 500,
          errorCount: 0,
          warningCount: 0,
          buildSizeBytes: 1024,
        });
      }

      const trends = cache.getPerformanceTrends(projectPath);

      expect(trends.buildTimeImprovement).toBeUndefined();
    });
  });

  describe('getDependencyInfo', () => {
    it('should check for SPM Package.resolved', async () => {
      const projectPath = '/path/to/MyApp.xcodeproj';
      const packageResolved = {
        pins: [
          {
            identity: 'alamofire',
            kind: 'remoteSourceControl',
            location: 'https://github.com/Alamofire/Alamofire.git',
            state: {
              revision: 'abc123',
              version: '5.6.0',
            },
          },
        ],
        version: 2,
      };

      mockReadFile.mockImplementation(async (path: any) => {
        if (path.endsWith('Package.resolved')) {
          return JSON.stringify(packageResolved);
        }
        throw new Error('File not found');
      });

      const depInfo = await cache.getDependencyInfo(projectPath);

      expect(depInfo?.packageResolved).toEqual(packageResolved);
      expect(depInfo?.lastChecked).toBeInstanceOf(Date);
    });

    it('should check for CocoaPods Podfile.lock', async () => {
      const projectPath = '/path/to/MyApp.xcodeproj';
      const podfileLock = `PODS:
  - Alamofire (5.6.0)

DEPENDENCIES:
  - Alamofire

SPEC CHECKSUMS:
  Alamofire: abc123def456

PODFILE CHECKSUM: def789ghi012`;

      mockReadFile.mockImplementation(async (path: any) => {
        if (path.endsWith('Podfile.lock')) {
          return podfileLock;
        }
        throw new Error('File not found');
      });

      const depInfo = await cache.getDependencyInfo(projectPath);

      expect(depInfo?.podfileLock).toBe(podfileLock);
    });

    it('should check for Carthage Cartfile.resolved', async () => {
      const projectPath = '/path/to/MyApp.xcodeproj';
      const carthageResolved = 'github "Alamofire/Alamofire" "5.6.0"';

      mockReadFile.mockImplementation(async (path: any) => {
        if (path.endsWith('Cartfile.resolved')) {
          return carthageResolved;
        }
        throw new Error('File not found');
      });

      const depInfo = await cache.getDependencyInfo(projectPath);

      expect(depInfo?.carthageResolved).toBe(carthageResolved);
    });

    it('should return cached dependency info when valid', async () => {
      const projectPath = '/path/to/MyApp.xcodeproj';

      // First call
      await cache.getDependencyInfo(projectPath);
      expect(mockReadFile).toHaveBeenCalledTimes(3); // Tries all 3 dependency files

      // Second call should use cache
      await cache.getDependencyInfo(projectPath);
      expect(mockReadFile).toHaveBeenCalledTimes(3); // No additional calls
    });

    it('should refresh expired dependency cache', async () => {
      const projectPath = '/path/to/MyApp.xcodeproj';

      // Set very short cache age
      cache.setCacheMaxAge(100); // 100ms

      // First call
      await cache.getDependencyInfo(projectPath);
      expect(mockReadFile).toHaveBeenCalledTimes(3);

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Second call should refresh
      await cache.getDependencyInfo(projectPath);
      expect(mockReadFile).toHaveBeenCalledTimes(6); // Another round of 3 calls
    });

    it('should handle file read errors gracefully', async () => {
      const projectPath = '/path/to/MyApp.xcodeproj';

      mockReadFile.mockRejectedValue(new Error('File not found'));

      const depInfo = await cache.getDependencyInfo(projectPath);

      expect(depInfo?.packageResolved).toBeUndefined();
      expect(depInfo?.podfileLock).toBeUndefined();
      expect(depInfo?.carthageResolved).toBeUndefined();
      expect(depInfo?.lastChecked).toBeInstanceOf(Date);
    });

    it('should return DependencyInfo with lastChecked on file errors', async () => {
      const projectPath = '/path/to/MyApp.xcodeproj';

      // Mock file read errors for all dependency files
      mockReadFile.mockRejectedValue(new Error('File not found'));

      const depInfo = await cache.getDependencyInfo(projectPath);

      // Should return a DependencyInfo object with just lastChecked, not null
      expect(depInfo).not.toBeNull();
      expect(depInfo?.lastChecked).toBeInstanceOf(Date);
      expect(depInfo?.packageResolved).toBeUndefined();
      expect(depInfo?.podfileLock).toBeUndefined();
      expect(depInfo?.carthageResolved).toBeUndefined();
    });
  });

  describe('getCacheStats', () => {
    it('should return correct cache statistics', async () => {
      const projectPath1 = '/path/to/Project1.xcodeproj';
      const projectPath2 = '/path/to/Project2.xcodeproj';

      // Populate cache with multiple projects
      await cache.getProjectInfo(projectPath1);
      await cache.getProjectInfo(projectPath2);

      // Add some build history
      const buildConfig: BuildConfig = {
        scheme: 'Test',
        configuration: 'Debug',
      };

      for (let i = 0; i < 5; i++) {
        cache.recordBuildResult(projectPath1, buildConfig, {
          timestamp: new Date(),
          success: true,
          duration: 1000,
          errorCount: 0,
          warningCount: 0,
          buildSizeBytes: 1024,
        });
      }

      for (let i = 0; i < 3; i++) {
        cache.recordBuildResult(projectPath2, buildConfig, {
          timestamp: new Date(),
          success: true,
          duration: 1000,
          errorCount: 0,
          warningCount: 0,
          buildSizeBytes: 1024,
        });
      }

      // Add dependency info
      await cache.getDependencyInfo(projectPath1);

      const stats = cache.getCacheStats();

      expect(stats.projectCount).toBe(2);
      expect(stats.buildHistoryCount).toBe(8); // 5 + 3 builds
      expect(stats.dependencyCount).toBe(1);
      expect(stats.cacheMaxAgeMs).toBe(60 * 60 * 1000); // Default 1 hour
      expect(stats.cacheMaxAgeHuman).toBe('1h 0m');
    });

    it('should format duration correctly', () => {
      const testCases = [
        { ms: 1000, expected: '1s' },
        { ms: 90 * 1000, expected: '1m 30s' },
        { ms: 90 * 60 * 1000, expected: '1h 30m' },
        { ms: 25 * 60 * 60 * 1000, expected: '1d 1h' },
      ];

      testCases.forEach(({ ms, expected }) => {
        cache.setCacheMaxAge(ms);
        const stats = cache.getCacheStats();
        expect(stats.cacheMaxAgeHuman).toBe(expected);
      });
    });
  });
});
