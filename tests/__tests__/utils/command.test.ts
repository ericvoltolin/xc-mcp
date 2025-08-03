import { jest } from '@jest/globals';
import {
  buildXcodebuildCommand,
  buildSimctlCommand,
} from '../../../src/utils/command.js';

// Test only the command building functions for now
// executeCommand and executeCommandSync require complex mocking due to child_process

describe('buildXcodebuildCommand', () => {
  it('should build basic project command', () => {
    const command = buildXcodebuildCommand('build', '/path/to/Project.xcodeproj');

    expect(command).toBe('xcodebuild -project "/path/to/Project.xcodeproj" build');
  });

  it('should build workspace command', () => {
    const command = buildXcodebuildCommand('build', '/path/to/Workspace.xcworkspace');

    expect(command).toBe('xcodebuild -workspace "/path/to/Workspace.xcworkspace" build');
  });

  it('should build command with workspace option', () => {
    const command = buildXcodebuildCommand('build', '/path/to/Project.xcodeproj', {
      workspace: true,
    });

    expect(command).toBe('xcodebuild -workspace "/path/to/Project.xcodeproj" build');
  });

  it('should build command with all options', () => {
    const options = {
      scheme: 'MyApp',
      configuration: 'Release',
      destination: 'platform=iOS Simulator,name=iPhone 15',
      sdk: 'iphonesimulator',
      derivedDataPath: '/tmp/DerivedData',
      json: true,
    };

    const command = buildXcodebuildCommand('build', '/path/to/Project.xcodeproj', options);

    expect(command).toContain('-project "/path/to/Project.xcodeproj"');
    expect(command).toContain('-scheme "MyApp"');
    expect(command).toContain('-configuration Release');
    expect(command).toContain('-destination "platform=iOS Simulator,name=iPhone 15"');
    expect(command).toContain('-sdk iphonesimulator');
    expect(command).toContain('-derivedDataPath "/tmp/DerivedData"');
    expect(command).toContain('-json');
    expect(command).toContain('build');
  });

  it('should handle scheme with spaces', () => {
    const command = buildXcodebuildCommand('build', '/path/to/Project.xcodeproj', {
      scheme: 'My App Scheme',
    });

    expect(command).toContain('-scheme "My App Scheme"');
  });

  it('should handle empty action', () => {
    const command = buildXcodebuildCommand('', '/path/to/Project.xcodeproj');

    expect(command).toBe('xcodebuild -project "/path/to/Project.xcodeproj"');
  });

  it('should handle partial options', () => {
    const command = buildXcodebuildCommand('clean', '/path/to/Project.xcodeproj', {
      scheme: 'MyApp',
      configuration: 'Debug',
    });

    expect(command).toContain('-scheme "MyApp"');
    expect(command).toContain('-configuration Debug');
    expect(command).not.toContain('-destination');
    expect(command).not.toContain('-json');
  });
});

describe('buildSimctlCommand', () => {
  it('should build basic list command', () => {
    const command = buildSimctlCommand('list');

    expect(command).toBe('xcrun simctl list');
  });

  it('should build list command with JSON flag', () => {
    const command = buildSimctlCommand('list', { json: true });

    expect(command).toBe('xcrun simctl list -j');
  });

  it('should build boot command with device ID', () => {
    const command = buildSimctlCommand('boot', {
      deviceId: '12345678-1234-1234-1234-123456789012',
    });

    expect(command).toBe('xcrun simctl boot 12345678-1234-1234-1234-123456789012');
  });

  it('should build shutdown command with device ID', () => {
    const command = buildSimctlCommand('shutdown', {
      deviceId: '12345678-1234-1234-1234-123456789012',
    });

    expect(command).toBe('xcrun simctl shutdown 12345678-1234-1234-1234-123456789012');
  });

  it('should build create command with full parameters', () => {
    const command = buildSimctlCommand('create', {
      name: 'Test iPhone',
      deviceType: 'com.apple.CoreSimulator.SimDeviceType.iPhone-15',
      runtime: 'com.apple.CoreSimulator.SimRuntime.iOS-17-0',
    });

    expect(command).toBe(
      'xcrun simctl create "Test iPhone" com.apple.CoreSimulator.SimDeviceType.iPhone-15 com.apple.CoreSimulator.SimRuntime.iOS-17-0'
    );
  });

  it('should not add JSON flag for unsupported actions', () => {
    const command = buildSimctlCommand('boot', {
      deviceId: '12345678-1234-1234-1234-123456789012',
      json: true,
    });

    expect(command).toBe('xcrun simctl boot 12345678-1234-1234-1234-123456789012');
    expect(command).not.toContain('-j');
  });

  it('should handle actions without device-specific parameters', () => {
    const command = buildSimctlCommand('help');

    expect(command).toBe('xcrun simctl help');
  });

  it('should ignore deviceId for unsupported actions', () => {
    const command = buildSimctlCommand('list', {
      deviceId: '12345678-1234-1234-1234-123456789012',
    });

    expect(command).toBe('xcrun simctl list');
  });

  it('should handle create command with missing parameters', () => {
    const command = buildSimctlCommand('create', {
      name: 'Test iPhone',
      // Missing deviceType and runtime
    });

    expect(command).toBe('xcrun simctl create');
  });

  it('should handle device name with spaces in create command', () => {
    const command = buildSimctlCommand('create', {
      name: 'My Test Device',
      deviceType: 'iPhone-15',
      runtime: 'iOS-17-0',
    });

    expect(command).toContain('"My Test Device"');
  });
});