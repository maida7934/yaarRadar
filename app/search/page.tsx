"use client";

import { useEffect, useState, type ReactNode, type CSSProperties } from "react";
import { TabBar } from "@/components/scene/TabBar";
import { PixelButton } from "@/components/ui/PixelButton";
import { useAuth } from "@/lib/authState";
import {
  searchUsers,
  sendFriendRequest,
  unfriend,
  getFriends,
  getFriendRequests,
  ApiError,
  type UserSearchResult,
  type FriendRequest,
} from "@/lib/api";
import { rememberUser } from "@/lib/userDirectory";
import { characterAvatarSrc } from "@/lib/characterAvatars";
import { avatarBackgroundPosition } from "@/lib/spriteAvatar";

const GENERIC_AVATAR = "/pixelated-icons/profile-avatar.png";

// Same soft pastel palette as the Friends page -- deliberately page-local
// so it doesn't leak through globals.css.
const SKY_TOP = "#bfe3f5";
const SKY_BOTTOM = "#f7ecd9";
const CARD = "#fdf6ec";
const BORDER = "#e0bd8f";
const TEXT_DARK = "#5a4632";
const TEXT_MUTED = "#a68a6d";
const PINK_DARK = "#d97891";
const RED = "#d9776a";

// Declining clears the request row server-side (same as unfriending does),
// so a past decline never blocks a fresh send either direction -- only a
// currently-*pending* request changes what the button should do (nothing
// to send, or go respond on Friends).
type RequestState = "none" | "sent-pending" | "incoming-pending";

function resolveRequestState(requests: FriendRequest[], myId: string, otherId: string): RequestState {
  const existing = requests.find((r) => r.sender_id === otherId || r.receiver_id === otherId);
  if (!existing || existing.status !== "pending") return "none";
  return existing.sender_id === myId ? "sent-pending" : "incoming-pending";
}

