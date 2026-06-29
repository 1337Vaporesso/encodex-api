/* RYU-style JS patcher — pure JS, no WASM needed */

const RYU = {
  VIDEO_TIMESCALE: 90000,
  VIDEO_SAMPLE_DELTA: 1500,
};

function rb32(dv, off) {
  return dv.getUint32(off, false);
}

function wb32(dv, off, v) {
  dv.setUint32(off, v, false);
}

/* Recursively find all boxes of a given type */
function findBoxes(dv, off, end, type, depth) {
  const results = [];
  const ty = (type.charCodeAt(0)<<24)|(type.charCodeAt(1)<<16)|(type.charCodeAt(2)<<8)|type.charCodeAt(3);
  const containerTypes = new Set([
    0x6D6F6F76, // moov
    0x7472616B, // trak
    0x6D646961, // mdia
    0x6D696E66, // minf
    0x7374626C, // stbl
    0x65647473, // edts
    0x64696E66, // dinf
    0x6D6F6F66, // moof
    0x74726166, // traf
  ]);
  while (off + 8 <= end) {
    let size = rb32(dv, off);
    const boxTy = rb32(dv, off + 4);
    if (size === 0) break;
    let inner, next;
    if (size === 1) {
      if (off + 16 > end) break;
      const hi = rb32(dv, off + 8);
      const lo = rb32(dv, off + 12);
      size = hi * 0x100000000 + lo;
      inner = off + 16;
    } else {
      inner = off + 8;
    }
    next = off + size;
    if (next > end) break;
    if (boxTy === ty) {
      results.push({ dv, off, size, inner, next, boxTy });
    }
    if (containerTypes.has(boxTy)) {
      results.push(...findBoxes(dv, inner, next, type));
    }
    off = next;
  }
  return results;
}

/* Patch a file buffer in-place using RYU's constants */
function patchFile(buffer) {
  const dv = new DataView(buffer);
  const len = buffer.byteLength;
  const sttsBoxes = findBoxes(dv, 0, len, 'stts');
  const mdhdBoxes = findBoxes(dv, 0, len, 'mdhd');
  const elstBoxes = findBoxes(dv, 0, len, 'elst');

  /* Match stts with mdhd by track order */
  for (let i = 0; i < sttsBoxes.length; i++) {
    const stts = sttsBoxes[i];
    /* Count total samples in this stts */
    const ec = rb32(dv, stts.inner + 4);
    if (ec === 0 || ec > 100000) continue;
    let totalSamples = 0;
    for (let j = 0; j < ec; j++) {
      totalSamples += rb32(dv, stts.inner + 8 + j * 8);
    }
    if (totalSamples === 0 || totalSamples > 1000000) continue;

    /* Write stts: entry_count=1, sample_count=total, sample_delta=1500 */
    wb32(dv, stts.inner + 4, 1);
    wb32(dv, stts.inner + 8, totalSamples);
    wb32(dv, stts.inner + 12, RYU.VIDEO_SAMPLE_DELTA);

    /* Patch matching mdhd */
    if (i < mdhdBoxes.length) {
      const mdhd = mdhdBoxes[i];
      const ver = dv.getUint8(mdhd.inner);
      let tsOff, durOff;
      if (ver) {
        tsOff = mdhd.inner + 20;
        durOff = mdhd.inner + 24;
      } else {
        tsOff = mdhd.inner + 12;
        durOff = mdhd.inner + 16;
      }
      wb32(dv, tsOff, RYU.VIDEO_TIMESCALE);
      wb32(dv, durOff, totalSamples * RYU.VIDEO_SAMPLE_DELTA);
      if (ver) {
        /* Zero out upper 32 bits of 64-bit duration */
        wb32(dv, durOff + 4, 0);
      }
    }
  }

  /* Patch elst if present (edit list) */
  for (const elst of elstBoxes) {
    const ec = rb32(dv, elst.inner + 4);
    if (ec === 0) continue;
    /* For first entry, set media_time = 3000 */
    const ver = dv.getUint8(elst.inner);
    if (ver) {
      /* v1: 64-bit entries */
      wb32(dv, elst.inner + 12, 3000);  /* media_time low */
      wb32(dv, elst.inner + 16, 0);     /* media_time high */
    } else {
      /* v0: 32-bit entries */
      wb32(dv, elst.inner + 8, 0);      /* segment_duration = 0 */
      wb32(dv, elst.inner + 12, 3000);  /* media_time = 3000 */
      wb32(dv, elst.inner + 16, 0x00010000); /* media_rate = 1.0 in 16.16 fixed */
    }
  }

  return buffer;
}

if (typeof module !== 'undefined') module.exports = { patchFile, findBoxes };
