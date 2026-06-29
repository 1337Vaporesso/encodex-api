'use strict';

const FAKE_SAMPLE_COUNT = 8573;
const FAKE_SAMPLE_SIZE = 8;
const FAKE_SAMPLE_BYTES = new Uint8Array([0, 0, 0, 4, 0, 0, 0, 0]);
const VIDEO_TIMESCALE = 90000;
const VIDEO_DURATION = 2269500;
const VIDEO_EDIT_MEDIA_TIME = 3000;
const VIDEO_SAMPLE_DELTA = 1500;

const CONTAINER_BOXES = new Set(["moov", "trak", "mdia", "minf", "stbl", "edts", "dinf", "udta", "meta", "ilst"]);

function getBoxType(data, offset) {
  return String.fromCharCode(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
}

function setBoxType(data, offset, type) {
  for (let i = 0; i < 4; i += 1) data[offset + i] = type.charCodeAt(i);
}

function assertUint32(value, label) {
  if (!Number.isFinite(value) || value < 0 || value > 4294967295)
    throw new Error(label + " fora do limite uint32: " + value);
}

function readBox(view, data, offset, end, path) {
  if (offset + 8 > end) throw new Error("MP4 invalido: caixa incompleta.");
  const rawSize = view.getUint32(offset, false);
  const type = getBoxType(data, offset + 4);
  let size = rawSize;
  let headerSize = 8;
  if (rawSize === 1) {
    if (offset + 16 > end) throw new Error("MP4 invalido: caixa " + type + " incompleta.");
    const hi = view.getUint32(offset + 8, false);
    const lo = view.getUint32(offset + 12, false);
    size = hi * 4294967296 + lo;
    headerSize = 16;
  } else if (rawSize === 0) {
    size = end - offset;
  }
  if (size < headerSize || offset + size > end)
    throw new Error("MP4 invalido: tamanho incorreto na caixa " + type + ".");
  return {
    type: type,
    offset: offset,
    size: size,
    headerSize: headerSize,
    contentStart: offset + headerSize,
    end: offset + size,
    path: path ? path + "/" + type : type,
    data: data,
    view: view,
    children: [],
    prefixStart: offset + headerSize,
    prefixEnd: offset + headerSize
  };
}

function childStartForBox(box) {
  if (box.type === "meta") return box.contentStart + 4;
  return box.contentStart;
}

function parseBoxes(data, view, offset, end, path) {
  const boxes = [];
  let pos = offset;
  while (pos + 8 <= end) {
    const box = readBox(view, data, pos, end, path);
    if (CONTAINER_BOXES.has(box.type)) {
      const childStart = childStartForBox(box);
      if (childStart > box.end) throw new Error("MP4 invalido: container " + box.type + " curto demais.");
      box.prefixStart = box.contentStart;
      box.prefixEnd = childStart;
      box.children = parseBoxes(data, view, childStart, box.end, box.path);
    }
    boxes.push(box);
    pos = box.end;
  }
  return boxes;
}

function findChild(parent, type) {
  return parent.children.find(function(c) { return c.type === type; }) || null;
}

function findDescendant(root, pathArray) {
  let current = root;
  for (const part of pathArray) {
    current = findChild(current, part);
    if (!current) return null;
  }
  return current;
}

function findTopLevel(roots, type) {
  return roots.find(function(r) { return r.type === type; }) || null;
}

function handlerTypeForTrak(trak) {
  const hdlr = findDescendant(trak, ["mdia", "hdlr"]);
  if (!hdlr || hdlr.offset + 20 > hdlr.end) return null;
  return getBoxType(hdlr.data, hdlr.offset + 16);
}

function parseStsz(stsz) {
  const sampleSize = stsz.view.getUint32(stsz.offset + 12, false);
  const sampleCount = stsz.view.getUint32(stsz.offset + 16, false);
  if (sampleSize) return new Array(sampleCount).fill(sampleSize);
  const start = stsz.offset + 20;
  if (start + sampleCount * 4 > stsz.end)
    throw new Error("MP4 invalido: stsz menor que a quantidade de samples declarada.");
  const sizes = [];
  for (let i = 0; i < sampleCount; i += 1) sizes.push(stsz.view.getUint32(start + i * 4, false));
  return sizes;
}

function parseStco(stco) {
  const count = stco.view.getUint32(stco.offset + 12, false);
  const start = stco.offset + 16;
  if (start + count * 4 > stco.end)
    throw new Error("MP4 invalido: stco menor que a quantidade de chunks declarada.");
  const offsets = [];
  for (let i = 0; i < count; i += 1) offsets.push(stco.view.getUint32(start + i * 4, false));
  return offsets;
}

function parseStsc(stsc) {
  const count = stsc.view.getUint32(stsc.offset + 12, false);
  const start = stsc.offset + 16;
  if (start + count * 12 > stsc.end)
    throw new Error("MP4 invalido: stsc menor que a quantidade de entradas declarada.");
  const entries = [];
  for (let i = 0; i < count; i += 1) {
    const p = start + i * 12;
    entries.push([stsc.view.getUint32(p, false), stsc.view.getUint32(p + 4, false), stsc.view.getUint32(p + 8, false)]);
  }
  return entries;
}

function makeBox(type, payload) {
  const totalSize = 8 + payload.length;
  assertUint32(totalSize, type + ".size");
  const buf = new Uint8Array(totalSize);
  const v = new DataView(buf.buffer);
  v.setUint32(0, totalSize, false);
  setBoxType(buf, 4, type);
  buf.set(payload, 8);
  return buf;
}

function concatBytes(arrays) {
  const total = arrays.reduce(function(sum, arr) { return sum + arr.length; }, 0);
  assertUint32(total, "output_size");
  const result = new Uint8Array(total);
  let offset = 0;
  arrays.forEach(function(arr) {
    result.set(arr, offset);
    offset += arr.length;
  });
  return result;
}

function boxBytes(box) {
  return box.data.slice(box.offset, box.end);
}

function boxPayload(box) {
  return box.data.slice(box.contentStart, box.end);
}

function buildMdhd(box) {
  return makeBox("mdhd", boxPayload(box));
}

function buildElst(box) {
  const payload = boxPayload(box);
  return makeBox("elst", payload);
}

function buildStts(sampleCount, sampleDelta) {
  const delta = sampleDelta || VIDEO_SAMPLE_DELTA;
  const buf = new Uint8Array(24);
  const v = new DataView(buf.buffer);
  v.setUint32(4, 2, false);
  v.setUint32(8, sampleCount, false);
  v.setUint32(12, delta, false);
  v.setUint32(16, FAKE_SAMPLE_COUNT, false);
  v.setUint32(20, delta, false);
  return makeBox("stts", buf);
}

function buildStsz(sizes) {
  const total = sizes.length + FAKE_SAMPLE_COUNT;
  const buf = new Uint8Array(12 + total * 4);
  const v = new DataView(buf.buffer);
  v.setUint32(8, total, false);
  let off = 12;
  sizes.forEach(function(s) {
    v.setUint32(off, s, false);
    off += 4;
  });
  for (let i = 0; i < FAKE_SAMPLE_COUNT; i += 1) {
    v.setUint32(off, FAKE_SAMPLE_SIZE, false);
    off += 4;
  }
  return makeBox("stsz", buf);
}

function buildStsc(entries, chunkCount) {
  const copy = entries.map(function(e) { return [e[0], e[1], e[2]]; });
  const last = copy[copy.length - 1];
  if (!last || last[1] !== 1) copy.push([chunkCount + 1, 1, 1]);
  const buf = new Uint8Array(8 + copy.length * 12);
  const v = new DataView(buf.buffer);
  v.setUint32(4, copy.length, false);
  let off = 8;
  copy.forEach(function(e) {
    v.setUint32(off, e[0], false);
    v.setUint32(off + 4, e[1], false);
    v.setUint32(off + 8, e[2], false);
    off += 12;
  });
  return makeBox("stsc", buf);
}

function buildStco(offsets, delta, fakeOffset) {
  const count = offsets.length + (fakeOffset === null ? 0 : FAKE_SAMPLE_COUNT);
  const buf = new Uint8Array(8 + count * 4);
  const v = new DataView(buf.buffer);
  v.setUint32(4, count, false);
  let off = 8;
  offsets.forEach(function(o) {
    const adjusted = o + delta;
    assertUint32(adjusted, "stco.chunk_offset");
    v.setUint32(off, adjusted, false);
    off += 4;
  });
  if (fakeOffset !== null) {
    assertUint32(fakeOffset, "stco.fake_sample_offset");
    for (let i = 0; i < FAKE_SAMPLE_COUNT; i += 1) {
      v.setUint32(off, fakeOffset, false);
      off += 4;
    }
  }
  return makeBox("stco", buf);
}

function rebuildBox(box, replacements) {
  if (replacements.has(box)) return replacements.get(box);
  if (!box.children.length) return boxBytes(box);
  const parts = [box.data.slice(box.prefixStart, box.prefixEnd)];
  box.children.forEach(function(child) {
    parts.push(rebuildBox(child, replacements));
  });
  return makeBox(box.type, concatBytes(parts));
}

function collectTrackStcoBoxes(moov) {
  const stcos = [];
  moov.children.filter(function(t) { return t.type === "trak"; }).forEach(function(trak) {
    const stbl = findDescendant(trak, ["mdia", "minf", "stbl"]);
    if (!stbl) return;
    const co64 = findChild(stbl, "co64");
    if (co64) throw new Error("Esse metodo ainda nao suporta MP4 com co64.");
    const stco = findChild(stbl, "stco");
    if (stco) stcos.push(stco);
  });
  return stcos;
}

function buildStcoReplacements(stcoBoxes, lastVideoStco, delta, fakeOffset) {
  const map = new Map();
  stcoBoxes.forEach(function(stco) {
    map.set(stco, buildStco(parseStco(stco), delta, stco === lastVideoStco ? fakeOffset : null));
  });
  return map;
}

function patchSharkSampleTableMethod(input) {
  let ab;
  if (input instanceof ArrayBuffer) {
    ab = input;
  } else if (typeof Buffer !== 'undefined' && input instanceof Buffer) {
    ab = input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
  } else if (input instanceof Uint8Array) {
    ab = input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
  } else {
    throw new Error('Unsupported input type: ' + typeof input);
  }
  const data = new Uint8Array(ab);
  const view = new DataView(ab);
  const roots = parseBoxes(data, view, 0, data.length);
  const ftyp = findTopLevel(roots, "ftyp");
  const moov = findTopLevel(roots, "moov");
  const mdat = findTopLevel(roots, "mdat");
  if (!ftyp) throw new Error("Caixa \"ftyp\" nao encontrada. O arquivo precisa ser MP4 valido.");
  if (!moov) throw new Error("Caixa \"moov\" nao encontrada. O arquivo precisa ter metadata MP4 completa.");
  if (!mdat) throw new Error("Caixa \"mdat\" nao encontrada. O arquivo precisa conter midia MP4.");
  const videoTrak = moov.children.find(function(t) { return t.type === "trak" && handlerTypeForTrak(t) === "vide"; });
  if (!videoTrak) throw new Error("Track de video nao encontrada.");
  const stbl = findDescendant(videoTrak, ["mdia", "minf", "stbl"]);
  const mdhd = findDescendant(videoTrak, ["mdia", "mdhd"]);
  const elst = findDescendant(videoTrak, ["edts", "elst"]);
  const stts = stbl && findChild(stbl, "stts");
  const stsc = stbl && findChild(stbl, "stsc");
  const stsz = stbl && findChild(stbl, "stsz");
  const stco = stbl && findChild(stbl, "stco");
  if (!stbl || !mdhd || !elst || !stts || !stsc || !stsz || !stco)
    throw new Error("MP4 sem as tabelas necessarias: mdhd, elst, stts, stsc, stsz e stco.");
  const sampleSizes = parseStsz(stsz);
  const stscEntries = parseStsc(stsc);
  const stcoOffsets = parseStco(stco);
  const allStcos = collectTrackStcoBoxes(moov);
  const otherBoxes = roots.filter(function(r) { return !["ftyp", "moov", "mdat"].includes(r.type); }).map(boxBytes);
  let sampleDelta = VIDEO_SAMPLE_DELTA;
  {
    const entryCount = view.getUint32(stts.contentStart + 4, false);
    if (entryCount >= 1) {
      const firstDelta = view.getUint32(stts.contentStart + 8 + 4, false);
      if (firstDelta > 0) sampleDelta = firstDelta;
    }
  }
  const replacements = new Map([
    [mdhd, buildMdhd(mdhd)],
    [elst, buildElst(elst)],
    [stts, buildStts(sampleSizes.length, sampleDelta)],
    [stsc, buildStsc(stscEntries, stcoOffsets.length)],
    [stsz, buildStsz(sampleSizes)]
  ]);
  let patched = new Map(replacements);
  buildStcoReplacements(allStcos, stco, 0, null).forEach(function(v, k) { patched.set(k, v); });
  let patchedMoov = rebuildBox(moov, patched);
  let newSizeBeforeMdat = ftyp.size + patchedMoov.length + otherBoxes.reduce(function(s, b) { return s + b.length; }, 0) + 8;
  let stcoDelta = newSizeBeforeMdat - mdat.contentStart;
  let fakeOffset = newSizeBeforeMdat + mdat.data.slice(mdat.contentStart, mdat.end).length;
  patched = new Map(replacements);
  buildStcoReplacements(allStcos, stco, stcoDelta, fakeOffset).forEach(function(v, k) { patched.set(k, v); });
  patchedMoov = rebuildBox(moov, patched);
  newSizeBeforeMdat = ftyp.size + patchedMoov.length + otherBoxes.reduce(function(s, b) { return s + b.length; }, 0) + 8;
  stcoDelta = newSizeBeforeMdat - mdat.contentStart;
  fakeOffset = newSizeBeforeMdat + mdat.data.slice(mdat.contentStart, mdat.end).length;
  patched = new Map(replacements);
  buildStcoReplacements(allStcos, stco, stcoDelta, fakeOffset).forEach(function(v, k) { patched.set(k, v); });
  patchedMoov = rebuildBox(moov, patched);
  const newMdatData = concatBytes([mdat.data.slice(mdat.contentStart, mdat.end), FAKE_SAMPLE_BYTES]);
  const newMdat = makeBox("mdat", newMdatData);
  const output = concatBytes([boxBytes(ftyp), patchedMoov].concat(otherBoxes).concat([newMdat]));
  return {
    output: output,
    realSamples: sampleSizes.length,
    fakeSamples: FAKE_SAMPLE_COUNT,
    fakeSampleSize: FAKE_SAMPLE_SIZE,
    fakeOffset: fakeOffset,
    stcoDelta: stcoDelta
  };
}

function patchFile(input) {
  const result = patchSharkSampleTableMethod(input);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(result.output.buffer || result.output);
  }
  return result.output;
}

module.exports = { patchFile, patchSharkSampleTableMethod };