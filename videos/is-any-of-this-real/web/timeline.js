// Key times derived from the aligned voiceover (WORDS comes from timeline_data.js)
'use strict';
const normW = (s) => s.toLowerCase().replace(/[^a-z']/g, '');
function at(word, n = 0, which = 's') {
  let k = 0;
  for (const w of WORDS) if (normW(w.w) === word) { if (k === n) return w[which]; k++; }
  throw new Error('word not found: ' + word + ' #' + n);
}
// cue map for the philosophical script: scene logic keeps its beat names, words drive the times
const K = {};
K.look = at('look'); K.anything = at('real'); K.dissolve = at('dissolve');
// the space between
K.atoms = at('you', 1); K.touched = at('touched'); K.every = K.atoms + 0.2; K.empty = at('anything');
K.space = at('ground'); K.never = at('people') - 0.25; K.what = at('only'); K.force = at('space');
K.pushing = at('between'); K.back = at('between', 0, 'e');
// matter is a rumour
K.go = at('even', 0); K.deeper = at('matter'); K.matter = at('matter'); K.particles = at('matter');
K.balls = at('rumor'); K.disappears = at('rumor'); K.ripples = at('rumor', 0, 'e') + 0.1; K.fields = at('nothing');
K.clouds = at('nothing') - 0.2; K.seen = at('looks');
// the brain's story
K.color = at('colors'); K.sound = at('sounds'); K.voice = at('voice'); K.brain = at('brain'); K.paints = at('paints');
K.darkness = at('darkness'); K.skull = K.darkness + 0.9; K.shows = at('seen'); K.world = at('world', 0);
K.moment = at('story'); K.late = at('story') + 0.35;
// memories in the sky
K.lookup = at('look', 1); K.some = at('memories'); K.gone = at('died'); K.born = at('born');
// a dream with rules
K.edge = at('some', 1); K.physics = at('physicists'); K.stranger = at('suspect'); K.everything = at('entire');
K.written = at('universe'); K.surface = at('universe') + 0.6; K.projection = at('projection');
K.universe1 = K.projection - 0.7; K.dream = at('dream');
// the self is a pattern
K.humans = at('you', 5); K.animals = at('atoms'); K.pattern = at('atoms'); K.borrowing = at('thoughts');
K.living = at('thoughts'); K.giving = at('thoughts') + 0.5; K.person = at('person'); K.forged = at('ten');
K.carbon = at('ago') - 0.35; K.dying = at('gone') - 0.35; K.stars2 = at('gone') + 0.2;
// maya → the eye
K.so = at('ancients'); K.maya = at('maya'); K.maybe2 = at('false'); K.seems = at('seems');
K.strangest = at('so'); K.fake = at('fake'); K.universe2 = at('fake'); K.something = at('something', 1);
K.wonder = at('noticing'); K.close = at('close'); K.eyes = at('eyes'); K.disappear = at('disappears');
K.now = at('now'); K.who = at('who'); K.watching = at('watching'); K.watchingEnd = at('watching', 0, 'e');
K.ghosts = Math.min(K.gone + 1.2, K.edge - 0.4); K.light = K.ghosts + 0.6;
K.open = K.watchingEnd + 0.25;      // the eye snaps open
K.title = K.open + 0.55;            // final title card
K.cut = K.open + 2.95;              // glitch to black
const DURATION = +(K.cut + 0.85).toFixed(2);

// scene boundaries: transition centre, duration, type
// types: 0 crossfade, 1 zoom-through, 2 glitch, 3 vertical whip, 4 lens swirl, 5 pixel dissolve, 6 white flash
const TRANS = [
  { at: K.atoms - 0.08, dur: 0.9, type: 1 },
  { at: K.go + 0.35, dur: 1.0, type: 1 },
  { at: K.color - 0.12, dur: 0.5, type: 2 },
  { at: K.lookup + 0.12, dur: 0.85, type: 3 },
  { at: K.edge + 0.1, dur: 1.5, type: 4 },
  { at: K.humans - 0.25, dur: 0.7, type: 5 },
  { at: K.stars2 + 0.75, dur: 1.1, type: 6 },
];
