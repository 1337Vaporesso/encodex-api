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
    var mem = new Uint8Array(w.mem.buffer);

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
    var otherStcoBoxes = allStco.filter(function(s){return s !== stco});
    var other = roots.filter(function(x){return !["ftyp","moov","mdat"].includes(x.t)}).map(bb);

    var sd = w.getVideoSampleDelta();
    var ec = r32(input, stts.cs+4);
    if (ec>=1) { var fd2=r32(input, stts.cs+8+4); if(fd2>0) sd=fd2; }

    // Write all data arrays to WASM memory, returns parameter object for buildReps
    function prepareData() {
      var p = 16384;
      var d = {};

      var md = bp(mdhd);
      mem.set(md, p); d.mdhdPtr = p; d.mdhdLen = md.length; p += md.length;

      var el = bp(elst);
      mem.set(el, p); d.elstPtr = p; d.elstLen = el.length; p += el.length;

      var sizesPos = p;
      for (var i = 0; i < ss.length; i++) { var v = be32(ss[i]); mem[p]=v[0]; mem[p+1]=v[1]; mem[p+2]=v[2]; mem[p+3]=v[3]; p += 4; }
      d.sizesPtr = sizesPos; d.ssLen = ss.length;

      var stscPos = p;
      for (var i = 0; i < sce.length; i++) {
        var e = sce[i];
        var v1 = be32(e[0]); mem[p]=v1[0]; mem[p+1]=v1[1]; mem[p+2]=v1[2]; mem[p+3]=v1[3];
        var v2 = be32(e[1]); mem[p+4]=v2[0]; mem[p+5]=v2[1]; mem[p+6]=v2[2]; mem[p+7]=v2[3];
        var v3 = be32(e[2]); mem[p+8]=v3[0]; mem[p+9]=v3[1]; mem[p+10]=v3[2]; mem[p+11]=v3[3];
        p += 12;
      }
      d.stscPtr = stscPos; d.scLen = sce.length;

      var vStcoPos = p;
      for (var i = 0; i < sco.length; i++) { var v = be32(sco[i]); mem[p]=v[0]; mem[p+1]=v[1]; mem[p+2]=v[2]; mem[p+3]=v[3]; p += 4; }
      d.videoStcoPtr = vStcoPos; d.videoStcoLen = sco.length;

      d.otherStco = [];
      for (var j = 0; j < otherStcoBoxes.length && j < 4; j++) {
        var offs = pStco(otherStcoBoxes[j].o);
        var ptr = p;
        for (var i = 0; i < offs.length; i++) { var v = be32(offs[i]); mem[p]=v[0]; mem[p+1]=v[1]; mem[p+2]=v[2]; mem[p+3]=v[3]; p += 4; }
        d.otherStco.push({ptr: ptr, len: offs.length});
      }
      while (d.otherStco.length < 4) d.otherStco.push({ptr: 0, len: 0});

      d.cc = sco.length;
      return d;
    }

    var data = prepareData();

    function buildReps(delta, fakeOff) {
      var endPos = w.buildReps(
        131072, delta, fakeOff,
        data.mdhdPtr, data.mdhdLen,
        data.elstPtr, data.elstLen,
        data.sizesPtr, data.ssLen,
        sd,
        data.stscPtr, data.scLen, data.cc,
        data.videoStcoPtr, data.videoStcoLen,
        data.otherStco[0].ptr, data.otherStco[0].len,
        data.otherStco[1].ptr, data.otherStco[1].len,
        data.otherStco[2].ptr, data.otherStco[2].len,
        data.otherStco[3].ptr, data.otherStco[3].len
      );

      var reps = new Map();
      var p = 131072;
      function nb() { var s=r32(mem,p); var b=mem.slice(p,p+s); p+=s; return b; }
      reps.set(mdhd, nb());
      reps.set(elst, nb());
      reps.set(stts, nb());
      reps.set(stsz, nb());
      reps.set(stsc, nb());
      reps.set(stco, nb());
      for (var j = 0; j < otherStcoBoxes.length && j < 4; j++) {
        reps.set(otherStcoBoxes[j], nb());
      }
      return reps;
    }

    var r1 = buildReps(0, 0);
    var m1 = rb2(moov, r1);
    var oSize = 0; for(var i=0;i<other.length;i++)oSize+=other[i].length;
    var s1 = ftyp.s + m1.length + oSize + 8;
    var delta1 = s1 - mdat.cs;

    var mdatRaw = input.slice(mdat.cs, mdat.e);
    var fakeBytes = mem.slice(32768, 32776);
    var fakeOff1 = s1 + mdatRaw.length;

    var r2 = buildReps(delta1, fakeOff1);
    var m2 = rb2(moov, r2);
    var s2 = ftyp.s + m2.length + oSize + 8;
    var delta2 = s2 - mdat.cs;
    var fakeOff2 = s2 + mdatRaw.length;

    var r3 = buildReps(delta2, fakeOff2);
    var m3 = rb2(moov, r3);
    var s3 = ftyp.s + m3.length + oSize + 8;

    var newMdat = ca([mdatRaw, fakeBytes]);
    var newMdatBox = mb("mdat", newMdat);
    var output = ca([bb(ftyp), m3].concat(other).concat([newMdatBox]));

    return { output: output };
  };
})();
