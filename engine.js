/*
 * Hath Bolo — game engine + computer players.
 * Pure logic, no DOM. Works in the browser (window.HB) and in Node (module.exports).
 *
 * Seats (clockwise):  0 = You (bottom), 1 = Computer 1 (left),
 *                     2 = Computer 2 (top, your partner), 3 = Computer 3 (right)
 * Teams:  team 0 = seats 0 + 2,  team 1 = seats 1 + 3
 *
 * Cards are integers 0..51:  suit = Math.floor(id / 13), rank = id % 13 + 2  (2..14, 14 = Ace)
 * Suits: 0 = Spades, 1 = Hearts, 2 = Clubs, 3 = Diamonds (alternating colours when sorted)
 */
(function (root) {
  'use strict';

  var SUITS = ['S', 'H', 'C', 'D'];
  var MIN_BID = 7;
  var MAX_BID = 13;
  var TRICKS = 13;

  function suitOf(c) { return Math.floor(c / 13); }
  function rankOf(c) { return (c % 13) + 2; }
  function card(suit, rank) { return suit * 13 + (rank - 2); }
  function teamOf(seat) { return seat % 2; }
  function partnerOf(seat) { return (seat + 2) % 4; }
  function nextSeat(seat) { return (seat + 1) % 4; }
  function rankLabel(r) { return r <= 10 ? String(r) : ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A' })[r]; }

  function shuffle(arr, rng) {
    rng = rng || Math.random;
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function sortHand(hand, trump) {
    // Group by suit (alternating colours), trump suit first, high cards first inside a suit.
    var order = [0, 1, 2, 3];
    if (trump !== null && trump !== undefined) {
      order = [trump].concat(order.filter(function (s) { return s !== trump; }));
      // keep colours alternating as much as possible
      var red = function (s) { return s === 1 || s === 3; };
      if (red(order[0]) === red(order[1]) && order.length > 2) {
        var t = order[1]; order[1] = order[2]; order[2] = t;
      }
    }
    return hand.slice().sort(function (a, b) {
      var sa = order.indexOf(suitOf(a)), sb = order.indexOf(suitOf(b));
      if (sa !== sb) return sa - sb;
      return rankOf(b) - rankOf(a);
    });
  }

  // ---------------------------------------------------------------- state

  function newMatch(opts) {
    opts = opts || {};
    return {
      v: 2,
      phase: 'idle',
      target: opts.target || 30,
      quickFinish: !!opts.quickFinish,
      scores: [0, 0],
      round: 0,
      dealer: 3, // first round: Computer 1 (seat 1) bids first, like the original
      hands: [[], [], [], []],
      bids: [null, null, null, null],
      bidOrder: [],
      bidTurn: null,
      highBid: 0,
      bidder: null,
      trump: null,
      leader: null,
      turn: null,
      trick: [],
      tricksWon: [0, 0, 0, 0],
      teamTricks: [0, 0],
      history: [],
      played: [],
      voids: [[false, false, false, false], [false, false, false, false], [false, false, false, false], [false, false, false, false]],
      lastResult: null,
      roundLog: [],
      winner: null
    };
  }

  function startRound(st, rng) {
    st.round += 1;
    st.dealer = nextSeat(st.dealer);
    var deck = [];
    for (var i = 0; i < 52; i++) deck.push(i);
    shuffle(deck, rng);
    st.hands = [[], [], [], []];
    for (var k = 0; k < 52; k++) st.hands[k % 4].push(deck[k]);
    for (var s = 0; s < 4; s++) st.hands[s] = sortHand(st.hands[s], null);
    st.bids = [null, null, null, null];
    st.bidOrder = [];
    st.bidTurn = nextSeat(st.dealer);
    st.highBid = 0;
    st.bidder = null;
    st.trump = null;
    st.leader = null;
    st.turn = null;
    st.trick = [];
    st.tricksWon = [0, 0, 0, 0];
    st.teamTricks = [0, 0];
    st.history = [];
    st.played = [];
    st.voids = [[false, false, false, false], [false, false, false, false], [false, false, false, false], [false, false, false, false]];
    st.lastResult = null;
    st.phase = 'bidding';
    return st;
  }

  // ---------------------------------------------------------------- bidding

  function bidsMade(st) { return st.bidOrder.length; }

  /** Minimum legal bid for the seat whose turn it is. */
  function minBid(st) { return Math.max(MIN_BID, st.highBid + 1); }

  /** Dealer (last to speak) may not pass if everybody else passed. */
  function canPass(st, seat) {
    if (bidsMade(st) < 3) return true;
    return st.highBid > 0;
  }

  function applyBid(st, seat, bid) {
    if (st.phase !== 'bidding' || st.bidTurn !== seat) throw new Error('Not your turn to bid');
    if (bid === 'pass') {
      if (!canPass(st, seat)) throw new Error('Dealer must bid');
      st.bids[seat] = 'pass';
    } else {
      bid = parseInt(bid, 10);
      if (!(bid >= minBid(st) && bid <= MAX_BID)) throw new Error('Illegal bid ' + bid);
      st.bids[seat] = bid;
      st.highBid = bid;
      st.bidder = seat;
    }
    st.bidOrder.push({ seat: seat, bid: st.bids[seat] });
    if (bidsMade(st) >= 4 || st.highBid === MAX_BID) {
      st.phase = 'trump';
      st.bidTurn = null;
      st.turn = st.bidder;
    } else {
      st.bidTurn = nextSeat(st.bidTurn);
    }
    return st;
  }

  function applyTrump(st, suit) {
    if (st.phase !== 'trump') throw new Error('Not choosing trump');
    st.trump = suit;
    st.leader = st.bidder;
    st.turn = st.bidder;
    st.phase = 'play';
    for (var s = 0; s < 4; s++) st.hands[s] = sortHand(st.hands[s], suit);
    return st;
  }

  // ---------------------------------------------------------------- play

  function legalCards(st, seat) {
    var hand = st.hands[seat];
    if (!st.trick.length) return hand.slice();
    var led = suitOf(st.trick[0].card);
    var follow = hand.filter(function (c) { return suitOf(c) === led; });
    return follow.length ? follow : hand.slice();
  }

  function beats(a, b, led, trump) {
    // does card a beat card b (b currently winning)?
    var sa = suitOf(a), sb = suitOf(b);
    if (sa === sb) return rankOf(a) > rankOf(b);
    if (sa === trump) return true;
    return false;
  }

  function trickWinner(trick, trump) {
    var led = suitOf(trick[0].card);
    var best = trick[0];
    for (var i = 1; i < trick.length; i++) {
      if (beats(trick[i].card, best.card, led, trump)) best = trick[i];
    }
    return best;
  }

  function applyPlay(st, seat, c) {
    if (st.phase !== 'play' || st.turn !== seat) throw new Error('Not your turn');
    var legal = legalCards(st, seat);
    if (legal.indexOf(c) < 0) throw new Error('Illegal card');
    if (st.trick.length) {
      var led = suitOf(st.trick[0].card);
      if (suitOf(c) !== led) {
        st.voids[seat][led] = true;
        if (suitOf(c) !== st.trump) st.voids[seat][st.trump] = true; // could not ruff → no trumps
      }
    }
    st.hands[seat] = st.hands[seat].filter(function (x) { return x !== c; });
    st.trick.push({ seat: seat, card: c });
    st.played.push(c);
    var res = { seat: seat, card: c, trickDone: false };
    if (st.trick.length === 4) {
      var w = trickWinner(st.trick, st.trump);
      st.tricksWon[w.seat] += 1;
      st.teamTricks[teamOf(w.seat)] += 1;
      st.history.push({ leader: st.trick[0].seat, cards: st.trick.slice(), winner: w.seat });
      res.trickDone = true;
      res.winner = w.seat;
      res.trick = st.trick.slice();
      st.trick = [];
      st.leader = w.seat;
      st.turn = w.seat;
      if (st.history.length === TRICKS || (st.quickFinish && outcomeDecided(st))) {
        st.phase = 'roundEnd';
        st.turn = null;
      }
    } else {
      st.turn = nextSeat(seat);
    }
    return res;
  }

  function outcomeDecided(st) {
    var bt = teamOf(st.bidder);
    var left = TRICKS - st.history.length;
    if (st.teamTricks[bt] >= st.highBid) return 'made';
    if (st.teamTricks[bt] + left < st.highBid) return 'failed';
    return null;
  }

  function finishRound(st) {
    var bt = teamOf(st.bidder);
    var made = st.teamTricks[bt] >= st.highBid;
    var delta = [0, 0];
    delta[bt] = made ? st.highBid : -st.highBid;
    st.scores[0] += delta[0];
    st.scores[1] += delta[1];
    var result = {
      round: st.round,
      bidder: st.bidder,
      bid: st.highBid,
      trump: st.trump,
      bidTeam: bt,
      made: made,
      teamTricks: st.teamTricks.slice(),
      tricksWon: st.tricksWon.slice(),
      delta: delta,
      scores: st.scores.slice(),
      bids: st.bidOrder.slice(),
      history: st.history.slice(),
      early: st.history.length < TRICKS
    };
    st.lastResult = result;
    st.roundLog.push({ round: st.round, bidder: st.bidder, bid: st.highBid, trump: st.trump, made: made, delta: delta, scores: st.scores.slice() });
    // match end: first team to reach target wins; a team falling to -target loses.
    var t = st.target;
    var w = null;
    if (st.scores[0] >= t || st.scores[1] >= t) {
      w = st.scores[0] === st.scores[1] ? null : (st.scores[0] > st.scores[1] ? 0 : 1);
    }
    if (w === null && (st.scores[0] <= -t || st.scores[1] <= -t)) {
      w = st.scores[0] > st.scores[1] ? 0 : 1;
    }
    st.winner = w;
    st.phase = w === null ? 'roundOver' : 'matchOver';
    return result;
  }

  // ---------------------------------------------------------------- AI helpers

  function bySuit(hand) {
    var g = [[], [], [], []];
    hand.forEach(function (c) { g[suitOf(c)].push(rankOf(c)); });
    g.forEach(function (a) { a.sort(function (x, y) { return y - x; }); });
    return g;
  }

  /** Expected tricks this hand takes on its own with a given trump suit. */
  function estimateTricks(hand, trump) {
    var g = bySuit(hand);
    var est = 0;
    var trumpLen = g[trump].length;
    for (var s = 0; s < 4; s++) {
      var r = g[s], len = r.length;
      if (!len) continue;
      var has = function (x) { return r.indexOf(x) >= 0; };
      var v = 0;
      if (has(14)) v += 1;
      if (has(13)) v += has(14) ? 1 : (len >= 2 ? 0.65 : 0.15);
      if (has(12)) v += (has(14) && has(13)) ? 1 : ((has(14) || has(13)) && len >= 3 ? 0.55 : (len >= 3 ? 0.3 : 0.05));
      if (has(11) && s === trump) v += (has(12) && (has(13) || has(14))) ? 0.6 : (len >= 4 ? 0.3 : 0.1);
      if (s !== trump) {
        // long side suits get ruffed: high cards past the 3rd round lose value
        if (len >= 6) v *= 0.8;
        // length winners in a side suit when we control trumps
        if (len >= 5 && trumpLen >= 4) v += (len - 4) * 0.35;
      } else {
        // long trumps win by length
        v += Math.max(0, len - 3) * 0.9;
      }
      est += v;
    }
    // ruffing potential with short side suits
    var ruffs = 0;
    for (var t = 0; t < 4; t++) {
      if (t === trump) continue;
      var l = g[t].length;
      ruffs += l === 0 ? 1.6 : l === 1 ? 0.9 : l === 2 ? 0.35 : 0;
    }
    var spareTrumps = Math.max(0, trumpLen - Math.min(trumpLen, 3) + (trumpLen >= 2 ? 1 : 0));
    est += Math.min(ruffs, spareTrumps * 0.85);
    return est;
  }

  function bestTrump(hand) {
    var best = 0, bestEst = -1;
    var g = bySuit(hand);
    for (var s = 0; s < 4; s++) {
      var e = estimateTricks(hand, s) + g[s].length * 0.05; // tiny tie-break toward length
      if (e > bestEst) { bestEst = e; best = s; }
    }
    return { suit: best, est: estimateTricks(hand, best) };
  }

  /** Shift in expected team tricks, read from what others bid so far. */
  function biddingAdjust(st, seat) {
    var p = partnerOf(seat), adj = 0;
    var pb = st.bids[p];
    if (pb === 'pass') adj -= 0.45;
    else if (typeof pb === 'number') adj += 0.5 + 0.55 * (pb - 7);
    [nextSeat(seat), (seat + 3) % 4].forEach(function (o) {
      var ob = st.bids[o];
      if (typeof ob === 'number') adj -= 0.25 + 0.15 * (ob - 7);
      else if (ob === 'pass') adj += 0.15;
    });
    return adj;
  }

  /** Expected team tricks if `seat` becomes the bidder (calibrated by simulation). */
  function teamEstimate(st, seat) {
    var bt = bestTrump(st.hands[seat]);
    var mean = 4.45 + 0.63 * bt.est + biddingAdjust(st, seat);
    return { suit: bt.suit, own: bt.est, team: mean };
  }

  function probAtLeast(mean, b) {
    // normal approximation, sd ~ 1.6 tricks
    var z = (b - 0.5 - mean) / 1.6;
    // Abramowitz-Stegun erf approximation
    var t = 1 / (1 + 0.3275911 * Math.abs(z / Math.SQRT2));
    var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
    var cdf = 0.5 * (1 + (z >= 0 ? y : -y));
    return 1 - cdf;
  }

  /** Best bid >= minimum by expected value b*(2P-1). */
  function bestBid(mean, mb, minP) {
    var best = null, bestEv = 0;
    for (var b = mb; b <= MAX_BID; b++) {
      var P = probAtLeast(mean, b);
      var ev = b * (2 * P - 1);
      if (P >= minP && ev > bestEv) { bestEv = ev; best = b; }
    }
    return { bid: best, ev: bestEv };
  }

  var AI = {};

  AI.bid = function (st, seat, style) {
    var e = teamEstimate(st, seat);
    var mb = minBid(st);
    var minP = style === 'bold' ? 0.5 : 0.56;
    var choice = bestBid(e.team, mb, minP);
    if (!canPass(st, seat)) return choice.bid || mb; // dealer forced: bid minimum if nothing better
    if (choice.bid === null) return 'pass';
    // don't take the contract away from our own partner unless clearly better
    if (st.bidder === partnerOf(seat) && choice.bid < st.highBid + 2) return 'pass';
    return choice.bid;
  };

  AI.suggestBid = function (st, seat) {
    var e = teamEstimate(st, seat);
    return { own: e.own, team: e.team, suit: e.suit, bid: AI.bid(st, seat) };
  };

  AI.trump = function (st, seat) {
    return bestTrump(st.hands[seat]).suit;
  };

  // --- card play knowledge (only public info + own hand)

  function unseenHigher(st, seat, c) {
    // cards of same suit, higher, that are neither played nor in my hand
    var s = suitOf(c), r = rankOf(c), out = [];
    for (var x = r + 1; x <= 14; x++) {
      var id = card(s, x);
      if (st.played.indexOf(id) < 0 && st.hands[seat].indexOf(id) < 0) out.push(id);
    }
    return out;
  }

  function unseenInSuit(st, seat, s) {
    var n = 0;
    for (var r = 2; r <= 14; r++) {
      var id = card(s, r);
      if (st.played.indexOf(id) < 0 && st.hands[seat].indexOf(id) < 0) n++;
    }
    return n;
  }

  function isTop(st, seat, c) { return unseenHigher(st, seat, c).length === 0; }

  function mayHoldSuit(st, viewer, other, s) {
    return !st.voids[other][s] && unseenInSuit(st, viewer, s) > 0;
  }

  /** Could `other` (still to play) beat card `c` in this trick? */
  function canBeBeatenBy(st, viewer, other, c, led) {
    var trump = st.trump, s = suitOf(c);
    if (s === trump) {
      return mayHoldSuit(st, viewer, other, trump) && unseenHigher(st, viewer, c).length > 0;
    }
    // c is in led suit (otherwise it can't be winning)
    if (!st.voids[other][led]) {
      return unseenHigher(st, viewer, c).length > 0;
    }
    return mayHoldSuit(st, viewer, other, trump);
  }

  function seatsAfter(st, seat) {
    var out = [], n = 4 - st.trick.length - 1, s = seat;
    for (var i = 0; i < n; i++) { s = nextSeat(s); out.push(s); }
    return out;
  }

  function safeWinner(st, seat, c, led) {
    var opps = seatsAfter(st, seat).filter(function (o) { return teamOf(o) !== teamOf(seat); });
    for (var i = 0; i < opps.length; i++) if (canBeBeatenBy(st, seat, opps[i], c, led)) return false;
    return true;
  }

  function lowest(cards) { return cards.slice().sort(function (a, b) { return rankOf(a) - rankOf(b); })[0]; }
  function highest(cards) { return cards.slice().sort(function (a, b) { return rankOf(b) - rankOf(a); })[0]; }

  function chooseDiscard(st, seat, cards) {
    var trump = st.trump;
    var nonTrump = cards.filter(function (c) { return suitOf(c) !== trump; });
    var pool = nonTrump.length ? nonTrump : cards;
    var g = bySuit(st.hands[seat]);
    var scored = pool.map(function (c) {
      var s = suitOf(c);
      var score = rankOf(c);
      if (isTop(st, seat, c)) score += 25;          // keep winners
      if (rankOf(c) === 13 && g[s].length === 2) score += 8; // keep a guarded king
      score -= Math.max(0, 4 - g[s].length) * 1.5;  // prefer emptying short suits (ruffing chances)
      return { c: c, score: score };
    });
    scored.sort(function (a, b) { return a.score - b.score; });
    return scored[0].c;
  }

  function chooseLead(st, seat) {
    var hand = st.hands[seat], trump = st.trump;
    var me = teamOf(seat), partner = partnerOf(seat);
    var opps = [nextSeat(seat), (seat + 3) % 4];
    var myTrumps = hand.filter(function (c) { return suitOf(c) === trump; });
    var oppsMayTrump = opps.some(function (o) { return mayHoldSuit(st, seat, o, trump); });
    var weBid = teamOf(st.bidder) === me;

    // 1. draw opponents' trumps when we hold the top trump
    if (myTrumps.length && oppsMayTrump) {
      var topT = highest(myTrumps);
      var unseenT = unseenInSuit(st, seat, trump);
      if (isTop(st, seat, topT) && (weBid || myTrumps.length >= 3)) return topT;
      if (myTrumps.length > unseenT && weBid) return topT;
    }
    // 2. cash sure side-suit winners nobody can ruff
    var cash = hand.filter(function (c) {
      var s = suitOf(c);
      if (s === trump || !isTop(st, seat, c)) return false;
      return opps.every(function (o) { return !st.voids[o][s] || !mayHoldSuit(st, seat, o, trump); });
    });
    if (cash.length) return highest(cash);
    // 3. give partner a ruff
    if (!st.voids[partner][trump] && unseenInSuit(st, seat, trump) > 0) {
      var ruffable = hand.filter(function (c) {
        var s = suitOf(c);
        return s !== trump && st.voids[partner][s] && !opps.every(function (o) { return st.voids[o][s] && mayHoldSuit(st, seat, o, trump); });
      });
      if (ruffable.length) return lowest(ruffable);
    }
    // 4. lead low from a long side suit the opponents can't ruff; avoid leading away from a king
    var g = bySuit(hand);
    var options = [];
    for (var s = 0; s < 4; s++) {
      if (s === trump || !g[s].length) continue;
      var oppRuff = opps.some(function (o) { return st.voids[o][s] && mayHoldSuit(st, seat, o, trump); });
      var score = g[s].length * 2;
      if (oppRuff) score -= 10;
      if (g[s][0] === 13 && g[s].indexOf(14) < 0 && unseenHigher(st, seat, card(s, 13)).length) score -= 3;
      if (g[s][0] === 12 && unseenHigher(st, seat, card(s, 12)).length >= 1) score -= 1.5;
      if (st.voids[partner][s] && oppRuff) score -= 2;
      options.push({ s: s, score: score });
    }
    if (options.length) {
      options.sort(function (a, b) { return b.score - a.score; });
      var suit = options[0].s;
      var inSuit = hand.filter(function (c) { return suitOf(c) === suit; });
      return lowest(inSuit);
    }
    // only trumps left
    var top = highest(hand);
    return isTop(st, seat, top) ? top : lowest(hand);
  }

  AI.play = function (st, seat) {
    var legal = legalCards(st, seat);
    if (legal.length === 1) return legal[0];
    if (!st.trick.length) return chooseLead(st, seat);

    var trump = st.trump;
    var led = suitOf(st.trick[0].card);
    var cur = trickWinner(st.trick, trump);
    var partnerWinning = teamOf(cur.seat) === teamOf(seat);
    var after = seatsAfter(st, seat);
    var oppsAfter = after.filter(function (o) { return teamOf(o) !== teamOf(seat); });
    var partnerAfter = after.indexOf(partnerOf(seat)) >= 0;
    var following = suitOf(legal[0]) === led && legal.every(function (c) { return suitOf(c) === led; });

    var winners = legal.filter(function (c) { return beats(c, cur.card, led, trump); });
    var safe = winners.filter(function (c) { return safeWinner(st, seat, c, led); });
    var cheapest = function (cards) {
      // cheapest = lowest trump if ruffing, otherwise lowest rank
      return cards.slice().sort(function (a, b) {
        var ta = suitOf(a) === trump ? 1 : 0, tb = suitOf(b) === trump ? 1 : 0;
        if (ta !== tb) return ta - tb;
        return rankOf(a) - rankOf(b);
      })[0];
    };
    var throwAway = function () { return following ? lowest(legal) : chooseDiscard(st, seat, legal); };

    if (partnerWinning) {
      var partnerSafe = oppsAfter.every(function (o) { return !canBeBeatenBy(st, seat, o, cur.card, led); });
      if (partnerSafe) return throwAway();
      // partner may be overtaken — take over only if it makes the trick safe and costs little
      var overtake = safe.filter(function (c) { return suitOf(c) === led || !following; });
      if (overtake.length) {
        var c = cheapest(overtake);
        if (suitOf(c) !== trump || !following) return c;
      }
      return throwAway();
    }

    // opponent currently winning
    if (safe.length) return cheapest(safe);
    if (winners.length) {
      if (partnerAfter && following) {
        // second hand low, unless we hold a strong card that forces out a big one
        var hi = highest(winners);
        if (rankOf(hi) >= 13 && unseenHigher(st, seat, hi).length <= 1) return hi;
        return lowest(legal);
      }
      if (!following) {
        // ruff, but avoid wasting a trump if partner (to play) probably wins anyway
        return cheapest(winners);
      }
      return cheapest(winners);
    }
    return throwAway();
  };

  AI.suggestPlay = function (st, seat) { return AI.play(st, seat); };

  var api = {
    SUITS: SUITS, MIN_BID: MIN_BID, MAX_BID: MAX_BID, TRICKS: TRICKS,
    suitOf: suitOf, rankOf: rankOf, rankLabel: rankLabel, card: card,
    teamOf: teamOf, partnerOf: partnerOf, nextSeat: nextSeat,
    sortHand: sortHand, shuffle: shuffle,
    newMatch: newMatch, startRound: startRound,
    minBid: minBid, canPass: canPass, applyBid: applyBid, applyTrump: applyTrump,
    legalCards: legalCards, applyPlay: applyPlay, trickWinner: trickWinner,
    outcomeDecided: outcomeDecided, finishRound: finishRound,
    estimateTricks: estimateTricks, bestTrump: bestTrump,
    AI: AI
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.HB = api;
})(typeof window !== 'undefined' ? window : globalThis);
