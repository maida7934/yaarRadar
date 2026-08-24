"use client";

import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { TabBar } from "@/components/scene/TabBar";
import { NotchedFrame } from "@/components/ui/NotchedFrame";
import { useAuth } from "@/lib/authState";
import {
  searchUsers,
  sendFriendRequest,
  unfriend,
  getFriends,
  getFriendRequests,
  cancelFriendRequest,
  ApiError,
  type UserSearchResult,
  type FriendRequest,
} from "@/lib/api";
import { rememberUser } from "@/lib/userDirectory";
import { characterAvatarSrc } from "@/lib/characterAvatars";
import { avatarBackgroundPosition } from "@/lib/spriteAvatar";

/** A rectangle with a 2-step pixel staircase cut into each corner, as an SVG
 * `points` string -- same technique as the notched-outline frames on the Me
 * page's profile card, ported here so this card's corners get the same
 * pixel-art cut instead of a smooth CSS border-radius. */
function notchedRectPoints(x0: number, y0: number, w: number, h: number, s: number): string {
  const points: [number, number][] = [
    [x0 + 2 * s, y0],
    [x0 + w - 2 * s, y0],
    [x0 + w - 2 * s, y0 + s],
    [x0 + w - s, y0 + s],
    [x0 + w - s, y0 + 2 * s],
    [x0 + w, y0 + 2 * s],
    [x0 + w, y0 + h - 2 * s],
    [x0 + w - s, y0 + h - 2 * s],
    [x0 + w - s, y0 + h - s],
    [x0 + w - 2 * s, y0 + h - s],
    [x0 + w - 2 * s, y0 + h],
    [x0 + 2 * s, y0 + h],
    [x0 + 2 * s, y0 + h - s],
    [x0 + s, y0 + h - s],
    [x0 + s, y0 + h - 2 * s],
    [x0, y0 + h - 2 * s],
    [x0, y0 + 2 * s],
    [x0 + s, y0 + 2 * s],
    [x0 + s, y0 + s],
    [x0 + 2 * s, y0 + s],
  ];
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}

/** Same idea as `notchedRectPoints`, but only the top-left/top-right corners
 * get the pixel-stair cut -- the bottom two stay square. Used where the
 * notch look should read as a "tag" hanging from the top edge rather than a
 * fully notched box. */
function topNotchedRectPoints(x0: number, y0: number, w: number, h: number, s: number): string {
  const points: [number, number][] = [
    [x0 + 2 * s, y0],
    [x0 + w - 2 * s, y0],
    [x0 + w - 2 * s, y0 + s],
    [x0 + w - s, y0 + s],
    [x0 + w - s, y0 + 2 * s],
    [x0 + w, y0 + 2 * s],
    [x0 + w, y0 + h],
    [x0, y0 + h],
    [x0, y0 + 2 * s],
    [x0 + s, y0 + 2 * s],
    [x0 + s, y0 + s],
    [x0 + 2 * s, y0 + s],
  ];
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}

/** Draws the card's own notched-corner outline + fill, sized to its parent
 * via ResizeObserver (the card's height is content-driven, so a fixed
 * viewBox would only ever match by coincidence). Two nested polygons: the
 * outer one is the border color, the inner one (inset by the border
 * thickness) is the cream fill -- the parent element should have no CSS
 * background/border of its own, since this SVG *is* the visible surface.
 * `topOnly` squares off the bottom two corners instead of notching them. */
function NotchedCardFrame({ borderColor, fillColor, borderWidth = 4, step = 10, topOnly = false }: { borderColor: string; fillColor: string; borderWidth?: number; step?: number; topOnly?: boolean }) {
  const pointsFn = topOnly ? topNotchedRectPoints : notchedRectPoints;
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="absolute inset-0 pointer-events-none" style={{ zIndex: -1 }} aria-hidden>
      {size.width > 0 && size.height > 0 && (
        <svg className="absolute inset-0" width="100%" height="100%" viewBox={`0 0 ${size.width} ${size.height}`} shapeRendering="crispEdges">
          <polygon points={pointsFn(0, 0, size.width, size.height, step)} fill={borderColor} />
          <polygon
            points={pointsFn(borderWidth, borderWidth, size.width - borderWidth * 2, size.height - borderWidth * 2, step)}
            fill={fillColor}
          />
        </svg>
      )}
    </div>
  );
}

