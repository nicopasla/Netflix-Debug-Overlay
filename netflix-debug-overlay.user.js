// ==UserScript==
// @name         Netflix Debug Overlay
// @namespace    https://github.com/nicopasla/Netflix-Debug-Overlay
// @version      1.0.0
// @license      MIT
// @author       nicopasla
// @description  Click the button or press Ctrl+Shift+Alt+D to activate. Read-only, does not modify Netflix in any way.
// @match        https://www.netflix.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const POLL_PLAYING = 1000;
  const POLL_PAUSED  = 3000;

  const styleEl = document.createElement('style');
  styleEl.textContent = `
    #nfdo {
      position: fixed;
      z-index: 2147483647;
      top: 50%;
      left: 16px;
      transform: translateY(-50%);
      width: 260px;
      padding: 8px 11px;
      background: rgba(0,0,0,0.85);
      border-radius: 6px;
      pointer-events: none;
      user-select: none;
      font: 13px/2 'Netflix Sans', system-ui, -apple-system, sans-serif;
      color: #fff;
    }
    #nfdo hr {
      border: none;
      border-top: 1px solid rgba(255,255,255,0.1);
      margin: 4px 0;
    }
    #nfdo .row { display: flex; justify-content: space-between; }
    #nfdo .row span:last-child {
      font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
      font-size: 12px;
    }
    #nfdo .lbl { color: rgba(255,255,255,0.5); }
    #nfdo .playing { color: #4caf50; }
    #nfdo .paused  { color: #ff9800; }
    #nfdo-activate {
      position: fixed;
      z-index: 2147483647;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      padding: 5px 18px;
      background: rgba(0,0,0,0.85);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 4px;
      color: #fff;
      font: 13px/1.6 'Netflix Sans', system-ui, -apple-system, sans-serif;
      cursor: pointer;
    }
    #nfdo-activate:hover { background: rgba(255,255,255,0.12); }
    #nfdo .topbar {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    #nfdo .tbtn {
      font-size: 11px;
      color: rgba(255,255,255,0.3);
      cursor: pointer;
      pointer-events: all;
      line-height: 1;
    }
    #nfdo .tbtn:hover { color: #fff; }
    #nfdo .sec {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: .1em;
      text-transform: uppercase;
      color: #5bc8d4 !important;
      margin: 2px 0 0;
    }
  `;
  document.head.appendChild(styleEl);

  const row = (lbl, val) =>
    `<div class="row"><span class="lbl">${lbl}</span><span>${val}</span></div>`;

  const sectionLabel = label => `<div class="sec">${label}</div>`;

  function fireShortcut() {
    ['keydown', 'keyup'].forEach(type =>
      document.dispatchEvent(new KeyboardEvent(type, {
        key: 'D', code: 'KeyD', keyCode: 68,
        ctrlKey: true, shiftKey: true, altKey: true,
        bubbles: true, cancelable: true,
      }))
    );
  }

  function getDebugTextarea() {
    for (const ta of document.querySelectorAll('textarea[readonly]'))
      if (ta.value.toLowerCase().includes('playing bitrate')) return ta;
    return null;
  }

  function hideNetflixPanel(ta) {
    let el = ta.parentElement;
    while (el && el !== document.body) {
      const pos = getComputedStyle(el).position;
      if (pos === 'absolute' || pos === 'fixed') {
        el.style.setProperty('display', 'none', 'important');
        return;
      }
      el = el.parentElement;
    }
    ta.parentElement.style.setProperty('display', 'none', 'important');
  }

  function parse(text) {
    const kv = {};
    for (const line of text.split('\n')) {
      const i = line.indexOf(':');
      if (i === -1) continue;
      const key = line.slice(0, i).trim();
      const val = line.slice(i + 1).trim();
      if (key && val) kv[key] = val;
    }
    const get = k => kv[k] ?? null;

    let aBr = null, vBr = null, res = null;
    const brRaw = get('Playing bitrate (a/v)');
    if (brRaw) {
      const m = brRaw.match(/(\d+)\s*\/\s*(\d+)(?:\s*\((\d+x\d+)\))?/);
      if (m) { aBr = +m[1]; vBr = +m[2]; res = m[3] || null; }
    }

    let vBrBuf = null;
    const brBufRaw = get('Buffering bitrate (a/v)');
    if (brBufRaw) {
      const m = brBufRaw.match(/\d+\s*\/\s*(\d+)/);
      if (m) vBrBuf = +m[1];
    }

    let bufA = null, bufV = null;
    const bufRaw = get('Buffer size in Seconds (a/v)');
    if (bufRaw) {
      const m = bufRaw.match(/([\d.]+)\s*\/\s*([\d.]+)/);
      if (m) { bufA = +m[1]; bufV = +m[2]; }
    }

    const tpRaw = get('Throughput');
    const throughput = tpRaw ? parseInt(tpRaw.match(/\d+/)?.[0]) : null;

    let cdn = null;
    const cdnRaw = get('Current CDN (a/v/t)');
    if (cdnRaw) {
      const m = cdnRaw.match(/([a-z0-9._-]+\.[a-z]{2,})/i);
      if (m) cdn = m[1];
    }

    let aCodec = null, aCh = null, aLang = null;
    const aRaw = get('Audio Track');
    if (aRaw) {
      const lang = aRaw.match(/^([a-z]{2,3})\b/i);
      const ch   = aRaw.match(/Channels:\s*([\d.]+)/i);
      const ac   = aRaw.match(/\(([^)]+)\)\s*$/);
      aLang  = lang ? lang[1].toLowerCase() : null;
      aCh    = ch   ? ch[1] : null;
      aCodec = ac   ? ac[1] : null;
    }

    let vmafP = null, vmafB = null;
    const vmafRaw = get('Playing/Buffering vmaf');
    if (vmafRaw) {
      const m = vmafRaw.match(/(\d+)\s*\/\s*(\d+)/);
      if (m) { vmafP = +m[1]; vmafB = +m[2]; }
    }

    let vCodec = null;
    const vRaw = get('Video Track');
    if (vRaw) {
      const m = vRaw.match(/codecs=([^\s;,]+)(?:\s*\(([^)]+)\))?/);
      if (m) vCodec = m[2] ? `${m[1]} (${m[2]})` : m[1];
    }

    const ksRaw = get('KeySystem');
    let ks = null;
    if (ksRaw) {
      const r = ksRaw.toLowerCase();
      if      (r.includes('apple.fps'))  ks = 'FairPlay';
      else if (r.includes('playready'))  { const v = ksRaw.match(/(\d+)$/); ks = v ? `PlayReady ${v[1]}` : 'PlayReady'; }
      else if (r.includes('widevine'))   { const v = ksRaw.split('.').pop(); ks = v.replace(/_/g, ' ').toLowerCase(); }
      else                               ks = ksRaw.split('.').pop();
    }

    let keyRes = null;
    const ksStatus = get('KeyStatus');
    if (ksStatus) {
      const m = ksStatus.match(/,\s*((?:\d+,?\s*)+),\s*(?:usable|expired|output-restricted)/i);
      if (m) keyRes = m[1].trim().replace(/\s*,\s*/g, '/');
    }

    const hdrRaw = get('HDR support');
    let hdr = null, hdrType = null;
    if (hdrRaw) {
      hdr = hdrRaw.toLowerCase().startsWith('true');
      const hm = hdrRaw.match(/\(([^)]+)\)/);
      const noise = ['non-hdr-display', 'is-type-supported'];
      const raw = hm ? hm[1].toLowerCase() : null;
      hdrType = raw && !noise.includes(raw) ? raw : null;
    }

    return {
      aBr, vBr, res, vBrBuf, bufA, bufV, throughput, vmafP, vmafB,
      cdn, aCodec, aCh, aLang, vCodec,
      framerate:   get('Framerate'),
      totalF:      get('Total Frames'),
      droppedF:    get('Total Dropped Frames'),
      renderState: get('Rendering state'),
      pos:         get('Position') != null ? parseFloat(get('Position')) : null,
      dur:         get('Duration') != null ? parseFloat(get('Duration')) : null,
      volume:      get('Volume'),
      hdr, hdrType, ks, keyRes,
    };
  }

  const fmtBr = kbps => kbps == null ? '—' : `${kbps} kb/s`;

  function fmtTime(s) {
    if (s == null) return '—';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const secs = Math.floor(s % 60);
    return h > 0
      ? `${h}:${String(m).padStart(2,'0')}:${String(secs).padStart(2,'0')}`
      : `${m}:${String(secs).padStart(2,'0')}`;
  }

  const CDN_REGIONS = {
    ams: 'Amsterdam', bru: 'Brussels', cdg: 'Paris', lhr: 'London',
    fra: 'Frankfurt', mad: 'Madrid', mxp: 'Milan', arn: 'Stockholm',
    dub: 'Dublin', waw: 'Warsaw', atl: 'Atlanta', iad: 'Washington',
    lax: 'Los Angeles', jfk: 'New York', ord: 'Chicago', dfw: 'Dallas',
    sea: 'Seattle', mia: 'Miami', sfo: 'San Francisco', yyz: 'Toronto',
    nrt: 'Tokyo', hkg: 'Hong Kong', sin: 'Singapore', syd: 'Sydney',
    gru: 'São Paulo', bog: 'Bogotá', scl: 'Santiago',
  };
  function cdnRegion(cdn) {
    if (!cdn) return null;
    const m = cdn.match(/\b([a-z]{3})\d{3}\b/);
    return m ? (CDN_REGIONS[m[1]] || m[1].toUpperCase()) : null;
  }

  let pollTimer = null;

  function setPoll(state, overlay, btn, ms) {
    if (state.currentPoll === ms) return;
    state.currentPoll = ms;
    clearInterval(pollTimer);
    pollTimer = setInterval(() => render(overlay, btn, state), ms);
  }

  function render(overlay, btn, state) {
    const ta = getDebugTextarea();

    if (!ta) {
      state.closed = false;
      btn.style.display     = 'block';
      overlay.style.display = 'none';
      return;
    }

    if (state.closed) {
      btn.style.display     = 'block';
      overlay.style.display = 'none';
      return;
    }

    btn.style.display     = 'none';
    overlay.style.display = 'block';

    hideNetflixPanel(ta);
    const d = parse(ta.value);
    const isPlaying = d.renderState !== 'Paused';

    setPoll(state, overlay, btn, isPlaying ? POLL_PLAYING : POLL_PAUSED);

    const stateCls = isPlaying ? 'playing' : 'paused';
    const stateStr = isPlaying ? 'PLAYING' : 'PAUSED';

    let html = row('State', `<span class="${stateCls}">${stateStr}</span>`);

    html += `<hr>` + sectionLabel('VIDEO');
    if (d.res)            html += row('Resolution',  d.res);
    if (d.vBr)            html += row('Bitrate',     fmtBr(d.vBr));
    if (d.vBrBuf != null) html += row('Buffering',   fmtBr(d.vBrBuf));
    if (d.bufV != null)   html += row('Buffer',      `${d.bufV.toFixed(1)}s`);
    if (d.vCodec)         html += row('Codec',       d.vCodec);
    if (d.framerate)      html += row('Frame rate',  `${d.framerate} fps`);
    if (d.vmafP != null)  html += row('VMAF p/b',    `${d.vmafP} / ${d.vmafB}`);
    if (d.hdr !== null)   html += row('HDR',         d.hdr ? `YES${d.hdrType ? ` (${d.hdrType})` : ''}` : 'NO');
    if (d.throughput && d.vBr)
      html += row('ABR usage', `${Math.round((d.vBr / d.throughput) * 100)}%`);

    html += `<hr>` + sectionLabel('AUDIO');
    html += row('Bitrate',  fmtBr(d.aBr));
    if (d.aCh)            html += row('Channels', d.aCh);
    if (d.bufA != null)   html += row('Buffer',   `${d.bufA.toFixed(1)}s`);
    if (d.aCodec)         html += row('Codec',    d.aCodec);
    if (d.aLang)          html += row('Language', d.aLang);

    html += `<hr>` + sectionLabel('NETWORK');
    if (d.throughput)     html += row('Throughput', fmtBr(d.throughput));
    if (d.cdn) {
      const region = cdnRegion(d.cdn);
      html += row('CDN', region
        ? `${d.cdn.replace('.nflxvideo.net', '')} (${region})`
        :  d.cdn.replace('.nflxvideo.net', ''));
    }
    if (d.ks)             html += row('DRM',     d.ks);
    if (d.keyRes)         html += row('DRM res', d.keyRes);

    html += `<hr>` + sectionLabel('PLAYBACK');
    if (d.totalF)              html += row('Dropped',  `${parseInt(d.droppedF) || 0} / ${d.totalF}`);
    if (d.volume)              html += row('Volume',   d.volume);
    if (d.pos != null && d.dur != null)
      html += row('Position', `${fmtTime(d.pos)} / ${fmtTime(d.dur)}`);

    overlay.innerHTML = html;

    const topBar = document.createElement('div');
    topBar.className = 'topbar';

    const mkBtn = (label, onClick) => {
      const s = document.createElement('span');
      s.className = 'tbtn';
      s.textContent = label;
      s.addEventListener('click', onClick);
      return s;
    };

    topBar.appendChild(mkBtn('copy', () => navigator.clipboard.writeText(ta.value)));

    topBar.appendChild(mkBtn('copy json', () => {
      navigator.clipboard.writeText(JSON.stringify({
        resolution:     d.res,
        video_bitrate:  d.vBr,
        audio_bitrate:  d.aBr,
        video_codec:    d.vCodec,
        audio_codec:    d.aCodec,
        audio_lang:     d.aLang,
        audio_channels: d.aCh,
        framerate:      d.framerate,
        vmaf:           d.vmafP,
        hdr:            d.hdr,
        hdr_type:       d.hdrType,
        throughput:     d.throughput,
        abr_usage:      (d.throughput && d.vBr) ? Math.round((d.vBr / d.throughput) * 100) : null,
        cdn:            d.cdn?.replace('.nflxvideo.net', '') ?? null,
        cdn_region:     cdnRegion(d.cdn),
        drm:            d.ks,
        drm_res:        d.keyRes,
        dropped_frames: parseInt(d.droppedF) || 0,
        total_frames:   d.totalF ? parseInt(d.totalF) : null,
        timestamp: new Date().toISOString(),
        debug_raw:      ta.value,
      }, null, 2));
    }));

    topBar.appendChild(mkBtn('x', () => {
      state.closed = true;
      overlay.style.display = 'none';
      btn.style.display = 'block';
    }));

    overlay.prepend(topBar);
  }

  let retryTimer = null;

  function boot() {
    if (document.getElementById('nfdo')) return true;
    if (!document.body) return false;

    const overlay = document.createElement('div');
    overlay.id = 'nfdo';
    overlay.style.display = 'none';
    document.body.appendChild(overlay);

    const btn = document.createElement('button');
    btn.id = 'nfdo-activate';
    btn.textContent = 'Show Debug';
    document.body.appendChild(btn);

    const state = { closed: false, currentPoll: POLL_PLAYING };
    pollTimer = setInterval(() => render(overlay, btn, state), POLL_PLAYING);

    btn.addEventListener('click', () => {
      state.closed = false;
      if (!getDebugTextarea()) fireShortcut();
    });
    return true;
  }

  function teardown() {
    clearInterval(pollTimer);
    clearTimeout(retryTimer);
    pollTimer = retryTimer = null;
    document.getElementById('nfdo')?.remove();
    document.getElementById('nfdo-activate')?.remove();
  }

  function tryBoot(attempts = 40) {
    if (!location.pathname.startsWith('/watch')) return;
    if (boot()) return;
    if (attempts > 0) retryTimer = setTimeout(() => tryBoot(attempts - 1), 500);
  }

  function onNavigate() {
    teardown();
    tryBoot();
  }

  const _push    = history.pushState.bind(history);
  const _replace = history.replaceState.bind(history);
  history.pushState    = (...a) => { _push(...a);    onNavigate(); };
  history.replaceState = (...a) => { _replace(...a); onNavigate(); };
  window.addEventListener('popstate', onNavigate);

  let lastPath = location.pathname;
  new MutationObserver(() => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      onNavigate();
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  tryBoot();

})();