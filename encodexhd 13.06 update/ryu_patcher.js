/* RYU-style: parse → replace → rebuild → concat */

const RYU = {
  VIDEO_TIMESCALE: 90000,
  VIDEO_SAMPLE_DELTA: 1500,
  VIDEO_EDIT_MEDIA_TIME: 3000,
};

function r32(dv, off) { return dv.getUint32(off, false); }
function w32(dv, off, v) { dv.setUint32(off, v, false); }

/* ─── Box tree parsing ─── */
function parseBoxes(dv, buf, start, end) {
  const root = { type: 'root', offset: start, size: end - start, children: [], path: '' };
  let off = start;
  while (off + 8 <= end) {
    let size = r32(dv, off);
    const ty = r32(dv, off + 4);
    if (size < 8) break;
    let inner;
    if (size === 1) {
      if (off + 16 > end) break;
      const hi = r32(dv, off + 8), lo = r32(dv, off + 12);
      size = hi * 0x100000000 + lo;
      inner = off + 16;
    } else {
      inner = off + 8;
    }
    if (off + size > end) break;
    const type = String.fromCharCode((ty>>24)&0xFF, (ty>>16)&0xFF, (ty>>8)&0xFF, ty&0xFF);
    const box = {
      type, offset: off, size, headerSize: inner - off,
      data: new Uint8Array(buf, off, size),
      children: [],
      path: root.path ? root.path + '/' + type : type,
      _dv: dv,
    };
    root.children.push(box);
    const CONTAINERS = new Set(['moov','trak','mdia','minf','stbl','edts','dinf','moof','traf','udta']);
    if (CONTAINERS.has(type)) {
      const children = parseBoxes(dv, buf, inner, off + size);
      box.children = children.children;
    }
    off += size;
  }
  return root;
}

function cloneBuf(arr) {
  const r = new Uint8Array(arr.length);
  r.set(arr);
  return r;
}

function concatBytes(arrays) {
  let total = 0;
  for (let i = 0; i < arrays.length; i++) total += arrays[i].length;
  const r = new Uint8Array(total);
  let off = 0;
  for (let i = 0; i < arrays.length; i++) { r.set(arrays[i], off); off += arrays[i].length; }
  return r;
}

function makeBox(type, payload) {
  const tc = (type.charCodeAt(0)<<24)|(type.charCodeAt(1)<<16)|(type.charCodeAt(2)<<8)|type.charCodeAt(3);
  const buf = new Uint8Array(8 + payload.length);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0, 8 + payload.length, false);
  dv.setUint32(4, tc, false);
  buf.set(payload, 8);
  return buf;
}

/* ─── Builders ─── */
function buildStts(sampleCount) {
  const p = new Uint8Array(16);
  const dv = new DataView(p.buffer);
  w32(dv, 0, 0);        /* version+flags */
  w32(dv, 4, 1);         /* entry_count */
  w32(dv, 8, sampleCount);
  w32(dv, 12, RYU.VIDEO_SAMPLE_DELTA);
  return makeBox('stts', p);
}

function buildMdhd(timescale, duration) {
  const p = new Uint8Array(20);
  const dv = new DataView(p.buffer);
  w32(dv, 0, 0);  /* version+flags */
  w32(dv, 4, 0);  /* creation_time */
  w32(dv, 8, 0);  /* modification_time */
  w32(dv, 12, timescale);
  w32(dv, 16, duration);
  return makeBox('mdhd', p);
}

function buildElst() {
  const p = new Uint8Array(20);
  const dv = new DataView(p.buffer);
  w32(dv, 0, 0);                 /* version+flags */
  w32(dv, 4, 1);                 /* entry_count */
  w32(dv, 8, 0);                 /* segment_duration */
  w32(dv, 12, RYU.VIDEO_EDIT_MEDIA_TIME);
  w32(dv, 16, 0x00010000);       /* media_rate 1.0 */
  return makeBox('elst', p);
}

/* ─── rebuildBox: recurse tree, replace matching boxes ─── */
function rebuildBox(box, replacements) {
  if (replacements.has(box)) return replacements.get(box)();

  if (!box.children || !box.children.length) {
    return cloneBuf(box.data);
  }

  const parts = [cloneBuf(box.data.subarray(0, box.headerSize))];
  for (let i = 0; i < box.children.length; i++) {
    parts.push(rebuildBox(box.children[i], replacements));
  }
  const result = concatBytes(parts);

  /* Update size field */
  const resultDV = new DataView(result.buffer, result.byteOffset, result.byteLength);
  resultDV.setUint32(0, result.length, false);
  return result;
}

/* ─── Main entry ─── */
function patchFile(buffer) {
  const buf = new Uint8Array(buffer);
  const dv = new DataView(buffer);
  const root = parseBoxes(dv, buffer, 0, buffer.byteLength);

  const moov = root.children.find(c => c.type === 'moov');
  if (!moov) return cloneBuf(buf).buffer;

  /* Collect stts and mdhd from each trak */
  const sttsList = [], mdhdList = [];
  function walkCollect(parent, type, list) {
    for (const c of parent.children) {
      if (c.type === type) list.push(c);
      walkCollect(c, type, list);
    }
  }
  for (const trak of moov.children) {
    if (trak.type !== 'trak') continue;
    walkCollect(trak, 'stts', sttsList);
    walkCollect(trak, 'mdhd', mdhdList);
  }

  /* Build replacements map */
  const repl = new Map();
  const pairs = Math.min(sttsList.length, mdhdList.length);
  for (let i = 0; i < pairs; i++) {
    const stts = sttsList[i];
    const mdhd = mdhdList[i];
    const sttsDV = dv; /* same DataView */
    const ec = r32(sttsDV, stts.offset + stts.headerSize + 4);
    if (ec === 0 || ec > 100000) continue;
    let totalSamples = 0;
    for (let j = 0; j < ec; j++) {
      totalSamples += r32(sttsDV, stts.offset + stts.headerSize + 8 + j * 8);
    }
    if (totalSamples === 0 || totalSamples > 1000000) continue;

    const sc = totalSamples;
    repl.set(stts, function() { return buildStts(sc); });
    repl.set(mdhd, function() { return buildMdhd(RYU.VIDEO_TIMESCALE, sc * RYU.VIDEO_SAMPLE_DELTA); });
  }

  /* Replace elst boxes */
  for (const trak of moov.children) {
    if (trak.type !== 'trak') continue;
    const edts = trak.children.find(c => c.type === 'edts');
    if (!edts) continue;
    const elst = edts.children.find(c => c.type === 'elst');
    if (!elst) continue;
    repl.set(elst, function() { return buildElst(); });
  }

  const newMoov = rebuildBox(moov, repl);

  /* Assemble output: keep boxes before/after moov as-is, replace moov */
  const parts = [];
  for (const child of root.children) {
    if (child === moov) {
      parts.push(newMoov);
    } else {
      parts.push(cloneBuf(child.data));
    }
  }
  return concatBytes(parts).buffer;
}

if (typeof module !== 'undefined') module.exports = { patchFile, parseBoxes, rebuildBox, buildStts, buildMdhd, buildElst };