type RequestState = "none" | "sent-pending" | "incoming-pending";

function resolveRequestState(requests: FriendRequest[], myId: string, otherId: string): RequestState {
  const existing = requests.find((r) => r.sender_id === otherId || r.receiver_id === otherId);
  if (!existing || existing.status !== "pending") return "none";
  return existing.sender_id === myId ? "sent-pending" : "incoming-pending";
}

function ActionPillButton({
  normalSrc,
  pressedSrc,
  pressedTextColor,
  onClick,
  disabled,
  children,
  style,
}: {
  normalSrc: string;
  pressedSrc: string;
  pressedTextColor: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const [pressed, setPressed] = useState(false);
  const release = () => setPressed(false);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseDown={() => setPressed(true)}
      onMouseUp={release}
      onMouseLeave={release}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={release}
      className="flex items-center justify-center text-[9px] font-bold uppercase shrink-0"
      style={{
        backgroundImage: `url(${pressed && !disabled ? pressedSrc : normalSrc})`,
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
        imageRendering: "pixelated",
        border: "none",
        fontFamily: "var(--font-pixel)",
        color: pressed && !disabled ? pressedTextColor : "#5a4632",
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function UserRow({
  user,
  isFriend,
  characterId,
  requestState,
  onSendRequest,
  onCancelRequest,
  onUnfriend,
  onViewProfile,
}: {
  user: UserSearchResult;
  isFriend: boolean;
  characterId: string | null | undefined;
  requestState: RequestState;
  onSendRequest: () => void;
  onCancelRequest: () => void;
  onUnfriend: () => void;
  onViewProfile: () => void;
}) {
  const pfp = isFriend ? characterAvatarSrc(characterId) : characterAvatarSrc(user.character_id);
  return (
    <div
      className="flex items-center gap-3 p-3"
      style={{
        backgroundColor: "rgba(253,246,236,0.92)",
        border: "3px solid #8C6B3E",
        borderRadius: 10,
        boxShadow: "3px 3px 0 #8C6B3E",
        imageRendering: "pixelated",
      }}
    >
      <button type="button" onClick={onViewProfile} className="flex items-center gap-3 flex-1 min-w-0 text-left">
        <div
          className="w-14 h-14 shrink-0 rounded-full"
          style={{
            backgroundColor: "#e0e0e0",
            backgroundImage: `url(${pfp})`,
            backgroundSize: "cover",
            backgroundPosition: avatarBackgroundPosition(pfp),
            imageRendering: "pixelated",
            border: "2px solid #8C6B3E",
          }}
        />
        <span className="text-base font-bold flex-1 truncate" style={{ color: "#3D271D", fontFamily: "var(--font-pixel)" }}>
          {user.username}
        </span>
      </button>
      <div className="flex gap-1.5 shrink-0">
        {isFriend ? (
          <ActionPillButton
            normalSrc="/pixelated-icons/request-btn-b.png"
            pressedSrc="/pixelated-icons/request-btn-b-pressed.png"
            pressedTextColor="#ffffff"
            onClick={onUnfriend}
            style={{ width: 110, height: 34, fontSize: 11 }}
          >
            UNFRIEND
          </ActionPillButton>
        ) : requestState === "sent-pending" ? (
          <ActionPillButton
            normalSrc="/pixelated-icons/request-btn-b.png"
            pressedSrc="/pixelated-icons/request-btn-b-pressed.png"
            pressedTextColor="#ffffff"
            onClick={onCancelRequest}
            style={{ width: 110, height: 34, fontSize: 11 }}
          >
            UNREQUEST
          </ActionPillButton>
        ) : requestState === "incoming-pending" ? (
          <ActionPillButton
            normalSrc="/pixelated-icons/buttons/pill-green.png"
            pressedSrc="/pixelated-icons/buttons/pill-green-pressed.png"
            pressedTextColor="#ffffff"
            onClick={() => {}}
            disabled
            style={{ width: 90, height: 30, fontSize: 8 }}
          >
            CHECK FRIENDS
          </ActionPillButton>
        ) : (
          <ActionPillButton
            normalSrc="/pixelated-icons/request-btn-b.png"
            pressedSrc="/pixelated-icons/request-btn-b-pressed.png"
            pressedTextColor="#ffffff"
            onClick={onSendRequest}
            style={{ width: 110, height: 34, fontSize: 11 }}
          >
            SEND REQUEST
          </ActionPillButton>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  const { accessToken, user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [requestErrorId, setRequestErrorId] = useState<string | null>(null);
  const [requestErrorMessage, setRequestErrorMessage] = useState<string | null>(null);
  const [viewingUser, setViewingUser] = useState<UserSearchResult | null>(null);
  const [friendCharacters, setFriendCharacters] = useState<Map<string, string | null>>(new Map());
  const [myRequests, setMyRequests] = useState<FriendRequest[]>([]);

  useEffect(() => {
    if (!accessToken) return;
    getFriends(accessToken)
      .then((friends) => setFriendCharacters(new Map(friends.map((f) => [f.id, f.character_id]))))
      .catch(() => {});
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    getFriendRequests(accessToken)
      .then(setMyRequests)
      .catch(() => {});
  }, [accessToken]);

  useEffect(() => {
    if (!query.trim() || !accessToken) {
      queueMicrotask(() => setResults([]));
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      setSearching(true);
      setSearchError(null);
    });

    const timeout = setTimeout(() => {
      searchUsers(accessToken, query.trim())
        .then((found) => {
          if (cancelled) return;
          setResults(found);
          found.forEach((u) => rememberUser(u.id, u.username, u.character_id, u.bio));
        })
        .catch((err) => {
          if (!cancelled) setSearchError(err instanceof ApiError ? err.message : "Search failed.");
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query, accessToken]);

  const sendRequest = async (id: string) => {
    if (!accessToken) return;
    setRequestErrorId(null);
    setRequestErrorMessage(null);
    try {
      const created = await sendFriendRequest(accessToken, id);
      setMyRequests((prev) => [...prev, created]);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        try {
          setMyRequests(await getFriendRequests(accessToken));
        } catch (retryErr) {
          setRequestErrorId(id);
          setRequestErrorMessage(retryErr instanceof ApiError ? retryErr.message : null);
        }
        return;
      }
      setRequestErrorId(id);
      setRequestErrorMessage(err instanceof ApiError ? err.message : null);
    }
  };

  const removeFriend = async (id: string) => {
    if (!accessToken) return;
    setRequestErrorId(null);
    setRequestErrorMessage(null);
    try {
      await unfriend(accessToken, id);
      setFriendCharacters((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      setMyRequests((prev) => prev.filter((r) => r.sender_id !== id && r.receiver_id !== id));
    } catch (err) {
      setRequestErrorId(id);
      setRequestErrorMessage(err instanceof ApiError ? err.message : null);
    }
  };

  const cancelRequest = async (id: string) => {
    if (!accessToken || !user) return;
    setRequestErrorId(null);
    setRequestErrorMessage(null);
    const request = myRequests.find((r) => (r.receiver_id === id && r.sender_id === user.id));
    if (!request) return;
    try {
      await cancelFriendRequest(accessToken, request.id);
      setMyRequests((prev) => prev.filter((r) => r.id !== request.id));
    } catch (err) {
      setRequestErrorId(id);
      // Most likely cause: the backend's DELETE /friends/requests/:id RLS
      // policy only allows the receiver to delete the row (decline), not
      // the sender (cancel) -- see CLAUDE.md discussion / friends.service.ts
      // declineRequest, reused for both. Surface the real message so that's
      // obvious instead of a generic "try again".
      setRequestErrorMessage(err instanceof ApiError ? err.message : null);
    }
  };

  return (
    <div
      className="flex flex-1 justify-center"
      style={{
        backgroundColor: "#a0b78d",
        backgroundImage: "url(/yaarRadar-assets/search_bg_wide.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center top",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="w-full relative min-h-dvh flex flex-col pb-[76px] overflow-hidden">

        {/* ── HEADER BANNER — same staircase notched-frame heading box as
            the Friends/Me pages, no icons, just "SEARCH" ──────────── */}
        <div className="relative z-10 pt-5 px-4 mx-auto w-full max-w-2xl">
          <div
            className="relative flex items-center justify-center"
            style={{ width: "100%", height: 56 }}
          >
            <NotchedFrame colors={["#8C6551", "#F3E8DB", "#bfc08e"]} step={6} ringWidth={4} />
            <h1 className="text-2xl font-bold tracking-wide" style={{ color: "#5a4632", fontFamily: "var(--font-pixel)" }}>SEARCH</h1>
          </div>
        </div>

        {/* ── OUTER PANEL — wraps the search bar and results/idle area,
            spanning down to just above the tab bar. On phones it's a framed
            card with the green pixel-art border language of the header boxes
            above, carrying its own portrait artwork; from md up the frame and
            that artwork drop away so the page's wide background is the only
            one showing. Both states live in .search-panel (globals.css) --
            they can't be inline styles, which would beat the media query. */}
        <div className="search-panel relative z-10 flex-1 flex flex-col mx-3 md:mx-auto md:w-full md:max-w-3xl mt-3 mb-2 overflow-hidden">

        {/* ── SEARCH BAR ────────────────────────────────────────────── */}
        <div className="relative z-10 px-4 pt-4 pb-2">
          {/* Search input container */}
          <div
            className="relative flex items-center justify-center bg-[#FDF5E6] rounded-xl border-[3px] border-[#6b8453]"
            style={{
              padding: "12px 16px",
              width: "100%",
            }}
          >
            <div className="flex w-full items-center gap-3">
              <svg width="24" height="24" viewBox="0 0 16 16" shapeRendering="crispEdges" className="shrink-0" style={{ imageRendering: "pixelated" }}>
                <path d="M5,2 h4 v1 h2 v2 h1 v4 h-1 v2 h-2 v1 h-4 v-1 h-2 v-2 h-1 v-4 h1 v-2 h2 z" fill="#4a6036" />
                <path d="M10,10 h2 v1 h1 v3 h-1 v1 h-2 v-1 h-1 v-3 h1 z" fill="#4a6036" />
                <path d="M6,3 h2 v1 h1 v2 h-1 v2 h-2 v-1 h-1 v-2 h1 z" fill="#e8eedb" />
                <path d="M6,4 h1 v1 h-1 z" fill="#ffffff" />
                <path d="M11,11 h1 v3 h-1 z" fill="#6b8453" />
              </svg>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find friends by username"
                className="flex-1 text-sm outline-none bg-transparent placeholder-[#8c9c7d] min-w-0"
                style={{
                  fontFamily: "var(--font-pixel)",
                  color: "#2C421C",
                  height: "100%",
                }}
              />
            </div>
          </div>
        </div>

        {/* ── CONTENT ───────────────────────────────────────────────── */}
        <div className="relative z-10 flex-1 overflow-y-auto px-5 pt-3">
          {query ? (
            <div className="flex flex-col gap-2">
              {/* Results count */}
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold" style={{ color: "#F0DEC3", fontFamily: "var(--font-pixel)", textShadow: "1px 1px 0 #2B1A0A" }}>
                  {searching ? "SEARCHING..." : `${results.length} RESULT${results.length !== 1 ? "S" : ""}`}
                </span>
              </div>

              {searching ? null : searchError ? (
                <div
                  className="text-center p-4 text-xs font-bold rounded-lg"
                  style={{ color: "#C97F80", backgroundColor: "rgba(253,246,236,0.88)", border: "2px solid #8C6B3E", fontFamily: "var(--font-pixel)" }}
                >
                  {searchError}
                </div>
              ) : results.length > 0 ? (
                results.map((resultUser) => (
                  <div key={resultUser.id} className="flex flex-col gap-1">
                    <UserRow
                      user={resultUser}
                      isFriend={friendCharacters.has(resultUser.id)}
                      characterId={friendCharacters.get(resultUser.id)}
                      requestState={user ? resolveRequestState(myRequests, user.id, resultUser.id) : "none"}
                      onSendRequest={() => sendRequest(resultUser.id)}
                      onCancelRequest={() => cancelRequest(resultUser.id)}
                      onUnfriend={() => removeFriend(resultUser.id)}
                      onViewProfile={() => setViewingUser(resultUser)}
                    />
                    {requestErrorId === resultUser.id && (
                      <p className="text-[10px] font-bold px-1" style={{ color: "#C97F80", fontFamily: "var(--font-pixel)" }}>
                        {requestErrorMessage || "Could not complete that action. Try again."}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <div
                  className="flex flex-col items-center gap-3 p-6 rounded-lg"
                  style={{ backgroundColor: "rgba(253,246,236,0.88)", border: "2px solid #8C6B3E" }}
                >
                  <p
                    className="text-xs tracking-widest"
                    style={{ color: "#8C6B3E", fontFamily: "var(--font-pixel)" }}
                  >
                    NO USER FOUND
                  </p>
                  <img
                    src="/pixelated-icons/buttons/no-user-sticker.png"
                    alt=""
                    className="w-24 h-auto"
                    style={{ imageRendering: "pixelated" }}
                  />
                </div>
              )}
            </div>
          ) : (
            /* ── IDLE STATE: character + prompt card ── */
            <div className="flex flex-col items-center justify-center gap-0 mt-8 w-full max-w-[280px] self-center mx-auto">
              
              {/* Main Cream Card Wrapper -- background/border are drawn by
                  NotchedCardFrame below, not CSS, so the corners get the
                  same pixel-stair cut as the Me page's profile card */}
              <div
                className="relative w-full flex flex-col items-center pt-8 pb-6 px-4"
                style={{ imageRendering: "pixelated" }}
              >
                <NotchedCardFrame borderColor="#3A2210" fillColor="#FDF5E6" borderWidth={4} step={10} topOnly />

                {/* Corner vines -- same corner_vine.jpg charm (and exact
                    mirroring pattern) as the Me page's profile card, on all
                    four corners instead of the old two-vine + tree cluster. */}
                <img src="/yaarRadar-assets/corner_vine.jpg" alt="" className="absolute left-3 top-3 w-16 h-16 opacity-80" style={{ mixBlendMode: "multiply", imageRendering: "pixelated", zIndex: 15 }} />
                <img src="/yaarRadar-assets/corner_vine.jpg" alt="" className="absolute right-3 top-3 w-16 h-16 opacity-80 scale-x-[-1]" style={{ mixBlendMode: "multiply", imageRendering: "pixelated", zIndex: 15 }} />
                <img src="/yaarRadar-assets/corner_vine.jpg" alt="" className="absolute right-3 bottom-3 w-16 h-16 opacity-80 scale-x-[-1] scale-y-[-1]" style={{ mixBlendMode: "multiply", imageRendering: "pixelated", zIndex: 15 }} />
                <img src="/yaarRadar-assets/corner_vine.jpg" alt="" className="absolute left-3 bottom-3 w-16 h-16 opacity-80 scale-y-[-1]" style={{ mixBlendMode: "multiply", imageRendering: "pixelated", zIndex: 15 }} />

                {/* Inner character container */}
                <div className="relative flex justify-center mb-4" style={{ width: 120, height: 140 }}>
                  {/* Question / Thinking Bubble -- this cat-in-a-box sticker
                      has no question mark of its own, unlike the earlier
                      confused-cat art, so the bubble is back. */}
                  <img
                    src="/yaarRadar-assets/question-trans.png"
                    alt="?"
                    className="absolute"
                    style={{
                      top: -10,
                      right: -30,
                      width: 50,
                      height: "auto",
                      imageRendering: "pixelated",
                      zIndex: 10,
                    }}
                  />

                  {/* Cat-in-a-box sticker */}
                  <img
                    src="/pixelated-icons/buttons/box-cat.png"
                    alt="character"
                    className="absolute"
                    style={{
                      bottom: 8,
                      width: 132,
                      height: "auto",
                      imageRendering: "pixelated",
                      objectFit: "contain",
                      zIndex: 5,
                    }}
                  />

                  {/* Sparkles */}
                  <img src="/yaarRadar-assets/sparkle-transparent.png" alt="" className="absolute top-4 left-[-10px] w-4 h-4" style={{ imageRendering: "pixelated" }} />
                  <img src="/yaarRadar-assets/sparkle-transparent.png" alt="" className="absolute top-10 right-[-15px] w-5 h-5" style={{ imageRendering: "pixelated" }} />
                  <img src="/yaarRadar-assets/sparkle-transparent.png" alt="" className="absolute bottom-10 left-[-20px] w-6 h-6" style={{ imageRendering: "pixelated" }} />
                </div>

                {/* Info text */}
                <div className="relative z-10 flex flex-col items-center mt-2 w-full">
                  <p
                    className="font-bold text-center mb-1"
                    style={{ fontFamily: "var(--font-pixel)", fontSize: 13, color: "#1A330B", letterSpacing: "0.05em" }}
                  >
                    FIND FRIENDZ!
                  </p>
                  <p
                    className="text-center"
                    style={{ fontFamily: "var(--font-pixel)", fontSize: 13, color: "#2B4719", lineHeight: 1.6 }}
                  >
                    Type their username and<br/>click find! Easy as that!
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        </div>{/* end outer panel */}

        {/* Navigation */}
        <TabBar />
      </div>

      {/* ── User profile modal ──────────────────────────────────────── */}
      {viewingUser !== null && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          onClick={() => setViewingUser(null)}
        >
          <div
            className="w-full max-w-sm relative overflow-hidden"
            style={{
              backgroundColor: "#f5eedc",
              borderStyle: "solid",
              borderWidth: 14,
              borderImageSource: "url(/pixelated-icons/buttons/popup-frame.png)",
              borderImageSlice: 55,
              borderImageRepeat: "stretch",
              imageRendering: "pixelated",
              borderRadius: 22,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-3 py-2 border-b-4 border-[#5C4528]"
              style={{ backgroundColor: "#5C4528" }}
            >
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 text-[#C2D6AD] text-lg leading-none select-none">✦</div>
                <h2 className="text-sm font-bold text-white tracking-widest" style={{ fontFamily: "var(--font-pixel)" }}>USER PROFILE</h2>
              </div>
              <button
                type="button"
                onClick={() => setViewingUser(null)}
                className="w-7 h-7 flex items-center justify-center border-[3px] border-[#5C4528] bg-[#f5eedc] rounded-md font-bold select-none active:scale-95"
                style={{ color: "#5C4528", fontFamily: "var(--font-pixel)" }}
              >
                X
              </button>
            </div>

            {/* Body */}
            <div className="p-4 flex flex-col items-center gap-1 relative">
              <div className="relative mb-2 mt-1">
                <div
                  className="w-[84px] h-[84px] rounded-full border-[3px] border-[#8C6B3E] flex items-center justify-center overflow-hidden"
                  style={{ backgroundColor: "#e8dcc8" }}
                >
                  <div
                    className="w-full h-full"
                    style={{
                      backgroundImage: `url(${
                        friendCharacters.has(viewingUser.id)
                          ? characterAvatarSrc(friendCharacters.get(viewingUser.id) ?? null)
                          : characterAvatarSrc(viewingUser.character_id)
                      })`,
                      backgroundSize: "cover",
                      backgroundPosition: avatarBackgroundPosition(
                        friendCharacters.has(viewingUser.id)
                          ? characterAvatarSrc(friendCharacters.get(viewingUser.id) ?? null)
                          : characterAvatarSrc(viewingUser.character_id)
                      ),
                      imageRendering: "pixelated",
                    }}
                  />
                </div>
              </div>

              <h3 className="text-lg font-bold mb-1" style={{ color: "#3D271D", fontFamily: "var(--font-pixel)" }}>
                {viewingUser.username}
              </h3>

              <p className="text-xs text-center px-4 mb-1" style={{ color: "#6B4731", fontFamily: "var(--font-pixel)" }}>
                {viewingUser.bio || "Just here to find my friends."}
              </p>

              <div className="flex items-center justify-center gap-3 w-full max-w-[200px] mb-1 opacity-80">
                <div className="h-[2px] flex-1 bg-[#C4A882]" />
                <div className="w-2.5 h-2.5 rotate-45 bg-[#8C6B3E]" />
                <div className="h-[2px] flex-1 bg-[#C4A882]" />
              </div>

              <div className="flex gap-4 w-full mt-2">
                {friendCharacters.has(viewingUser.id) ? (
                  <button
                    onClick={() => { removeFriend(viewingUser.id); setViewingUser(null); }}
                    className="flex-1 py-2 px-2 border-4 border-[#69312b] rounded-xl font-bold text-white tracking-widest active:scale-95 transition-transform relative overflow-hidden"
                    style={{ backgroundColor: "#d48275", fontFamily: "var(--font-pixel)" }}
                  >
                    <div className="absolute inset-1 border-[2px] border-dashed border-[#e69f94] rounded-lg pointer-events-none opacity-60" />
                    <span className="relative z-10 text-sm">UNFRIEND</span>
                  </button>
                ) : user && resolveRequestState(myRequests, user.id, viewingUser.id) === "none" ? (
                  <button
                    onClick={() => { sendRequest(viewingUser.id); setViewingUser(null); }}
                    className="flex-1 py-3 px-2 border-4 border-[#69312b] rounded-xl font-bold text-white tracking-widest active:scale-95 transition-transform relative overflow-hidden"
                    style={{ backgroundColor: "#d48275", fontFamily: "var(--font-pixel)" }}
                  >
                    <div className="absolute inset-1 border-[2px] border-dashed border-[#e69f94] rounded-lg pointer-events-none opacity-60" />
                    <span className="relative z-10 text-base">SEND REQUEST</span>
                  </button>
                ) : user && resolveRequestState(myRequests, user.id, viewingUser.id) === "sent-pending" ? (
                  <button
                    onClick={() => { cancelRequest(viewingUser.id); setViewingUser(null); }}
                    className="flex-1 py-3 px-2 border-4 border-[#69312b] rounded-xl font-bold text-white tracking-widest active:scale-95 transition-transform relative overflow-hidden"
                    style={{ backgroundColor: "#d48275", fontFamily: "var(--font-pixel)" }}
                  >
                    <div className="absolute inset-1 border-[2px] border-dashed border-[#e69f94] rounded-lg pointer-events-none opacity-60" />
                    <span className="relative z-10 text-base">UNREQUEST</span>
                  </button>
                ) : (
                  <button
                    disabled
                    className="flex-1 py-2 px-2 border-4 border-[#8c7a63] rounded-xl font-bold text-white tracking-widest relative overflow-hidden disabled:opacity-50"
                    style={{ backgroundColor: "#b5a48c", fontFamily: "var(--font-pixel)" }}
                  >
                    <div className="absolute inset-1 border-[2px] border-dashed border-[#c4b8a0] rounded-lg pointer-events-none opacity-60" />
                    <span className="relative z-10 text-sm">CHECK FRIENDS</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
