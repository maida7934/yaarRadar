"use client";

import { useState } from "react";
import { TabBar } from "@/components/scene/TabBar";
import { avatarBackgroundPosition } from "@/lib/spriteAvatar";

// Mock data for search
const ALL_USERS = [
  { id: "1", username: "PixelPete", pfp: "/sprites/chibi-down-idle.png" },
  { id: "2", username: "RetroRanger", pfp: "/sprites/chibi-left-idle.png" },
  { id: "3", username: "ChibiChan", pfp: "/sprites-purple/chibi-down-idle.png" },
  { id: "4", username: "CodeNinja", pfp: "/sprites/chibi-right-idle.png" },
  { id: "5", username: "StarGazer", pfp: "/sprites-purple/chibi-left-idle.png" },
];

type SearchUser = { id: string; username: string; pfp: string };

function UserRow({
  user,
  requested,
  onSendRequest,
}: {
  user: SearchUser;
  requested: boolean;
  onSendRequest: () => void;
}) {
  return (
    <div
      className="flex items-center gap-3 p-3 border-4 border-[var(--px-border)] shadow-[4px_4px_0_var(--px-shadow)]"
      style={{ backgroundColor: "var(--px-white)" }}
    >
      <div
        className="w-10 h-10 border-2 border-[var(--px-border)] shadow-[2px_2px_0_var(--px-shadow)]"
        style={{
          backgroundColor: "#e0e0e0",
          backgroundImage: `url(${user.pfp})`,
          // Idle sprites are a single full-body portrait (78x130), not a
          // frame strip -- "cover" + anchoring near the top crops in on the
          // head/face instead of squishing the whole body into the square.
          backgroundSize: "cover",
          backgroundPosition: avatarBackgroundPosition(user.pfp),
          imageRendering: "pixelated",
        }}
      />
      <span className="text-sm font-bold flex-1 truncate" style={{ color: "var(--px-text)" }}>
        {user.username}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSendRequest();
        }}
        disabled={requested}
        className={`px-btn px-btn-sm ${requested ? "px-btn-ghost" : "px-btn-dark"}`}
      >
        {requested ? "INVITED" : "SEND INVITE"}
      </button>
    </div>
  );
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState([
    { id: "6", username: "MagicMike", pfp: "/sprites/chibi-up-idle.png" },
    { id: "7", username: "PixelPioneer", pfp: "/sprites-purple/chibi-right-idle.png" },
  ]);
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());

  const sendRequest = (id: string) => {
    setRequestedIds((prev) => new Set(prev).add(id));
  };

  const filteredUsers = query
    ? ALL_USERS.filter((u) => u.username.toLowerCase().includes(query.toLowerCase()))
    : [];

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
              placeholder="Find friends..."
              className="w-full p-3 pl-10 border-4 border-[var(--px-border)] text-sm shadow-[4px_4px_0_var(--px-shadow)] outline-none focus:shadow-[2px_2px_0_var(--px-shadow)] focus:translate-x-[2px] focus:translate-y-[2px] transition-all placeholder-gray-600"
              style={{ fontFamily: "var(--font-pixel)", backgroundColor: "var(--px-white)", color: "var(--px-text)" }}
            />
            <span className="absolute left-3 top-3.5 text-xl px-icon px-icon-search" style={{ color: "var(--px-text)" }} aria-hidden></span>
          </div>
        </div>

        {/* Content - road-photo background shows through behind the cards */}
        <div className="relative z-10 flex-1 overflow-y-auto p-4">

          {query ? (
            // Search Results
            <div>
              <h2 className="text-sm mb-3" style={{ color: "var(--px-white)", textShadow: "2px 2px 0 var(--px-shadow)" }}>RESULTS</h2>
              {filteredUsers.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {filteredUsers.map((user) => (
                    <UserRow
                      key={user.id}
                      user={user}
                      requested={requestedIds.has(user.id)}
                      onSendRequest={() => sendRequest(user.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center p-8 text-sm" style={{ color: "var(--px-white)" }}>No users found.</div>
              )}
            </div>
          ) : (
            // Recent Searches
            <div>
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-sm" style={{ color: "var(--px-white)", textShadow: "2px 2px 0 var(--px-shadow)" }}>RECENT</h2>
                {recent.length > 0 && (
                  <button
                    onClick={() => setRecent([])}
                    className="text-[10px] underline hover:opacity-60"
                    style={{ color: "var(--px-white)" }}
                  >
                    CLEAR ALL
                  </button>
                )}
              </div>

              {recent.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {recent.map((user) => (
                    <UserRow
                      key={user.id}
                      user={user}
                      requested={requestedIds.has(user.id)}
                      onSendRequest={() => sendRequest(user.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center p-8 text-sm" style={{ color: "var(--px-white)" }}>No recent searches.</div>
              )}
            </div>
          )}

        </div>

        {/* Navigation */}
        <TabBar />
      </div>
    </div>
  );
}
