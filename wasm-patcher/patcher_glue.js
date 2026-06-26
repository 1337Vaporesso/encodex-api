class WasmPatcher {
  constructor() {
    this._memory = null;
    this._patch = null;
  }

  async init(wasmUrl) {
    const res = await fetch(wasmUrl);
    const bytes = await res.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes, {});
    this._memory = instance.exports.memory;
    this._patch = instance.exports.patch;
  }

  patch(buffer) {
    const src = new Uint8Array(buffer);
    const len = src.byteLength;
    const needed = Math.ceil(len / 65536);
    const current = this._memory.buffer.byteLength / 65536;
    if (needed > current) this._memory.grow(needed - current);
    new Uint8Array(this._memory.buffer, 0, len).set(src);
    this._patch(len);
    return new Uint8Array(this._memory.buffer, 0, len).buffer;
  }
}

if (typeof module !== 'undefined') module.exports = { WasmPatcher };
