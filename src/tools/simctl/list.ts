import { executeCommand, buildSimctlCommand } from '../../utils/command.js';
import type { ToolResult, SimulatorList, OutputFormat } from '../../types/xcode.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

interface SimctlListToolArgs {
  deviceType?: string;
  runtime?: string;
  availability?: 'available' | 'unavailable' | 'all';
  outputFormat?: OutputFormat;
}

export async function simctlListTool(args: any) {
  const { 
    deviceType,
    runtime,
    availability = 'available',
    outputFormat = 'json'
  } = args as SimctlListToolArgs;

  try {
    // Build command
    const command = buildSimctlCommand('list', { 
      json: outputFormat === 'json' 
    });

    // Execute command
    const result = await executeCommand(command);

    if (result.code !== 0) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to list simulators: ${result.stderr}`
      );
    }

    let responseText: string;

    if (outputFormat === 'json') {
      try {
        // Parse simulator list
        const simulatorList: SimulatorList = JSON.parse(result.stdout);
        
        // Apply filters if specified
        const filteredList = filterSimulatorList(simulatorList, {
          deviceType,
          runtime,
          availability,
        });
        
        responseText = JSON.stringify(filteredList, null, 2);
      } catch (parseError) {
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to parse simctl list output: ${parseError}`
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
      `simctl-list failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function filterSimulatorList(
  list: SimulatorList, 
  filters: {
    deviceType?: string;
    runtime?: string;
    availability?: string;
  }
): SimulatorList {
  const filtered: SimulatorList = {
    devices: {},
    runtimes: list.runtimes,
    devicetypes: list.devicetypes,
  };

  // Filter device types if specified
  if (filters.deviceType) {
    filtered.devicetypes = list.devicetypes.filter(dt => 
      dt.name.toLowerCase().includes(filters.deviceType!.toLowerCase())
    );
  }

  // Filter runtimes if specified
  if (filters.runtime) {
    filtered.runtimes = list.runtimes.filter(rt => 
      rt.name.toLowerCase().includes(filters.runtime!.toLowerCase()) ||
      rt.version.includes(filters.runtime!)
    );
  }

  // Filter devices
  for (const [runtimeKey, devices] of Object.entries(list.devices)) {
    // Skip runtime if it doesn't match filter
    if (filters.runtime && !runtimeKey.toLowerCase().includes(filters.runtime.toLowerCase())) {
      continue;
    }

    const filteredDevices = devices.filter(device => {
      // Filter by device type
      if (filters.deviceType && !device.name.toLowerCase().includes(filters.deviceType.toLowerCase())) {
        return false;
      }

      // Filter by availability
      if (filters.availability === 'available' && !device.isAvailable) {
        return false;
      }
      if (filters.availability === 'unavailable' && device.isAvailable) {
        return false;
      }

      return true;
    });

    if (filteredDevices.length > 0) {
      filtered.devices[runtimeKey] = filteredDevices;
    }
  }

  return filtered;
}