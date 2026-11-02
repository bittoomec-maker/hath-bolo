/*
 * Hath Bolo — online multiplayer server.
 *
 *  - Rooms identified by a short code (e.g. "K7QPM") that players share on WhatsApp.
 *  - The server is authoritative: it runs the same engine as the app (../www/js/engine.js),
 *    validates every move, hides other players' cards and plays for empty / disconnected seats.
 *  - It also serves the web version of the game, so a WhatsApp link like
 *    https://your-server/?join=K7QPM opens the game straight in a phone browser.
 *
 *  Run:  node server/index.js       (PORT env var, default 8080)
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const HB = require('../www/js/engine.js');

const PORT = parseInt(process.env.PORT || '8080', 10);
const WEB_ROOT = path.join(__dirname, '..', 'www');
const DOWNLOAD_ROOT = path.join(__dirname, 'downloads');
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_IDLE_MS = 30 * 60 * 1000;     // delete rooms with nobody connected for 30 min
const OFFLINE_AUTOPLAY_MS = 6000;        // a disconnected player's turn is played by the computer after this
const NEXT_ROUND_TIMEOUT_MS = 45000;     // start next round even if somebody didn't press "next"
const PACE = { bid: 900, trump: 1100, play: 750, trickPause: 1500, deal: 1600 };

// ---------------------------------------------------------------- static files
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, rooms: rooms.size })); return; }
  let p = decodeURIComponent(u.pathname);
  if (p === '/download-info') {
    const has = fs.existsSync(path.join(DOWNLOAD_ROOT, 'hath-bolo.apk'));
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-cache' });
    res.end(JSON.stringify({ apk: has ? 'download/hath-bolo.apk' : null }));
    return;
  }
  // Android app download: put the APK at server/downloads/hath-bolo.apk
  if (p.startsWith('/download/')) {
    const f = path.normalize(path.join(DOWNLOAD_ROOT, p.slice('/download/'.length)));
    if (!f.startsWith(DOWNLOAD_ROOT + path.sep)) { res.writeHead(403); res.end(); return; }
    fs.stat(f, (err, stat) => {
      if (err || !stat.isFile()) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'content-type': 'application/vnd.android.package-archive', 'content-length': stat.size,
        'content-disposition': 'attachment; filename="' + path.basename(f) + '"' });
      if (req.method === 'HEAD') { res.end(); return; }
      fs.createReadStream(f).pipe(res);
    });
    return;
  }
  if (p === '/' || p === '') p = '/index.html';
  const file = path.normalize(path.join(WEB_ROOT, p));
  if (!file.startsWith(WEB_ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(data);
  });
});

// ---------------------------------------------------------------- rooms
const rooms = new Map();

function newCode() {
  for (;;) {
    let c = '';
    for (let i = 0; i < 5; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    if (!rooms.has(c)) return c;
  }
}

function cleanName(n) {
  n = String(n || '').replace(/[<>&"'`]/g, '').trim().slice(0, 16);
  return n || 'Player';
}

function createRoom(hostPid, hostName) {
  const code = newCode();
  const room = {
    code,
    host: hostPid,
    seats: [null, null, null, null], // { pid, name, ws } for humans, null = computer
    settings: { target: 30, quick: false },
    st: null,
    started: false,
    timer: null,
    ready: new Set(),
    lastActive: Date.now()
  };
  room.seats[0] = { pid: hostPid, name: hostName, ws: null };
  rooms.set(code, room);
  return room;
}

function seatOfPid(room, pid) { return room.seats.findIndex(s => s && s.pid === pid); }
function botName(seat) { return 'Computer ' + seat; }
function seatName(room, seat) { return room.seats[seat] ? room.seats[seat].name : botName(seat); }
function isHuman(room, seat) { return !!room.seats[seat]; }
function isOnline(room, seat) { const s = room.seats[seat]; return !!(s && s.ws && s.ws.readyState === 1); }
function humansOnline(room) { return [0, 1, 2, 3].filter(s => isOnline(room, s)); }

function send(ws, msg) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); }

// ---------------------------------------------------------------- per-player views (rotated: you are always seat 0, your team is team 0)
function rotateView(room, my) {
  const st = room.st;
  const myTeam = my % 2;
  const r = s => (s === null || s === undefined) ? s : (s - my + 4) % 4;
  const a4 = a => [a[my], a[(my + 1) % 4], a[(my + 2) % 4], a[(my + 3) % 4]];
  const tm = a => myTeam ? [a[1], a[0]] : a.slice();
  const names = a4([0, 1, 2, 3].map(s => seatName(room, s)));
  const bots = a4([0, 1, 2, 3].map(s => !isHuman(room, s)));
  const online = a4([0, 1, 2, 3].map(s => isOnline(room, s) || !isHuman(room, s)));
  const rotHistory = h => h.map(x => ({ leader: r(x.leader), winner: r(x.winner), cards: x.cards.map(p => ({ seat: r(p.seat), card: p.card })) }));
  const res = st.lastResult && {
    round: st.lastResult.round, bidder: r(st.lastResult.bidder), bid: st.lastResult.bid, trump: st.lastResult.trump,
    bidTeam: st.lastResult.bidTeam ^ myTeam, made: st.lastResult.made, teamTricks: tm(st.lastResult.teamTricks),
    tricksWon: a4(st.lastResult.tricksWon), delta: tm(st.lastResult.delta), scores: tm(st.lastResult.scores),
    bids: st.lastResult.bids.map(b => ({ seat: r(b.seat), bid: b.bid })), history: rotHistory(st.lastResult.history), early: st.lastResult.early
  };
  return {
    v: 2, online: true, code: room.code, mySeat: my, isHost: room.seats[my] && room.seats[my].pid === room.host,
    names, bots, onlineSeats: online, ready: a4([0, 1, 2, 3].map(s => room.ready.has(s))),
    phase: st.phase, target: st.target, quickFinish: st.quickFinish, scores: tm(st.scores), round: st.round, dealer: r(st.dealer),
    hands: a4(st.hands).map((h, i) => i === 0 ? h.slice() : h.map(() => -1)),
    bids: a4(st.bids), bidOrder: st.bidOrder.map(b => ({ seat: r(b.seat), bid: b.bid })), bidTurn: r(st.bidTurn), highBid: st.highBid,
    bidder: r(st.bidder), trump: st.trump, leader: r(st.leader), turn: r(st.turn),
    trick: st.trick.map(p => ({ seat: r(p.seat), card: p.card })), tricksWon: a4(st.tricksWon), teamTricks: tm(st.teamTricks),
    history: rotHistory(st.history), played: st.played.slice(), voids: a4(st.voids),
    lastResult: res,
    roundLog: st.roundLog.map(l => ({ round: l.round, bidder: r(l.bidder), bid: l.bid, trump: l.trump, made: l.made, delta: tm(l.delta), scores: tm(l.scores) })),
    winner: st.winner === null || st.winner === undefined ? null : st.winner ^ myTeam
  };
}

function rotateEvent(ev, my) {
  const e = Object.assign({}, ev);
  ['seat', 'winner', 'bidder'].forEach(k => { if (typeof e[k] === 'number') e[k] = (e[k] - my + 4) % 4; });
  return e;
}

function lobbyMsg(room, forSeat) {
  return {
    t: 'lobby', code: room.code, started: room.started, settings: room.settings, mySeat: forSeat,
    isHost: room.seats[forSeat] && room.seats[forSeat].pid === room.host,
    seats: room.seats.map((s, i) => s ? { name: s.name, human: true, online: isOnline(room, i), host: s.pid === room.host } : { name: botName(i), human: false })
  };
}

function broadcastLobby(room) {
  room.seats.forEach((s, i) => { if (s) send(s.ws, lobbyMsg(room, i)); });
}

function broadcast(room, ev) {
  room.seats.forEach((s, i) => {
    if (s && s.ws) send(s.ws, { t: 'ev', ev: ev ? rotateEvent(ev, i) : { kind: 'sync' }, view: rotateView(room, i) });
  });
}

// ---------------------------------------------------------------- game driving
function clearTimer(room) { if (room.timer) { clearTimeout(room.timer); room.timer = null; } }
function schedule(room, ms, fn) { clearTimer(room); room.timer = setTimeout(() => { room.timer = null; try { fn(); } catch (e) { console.error(e); } }, ms); }

function startMatch(room) {
  room.st = HB.newMatch({ target: room.settings.target, quickFinish: room.settings.quick });
  room.started = true;
  startRound(room);
}

function startRound(room) {
  room.ready.clear();
  HB.startRound(room.st);
  broadcast(room, { kind: 'deal' });
  schedule(room, PACE.deal, () => drive(room));
}

/** Who must act now, and act for computers / disconnected players. */
function drive(room) {
  const st = room.st;
  if (!st) return;
  if (humansOnline(room).length === 0) { clearTimer(room); return; } // everybody away: pause until someone returns
  let seat = null;
  if (st.phase === 'bidding') seat = st.bidTurn;
  else if (st.phase === 'trump') seat = st.bidder;
  else if (st.phase === 'play') seat = st.turn;
  else if (st.phase === 'roundEnd') { finishRound(room); return; }
  else return;

  const human = isHuman(room, seat);
  if (human && isOnline(room, seat)) { clearTimer(room); return; } // wait for the player
  const delay = human ? OFFLINE_AUTOPLAY_MS : (st.phase === 'bidding' ? PACE.bid : st.phase === 'trump' ? PACE.trump : PACE.play);
  schedule(room, delay, () => {
    // re-check: the player may have reconnected or acted meanwhile
    const cur = st.phase === 'bidding' ? st.bidTurn : st.phase === 'trump' ? st.bidder : st.phase === 'play' ? st.turn : null;
    if (cur !== seat) return drive(room);
    if (isHuman(room, seat) && isOnline(room, seat)) return;
    act(room, seat, autoMove(st, seat));
  });
}

