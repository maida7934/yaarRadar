"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { TabBar } from "@/components/scene/TabBar";
import { PixelButton } from "@/components/ui/PixelButton";
import { NotchedFrame } from "@/components/ui/NotchedFrame";
import { avatarBackgroundPosition } from "@/lib/spriteAvatar";
import { characterAvatarSrc } from "@/lib/characterAvatars";
import { lookupUser } from "@/lib/userDirectory";
import { useAuth } from "@/lib/authState";
import {
  ApiError,
  getFriends,
  getFriendRequests,
  acceptFriendRequest,
  declineFriendRequest,
  unfriend,
  type Friend,
} from "@/lib/api";

// Soft pastel palette for this page only -- deliberately not touched in
// globals.css/TabBar/PixelModal, which every other page still relies on, so
// this reskin can't leak anywhere else.
const SKY_BOTTOM = "#e9f5da";
const PAGE_OUTER_BG = "#c3dba0";
const CARD = "#fdf6ec";
const BORDER = "#e0bd8f";
const TEXT_DARK = "#5a4632";
const TEXT_MUTED = "#a68a6d";
const PINK_DARK = "#d97891";
const RED = "#d9776a";

/** A rectangle with a 2-step pixel staircase cut into each corner, as an SVG
 * `points` string -- same notched-corner language as the "MY PROFILE"
 * banner on the Me page, ported here so the FRIENDS title bar can use it
 * too. */
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

/** Notched-corner banner background, sized to its own parent via
 * ResizeObserver -- a stack of concentric filled rings, same technique as
 * the "MY PROFILE" banner on the Me page (nested notchedRectPoints
 * polygons, outer to inner). `colors` goes outer -> inner; the last color
 * is the FRIENDS bar's own existing fill, kept unchanged, with the brownish
 * Me-page rings wrapped around the outside of it. */
function NotchedBanner({ colors, step = 6, ringWidth = 4 }: { colors: string[]; step?: number; ringWidth?: number }) {
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
          {colors.map((color, i) => {
            const inset = i * ringWidth;
            return (
              <polygon
                key={i}
                points={notchedRectPoints(inset, inset, size.width - inset * 2, size.height - inset * 2, step)}
                fill={color}
              />
            );
          })}
        </svg>
      )}
    </div>
  );
}

// GET /friends/requests only returns sender_id/receiver_id (raw ids), no
// username -- confirmed against the live backend, there's no endpoint to
// resolve an arbitrary user id back to a name. `username` here is
// best-effort, from lib/userDirectory's local cache of anyone you've
// searched before; "Unknown user" otherwise.
interface DisplayRequest {
  id: string;
  senderId: string;
  username: string;
  characterId: string | null;
  bio?: string | null;
  createdAt: string;
}

// Same row structure as Search page's UserRow (avatar + name on the left,
// action button(s) on the right, one bordered line) instead of the
// standalone card art -- but with the pixel-art pill buttons above instead
// of plain .px-btn text buttons, and a circular avatar.
function RequestRow({
  username,
  pfp,
  onAccept,
  onDecline,
  disabled,
  onViewProfile,
}: {
  username: string;
  pfp: string;
  onAccept: () => void;
  onDecline: () => void;
  disabled: boolean;
  onViewProfile: () => void;
}) {
  return (
    <div
      className="flex items-center gap-2 p-2"
      style={{ backgroundColor: CARD, border: `3px solid ${BORDER}`, borderRadius: 10, boxShadow: `3px 3px 0 ${BORDER}` }}
    >
      <button type="button" onClick={onViewProfile} className="flex items-center gap-2 flex-1 min-w-0 text-left">
        <div
          className="w-10 h-10 shrink-0 rounded-full"
          style={{
            backgroundColor: "#e0e0e0",
            backgroundImage: `url(${pfp})`,
            backgroundSize: "cover",
            backgroundPosition: avatarBackgroundPosition(pfp),
            imageRendering: "pixelated",
            border: `2px solid ${BORDER}`,
          }}
        />
        <span className="text-sm font-bold flex-1 truncate" style={{ color: TEXT_DARK }}>
          {username}
        </span>
      </button>
      <div className="flex gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onAccept}
          disabled={disabled}
          className="flex items-center justify-center text-[9px] font-bold uppercase shrink-0"
          style={{
            width: 60,
            height: 28,
            fontFamily: "var(--font-pixel)",
            color: "#ffffff",
            backgroundColor: "#749270",
            border: "2px solid #314a38",
            borderRadius: 6,
            opacity: disabled ? 0.5 : 1,
          }}
        >
          ACCEPT
        </button>
        <button
          type="button"
          onClick={onDecline}
          disabled={disabled}
          className="flex items-center justify-center text-[9px] font-bold uppercase shrink-0"
          style={{
            width: 60,
            height: 28,
            fontFamily: "var(--font-pixel)",
            color: "#ffffff",
            backgroundColor: "#d48275",
            border: "2px solid #69312b",
            borderRadius: 6,
            opacity: disabled ? 0.5 : 1,
          }}
        >
          DECLINE
        </button>
      </div>
    </div>
  );
}

