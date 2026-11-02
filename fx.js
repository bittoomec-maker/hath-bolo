/* Hath Bolo — synthesized sounds (no audio files needed), haptics and confetti. */
(function (root) {
  'use strict';
  var ctx = null, enabledSound = true, enabledVibe = true, noiseBuf = null;

  function ac() {
    if (!ctx) {
      var C = root.AudioContext || root.webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function unlock() { try { ac(); } catch (e) { /* ignore */ } }
  ['pointerdown', 'touchstart', 'keydown'].forEach(function (ev) {
    root.addEventListener(ev, unlock, { once: true, passive: true });
  });

  function noise(a) {
    if (noiseBuf) return noiseBuf;
    var len = a.sampleRate * 0.25;
    noiseBuf = a.createBuffer(1, len, a.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }

  function flick(vol, freq, dur) {
    var a = ac(); if (!a) return;
    var src = a.createBufferSource(); src.buffer = noise(a);
    var f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq || 2400; f.Q.value = 0.9;
    var g = a.createGain(); var t = a.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.35, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.09));
    src.connect(f); f.connect(g); g.connect(a.destination);
    src.start(t); src.stop(t + (dur || 0.09) + 0.02);
  }

  function tone(freq, start, dur, vol, type) {
    var a = ac(); if (!a) return;
    var o = a.createOscillator(); o.type = type || 'sine'; o.frequency.value = freq;
    var g = a.createGain(); var t = a.currentTime + (start || 0);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.15, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }

  var sounds = {
    card: function () { flick(0.4, 2600, 0.08); },
    deal: function () { flick(0.18, 3200, 0.05); },
    click: function () { tone(880, 0, 0.06, 0.06, 'triangle'); },
    bid: function () { tone(523, 0, 0.12, 0.08, 'triangle'); tone(784, 0.07, 0.14, 0.07, 'triangle'); },
    pass: function () { tone(330, 0, 0.12, 0.06, 'triangle'); },
    trickUs: function () { tone(659, 0, 0.12, 0.08); tone(988, 0.08, 0.2, 0.08); },
    trickThem: function () { tone(392, 0, 0.16, 0.06); },
    made: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, i * 0.09, 0.3, 0.09, 'triangle'); }); },
    failed: function () { [392, 330, 262].forEach(function (f, i) { tone(f, i * 0.12, 0.3, 0.08, 'triangle'); }); },
    win: function () { [523, 659, 784, 659, 784, 1047].forEach(function (f, i) { tone(f, i * 0.11, 0.35, 0.1, 'triangle'); }); },
    error: function () { tone(180, 0, 0.12, 0.08, 'square'); }
  };

  function play(name) {
    if (!enabledSound || !sounds[name]) return;
    try { sounds[name](); } catch (e) { /* ignore */ }
  }

  function buzz(kind) {
    if (!enabledVibe) return;
    try {
      var H = root.Capacitor && root.Capacitor.Plugins && root.Capacitor.Plugins.Haptics;
      if (H && root.Capacitor.isNativePlatform && root.Capacitor.isNativePlatform()) {
        if (kind === 'success') H.notification({ type: 'SUCCESS' });
        else if (kind === 'error') H.notification({ type: 'ERROR' });
        else H.impact({ style: kind === 'medium' ? 'MEDIUM' : 'LIGHT' });
        return;
      }
      if (navigator.vibrate) navigator.vibrate(kind === 'success' ? [20, 60, 30] : kind === 'error' ? [60, 40, 60] : kind === 'medium' ? 18 : 8);
    } catch (e) { /* ignore */ }
  }

  function confetti(duration) {
    var c = document.createElement('canvas');
    c.className = 'confetti';
    document.body.appendChild(c);
    var dpr = root.devicePixelRatio || 1;
    var W = c.width = root.innerWidth * dpr, H = c.height = root.innerHeight * dpr;
    var g = c.getContext('2d');
    var colors = ['#f2c14e', '#ffffff', '#e65a4f', '#5fd0a0', '#7cc0ff'];
    var parts = [];
    for (var i = 0; i < 160; i++) {
      parts.push({ x: Math.random() * W, y: -Math.random() * H * 0.6, vx: (Math.random() - 0.5) * 3 * dpr, vy: (2 + Math.random() * 4) * dpr,
        w: (6 + Math.random() * 6) * dpr, h: (3 + Math.random() * 4) * dpr, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, col: colors[i % colors.length] });
    }
    var start = performance.now();
    duration = duration || 3200;
    function frame(now) {
      var el = now - start;
      g.clearRect(0, 0, W, H);
      parts.forEach(function (p) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.04 * dpr; p.r += p.vr;
        g.save(); g.translate(p.x, p.y); g.rotate(p.r);
        g.globalAlpha = Math.max(0, 1 - el / duration);
        g.fillStyle = p.col; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore();
      });
      if (el < duration) requestAnimationFrame(frame); else c.remove();
    }
    requestAnimationFrame(frame);
  }

  root.FX = {
    play: play, buzz: buzz, confetti: confetti,
    setSound: function (v) { enabledSound = !!v; },
    setVibe: function (v) { enabledVibe = !!v; }
  };
})(window);
