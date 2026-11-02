/* Hath Bolo — text in Hinglish (hi) and English (en). */
(function (root) {
  'use strict';
  var S = {
    tagline: ['Bolo kitne hath, phir jeet ke dikhao!', 'Call your tricks, then win them.'],
    newGame: ['Naya game', 'New game'],
    continueGame: ['Game jaari rakho', 'Continue game'],
    howTo: ['Kaise khelein', 'How to play'],
    settings: ['Settings', 'Settings'],
    stats: ['Aankde', 'Stats'],
    you: ['Aap', 'You'],
    comp: [function (n) { return 'Computer ' + n; }, function (n) { return 'Computer ' + n; }],
    partner: ['saathi', 'partner'],
    team: [function (n) { return 'Team ' + n; }, function (n) { return 'Team ' + n; }],
    usTeam: ['Aapki team', 'Your team'],
    themTeam: ['Computer team', 'Opponents'],
    cards: [function (n) { return n + ' patte'; }, function (n) { return n + (n === 1 ? ' card' : ' cards'); }],
    hath: [function (n) { return n + ' hath'; }, function (n) { return n + (n === 1 ? ' trick' : ' tricks'); }],
    pass: ['Pass', 'Pass'],
    bidBadge: [function (n) { return n + ' bole'; }, function (n) { return 'bid ' + n; }],
    yourTurn: ['Aapki baari', 'Your turn'],
    turnOf: [function (n) { return n + ' ki baari'; }, function (n) { return n + "'s turn"; }],
    biddingStart: [function (n) { return 'Bidding shuru. ' + n + ' pehle bolenge.'; }, function (n) { return 'Bidding starts. ' + n + ' speaks first.'; }],
    saidBid: [function (n, b) { return n + ' ne ' + b + ' hath bole.'; }, function (n, b) { return n + ' bid ' + b + '.'; }],
    saidPass: [function (n) { return n + ' ne pass kiya.'; }, function (n) { return n + ' passed.'; }],
    highest: [function (n, b) { return n + ' ne sabse zyada ' + b + ' hath bole.'; }, function (n, b) { return n + ' won the bidding with ' + b + '.'; }],
    chooseColour: ['Ab colour chuno.', 'Now choose trumps.'],
    choosingColour: [function (n) { return n + ' trump chun rahe hain…'; }, function (n) { return n + ' is choosing trumps…'; }],
    trumpChosen: [function (s, n) { return 'Trump ' + s + '. ' + n + ' pehla card chalenge.'; }, function (s, n) { return 'Trumps are ' + s + '. ' + n + ' leads.'; }],
    youLead: ['Aap pehla card chalenge.', 'You lead.'],
    wonTrick: [function (n) { return n + ' ne hath jeeta.'; }, function (n) { return n + ' won the trick.'; }],
    bidTitle: ['Kitne hath bologe?', 'How many tricks for your team?'],
    bidSub: [function (b, n) { return b ? 'Sabse zyada abhi: ' + b + ' (' + n + ')' : 'Abhi tak kisi ne nahi bola. Kam se kam 7.'; },
             function (b, n) { return b ? 'Highest so far: ' + b + ' (' + n + ')' : 'No bids yet. Minimum is 7.'; }],
    mustBid: ['Sab ne pass kiya. Dealer hone ke naate aapko bolna hoga.', 'Everyone passed. As dealer you must bid.'],
    hint: ['Sujhav', 'Hint'],
    hintBid: [function (e, s) { return 'Andaza: aapki team ~' + e + ' hath (' + s + ' trump ke saath)'; }, function (e, s) { return 'Estimate: your team ~' + e + ' tricks (with ' + s + ' trumps)'; }],
    hintSays: [function (x) { return 'Sujhav: ' + x; }, function (x) { return 'Suggestion: ' + x; }],
    trumpTitle: ['Trump colour chuno', 'Choose the trump suit'],
    trumpSub: [function (b) { return 'Aap ne ' + b + ' hath bole. Jis rang ke patte zyada aur bade hon, wahi achha.'; }, function (b) { return 'You bid ' + b + '. Pick a suit you hold many high cards in.'; }],
    trumpLabel: ['Trump', 'Trumps'],
    bidLabel: ['Bid', 'Bid'],
    by: [function (n) { return n + ' ne'; }, function (n) { return 'by ' + n; }],
    roundN: [function (n) { return 'Round ' + n; }, function (n) { return 'Round ' + n; }],
    roundResult: ['Round ka result', 'Round result'],
    bidMade: ['Bid poora hua!', 'Contract made!'],
    bidFailed: ['Bid poora nahi hua', 'Contract failed'],
    resultLine: [function (t, g, b) { return t + ' ke ' + g + ' hath, bid ' + b + '.'; }, function (t, g, b) { return t + ' took ' + g + ' of ' + b + ' tricks.'; }],
    earlyEnd: ['Result tay ho gaya, baaki patte nahi khele gaye.', 'Result was decided, so the remaining cards were not played.'],
    nextRound: ['Agla round', 'Next round'],
    thTeam: ['Team', 'Team'], thBid: ['Bid', 'Bid'], thTricks: ['Hath mile', 'Tricks'], thResult: ['Result', 'Result'], thTotal: ['Total', 'Total'],
    thPlayer: ['Player', 'Player'], thSaid: ['Bola', 'Said'], thTrick: ['Hath', 'Trick'], thCards: ['Chale gaye patte', 'Cards played'], thWinner: ['Jeeta', 'Won by'],
    trickHistory: ['Har hath ki history', 'Trick-by-trick history'],
    matchWon: ['Mubarak ho! Aapki team jeet gayi', 'You win the match!'],
    matchLost: ['Is baar computer team jeet gayi', 'The opponents win this time'],
    finalScore: ['Final score', 'Final score'],
    playAgain: ['Phir se khelo', 'Play again'],
    home: ['Home', 'Home'],
    firstTo: [function (n) { return n + ' points tak'; }, function (n) { return 'First to ' + n; }],
    menu: ['Menu', 'Menu'],
    resume: ['Wapas khelo', 'Resume'],
    confirmNew: ['Naya game shuru karein? Abhi wala game khatam ho jayega.', 'Start a new game? The current game will be lost.'],
    yes: ['Haan', 'Yes'], no: ['Nahi', 'No'], close: ['Band karo', 'Close'],
    language: ['Bhasha', 'Language'],
    target: ['Jeetne ke liye points', 'Points to win'],
    speed: ['Game ki raftaar', 'Game speed'],
    slow: ['Dheere', 'Slow'], normal: ['Normal', 'Normal'], fast: ['Tez', 'Fast'],
    sound: ['Awaaz', 'Sound'],
    vibration: ['Vibration', 'Vibration'],
    quickFinish: ['Round jaldi khatam', 'Quick finish'],
    quickFinishDesc: ['Result tay hote hi round khatam', 'End a round as soon as the result is decided'],
    hints: ['Sujhav button', 'Hint button'],
    hintsDesc: ['Bidding aur chaal ke liye madad', 'Help with bidding and card play'],
    resetStats: ['Aankde mitao', 'Reset stats'],
    resetConfirm: ['Saare aankde mita dein?', 'Reset all stats?'],
    stMatches: ['Games khele', 'Matches played'],
    stWon: ['Jeete', 'Won'],
    stLost: ['Haare', 'Lost'],
    stWinPct: ['Jeet %', 'Win %'],
    stRounds: ['Rounds khele', 'Rounds played'],
    stBidsMade: ['Aapki bid poori', 'Your bids made'],
    stBidsFailed: ['Aapki bid adhoori', 'Your bids failed'],
    stBestBid: ['Sabse badi poori bid', 'Highest bid made'],
    stStreak: ['Lagatar jeet (abhi)', 'Current win streak'],
    stBestStreak: ['Sabse lambi jeet', 'Best win streak'],
    tapToPlay: ['Chamakte patte mein se ek chuno', 'Tap one of the highlighted cards'],
    dealer: ['Dealer', 'Dealer'],
    thinking: ['soch rahe hain…', 'thinking…'],
    resumed: ['Pichla game wapas aa gaya', 'Your last game has been restored'],
    pressBackAgain: ['Bahar jaane ke liye dobara Back dabayein', 'Press back again to exit'],
    lead: ['pehli chaal', 'leads'],
    suitNames: [['Hukum', 'Paan', 'Chidi', 'Eent'], ['Spades', 'Hearts', 'Clubs', 'Diamonds']],
    waitingOthers: ['Baaki khiladiyon ka intezaar…', 'Waiting for the others…'],
    leaveRoom: ['Room chhodo', 'Leave room'],
    leaveConfirm: ['Room chhod dein? Aapki jagah computer khelega.', 'Leave the room? A computer will take your seat.'],
    playFriends: ['Dosto ke saath khelo', 'Play with friends'],
    playFriendsSub: ['Room banao, code WhatsApp pe bhejo, dost code daal ke jud jaayenge. Khaali jagah pe computer khelega.', 'Create a room, send the code on WhatsApp, and friends join with the code. Empty seats are played by the computer.'],
    yourName: ['Aapka naam', 'Your name'],
    createRoom: ['Naya room banao', 'Create a room'],
    joinRoom: ['Judo', 'Join'],
    enterCode: ['Room code daalo', 'Enter room code'],
    orJoin: ['ya kisi ke room mein judo', 'or join a friend\'s room'],
    rejoin: [function (c) { return 'Pichle room ' + c + ' mein wapas jao'; }, function (c) { return 'Rejoin room ' + c; }],
    roomCode: ['Room code', 'Room code'],
    shareWa: ['WhatsApp pe bhejo', 'Share on WhatsApp'],
    shareMore: ['Share', 'Share'],
    copy: ['Copy', 'Copy'],
    copied: ['Copy ho gaya', 'Copied'],
    startGame: ['Game shuru karo', 'Start game'],
    waitHost: ['Host game shuru karenge…', 'Waiting for the host to start…'],
    sitHere: ['Yahan baitho', 'Sit here'],
    computerSeat: ['Computer khelega', 'Computer plays'],
    hostTag: ['host', 'host'],
    youTag: ['aap', 'you'],
    lobbyTitle: ['Room taiyaar hai', 'Your room is ready'],
    lobbyHelp: ['Code dosto ko bhejo. Jo jagah khaali rahegi, wahan computer khelega. Apni team badalne ke liye khaali jagah pe tap karo.', 'Send the code to friends. Empty seats are played by the computer. Tap an empty seat to switch teams.'],
    needServer: ['Online khelne ke liye server ka address set nahi hai (www/js/config.js).', 'The online server address is not set yet (www/js/config.js).'],
    connecting: ['Jod rahe hain…', 'Connecting…'],
    connLost: ['Connection toot gaya, dobara jod rahe hain…', 'Connection lost, reconnecting…'],
    connFail: ['Server se nahi jud paaye. Internet check karein.', 'Could not reach the server. Check your internet.'],
    errNoRoom: ['Is code ka koi room nahi mila', 'No room found with that code'],
    errFull: ['Room bhar gaya hai (4 khiladi)', 'That room is full (4 players)'],
    errName: ['Pehle apna naam likho', 'Please enter your name first'],
    errCode: ['5 akshar ka code daalo', 'Enter the 5-character code'],
    invite: [function (c, l) { return 'Mere saath Hath Bolo khelo! Room code: *' + c + '*\nApp mein "Dosto ke saath khelo" > code daalo' + (l ? ', ya yeh link kholo: ' + l : '.'); },
             function (c, l) { return 'Play Hath Bolo with me! Room code: *' + c + '*\nIn the app tap "Play with friends" and enter the code' + (l ? ', or open: ' + l : '.'); }],
    readyCount: [function (a, b) { return a + '/' + b + ' taiyaar'; }, function (a, b) { return a + '/' + b + ' ready'; }],
    emotes: [['Shabash!', 'Wah kya chaal!', 'Jaldi karo', 'Oops!', 'Ab dekhna', 'Good game'], ['Nice!', 'Great move!', 'Hurry up', 'Oops!', 'Watch this', 'Good game']],
    joinedRoom: [function (n) { return n + ' room mein aaye'; }, function (n) { return n + ' joined'; }],
    installApp: ['Phone pe install karo', 'Install on phone'],
    shareApp: ['Dosto ko bhejo', 'Send to friends'],
    shareAppText: [function (l) { return 'Hath Bolo khelo! Taash ka team game, computer ke saath ya dosto ke saath online. Yahan se kholo / install karo: ' + l; },
                   function (l) { return 'Play Hath Bolo! A team card game, against the computer or online with friends. Open / install it here: ' + l; }],
    installTitle: ['App install kaise karein', 'How to install the app'],
    installAndroid: ['Android', 'Android'],
    installAndroidBtn: ['Abhi install karo', 'Install now'],
    installApk: ['Android app (APK) download karo', 'Download the Android app (APK)'],
    installApkNote: ['Download ke baad file kholo. Phone "Unknown apps" ki permission maange to Allow karo.', 'Open the file after downloading. If the phone asks to allow installing unknown apps, allow it.'],
    installAndroidSteps: ['Chrome mein upar ⋮ menu → <b>Install app</b> ya <b>Add to Home screen</b>.', 'In Chrome tap the ⋮ menu → <b>Install app</b> or <b>Add to Home screen</b>.'],
    installIos: ['iPhone', 'iPhone'],
    installIosSteps: ['Safari mein neeche <b>Share</b> button (dabba aur upar teer) → <b>Add to Home Screen</b> → <b>Add</b>.', 'In Safari tap the <b>Share</b> button (square with arrow) → <b>Add to Home Screen</b> → <b>Add</b>.'],
    installDone: ['Ab Hath Bolo aapki home screen pe ek app ki tarah khulega.', 'Hath Bolo will then open from your home screen like an app.'],
    rulesHtml: [
      '<h3>Khel kya hai</h3>' +
      '<p>4 khiladi, 2 team. Aap aur <b>Computer 2</b> (saamne baithe) ek team mein ho. <b>Computer 1</b> aur <b>Computer 3</b> doosri team. Har khiladi ko 13 patte milte hain.</p>' +
      '<h3>1. Hath bolo (bidding)</h3>' +
      '<p>Dealer ke baayein wala khiladi pehle bolta hai. Har khiladi ek baar bolta hai: ya to <b>pass</b>, ya pichli bid se zyada hath (kam se kam <b>7</b>, zyada se zyada <b>13</b>). Bid ka matlab hai ki <b>aapki team</b> 13 mein se itne hath jeetegi. Agar sab pass kar dein to dealer ko 7 bolna padta hai.</p>' +
      '<h3>2. Trump chuno</h3>' +
      '<p>Jisne sabse zyada bola, woh trump colour chunta hai aur pehla patta chalta hai.</p>' +
      '<h3>3. Patte chalo</h3>' +
      '<p>Jo rang chala gaya hai, wahi rang dena zaroori hai. Agar woh rang nahi hai, to koi bhi patta de sakte ho, trump bhi. Hath us patte ka jo sabse bada trump ho; trump na ho to chale gaye rang ka sabse bada patta. Jeetne wala agla patta chalta hai. Ikka (A) sabse bada, 2 sabse chhota.</p>' +
      '<h3>4. Points</h3>' +
      '<p>Bid poori hui to bolne wali team ko <b>+bid</b> points. Nahi hui to <b>−bid</b>. Doosri team ko 0. Jo team pehle target points (settings mein) tak pahunche, woh jeet gayi. Koi team −target tak gir jaaye to woh haar jaati hai.</p>' +
      '<h3>Tips</h3>' +
      '<ul><li>Ikke, badshah aur lambe rang ke patte hath dilaate hain.</li><li>Saathi jeet raha ho to chhota patta do.</li><li>Kisi rang mein khaali ho jao to trump se kaat sakte ho.</li><li>Upar ka <b>?</b> button sujhav deta hai.</li></ul>',
      '<h3>The game</h3>' +
      '<p>Four players in two teams. You and <b>Computer 2</b> (sitting opposite) are partners against <b>Computer 1</b> and <b>Computer 3</b>. Everyone gets 13 cards.</p>' +
      '<h3>1. Bidding</h3>' +
      '<p>The player to the dealer\'s left speaks first. Each player speaks once: either <b>pass</b> or bid more than the current highest bid (minimum <b>7</b>, maximum <b>13</b>). A bid is the number of tricks out of 13 that <b>your team</b> will win. If the first three pass, the dealer must bid 7.</p>' +
      '<h3>2. Trumps</h3>' +
      '<p>The highest bidder chooses the trump suit and leads the first trick.</p>' +
      '<h3>3. Playing tricks</h3>' +
      '<p>You must follow the suit that was led. If you can\'t, play any card, including a trump. The highest trump wins the trick; with no trump, the highest card of the led suit wins. The winner leads next. Ace is high, 2 is low.</p>' +
      '<h3>4. Scoring</h3>' +
      '<p>If the bidding team wins at least its bid, it scores <b>+bid</b>; otherwise <b>−bid</b>. The other team scores 0. The first team to reach the target (see Settings) wins the match. A team that drops to −target loses.</p>' +
      '<h3>Tips</h3>' +
      '<ul><li>Aces, kings and long suits win tricks.</li><li>If your partner is already winning, play low.</li><li>Run out of a suit so you can trump it.</li><li>The <b>?</b> button at the top gives a suggestion.</li></ul>'
    ]
  };

  var lang = 'hi';
  function setLang(l) { lang = l === 'en' ? 'en' : 'hi'; }
  function getLang() { return lang; }
  function t(key) {
    var e = S[key];
    if (!e) return key;
    var v = e[lang === 'en' ? 1 : 0];
    if (typeof v === 'function') return v.apply(null, Array.prototype.slice.call(arguments, 1));
    return v;
  }
  root.I18N = { t: t, setLang: setLang, getLang: getLang };
})(window);
