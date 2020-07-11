import * as VM from './virtual-machine-types';
import * as IL from './il';
import { entriesInOrder, stringifyIdentifier } from './utils';
import { stringifyValue, stringifyFunction, stringifyAllocation, StringifyILOpts } from './stringify-il';
import { crc16ccitt } from 'crc';

export const BYTECODE_VERSION = 2;
export const HEADER_SIZE = 44;
export const ENGINE_VERSION = 2;

/**
 * A snapshot represents the state of the machine captured at a specific moment
 * in time.
 *
 * Note: Handles are not part of the snapshot. Handles represent references from
 * the host into the VM. These references are severed at the time that VM is
 * snapshotted.
 */
export interface SnapshotIL {
  globalSlots: Map<VM.GlobalSlotID, VM.GlobalSlot>;
  functions: Map<IL.FunctionID, IL.Function>;
  exports: Map<IL.ExportID, IL.Value>;
  allocations: Map<IL.AllocationID, IL.Allocation>;
  flags: Set<IL.ExecutionFlag>;
  builtins: {
    arrayPrototype: IL.Value;
  }
}

export function stringifySnapshotIL(snapshot: SnapshotIL, opts: StringifyILOpts = {}): string {
  return `${
    entriesInOrder(snapshot.exports)
      .map(([k, v]) => `export ${k} = ${stringifyValue(v)};`)
      .join('\n')
    }\n\n${
    entriesInOrder(snapshot.globalSlots)
      .map(([k, v]) => `slot ${stringifyIdentifier(k)} = ${stringifyValue(v.value)};`)
      .join('\n')
    }\n\n${
    entriesInOrder(snapshot.functions)
      .map(([, v]) => stringifyFunction(v, '', opts))
      .join('\n\n')
    }\n\n${
    entriesInOrder(snapshot.allocations)
      .map(([k, v]) => `${stringifyAllocationRegion(v.memoryRegion)}allocation ${k} = ${stringifyAllocation(v)};`)
      .join('\n\n')
    }`;
}

function stringifyAllocationRegion(region: IL.AllocationBase['memoryRegion']): string {
  return !region || region === 'gc' ? '' : region + ' ';
}

export function validateSnapshotBinary(bytecode: Buffer): { err: string } | undefined {
  if (bytecode.length < 6) return { err: 'Too short' };

  const headerSize = bytecode.readUInt8(1);
  if (headerSize != 44)
    return { err: `Invalid bytecode header` };

  const bytecodeSize = bytecode.readUInt16LE(2);
  if (bytecodeSize != bytecode.length)
    return { err: `Invalid bytecode header` };

  const calculatedCrc = crc16ccitt(bytecode.slice(6));
  const recordedCrc = bytecode.readUInt16LE(4);
  if (calculatedCrc !== recordedCrc)
    return { err: `CRC fail` };

  const actualBytecodeVersion = bytecode.readUInt8(0);
  if (actualBytecodeVersion !== BYTECODE_VERSION) {
    return { err: `Supported bytecode version is ${BYTECODE_VERSION} but file is version ${actualBytecodeVersion}` };
  }
}
