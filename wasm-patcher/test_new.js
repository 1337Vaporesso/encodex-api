const fs = require("fs");
const { WasmPatcher } = require("./patcher_glue.js");

// ====== Helper: build simple MP4 boxes ======
function flatten(arr) {
  const result = [];
  for (const item of arr) {
    if (item instanceof Uint8Array) result.push(...item);
    else if (Array.isArray(item)) result.push(...flatten(item));
    else result.push(item);
  }
  return result;
}

function u8(v) { return v & 0xFF; }
function be32(v) { return [u8(v>>24), u8(v>>16), u8(v>>8), u8(v)]; }
function box(type, ...contents) {
  const data = flatten(contents);
  const buf = new Uint8Array(8 + data.length);
  buf.set(new Uint8Array(be32(8 + data.length).concat([type.charCodeAt(0),type.charCodeAt(1),type.charCodeAt(2),type.charCodeAt(3)])), 0);
  buf.set(new Uint8Array(data), 8);
  return buf;
}
function sttsBox(version, entries) {
  const body = [version, 0, 0, 0];
  body.push(...be32(entries.length));
  for (const e of entries) body.push(...be32(e.count), ...be32(e.delta));
  return box("stts", body);
}
function mdhdBoxV0(timescale, duration) {
  return box("mdhd", [0,0,0,0], be32(0), be32(0), be32(timescale), be32(duration));
}
function mdhdBoxV1(timescale, duration) {
  return box("mdhd", [1,0,0,0], be32(0), be32(0), be32(0), be32(0), be32(timescale), be32(duration), be32(0));
}
function mdiaBox(mdhd, stbl) {
  return box("mdia", mdhd, box("minf", box("stbl", stbl)));
}
function trakBox(mdhd, stts) {
  return box("trak", mdiaBox(mdhd, stts));
}

