/*
    Copyright (C) 2026 Onish Sharma

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

#ifndef INTERPRETER_HPP
#define INTERPRETER_HPP

#include <cstdint>
#include <emscripten/bind.h>
#include <string>
#include <unordered_map>
#include <vector>

using namespace emscripten;

enum class OpType {
  ADD,
  SUB,
  CMP,
  MOV,
  MOVI,
  LOAD,
  STORE,
  JMP,
  JMP_EQ,
  JMP_NE,
  MUL,
  DIV
};

struct Primitive {
  OpType type;
  std::vector<int32_t> arg_indices;
};

struct Instruction {
  std::string name;
  std::vector<Primitive> sequence;
};

class CPU {
public:
  int32_t regs[16] = {0};       // R0-R15
  int32_t memory[524288] = {0}; // 2MB Black-box heap zero-initialized
  bool flag_z = false;
  bool flag_n = false;
  uint32_t pc = 0;

  void execute_primitive(const Primitive &p,
                         const std::vector<int32_t> &instr_args) {
    switch (p.type) {
    case OpType::ADD: {
      int32_t dest = instr_args[p.arg_indices[0]];
      int32_t src1 = instr_args[p.arg_indices[1]];
      int32_t src2 = instr_args[p.arg_indices[2]];
      regs[dest] = regs[src1] + regs[src2];
      break;
    }
    case OpType::SUB: {
      int32_t dest = instr_args[p.arg_indices[0]];
      int32_t src1 = instr_args[p.arg_indices[1]];
      int32_t src2 = instr_args[p.arg_indices[2]];
      regs[dest] = regs[src1] - regs[src2];
      break;
    }
    case OpType::CMP: {
      int32_t val1 = regs[instr_args[p.arg_indices[0]]];
      int32_t val2 = regs[instr_args[p.arg_indices[1]]];
      flag_z = (val1 == val2);
      flag_n = (val1 < val2);
      break;
    }
    case OpType::MOV: {
      int32_t dest = instr_args[p.arg_indices[0]];
      int32_t src = instr_args[p.arg_indices[1]];
      regs[dest] = regs[src];
      break;
    }
    case OpType::LOAD: {
      int32_t dest = instr_args[p.arg_indices[0]];
      int32_t addr = instr_args[p.arg_indices[1]];
      if (addr >= 0 && addr < 524288)
        regs[dest] = memory[addr];
      break;
    }
    case OpType::STORE: {
      int32_t src = instr_args[p.arg_indices[0]];
      int32_t addr = instr_args[p.arg_indices[1]];
      if (addr >= 0 && addr < 524288)
        memory[addr] = regs[src];
      break;
    }
    case OpType::JMP: {
      pc = instr_args[p.arg_indices[0]];
      break;
    }
    case OpType::JMP_EQ: {
      if (flag_z)
        pc = instr_args[p.arg_indices[0]];
      break;
    }
    case OpType::JMP_NE: {
      if (!flag_z)
        pc = instr_args[p.arg_indices[0]];
      break;
    }
    case OpType::MOVI: {
      int32_t dest = instr_args[p.arg_indices[0]];
      int32_t imm = instr_args[p.arg_indices[1]];
      regs[dest] = imm;
      break;
    }
    case OpType::MUL: {
      int32_t dest = instr_args[p.arg_indices[0]];
      int32_t src1 = instr_args[p.arg_indices[1]];
      int32_t src2 = instr_args[p.arg_indices[2]];
      regs[dest] = regs[src1] * regs[src2];
      break;
    }
    case OpType::DIV: {
      int32_t dest = instr_args[p.arg_indices[0]];
      int32_t src1 = instr_args[p.arg_indices[1]];
      int32_t src2 = instr_args[p.arg_indices[2]];
      regs[dest] = regs[src1] / regs[src2];
      break;
    }
    }
  }
};

class Interpreter {
  std::unordered_map<std::string, Instruction> isa_table;

public:
  // Flat Builder interface to completely sidestep complex nested structures
  // over Embind
  void register_instruction(const std::string &name) {
    isa_table[name] = Instruction{name, {}};
  }

  void add_primitive_to_instruction(const std::string &name, OpType type,
                                    const std::vector<int32_t> &arg_indices) {
    if (isa_table.find(name) != isa_table.end()) {
      isa_table[name].sequence.push_back(Primitive{type, arg_indices});
    }
  }

  void step(CPU &cpu, const std::string &op_name,
            const std::vector<int32_t> &args) {
    uint32_t old_pc = cpu.pc;

    if (isa_table.find(op_name) != isa_table.end()) {
      const Instruction &instr = isa_table.at(op_name);
      for (const auto &prim : instr.sequence) {
        cpu.execute_primitive(prim, args);
      }
    }

    // If a execution flow branch primitive didn't change PC explicitly, move
    // onward sequentially
    if (cpu.pc == old_pc) {
      cpu.pc++;
    }
  }
};

EMSCRIPTEN_BINDINGS(unscripted_studio) {
  enum_<OpType>("OpType")
      .value("ADD", OpType::ADD)
      .value("SUB", OpType::SUB)
      .value("CMP", OpType::CMP)
      .value("MOV", OpType::MOV)
      .value("MOVI", OpType::MOVI)
      .value("LOAD", OpType::LOAD)
      .value("STORE", OpType::STORE)
      .value("JMP", OpType::JMP)
      .value("JMP_EQ", OpType::JMP_EQ)
      .value("JMP_NE", OpType::JMP_NE)
      .value("MUL", OpType::MUL)
      .value("DIV", OpType::DIV);

  register_vector<int32_t>("VectorInt");

  class_<CPU>("CPU")
      .constructor()
      .property("pc", &CPU::pc)
      .property("flag_z", &CPU::flag_z)
      .property("flag_n", &CPU::flag_n)
      .function("get_reg", optional_override([](CPU &self, int index) {
                  return (index >= 0 && index < 16) ? self.regs[index] : 0;
                }));

  class_<Interpreter>("Interpreter")
      .constructor()
      .function("register_instruction", &Interpreter::register_instruction)
      .function("add_primitive_to_instruction",
                &Interpreter::add_primitive_to_instruction)
      .function("step", &Interpreter::step);
}
#endif
