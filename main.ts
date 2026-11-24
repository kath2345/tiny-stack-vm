// Faithful interpreter of make.fun's tiny stack ISA v1 (kit: ISA.md; vm.mjs is the rule).
// Reads every /input/<id>/ program, writes /output/<id>/stdout.bin + exit.txt.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const E = new TextEncoder();
// Per opcode byte, packed (imm<<4 | pops<<2 | pushes) + 1; 0 = no such opcode.
const T = new Uint8Array(256);
for (const [o, v] of [[0, 1], [1, 18], [2, 66], [3, 5], [4, 7], [5, 11], [6, 12], [7, 16], [16, 10], [17, 10], [18, 10], [19, 10], [20, 10], [21, 10], [22, 10], [23, 6], [24, 10], [25, 10], [26, 10], [27, 6], [28, 10], [29, 10], [30, 10], [32, 10], [33, 10], [34, 10], [48, 33], [49, 37], [50, 37], [51, 33], [52, 1], [64, 6], [65, 9], [80, 5], [81, 5], [82, 2], [83, 5]]) T[o] = v;
function run(p: Uint8Array, inp: Uint8Array) {
  const n = p.length, D = new Int32Array(256), C = new Int32Array(64), M = new Int32Array(256), out = new Uint8Array(65536);
  let sp = 0, cp = 0, ol = 0, ip = 0, pc = 0, steps = 0;
  const done = (c: number) => ({ out: out.slice(0, ol), code: c });
  for (;;) {
    if (steps === 1000000) return done(10);
    if (pc < 0 || pc >= n) return done(9);
    const t = T[p[pc]];
    if (!t) return done(5);
    const q = t - 1, imm = q >> 4, pops = (q >> 2) & 3;
    if (pc + imm >= n) return done(9);
    steps++;
    const next = pc + 1 + imm, op = p[pc];
    if (sp < pops) return done(2);
    if (sp - pops + (q & 3) > 256) return done(3);
    pc = next;
    switch (op) {
      case 0: return done(0);
      case 1: D[sp++] = (p[next - 1] << 24) >> 24; break;
      case 2: D[sp++] = p[next - 4] | (p[next - 3] << 8) | (p[next - 2] << 16) | (p[next - 1] << 24); break;
      case 3: sp--; break;
      case 4: D[sp] = D[sp - 1]; sp++; break;
      case 5: { const t = D[sp - 1]; D[sp - 1] = D[sp - 2]; D[sp - 2] = t; break; }
      case 6: D[sp] = D[sp - 2]; sp++; break;
      case 7: { const a = D[sp - 3]; D[sp - 3] = D[sp - 2]; D[sp - 2] = D[sp - 1]; D[sp - 1] = a; break; }
      case 23: D[sp - 1] = -D[sp - 1] | 0; break;
      case 27: D[sp - 1] = ~D[sp - 1]; break;
      case 16: case 17: case 18: case 19: case 20: case 21: case 22: case 24: case 25: case 26: case 28: case 29: case 30: case 32: case 33: case 34: {
        const b = D[sp - 1], a = D[sp - 2];
        let r = 0;
        if (op === 16) r = (a + b) | 0;
        else if (op === 17) r = (a - b) | 0;
        else if (op === 18) r = Math.imul(a, b);
        else if (op === 19) { if (!b) return done(4); r = a === -2147483648 && b === -1 ? a : (a / b) | 0; }
        else if (op === 20) { if (!b) return done(4); r = b === -1 ? 0 : (a % b) | 0; }
        else if (op === 21) { if (!b) return done(4); r = Math.floor((a >>> 0) / (b >>> 0)) | 0; }
        else if (op === 22) { if (!b) return done(4); r = ((a >>> 0) % (b >>> 0)) | 0; }
        else if (op === 24) r = a & b;
        else if (op === 25) r = a | b;
        else if (op === 26) r = a ^ b;
        else if (op === 28) r = a << (b & 31);
        else if (op === 29) r = a >> (b & 31);
        else if (op === 30) r = (a >>> (b & 31)) | 0;
        else if (op === 32) r = a === b ? 1 : 0;
        else if (op === 33) r = a < b ? 1 : 0;
        else r = (a >>> 0) < (b >>> 0) ? 1 : 0;
        sp -= 2; D[sp++] = r; break;
      }
      case 48: case 49: case 50: {
        const rel = ((p[next - 2] | (p[next - 1] << 8)) << 16) >> 16;
        let take = true;
        if (op !== 48) { const v = D[--sp]; take = op === 49 ? v === 0 : v !== 0; }
        if (take) pc = next + rel;
        break;
      }
      case 51: if (cp === 64) return done(7); C[cp++] = next; pc = p[next - 2] | (p[next - 1] << 8); break;
      case 52: if (cp === 0) return done(8); pc = C[--cp]; break;
      case 64: { const a = D[sp - 1]; if (a < 0 || a >= 256) return done(6); D[sp - 1] = M[a]; break; }
      case 65: { const a = D[sp - 1], v = D[sp - 2]; if (a < 0 || a >= 256) return done(6); sp -= 2; M[a] = v; break; }
      case 80: { const b = E.encode(String(D[sp - 1])); if (ol + b.length > 65536) return done(11); sp--; out.set(b, ol); ol += b.length; break; }
      case 81: if (ol + 1 > 65536) return done(11); out[ol++] = D[--sp] & 255; break;
      case 82: D[sp++] = ip < inp.length ? inp[ip++] : -1; break;
      case 83: return done(D[--sp] & 255);
    }
  }
}
const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const id of readdirSync(I).sort()) {
  const r = run(new Uint8Array(readFileSync(join(I, id, 'program.bin'))), new Uint8Array(readFileSync(join(I, id, 'input.bin'))));
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'stdout.bin'), r.out);
  writeFileSync(join(O, id, 'exit.txt'), r.code + '\n');
}
