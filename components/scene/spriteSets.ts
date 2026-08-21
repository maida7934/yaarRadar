export interface SpriteSet {
  walkSrc: string;
  idleSrc: string;
  frameCount: number;
  cellWidth: number;
  cellHeight: number;
}

/**
 * A lean (left or right) has two phases -- see SpriteCharacter's turn/
 * settle state machine: `turning` shows briefly right when the lean
 * direction changes (a real turn, the way a person's stance shifts before
 * they're actually walking in the new heading), then it settles into
 * `sustained` for as long as that heading holds.
 */
export interface LeanPose {
  turning: SpriteSet;
  settled: SpriteSet;
}

export interface DirectionalSpriteSet {
  straight: SpriteSet;
  left: LeanPose;
  right: LeanPose;
}

// Native pixel size of each cell in the preprocessed strips -- see
// scripts/build-sprites.py (CELL_W/CELL_H). Every sprite-* folder (default,
// purple, hat, officer) was generated at this same size, so any of them is
// a drop-in swap for any other.
const CELL_WIDTH = 78;
const CELL_HEIGHT = 130;

// Generic helper -- every sprite-* folder shares the same
// chibi-{direction}-{walk,idle}.png naming (see scripts/build-sprites*.py).
function spriteFrom(folder: string, name: string): SpriteSet {
  return {
    walkSrc: `${folder}/chibi-${name}-walk.png`,
    idleSrc: `${folder}/chibi-${name}-idle.png`,
    frameCount: 4,
    cellWidth: CELL_WIDTH,
    cellHeight: CELL_HEIGHT,
  };
}

function sprite(name: string): SpriteSet {
  return spriteFrom("/sprites", name);
}

// This sheet has genuine art for every state (verified: a flipped `right`
// frame matches `left` almost exactly, real mirror pairs, not one pose
// reused) -- so both characters now get the full turn/settle treatment:
// `turning` is the sharp profile view (an actual lateral turn+walk), and
// `settled` is the forward-diagonal lean once that heading holds ("you
// turn, walk sideways a moment, then turn back forward and lean into the
// new heading" -- the settled pose is a real distinct walk, not a stand-in
// for the turn). "You" walks away from camera -- back pose, plus the two
// back-diagonals. "Friend" walks toward camera -- front pose, plus the two
// front-diagonals. left/right profile art is shared between them since
// it's the same character model turning sideways either way.
export const YOU_SPRITES: DirectionalSpriteSet = {
  straight: sprite("up"),
  left: { turning: sprite("left"), settled: sprite("upleft") },
  right: { turning: sprite("right"), settled: sprite("upright") },
};

// Front/toward-camera pose family. Friend always uses this (they walk toward
// the viewer). "You" also switches into this once arrived and settled, to
// turn and face the screen alongside Friend instead of staying back-turned
// -- see FindScene's arrival phase. Exported under its own name since that
// second use has nothing to do with "being the friend".
export const TOWARD_CAMERA_SPRITES: DirectionalSpriteSet = {
  straight: sprite("down"),
  left: { turning: sprite("left"), settled: sprite("downleft") },
  right: { turning: sprite("right"), settled: sprite("downright") },
};

export const FRIEND_SPRITES: DirectionalSpriteSet = TOWARD_CAMERA_SPRITES;

// Profile-facing sets used during the face-to-face arrival beat -- "You"
// turns right and "Friend" turns left so they visually look at each other
// before both turning to face the screen.  Only the `straight` variant is
// shown (lookSway is forced to 0 during this phase), but the interface
// requires left/right lean poses, so they fall back to the same profile art.
export const FACE_RIGHT_SPRITES: DirectionalSpriteSet = {
  straight: sprite("right"),
  left: { turning: sprite("left"), settled: sprite("downleft") },
  right: { turning: sprite("right"), settled: sprite("downright") },
};

export const FACE_LEFT_SPRITES: DirectionalSpriteSet = {
  straight: sprite("left"),
  left: { turning: sprite("left"), settled: sprite("downleft") },
  right: { turning: sprite("right"), settled: sprite("downright") },
};

// Purple-girl sheet (public/sprites-purple/, see
// scripts/build-sprites-purple.py) -- generated at the same cell size as
// the default set above, so it's a drop-in swap. For testing: used only in
// place of Friend's sprite sets in FindScene, "You" is untouched.
function purpleSprite(name: string): SpriteSet {
  return {
    walkSrc: `/sprites-purple/chibi-${name}-walk.png`,
    idleSrc: `/sprites-purple/chibi-${name}-idle.png`,
    frameCount: 4,
    cellWidth: CELL_WIDTH,
    cellHeight: CELL_HEIGHT,
  };
}