// ====== Tests ======
async function run() {
  const patcher = new WasmPatcher();
  const wasmBytes = fs.readFileSync("patcher.wasm");
  const { instance } = await WebAssembly.instantiate(wasmBytes, {});
  patcher._memory = instance.exports.memory;
  patcher._patch = instance.exports.patch;

  let passed = 0, failed = 0;

  function test(name, buildFile, checks) {
    const file = buildFile();
    const result = patcher.patch(file.buffer);
    const data = new Uint8Array(result);
    const errs = checks(data);
    if (errs.length === 0) {
      console.log(`  PASS: ${name}`);
      passed++;
    } else {
      console.log(`  FAIL: ${name}`);
      for (const e of errs) console.log(`    ${e}`);
      failed++;
    }
  }

  function r32(data, off) {
    return (data[off]<<24) | (data[off+1]<<16) | (data[off+2]<<8) | data[off+3];
  }

  function findBox(data, type) {
    const tc = type.charCodeAt(0)<<24 | type.charCodeAt(1)<<16 | type.charCodeAt(2)<<8 | type.charCodeAt(3);
    for (let i = 0; i < data.length - 8; i++) {
      if (r32(data, i+4) === tc) return i;
    }
    return -1;
  }

  // Test 1: stts with multiple entries → constant 1500 delta
  test("stts rewritten with constant 1500 delta",
    () => {
      const stts = sttsBox(0, [{count:50,delta:3000},{count:30,delta:5000},{count:20,delta:4000}]);
      const mdhd = mdhdBoxV0(30000, 380000);
      return box("moov", trakBox(mdhd, stts));
    },
    (data) => {
      const errs = [];
      const sttsOff = findBox(data, "stts");
      if (sttsOff < 0) return ["stts box not found"];
      const dOff = sttsOff + 8;
      const ec = r32(data, dOff+4);
      const sc = r32(data, dOff+8);
      const sd = r32(data, dOff+12);
      if (ec !== 1) errs.push(`stts entry_count=${ec}, expected 1`);
      if (sc !== 100) errs.push(`stts sample_count=${sc}, expected 100`);
      if (sd !== 1500) errs.push(`stts delta=${sd}, expected 1500 (RYU constant)`);

      const mdhdOff = findBox(data, "mdhd");
      if (mdhdOff >= 0) {
        const mOff = mdhdOff + 8;
        const ts = r32(data, mOff+12);
        const dur = r32(data, mOff+16);
        if (ts !== 90000) errs.push(`mdhd timescale=${ts}, expected 90000`);
        if (dur !== 150000) errs.push(`mdhd duration=${dur}, expected ${100*1500}`);
      }
      return errs;
    }
  );

  // Test 2: stts with 1 entry is also rewritten
  test("stts with 1 entry rewritten to 1500",
    () => {
      const stts = sttsBox(0, [{count:100,delta:1}]);
      const mdhd = mdhdBoxV0(30000, 100);
      return box("moov", trakBox(mdhd, stts));
    },
    (data) => {
      const errs = [];
      const sttsOff = findBox(data, "stts");
      if (sttsOff < 0) return ["stts box not found"];
      const dOff = sttsOff + 8;
      const ec = r32(data, dOff+4);
      const sc = r32(data, dOff+8);
      const sd = r32(data, dOff+12);
      if (ec !== 1) errs.push(`entry_count=${ec}, expected 1`);
      if (sc !== 100) errs.push(`sample_count=${sc}, expected 100`);
      if (sd !== 1500) errs.push(`delta=${sd}, expected 1500`);

      const mdhdOff = findBox(data, "mdhd");
      if (mdhdOff >= 0) {
        const ts = r32(data, mdhdOff+8+12);
        const dur = r32(data, mdhdOff+8+16);
        if (ts !== 90000) errs.push(`timescale=${ts}, expected 90000`);
        if (dur !== 150000) errs.push(`duration=${dur}, expected ${100*1500}`);
      }
      return errs;
    }
  );

  // Test 3: mdhd v1
  test("mdhd v1 with 64-bit duration",
    () => {
      const stts = sttsBox(0, [{count:50,delta:6000}]);
      const mdhd = mdhdBoxV1(30000, 300000);
      return box("moov", trakBox(mdhd, stts));
    },
    (data) => {
      const errs = [];
      const mdhdOff = findBox(data, "mdhd");
      if (mdhdOff < 0) return ["mdhd box not found"];
      const mOff = mdhdOff + 8;
      const ts = r32(data, mOff+20);
      const durLo = r32(data, mOff+24);
      const durHi = r32(data, mOff+28);
      if (ts !== 90000) errs.push(`timescale=${ts}, expected 90000`);
      if (durLo !== 75000) errs.push(`duration low=${durLo}, expected ${50*1500}`);
      if (durHi !== 0) errs.push(`duration high=${durHi}, expected 0`);

      const sttsOff = findBox(data, "stts");
      if (sttsOff < 0) return errs.concat(["stts not found"]);
      const sc = r32(data, sttsOff+8+8);
      const sd = r32(data, sttsOff+8+12);
      if (sc !== 50) errs.push(`sample_count=${sc}, expected 50`);
      if (sd !== 1500) errs.push(`delta=${sd}, expected 1500`);
      return errs;
    }
  );

  // Test 4: 64-bit box size
  test("64-bit box size handled",
    () => {
      const sttsFull = sttsBox(0, [{count:60,delta:1000},{count:40,delta:2000}]);
      const stblSize = 8 + 8 + sttsFull.length;
      const stbl = new Uint8Array([0,0,0,1, 0x73,0x74,0x62,0x6C, ...be32(0), ...be32(stblSize), ...sttsFull]);
      const mdhd = mdhdBoxV0(30000, 140000);
      return box("moov", box("trak", box("mdia", mdhd, box("minf", stbl))));
    },
    (data) => {
      const errs = [];
      const sttsOff = findBox(data, "stts");
      if (sttsOff < 0) return ["stts box not found in patched output"];
      const dOff = sttsOff + 8;
      const ec = r32(data, dOff+4);
      const sc = r32(data, dOff+8);
      const sd = r32(data, dOff+12);
      if (ec !== 1) errs.push(`entry_count=${ec}`);
      if (sc !== 100) errs.push(`sample_count=${sc}`);
      if (sd !== 1500) errs.push(`delta=${sd}, expected 1500`);
      return errs;
    }
  );

  // Test 5: 2 tracks
  test("multi-track: both stts patched to 1500",
    () => {
      const stts1 = sttsBox(0, [{count:50,delta:3000},{count:30,delta:5000}]);
      const mdhd1 = mdhdBoxV0(60000, 300000);
      const stts2 = sttsBox(0, [{count:100,delta:1024}]);
      const mdhd2 = mdhdBoxV0(48000, 102400);
      return box("moov", trakBox(mdhd1, stts1), trakBox(mdhd2, stts2));
    },
    (data) => {
      const errs = [];
      let count = 0;
      for (let i = 0; i < data.length - 8; i++) {
        if (r32(data, i+4) === 0x73747473) {
          const dOff = i + 8;
          const ec = r32(data, dOff+4);
          const sc = r32(data, dOff+8);
          const sd = r32(data, dOff+12);
          if (ec !== 1) errs.push(`stts #${count} entry_count=${ec}`);
          if (sd !== 1500) errs.push(`stts #${count} delta=${sd}, expected 1500`);
          if (count === 0 && sc !== 80) errs.push(`video stts sample_count=${sc}, expected 80`);
          count++;
        }
      }
      if (count !== 2) errs.push(`Found ${count} stts boxes, expected 2`);

      // Check mdhd
      let mdhdCount = 0;
      for (let i = 0; i < data.length - 8; i++) {
        if (r32(data, i+4) === 0x6D646864) {
          const mOff = i + 8;
          const ts = r32(data, mOff+12);
          const dur = r32(data, mOff+16);
          if (ts !== 90000) errs.push(`mdhd #${mdhdCount} timescale=${ts}, expected 90000`);
          if (mdhdCount === 0 && dur !== 80*1500) errs.push(`mdhd #0 duration=${dur}, expected ${80*1500}`);
          if (mdhdCount === 1 && dur !== 100*1500) errs.push(`mdhd #1 duration=${dur}, expected ${100*1500}`);
          mdhdCount++;
        }
      }
      if (mdhdCount !== 2) errs.push(`Found ${mdhdCount} mdhd boxes, expected 2`);
      return errs;
    }
  );

  console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed+failed} tests`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
