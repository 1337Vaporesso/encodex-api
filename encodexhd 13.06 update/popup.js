const FAKE_SAMPLE_COUNT = 8573;
const FAKE_SAMPLE_SIZE = 8;
const FAKE_SAMPLE_BYTES = new Uint8Array([0, 0, 0, 4, 0, 0, 0, 0]);
const VIDEO_TIMESCALE = 90000;
const VIDEO_DURATION = 2269500;
const VIDEO_EDIT_MEDIA_TIME = 3000;
const VIDEO_SAMPLE_DELTA = 1500;
const fileInput = document.getElementById("fileInput");
const patchBtn = document.getElementById("patchBtn");
const openTabBtn = document.getElementById("openTabBtn");
const statusEl = document.getElementById("status");
const sizeWarningEl = document.getElementById("sizeWarning");
const sizeWarningCloseBtn = document.getElementById("sizeWarningClose");
const langBtns = Array.from(document.querySelectorAll("[data-lang]"));
const i18nEls = Array.from(document.querySelectorAll("[data-i18n]"));
const LANG_KEY = "cleanUploaderLang";
const SIZE_WARNING_BYTES = 94371840;
const CONTAINER_BOXES = new Set(["moov", "trak", "mdia", "minf", "stbl", "edts", "dinf", "udta", "meta", "ilst"]);
const COPY = {
  en: {
    title: "Shark Uploader",
    subtitle: "Local MP4 patch + upload metadata bypass",
    method: "EncodeX HD method",
    selectVideo: "Select video",
    openTab: "Open in new tab",
    patchDownload: "Patch & Download",
    ready: "Ready",
    processing: "Processing",
    done: "Done",
    error: "Error",
    selected: "Ready: {name}",
    scanning: "Processing: rebuilding MP4 sample tables",
    patched: "Processing: {realSamples}+{fakeSamples} video samples. Downloading",
    downloaded: "Done: file downloaded",
    failed: "Error: {message}",
    sizeWarningKicker: "File size warning",
    sizeWarningTitle: "Video over 90 MB",
    sizeWarningBody: "Your video is bigger than 90 MB. It may flop because of that. It is HIGHLY recommended to compress it more.",
    close: "Close"
  },
  pt: {
    title: "Shark Uploader",
    subtitle: "Patch local de MP4 + limpeza de metadados do bypass",
    method: "EncodeX HD method",
    selectVideo: "Selecionar video",
    openTab: "Abrir em nova aba",
    patchDownload: "Patch & Download",
    ready: "Pronto",
    processing: "Processando",
    done: "Concluido",
    error: "Erro",
    selected: "Pronto: {name}",
    scanning: "Processando: reconstruindo tabelas MP4",
    patched: "Processando: {realSamples}+{fakeSamples} samples de video. Baixando",
    downloaded: "Concluido: arquivo baixado",
    failed: "Erro: {message}",
    sizeWarningKicker: "Aviso de tamanho",
    sizeWarningTitle: "Video acima de 90 MB",
    sizeWarningBody: "Seu video tem mais de 90 MB. Ele pode flopar por causa disso. E ALTAMENTE recomendado comprimir mais.",
    close: "Fechar"
  }
};
let selectedFile = null;
let currentLang = "en";
let currentStatus = {
  key: "ready",
  state: "idle",
  values: {}
};
function formatCopy(_0x56ecf4, _0x2390c5 = {}) {
  return String(_0x56ecf4 || "").replace(/\{(\w+)\}/g, (_0x3ebec1, _0x16c3a1) => _0x2390c5[_0x16c3a1] ?? "");
}
function t(_0x8a6e7f, _0x394601 = {}) {
  return formatCopy(COPY[currentLang] && COPY[currentLang][_0x8a6e7f] || COPY.en[_0x8a6e7f] || _0x8a6e7f, _0x394601);
}
function persistLanguage(_0xd9020c) {
  try {
    localStorage.setItem(LANG_KEY, _0xd9020c);
  } catch (_0x5a7779) {}
}
function getSavedLanguage() {
  try {
    const _0x3833a7 = localStorage.getItem(LANG_KEY);
    if (_0x3833a7 === "pt" || _0x3833a7 === "en") {
      return _0x3833a7;
    } else {
      return "en";
    }
  } catch (_0x4ccdc9) {
    return "en";
  }
}
function setStatus(_0x40613e, _0x1603db = "idle", _0x27dca9 = {}) {
  const _0x5b5894 = {
    key: _0x40613e,
    state: _0x1603db,
    values: _0x27dca9
  };
  currentStatus = _0x5b5894;
  statusEl.textContent = t(_0x40613e, _0x27dca9);
  statusEl.dataset.state = _0x1603db;
}
function setLanguage(_0x585175) {
  currentLang = _0x585175 === "pt" ? "pt" : "en";
  document.documentElement.lang = currentLang;
  i18nEls.forEach(_0x1461ca => {
    const _0x5744bd = _0x1461ca.dataset.i18n;
    _0x1461ca.textContent = t(_0x5744bd);
  });
  fileInput.setAttribute("aria-label", t("selectVideo"));
  langBtns.forEach(_0x3fb538 => {
    const _0x16431c = _0x3fb538.dataset.lang === currentLang;
    _0x3fb538.classList.toggle("is-active", _0x16431c);
    _0x3fb538.setAttribute("aria-pressed", String(_0x16431c));
  });
  setStatus(currentStatus.key, currentStatus.state, currentStatus.values);
  persistLanguage(currentLang);
}
function showSizeWarning() {
  sizeWarningEl.hidden = false;
}
function hideSizeWarning() {
  sizeWarningEl.hidden = true;
}
function getBoxType(_0xc7fa07, _0xdc6dfc) {
  return String.fromCharCode(_0xc7fa07[_0xdc6dfc], _0xc7fa07[_0xdc6dfc + 1], _0xc7fa07[_0xdc6dfc + 2], _0xc7fa07[_0xdc6dfc + 3]);
}
function setBoxType(_0x10588e, _0x26baa6, _0x50579a) {
  for (let _0x41c24a = 0; _0x41c24a < 4; _0x41c24a += 1) {
    _0x10588e[_0x26baa6 + _0x41c24a] = _0x50579a.charCodeAt(_0x41c24a);
  }
}
function assertUint32(_0x4c2882, _0x34fbd8) {
  if (!Number.isFinite(_0x4c2882) || _0x4c2882 < 0 || _0x4c2882 > 4294967295) {
    throw new Error(_0x34fbd8 + " fora do limite uint32: " + _0x4c2882);
  }
}
function readBox(_0x2e988a, _0x4822db, _0x7b9617, _0x2172be, _0x57c6da = "") {
  if (_0x7b9617 + 8 > _0x2172be) {
    throw new Error("MP4 invalido: caixa incompleta.");
  }
  const _0x8d8b1f = _0x2e988a.getUint32(_0x7b9617, false);
  const _0x5ba3d6 = getBoxType(_0x4822db, _0x7b9617 + 4);
  let _0x43750d = _0x8d8b1f;
  let _0x40cc48 = 8;
  if (_0x8d8b1f === 1) {
    if (_0x7b9617 + 16 > _0x2172be) {
      throw new Error("MP4 invalido: caixa " + _0x5ba3d6 + " incompleta.");
    }
    const _0x397892 = _0x2e988a.getUint32(_0x7b9617 + 8, false);
    const _0x43a925 = _0x2e988a.getUint32(_0x7b9617 + 12, false);
    _0x43750d = _0x397892 * 4294967296 + _0x43a925;
    _0x40cc48 = 16;
  } else if (_0x8d8b1f === 0) {
    _0x43750d = _0x2172be - _0x7b9617;
  }
  if (_0x43750d < _0x40cc48 || _0x7b9617 + _0x43750d > _0x2172be) {
    throw new Error("MP4 invalido: tamanho incorreto na caixa " + _0x5ba3d6 + ".");
  }
  return {
    type: _0x5ba3d6,
    offset: _0x7b9617,
    size: _0x43750d,
    headerSize: _0x40cc48,
    contentStart: _0x7b9617 + _0x40cc48,
    end: _0x7b9617 + _0x43750d,
    path: _0x57c6da ? _0x57c6da + "/" + _0x5ba3d6 : _0x5ba3d6,
    data: _0x4822db,
    view: _0x2e988a,
    children: [],
    prefixStart: _0x7b9617 + _0x40cc48,
    prefixEnd: _0x7b9617 + _0x40cc48
  };
}
function childStartForBox(_0x4a3b03) {
  if (_0x4a3b03.type === "meta") {
    return _0x4a3b03.contentStart + 4;
  }
  return _0x4a3b03.contentStart;
}
function parseBoxes(_0x2a0c5f, _0x2d2e4f, _0xd5d33d = 0, _0x8be19b = _0x2a0c5f.length, _0x1036e5 = "") {
  const _0x27110c = [];
  let _0x52347d = _0xd5d33d;
  while (_0x52347d + 8 <= _0x8be19b) {
    const _0x4174a0 = readBox(_0x2d2e4f, _0x2a0c5f, _0x52347d, _0x8be19b, _0x1036e5);
    if (CONTAINER_BOXES.has(_0x4174a0.type)) {
      const _0x192a8e = childStartForBox(_0x4174a0);
      if (_0x192a8e > _0x4174a0.end) {
        throw new Error("MP4 invalido: container " + _0x4174a0.type + " curto demais.");
      }
      _0x4174a0.prefixStart = _0x4174a0.contentStart;
      _0x4174a0.prefixEnd = _0x192a8e;
      _0x4174a0.children = parseBoxes(_0x2a0c5f, _0x2d2e4f, _0x192a8e, _0x4174a0.end, _0x4174a0.path);
    }
    _0x27110c.push(_0x4174a0);
    _0x52347d = _0x4174a0.end;
  }
  return _0x27110c;
}
function findChild(_0x1702de, _0x5376c5) {
  return _0x1702de.children.find(_0x42022e => _0x42022e.type === _0x5376c5) || null;
}
function findDescendant(_0x54a460, _0xe7a944) {
  let _0x2ddfc0 = _0x54a460;
  for (const _0x292476 of _0xe7a944) {
    _0x2ddfc0 = findChild(_0x2ddfc0, _0x292476);
    if (!_0x2ddfc0) {
      return null;
    }
  }
  return _0x2ddfc0;
}
function findTopLevel(_0x36732d, _0x1b9286) {
  return _0x36732d.find(_0x48611d => _0x48611d.type === _0x1b9286) || null;
}
function handlerTypeForTrak(_0x3d924c) {
  const _0x32cd23 = findDescendant(_0x3d924c, ["mdia", "hdlr"]);
  if (!_0x32cd23 || _0x32cd23.offset + 20 > _0x32cd23.end) {
    return null;
  }
  return getBoxType(_0x32cd23.data, _0x32cd23.offset + 16);
}
function parseStsz(_0x28a20a) {
  const _0x53ee07 = _0x28a20a.view.getUint32(_0x28a20a.offset + 12, false);
  const _0x343043 = _0x28a20a.view.getUint32(_0x28a20a.offset + 16, false);
  if (_0x53ee07) {
    return new Array(_0x343043).fill(_0x53ee07);
  }
  const _0x1e7636 = _0x28a20a.offset + 20;
  if (_0x1e7636 + _0x343043 * 4 > _0x28a20a.end) {
    throw new Error("MP4 invalido: stsz menor que a quantidade de samples declarada.");
  }
  const _0x245761 = [];
  for (let _0x5af004 = 0; _0x5af004 < _0x343043; _0x5af004 += 1) {
    _0x245761.push(_0x28a20a.view.getUint32(_0x1e7636 + _0x5af004 * 4, false));
  }
  return _0x245761;
}
function parseStco(_0x299d60) {
  const _0x372059 = _0x299d60.view.getUint32(_0x299d60.offset + 12, false);
  const _0x22566d = _0x299d60.offset + 16;
  if (_0x22566d + _0x372059 * 4 > _0x299d60.end) {
    throw new Error("MP4 invalido: stco menor que a quantidade de chunks declarada.");
  }
  const _0x509241 = [];
  for (let _0x53cc54 = 0; _0x53cc54 < _0x372059; _0x53cc54 += 1) {
    _0x509241.push(_0x299d60.view.getUint32(_0x22566d + _0x53cc54 * 4, false));
  }
  return _0x509241;
}
function parseStsc(_0x37cc9e) {
  const _0x38c5f7 = _0x37cc9e.view.getUint32(_0x37cc9e.offset + 12, false);
  const _0x5eff1c = _0x37cc9e.offset + 16;
  if (_0x5eff1c + _0x38c5f7 * 12 > _0x37cc9e.end) {
    throw new Error("MP4 invalido: stsc menor que a quantidade de entradas declarada.");
  }
  const _0x31f6c6 = [];
  for (let _0x2f69f1 = 0; _0x2f69f1 < _0x38c5f7; _0x2f69f1 += 1) {
    const _0x34a664 = _0x5eff1c + _0x2f69f1 * 12;
    _0x31f6c6.push([_0x37cc9e.view.getUint32(_0x34a664, false), _0x37cc9e.view.getUint32(_0x34a664 + 4, false), _0x37cc9e.view.getUint32(_0x34a664 + 8, false)]);
  }
  return _0x31f6c6;
}
function makeBox(_0x2b2eae, _0x1028cc) {
  const _0x313d6a = 8 + _0x1028cc.length;
  assertUint32(_0x313d6a, _0x2b2eae + ".size");
  const _0x447d9c = new Uint8Array(_0x313d6a);
  const _0x17ba48 = new DataView(_0x447d9c.buffer);
  _0x17ba48.setUint32(0, _0x313d6a, false);
  setBoxType(_0x447d9c, 4, _0x2b2eae);
  _0x447d9c.set(_0x1028cc, 8);
  return _0x447d9c;
}
function concatBytes(_0x41cfa2) {
  const _0x43ea29 = _0x41cfa2.reduce((_0x3d7ef4, _0x30cc57) => _0x3d7ef4 + _0x30cc57.length, 0);
  assertUint32(_0x43ea29, "output_size");
  const _0x290a93 = new Uint8Array(_0x43ea29);
  let _0x5a55bc = 0;
  _0x41cfa2.forEach(_0x17a081 => {
    _0x290a93.set(_0x17a081, _0x5a55bc);
    _0x5a55bc += _0x17a081.length;
  });
  return _0x290a93;
}
function boxBytes(_0x552cac) {
  return _0x552cac.data.slice(_0x552cac.offset, _0x552cac.end);
}
function boxPayload(_0x3b5056) {
  return _0x3b5056.data.slice(_0x3b5056.contentStart, _0x3b5056.end);
}
function readMdhdParams(_0x2d38e0) {
  const _0x348a85 = boxPayload(_0x2d38e0);
  const _0x3dfa5b = new DataView(_0x348a85.buffer);
  const _0x190abe = _0x348a85[0];
  if (_0x190abe !== 0) {
    throw new Error("Versao mdhd nao suportada nesse metodo: " + _0x190abe + ".");
  }
  const _0x2c768b = _0x3dfa5b.getUint32(12, false);
  const _0x16cafd = _0x3dfa5b.getUint32(16, false);
  return {
    timescale: _0x2c768b || VIDEO_TIMESCALE,
    duration: _0x16cafd || VIDEO_DURATION
  };
}
function buildMdhd(_0x2b04e0) {
  const _0x416311 = boxPayload(_0x2b04e0);
  return makeBox("mdhd", _0x416311);
}
function buildElst(_0x51a646) {
  const _0x221ad8 = boxPayload(_0x51a646);
  const _0x59aa7a = _0x221ad8[0];
  const _0x182f36 = new DataView(_0x221ad8.buffer);
  const _0x4d68c1 = _0x182f36.getUint32(4, false);
  if (_0x59aa7a !== 0 || _0x4d68c1 < 1) {
    throw new Error("Esse metodo precisa de elst version 0 com pelo menos uma entrada.");
  }
  return makeBox("elst", _0x221ad8);
}
function buildStts(_0x2f180d, _0x10b1f8) {
  const _0x31908b = _0x10b1f8 || VIDEO_SAMPLE_DELTA;
  const _0x1cec11 = new Uint8Array(24);
  const _0x179070 = new DataView(_0x1cec11.buffer);
  _0x179070.setUint32(4, 2, false);
  _0x179070.setUint32(8, _0x2f180d, false);
  _0x179070.setUint32(12, _0x31908b, false);
  _0x179070.setUint32(16, FAKE_SAMPLE_COUNT, false);
  _0x179070.setUint32(20, _0x31908b, false);
  return makeBox("stts", _0x1cec11);
}
function buildStsz(_0x23ae6d) {
  const _0x55e2bb = _0x23ae6d.length + FAKE_SAMPLE_COUNT;
  const _0x276dc7 = new Uint8Array(12 + _0x55e2bb * 4);
  const _0x478f6b = new DataView(_0x276dc7.buffer);
  _0x478f6b.setUint32(8, _0x55e2bb, false);
  let _0x221601 = 12;
  _0x23ae6d.forEach(_0x17877d => {
    _0x478f6b.setUint32(_0x221601, _0x17877d, false);
    _0x221601 += 4;
  });
  for (let _0x481dc5 = 0; _0x481dc5 < FAKE_SAMPLE_COUNT; _0x481dc5 += 1) {
    _0x478f6b.setUint32(_0x221601, FAKE_SAMPLE_SIZE, false);
    _0x221601 += 4;
  }
  return makeBox("stsz", _0x276dc7);
}
function buildStsc(_0x8b784b, _0x352ea0) {
  const _0xdf1de3 = _0x8b784b.map(_0x386eca => [..._0x386eca]);
  const _0x76c258 = _0xdf1de3[_0xdf1de3.length - 1];
  if (!_0x76c258 || _0x76c258[1] !== 1) {
    _0xdf1de3.push([_0x352ea0 + 1, 1, 1]);
  }
  const _0x8f930b = new Uint8Array(8 + _0xdf1de3.length * 12);
  const _0xeaf74d = new DataView(_0x8f930b.buffer);
  _0xeaf74d.setUint32(4, _0xdf1de3.length, false);
  let _0x273b62 = 8;
  _0xdf1de3.forEach(([_0x5d0f9d, _0x1d1158, _0x301bc5]) => {
    _0xeaf74d.setUint32(_0x273b62, _0x5d0f9d, false);
    _0xeaf74d.setUint32(_0x273b62 + 4, _0x1d1158, false);
    _0xeaf74d.setUint32(_0x273b62 + 8, _0x301bc5, false);
    _0x273b62 += 12;
  });
  return makeBox("stsc", _0x8f930b);
}
function buildStco(_0x51fd29, _0xc1d19c, _0x7dc552 = null) {
  const _0x311251 = _0x51fd29.length + (_0x7dc552 === null ? 0 : FAKE_SAMPLE_COUNT);
  const _0x5e4e43 = new Uint8Array(8 + _0x311251 * 4);
  const _0x4dbb45 = new DataView(_0x5e4e43.buffer);
  _0x4dbb45.setUint32(4, _0x311251, false);
  let _0x26f55b = 8;
  _0x51fd29.forEach(_0x187a4e => {
    const _0xf6f848 = _0x187a4e + _0xc1d19c;
    assertUint32(_0xf6f848, "stco.chunk_offset");
    _0x4dbb45.setUint32(_0x26f55b, _0xf6f848, false);
    _0x26f55b += 4;
  });
  if (_0x7dc552 !== null) {
    assertUint32(_0x7dc552, "stco.fake_sample_offset");
    for (let _0x2cdcf4 = 0; _0x2cdcf4 < FAKE_SAMPLE_COUNT; _0x2cdcf4 += 1) {
      _0x4dbb45.setUint32(_0x26f55b, _0x7dc552, false);
      _0x26f55b += 4;
    }
  }
  return makeBox("stco", _0x5e4e43);
}
function rebuildBox(_0x5e6624, _0x4f2656) {
  if (_0x4f2656.has(_0x5e6624)) {
    return _0x4f2656.get(_0x5e6624);
  }
  if (!_0x5e6624.children.length) {
    return boxBytes(_0x5e6624);
  }
  const _0x942e09 = [_0x5e6624.data.slice(_0x5e6624.prefixStart, _0x5e6624.prefixEnd)];
  _0x5e6624.children.forEach(_0x59d892 => {
    _0x942e09.push(rebuildBox(_0x59d892, _0x4f2656));
  });
  return makeBox(_0x5e6624.type, concatBytes(_0x942e09));
}
function collectTrackStcoBoxes(_0x391a26) {
  const _0x13ea50 = [];
  _0x391a26.children.filter(_0x5e8795 => _0x5e8795.type === "trak").forEach(_0x25d32b => {
    const _0x4cb50b = findDescendant(_0x25d32b, ["mdia", "minf", "stbl"]);
    if (!_0x4cb50b) {
      return;
    }
    const _0x1b122c = findChild(_0x4cb50b, "co64");
    if (_0x1b122c) {
      throw new Error("Esse metodo ainda nao suporta MP4 com co64.");
    }
    const _0x511f69 = findChild(_0x4cb50b, "stco");
    if (_0x511f69) {
      _0x13ea50.push(_0x511f69);
    }
  });
  return _0x13ea50;
}
function buildStcoReplacements(_0x48a48e, _0x4c1311, _0x4780ea, _0x3fb889) {
  const _0x1c8005 = new Map();
  _0x48a48e.forEach(_0x922ef6 => {
    _0x1c8005.set(_0x922ef6, buildStco(parseStco(_0x922ef6), _0x4780ea, _0x922ef6 === _0x4c1311 ? _0x3fb889 : null));
  });
  return _0x1c8005;
}
function patchSharkSampleTableMethod(_0x1f9c4d) {
  const _0x35308f = new Uint8Array(_0x1f9c4d);
  const _0x36f3dd = new DataView(_0x1f9c4d);
  const _0x5eaef1 = parseBoxes(_0x35308f, _0x36f3dd);
  const _0x309594 = findTopLevel(_0x5eaef1, "ftyp");
  const _0x1bd8cd = findTopLevel(_0x5eaef1, "moov");
  const _0x236278 = findTopLevel(_0x5eaef1, "mdat");
  if (!_0x309594) {
    throw new Error("Caixa \"ftyp\" nao encontrada. O arquivo precisa ser MP4 valido.");
  }
  if (!_0x1bd8cd) {
    throw new Error("Caixa \"moov\" nao encontrada. O arquivo precisa ter metadata MP4 completa.");
  }
  if (!_0x236278) {
    throw new Error("Caixa \"mdat\" nao encontrada. O arquivo precisa conter midia MP4.");
  }
  const _0x45ef03 = _0x1bd8cd.children.find(_0x1a2bcf => _0x1a2bcf.type === "trak" && handlerTypeForTrak(_0x1a2bcf) === "vide");
  if (!_0x45ef03) {
    throw new Error("Track de video nao encontrada.");
  }
  const _0x17f2d0 = findDescendant(_0x45ef03, ["mdia", "minf", "stbl"]);
  const _0x16bec9 = findDescendant(_0x45ef03, ["mdia", "mdhd"]);
  const _0x348feb = findDescendant(_0x45ef03, ["edts", "elst"]);
  const _0xe524c7 = _0x17f2d0 && findChild(_0x17f2d0, "stts");
  const _0x5307af = _0x17f2d0 && findChild(_0x17f2d0, "stsc");
  const _0x42b606 = _0x17f2d0 && findChild(_0x17f2d0, "stsz");
  const _0x54c0e2 = _0x17f2d0 && findChild(_0x17f2d0, "stco");
  if (!_0x17f2d0 || !_0x16bec9 || !_0x348feb || !_0xe524c7 || !_0x5307af || !_0x42b606 || !_0x54c0e2) {
    throw new Error("MP4 sem as tabelas necessarias: mdhd, elst, stts, stsc, stsz e stco.");
  }
  const _0x38ae8b = parseStsz(_0x42b606);
  const _0x52328c = parseStsc(_0x5307af);
  const _0x4eda67 = parseStco(_0x54c0e2);
  const _0x2df965 = collectTrackStcoBoxes(_0x1bd8cd);
  const _0x1440b7 = _0x5eaef1.filter(_0x4fef75 => !["ftyp", "moov", "mdat"].includes(_0x4fef75.type)).map(boxBytes);
  let _0x53704c = VIDEO_SAMPLE_DELTA;
  {
    const _0x77765c = _0x36f3dd.getUint32(_0xe524c7.contentStart + 4, false);
    if (_0x77765c >= 1) {
      const _0x1e4307 = _0x36f3dd.getUint32(_0xe524c7.contentStart + 8 + 4, false);
      if (_0x1e4307 > 0) {
        _0x53704c = _0x1e4307;
      }
    }
  }
  const _0x41912d = new Map([[_0x16bec9, buildMdhd(_0x16bec9)], [_0x348feb, buildElst(_0x348feb)], [_0xe524c7, buildStts(_0x38ae8b.length, _0x53704c)], [_0x5307af, buildStsc(_0x52328c, _0x4eda67.length)], [_0x42b606, buildStsz(_0x38ae8b)]]);
  const _0x475a79 = new Map(_0x41912d);
  buildStcoReplacements(_0x2df965, _0x54c0e2, 0, 0).forEach((_0x3a2e04, _0x5b3f62) => {
    _0x475a79.set(_0x5b3f62, _0x3a2e04);
  });
  const _0x3390a5 = rebuildBox(_0x1bd8cd, _0x475a79);
  const _0x30154f = concatBytes(_0x1440b7);
  const _0x58acbe = _0x236278.contentStart;
  const _0x472ad3 = _0x35308f.slice(_0x236278.contentStart, _0x236278.end);
  const _0x3c5e8e = _0x309594.size + _0x3390a5.length + _0x30154f.length + 8;
  let _0x1537cf = _0x3c5e8e - _0x58acbe;
  let _0x305e6a = _0x3c5e8e + _0x472ad3.length;
  let _0x1c9f52 = new Map(_0x41912d);
  buildStcoReplacements(_0x2df965, _0x54c0e2, _0x1537cf, _0x305e6a).forEach((_0x54a8b2, _0x505984) => {
    _0x1c9f52.set(_0x505984, _0x54a8b2);
  });
  let _0x4d7433 = rebuildBox(_0x1bd8cd, _0x1c9f52);
  const _0x42093c = _0x309594.size + _0x4d7433.length + _0x30154f.length + 8;
  _0x1537cf = _0x42093c - _0x58acbe;
  _0x305e6a = _0x42093c + _0x472ad3.length;
  _0x1c9f52 = new Map(_0x41912d);
  buildStcoReplacements(_0x2df965, _0x54c0e2, _0x1537cf, _0x305e6a).forEach((_0x5cd20f, _0x464d8c) => {
    _0x1c9f52.set(_0x464d8c, _0x5cd20f);
  });
  _0x4d7433 = rebuildBox(_0x1bd8cd, _0x1c9f52);
  const _0x3b19b0 = concatBytes([_0x472ad3, FAKE_SAMPLE_BYTES]);
  const _0x2d8ce5 = makeBox("mdat", _0x3b19b0);
  const _0x3eafe4 = concatBytes([boxBytes(_0x309594), _0x4d7433, _0x30154f, _0x2d8ce5]);
  const _0x36e3ac = {
    output: _0x3eafe4,
    realSamples: _0x38ae8b.length,
    fakeSamples: FAKE_SAMPLE_COUNT,
    fakeSampleSize: FAKE_SAMPLE_SIZE,
    fakeOffset: _0x305e6a,
    stcoDelta: _0x1537cf
  };
  return _0x36e3ac;
}
const uploadTriggerBtn = document.getElementById("uploadTrigger");
const fileNameDisplay = document.getElementById("fileNameDisplay");
if (uploadTriggerBtn) {
  uploadTriggerBtn.addEventListener("click", () => {
    fileInput.click();
  });
}
fileInput.addEventListener("change", _0x3c5742 => {
  selectedFile = _0x3c5742.target.files && _0x3c5742.target.files[0] ? _0x3c5742.target.files[0] : null;
  if (selectedFile) {
    patchBtn.disabled = false;
    patchBtn.classList.add("enabled");
    document.body.classList.add("has-file");
    if (fileNameDisplay) {
      fileNameDisplay.textContent = selectedFile.name;
      fileNameDisplay.classList.add("has-file");
    }
    const _0x16365e = {
      name: selectedFile.name
    };
    setStatus("selected", "idle", _0x16365e);
    if (selectedFile.size > SIZE_WARNING_BYTES) {
      showSizeWarning();
    } else {
      hideSizeWarning();
    }
  } else {
    patchBtn.disabled = true;
    patchBtn.classList.remove("enabled");
    document.body.classList.remove("has-file");
    if (fileNameDisplay) {
      fileNameDisplay.textContent = "No file selected...";
      fileNameDisplay.classList.remove("has-file");
    }
    hideSizeWarning();
    setStatus("ready", "idle");
  }
});
if (openTabBtn) {
  openTabBtn.addEventListener("click", () => {
    const _0x15886a = chrome.runtime.getURL("popup.html");
    const _0x4c785f = {
      url: _0x15886a
    };
    chrome.tabs.create(_0x4c785f);
  });
}
patchBtn.addEventListener("click", async () => {
  if (!selectedFile) {
    return;
  }
  setStatus("scanning", "processing");
  try {
    const _0xdc3ec5 = await selectedFile.arrayBuffer();
    const _0x1e1d39 = patchSharkSampleTableMethod(_0xdc3ec5);
    const _0x2a0282 = {
      realSamples: _0x1e1d39.realSamples,
      fakeSamples: _0x1e1d39.fakeSamples
    };
    setStatus("patched", "processing", _0x2a0282);
    const _0xa75f27 = {
      type: selectedFile.type || "video/mp4"
    };
    const _0x372e5e = new Blob([_0x1e1d39.output], _0xa75f27);
    const _0x219fe9 = URL.createObjectURL(_0x372e5e);
    const _0x10e16e = document.createElement("a");
    _0x10e16e.href = _0x219fe9;
    const _0x100f1e = selectedFile.name.replace(/\.[^/.]+$/, "");
    _0x10e16e.download = _0x100f1e + "_encodexhd_bypassed.mp4";
    document.body.appendChild(_0x10e16e);
    _0x10e16e.click();
    _0x10e16e.remove();
    setTimeout(() => URL.revokeObjectURL(_0x219fe9), 2000);
    setStatus("downloaded", "success");
    const _0x48cf45 = document.getElementById("tiktokUploadBtn");
    if (_0x48cf45) {
      _0x48cf45.style.display = "inline-flex";
    }
  } catch (_0x2ebd4c) {
    setStatus("failed", "error", {
      message: _0x2ebd4c && _0x2ebd4c.message ? _0x2ebd4c.message : "unknown error"
    });
  }
});
langBtns.forEach(_0x2d543a => {
  _0x2d543a.addEventListener("click", () => {
    setLanguage(_0x2d543a.dataset.lang);
  });
});
sizeWarningCloseBtn.addEventListener("click", hideSizeWarning);
setLanguage(getSavedLanguage());
document.querySelectorAll(".nav-btn[data-page]").forEach(_0x38e564 => {
  _0x38e564.addEventListener("click", () => {
    const _0x38db7c = _0x38e564.dataset.page;
    document.querySelectorAll(".nav-btn").forEach(_0x3442ec => _0x3442ec.classList.remove("active"));
    _0x38e564.classList.add("active");
    document.querySelectorAll(".page-view").forEach(_0x4146ad => _0x4146ad.classList.remove("active"));
    const _0x48e950 = document.getElementById("page-" + _0x38db7c);
    if (_0x48e950) {
      _0x48e950.classList.add("active");
    }
  });
});
const ffmpegFileInput = document.getElementById("ffmpegFileInput");
const ffmpegUploadTrigger = document.getElementById("ffmpegUploadTrigger");
const ffmpegFileNameDisp = document.getElementById("ffmpegFileNameDisplay");
const ffmpegPatchBtn = document.getElementById("ffmpegPatchBtn");
const ffmpegStatusEl = document.getElementById("ffmpegStatus");
const ffmpegProgress = document.getElementById("ffmpegProgress");
const ffmpegProgressBar = document.getElementById("ffmpegProgressBar");
const ffmpegTiktokBtn = document.getElementById("ffmpegTiktokBtn");
const srcFpsDisplay = document.getElementById("srcFpsDisplay");
const ratioDisplay = document.getElementById("ratioDisplay");
const outFpsDisplay = document.getElementById("outFpsDisplay");
const cmdPreview = document.getElementById("cmdPreview");
let ffmpegSelectedFile = null;
let selectedFpsRatio = 0.5;
let detectedFps = null;
document.querySelectorAll(".fps-btn").forEach(_0x2eb23a => {
  _0x2eb23a.addEventListener("click", () => {
    document.querySelectorAll(".fps-btn").forEach(_0x241b41 => _0x241b41.classList.remove("active"));
    _0x2eb23a.classList.add("active");
    selectedFpsRatio = parseFloat(_0x2eb23a.dataset.fps);
    ratioDisplay.textContent = selectedFpsRatio + "×";
    updateFpsDisplays();
    updateCmdPreview();
  });
});
function updateFpsDisplays() {
  if (detectedFps) {
    const _0x3f18b4 = +(detectedFps * selectedFpsRatio).toFixed(4);
    srcFpsDisplay.textContent = detectedFps + " fps";
    outFpsDisplay.textContent = _0x3f18b4 + " fps";
  } else {
    srcFpsDisplay.textContent = "—";
    outFpsDisplay.textContent = "—";
  }
}
function updateCmdPreview() {
  const _0x11a76d = selectedFpsRatio;
  const _0x14a6f0 = ffmpegSelectedFile ? ffmpegSelectedFile.name.replace(/\.[^/.]+$/, "") : "input";
  const _0x5e3e03 = detectedFps ? +(detectedFps * _0x11a76d).toFixed(4) : "(src×" + _0x11a76d + ")";
  const _0x1ba58c = +(1 / _0x11a76d).toFixed(4);
  cmdPreview.innerHTML = "ffmpeg -i <span style='color:#f0900a'>" + _0x14a6f0 + ".mp4</span> " + ("-vf \"fps=fps=<span style='color:#3b9eff'>" + _0x5e3e03 + "</span>,setpts=<span style='color:#3b9eff'>" + _0x1ba58c + "</span>*PTS\" ") + "-c:v libx264 -crf 18 -c:a copy " + ("<span style='color:#22d97a'>" + _0x14a6f0 + "_fps" + _0x11a76d + "x_encodexhd.mp4</span>");
}
function setFfmpegStatus(_0x4dddbb, _0xbd1205 = "idle") {
  ffmpegStatusEl.textContent = _0x4dddbb;
  ffmpegStatusEl.dataset.state = _0xbd1205;
}
function detectFpsFromBuffer(_0x287ca7) {
  try {
    const _0x425f34 = new Uint8Array(_0x287ca7);
    const _0xabde7a = new DataView(_0x287ca7);
    const _0x2a04dd = parseBoxes(_0x425f34, _0xabde7a);
    const _0x2b974d = findTopLevel(_0x2a04dd, "moov");
    if (!_0x2b974d) {
      return null;
    }
    const _0x2e1023 = _0x2b974d.children.find(_0x2c865a => _0x2c865a.type === "trak" && handlerTypeForTrak(_0x2c865a) === "vide");
    if (!_0x2e1023) {
      return null;
    }
    const _0x3c7b17 = findDescendant(_0x2e1023, ["mdia", "mdhd"]);
    if (!_0x3c7b17) {
      return null;
    }
    const _0x1a6699 = _0x3c7b17.data[_0x3c7b17.contentStart];
    let _0x27d482;
    if (_0x1a6699 === 1) {
      _0x27d482 = _0x3c7b17.view.getUint32(_0x3c7b17.contentStart + 20, false);
    } else {
      _0x27d482 = _0x3c7b17.view.getUint32(_0x3c7b17.contentStart + 12, false);
    }
    if (!_0x27d482) {
      return null;
    }
    const _0x216041 = findDescendant(_0x2e1023, ["mdia", "minf", "stbl"]);
    if (!_0x216041) {
      return null;
    }
    const _0x463846 = findChild(_0x216041, "stts");
    if (!_0x463846) {
      return null;
    }
    const _0x5be056 = _0x463846.view.getUint32(_0x463846.contentStart + 4, false);
    if (_0x5be056 < 1) {
      return null;
    }
    const _0x3eedcb = _0x463846.view.getUint32(_0x463846.contentStart + 8 + 4, false);
    if (!_0x3eedcb) {
      return null;
    }
    return Math.round(_0x27d482 / _0x3eedcb * 1000) / 1000;
  } catch (_0x398fbd) {
    return null;
  }
}
ffmpegUploadTrigger.addEventListener("click", () => ffmpegFileInput.click());
ffmpegFileInput.addEventListener("change", async _0x519e5e => {
  ffmpegSelectedFile = _0x519e5e.target.files && _0x519e5e.target.files[0] ? _0x519e5e.target.files[0] : null;
  if (!ffmpegSelectedFile) {
    ffmpegFileNameDisp.textContent = "No file selected...";
    ffmpegFileNameDisp.classList.remove("has-file");
    ffmpegPatchBtn.disabled = true;
    ffmpegPatchBtn.classList.remove("enabled");
    detectedFps = null;
    updateFpsDisplays();
    updateCmdPreview();
    setFfmpegStatus("Ready — select a video to begin.", "idle");
    return;
  }
  ffmpegFileNameDisp.textContent = ffmpegSelectedFile.name;
  ffmpegFileNameDisp.classList.add("has-file");
  setFfmpegStatus("Detecting FPS…", "processing");
  try {
    const _0x2c4b64 = ffmpegSelectedFile.slice(0, 524288);
    const _0xaedeb8 = await _0x2c4b64.arrayBuffer();
    detectedFps = detectFpsFromBuffer(_0xaedeb8);
  } catch (_0x4fe80f) {
    detectedFps = null;
  }
  updateFpsDisplays();
  updateCmdPreview();
  const _0x3c92d7 = detectedFps ? detectedFps + " fps" : "FPS unknown";
  setFfmpegStatus("Ready: " + ffmpegSelectedFile.name + " — " + _0x3c92d7, "idle");
  ffmpegPatchBtn.disabled = false;
  ffmpegPatchBtn.classList.add("enabled");
  if (ffmpegSelectedFile.size > 94371840) {
    showSizeWarning();
  }
});
ffmpegPatchBtn.addEventListener("click", async () => {
  if (!ffmpegSelectedFile) {
    return;
  }
  setFfmpegStatus("Reading file…", "processing");
  ffmpegProgress.classList.add("visible");
  ffmpegProgressBar.style.width = "10%";
  ffmpegTiktokBtn.style.display = "none";
  try {
    const _0x2e0b48 = await ffmpegSelectedFile.arrayBuffer();
    ffmpegProgressBar.style.width = "35%";
    setFfmpegStatus("Patching FPS metadata…", "processing");
    const _0x32493c = patchFpsMetadata(_0x2e0b48, selectedFpsRatio);
    ffmpegProgressBar.style.width = "80%";
    setFfmpegStatus("Saving file…", "processing");
    const _0x1b5b19 = {
      type: ffmpegSelectedFile.type || "video/mp4"
    };
    const _0x28f0aa = new Blob([_0x32493c.output], _0x1b5b19);
    const _0x44db25 = URL.createObjectURL(_0x28f0aa);
    const _0x9da916 = document.createElement("a");
    _0x9da916.href = _0x44db25;
    const _0x2fb0c4 = ffmpegSelectedFile.name.replace(/\.[^/.]+$/, "");
    _0x9da916.download = _0x2fb0c4 + "_fps" + selectedFpsRatio + "x_encodexhd.mp4";
    document.body.appendChild(_0x9da916);
    _0x9da916.click();
    _0x9da916.remove();
    URL.revokeObjectURL(_0x44db25);
    ffmpegProgressBar.style.width = "100%";
    const _0x53e4dd = _0x32493c.originalFps ? +(_0x32493c.originalFps * selectedFpsRatio).toFixed(4) : "?";
    setFfmpegStatus("Done: FPS patched " + (_0x32493c.originalFps || "?") + " → " + _0x53e4dd + " fps · File downloaded.", "success");
    ffmpegTiktokBtn.style.display = "inline-flex";
    setTimeout(() => {
      ffmpegProgress.classList.remove("visible");
      ffmpegProgressBar.style.width = "0%";
    }, 2000);
  } catch (_0x674137) {
    ffmpegProgressBar.style.width = "100%";
    ffmpegProgressBar.style.background = "var(--red)";
    setFfmpegStatus("Error: " + (_0x674137 && _0x674137.message ? _0x674137.message : "unknown error"), "error");
    setTimeout(() => {
      ffmpegProgress.classList.remove("visible");
      ffmpegProgressBar.style.width = "0%";
      ffmpegProgressBar.style.background = "var(--blue)";
    }, 2000);
  }
});
function patchFpsMetadata(_0x49ca7e, _0x47159d) {
  const _0x2fffdb = _0x49ca7e.slice(0);
  const _0x35e576 = new Uint8Array(_0x2fffdb);
  const _0x2804d2 = new DataView(_0x2fffdb);
  const _0x25fcca = parseBoxes(_0x35e576, _0x2804d2);
  const _0x3a80b4 = findTopLevel(_0x25fcca, "moov");
  if (!_0x3a80b4) {
    throw new Error("No moov box found. Make sure this is a valid MP4.");
  }
  const _0x2125ed = _0x3a80b4.children.find(_0xfc63e4 => _0xfc63e4.type === "trak" && handlerTypeForTrak(_0xfc63e4) === "vide");
  if (!_0x2125ed) {
    throw new Error("No video track found.");
  }
  const _0x41e67c = findDescendant(_0x2125ed, ["mdia", "mdhd"]);
  if (!_0x41e67c) {
    throw new Error("No mdhd box found in video track.");
  }
  const _0x36b02a = _0x35e576[_0x41e67c.contentStart];
  let _0x3fa738;
  if (_0x36b02a === 1) {
    _0x3fa738 = _0x2804d2.getUint32(_0x41e67c.contentStart + 20, false);
  } else {
    _0x3fa738 = _0x2804d2.getUint32(_0x41e67c.contentStart + 12, false);
  }
  if (!_0x3fa738) {
    throw new Error("Invalid timescale in mdhd.");
  }
  const _0x19ba7d = findDescendant(_0x2125ed, ["mdia", "minf", "stbl"]);
  if (!_0x19ba7d) {
    throw new Error("No stbl box found in video track.");
  }
  const _0x202737 = findChild(_0x19ba7d, "stts");
  if (!_0x202737) {
    throw new Error("No stts box found in video track.");
  }
  const _0x4ff4d0 = _0x2804d2.getUint32(_0x202737.contentStart + 4, false);
  if (_0x4ff4d0 < 1) {
    throw new Error("stts has no entries.");
  }
  let _0xc627de = null;
  let _0x353bcf = 0;
  for (let _0x3443a1 = 0; _0x3443a1 < _0x4ff4d0; _0x3443a1++) {
    const _0x4424b4 = _0x202737.contentStart + 8 + _0x3443a1 * 8 + 4;
    const _0x39563d = _0x2804d2.getUint32(_0x4424b4, false);
    if (_0x39563d === 0) {
      continue;
    }
    const _0x32d0e4 = Math.round(_0x3fa738 / _0x39563d * 1000) / 1000;
    if (_0x32d0e4 < 1 || _0x32d0e4 > 300) {
      continue;
    }
    if (!_0xc627de) {
      _0xc627de = _0x32d0e4;
    }
    const _0x40dfa4 = Math.round(_0x39563d / _0x47159d);
    _0x2804d2.setUint32(_0x4424b4, _0x40dfa4, false);
    _0x353bcf++;
  }
  if (_0x353bcf === 0) {
    throw new Error("No patchable stts entries found. Make sure this is a valid MP4.");
  }
  const _0x9ae485 = {
    output: _0x35e576,
    originalFps: _0xc627de,
    patched: _0x353bcf
  };
  return _0x9ae485;
}
updateCmdPreview();