// Purple-girl equivalents of FRIEND_SPRITES/TOWARD_CAMERA_SPRITES above.
export const PURPLE_TOWARD_CAMERA_SPRITES: DirectionalSpriteSet = {
  straight: purpleSprite("down"),
  left: { turning: purpleSprite("left"), settled: purpleSprite("downleft") },
  right: { turning: purpleSprite("right"), settled: purpleSprite("downright") },
};

export const PURPLE_FRIEND_SPRITES: DirectionalSpriteSet = PURPLE_TOWARD_CAMERA_SPRITES;

// Purple-girl equivalent of FACE_LEFT_SPRITES above, for Friend's
// face-each-other beat.
export const PURPLE_FACE_LEFT_SPRITES: DirectionalSpriteSet = {
  straight: purpleSprite("left"),
  left: { turning: purpleSprite("left"), settled: purpleSprite("downleft") },
  right: { turning: purpleSprite("right"), settled: purpleSprite("downright") },
};

// ── Character picker (Me page's "Change Layout") ─────────────────────────
// Bundles every pose family a selected character needs to stand in for
// "You" throughout the whole Find scene -- not just the walking pose, but
// also the two post-arrival phases -- so picking e.g. "Officer" doesn't
// leave "You" flickering back to the default sheet once arrived.

export interface CharacterSpriteBundle {
  /** Back-facing / walking-away family (up, upleft, upright) -- "You"'s
   * pose while approaching. */
  you: DirectionalSpriteSet;
  /** Front-facing / toward-camera family (down, downleft, downright) --
   * "You"'s pose once arrived & settled facing the screen (see FindScene's
   * arrival phase); also what Friend always uses. */
  towardCamera: DirectionalSpriteSet;
  /** Right-profile straight pose for "You" during the face-each-other beat
   * (see FACE_RIGHT_SPRITES above for why only `straight` is really used). */
  faceRight: DirectionalSpriteSet;
  /** Left-profile counterpart, for Friend during the same beat. */
  faceLeft: DirectionalSpriteSet;
}

function buildCharacterBundle(folder: string): CharacterSpriteBundle {
  const s = (name: string) => spriteFrom(folder, name);
  return {
    you: {
      straight: s("up"),
      left: { turning: s("left"), settled: s("upleft") },
      right: { turning: s("right"), settled: s("upright") },
    },
    towardCamera: {
      straight: s("down"),
      left: { turning: s("left"), settled: s("downleft") },
      right: { turning: s("right"), settled: s("downright") },
    },
    faceRight: {
      straight: s("right"),
      left: { turning: s("left"), settled: s("downleft") },
      right: { turning: s("right"), settled: s("downright") },
    },
    faceLeft: {
      straight: s("left"),
      left: { turning: s("left"), settled: s("downleft") },
      right: { turning: s("right"), settled: s("downright") },
    },
  };
}

// Keys match the `id`s in Me page's CHARACTER_OPTIONS, which are also what
// gets persisted as the backend's characterId (see lib/characterState.tsx).
export const DEFAULT_CHARACTER_ID = "default";

export const CHARACTER_SPRITE_BUNDLES: Record<string, CharacterSpriteBundle> = {
  [DEFAULT_CHARACTER_ID]: buildCharacterBundle("/sprites"),
  purple: buildCharacterBundle("/sprites-purple"),
  officer: buildCharacterBundle("/sprites-officer"),
  cowboy: buildCharacterBundle("/sprites-cowboy"),
};

// CSS background-image doesn't crossfade -- the old image vanishes the
// instant a direction switch sets a new url(), even before the new one has
// loaded, so an image requested for the first time right as it's needed
// (e.g. swaying "right" for the first time, or switching characters) flashes
// blank. Preloading every variant up front (see hooks/usePreloadImages.ts)
// avoids that -- every character bundle is included since "You" can become
// any of them via the Me page's character picker. Computed once at module
// load since none of it changes at runtime.
export const ALL_SPRITE_SRCS: string[] = [
  ...new Set(
    Object.values(CHARACTER_SPRITE_BUNDLES)
      .flatMap((bundle) => [bundle.you, bundle.towardCamera, bundle.faceRight, bundle.faceLeft])
      .flatMap((set) => [
        set.straight.walkSrc,
        set.straight.idleSrc,
        set.left.turning.walkSrc,
        set.left.turning.idleSrc,
        set.left.settled.walkSrc,
        set.left.settled.idleSrc,
        set.right.turning.walkSrc,
        set.right.turning.idleSrc,
        set.right.settled.walkSrc,
        set.right.settled.idleSrc,
      ]),
  ),
];