export default function FriendsPage() {
  const { accessToken, user } = useAuth();
  const [tab, setTab] = useState<"friends" | "requests">("friends");

  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [friendsError, setFriendsError] = useState<string | null>(null);

  const [requests, setRequests] = useState<DisplayRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsError, setRequestsError] = useState<string | null>(null);

  const [viewingRequest, setViewingRequest] = useState<DisplayRequest | null>(null);
  const [viewingFriend, setViewingFriend] = useState<Friend | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const loadFriends = useCallback(() => {
    if (!accessToken) return;
    setFriendsLoading(true);
    setFriendsError(null);
    getFriends(accessToken)
      .then(setFriends)
      .catch((err) => setFriendsError(err instanceof ApiError ? err.message : "Could not load friends."))
      .finally(() => setFriendsLoading(false));
  }, [accessToken]);

  const loadRequests = useCallback(() => {
    if (!accessToken || !user) return;
    setRequestsLoading(true);
    setRequestsError(null);
    getFriendRequests(accessToken)
      .then((all) => {
        const incoming = all.filter((r) => r.receiver_id === user.id && r.status === "pending");
        setRequests(
          incoming.map((r) => {
            // other_user (id/username/character_id/bio) is the real thing
            // now -- the local userDirectory guess is only a fallback for
            // the (should be rare) case that field is ever missing.
            const known = lookupUser(r.sender_id);
            return {
              id: r.id,
              senderId: r.sender_id,
              username: r.other_user?.username ?? known?.username ?? "Unknown user",
              characterId: r.other_user?.character_id ?? known?.characterId ?? null,
              bio: r.other_user?.bio ?? known?.bio ?? null,
              createdAt: r.created_at,
            };
          }),
        );
      })
      .catch((err) => setRequestsError(err instanceof ApiError ? err.message : "Could not load requests."))
      .finally(() => setRequestsLoading(false));
  }, [accessToken, user]);

  useEffect(() => {
    queueMicrotask(() => {
      loadFriends();
      loadRequests();
    });
  }, [loadFriends, loadRequests]);

  const respond = async (id: string, action: "accept" | "decline") => {
    if (!accessToken) return;
    setRespondingId(id);
    try {
      if (action === "accept") {
        await acceptFriendRequest(accessToken, id);
        loadFriends(); // accepting creates the mutual pairing server-side
      } else {
        await declineFriendRequest(accessToken, id);
      }
      setRequests((prev) => prev.filter((r) => r.id !== id));
      setViewingRequest((current) => (current?.id === id ? null : current));
    } catch {
      // Leave the request in the list -- the buttons are still there to retry.
    } finally {
      setRespondingId(null);
    }
  };

  const handleUnfriend = async (friendId: string) => {
    if (!accessToken) return;
    try {
      await unfriend(accessToken, friendId);
      setViewingFriend(null);
      loadFriends();
    } catch (err) {
      console.error("Failed to unfriend", err);
    }
  };

  return (
    <div className="flex flex-1 justify-center" style={{ backgroundColor: PAGE_OUTER_BG }}>
      <div className="w-full max-w-md relative min-h-dvh flex flex-col pb-[76px] overflow-hidden" style={{ backgroundColor: SKY_BOTTOM }}>

        {/* Page background -- tiled striped pattern, repeated at a smaller
            tile size than its native 736x920 so the stripes read as a
            texture rather than one giant stretched image. */}
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: "url(/yaarRadar-assets/friendsbg.jpg)",
            backgroundSize: "cover",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center top",
          }}
          aria-hidden
        />

        {/* Header */}
        <div
          className="relative z-10 p-6 flex flex-col gap-2"
        >
          <div className="flex items-center justify-center">
            <div
              className="relative flex items-center justify-center"
              style={{ width: "100%", height: 56 }}
            >
              <NotchedBanner colors={["#8C6551", "#F3E8DB", "#bfc08e"]} step={6} ringWidth={4} />
              <h1 className="text-2xl font-bold tracking-wide" style={{ color: TEXT_DARK }}>FRIENDS</h1>
            </div>
          </div>

          <div className="flex items-center justify-center" style={{ marginTop: -6 }}>
          <div
            className="relative flex flex-col gap-3 p-4"
            style={{
              width: "100%",
              backgroundColor: "#d4ecb9",
              border: "3px solid #6b8453",
              boxShadow: "inset 0 0 0 2px #eaf5db",
              imageRendering: "pixelated",
              minHeight: "138px",
              borderRadius: 16,
            }}
          >
            <div className="flex items-center gap-2">
              <span className="px-icon px-icon-friends" style={{ color: PINK_DARK, width: 20, height: 20 }} aria-hidden></span>
              <span style={{ color: PINK_DARK, fontWeight: 700, fontSize: 14 }}>{friends.length} FRIENDS</span>
            </div>

            {/* flex-1 so this row (and the buttons in it) grow to fill the
                extra height added to the card above, rather than the
                buttons being given a taller height of their own. */}
            <div className="flex gap-3 flex-1 items-stretch">
              <div className="relative flex-1 flex">
                <PixelButton
                  variant={tab === "friends" ? "primary" : "secondary"}
                  onClick={() => setTab("friends")}
                  className="w-full h-full gap-2"
                  style={{ fontSize: 13 }}
                >
                  <img
                    src="/pixelated-icons/buttons/nav-friends-new.png"
                    alt=""
                    style={{ imageRendering: "pixelated", flexShrink: 0, width: 20, height: 26, marginLeft: -4 }}
                  />
                  FRIENDS
                </PixelButton>
              </div>
              <div className="relative flex-1 flex">
                <PixelButton
                  variant={tab === "requests" ? "primary" : "secondary"}
                  onClick={() => setTab("requests")}
                  className="w-full h-full gap-2"
                  style={{ fontSize: 13 }}
                >
                  <img src="/pixelated-icons/mail.png" alt="" className="w-5 h-5" style={{ imageRendering: "pixelated", flexShrink: 0 }} />
                  VIEW REQUESTS
                </PixelButton>
                {requests.length > 0 && (
                  <span
                    className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1 flex items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ backgroundColor: PINK_DARK, border: "2px solid #fdf6ec" }}
                  >
                    {requests.length}
                  </span>
                )}
              </div>
            </div>
          </div>
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10 flex-1 overflow-y-auto p-4">
          {tab === "friends" ? (
            friendsLoading ? (
              <div className="text-center p-8 text-sm" style={{ color: TEXT_MUTED }}>Loading...</div>
            ) : friendsError ? (
              <div className="text-center p-8 text-sm font-bold" style={{ color: RED }}>{friendsError}</div>
            ) : friends.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {friends.map((friend) => {
                  const pfp = characterAvatarSrc(friend.character_id);
                  return (
                    <button
                      key={friend.id}
                      type="button"
                      onClick={() => setViewingFriend(friend)}
                      className="relative flex flex-col items-center pt-5 pb-4 px-3 cursor-[url('/pixelated-icons/cursor.png')_5_1,_pointer]"
                      style={{
                        backgroundColor: "#fcf6ed",
                        borderStyle: "solid",
                        borderWidth: 14,
                        borderImageSource: "url(/pixelated-icons/buttons/friend-card-frame.png)",
                        borderImageSlice: 40,
                        borderImageRepeat: "stretch",
                        imageRendering: "pixelated",
                        borderRadius: 16,
                        boxShadow: "3px 3px 0 #e6d6b8",
                      }}
                    >
                      <span
                        className="absolute top-0 left-0 w-5 h-5"
                        style={{
                          backgroundImage: `url(/pixelated-icons/buttons/status-ball-${(friend.is_online ?? true) ? "green" : "red"}.png)`,
                          backgroundSize: "100% 100%",
                          backgroundRepeat: "no-repeat",
                          imageRendering: "pixelated",
                        }}
                        aria-hidden
                      />
                      
                      <div
                        className="w-[84px] h-[84px] rounded-full flex items-center justify-center overflow-hidden mb-3 relative"
                        style={{
                          backgroundColor: "#efe0c8",
                          border: "3px solid #8C6551",
                        }}
                      >
                         <div
                          className="w-full h-full"
                          style={{
                            backgroundImage: `url(${pfp})`,
                            backgroundSize: "cover",
                            backgroundPosition: avatarBackgroundPosition(pfp),
                            imageRendering: "pixelated",
                          }}
                        />
                      </div>
                      
                      <div className="flex items-center gap-2 mb-3">
                         <span className="text-[#8C6551] text-sm leading-none select-none">✦</span>
                         <span
                           className="text-lg font-bold text-center truncate max-w-[100px]"
                           style={{ color: "#59493c", fontFamily: "var(--font-pixel)" }}
                         >
                           {friend.username}
                         </span>
                         <span className="text-[#8C6551] text-sm leading-none select-none">✦</span>
                      </div>
                      
                      <div
                        className="flex items-center justify-center gap-2 w-[110px] py-1.5 px-3 rounded-full relative overflow-hidden"
                        style={
                          (friend.is_online ?? true)
                            ? { backgroundColor: "#749270", border: "2px solid #314a38" }
                            : { backgroundColor: "#d48275", border: "2px solid #69312b" }
                        }
                      >
                         {/* Sparkles inside pill */}
                         <div className="absolute left-1.5 top-1/2 -translate-y-1/2 text-white opacity-40 text-[9px] select-none">✦</div>
                         <div className="absolute right-1.5 top-1/2 -translate-y-1/2 text-white opacity-40 text-[9px] select-none">✦</div>
                         
                         <span className="text-white text-[11px] font-bold tracking-wide shrink-0" style={{ fontFamily: "var(--font-pixel)" }}>
                           {(friend.is_online ?? true) ? "Online" : "Offline"}
                         </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center p-8 text-sm" style={{ color: TEXT_MUTED }}>No friends yet.</div>
            )
          ) : requestsLoading ? (
            <div className="text-center p-8 text-sm" style={{ color: TEXT_MUTED }}>Loading...</div>
          ) : requestsError ? (
            <div className="text-center p-8 text-sm font-bold" style={{ color: RED }}>{requestsError}</div>
          ) : requests.length > 0 ? (
            <div className="flex flex-col gap-4">
              {requests.map((req) => (
                <RequestRow
                  key={req.id}
                  username={req.username}
                  pfp={characterAvatarSrc(req.characterId)}
                  disabled={respondingId === req.id}
                  onAccept={() => respond(req.id, "accept")}
                  onDecline={() => respond(req.id, "decline")}
                  onViewProfile={() => setViewingRequest(req)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center p-8 text-sm" style={{ color: TEXT_MUTED }}>No pending requests.</div>
          )}
        </div>

        {/* Navigation -- shared component, untouched so Home/Me/Search keep the same tab bar */}
        <TabBar />
      </div>

      {/* Account details sub-window, opened from a request row's profile area */}
      {viewingRequest !== null && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          onClick={() => setViewingRequest(null)}
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
              className="flex items-center justify-between px-3 py-2 border-b-4 border-[#8C6551]"
              style={{ backgroundColor: "#bfc08e" }}
            >
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 text-[#8C6551] text-lg leading-none select-none">✦</div>
                <h2 className="text-sm font-bold tracking-widest" style={{ color: "#5a4632" }}>ACCOUNT DETAILS</h2>
              </div>
              <button
                type="button"
                onClick={() => setViewingRequest(null)}
                className="w-7 h-7 flex items-center justify-center border-[3px] border-[#5a4632] bg-[#f5eedc] rounded-md text-[#5a4632] font-bold select-none active:scale-95"
                style={{ fontFamily: "var(--font-pixel)" }}
              >
                X
              </button>
            </div>

            {/* Body */}
            <div className="p-4 flex flex-col items-center gap-1 relative">
              {/* Avatar section */}
              <div className="relative mb-2 mt-1">
                 {/* Sparkles */}
                 <div className="absolute -left-6 top-1/2 -translate-y-1/2 text-[#97afc7] text-lg select-none">✦</div>
                 <div className="absolute -right-6 top-1/2 -translate-y-1/2 text-[#97afc7] text-lg select-none">✦</div>

                 <div
                   className="w-[72px] h-[72px] rounded-full border-[3px] border-[#97afc7] flex items-center justify-center overflow-hidden"
                   style={{ backgroundColor: "#d6def0" }}
                 >
                    <div
                      className="w-full h-full"
                      style={{
                        backgroundImage: `url(${characterAvatarSrc(viewingRequest.characterId)})`,
                        backgroundSize: "cover",
                        backgroundPosition: avatarBackgroundPosition(characterAvatarSrc(viewingRequest.characterId)),
                        imageRendering: "pixelated",
                      }}
                    />
                 </div>
              </div>

              <h3 className="text-lg font-bold mb-1" style={{ color: "#2c394c", fontFamily: "var(--font-pixel)" }}>
                {viewingRequest.username}
              </h3>

              <p className="text-xs text-center px-4 mb-1" style={{ color: "#2c394c" }}>
                {viewingRequest.bio || "No bio provided"}
              </p>

              {/* Divider */}
              <div className="flex items-center justify-center gap-3 w-full max-w-[200px] mb-1 opacity-80">
                <div className="h-[2px] flex-1 bg-[#d5cbb8]"></div>
                <div className="w-2.5 h-2.5 rotate-45 bg-[#749270]"></div>
                <div className="h-[2px] flex-1 bg-[#d5cbb8]"></div>
              </div>

              <p className="text-xs font-bold mb-3" style={{ color: "#8c8277" }}>
                Requested {new Date(viewingRequest.createdAt).toLocaleDateString("en-GB")}
              </p>

              {/* Buttons */}
              <div className="flex gap-4 w-full">
                <button
                  onClick={() => respond(viewingRequest.id, "accept")}
                  disabled={respondingId === viewingRequest.id}
                  className="flex-1 py-2 px-2 border-4 border-[#314a38] rounded-xl font-bold text-white tracking-widest active:scale-95 transition-transform disabled:opacity-50 relative overflow-hidden"
                  style={{ backgroundColor: "#749270", fontFamily: "var(--font-pixel)" }}
                >
                  {/* Inner decoration border */}
                  <div className="absolute inset-1 border-[2px] border-dashed border-[#8eb488] rounded-lg pointer-events-none opacity-60"></div>
                  <span className="relative z-10 text-sm">ACCEPT</span>
                </button>
                <button
                  onClick={() => respond(viewingRequest.id, "decline")}
                  disabled={respondingId === viewingRequest.id}
                  className="flex-1 py-2 px-2 border-4 border-[#69312b] rounded-xl font-bold text-white tracking-widest active:scale-95 transition-transform disabled:opacity-50 relative overflow-hidden"
                  style={{ backgroundColor: "#d48275", fontFamily: "var(--font-pixel)" }}
                >
                  {/* Inner decoration border */}
                  <div className="absolute inset-1 border-[2px] border-dashed border-[#e69f94] rounded-lg pointer-events-none opacity-60"></div>
                  <span className="relative z-10 text-sm">DECLINE</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Friend profile sub-window, opened from the Friends grid */}
      {viewingFriend !== null && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          onClick={() => setViewingFriend(null)}
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
              className="flex items-center justify-between px-3 py-2 border-b-4 border-[#8C6551]"
              style={{ backgroundColor: "#bfc08e" }}
            >
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 text-[#8C6551] text-lg leading-none select-none">✦</div>
                <h2 className="text-sm font-bold tracking-widest" style={{ color: "#5a4632" }}>FRIEND PROFILE</h2>
              </div>
              <button
                type="button"
                onClick={() => setViewingFriend(null)}
                className="w-7 h-7 flex items-center justify-center border-[3px] border-[#5a4632] bg-[#f5eedc] rounded-md text-[#5a4632] font-bold select-none active:scale-95"
                style={{ fontFamily: "var(--font-pixel)" }}
              >
                X
              </button>
            </div>

            {/* Body */}
            <div className="p-4 flex flex-col items-center gap-1 relative">
              {/* Avatar section */}
              <div className="relative mb-2 mt-1">
                 {/* Sparkles */}
                 <div className="absolute -left-6 top-1/2 -translate-y-1/2 text-[#97afc7] text-lg select-none">✦</div>
                 <div className="absolute -right-6 top-1/2 -translate-y-1/2 text-[#97afc7] text-lg select-none">✦</div>

                 <div
                   className="w-[72px] h-[72px] rounded-full border-[3px] border-[#97afc7] flex items-center justify-center overflow-hidden"
                   style={{ backgroundColor: "#d6def0" }}
                 >
                    <div
                      className="w-full h-full"
                      style={{
                        backgroundImage: `url(${characterAvatarSrc(viewingFriend.character_id)})`,
                        backgroundSize: "cover",
                        backgroundPosition: avatarBackgroundPosition(characterAvatarSrc(viewingFriend.character_id)),
                        imageRendering: "pixelated",
                      }}
                    />
                 </div>
              </div>

              <h3 className="text-lg font-bold mb-1" style={{ color: "#2c394c", fontFamily: "var(--font-pixel)" }}>
                {viewingFriend.username}
              </h3>

              {viewingFriend.bio && (
                <p className="text-xs text-center px-4 mb-1" style={{ color: "#2c394c" }}>
                  {viewingFriend.bio}
                </p>
              )}

              {/* Divider */}
              <div className="flex items-center justify-center gap-3 w-full max-w-[200px] mb-1 opacity-80">
                <div className="h-[2px] flex-1 bg-[#d5cbb8]"></div>
                <div className="w-2.5 h-2.5 rotate-45 bg-[#749270]"></div>
                <div className="h-[2px] flex-1 bg-[#d5cbb8]"></div>
              </div>

              <div className="flex gap-4 w-full mt-2">
                <button
                  onClick={() => handleUnfriend(viewingFriend.id)}
                  className="flex-1 py-2 px-2 border-4 border-[#69312b] rounded-xl font-bold text-white tracking-widest active:scale-95 transition-transform relative overflow-hidden"
                  style={{ backgroundColor: "#d48275", fontFamily: "var(--font-pixel)" }}
                >
                  <div className="absolute inset-1 border-[2px] border-dashed border-[#e69f94] rounded-lg pointer-events-none opacity-60"></div>
                  <span className="relative z-10 text-sm">UNFRIEND</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
