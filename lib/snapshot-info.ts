import * as VM from './virtual-machine-types';
import * as IL from './il';
import { entries, stringifyIdentifier } from './utils';
import { stringifyValue, stringifyFunction, stringifyAllocation } from './stringify-il';
import { crc16ccitt } from 'crc';

export const BYTECODE_VERSION = 1;
export const HEADER_SIZE = 44;
export const ENGINE_VERSION = 0;

/**
 * A snapshot represents the state of the machine captured at a specific moment
 * in time.
 *
 * Note: Handles are not part of the snapshot. Handles represent references from
 * the host into the VM. These references are severed at the time that VM is
 * snapshotted.
 */
export interface SnapshotInfo {
  globalSlots: Map<VM.GlobalSlotID, VM.GlobalSlot>;
  functions: Map<IL.FunctionID, VM.Function>;
  exports: Map<IL.ExportID, IL.Value>;
  allocations: Map<IL.AllocationID, IL.Allocation>;
  flags: Set<IL.ExecutionFlag>;
}

export function stringifySnapshotInfo(snapshot: SnapshotInfo): string {
  return `${
    entries(snapshot.exports)
      .map(([k, v]) => `export ${k} = ${stringifyValue(v)};`)
      .join('\n')
    }\n\n${
    entries(snapshot.globalSlots)
      .map(([k, v]) => `slot ${stringifyIdentifier(k)} = ${stringifyValue(v.value)};`)
      .join('\n')
    }\n\n${
    entries(snapshot.functions)
      .map(([, v]) => stringifyFunction(v, ''))
      .join('\n\n')
    }\n\n${
    entries(snapshot.allocations)
      .map(([k, v]) => `allocation ${k} = ${stringifyAllocation(v)};`)
      .join('\n\n')
    }`;
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
