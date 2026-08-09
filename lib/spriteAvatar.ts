// Idle sprites are a single full-body portrait (78x130) that avatars crop
// down to a headshot via `backgroundSize: cover` + a vertical anchor. Most
// sheets draw the character close to the top of the canvas, so anchoring to
// the very top ("center top") already frames the face. The hat-girl sheet
// draws her lower (the tall witch hat needs headroom above it), so the same
// top-anchored crop left her face below the visible window -- verified by
// sampling the sheet's pixel content: the plain top-anchored crop only shows
// rows 0-78 of 130, which for this sheet is almost entirely empty space plus
// the hat brim.
export function avatarBackgroundPosition(pfp: string): string {
  if (pfp.includes("/sprites-hat/")) return "center 29%";
  return "center top";
}
