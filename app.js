/* Hath Bolo — UI controller. */
(function () {
  'use strict';
  var HB = window.HB, t = I18N.t, FX = window.FX;
  var $ = function (s) { return document.querySelector(s); };

  // ------------------------------------------------------------ storage
  function load(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  function drop(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }

  var DEF_SETTINGS = { lang: 'hi', target: 30, speed: 'normal', sound: true, vibe: true, quick: false, hints: true };
  var DEF_STATS = { matches: 0, won: 0, lost: 0, rounds: 0, bidsMade: 0, bidsFailed: 0, bestBid: 0, streak: 0, bestStreak: 0 };
  var settings = Object.assign({}, DEF_SETTINGS, load('hb_settings', {}));
  var stats = Object.assign({}, DEF_STATS, load('hb_stats', {}));
  var st = load('hb_save', null);
  if (st && (st.v !== 2 || st.online)) st = null;
  var solo = st; // last single-player game (for "Continue")

  function saveSettings() { store('hb_settings', settings); }
  function saveStats() { store('hb_stats', stats); }
  function saveGame() { if (st && !st.online) store('hb_save', st); }

  // ------------------------------------------------------------ runtime state
  var runId = 0;          // bumps whenever a game loop must stop (new game / home)
  var busy = false;       // animations running; ignore taps
  var displayTrick = [];  // cards shown in the middle
  var lastEvent = '';     // first half of the status line
  var hintCard = null;

  function speed() { return settings.speed === 'slow' ? 1.45 : settings.speed === 'fast' ? 0.5 : 1; }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms * speed()); }); }
  function alive(id) { return id === runId; }

  // ------------------------------------------------------------ helpers
  function nameOf(seat) {
    if (seat === 0) return t('you');
    if (st && st.online && st.names) return esc(st.names[seat]);
    return t('comp', seat);
  }
  function isRed(s) { return s === 1 || s === 3; }
  function suitSvg(s, cls) { return '<svg class="s ' + (cls || (isRed(s) ? 'red' : 'blk')) + '" viewBox="0 0 100 100"><use href="#suit-' + s + '"/></svg>'; }
  function suitChip(s) { return '<span class="s-chip">' + suitSvg(s) + '</span>'; }
  function suitName(s) { return t('suitNames')[s]; }
  function miniCard(c, extra) {
    var s = HB.suitOf(c);
    return '<span class="mini-card ' + (isRed(s) ? 'red' : 'blk') + ' ' + (extra || '') + '">' + HB.rankLabel(HB.rankOf(c)) + suitSvg(s) + '</span>';
  }
  function teamNames(team) { return team === 0 ? t('you') + ' + ' + nameOf(2) : nameOf(1) + ' + ' + nameOf(3); }
  function teamLabel(team) { return team === 0 ? t('usTeam') : t('themTeam'); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function cardEl(c) {
    var s = HB.suitOf(c), r = HB.rankOf(c), rl = HB.rankLabel(r);
    var el = document.createElement('div');
    var kind = r >= 11 && r <= 13 ? 'face' : r === 14 ? 'ace' : 'num';
    el.className = 'card ' + kind + ' ' + (isRed(s) ? 'red' : 'blk');
    el.dataset.c = c;
    var use = '<svg viewBox="0 0 100 100"><use href="#suit-' + s + '"/></svg>';
    var ix = '<span>' + rl + '</span>' + use;
    var pip = kind === 'face' ? '<span class="fl">' + rl + '</span>' + use : use;
    el.innerHTML = '<div class="ix">' + ix + '</div><div class="pip">' + pip + '</div><div class="ix b">' + ix + '</div>';
    return el;
  }

  // ------------------------------------------------------------ screens
  function show(id) {
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.toggle('active', s.id === id); });
    if (id === 'home') refreshHome();
  }

  function applyLang() {
    I18N.setLang(settings.lang);
    document.documentElement.lang = settings.lang === 'en' ? 'en' : 'hi';
    document.querySelectorAll('[data-t]').forEach(function (el) { el.textContent = t(el.dataset.t); });
    document.querySelectorAll('#homeLang button').forEach(function (b) { b.classList.toggle('on', b.dataset.lang === settings.lang); });
    if (st && $('#game').classList.contains('active')) renderAll();
  }

  function refreshHome() {
    var sv = st && !st.online ? st : load('hb_save', null);
    var can = !!(sv && sv.v === 2 && !sv.online && sv.phase !== 'matchOver' && sv.round > 0);
    $('#btnContinue').style.display = can ? '' : 'none';
    $('#btnNew').classList.toggle('gold', !can);
    $('#btnNew').classList.toggle('ghost', !!can);
  }

  // ------------------------------------------------------------ rendering
  function renderAll() {
    renderScores();
    renderRoundbar();
    renderSeats();
    renderHand();
    renderTrick();
    renderStatus();
    $('#btnHint').classList.toggle('hidden', !settings.hints);
    $('#btnEmote').style.display = st.online ? '' : 'none';
    $('#roundLabel').textContent = st.round ? t('roundN', st.round) + ' · ' + t('firstTo', st.target) : t('firstTo', st.target);
  }

  function renderScores(bump) {
    [0, 1].forEach(function (team) {
      var el = $('#team' + team);
      el.querySelector('.tc-name').textContent = teamNames(team);
      var p = el.querySelector('.pts');
      p.textContent = st.scores[team];
      el.querySelector('.tgt').textContent = '/ ' + st.target;
      el.querySelector('.tc-bar i').style.width = Math.max(0, Math.min(100, st.scores[team] / st.target * 100)) + '%';
      if (bump && bump[team]) { p.classList.remove('bump'); void p.offsetWidth; p.classList.add('bump'); }
    });
  }

  function renderRoundbar() {
    var el = $('#roundbar');
    if (st.phase === 'bidding') {
      el.innerHTML = '<span class="rb-chip" style="padding-left:10px">' + (settings.lang === 'en' ? 'Bidding' : 'Bidding chal rahi hai') + '</span>';
      return;
    }
    if (st.trump === null || st.trump === undefined || st.bidder === null) { el.innerHTML = ''; return; }
    var bt = HB.teamOf(st.bidder), ot = 1 - bt;
    var got = st.teamTricks[bt], bid = st.highBid;
    var col = bt === 0 ? 'var(--us)' : 'var(--them)';
    el.innerHTML =
      '<span class="rb-chip">' + suitChip(st.trump) + t('trumpLabel') + '</span>' +
      '<span class="rb-chip" style="padding-left:10px">' + t('bidLabel') + ' <b>' + bid + '</b>&nbsp;· ' + nameOf(st.bidder) + '</span>' +
      '<span class="rb-progress"><span class="pbar"><i style="width:' + (got / 13 * 100) + '%;background:' + col + '"></i><b style="left:calc(' + (bid / 13 * 100) + '% - 1px)"></b></span>' +
      '<span class="ptxt"><b style="color:' + col + '">' + got + '/' + bid + '</b> · <span style="color:' + (ot === 0 ? 'var(--us)' : 'var(--them)') + '">' + st.teamTricks[ot] + '</span></span></span>';
  }

  function seatHTML(i) {
    var isTurn = (st.phase === 'bidding' && st.bidTurn === i) || (st.phase === 'play' && st.turn === i) || (st.phase === 'trump' && st.bidder === i);
    var badges = '';
    var b = st.bids[i];
    if (typeof b === 'number') badges += '<span class="badge bid">' + t('bidBadge', b) + '</span>';
    else if (b === 'pass') badges += '<span class="badge pass">' + t('pass') + '</span>';
    if (st.phase === 'play' || st.phase === 'roundEnd' || st.phase === 'roundOver') badges += '<span class="badge tricks">' + t('hath', st.tricksWon[i]) + '</span>';
    var think = isTurn && i !== 0 ? '<span class="thinking"><i></i><i></i><i></i></span>' : '';
    var initial = i === 0 ? t('you').charAt(0) : String(i);
    var offline = st.online && st.onlineSeats && !st.onlineSeats[i];
    if (st.online && i !== 0) initial = st.bots[i] ? 'C' + (((i + st.mySeat) % 4) || '') : esc(st.names[i]).charAt(0).toUpperCase();
    if (st.online && i === 0) initial = esc(settings.playerName || t('you')).charAt(0).toUpperCase();
    var dealer = st.dealer === i ? '<span class="dealer-dot" title="' + t('dealer') + '">D</span>' : '';
    var nm = nameOf(i) + (i === 2 ? ' <span style="color:var(--muted);font-weight:500">(' + t('partner') + ')</span>' : '');
    if (i === 0) {
      return { cls: isTurn, html: '<div class="avatar">' + initial + dealer + '</div><div class="seat-info"><span class="seat-name">' + nm + '</span><span class="badges">' + badges + '</span>' + (isTurn ? '<span class="seat-sub" style="color:var(--gold)">' + t('yourTurn') + '</span>' : '') + '</div>' };
    }
    return {
      cls: isTurn,
      html: '<div class="avatar">' + initial + dealer + '</div><div class="seat-info"><span class="seat-name">' + nm + think + '</span>' +
        '<span class="seat-sub">' + (offline ? '<span style="color:var(--danger)">offline</span> · ' : '') + t('cards', st.hands[i].length) + '</span><span class="badges">' + badges + '</span></div>' +
        (st.hands[i].length ? '<div class="mini-stack"><i></i><i></i><i></i></div>' : '')
    };
  }

  function renderSeats() {
    for (var i = 0; i < 4; i++) {
      var el = $('#seat' + i), h = seatHTML(i);
      el.className = 'seat seat-' + i + ' team-' + HB.teamOf(i) + (h.cls ? ' turn' : '');
      el.innerHTML = h.html;
    }
  }

  function renderStatus() {
    var turn = '';
    if (st.phase === 'bidding') turn = st.bidTurn === 0 ? t('yourTurn') : t('turnOf', nameOf(st.bidTurn));
    else if (st.phase === 'trump') turn = st.bidder === 0 ? t('chooseColour') : t('choosingColour', nameOf(st.bidder));
    else if (st.phase === 'play') turn = st.turn === 0 ? t('yourTurn') : t('turnOf', nameOf(st.turn));
    var html = lastEvent ? lastEvent + (turn ? ' <b>(' + turn + ')</b>' : '') : (turn ? '<b>' + turn + '</b>' : '');
    $('#status').innerHTML = html;
  }

  // --- hand
  function handGeometry(n) {
    var hand = $('#hand');
    var W = hand.clientWidth || window.innerWidth - 16;
    var landscape = window.innerWidth > window.innerHeight && window.innerHeight < 560;
    var cw, rows, step, rowGap;
    if (landscape) {
      cw = Math.min(70, Math.floor(window.innerHeight * 0.19));
      rows = 1;
    } else {
      cw = Math.max(44, Math.min(80, Math.floor(W / 5.9)));
      rows = n > 7 ? 2 : 1;
    }
    var ch = cw * 1.4;
    rowGap = ch * 0.64;
    var perRow = Math.ceil(n / rows);
    step = perRow > 1 ? Math.min(cw + 5, (W - cw) / (perRow - 1)) : 0;
    return { W: W, cw: cw, ch: ch, rows: rows, perRow: perRow, step: step, rowGap: rowGap, lift: 12 };
  }

  function renderHand(opts) {
    opts = opts || {};
    var hand = $('#hand');
    var cards = st.hands[0] || [];
    var existing = {};
    Array.prototype.forEach.call(hand.children, function (el) { existing[el.dataset.c] = el; });
    var keep = {};
    cards.forEach(function (c) { keep[c] = true; });
    Object.keys(existing).forEach(function (k) { if (!keep[k]) existing[k].remove(); });

    var g = handGeometry(cards.length);
    hand.style.setProperty('--cw', g.cw + 'px');
    hand.style.height = (cards.length ? g.ch + (g.rows - 1) * g.rowGap + g.lift : 0) + 'px';

    var legal = st.phase === 'play' && st.turn === 0 && !busy ? HB.legalCards(st, 0) : null;
    var tableRect = $('#table').getBoundingClientRect(), handRect = hand.getBoundingClientRect();
    var created = 0;
    cards.forEach(function (c, idx) {
      var el = existing[c];
      var isNew = !el;
      if (isNew) { el = cardEl(c); hand.appendChild(el); }
      var row = g.rows === 2 && idx >= g.perRow ? 1 : 0;
      var inRow = row ? idx - g.perRow : idx;
      var count = row ? cards.length - g.perRow : Math.min(g.perRow, cards.length);
      var rowW = g.cw + g.step * (count - 1);
      var x = (g.W - rowW) / 2 + inRow * g.step;
      var y = g.lift + row * g.rowGap;
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.zIndex = idx + 1;
      el.classList.toggle('playable', !!legal && legal.indexOf(c) >= 0);
      el.classList.toggle('dim', !!legal && legal.indexOf(c) < 0);
      el.classList.toggle('hint', hintCard === c);
      if (isNew && opts.deal) {
        var dx = tableRect.left + tableRect.width / 2 - (handRect.left + x + g.cw / 2);
        var dy = tableRect.top + tableRect.height / 2 - (handRect.top + y + g.ch / 2);
        el.animate([
          { transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(' + (created % 2 ? 160 : -160) + 'deg) scale(.4)', opacity: 0 },
          { transform: 'none', opacity: 1 }
        ], { duration: 380 * speed(), delay: created * 45 * speed(), easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' });
        (function (k) { setTimeout(function () { if (k % 2 === 0) FX.play('deal'); }, k * 45 * speed()); })(created);
        created++;
      }
    });
    // keep DOM order in sync (for z-order consistency)
    cards.forEach(function (c) { var el = hand.querySelector('[data-c="' + c + '"]'); if (el) hand.appendChild(el); });
  }

  // --- trick
  function trickGeometry() {
    var tb = $('#table').getBoundingClientRect();
    var tcw = Math.max(40, Math.min(66, tb.height * 0.2, tb.width * 0.16));
    var tch = tcw * 1.4;
    return { tcw: tcw, tch: tch, dx: tcw * 0.95, dy: tch * 0.48 };
  }
  function slot(seat, c) {
    var g = trickGeometry();
    var pos = [[0, g.dy], [-g.dx, 0], [0, -g.dy], [g.dx, 0]][seat];
    var rot = ((c * 37) % 13) - 6;
    return { x: pos[0], y: pos[1], rot: rot, w: g.tcw, h: g.tch };
  }
  function trickOrigin() {
    var tb = $('#table').getBoundingClientRect();
    return { x: tb.left + tb.width / 2, y: tb.top + tb.height * 0.46 };
  }
  function renderTrick(winnerSeat) {
    var tr = $('#trick');
    tr.style.top = '46%';
    tr.innerHTML = '';
    var g = trickGeometry();
    tr.style.setProperty('--tcw', g.tcw + 'px');
    displayTrick.forEach(function (p) {
      var s = slot(p.seat, p.card);
      var el = cardEl(p.card);
      el.style.left = (s.x - s.w / 2) + 'px';
      el.style.top = (s.y - s.h / 2) + 'px';
      el.style.transform = 'rotate(' + s.rot + 'deg)';
      if (winnerSeat === p.seat) el.classList.add('win');
      tr.appendChild(el);
    });
  }

  function seatCenter(seat) {
    var r = $('#seat' + seat).getBoundingClientRect();
    if (seat === 0) { var h = $('#hand').getBoundingClientRect(); return { x: h.left + h.width / 2, y: h.top + h.height / 2 }; }
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function flyCard(seat, c, fromRect) {
    return new Promise(function (resolve) {
      var s = slot(seat, c), o = trickOrigin();
      var el = cardEl(c);
      el.classList.add('fly');
      el.style.setProperty('--w', s.w + 'px');
      var toX = o.x + s.x - s.w / 2, toY = o.y + s.y - s.h / 2;
      var from;
      if (fromRect) {
        var sc = fromRect.width / s.w;
        from = 'translate(' + (fromRect.left + (fromRect.width - s.w) / 2) + 'px,' + (fromRect.top + (fromRect.height - s.h) / 2) + 'px) scale(' + sc + ')';
      } else {
        var sp = seatCenter(seat);
        from = 'translate(' + (sp.x - s.w / 2) + 'px,' + (sp.y - s.h / 2) + 'px) scale(.45) rotate(' + (seat === 1 ? -90 : seat === 3 ? 90 : 180) + 'deg)';
      }
      document.body.appendChild(el);
      var a = el.animate([
        { transform: from, opacity: fromRect ? 1 : 0.2 },
        { transform: 'translate(' + toX + 'px,' + toY + 'px) rotate(' + s.rot + 'deg)', opacity: 1 }
      ], { duration: 300 * speed(), easing: 'cubic-bezier(.25,.8,.3,1)', fill: 'forwards' });
      FX.play('card');
      a.onfinish = function () {
        displayTrick.push({ seat: seat, card: c });
        renderTrick();
        el.remove();
        resolve();
      };
    });
  }

  function collectTrick(winner, id) {
    renderTrick(winner);
    return wait(750).then(function () {
      if (!alive(id)) return;
      var to = seatCenter(winner), o = trickOrigin();
      var els = Array.prototype.slice.call($('#trick').children);
      var anims = els.map(function (el) {
        var r = el.getBoundingClientRect();
        var dx = to.x - (r.left + r.width / 2), dy = to.y - (r.top + r.height / 2);
        return el.animate([
          { transform: el.style.transform, opacity: 1 },
          { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.35)', opacity: 0 }
        ], { duration: 380 * speed(), easing: 'cubic-bezier(.5,0,.7,.4)', fill: 'forwards' }).finished;
      });
      FX.play(HB.teamOf(winner) === 0 ? 'trickUs' : 'trickThem');
      if (HB.teamOf(winner) === 0) FX.buzz('light');
      return Promise.all(anims).catch(function () {}).then(function () {
        displayTrick = [];
        renderTrick();
      });
    });
  }

  function bubble(seat, text, isPass) {
    var b = document.createElement('div');
    b.className = 'bubble' + (isPass ? ' pass' : '');
    b.textContent = text;
    document.body.appendChild(b);
    var r = $('#seat' + seat).getBoundingClientRect();
    var bw = b.offsetWidth, bh = b.offsetHeight;
    var x, y;
    if (seat === 0) { x = r.right + 8; y = r.top + (r.height - bh) / 2; }
    else if (seat === 1) { x = r.left + 4; y = r.bottom + 6; }
    else if (seat === 3) { x = r.right - bw - 4; y = r.bottom + 6; }
    else { x = r.left + (r.width - bw) / 2; y = r.bottom + 6; }
    b.style.left = Math.max(6, Math.min(window.innerWidth - bw - 6, x)) + 'px';
    b.style.top = y + 'px';
    setTimeout(function () { b.style.transition = 'opacity .3s'; b.style.opacity = 0; setTimeout(function () { b.remove(); }, 320); }, 1300 * speed());
  }

  // ------------------------------------------------------------ toast + modal + sheet
  var toastTimer;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  var modalState = { dismissable: true, onClose: null };
  function openModal(html, opts) {
    opts = opts || {};
    modalState = { dismissable: opts.dismissable !== false, onClose: opts.onClose || null };
    $('#modal').innerHTML = html;
    $('#modal').scrollTop = 0;
    $('#modalWrap').classList.add('open');
  }
  function closeModal(force) {
    if (!$('#modalWrap').classList.contains('open')) return false;
    if (!modalState.dismissable && !force) return true;
    $('#modalWrap').classList.remove('open');
    var cb = modalState.onClose; modalState.onClose = null;
    if (cb) cb();
    return true;
  }
  $('#modalWrap').addEventListener('click', function (e) { if (e.target.id === 'modalWrap') closeModal(); });

  function openSheet(html) { var s = $('#sheet'); s.innerHTML = html; s.classList.add('open'); }
  function closeSheet() { $('#sheet').classList.remove('open'); }

  // ------------------------------------------------------------ game loop
  function newGame() {
    runId++;
    busy = false;
    closeSheet();
    closeModal(true);
    st = HB.newMatch({ target: settings.target, quickFinish: settings.quick });
    displayTrick = [];
    lastEvent = '';
    $('#hand').innerHTML = '';
    show('game');
    renderAll();
    loop(runId);
  }

  function resumeGame() {
    runId++;
    if (!st || st.online) st = load('hb_save', null);
    busy = false;
    closeSheet();
    st.quickFinish = settings.quick;
    displayTrick = st.trick ? st.trick.slice() : [];
    lastEvent = '';
    $('#hand').innerHTML = '';
    show('game');
    renderAll();
    loop(runId);
  }

  function goHome() {
    runId++;
    busy = false;
    closeSheet();
    closeModal(true);
    saveGame();
    show('home');
  }

  async function loop(id) {
    if (st && st.online) return;
    while (alive(id)) {
      saveGame();
      renderSeats(); renderStatus(); renderRoundbar();
      switch (st.phase) {
        case 'idle': {
          HB.startRound(st);
          displayTrick = [];
          hintCard = null;
          lastEvent = t('biddingStart', nameOf(st.bidTurn));
          renderAll();
          renderHand({ deal: true });
          await wait(13 * 45 + 450);
          continue;
        }
        case 'bidding': {
          if (st.bidTurn === 0) { showBidSheet(); return; }
          await wait(550 + Math.random() * 450);
          if (!alive(id)) return;
          var seat = st.bidTurn, b = HB.AI.bid(st, seat);
          HB.applyBid(st, seat, b);
          announceBid(seat, b);
          await wait(650);
          continue;
        }
        case 'trump': {
          lastEvent = t('highest', nameOf(st.bidder), st.highBid);
          renderStatus(); renderSeats();
          if (st.bidder === 0) { showTrumpSheet(); return; }
          await wait(900);
          if (!alive(id)) return;
          chooseTrump(HB.AI.trump(st, st.bidder));
          await wait(700);
          continue;
        }
        case 'play': {
          renderHand();
          if (st.turn === 0) { renderStatus(); return; }
          await wait(420 + Math.random() * 380);
          if (!alive(id)) return;
          var s2 = st.turn, c = HB.AI.play(st, s2);
          busy = true; // block taps until this card has landed
          var res = HB.applyPlay(st, s2, c);
          renderSeats(); renderStatus();
          await flyCard(s2, c, null);
          if (!alive(id)) return;
          if (res.trickDone) await afterTrick(res, id);
          busy = false;
          continue;
        }
        case 'roundEnd': {
          endRound();
          return;
        }
        case 'roundOver': {
          showRoundResult(st.lastResult);
          return;
        }
        case 'matchOver': {
          showMatchOver();
          return;
        }
        default: return;
      }
    }
  }

  async function afterTrick(res, id) {
    lastEvent = t('wonTrick', nameOf(res.winner));
    await collectTrick(res.winner, id);
    if (!alive(id)) return;
    renderSeats(); renderRoundbar(); renderStatus();
  }

  function announceBid(seat, b) {
    if (b === 'pass') { lastEvent = t('saidPass', nameOf(seat)); bubble(seat, t('pass'), true); FX.play('pass'); }
    else { lastEvent = t('saidBid', nameOf(seat), b); bubble(seat, t('hath', b), false); FX.play('bid'); }
    renderSeats(); renderStatus();
  }

  function chooseTrump(suit) {
    HB.applyTrump(st, suit);
    lastEvent = t('trumpChosen', suitChip(suit) + ' ' + suitName(suit), nameOf(st.bidder));
    FX.play('bid');
    renderAll();
  }

  // --- human bidding
  function handSummaryHTML() {
    return '<div class="mini-hand">' + HB.sortHand(st.hands[0], null).map(function (c) { return miniCard(c); }).join('') + '</div>';
  }

  function showBidSheet(withHint) {
    var mb = HB.minBid(st), canPass = HB.canPass(st, 0);
    var html = '<h2>' + t('bidTitle') + '</h2>';
    html += '<p class="sub">' + (canPass ? t('bidSub', st.highBid, st.bidder !== null ? nameOf(st.bidder) : '') : t('mustBid')) + '</p>';
    html += handSummaryHTML();
    if (withHint) {
      var sg = HB.AI.suggestBid(st, 0);
      html += '<p class="hint-line">' + t('hintBid', sg.team.toFixed(1), suitChip(sg.suit)) + ' · ' + t('hintSays', sg.bid === 'pass' ? t('pass') : t('hath', sg.bid)) + '</p>';
    }
    html += '<div class="bid-grid">';
    for (var b = HB.MIN_BID; b <= HB.MAX_BID; b++) {
      html += '<button class="btn gold" data-bid="' + b + '"' + (b < mb ? ' disabled' : '') + '>' + b + '</button>';
    }
    html += '</div><div class="sheet-actions">';
    html += '<button class="btn ghost" data-bid="pass"' + (canPass ? '' : ' disabled') + '>' + t('pass') + '</button>';
    if (settings.hints && !withHint) html += '<button class="btn ghost" data-act="hint">' + t('hint') + '</button>';
    html += '</div>';
    openSheet(html);
  }

  $('#sheet').addEventListener('click', function (e) {
    var btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    if (btn.dataset.act === 'hint') { FX.play('click'); showBidSheet(true); return; }
    if (btn.dataset.bid) {
      if (st.phase !== 'bidding' || st.bidTurn !== 0) return;
      var b = btn.dataset.bid === 'pass' ? 'pass' : parseInt(btn.dataset.bid, 10);
      FX.buzz('light');
      closeSheet();
      if (st.online) { Net.send({ t: 'bid', bid: b }); return; }
      HB.applyBid(st, 0, b);
      announceBid(0, b);
      var id = runId;
      setTimeout(function () { loop(id); }, 650 * speed());
      return;
    }
    if (btn.dataset.suit) {
      if (st.phase !== 'trump' || st.bidder !== 0) return;
      FX.buzz('light');
      closeSheet();
      if (st.online) { Net.send({ t: 'trump', suit: parseInt(btn.dataset.suit, 10) }); return; }
      chooseTrump(parseInt(btn.dataset.suit, 10));
      var id2 = runId;
      setTimeout(function () { loop(id2); }, 700 * speed());
    }
  });

  function showTrumpSheet() {
    var rec = HB.AI.trump(st, 0);
    var counts = [0, 0, 0, 0];
    st.hands[0].forEach(function (c) { counts[HB.suitOf(c)]++; });
    var html = '<h2>' + t('trumpTitle') + '</h2><p class="sub">' + t('trumpSub', st.highBid) + '</p>' + handSummaryHTML() + '<div class="trump-grid">';
    for (var s = 0; s < 4; s++) {
      html += '<button class="trump-btn' + (settings.hints && s === rec ? ' rec' : '') + '" data-suit="' + s + '">' +
        '<svg viewBox="0 0 100 100" class="' + (isRed(s) ? 'red' : 'blk') + '"><use href="#suit-' + s + '"/></svg>' +
        '<span class="tn">' + suitName(s) + '</span><span class="tc">' + t('cards', counts[s]) + '</span></button>';
    }
    html += '</div>';
    openSheet(html);
  }

  // --- human card play
  $('#hand').addEventListener('click', function (e) {
    var el = e.target.closest('.card');
    if (!el) return;
    if (busy || st.phase !== 'play' || st.turn !== 0) return;
    var c = parseInt(el.dataset.c, 10);
    var legal = HB.legalCards(st, 0);
    if (legal.indexOf(c) < 0) {
      FX.play('error'); FX.buzz('error');
      el.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 220 });
      toast(t('tapToPlay'));
      return;
    }
    playHuman(c, el);
  });

  async function playHuman(c, el) {
    busy = true;
    hintCard = null;
    if (st.online) {
      el.classList.add('pressed');
      Net.send({ t: 'play', card: c });
      setTimeout(function () { if (busy && st.online && st.turn === 0) busy = false; }, 4000); // safety
      return;
    }
    var id = runId;
    var rect = el.getBoundingClientRect();
    FX.buzz('light');
    var res = HB.applyPlay(st, 0, c);
    renderHand();
    renderSeats(); renderStatus();
    await flyCard(0, c, rect);
    if (!alive(id)) return;
    if (res.trickDone) await afterTrick(res, id);
    busy = false;
    if (alive(id)) loop(id);
  }

  // --- hints
  $('#btnHint').addEventListener('click', function () {
    FX.play('click');
    if (!st) return;
    if (st.phase === 'bidding' && st.bidTurn === 0) { showBidSheet(true); return; }
    if (st.phase === 'play' && st.turn === 0 && !busy) {
      hintCard = HB.AI.suggestPlay(st, 0);
      renderHand();
      setTimeout(function () { hintCard = null; if (st.phase === 'play') renderHand(); }, 2600);
      return;
    }
    toast(st.phase === 'play' || st.phase === 'bidding' ? t('turnOf', nameOf(st.phase === 'play' ? st.turn : st.bidTurn)) : t('howTo'));
  });

  // --- round end / results
  function recordStats(r) {
    stats.rounds++;
    if (r.bidder === 0) {
      if (r.made) { stats.bidsMade++; stats.bestBid = Math.max(stats.bestBid, r.bid); }
      else stats.bidsFailed++;
    }
    if (st.phase === 'matchOver') {
      stats.matches++;
      if (st.winner === 0) { stats.won++; stats.streak++; stats.bestStreak = Math.max(stats.bestStreak, stats.streak); }
      else { stats.lost++; stats.streak = 0; }
    }
    saveStats();
  }

  function endRound() {
    var r = HB.finishRound(st);
    recordStats(r);
    saveGame();
    var good = (r.bidTeam === 0) === r.made;
    FX.play(good ? 'made' : 'failed');
    FX.buzz(good ? 'success' : 'error');
    lastEvent = r.made ? t('bidMade') : t('bidFailed');
    renderScores(r.delta.map(function (d) { return d !== 0; }));
    renderSeats(); renderStatus(); renderRoundbar();
    var id = runId;
    setTimeout(function () { if (alive(id)) showRoundResult(r); }, 700);
  }

  function resultHTML(r) {
    var good = (r.bidTeam === 0) === r.made;
    var d = r.delta[r.bidTeam];
    var html = '<div class="res-hero"><div class="line">' + t('roundResult') + ' · ' + t('roundN', r.round) + '</div>' +
      '<h2>' + (r.made ? t('bidMade') : t('bidFailed')) + '</h2>' +
      '<div class="big ' + (good ? 'pos' : 'neg') + '">' + (d > 0 ? '+' : '') + d + '</div>' +
      '<div class="line">' + t('resultLine', teamLabel(r.bidTeam), r.teamTricks[r.bidTeam], r.bid) + ' ' + t('trumpLabel') + ' ' + suitChip(r.trump) + '</div>' +
      (r.early ? '<div class="line" style="margin-top:4px">' + t('earlyEnd') + '</div>' : '') + '</div>';
    html += '<table class="t"><tr><th>' + t('thTeam') + '</th><th class="n">' + t('thBid') + '</th><th class="n">' + t('thTricks') + '</th><th class="n">' + t('thResult') + '</th><th class="n">' + t('thTotal') + '</th></tr>';
    [0, 1].forEach(function (tm) {
      var dd = r.delta[tm];
      html += '<tr><td style="color:' + (tm === 0 ? 'var(--us)' : 'var(--them)') + '">' + teamNames(tm) + '</td><td class="n">' + (tm === r.bidTeam ? r.bid : '–') + '</td><td class="n">' + r.teamTricks[tm] +
        '</td><td class="n ' + (dd > 0 ? 'pos' : dd < 0 ? 'neg' : '') + '">' + (dd > 0 ? '+' : '') + dd + '</td><td class="n"><b>' + r.scores[tm] + '</b></td></tr>';
    });
    html += '</table>';
    html += '<table class="t" style="margin-top:12px"><tr><th>' + t('thPlayer') + '</th><th>' + t('thSaid') + '</th><th class="n">' + t('thTricks') + '</th></tr>';
    r.bids.forEach(function (b) {
      html += '<tr><td>' + nameOf(b.seat) + (b.seat === r.bidder ? ' ★' : '') + '</td><td>' + (b.bid === 'pass' ? t('pass') : t('hath', b.bid)) + '</td><td class="n">' + r.tricksWon[b.seat] + '</td></tr>';
    });
    html += '</table>';
    html += '<details><summary>' + t('trickHistory') + '</summary>';
    r.history.forEach(function (h, i) {
      html += '<div class="hist-row"><span class="hn">' + (i + 1) + '</span><span class="hc">' +
        h.cards.map(function (p) { return '<span title="' + nameOf(p.seat) + '">' + miniCard(p.card, p.seat === h.winner ? 'w' : '') + '</span>'; }).join('') +
        '</span><span class="hw">' + nameOf(h.winner) + '</span></div>';
    });
    html += '</details>';
    return html;
  }

  function showRoundResult(r) {
    if (!r) { st.phase = 'idle'; loop(runId); return; }
    var over = st.phase === 'matchOver';
    var html = resultHTML(r) + '<div class="actions"><button class="btn gold" id="btnNextRound">' + (over ? t('finalScore') : t('nextRound')) + '</button></div>';
    openModal(html, { dismissable: false });
    $('#btnNextRound').onclick = function () {
      FX.play('click');
      if (st.online && !over) {
        Net.send({ t: 'ready' });
        this.disabled = true;
        this.textContent = t('waitingOthers');
        return;
      }
      closeModal(true);
      if (over) { showMatchOver(); return; }
      st.phase = 'idle';
      lastEvent = '';
      loop(runId);
    };
  }

  function showMatchOver() {
    var won = st.winner === 0;
    if (won) { FX.play('win'); FX.confetti(); } else FX.play('failed');
    var html = '<div class="res-hero"><h2>' + (won ? t('matchWon') : t('matchLost')) + '</h2>' +
      '<div class="big ' + (won ? 'pos' : 'neg') + '">' + st.scores[0] + ' : ' + st.scores[1] + '</div><div class="line">' + t('finalScore') + ' · ' + t('firstTo', st.target) + '</div></div>';
    html += '<table class="t"><tr><th>#</th><th>' + t('thBid') + '</th><th>' + t('trumpLabel') + '</th><th class="n">' + teamLabel(0) + '</th><th class="n">' + teamLabel(1) + '</th></tr>';
    st.roundLog.forEach(function (l) {
      html += '<tr><td>' + l.round + '</td><td>' + l.bid + ' · ' + nameOf(l.bidder) + '</td><td>' + suitChip(l.trump) + '</td><td class="n">' + l.scores[0] + '</td><td class="n">' + l.scores[1] + '</td></tr>';
    });
    html += '</table><div class="actions"><button class="btn ghost" id="btnMHome">' + t('home') + '</button><button class="btn gold" id="btnMAgain">' + t('playAgain') + '</button></div>';
    openModal(html, { dismissable: false });
    if (st.online) {
      $('#btnMAgain').onclick = function () { Net.send({ t: 'rematch' }); this.disabled = true; };
      $('#btnMHome').onclick = function () { Net.leave(); };
      return;
    }
    $('#btnMAgain').onclick = function () { drop('hb_save'); newGame(); };
    $('#btnMHome').onclick = function () { closeModal(true); drop('hb_save'); st = null; runId++; show('home'); };
  }

  // ------------------------------------------------------------ menus / settings / stats / rules
  function showRules() {
    openModal('<h2>' + t('howTo') + '</h2>' + t('rulesHtml') + '<div class="actions"><button class="btn gold" data-close>' + t('close') + '</button></div>');
  }

  function seg(name, opts, cur) {
    return '<div class="seg" data-set="' + name + '">' + opts.map(function (o) {
      return '<button data-v="' + o[0] + '" class="' + (String(cur) === String(o[0]) ? 'on' : '') + '">' + o[1] + '</button>';
    }).join('') + '</div>';
  }
  function toggle(name, on) { return '<button class="toggle' + (on ? ' on' : '') + '" data-toggle="' + name + '" aria-pressed="' + on + '"></button>'; }

  function showSettings() {
    var html = '<h2>' + t('settings') + '</h2>' +
      '<div class="set-row"><div class="sl">' + t('language') + '</div>' + seg('lang', [['hi', 'Hinglish'], ['en', 'English']], settings.lang) + '</div>' +
      '<div class="set-row"><div><div class="sl">' + t('target') + '</div><div class="sd">' + (st && st.phase !== 'matchOver' ? (settings.lang === 'en' ? 'Applies to the next new game' : 'Agle naye game se lagu') : '') + '</div></div>' + seg('target', [[21, '21'], [30, '30'], [50, '50']], settings.target) + '</div>' +
      '<div class="set-row"><div class="sl">' + t('speed') + '</div>' + seg('speed', [['slow', t('slow')], ['normal', t('normal')], ['fast', t('fast')]], settings.speed) + '</div>' +
      '<div class="set-row"><div class="sl">' + t('sound') + '</div>' + toggle('sound', settings.sound) + '</div>' +
      '<div class="set-row"><div class="sl">' + t('vibration') + '</div>' + toggle('vibe', settings.vibe) + '</div>' +
      '<div class="set-row"><div><div class="sl">' + t('quickFinish') + '</div><div class="sd">' + t('quickFinishDesc') + '</div></div>' + toggle('quick', settings.quick) + '</div>' +
      '<div class="set-row"><div><div class="sl">' + t('hints') + '</div><div class="sd">' + t('hintsDesc') + '</div></div>' + toggle('hints', settings.hints) + '</div>' +
      '<div class="actions"><button class="btn gold" data-close>' + t('close') + '</button></div>';
    openModal(html);
  }

  function showStats() {
    var pct = stats.matches ? Math.round(stats.won / stats.matches * 100) + '%' : '–';
    var items = [['stMatches', stats.matches], ['stWinPct', pct], ['stWon', stats.won], ['stLost', stats.lost], ['stRounds', stats.rounds],
      ['stBestBid', stats.bestBid || '–'], ['stBidsMade', stats.bidsMade], ['stBidsFailed', stats.bidsFailed], ['stStreak', stats.streak], ['stBestStreak', stats.bestStreak]];
    var html = '<h2>' + t('stats') + '</h2><div class="stat-grid">' + items.map(function (i) { return '<div class="stat"><b>' + i[1] + '</b><span>' + t(i[0]) + '</span></div>'; }).join('') + '</div>' +
      '<div class="actions"><button class="btn ghost" id="btnReset">' + t('resetStats') + '</button><button class="btn gold" data-close>' + t('close') + '</button></div>';
    openModal(html);
    $('#btnReset').onclick = function () {
      confirmBox(t('resetConfirm'), function () { stats = Object.assign({}, DEF_STATS); saveStats(); showStats(); }, showStats);
    };
  }

  function confirmBox(msg, yes, no) {
    openModal('<p style="font-size:16px;margin:4px 0 0">' + msg + '</p><div class="actions"><button class="btn ghost" id="cNo">' + t('no') + '</button><button class="btn gold" id="cYes">' + t('yes') + '</button></div>');
    $('#cYes').onclick = function () { closeModal(true); yes && yes(); };
    $('#cNo').onclick = function () { closeModal(true); no && no(); };
  }

  function showMenu() {
    var html = '<h2>' + t('menu') + '</h2><div class="menu-list">' +
      '<button class="btn gold" data-close>' + t('resume') + '</button>' +
      '<button class="btn ghost" id="mRules">' + t('howTo') + '</button>' +
      '<button class="btn ghost" id="mSettings">' + t('settings') + '</button>' +
      '<button class="btn ghost" id="mNew">' + t('newGame') + '</button>' +
      '<button class="btn ghost" id="mHome">' + t('home') + '</button></div>';
    openModal(html);
    $('#mRules').onclick = showRules;
    $('#mSettings').onclick = showSettings;
    if (st && st.online) {
      $('#mNew').style.display = 'none';
      $('#mHome').textContent = t('leaveRoom');
      $('#mHome').onclick = function () { confirmBox(t('leaveConfirm'), function () { Net.leave(); }, null); };
      return;
    }
    $('#mNew').onclick = function () { confirmBox(t('confirmNew'), newGame, null); };
    $('#mHome').onclick = goHome;
  }

  $('#modal').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-close')) { FX.play('click'); closeModal(true); return; }
    var sg = b.closest('.seg');
    if (sg && sg.dataset.set) {
      var k = sg.dataset.set, v = b.dataset.v;
      settings[k] = k === 'target' ? parseInt(v, 10) : v;
      saveSettings();
      sg.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
      FX.play('click');
        if (k === 'lang') { applyLang(); showSettings(); }
      if (k === 'target' && st && st.round === 0) { st.target = settings.target; }
      return;
    }
    if (b.dataset.toggle) {
      var key = b.dataset.toggle;
      settings[key] = !settings[key];
      b.classList.toggle('on', settings[key]);
      saveSettings();
      applyFxSettings();
      if (key === 'quick' && st) st.quickFinish = settings.quick;
      if (key === 'hints' && st) $('#btnHint').classList.toggle('hidden', !settings.hints);
      FX.play('click');
    }
  });

  function applyFxSettings() { FX.setSound(settings.sound); FX.setVibe(settings.vibe); }

  // ------------------------------------------------------------ home buttons
  $('#btnNew').onclick = function () {
    FX.play('click');
    if (st && st.phase !== 'matchOver' && st.round > 0) confirmBox(t('confirmNew'), newGame, null);
    else newGame();
  };
  $('#btnContinue').onclick = function () { FX.play('click'); resumeGame(); toast(t('resumed')); };
  $('#btnHow').onclick = function () { FX.play('click'); showRules(); };
  $('#btnSettings').onclick = function () { FX.play('click'); showSettings(); };
  $('#btnStats').onclick = function () { FX.play('click'); showStats(); };
  $('#btnMenu').onclick = function () { FX.play('click'); showMenu(); };
  document.querySelectorAll('#homeLang button').forEach(function (b) {
    b.onclick = function () { settings.lang = b.dataset.lang; saveSettings(); applyLang(); FX.play('click'); };
  });

  // logo fan
  (function () {
    var fan = document.querySelectorAll('.lf');
    [[0, 'A'], [1, 'K'], [3, 'Q'], [2, 'J']].forEach(function (p, i) {
      fan[i].innerHTML = '<svg viewBox="0 0 100 100" class="' + (isRed(p[0]) ? 'red' : 'blk') + '"><use href="#suit-' + p[0] + '"/></svg>';
      fan[i].style.color = isRed(p[0]) ? 'var(--red)' : 'var(--black)';
      fan[i].insertAdjacentHTML('afterbegin', '<span style="position:absolute;left:8px;top:6px;font-weight:800;font-size:18px">' + p[1] + '</span>');
    });
  })();

  // ------------------------------------------------------------ platform glue
  var resizeT;
  window.addEventListener('resize', function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(function () { if (st && $('#game').classList.contains('active')) { renderHand(); renderTrick(); } }, 120);
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden) saveGame(); });

  var lastBack = 0;
  function onBack() {
    if (closeModal()) return;
    if ($('#game').classList.contains('active')) {
      if (st && st.online) { showMenu(); return; }
      goHome(); return;
    }
    var now = Date.now();
    if (now - lastBack < 1800) {
      var App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
      if (App) App.exitApp();
    } else { lastBack = now; toast(t('pressBackAgain')); }
  }
  try {
    var Cap = window.Capacitor;
    if (Cap && Cap.isNativePlatform && Cap.isNativePlatform()) {
      document.body.classList.add('native');
      var P = Cap.Plugins || {};
      if (P.App) P.App.addListener('backButton', onBack);
      if (P.App) P.App.addListener('pause', saveGame);
      if (P.StatusBar) { P.StatusBar.setStyle({ style: 'DARK' }).catch(function () {}); P.StatusBar.setBackgroundColor && P.StatusBar.setBackgroundColor({ color: '#0b1d14' }).catch(function () {}); }
      if (P.SplashScreen) setTimeout(function () { P.SplashScreen.hide().catch(function () {}); }, 200);
    }
  } catch (e) { /* not native */ }

  // ================================================================ ONLINE MULTIPLAYER
  function isNative() { return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); }
  function serverBase() {
    var c = window.HB_CONFIG && window.HB_CONFIG.serverUrl;
    if (c) return String(c).replace(/\/+$/, '');
    if (!isNative() && /^https?:$/.test(location.protocol)) return location.origin;
    return '';
  }
  function playerId() {
    var p = load('hb_pid', null);
    if (!p) { p = 'p' + Math.random().toString(36).slice(2) + Date.now().toString(36); store('hb_pid', p); }
    return p;
  }

  var Net = {
    ws: null, code: null, wanted: false, retry: 0, pingT: null, lastLobby: null, pending: null,
    connect: function (first) {
      var base = serverBase();
      if (!base) { toast(t('needServer')); return false; }
      Net.wanted = true;
      try { Net.ws = new WebSocket(base.replace(/^http/, 'ws') + '/ws'); } catch (e) { toast(t('connFail')); return false; }
      var ws = Net.ws;
      ws.onopen = function () {
        Net.retry = 0;
        if (first) { ws.send(JSON.stringify(first)); first = null; }
        else if (Net.code) ws.send(JSON.stringify({ t: 'join', code: Net.code, pid: playerId(), name: settings.playerName }));
        clearInterval(Net.pingT);
        Net.pingT = setInterval(function () { Net.send({ t: 'ping' }); }, 25000);
      };
      ws.onmessage = function (e) { var m; try { m = JSON.parse(e.data); } catch (x) { return; } onNetMessage(m); };
      ws.onclose = function () {
        clearInterval(Net.pingT);
        if (ws !== Net.ws || !Net.wanted) return;
        if (Net.retry === 0 && Net.code) toast(t('connLost'));
        if (!Net.code && Net.retry >= 1) { Net.wanted = false; toast(t('connFail')); return; }
        var delay = Math.min(8000, 600 * Math.pow(1.7, Net.retry++));
        setTimeout(function () { if (Net.wanted && ws === Net.ws) Net.connect(); }, delay);
      };
      return true;
    },
    send: function (m) { if (Net.ws && Net.ws.readyState === 1) Net.ws.send(JSON.stringify(m)); },
    leave: function () {
      Net.send({ t: 'leave' });
      Net.wanted = false;
      try { Net.ws && Net.ws.close(); } catch (e) { /* ignore */ }
      Net.ws = null; Net.code = null; Net.lastLobby = null;
      drop('hb_room');
      evQueue.length = 0;
      runId++; busy = false;
      st = load('hb_save', null);
      closeSheet(); closeModal(true);
      show('home');
    }
  };

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && Net.wanted && Net.code && (!Net.ws || Net.ws.readyState > 1)) { Net.retry = 0; Net.connect(); }
  });

  function onNetMessage(m) {
    switch (m.t) {
      case 'joined':
        Net.code = m.code;
        store('hb_room', { code: m.code, at: Date.now() });
        break;
      case 'lobby':
        Net.lastLobby = m;
        if (!m.started) { if (!$('#game').classList.contains('active') || !st || !st.online) showLobby(m); }
        break;
      case 'ev':
        evQueue.push(m);
        if (!evRunning) pumpEvents();
        break;
      case 'emote':
        bubble(m.seat, m.e, false);
        FX.play('click');
        break;
      case 'error':
        busy = false;
        if (m.code === 'no_room') { toast(t('errNoRoom')); drop('hb_room'); if (!st || !st.online) { Net.wanted = false; Net.code = null; } }
        else if (m.code === 'full') { toast(t('errFull')); Net.wanted = false; Net.code = null; }
        else if (m.msg) toast(m.msg);
        break;
    }
  }

  var evQueue = [], evRunning = false;
  async function pumpEvents() {
    evRunning = true;
    while (evQueue.length) {
      var m = evQueue.shift();
      try { await handleEvent(m.ev || {}, m.view); } catch (e) { console.error(e); }
    }
    evRunning = false;
  }

  function enterOnlineGame(view) {
    if (!$('#game').classList.contains('active') || !st || !st.online) {
      runId++;
      closeModal(true);
      closeSheet();
      $('#hand').innerHTML = '';
      st = view;
      displayTrick = view.trick.slice();
      lastEvent = '';
      show('game');
      renderAll();
      return true;
    }
    return false;
  }

  async function handleEvent(ev, view) {
    if (!view) return;
    var fresh = enterOnlineGame(view);
    var id = runId;
    switch (fresh ? 'sync' : ev.kind) {
      case 'deal':
        closeModal(true); closeSheet();
        st = view; displayTrick = []; hintCard = null; busy = false;
        lastEvent = t('biddingStart', nameOf(st.bidTurn));
        $('#hand').innerHTML = '';
        renderAll();
        renderHand({ deal: true });
        await wait(13 * 45 + 450);
        break;
      case 'bid':
        st = view;
        announceBid(ev.seat, ev.bid);
        await wait(350);
        break;
      case 'trump':
        st = view;
        lastEvent = t('trumpChosen', suitChip(ev.suit) + ' ' + suitName(ev.suit), nameOf(st.bidder));
        FX.play('bid');
        closeSheet();
        renderAll();
        await wait(300);
        break;
      case 'play': {
        var rect = null;
        if (ev.seat === 0) { var el = $('#hand [data-c="' + ev.card + '"]'); if (el) rect = el.getBoundingClientRect(); }
        st = view;
        hintCard = null;
        renderHand(); renderSeats(); renderStatus();
        await flyCard(ev.seat, ev.card, rect);
        if (!alive(id)) return;
        if (ev.trickDone) await afterTrick({ winner: ev.winner }, id);
        if (ev.seat === 0) busy = false;
        break;
      }
      case 'roundEnd': {
        st = view;
        var r = st.lastResult;
        recordStats(r);
        var good = (r.bidTeam === 0) === r.made;
        FX.play(good ? 'made' : 'failed'); FX.buzz(good ? 'success' : 'error');
        lastEvent = r.made ? t('bidMade') : t('bidFailed');
        renderScores(r.delta.map(function (d) { return d !== 0; }));
        renderSeats(); renderStatus(); renderRoundbar();
        await wait(600);
        showRoundResult(r);
        break;
      }
      case 'ready': {
        st = view;
        var b = $('#btnNextRound');
        if (b && b.disabled) {
          var humans = st.bots.filter(function (x) { return !x; }).length;
          var rd = st.ready.filter(function (x, i) { return x && !st.bots[i]; }).length;
          b.textContent = t('waitingOthers') + ' ' + t('readyCount', rd, humans);
        }
        break;
      }
      default: // sync / presence
        st = view;
        if (ev.kind !== 'presence' || !displayTrick.length) displayTrick = view.trick.slice();
        renderAll();
        busy = false;
    }
    onlineTurnCheck();
  }

  function onlineTurnCheck() {
    if (!st || !st.online) return;
    var sheetOpen = $('#sheet').classList.contains('open');
    if (st.phase === 'bidding' && st.bidTurn === 0) { if (!sheetOpen) showBidSheet(); FX.buzz('light'); }
    else if (st.phase === 'trump' && st.bidder === 0) { if (!sheetOpen) showTrumpSheet(); }
    else closeSheet();
    if (st.phase === 'play') renderHand();
    var modalOpen = $('#modalWrap').classList.contains('open');
    if (st.phase === 'roundOver' && !modalOpen && st.lastResult) showRoundResult(st.lastResult);
    if (st.phase === 'matchOver' && !modalOpen) showMatchOver();
  }

  // --- entry dialog
  function showOnlineEntry(prefillCode) {
    var base = serverBase();
    var last = load('hb_room', null);
    var recent = last && Date.now() - last.at < 3 * 3600 * 1000 ? last.code : null;
    var html = '<h2>' + t('playFriends') + '</h2><p style="color:var(--muted);margin-top:0">' + t('playFriendsSub') + '</p>' +
      (base ? '' : '<p style="color:var(--danger)">' + t('needServer') + '</p>') +
      '<label class="fld"><span>' + t('yourName') + '</span><input id="oName" maxlength="16" autocomplete="nickname" value="' + esc(settings.playerName || '').replace(/"/g, '') + '"></label>' +
      '<button class="btn gold big" id="oCreate" style="width:100%;margin-top:12px">' + t('createRoom') + '</button>' +
      '<div class="or"><span>' + t('orJoin') + '</span></div>' +
      '<div class="join-row"><input id="oCode" class="code-input" maxlength="5" placeholder="ABCDE" autocapitalize="characters" autocomplete="off" spellcheck="false" value="' + (prefillCode || '') + '">' +
      '<button class="btn gold" id="oJoin">' + t('joinRoom') + '</button></div>' +
      (recent ? '<button class="btn ghost" id="oRejoin" style="width:100%;margin-top:10px">' + t('rejoin', recent) + '</button>' : '') +
      '<div class="actions"><button class="btn ghost" data-close>' + t('close') + '</button></div>';
    openModal(html);
    var nameOk = function () {
      var n = $('#oName').value.trim();
      if (!n) { toast(t('errName')); $('#oName').focus(); return null; }
      settings.playerName = n.slice(0, 16); saveSettings();
      return settings.playerName;
    };
    $('#oCode').addEventListener('input', function () { this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
    $('#oCreate').onclick = function () {
      var n = nameOk(); if (!n) return;
      FX.play('click');
      Net.code = null;
      if (Net.connect({ t: 'create', pid: playerId(), name: n, target: settings.target })) toast(t('connecting'));
    };
    var join = function (code) {
      var n = nameOk(); if (!n) return;
      if (!code || code.length !== 5) { toast(t('errCode')); return; }
      FX.play('click');
      Net.code = code;
      if (Net.connect({ t: 'join', code: code, pid: playerId(), name: n })) toast(t('connecting'));
    };
    $('#oJoin').onclick = function () { join($('#oCode').value.trim()); };
    if ($('#oRejoin')) $('#oRejoin').onclick = function () { join(recent); };
  }

  function inviteLink(code) { var b = serverBase(); return b ? b + '/?join=' + code : ''; }

  function shareWhatsApp(code) { waOpen(t('invite', code, inviteLink(code))); }
  function copyText(txt) {
    var done = function () { toast(t('copied')); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, fallback); else fallback();
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { /* ignore */ }
      ta.remove();
    }
  }
  function nativeShare(code) {
    var text = t('invite', code, inviteLink(code));
    var P = window.Capacitor && window.Capacitor.Plugins;
    if (isNative() && P && P.Share) { P.Share.share({ title: 'Hath Bolo', text: text, dialogTitle: 'Hath Bolo' }).catch(function () {}); return; }
    if (navigator.share) { navigator.share({ title: 'Hath Bolo', text: text }).catch(function () {}); return; }
    copyText(text);
  }

  // --- lobby
  function showLobby(m) {
    var seatBox = function (i) {
      var s = m.seats[i];
      var me = i === m.mySeat;
      var inner;
      if (s.human) {
        inner = '<div class="lb-av team-' + (i % 2) + '">' + esc(s.name).charAt(0).toUpperCase() + '</div><div class="lb-nm">' + esc(s.name) +
          (me ? ' <em>(' + t('youTag') + ')</em>' : '') + (s.host ? ' <em>· ' + t('hostTag') + '</em>' : '') + '</div>' +
          (s.online ? '' : '<div class="lb-sub" style="color:var(--danger)">offline</div>');
      } else {
        inner = '<div class="lb-av bot">C</div><div class="lb-nm">' + t('computerSeat') + '</div><div class="lb-sub">' + t('sitHere') + '</div>';
      }
      return '<button class="lb-seat' + (me ? ' me' : '') + (s.human ? '' : ' empty') + '" data-seat="' + i + '"' + (s.human ? ' disabled' : '') + '>' + inner + '</button>';
    };
    var html = '<h2>' + t('lobbyTitle') + '</h2>' +
      '<div class="code-box"><span class="lbl">' + t('roomCode') + '</span><b class="code">' + m.code + '</b></div>' +
      '<div class="share-row"><button class="btn wa" id="lWa"><svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.9s.7-2.1 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.3.5-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.6 2.1 1.1 1 2 1.3 2.3 1.4.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.3z"/></svg>' + t('shareWa') + '</button>' +
      '<button class="btn ghost" id="lCopy">' + t('copy') + '</button><button class="btn ghost" id="lShare">' + t('shareMore') + '</button></div>' +
      '<p class="lb-help">' + t('lobbyHelp') + '</p>' +
      '<div class="lb-teams"><div class="lb-team us"><div class="lb-tt">' + t('team', 1) + '</div>' + seatBox(0) + seatBox(2) + '</div>' +
      '<div class="lb-team them"><div class="lb-tt">' + t('team', 2) + '</div>' + seatBox(1) + seatBox(3) + '</div></div>' +
      (m.isHost ? '<div class="set-row"><div class="sl">' + t('target') + '</div>' + '<div class="seg" id="lTarget">' + [21, 30, 50].map(function (v) { return '<button data-v="' + v + '" class="' + (m.settings.target === v ? 'on' : '') + '">' + v + '</button>'; }).join('') + '</div></div>' : '<p class="lb-help" style="text-align:center">' + t('waitHost') + ' · ' + t('firstTo', m.settings.target) + '</p>') +
      '<div class="actions"><button class="btn ghost" id="lLeave">' + t('leaveRoom') + '</button>' + (m.isHost ? '<button class="btn gold" id="lStart">' + t('startGame') + '</button>' : '') + '</div>';
    var wasOpen = $('#modalWrap').classList.contains('open') && $('#modal').querySelector('.code-box');
    var scroll = $('#modal').scrollTop;
    openModal(html, { dismissable: false });
    if (wasOpen) { $('#modal').style.animation = 'none'; $('#modal').scrollTop = scroll; } else $('#modal').style.animation = '';
    $('#lWa').onclick = function () { shareWhatsApp(m.code); };
    $('#lCopy').onclick = function () { copyText(t('invite', m.code, inviteLink(m.code))); };
    $('#lShare').onclick = function () { nativeShare(m.code); };
    $('#lLeave').onclick = function () { Net.leave(); };
    if ($('#lStart')) $('#lStart').onclick = function () { FX.play('click'); this.disabled = true; Net.send({ t: 'start' }); };
    if ($('#lTarget')) $('#lTarget').onclick = function (e) { var b = e.target.closest('button'); if (b) Net.send({ t: 'settings', target: +b.dataset.v }); };
    $('#modal').querySelectorAll('.lb-seat.empty').forEach(function (b) { b.onclick = function () { FX.play('click'); Net.send({ t: 'seat', seat: +b.dataset.seat }); }; });
  }

  // --- emotes (online)
  $('#btnEmote').addEventListener('click', function () {
    if (!st || !st.online) return;
    var html = '<h2>' + t('shareMore') + '</h2><div class="emote-grid">' + t('emotes').map(function (e) { return '<button class="btn ghost" data-e="' + e + '">' + e + '</button>'; }).join('') + '</div>';
    openModal(html);
    $('#modal').querySelectorAll('[data-e]').forEach(function (b) { b.onclick = function () { Net.send({ t: 'emote', e: b.dataset.e }); closeModal(true); }; });
  });

  $('#btnOnline').onclick = function () { FX.play('click'); showOnlineEntry(''); };

  // a WhatsApp link like https://server/?join=ABCDE opens the join dialog directly
  (function () {
    try {
      var q = new URLSearchParams(location.search).get('join');
      if (q) {
        var code = q.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
        history.replaceState(null, '', location.pathname);
        setTimeout(function () { showOnlineEntry(code); }, 300);
      }
    } catch (e) { /* ignore */ }
  })();

  // ================================================================ INSTALL + SHARE THE APP
  var deferredInstall = null, apkUrl = null;
  var standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredInstall = e; });

  function waOpen(text) {
    var url = 'https://api.whatsapp.com/send?text=' + encodeURIComponent(text);
    if (isNative()) window.location.href = url; else window.open(url, '_blank');
  }

  function setupInstallRow() {
    var base = serverBase();
    var showInstall = !isNative() && !standalone && /^https?:$/.test(location.protocol);
    var showShare = !!base;
    $('#btnInstall').style.display = showInstall ? '' : 'none';
    $('#btnShareApp').style.display = showShare ? '' : 'none';
    $('#installRow').style.display = (showInstall || showShare) ? '' : 'none';
    if (!isNative() && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
    if (!isNative() && /^https?:$/.test(location.protocol)) {
      fetch('download-info').then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j && j.apk) apkUrl = j.apk; }).catch(function () {});
    }
  }

  function showInstallHelp() {
    var android = /android/i.test(navigator.userAgent), ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    var a = '<h3>' + t('installAndroid') + '</h3>' +
      (apkUrl ? '<a class="btn gold" style="display:block;text-align:center;text-decoration:none" href="' + apkUrl + '" download>' + t('installApk') + '</a><p style="color:var(--muted);font-size:12.5px">' + t('installApkNote') + '</p>' : '') +
      (deferredInstall ? '<button class="btn ' + (apkUrl ? 'ghost' : 'gold') + '" id="iNow" style="width:100%">' + t('installAndroidBtn') + '</button>' : '') +
      '<p>' + t('installAndroidSteps') + '</p>';
    var i = '<h3>' + t('installIos') + '</h3><p>' + t('installIosSteps') + '</p>';
    var html = '<h2>' + t('installTitle') + '</h2>' + (ios ? i + a : android ? a + i : a + i) + '<p style="color:var(--muted)">' + t('installDone') + '</p>' +
      '<div class="actions"><button class="btn gold" data-close>' + t('close') + '</button></div>';
    openModal(html);
    if ($('#iNow')) $('#iNow').onclick = function () {
      deferredInstall.prompt();
      deferredInstall.userChoice.finally(function () { deferredInstall = null; closeModal(true); });
    };
  }

  $('#btnInstall').onclick = function () { FX.play('click'); showInstallHelp(); };
  $('#btnShareApp').onclick = function () { FX.play('click'); waOpen(t('shareAppText', serverBase() + '/')); };
  setupInstallRow();

  // test hook (used by automated UI tests only)
  window.__hb = { get state() { return st; }, newGame: newGame, settings: settings, Net: Net };

  applyFxSettings();
  applyLang();
  show('home');
})();
