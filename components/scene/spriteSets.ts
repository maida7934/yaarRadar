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
// scripts/build-sprites.py (CELL_W/CELL_H).
const CELL_WIDTH = 78;
const CELL_HEIGHT = 130;

function sprite(name: string): SpriteSet {
  return {
    walkSrc: `/sprites/chibi-${name}-walk.png`,
    idleSrc: `/sprites/chibi-${name}-idle.png`,
    frameCount: 4,
    cellWidth: CELL_WIDTH,
    cellHeight: CELL_HEIGHT,
  };
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

// CSS background-image doesn't crossfade -- the old image vanishes the
// instant a direction switch sets a new url(), even before the new one has
// loaded, so an image requested for the first time right as it's needed
// (e.g. swaying "right" for the first time) flashes blank. Preloading every
// variant up front (see hooks/usePreloadImages.ts) avoids that. Computed
// once at module load since it never changes.
export const ALL_SPRITE_SRCS: string[] = [
  ...new Set(
    [YOU_SPRITES, FRIEND_SPRITES, PURPLE_FRIEND_SPRITES, PURPLE_FACE_LEFT_SPRITES].flatMap((set) => [
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