function autoMove(st, seat) {
  if (st.phase === 'bidding') return { t: 'bid', bid: HB.AI.bid(st, seat) };
  if (st.phase === 'trump') return { t: 'trump', suit: HB.AI.trump(st, seat) };
  return { t: 'play', card: HB.AI.play(st, seat) };
}

function act(room, seat, m) {
  const st = room.st;
  if (!st) return 'no game';
  try {
    if (m.t === 'bid') {
      if (st.phase !== 'bidding' || st.bidTurn !== seat) return 'not your turn';
      const bid = m.bid === 'pass' ? 'pass' : parseInt(m.bid, 10);
      HB.applyBid(st, seat, bid);
      broadcast(room, { kind: 'bid', seat, bid });
      schedule(room, 350, () => drive(room));
    } else if (m.t === 'trump') {
      if (st.phase !== 'trump' || st.bidder !== seat) return 'not your turn';
      const suit = parseInt(m.suit, 10);
      if (!(suit >= 0 && suit <= 3)) return 'bad suit';
      HB.applyTrump(st, suit);
      broadcast(room, { kind: 'trump', bidder: seat, suit });
      schedule(room, 600, () => drive(room));
    } else if (m.t === 'play') {
      if (st.phase !== 'play' || st.turn !== seat) return 'not your turn';
      const card = parseInt(m.card, 10);
      const res = HB.applyPlay(st, seat, card);
      broadcast(room, { kind: 'play', seat, card, trickDone: res.trickDone, winner: res.trickDone ? res.winner : undefined });
      schedule(room, res.trickDone ? PACE.trickPause : 250, () => drive(room));
    } else return 'unknown move';
  } catch (e) {
    return e.message || 'illegal move';
  }
  room.lastActive = Date.now();
  return null;
}

