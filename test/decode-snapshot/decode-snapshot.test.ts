import { decodeSnapshot, stringifySnapshotMapping } from "../../lib/decode-snapshot";
import { decodeSnapshotTestFilenames } from "./filenames";
import { TestResults } from "../common";
import { encodeSnapshot } from "../../lib/encode-snapshot";
import { VirtualMachineFriendly } from "../../lib/virtual-machine-friendly";
import { defaultHostEnvironment, HostImportTable } from "../../lib";
import { addBuiltinGlobals } from "../../lib/builtin-globals";

suite('decodeSnapshot', function () {
  test('decodeSnapshot', () => {
    const importMap: HostImportTable = {
      1: () => {}
    };
    const vm = new VirtualMachineFriendly(undefined, importMap);
    vm.globalThis.print = vm.importHostFunction(1);
    vm.globalThis.vmExport = vm.exportValue;

    const sourceText = `
      const o = { x: 'Hello, World!' };
      vmExport(0, run);
      function run() {
        print(o.x);
      }
    `;
    vm.evaluateModule({ sourceText });

    const testResults = new TestResults();

    const snapshot = vm.createSnapshot();
    const mapping = decodeSnapshot(snapshot).mapping;
    const mappingString = stringifySnapshotMapping(mapping);

    testResults.push(mappingString, decodeSnapshotTestFilenames["decode-snapshot"].mapping);
    testResults.checkAll();
  });
});