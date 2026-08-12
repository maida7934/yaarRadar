// Character-picker options, shared by Me page's "Change Layout" and the
// Friends page (to render a friend's chosen character from their
// character_id, returned by GET /friends -- see CLAUDE.md).
export interface CharacterOption {
  id: string;
  label: string;
  pfp: string;
}

export const CHARACTER_OPTIONS: CharacterOption[] = [
  { id: "default", label: "Classic", pfp: "/sprites/chibi-down-idle.png" },
  { id: "purple", label: "Purple", pfp: "/sprites-purple/chibi-down-idle.png" },
  { id: "whiteboy", label: "White Boy", pfp: "/sprites-whiteboy/chibi-down-idle.png" },
  { id: "officer", label: "Officer", pfp: "/sprites-officer/chibi-down-idle.png" },
];

/** character_id is null until someone's picked one (see CLAUDE.md) --
 * falls back to the default sprite in that case. */
export function characterAvatarSrc(characterId: string | null | undefined): string {
  return CHARACTER_OPTIONS.find((c) => c.id === characterId)?.pfp ?? CHARACTER_OPTIONS[0].pfp;
}