function finishRound(room) {
  HB.finishRound(room.st);
  room.ready.clear();
  broadcast(room, { kind: 'roundEnd' });
  if (room.st.phase === 'roundOver') schedule(room, NEXT_ROUND_TIMEOUT_MS, () => nextRound(room));
}

function nextRound(room) {
  if (!room.st || room.st.phase !== 'roundOver') return;
  if (humansOnline(room).length === 0) return;
  room.st.phase = 'idle';
  startRound(room);
}

function maybeAllReady(room) {
  const need = humansOnline(room);
  if (need.every(s => room.ready.has(s))) nextRound(room);
  else broadcast(room, { kind: 'ready' });
}

// ---------------------------------------------------------------- sockets
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.room = null;
  ws.pid = null;

  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    const room = ws.room;

    if (m.t === 'ping') { send(ws, { t: 'pong' }); return; }

    if (m.t === 'create') {
      const pid = String(m.pid || '').slice(0, 40);
      if (!pid) return send(ws, { t: 'error', code: 'bad_request' });
      leave(ws);
      const r = createRoom(pid, cleanName(m.name));
      if (m.target && [21, 30, 50].includes(+m.target)) r.settings.target = +m.target;
      r.seats[0].ws = ws; ws.room = r; ws.pid = pid;
      send(ws, { t: 'joined', code: r.code, seat: 0 });
      broadcastLobby(r);
      return;
    }

    if (m.t === 'join') {
      const code = String(m.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const pid = String(m.pid || '').slice(0, 40);
      const r = rooms.get(code);
      if (!r) return send(ws, { t: 'error', code: 'no_room' });
      if (!pid) return send(ws, { t: 'error', code: 'bad_request' });
      let seat = seatOfPid(r, pid);
      if (seat < 0) {
        // free seat: prefer seats not yet taken; a started game lets a newcomer take over a computer seat
        const order = [2, 1, 3, 0];
        seat = order.find(s => !r.seats[s]);
        if (seat === undefined) return send(ws, { t: 'error', code: 'full' });
        r.seats[seat] = { pid, name: cleanName(m.name), ws: null };
      } else if (m.name) {
        r.seats[seat].name = cleanName(m.name);
      }
      if (ws.room && ws.room !== r) leave(ws);
      const old = r.seats[seat].ws;
      if (old && old !== ws) { old.room = null; try { old.close(4000, 'replaced'); } catch (e) { /* ignore */ } }
      r.seats[seat].ws = ws; ws.room = r; ws.pid = pid;
      r.lastActive = Date.now();
      send(ws, { t: 'joined', code: r.code, seat });
      broadcastLobby(r);
      if (r.started) {
        broadcast(r, null);
        if (r.st.phase === 'roundOver' && !r.timer) schedule(r, NEXT_ROUND_TIMEOUT_MS, () => nextRound(r));
        drive(r);
      }
      return;
    }

    if (!room) return send(ws, { t: 'error', code: 'no_room' });
    const seat = seatOfPid(room, ws.pid);
    if (seat < 0) return;
    const isHost = room.host === ws.pid;
    room.lastActive = Date.now();

    switch (m.t) {
      case 'seat': {
        // move to an empty seat while in the lobby
        const to = parseInt(m.seat, 10);
        if (room.started || !(to >= 0 && to <= 3) || room.seats[to]) return;
        room.seats[to] = room.seats[seat]; room.seats[seat] = null;
        broadcastLobby(room);
        return;
      }
      case 'settings': {
        if (!isHost || room.started) return;
        if ([21, 30, 50].includes(+m.target)) room.settings.target = +m.target;
        if (typeof m.quick === 'boolean') room.settings.quick = m.quick;
        broadcastLobby(room);
        return;
      }
      case 'start': {
        if (!isHost || room.started) return;
        broadcastLobby(room);
        startMatch(room);
        return;
      }
      case 'rematch': {
        if (!room.st || room.st.phase !== 'matchOver') return;
        startMatch(room);
        return;
      }
      case 'bid': case 'trump': case 'play': {
        const err = act(room, seat, m);
        if (err) { send(ws, { t: 'error', code: 'move', msg: err }); send(ws, { t: 'ev', ev: { kind: 'sync' }, view: rotateView(room, seat) }); }
        return;
      }
      case 'ready': {
        if (!room.st || room.st.phase !== 'roundOver') return;
        room.ready.add(seat);
        maybeAllReady(room);
        return;
      }
      case 'emote': {
        const e = String(m.e || '').slice(0, 24);
        room.seats.forEach((s, i) => { if (s && s.ws) send(s.ws, { t: 'emote', seat: (seat - i + 4) % 4, e }); });
        return;
      }
      case 'leave': {
        leave(ws, true);
        return;
      }
    }
  });

  ws.on('close', () => leave(ws, false));
});

function leave(ws, permanent) {
  const room = ws.room;
  if (!room) return;
  const seat = seatOfPid(room, ws.pid);
  ws.room = null;
  if (seat >= 0 && room.seats[seat] && room.seats[seat].ws === ws) {
    room.seats[seat].ws = null;
    if (permanent) {
      // a player who leaves for good is replaced by a computer
      room.seats[seat] = null;
      if (room.host === ws.pid) {
        const next = room.seats.find(s => s);
        room.host = next ? next.pid : null;
      }
    }
  }
  if (!room.seats.some(s => s)) { clearTimer(room); rooms.delete(room.code); return; }
  broadcastLobby(room);
  if (room.started) { broadcast(room, { kind: 'presence' }); drive(room); }
}

// heartbeat + cleanup
setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws.isAlive) { try { ws.terminate(); } catch (e) { /* ignore */ } return; }
    ws.isAlive = false;
    try { ws.ping(); } catch (e) { /* ignore */ }
  });
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (humansOnline(room).length === 0 && now - room.lastActive > ROOM_IDLE_MS) { clearTimer(room); rooms.delete(code); }
  }
}, 20000);

server.listen(PORT, () => console.log('Hath Bolo server on http://localhost:' + PORT));
module.exports = { server, rooms };
