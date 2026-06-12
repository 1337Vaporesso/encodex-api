/**
 * MP4 stts patcher: sets all sample durations to delta=1
 * This tells TikTok the video has ideal frame timing, bypassing re-encode.
 */
const fs = require('fs');

function patchStts(inputPath, outputPath) {
  const data = fs.readFileSync(inputPath);
  const boxes = parseBoxes(data, 0, data.length);

  let modified = false;
  walkBoxes(boxes, (box) => {
    if (box.type === 'stts') {
      const patched = patchSttsBox(box.data);
      if (patched) {
        box.data = patched;
        modified = true;
      }
    }
  });

  if (!modified) {
    // No stts found, just copy
    fs.copyFileSync(inputPath, outputPath);
    return false;
  }

  const output = rebuildBoxes(boxes);
  fs.writeFileSync(outputPath, output);
  return true;
}

function parseBoxes(buffer, offset, limit) {
  const boxes = [];
  let pos = offset;
  while (pos + 8 <= limit) {
    const size = buffer.readUInt32BE(pos);
    const type = buffer.toString('ascii', pos + 4, pos + 8);
    if (size === 0) break; // Box extends to end of file
    if (size < 8) { pos += 8; continue; } // Invalid size
    const dataEnd = Math.min(pos + size, limit);
    const data = buffer.subarray(pos, dataEnd);
    boxes.push({ type, size: dataEnd - pos, offset: pos, data, children: [] });
    pos += (dataEnd - pos);
  }
  return boxes;
}

function walkBoxes(boxes, cb) {
  for (const box of boxes) {
    cb(box);
    if (box.type === 'moov' || box.type === 'trak' || box.type === 'mdia' ||
        box.type === 'minf' || box.type === 'stbl') {
      box.children = parseBoxes(box.data, 8, box.data.length);
      walkBoxes(box.children, cb);
    }
  }
}

function rebuildBoxes(boxes) {
  const chunks = [];
  for (const box of boxes) {
    if (box.children && box.children.length > 0) {
      // Rebuild container box: header + children
      const childData = rebuildBoxes(box.children);
      const header = Buffer.alloc(8);
      header.writeUInt32BE(8 + childData.length, 0);
      header.write(box.type, 4, 8, 'ascii');
      chunks.push(header, childData);
    } else {
      chunks.push(box.data);
    }
  }
  return Buffer.concat(chunks);
}

function patchSttsBox(sttsData) {
  // stts box: full box header (4 bytes version+flags) + entry_count (4 bytes) + entries (8 bytes each)
  const view = new DataView(sttsData.buffer, sttsData.byteOffset, sttsData.byteLength);
  const version = view.getUint8(8); // version byte at offset 8 (after box header: 8 bytes)
  const flags = view.getUint32(8, false) & 0xFFFFFF; // flags (bytes 9-11)

  // Version is at byte 8 of the stts data (after 8-byte box header)
  // Full box: 4 bytes (version+flags) after box header
  // So entry count is at offset 12 (8 box header + 4 full box header)
  if (sttsData.length < 16) return null;

  let entryCount;
  if (version === 0) {
    entryCount = view.getUint32(12, false);
  } else {
    entryCount = view.getUint32(12, false);
  }

  if (entryCount === 0 || entryCount > 100000) return null;

  // Check if already patched (first entry delta = 1)
  if (entryCount >= 1) {
    const firstDelta = view.getUint32(20, false); // entry[0].delta at offset 16+4 = 20
    if (firstDelta === 1 && entryCount === 1) {
      // Already patched with single entry
      return null;
    }
  }

  // Read the total sample count
  let totalSamples = 0;
  for (let i = 0; i < entryCount; i++) {
    const ec = view.getUint32(16 + i * 8, false);
    const delta = view.getUint32(16 + i * 8 + 4, false);
    totalSamples += ec;
  }

  if (totalSamples === 0 || totalSamples > 1000000) return null;

  // Create new stts with single entry: all samples have delta=1
  const newSize = 16 + 8; // header (8+4) + 1 entry (8)
  const newStts = Buffer.alloc(newSize);
  // Copy box header (type + size will be handled by rebuild)
  sttsData.copy(newStts, 0, 0, 8);
  // Version + flags (same as original)
  sttsData.copy(newStts, 8, 8, 12);
  // Entry count = 1
  newStts.writeUInt32BE(1, 12);
  // Entry: sample_count = totalSamples, sample_delta = 1
  newStts.writeUInt32BE(totalSamples, 16);
  newStts.writeUInt32BE(1, 20);

  console.log('[EncodeX] stts patched:', totalSamples, 'samples -> single entry delta=1');
  return newStts;
}

module.exports = { patchStts };
