"use client";

import { useEffect, useState } from "react";
import { TabBar } from "@/components/scene/TabBar";
import { useAuth } from "@/lib/authState";
import { searchUsers, sendFriendRequest, unfriend, getFriends, ApiError, type UserSearchResult } from "@/lib/api";
import { rememberUser } from "@/lib/userDirectory";
import { characterAvatarSrc } from "@/lib/characterAvatars";
import { avatarBackgroundPosition } from "@/lib/spriteAvatar";

const GENERIC_AVATAR = "/pixelated-icons/profile-avatar.png";

function UserRow({
  user,
  isFriend,
  characterId,
  requested,
  onSendRequest,
  onUnfriend,
}: {
  user: UserSearchResult;
  isFriend: boolean;
  /** Only known when isFriend -- GET /users/search?q= itself doesn't return
   * character_id, so a non-friend result always falls back to the generic
   * icon. Friends show their real avatar because we already have this from
   * GET /friends (see friendCharacters below). */
  characterId: string | null | undefined;
  requested: boolean;
  onSendRequest: () => void;
  onUnfriend: () => void;
}) {
  const pfp = isFriend ? characterAvatarSrc(characterId) : GENERIC_AVATAR;
  return (
    <div
      className="flex items-center gap-3 p-3 border-4 border-[var(--px-border)] shadow-[4px_4px_0_var(--px-shadow)]"
      style={{ backgroundColor: "var(--px-white)" }}
    >
      <div
        className="w-10 h-10 border-2 border-[var(--px-border)] shadow-[2px_2px_0_var(--px-shadow)]"
        style={{
          backgroundColor: "#e0e0e0",
          backgroundImage: `url(${pfp})`,
          backgroundSize: "cover",
          backgroundPosition: avatarBackgroundPosition(pfp),
          imageRendering: "pixelated",
        }}
      />
      <span className="text-sm font-bold flex-1 truncate" style={{ color: "var(--px-text)" }}>
        {user.username}
      </span>
      {isFriend ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onUnfriend();
          }}
          className="px-btn px-btn-sm px-btn-ghost"
        >
          UNFRIEND
        </button>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSendRequest();
          }}
          disabled={requested}
          className={`px-btn px-btn-sm ${requested ? "px-btn-ghost" : "px-btn-dark"}`}
        >
          {requested ? "REQUESTED" : "SEND REQUEST"}
        </button>
      )}
    </div>
  );
}

export default function SearchPage() {
  const { accessToken } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());
  const [requestErrorId, setRequestErrorId] = useState<string | null>(null);
  // id -> character_id, for anyone you're already friends with -- lets a
  // search result for a friend show UNFRIEND (instead of SEND REQUEST) and
  // their real avatar (instead of the generic icon), since GET /friends
  // gives us character_id but GET /users/search?q= doesn't.
  const [friendCharacters, setFriendCharacters] = useState<Map<string, string | null>>(new Map());

  useEffect(() => {
    if (!accessToken) return;
    getFriends(accessToken)
      .then((friends) => setFriendCharacters(new Map(friends.map((f) => [f.id, f.character_id]))))
      .catch(() => {
        // Leave it empty -- worst case a friend briefly shows SEND REQUEST,
        // which the backend would 409 harmlessly anyway.
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
          found.forEach((u) => rememberUser(u.id, u.username));
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
      await sendFriendRequest(accessToken, id);
      setRequestedIds((prev) => new Set(prev).add(id));
    } catch (err) {
      // 409 means a request between you two already exists either
      // direction -- treat that as "already requested" too rather than an
      // error, since functionally it is.
      if (err instanceof ApiError && err.status === 409) {
        setRequestedIds((prev) => new Set(prev).add(id));
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
    } catch {
      setRequestErrorId(id);
    }
  };

  return (
    <div className="flex flex-1 justify-center" style={{ backgroundColor: "var(--px-border)" }}>
      <div className="w-full max-w-md relative min-h-dvh flex flex-col pb-[68px] overflow-hidden">

        {/* Decorative road-texture background, grayscaled to stay black/white */}
        <div className="absolute inset-0 z-0 px-bg-road" aria-hidden />

        {/* Header - white panel, black text only, no color accents */}
        <div className="relative z-10 p-4 border-b-4 border-[var(--px-border)] shadow-[0_4px_0_var(--px-shadow)]" style={{ backgroundColor: "var(--px-white)" }}>
          <h1 className="text-xl font-bold mb-4" style={{ color: "var(--px-text)", textShadow: "2px 2px 0 var(--px-shadow)" }}>SEARCH</h1>

          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find friends by username..."
              className="w-full p-3 pl-10 border-4 border-[var(--px-border)] text-sm shadow-[4px_4px_0_var(--px-shadow)] outline-none focus:shadow-[2px_2px_0_var(--px-shadow)] focus:translate-x-[2px] focus:translate-y-[2px] transition-all placeholder-gray-600"
              style={{ fontFamily: "var(--font-pixel)", backgroundColor: "var(--px-white)", color: "var(--px-text)" }}
            />
            <span className="absolute left-3 top-3.5 text-xl px-icon px-icon-search" style={{ color: "var(--px-text)" }} aria-hidden></span>
          </div>
        </div>

        {/* Content - road-photo background shows through behind the cards */}
        <div className="relative z-10 flex-1 overflow-y-auto p-4">
          {query ? (
            <div>
              <h2 className="text-sm mb-3" style={{ color: "var(--px-white)", textShadow: "2px 2px 0 var(--px-shadow)" }}>RESULTS</h2>
              {searching ? (
                <div className="text-center p-8 text-sm" style={{ color: "var(--px-white)" }}>Searching...</div>
              ) : searchError ? (
                <div className="text-center p-8 text-sm font-bold" style={{ color: "var(--px-red)" }}>{searchError}</div>
              ) : results.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {results.map((user) => (
                    <div key={user.id} className="flex flex-col gap-1">
                      <UserRow
                        user={user}
                        isFriend={friendCharacters.has(user.id)}
                        characterId={friendCharacters.get(user.id)}
                        requested={requestedIds.has(user.id)}
                        onSendRequest={() => sendRequest(user.id)}
                        onUnfriend={() => removeFriend(user.id)}
                      />
                      {requestErrorId === user.id && (
                        <p className="text-[10px] font-bold px-1" style={{ color: "var(--px-red)" }}>
                          Could not complete that action. Try again.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-8 text-sm" style={{ color: "var(--px-white)" }}>No users found.</div>
              )}
            </div>
          ) : (
            <div className="text-center p-8 text-sm" style={{ color: "var(--px-white)" }}>
              Search for a friend by their username.
            </div>
          )}
        </div>

        {/* Navigation */}
        <TabBar />
      </div>
    </div>
  );
}
