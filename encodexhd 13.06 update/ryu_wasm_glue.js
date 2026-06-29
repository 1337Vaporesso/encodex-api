(function() {
  'use strict';
  let wasm = null;

  const API = 'https://encodex-api-production.up.railway.app';
  const CONTAINER = new Set(["moov","trak","mdia","minf","stbl","edts","dinf","udta","meta","ilst"]);

  function u8(v) { return v & 255; }
  function be32(v) { return [u8(v>>24), u8(v>>16), u8(v>>8), u8(v)]; }
  function r32(d,o) { return (d[o]<<24)|(d[o+1]<<16)|(d[o+2]<<8)|d[o+3]; }
  function gt(d,o) { return String.fromCharCode(d[o],d[o+1],d[o+2],d[o+3]); }

  async function loadWasm() {
    if (wasm) return wasm;
    var r = await fetch(chrome.runtime.getURL('patcher.wasm'));
    var b = await r.arrayBuffer();
    var m = await WebAssembly.instantiate(b);
    wasm = m.instance.exports;
    wasm.init();
    return wasm;
  }

  window.patchFile = async function patchFile(buf) {
    var w = await loadWasm();
    var input = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    var len = input.length;

    // Copy input into WASM memory
    var mem = new Uint8Array(w.mem.buffer);
    var inputOff = 1024;
    mem.set(input, inputOff);

    // === JS does the box tree parsing (generic MP4) ===
    function rb(o, end) {
      var sz = r32(input, o);
      var ty = gt(input, o+4);
      var h = 8;
      if (sz === 1) { sz = r32(input, o+8)*4294967296 + r32(input, o+12); h = 16; }
      else if (sz === 0) sz = end - o;
      return {t:ty, o:o, s:sz, h:h, cs:o+h, e:o+sz};
    }

    function pb(o, end) {
      var r = [];
      while (o+8 <= end) {
        var bx = rb(o, end);
        if (CONTAINER.has(bx.t)) {
          var cs = bx.t === "meta" ? bx.cs+4 : bx.cs;
          bx.ps = bx.cs;
          bx.pe = cs;
          bx.c = pb(cs, bx.e);
        }
        r.push(bx);
        o = bx.e;
      }
      return r;
    }

    function fc(p, t) { return (p.c||[]).find(function(x){return x.t===t}) || null; }
    function fd(r, path) { var c=r; for(var i=0;i<path.length;i++){c=fc(c,path[i]);if(!c)return null;} return c; }
    function ft(r, t) { return r.find(function(x){return x.t===t}) || null; }
    function ht(trak) { var h=fd(trak,["mdia","hdlr"]); if(!h||h.o+20>h.e)return null; return gt(input, h.o+16); }
    function bb(box) { return input.slice(box.o, box.e); }
    function bp(box) { return input.slice(box.cs, box.e); }
    function ca(arr) { var t=0,i; for(i=0;i<arr.length;i++)t+=arr[i].length; var r=new Uint8Array(t); var o=0; for(i=0;i<arr.length;i++){r.set(arr[i],o);o+=arr[i].length} return r; }
    function mb(t, p) { var s=8+p.length; var b=new Uint8Array(s); var v=be32(s); b.set(v,0); b[4]=t.charCodeAt(0);b[5]=t.charCodeAt(1);b[6]=t.charCodeAt(2);b[7]=t.charCodeAt(3); b.set(p,8); return b; }

    function rb2(box, reps) {
      if (reps.has(box)) return reps.get(box);
      if (!box.c||!box.c.length) return bb(box);
      var parts = [input.slice(box.ps||box.cs, box.pe||box.cs)];
      for (var i = 0; i < box.c.length; i++) parts.push(rb2(box.c[i], reps));
      return mb(box.t, ca(parts));
    }

    function pStco(o) { var c=r32(input,o+12); var a=[]; for(var i=0;i<c;i++)a.push(r32(input,o+16+i*4)); return a; }
    function pStsz(o) { var ss=r32(input,o+12),sc=r32(input,o+16); if(ss){var a=[];for(var i=0;i<sc;i++)a.push(ss);return a} var a=[];for(var i=0;i<sc;i++)a.push(r32(input,o+20+i*4));return a; }
    function pStsc(o) { var c=r32(input,o+12); var a=[]; for(var i=0;i<c;i++){var p=o+16+i*12;a.push([r32(input,p),r32(input,p+4),r32(input,p+8)])} return a; }

    function cStco(moov) {
      var r = [];
      (moov.c||[]).filter(function(t){return t.t==="trak"}).forEach(function(trak){
        var stbl = fd(trak,["mdia","minf","stbl"]);
        if(!stbl)return;
        var co=fc(stbl,"co64"); if(co)throw new Error("co64 not supported");
        var stco=fc(stbl,"stco"); if(stco)r.push(stco);
      });
      return r;
    }

    var roots = pb(0, len);
    var ftyp = ft(roots, "ftyp");
    var moov = ft(roots, "moov");
    var mdat = ft(roots, "mdat");
    if (!ftyp||!moov||!mdat) throw new Error("Invalid MP4");

    var vt = (moov.c||[]).find(function(t){return t.t==="trak"&&ht(t)==="vide"});
    if (!vt) throw new Error("No video track");

    var stbl = fd(vt,["mdia","minf","stbl"]);
    var mdhd = fd(vt,["mdia","mdhd"]);
    var elst = fd(vt,["edts","elst"]);
    var stts = stbl&&fc(stbl,"stts");
    var stsc = stbl&&fc(stbl,"stsc");
    var stsz = stbl&&fc(stbl,"stsz");
    var stco = stbl&&fc(stbl,"stco");
    if (!stbl||!mdhd||!elst||!stts||!stsc||!stsz||!stco)
      throw new Error("Missing tables");

    var ss = pStsz(stsz.o);
    var sce = pStsc(stsc.o);
    var sco = pStco(stco.o);
    var allStco = cStco(moov);
    var other = roots.filter(function(x){return !["ftyp","moov","mdat"].includes(x.t)}).map(bb);

    // === Use WASM for constants and box builders ===
    var fcVal = w.getFakeSampleCount();   // 8573 from WASM
    var fsVal = w.getFakeSampleSize();    // 8 from WASM
    var vsdVal = w.getVideoSampleDelta(); // 1500 from WASM
    var fakeBytesPtr = w.getFakeSampleBytesPtr();

    var sd = vsdVal;
    var ec = r32(input, stts.cs+4);
    if (ec>=1) { var fd2=r32(input, stts.cs+8+4); if(fd2>0) sd=fd2; }

    function wb(arr) { var p=16384; mem.set(arr, p); return p; }
    function wr(p) { var mem2=new Uint8Array(w.mem.buffer); return mem2.slice(98304, p); }

    function buildReps(delta, fakeOff) {
      var reps = new Map();
      // mdhd
      var md = bp(mdhd); wb(md);       reps.set(mdhd, wr(w.buildMdhd(98304, 16384, md.length)));
      // elst
      var el = bp(elst); wb(el);       reps.set(elst, wr(w.buildElst(98304, 16384, el.length)));
      // stts
      reps.set(stts, wr(w.buildStts(98304, ss.length, sd)));
      // stsz
      var szb = new Uint8Array(ss.length*4);
      for(var i=0;i<ss.length;i++){var v=be32(ss[i]);szb[i*4]=v[0];szb[i*4+1]=v[1];szb[i*4+2]=v[2];szb[i*4+3]=v[3]}
      wb(szb); reps.set(stsz, wr(w.buildStsz(98304, 16384, ss.length)));
      // stsc
      var scb = new Uint8Array(sce.length*12);
      for(var i=0;i<sce.length;i++){var e=sce[i];var v1=be32(e[0]);scb[i*12]=v1[0];scb[i*12+1]=v1[1];scb[i*12+2]=v1[2];scb[i*12+3]=v1[3];var v2=be32(e[1]);scb[i*12+4]=v2[0];scb[i*12+5]=v2[1];scb[i*12+6]=v2[2];scb[i*12+7]=v2[3];var v3=be32(e[2]);scb[i*12+8]=v3[0];scb[i*12+9]=v3[1];scb[i*12+10]=v3[2];scb[i*12+11]=v3[3]}
      wb(scb); reps.set(stsc, wr(w.buildStsc(98304, 16384, sce.length, sco.length)));
      // stco for each track
      allStco.forEach(function(sc){
        var offs = pStco(sc.o);
        var ob = new Uint8Array(offs.length*4);
        for(var i=0;i<offs.length;i++){var v=be32(offs[i]);ob[i*4]=v[0];ob[i*4+1]=v[1];ob[i*4+2]=v[2];ob[i*4+3]=v[3]}
        wb(ob);
        var hf = sc===stco?1:0;
        var fakeOffVal = hf?fakeOff:0;
        reps.set(sc, wr(w.buildStco(98304, 16384, offs.length, delta, hf)));
        // Patch fake offsets in stco if this is video track
        if (hf) {
          var stcoBytes = reps.get(sc);
          for (var i = offs.length; i < offs.length + fcVal; i++) {
            var v = be32(fakeOff + i * 0); // all fake offsets point to same location
            stcoBytes[16 + i*4] = v[0]; stcoBytes[16+i*4+1] = v[1]; stcoBytes[16+i*4+2] = v[2]; stcoBytes[16+i*4+3] = v[3];
          }
        }
      });
      return reps;
    }

    // Three-pass
    var r1 = buildReps(0, 0);
    var m1 = rb2(moov, r1);
    var oSize = 0; for(var i=0;i<other.length;i++)oSize+=other[i].length;
    var s1 = ftyp.s + m1.length + oSize + 8;
    var delta1 = s1 - mdat.cs;

    var mdatRaw = input.slice(mdat.cs, mdat.e);
    var fakeRaw = new Uint8Array(w.mem.buffer).slice(fakeBytesPtr, fakeBytesPtr+8);
    var fakeOff1 = s1 + mdatRaw.length;

    var r2 = buildReps(delta1, fakeOff1);
    var m2 = rb2(moov, r2);
    var s2 = ftyp.s + m2.length + oSize + 8;
    var delta2 = s2 - mdat.cs;
    var fakeOff2 = s2 + mdatRaw.length;

    var r3 = buildReps(delta2, fakeOff2);
    var m3 = rb2(moov, r3);
    var s3 = ftyp.s + m3.length + oSize + 8;

    var newMdat = ca([mdatRaw, fakeRaw]);
    var newMdatBox = mb("mdat", newMdat);
    var output = ca([bb(ftyp), m3].concat(other).concat([newMdatBox]));

    return {
      output: output,
      realSamples: ss.length,
      fakeSamples: fcVal,
      fakeSampleSize: fsVal,
      fakeOffset: s3 + mdatRaw.length,
      stcoDelta: delta2
    };
  };
})();
