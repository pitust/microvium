#pragma once

#include "stdint.h"

#define MVM_BYTECODE_VERSION 2

typedef struct mvm_Builtins {
  uint16_t arrayProtoPointer;
  /** Pointer to additional unique strings table in GC memory. Note that when a
   * snapshot is generated by the comprehensive VM (i.e. the first time it's
   * generated), this can just be null since all strings are in the string
   * table. This field is only needed on devices that need to generate a
   * snapshot after adding more unique strings, but don't have the power to
   * regenerate the string table or the corresponding bytecode layout. */
  uint16_t uniqueStringsRAMPointer;
} mvm_Builtins;

// These sections appear in the bytecode in the order they appear in this
// enumeration.
typedef enum mvm_TeBytecodeSection {
  /**
   * Import Table
   *
   * List of host function IDs which are called by the VM. References from the
   * VM to host functions are represented as indexes into this table. These IDs
   * are resolved to their corresponding host function pointers when a VM is
   * restored.
   */
  BCS_IMPORT_TABLE,

  /**
   * A list of immutable `vm_TsExportTableEntry` that the VM exports, mapping
   * export IDs to their corresponding VM Value. Mostly these values will just
   * be function pointers.
   */
  // TODO: We need to test what happens if we export numbers and objects
  BCS_EXPORT_TABLE,

  /**
   * Short Call Table. Table of vm_TsShortCallTableEntry.
   *
   * To make the representation of function calls in IL more compact, up to 16
   * of the most frequent function calls are listed in this table, including the
   * function target and the argument count.
   *
   * See VM_OP_CALL_1
   */
  // WIP make sure that this table is padded
  BCS_SHORT_CALL_TABLE,

  /**
   * ROM Handles
   *
   * Table of mvm_TsROMHandle
   *
   * Each 8-bit element in this table is an offset to a corresponding global
   * variable to reference a value that may be in GC memory. I've called them
   * "ROM" handles because the main use is to simulate mutable references from
   * an immutable context, allowing functions and ROM data structures to
   * reference allocations in GC memory even though the actual pointer in GC
   * memory can change when the allocation moves around during compaction.
   *
   * The other use is that there are a variety of builtins, such as the array
   * prototype, where the VM needs to have special knowledge of how to find
   * them. So the first few handles are identified by `mvm_TeBuiltinHandles`. This
   * means the if the optimizer determines that a particular builtin is never
   * used, it can remove the corresponding global variable while keeping the
   * slot in the ROM handle index table so that the other builtins are still in
   * known slots.
   *
   * There are other possible uses in future, such as implementing copy-on-write
   * for allocations that are _probably_ immutable but can't be guaranteed.
   */
  // WIP update encoder/decoder
  BCS_HANDLES,

  /**
   * Unique String Table
   *
   * To keep property lookup efficient, Microvium requires that strings used as
   * property keys can be compared using pointer equality. This requires that
   * there is only one instance of each string. This table is the alphabetical
   * listing of all the strings in ROM (or at least, all those which are valid
   * property keys). See also TC_REF_UNIQUE_STRING.
   */
  BCS_STRING_TABLE,

  /**
   * Functions and other immutable data structures.
   *
   * While the whole bytecode is essentially "ROM", only this ROM section
   * contains addressable allocations.
   */
  BCS_ROM,

  /**
   * Globals
   *
   * One `Value` entry for the initial value of each global variable. The number
   * of global variables is determined by the size of this section.
   *
   * This section will be copied into RAM at startup (restore).
   */
  BCS_GLOBALS,

  /**
   * Heap Section: heap allocations.
   *
   * This section is copied into RAM when the VM is restored. It becomes the
   * initial value of the GC heap. It contains allocations that are mutable
   * (like the DATA section) but also subject to garbage collection.
   *
   * Note: the heap must be at the end, because it is the only part that changes
   * size from one snapshot to the next. There is code that depends on this
   * being the last section because the size of this section is computed as
   * running to the end of the bytecode image.
   */
  BCS_HEAP,

  BCS_SECTION_COUNT,
} mvm_TeBytecodeSection;

typedef enum mvm_TeBuiltinHandles {
  BIH_UNIQUE_STRINGS,
  BIH_ARRAY_PROTO,

  BIH_BUILTIN_COUNT
} mvm_TeBuiltinHandles;

typedef struct mvm_TsBytecodeHeader {
  uint8_t bytecodeVersion; // MVM_BYTECODE_VERSION
  uint8_t headerSize;
  uint8_t requiredEngineVersion;
  uint8_t globalVariableCount;  // WIP: I've moved this field. Need to update serializer and deserializer

  uint16_t bytecodeSize; // Including header
  uint16_t crc; // CCITT16 (header and data, of everything after the CRC)

  uint32_t requiredFeatureFlags;

  /*
  Note: the sections are assumed to be in order as per mvm_TeBytecodeSection, so
  that the size of a section can be computed as the difference between the
  adjacent offsets. The last section runs up until the end of the bytecode.
  */
  // WIP update encoder/decoder
  uint16_t sectionOffsets[BCS_SECTION_COUNT];
} mvm_TsBytecodeHeader;

typedef enum mvm_TeFeatureFlags {
  FF_FLOAT_SUPPORT = 0,
} mvm_TeFeatureFlags;

typedef struct vm_TsExportTableEntry {
  mvm_VMExportID exportID;
  mvm_Value exportValue;
} vm_TsExportTableEntry;

typedef struct mvm_TsROMHandleEntry {
  // Index of the global variable to use as the handle. Note that the first few
  // ROM handles are specified by `mvm_TeBuiltinHandles`. Other handles are free
  // to be created whenever a ROM object/function potentially references
  // something in RAM.
  uint8_t globalVariableIndex;
} mvm_TsROMHandleEntry;

typedef struct vm_TsShortCallTableEntry {
  /* Note: the `function` field has been broken up into separate low and high
   * bytes, `functionL` and `functionH` respectively, for alignment purposes,
   * since this is a 3-byte structure occuring in a packed table.
   *
   * If `function` low bit is set, the `function` is an index into the imports
   * table of host functions. Otherwise, `function` is the (even) offset to a
   * local function in the bytecode
   */
  uint8_t functionL;
  uint8_t functionH;
  uint8_t argCount;
} vm_TsShortCallTableEntry;
