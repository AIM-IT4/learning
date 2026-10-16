// Key times derived from the aligned voiceover (WORDS comes from timeline_data.js)
'use strict';
const normW = (s) => s.toLowerCase().replace(/[^a-z']/g, '');
function at(word, n = 0, which = 's') {
  let k = 0;
  for (const w of WORDS) if (normW(w.w) === word) { if (k === n) return w[which]; k++; }
  throw new Error('word not found: ' + word + ' #' + n);
}
const K = {
  look: at('look'), anything: at('anything'), dissolve: at('dissolve'),
  atoms: at('you', 0), every: at('every'), empty: at('empty'), space: at('space'), never: at('never'),
  touched: at('touched'), what: at('what'), force: at('force'), pushing: at('pushing'), back: at('back'),
  go: at('go'), deeper: at('deeper'), matter: at('matter'), disappears: at('disappears'), particles: at('particles'),
  balls: at('balls'), ripples: at('ripples'), fields: at('fields'), clouds: at('clouds'), seen: at('seen'),
  color: at('color'), sound: at('sound'), brain: at('brain'), paints: at('paints'), darkness: at('darkness'),
  skull: at('skull'), shows: at('shows'), world: at('world'), moment: at('moment'), late: at('late'),
  lookup: at('look', 1), some: at('some'), gone: at('gone'), ghosts: at('ghosts'), light: at('light'),
  edge: at('edge'), physics: at('physics'), stranger: at('stranger'), everything: at('everything'),
  written: at('written'), surface: at('surface'), universe1: at('universe', 0), projection: at('projection'),
  humans: at('humans'), animals: at('animals'), living: at('living'), pattern: at('pattern'),
  borrowing: at('borrowing'), giving: at('giving'), carbon: at('carbon'), forged: at('forged'),
  dying: at('dying'), stars2: at('stars', 1), so: at('so'), fake: at('fake'), maybe2: at('maybe', 1),
  seems: at('seems'), strangest: at('strangest'), universe2: at('universe', 1), something: at('something', 1),
  wonder: at('wonder'), close: at('close'), eyes: at('eyes'), now: at('now'), who: at('who'),
  watching: at('watching'), watchingEnd: at('watching', 0, 'e'),
};
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
