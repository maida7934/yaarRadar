// Shared mock data — mirrors the GET /friends response shape, using pixel
// sprites instead of emojis. Used by both the Friends page and the Find
// scene's "select friend" picker so the same roster shows up in both places.
export interface MockFriend {
  id: string;
  username: string;
  pfp: string;
}

export const MOCK_FRIENDS: MockFriend[] = [
  { id: "1", username: "PixelPete", pfp: "/sprites/chibi-down-idle.png" },
  { id: "2", username: "RetroRanger", pfp: "/sprites/chibi-left-idle.png" },
  { id: "3", username: "ChibiChan", pfp: "/sprites-purple/chibi-down-idle.png" },
  { id: "4", username: "CodeNinja", pfp: "/sprites/chibi-right-idle.png" },
  { id: "5", username: "StarGazer", pfp: "/sprites-purple/chibi-left-idle.png" },
  { id: "6", username: "MagicMike", pfp: "/sprites/chibi-up-idle.png" },
  { id: "7", username: "PixelPioneer", pfp: "/sprites-purple/chibi-right-idle.png" },
];
