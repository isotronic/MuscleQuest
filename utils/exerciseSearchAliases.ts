import type { AliasMap } from "./exerciseSearch";

// Canonical values in this map must appear as substrings of exercise NAMES in the DB,
// not the equipment/target_muscle field values. The search engine indexes names only.
// Verified against appData3.db (979 exercises).

export const FITNESS_ALIAS_MAP: AliasMap = {
  // ─── Equipment abbreviations ──────────────────────────────────────────────
  // "Dumbbell X", "Barbell X", etc. — equipment prefix used in exercise names.
  db: ["dumbbell"],
  dbs: ["dumbbell"],
  bb: ["barbell"],
  kb: ["kettlebell"],
  // "Bodyweight X" exercises (3 exist). Most body weight exercises have no prefix —
  // use the equipment filter for comprehensive body weight search.
  bw: ["bodyweight"],
  // "Ez-Bar X" exercises — normalizes to "ez bar" as a substring.
  ez: ["ez bar"],
  cables: ["cable"],
  // Machine exercise prefixes (71 Lever, 47 Smith, 13 Sled exercises in DB)
  lever: ["lever"],
  smith: ["smith"],
  sled: ["sled"],
  machine: ["lever", "sled", "smith"],

  // ─── Movement / exercise name abbreviations ───────────────────────────────
  // These are short forms that do NOT appear in exercise names.
  rdl: ["romanian deadlift"],
  sdl: ["sumo deadlift"],
  dl: ["deadlift"],
  ohp: ["overhead press"],
  bp: ["bench press"],
  cgbp: ["close grip bench press"],
  "lat pd": ["lat pulldown", "lateral pulldown"],
  "lat pull": ["lat pulldown", "lateral pulldown"],
  // No-hyphen spellings — "Pull-Up" normalizes to "pull up".
  pullup: ["pull-up"],
  "pull up": ["pull-up"],
  chinup: ["chin-up"],
  "chin up": ["chin-up"],
  pushup: ["push-up"],
  "push up": ["push-up"],
  situp: ["sit-up"],
  "sit up": ["sit-up"],
  // Exercise-specific shortcuts
  skull: ["skull crusher"],
  skullcrusher: ["skull crusher"],
  arnold: ["arnold press"],
  hack: ["hack squat"],
  goblet: ["goblet squat"],
  zercher: ["zercher"],
  // "Farmer's Walk" — apostrophe becomes space on normalization so the token
  // becomes "farmer", not "farmers". The alias bridges the gap.
  farmers: ["farmer"],
  "good morning": ["good morning"],
  "glute bridge": ["glute bridge", "lying lifting"],
  // "Hip Thrust" exercises in DB are named as glute bridge variations.
  "hip thrust": ["glute bridge", "lying lifting"],
  "hip ext": ["hip extension"],
  "leg ext": ["leg extension"],
  "leg curl": ["leg curl"],
  "rack pull": ["rack pull"],
  "floor press": ["floor press"],
  "upright row": ["upright row"],
  "front sq": ["front squat"],
  "french press": ["overhead tricep extension"],
  // "flye" is an alternate spelling of "fly" used in some exercise names.
  flye: ["fly"],

  // ─── Muscle name aliases ──────────────────────────────────────────────────
  // Keys are short terms users type. Canonical values are substrings of exercise
  // names in the DB — not anatomical terms or DB field values (which rarely appear
  // in exercise names). Use the target_muscle filter for comprehensive muscle search.
  //
  // DB target_muscle canonical values: abs, lats, delts, glutes, traps, calves,
  // pectorals, triceps, biceps, quads, hamstrings, upper back, forearms,
  // serratus anterior, spine, abductors, adductors, cardiovascular system
  //
  lats: ["lat"], // "Lat Pulldown", "Cable Lat Pulldown" — 52 exercises
  delts: ["delt"], // "Rear Delt Row", "Cable Rear Delt Row" — 67 exercises
  glutes: ["glute"], // "Glute Bridge", "Glute Bridge March" — 97 exercises
  calves: ["calf"], // "Calf Raise", "Calf Press" — 38 exercises
  traps: ["shrug"], // "Barbell Shrug", "Cable Shrug" — 11 shrug exercises
  pecs: ["chest"], // "Chest Dip", "Lever Chest Press" — 25 exercises
  tris: ["tricep"], // "Triceps Extension", "Triceps Dip" — 57 exercises
  bis: ["bicep"], // "Biceps Curl", "Bicep Curl" — 88 exercises
  abs: ["crunch"], // "Crunch Floor", "Cable Kneeling Crunch" — 97 exercises
  hams: ["hamstring"], // "Nordic Hamstring Curl" — most hamstring exercises found via rdl/leg curl directly
  quads: ["leg extension"], // "Lever Leg Extension" — most specific quad name term
  "upper back": ["row"], // 62 of 83 row exercises target upper back
  forearms: ["wrist"], // "Wrist Curl" — most forearm exercises use "wrist" in name
};
