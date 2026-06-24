{
  /*
    Copyright (C) 2026   Onish Sharma

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published
    by the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/
}

import React, { useState, useEffect, useRef } from "react";

// Scratch-style block categories with bright, solid primary colors
const PRIMITIVE_CONFIG = {
  ADD: {
    args: 3,
    labels: ["", "=", "+"],
    group: "Operators",
    color: "bg-[#5CB85C] text-white border-[#4cae4c]",
  },
  SUB: {
    args: 3,
    labels: ["", "=", "-"],
    group: "Operators",
    color: "bg-[#5CB85C] text-white border-[#4cae4c]",
  },
  CMP: {
    args: 2,
    labels: ["compare", "with"],
    group: "Sensing",
    color: "bg-[#4C97FF] text-white border-[#337ecc]",
  },
  MOV: {
    args: 2,
    labels: ["set", "to reg"],
    group: "Variables",
    color: "bg-[#FF8C1A] text-white border-[#e67300]",
  },
  MOVI: {
    args: 2,
    labels: ["set reg", "to constant"],
    group: "Variables",
    color: "bg-[#FF8C1A] text-white border-[#e67300]",
  },
  LOAD: {
    args: 2,
    labels: ["load reg", "from memory"],
    group: "Data",
    color: "bg-[#FF6680] text-white border-[#ee4466]",
  },
  STORE: {
    args: 2,
    labels: ["store reg", "into memory"],
    group: "Data",
    color: "bg-[#FF6680] text-white border-[#ee4466]",
  },
  JMP: {
    args: 1,
    labels: ["jump to"],
    group: "Control",
    color: "bg-[#FFBF00] text-white border-[#e6ac00]",
  },
  JMP_EQ: {
    args: 1,
    labels: ["if equal, jump to"],
    group: "Control",
    color: "bg-[#FFBF00] text-white border-[#e6ac00]",
  },
  JMP_NE: {
    args: 1,
    labels: ["if not equal, jump to"],
    group: "Control",
    color: "bg-[#FFBF00] text-white border-[#e6ac00]",
  },
};

export default function App() {
  // Simulation States
  const [regs, setRegs] = useState(Array(16).fill(0));
  const [flags, setFlags] = useState({ z: false, n: false });
  const [engineReady, setEngineReady] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Custom Opcode Builder States
  const [savedOpcodes, setSavedOpcodes] = useState({});
  const [opcodeName, setOpcodeName] = useState("");
  const [opcodeArgsCount, setOpcodeArgsCount] = useState(2);
  const [activeSequence, setActiveSequence] = useState([]);

  // Async execution control states
  const [isRunning, setIsRunning] = useState(false);
  const stopRequestedRef = useRef(false);

  const assemblyEditorRef = useRef(null);
  const getWasmModule = () => (typeof Module !== "undefined" ? Module : null);

  // Track WASM engine lifecycle bindings
  useEffect(() => {
    if (typeof Module !== "undefined" && Module.Interpreter) {
      setEngineReady(true);
      return;
    }
    const handleWasmReady = () => setEngineReady(true);
    window.addEventListener("wasm-core-ready", handleWasmReady);
    return () => window.removeEventListener("wasm-core-ready", handleWasmReady);
  }, []);

  // --- Drag & Drop Mechanics ---
  const handleDragStartToolbox = (e, type) => {
    e.dataTransfer.setData("text/plain", type);
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleDropOnCanvas = (e) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const type = e.dataTransfer.getData("text/plain");
    if (!PRIMITIVE_CONFIG[type]) return;

    const newBlock = {
      id: crypto.randomUUID(),
      type: type,
      arg_indices: Array(PRIMITIVE_CONFIG[type].args).fill(0),
    };
    setActiveSequence((prev) => [...prev, newBlock]);
  };

  const handleArgChange = (blockId, argIndex, value) => {
    setActiveSequence((prev) =>
      prev.map((block) => {
        if (block.id !== blockId) return block;
        const updatedIndices = [...block.arg_indices];
        updatedIndices[argIndex] = parseInt(value, 10);
        return { ...block, arg_indices: updatedIndices };
      }),
    );
  };

  const removeBlock = (index) => {
    setActiveSequence((prev) => prev.filter((_, i) => i !== index));
  };

  // --- Compile Block Definition to Opcode Custom Layout ---
  const saveOpcode = () => {
    const name = opcodeName
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, "");
    if (!name)
      return alert("Please type a name for your new block instruction.");
    if (activeSequence.length === 0)
      return alert("Add at least one primitive to your block script first!");

    setSavedOpcodes((prev) => ({
      ...prev,
      [name]: {
        argsCount: opcodeArgsCount,
        sequence: activeSequence.map((p) => ({
          id: crypto.randomUUID(),
          type: p.type,
          arg_indices: [...p.arg_indices],
        })),
      },
    }));
    setOpcodeName("");
    setActiveSequence([]);
  };

  const loadOpcode = (name) => {
    const op = savedOpcodes[name];
    if (!op) return;
    setOpcodeName(name);
    setOpcodeArgsCount(op.argsCount);
    setActiveSequence(
      op.sequence.map((p) => ({
        id: crypto.randomUUID(),
        type: p.type,
        arg_indices: [...p.arg_indices],
      })),
    );
  };

  const deleteOpcode = (name) => {
    if (opcodeName === name) {
      setOpcodeName("");
      setActiveSequence([]);
    }
    setSavedOpcodes((prev) => {
      const copy = { ...prev };
      delete copy[name];
      return copy;
    });
  };

  const executeProgram = () => {
    if (isRunning) return;

    const wasmModule = getWasmModule();
    if (!wasmModule || !wasmModule.Interpreter)
      return alert("WASM Core initialization is not complete.");

    const srcText = assemblyEditorRef.current?.value || "";
    const program = srcText
      .split("\n")
      .map((line) => {
        const hashIdx = line.indexOf("#");
        const cleanLine = hashIdx !== -1 ? line.substring(0, hashIdx) : line;
        return cleanLine.trim();
      })
      .filter((line) => line !== "");
    if (program.length === 0) return;

    // Set execution flags
    setIsRunning(true);
    stopRequestedRef.current = false;

    const interpreter = new wasmModule.Interpreter();
    const cpu = new wasmModule.CPU();

    Object.keys(savedOpcodes).forEach((name) => {
      interpreter.register_instruction(name);
      savedOpcodes[name].sequence.forEach((p) => {
        const indices = new wasmModule.VectorInt();
        p.arg_indices.forEach((idx) => indices.push_back(idx));
        interpreter.add_primitive_to_instruction(
          name,
          wasmModule.OpType[p.type],
          indices,
        );
        indices.delete();
      });
    });

    const stepsPerBatch = 2000; // Chunk size per batch
    let lastUiUpdateTime = performance.now();

    const intermediateRegs = [];
    for (let r = 0; r < 16; r++) {
      intermediateRegs.push(cpu.get_reg(r));
    }
    setRegs(intermediateRegs);
    setFlags({ z: cpu.flag_z, n: cpu.flag_n });

    const runBatch = () => {
      if (stopRequestedRef.current) {
        finalizeProgramState();
        return;
      }

      let stepsThisBatch = 0;

      while (cpu.pc < program.length && stepsThisBatch < stepsPerBatch) {
        const line = program[cpu.pc];
        const parts = line.replace(/,/g, " ").trim().split(/\s+/);
        const opName = parts[0].toUpperCase();

        const isCustomOpcode = savedOpcodes[opName] !== undefined;

        if (!isCustomOpcode) {
          alert(`file.asm:${cpu.pc + 1}: error: instruction expected`);
          cleanupAndReset();
          return;
        }

        const args = new wasmModule.VectorInt();
        let validationFailed = false;
        const customOpDef = savedOpcodes[opName];

        for (let i = 1; i < parts.length; i++) {
          let valStr = parts[i].toUpperCase().replace(/[^0-9A-Z-]/g, "");
          const argIdx = i - 1;

          const expectsImmediate = customOpDef.sequence.some((p) => {
            if (p.type === "MOVI" && p.arg_indices[1] === argIdx) return true;
            if (
              (p.type === "JMP" ||
                p.type === "JMP_EQ" ||
                p.type === "JMP_NE") &&
              p.arg_indices[0] === argIdx
            )
              return true;
            return false;
          });

          if (expectsImmediate) {
            let constantVal = parseInt(valStr, 10);
            if (isNaN(constantVal)) {
              alert(
                `file.asm:${cpu.pc + 1}: error: expected immediate value or constant, got "${parts[i]}"`,
              );
              validationFailed = true;
              break;
            }
            args.push_back(constantVal);
          } else {
            if (!valStr.startsWith("R")) {
              alert(
                `file.asm:${cpu.pc + 1}: error: invalid combination of opcode and operands`,
              );
              validationFailed = true;
              break;
            }

            let regIndex = parseInt(valStr.substring(1), 10);
            if (isNaN(regIndex) || regIndex < 0 || regIndex > 15) {
              alert(
                `file.asm:${cpu.pc + 1}: error: register name out of range (unknown register "${parts[i]}")`,
              );
              validationFailed = true;
              break;
            }
            args.push_back(regIndex);
          }
        }

        if (validationFailed) {
          args.delete();
          cleanupAndReset();
          return;
        }

        interpreter.step(cpu, opName, args);
        args.delete();
        stepsThisBatch++;
      }

      if (cpu.pc >= program.length) {
        finalizeProgramState();
      } else {
        const now = performance.now();
        if (now - lastUiUpdateTime >= 1000) {
          const intermediateRegs = [];
          for (let r = 0; r < 16; r++) {
            intermediateRegs.push(cpu.get_reg(r));
          }
          setRegs(intermediateRegs);
          setFlags({ z: cpu.flag_z, n: cpu.flag_n });
          lastUiUpdateTime = now;
        }

        setTimeout(runBatch, 0);
      }
    };

    const finalizeProgramState = () => {
      const updatedRegs = [];
      for (let r = 0; r < 16; r++) {
        updatedRegs.push(cpu.get_reg(r));
      }
      setRegs(updatedRegs);
      setFlags({ z: cpu.flag_z, n: cpu.flag_n });
      cleanupAndReset();
    };

    const cleanupAndReset = () => {
      interpreter.delete();
      cpu.delete();
      setIsRunning(false);
    };

    runBatch();
  };

  return (
    <div className="bg-slate-950 text-slate-200 min-h-screen flex flex-col font-sans antialiased select-none">
      {/* Top Navigation Bar */}
      <header className="bg-slate-900 border-b border-slate-800 p-3 flex justify-between items-center shadow-md z-10">
        <div className="flex items-center gap-4">
          <span className="font-bold text-lg tracking-wide text-blue-400">
            Unscripted Blocks Studio
          </span>
        </div>

        {/* Execution Controller */}
        <div className="flex items-center gap-2">
          <button
            onClick={executeProgram}
            disabled={!engineReady}
            className={`flex items-center gap-1.5 font-bold px-4 py-1.5 rounded-full text-sm transition-all shadow ${
              engineReady
                ? "bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer active:scale-95 shadow-lg shadow-emerald-900/20"
                : "bg-slate-800 text-slate-500 cursor-not-allowed shadow-none"
            }`}
          >
            <span className="text-base">🏁</span>
            {engineReady ? "Go / Run Script" : "Loading Runtime..."}
          </button>
          <span className="text-gray-400/40">|</span>
          <button
            onClick={() => {
              stopRequestedRef.current = true;
            }}
            className="flex items-center gap-1.5 font-bold px-4 py-1.5 rounded-full text-sm bg-rose-600 hover:bg-rose-500 text-white cursor-pointer active:scale-95 shadow-lg shadow-rose-900/20 transition-all"
          >
            <span className="text-xs">🛑</span>
            Stop Script
          </button>
        </div>
      </header>

      {/* Main Window */}
      <main className="flex-1 flex p-3 gap-3 h-[calc(100vh-3.5rem)] overflow-hidden">
        {/* Pane 1: Block Palette (Left Column) */}
        <aside className="w-64 bg-slate-900 border border-slate-800 rounded-xl flex flex-col shadow-sm overflow-hidden">
          <div className="p-3 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
            <span className="font-bold text-xs text-slate-500 uppercase tracking-wider">
              Block Toolbox
            </span>
          </div>

          <div className="p-3 space-y-3 overflow-y-auto flex-1">
            {Object.entries(PRIMITIVE_CONFIG).map(([type, config]) => (
              <div key={type} className="space-y-1">
                <div
                  draggable
                  onDragStart={(e) => handleDragStartToolbox(e, type)}
                  className={`px-3 py-2 text-sm font-semibold rounded-lg shadow-sm border-b-2 cursor-grab active:cursor-grabbing hover:translate-x-0.5 transition-transform select-none ${config.color}`}
                >
                  <span className="mr-1.5 text-xs opacity-60">⁝⁝</span>
                  {type}
                </div>
                <div className="text-[10px] text-slate-500 font-medium pl-1">
                  {config.group}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Pane 2: Target Script Canvas Workspace (Center Area) */}
        <section className="flex-1 flex flex-col gap-3 h-full overflow-hidden">
          <div className="bg-slate-900 border border-slate-800 rounded-xl flex-1 flex flex-col shadow-sm overflow-hidden">
            {/* Custom Block Assembly Builder Input Header */}
            <div className="p-3 bg-slate-950 border-b border-slate-800 flex flex-wrap gap-2 items-center">
              <input
                type="text"
                value={opcodeName}
                onChange={(e) => setOpcodeName(e.target.value)}
                placeholder="Make a Block Identifier..."
                className="bg-slate-900 px-3 py-1.5 border border-slate-700 rounded-lg text-sm text-slate-200 outline-none focus:border-blue-500 w-48 font-medium shadow-inner placeholder-slate-500"
              />

              <div className="flex items-center gap-1.5 px-2 text-xs font-semibold text-slate-400">
                <span>Inputs:</span>
                <select
                  value={opcodeArgsCount}
                  onChange={(e) =>
                    setOpcodeArgsCount(parseInt(e.target.value, 10))
                  }
                  className="bg-slate-900 border border-slate-700 p-1 rounded text-slate-200 outline-none cursor-pointer"
                >
                  {Array.from({ length: 16 }).map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1} {i + 1 === 1 ? "variable" : "variables"}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={saveOpcode}
                className="ml-auto bg-orange-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-orange-500 active:scale-95 transition-all shadow-sm"
              >
                + Add Custom Block
              </button>
            </div>

            {/* Script Container Block Stacking Dropzone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingOver(true);
              }}
              onDragLeave={() => setIsDraggingOver(false)}
              onDrop={handleDropOnCanvas}
              className={`flex-1 overflow-y-auto p-4 flex flex-col items-start gap-1 transition-colors bg-slate-950 ${
                isDraggingOver
                  ? "bg-slate-900 border-2 border-dashed border-blue-500 rounded-b-xl"
                  : ""
              }`}
            >
              {activeSequence.map((prim, index) => (
                <div
                  key={prim.id}
                  className={`px-3 py-2 rounded-lg flex items-center gap-3 border-b-2 shadow-sm font-semibold text-sm select-none ${PRIMITIVE_CONFIG[prim.type].color}`}
                  style={{ marginLeft: `${index * 2}px` }}
                >
                  <div className="text-xs opacity-50 font-mono">
                    #{index + 1}
                  </div>
                  <div className="uppercase tracking-wide">{prim.type}</div>

                  {/* Argument Targets directly mapped as rounded entry points */}
                  <div className="flex items-center gap-2">
                    {PRIMITIVE_CONFIG[prim.type].labels.map((label, i) => (
                      <div
                        key={`${prim.id}-label-${i}`}
                        className="flex items-center gap-1 text-xs text-white/90"
                      >
                        {label && <span>{label}</span>}
                        <select
                          value={prim.arg_indices[i] || 0}
                          onChange={(e) =>
                            handleArgChange(prim.id, i, e.target.value)
                          }
                          className="bg-black/30 text-white px-1.5 py-0.5 rounded border border-white/20 outline-none cursor-pointer font-bold text-xs"
                        >
                          {Array.from({ length: opcodeArgsCount }).map(
                            (_, optIndex) => (
                              <option
                                key={optIndex}
                                value={optIndex}
                                className="text-slate-800 font-normal"
                              >
                                Arg {optIndex}
                              </option>
                            ),
                          )}
                        </select>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => removeBlock(index)}
                    className="text-white/60 hover:text-white ml-2 text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>
              ))}

              {activeSequence.length === 0 && (
                <div className="text-xs text-slate-500 italic m-auto tracking-wide text-center max-w-xs">
                  Drag blocks here from the left menu to build out your
                  execution stack sequence.
                </div>
              )}
            </div>

            {/* Custom Block Storage Library Drawer */}
            <div className="p-3 border-t border-slate-800 bg-slate-900 h-32 flex flex-col shrink-0">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                My Blocks (Saved Extensions)
              </span>
              <div className="flex-1 overflow-y-auto flex flex-wrap gap-2 items-start">
                {Object.keys(savedOpcodes).length === 0 ? (
                  <div className="text-xs text-slate-500 italic p-1">
                    No custom blocks defined yet.
                  </div>
                ) : (
                  Object.entries(savedOpcodes).map(([name, data]) => (
                    <div
                      key={name}
                      className="flex items-center gap-1.5 bg-orange-950/40 border border-orange-800/40 text-orange-400 px-2 py-1 rounded-lg text-xs font-semibold"
                    >
                      <button
                        onClick={() => loadOpcode(name)}
                        className="font-bold uppercase hover:underline"
                      >
                        {name}
                      </button>
                      <span className="text-[10px] opacity-70">
                        ({data.argsCount} args)
                      </span>
                      <button
                        onClick={() => deleteOpcode(name)}
                        className="text-rose-400 hover:text-rose-300 font-bold ml-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Assembly Editor Pane */}
          <div className="h-40 bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col shrink-0 shadow-sm">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Text Workspace (Assembly Code)
            </span>
            <textarea
              ref={assemblyEditorRef}
              className="flex-1 w-full border border-slate-800 rounded-lg bg-slate-950 p-2 font-mono text-xs text-slate-300 outline-none focus:border-blue-500 resize-none placeholder-slate-600 line-height-[1.4]"
              placeholder={`; Workspace Scripts\nMOVI R0, 10\nMOVI R1, 5\nADD R2, R0, R1`}
            />
          </div>
        </section>

        {/* Pane 3: System Stage Boundaries (Right Column) */}
        <aside className="w-64 bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col h-full shadow-sm overflow-hidden">
          <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-800">
            <span className="font-bold text-xs text-slate-500 uppercase tracking-wider">
              CPU Stage Context
            </span>
            <div className="flex gap-1.5 text-[11px] font-bold font-mono">
              <span
                className={`px-1.5 py-0.5 rounded ${flags.z ? "bg-green-950/80 text-green-400 border border-green-800/60" : "bg-slate-950 text-slate-600 border border-slate-800/40"}`}
              >
                Z
              </span>
              <span
                className={`px-1.5 py-0.5 rounded ${flags.n ? "bg-rose-950/80 text-rose-400 border border-rose-800/60" : "bg-slate-950 text-slate-600 border border-slate-800/40"}`}
              >
                N
              </span>
            </div>
          </div>

          <div className="space-y-1 overflow-y-auto flex-1 grid grid-cols-2 gap-1.5 content-start pr-0.5">
            {regs.map((val, idx) => (
              <div
                key={idx}
                className="bg-slate-950 border border-slate-800/60 rounded-lg p-2 flex flex-col justify-between items-start gap-0.5"
              >
                <span className="text-[10px] text-slate-500 font-bold font-mono">
                  {`R${idx}`}
                </span>
                <span
                  className={`text-sm font-bold font-mono ${val !== 0 ? "text-blue-400" : "text-slate-600"}`}
                >
                  {val}
                </span>
              </div>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}