// Pixel-art pill button, same style as the Friends page's RequestPillButton.
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
        color: pressed && !disabled ? pressedTextColor : TEXT_DARK,
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
  onUnfriend,
  onViewProfile,
}: {
  user: UserSearchResult;
  isFriend: boolean;
  characterId: string | null | undefined;
  requestState: RequestState;
  onSendRequest: () => void;
  onUnfriend: () => void;
  onViewProfile: () => void;
}) {
  const pfp = isFriend ? characterAvatarSrc(characterId) : GENERIC_AVATAR;
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
            style={{ width: 72, height: 28 }}
          >
            UNFRIEND
          </ActionPillButton>
        ) : requestState === "sent-pending" ? (
          <ActionPillButton
            normalSrc="/pixelated-icons/request-btn-a.png"
            pressedSrc="/pixelated-icons/request-btn-a-pressed.png"
            pressedTextColor="#ffffff"
            onClick={() => {}}
            disabled
            style={{ width: 80, height: 28 }}
          >
            REQUESTED
          </ActionPillButton>
        ) : requestState === "incoming-pending" ? (
          <ActionPillButton
            normalSrc="/pixelated-icons/request-btn-a.png"
            pressedSrc="/pixelated-icons/request-btn-a-pressed.png"
            pressedTextColor="#ffffff"
            onClick={() => {}}
            disabled
            style={{ width: 80, height: 28, fontSize: 7 }}
          >
            CHECK FRIENDS
          </ActionPillButton>
        ) : (
          <ActionPillButton
            normalSrc="/pixelated-icons/request-btn-a.png"
            pressedSrc="/pixelated-icons/request-btn-a-pressed.png"
            pressedTextColor="#ffffff"
            onClick={onSendRequest}
            style={{ width: 90, height: 28 }}
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
  const [viewingUser, setViewingUser] = useState<UserSearchResult | null>(null);

  // id -> character_id, for anyone you're already friends with -- lets a
  // search result for a friend show UNFRIEND (instead of a request button)
  // and their real avatar (instead of the generic icon), since GET /friends
  // gives us character_id but GET /users/search?q= doesn't.
  const [friendCharacters, setFriendCharacters] = useState<Map<string, string | null>>(new Map());
  // Every request row involving you, any status/direction -- see
  // RequestState above for why this needs to be known upfront.
  const [myRequests, setMyRequests] = useState<FriendRequest[]>([]);

  useEffect(() => {
    if (!accessToken) return;
    getFriends(accessToken)
      .then((friends) => setFriendCharacters(new Map(friends.map((f) => [f.id, f.character_id]))))
      .catch(() => {
        // Leave it empty -- worst case a friend briefly shows SEND REQUEST,
        // which the backend would 409 harmlessly anyway.
      });
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    getFriendRequests(accessToken)
      .then(setMyRequests)
      .catch(() => {
        // Leave it empty -- worst case a dead-end request briefly shows
        // SEND REQUEST and 409s when actually tried.
      });
  }, [accessToken]);

  // Debounced live search -- GET /users/search?q= on every keystroke would
  // be excessive.
  useEffect(() => {
    if (!query.trim() || !accessToken) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    setSearchError(null);

    const timeout = setTimeout(() => {
      searchUsers(accessToken, query.trim())
        .then((found) => {
          if (cancelled) return;
          setResults(found);
          // Cache id->username for anyone we can now see -- lets a later
          // incoming friend request from them resolve to a real name
          // instead of "Unknown user" (see lib/userDirectory.ts for why
          // that's needed at all).
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
    try {
      const created = await sendFriendRequest(accessToken, id);
      setMyRequests((prev) => [...prev, created]);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Re-sync from the source of truth rather than assuming success --
        // declining clears its own history server-side, so this should be
        // rare (e.g. a genuinely still-pending request myRequests hadn't
        // caught up to yet), not the dead end it used to be.
        try {
          setMyRequests(await getFriendRequests(accessToken));
        } catch {
          setRequestErrorId(id);
        }
        return;
      }
      setRequestErrorId(id);
    }
  };

  const removeFriend = async (id: string) => {
    if (!accessToken) return;
    setRequestErrorId(null);
    try {
      await unfriend(accessToken, id);
      setFriendCharacters((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      // Unfriending clears request history server-side (see CLAUDE.md), so
      // drop any stale row we had for this pair too.
      setMyRequests((prev) => prev.filter((r) => r.sender_id !== id && r.receiver_id !== id));
    } catch {
      setRequestErrorId(id);
    }
  };

  return (
    <div className="flex flex-1 justify-center" style={{ backgroundColor: BORDER }}>
      <div className="w-full max-w-md relative min-h-dvh flex flex-col pb-[68px] overflow-hidden">

        {/* Soft sky-to-cream gradient, same as Friends page */}
        <div
          className="absolute inset-0 z-0"
          style={{ background: `linear-gradient(180deg, ${SKY_TOP} 0%, ${SKY_BOTTOM} 45%, ${SKY_BOTTOM} 100%)` }}
          aria-hidden
        />

        {/* Header */}
        <div
          className="relative z-10 p-6 flex flex-col gap-5"
        >
          <div className="flex items-center justify-center -mx-6">
            <div
              className="flex items-center justify-center"
              style={{
                backgroundImage: "url(/pixelated-icons/buttons/heading-banner.png)",
                backgroundSize: "100% 100%",
                backgroundRepeat: "no-repeat",
                imageRendering: "pixelated",
                width: "100%",
                aspectRatio: "804 / 100",
              }}
            >
              <h1 className="text-2xl font-bold tracking-wide" style={{ color: TEXT_DARK }}>SEARCH</h1>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find friends by username..."
              className="w-full p-3 pl-10 text-sm outline-none transition-all placeholder-[#b89f7e]"
              style={{
                fontFamily: "var(--font-pixel)",
                backgroundColor: "#fff8ee",
                color: TEXT_DARK,
                border: `3px solid ${BORDER}`,
                borderRadius: 10,
                boxShadow: `3px 3px 0 ${BORDER}`,
              }}
            />
            <span
              className="absolute left-3 top-3.5 text-xl px-icon px-icon-search"
              style={{ color: TEXT_MUTED }}
              aria-hidden
            ></span>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-icon px-icon-search" style={{ color: PINK_DARK, width: 20, height: 20 }} aria-hidden></span>
            <span style={{ color: PINK_DARK, fontWeight: 700, fontSize: 14 }}>
              {query ? `${results.length} RESULTS` : "FIND FRIENDS"}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10 flex-1 overflow-y-auto p-4">
          {query ? (
            <div>
              {searching ? (
                <div className="text-center p-8 text-sm" style={{ color: TEXT_MUTED }}>Searching...</div>
              ) : searchError ? (
                <div className="text-center p-8 text-sm font-bold" style={{ color: RED }}>{searchError}</div>
              ) : results.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {results.map((resultUser) => (
                    <div key={resultUser.id} className="flex flex-col gap-1">
                      <UserRow
                        user={resultUser}
                        isFriend={friendCharacters.has(resultUser.id)}
                        characterId={friendCharacters.get(resultUser.id)}
                        requestState={user ? resolveRequestState(myRequests, user.id, resultUser.id) : "none"}
                        onSendRequest={() => sendRequest(resultUser.id)}
                        onUnfriend={() => removeFriend(resultUser.id)}
                        onViewProfile={() => setViewingUser(resultUser)}
                      />
                      {requestErrorId === resultUser.id && (
                        <p className="text-[10px] font-bold px-1" style={{ color: RED }}>
                          Could not complete that action. Try again.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-8 text-sm" style={{ color: TEXT_MUTED }}>No users found.</div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 gap-4">
              <img
                src="/pixelated-icons/search.png"
                alt=""
                className="w-12 h-12 opacity-30"
                style={{ imageRendering: "pixelated" }}
              />
              <p className="text-sm text-center" style={{ color: TEXT_MUTED }}>
                Search for a friend by their username.
              </p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <TabBar />
      </div>

      {/* User profile modal, same popup-frame as Friends page */}
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
              className="flex items-center justify-between px-3 py-2 border-b-4 border-[#2c394c]"
              style={{ backgroundColor: "#2c394c" }}
            >
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 text-[#97afc7] text-lg leading-none select-none">✦</div>
                <h2 className="text-sm font-bold text-white tracking-widest">USER PROFILE</h2>
              </div>
              <button
                type="button"
                onClick={() => setViewingUser(null)}
                className="w-7 h-7 flex items-center justify-center border-[3px] border-[#2c394c] bg-[#f5eedc] rounded-md text-[#2c394c] font-bold select-none active:scale-95"
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

              <h3 className="text-lg font-bold mb-1" style={{ color: "#2c394c", fontFamily: "var(--font-pixel)" }}>
                {viewingUser.username}
              </h3>

              <p className="text-xs text-center px-4 mb-1" style={{ color: "#2c394c" }}>
                {viewingUser.bio || "No bio provided"}
              </p>

              {/* Divider */}
              <div className="flex items-center justify-center gap-3 w-full max-w-[200px] mb-1 opacity-80">
                <div className="h-[2px] flex-1 bg-[#d5cbb8]"></div>
                <div className="w-2.5 h-2.5 rotate-45 bg-[#749270]"></div>
                <div className="h-[2px] flex-1 bg-[#d5cbb8]"></div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-4 w-full mt-2">
                {friendCharacters.has(viewingUser.id) ? (
                  <button
                    onClick={() => {
                      removeFriend(viewingUser.id);
                      setViewingUser(null);
                    }}
                    className="flex-1 py-2 px-2 border-4 border-[#69312b] rounded-xl font-bold text-white tracking-widest active:scale-95 transition-transform relative overflow-hidden"
                    style={{ backgroundColor: "#d48275", fontFamily: "var(--font-pixel)" }}
                  >
                    <div className="absolute inset-1 border-[2px] border-dashed border-[#e69f94] rounded-lg pointer-events-none opacity-60"></div>
                    <span className="relative z-10 text-sm">UNFRIEND</span>
                  </button>
                ) : user && resolveRequestState(myRequests, user.id, viewingUser.id) === "none" ? (
                  <button
                    onClick={() => {
                      sendRequest(viewingUser.id);
                      setViewingUser(null);
                    }}
                    className="flex-1 py-2 px-2 border-4 border-[#314a38] rounded-xl font-bold text-white tracking-widest active:scale-95 transition-transform relative overflow-hidden"
                    style={{ backgroundColor: "#749270", fontFamily: "var(--font-pixel)" }}
                  >
                    <div className="absolute inset-1 border-[2px] border-dashed border-[#8eb488] rounded-lg pointer-events-none opacity-60"></div>
                    <span className="relative z-10 text-sm">SEND REQUEST</span>
                  </button>
                ) : (
                  <button
                    disabled
                    className="flex-1 py-2 px-2 border-4 border-[#8c7a63] rounded-xl font-bold text-white tracking-widest relative overflow-hidden disabled:opacity-50"
                    style={{ backgroundColor: "#b5a48c", fontFamily: "var(--font-pixel)" }}
                  >
                    <div className="absolute inset-1 border-[2px] border-dashed border-[#c4b8a0] rounded-lg pointer-events-none opacity-60"></div>
                    <span className="relative z-10 text-sm">
                      {user && resolveRequestState(myRequests, user.id, viewingUser.id) === "sent-pending"
                        ? "REQUESTED"
                        : "CHECK FRIENDS"}
                    </span>
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
