"use client";

import { useState, type ReactNode } from "react";
import { TabBar } from "@/components/scene/TabBar";
import { PixelModal } from "@/components/ui/PixelModal";
import { MOCK_FRIENDS as FRIENDS } from "@/lib/mockFriends";
import { avatarBackgroundPosition } from "@/lib/spriteAvatar";

// Mock data — mirrors GET /friends/requests filtered to incoming (receiver = you),
// plus a couple of extra profile-only fields for the account details popup.
const INCOMING_REQUESTS = [
  { id: "r1", username: "MoonWalker", pfp: "/sprites-hat/chibi-down-idle.png", age: "19", bio: "Night owl, always exploring." },
  { id: "r2", username: "GhostRider", pfp: "/sprites-officer/chibi-down-idle.png", age: "31", bio: "On patrol. Say hi if you see me." },
];

type IncomingRequest = (typeof INCOMING_REQUESTS)[number];

function AvatarRow({
  username,
  pfp,
  onViewProfile,
  children,
}: {
  username: string;
  pfp: string;
  onViewProfile: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="flex items-center gap-3 p-3 border-4 border-[var(--px-border)] shadow-[4px_4px_0_var(--px-shadow)]"
      style={{ backgroundColor: "var(--px-white)" }}
    >
      <button type="button" onClick={onViewProfile} className="flex items-center gap-3 flex-1 min-w-0 text-left">
        <div
          className="w-10 h-10 border-2 border-[var(--px-border)] shadow-[2px_2px_0_var(--px-shadow)] shrink-0"
          style={{
            backgroundColor: "#e0e0e0",
            backgroundImage: `url(${pfp})`,
            backgroundSize: "cover",
            backgroundPosition: avatarBackgroundPosition(pfp),
            imageRendering: "pixelated",
          }}
        />
        <span className="text-sm font-bold flex-1 truncate" style={{ color: "var(--px-text)" }}>
          {username}
        </span>
      </button>
      {children}
    </div>
  );
}

export default function FriendsPage() {
  const [tab, setTab] = useState<"friends" | "requests">("friends");
  const [requests, setRequests] = useState(INCOMING_REQUESTS);
  const [viewingRequest, setViewingRequest] = useState<IncomingRequest | null>(null);

  const respond = (id: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== id));
    setViewingRequest((current) => (current?.id === id ? null : current));
  };

  return (
    <div className="flex flex-1 justify-center" style={{ backgroundColor: "var(--px-border)" }}>
      <div className="w-full max-w-md relative min-h-dvh flex flex-col pb-[68px] overflow-hidden">

        {/* Decorative road-texture background, grayscaled to stay black/white */}
        <div className="absolute inset-0 z-0 px-bg-road" aria-hidden />

        {/* Header - white panel, black text only, no color accents */}
        <div className="relative z-10 p-4 border-b-4 border-[var(--px-border)] shadow-[0_4px_0_var(--px-shadow)] flex flex-col gap-3" style={{ backgroundColor: "var(--px-white)" }}>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--px-text)", textShadow: "2px 2px 0 var(--px-shadow)" }}>FRIENDS</h1>
            <p className="text-[10px] mt-2" style={{ color: "var(--px-muted)" }}>{FRIENDS.length} FRIENDS</p>
          </div>

          <div className="px-segment">
            <button className={tab === "friends" ? "active" : ""} onClick={() => setTab("friends")}>
              FRIENDS
            </button>
            <button className={tab === "requests" ? "active" : ""} onClick={() => setTab("requests")}>
              VIEW REQUESTS{requests.length > 0 ? ` (${requests.length})` : ""}
            </button>
          </div>
        </div>

        {/* Content - road-photo background shows through behind the grid/list */}
        <div className="relative z-10 flex-1 overflow-y-auto p-4">
          {tab === "friends" ? (
            FRIENDS.length > 0 ? (
              <div className="grid grid-cols-3 gap-y-6 gap-x-2">
                {FRIENDS.map((friend) => (
                  <div key={friend.id} className="flex flex-col items-center gap-2 cursor-[url('/pixel-cursor.png')_11_1,_pointer]">
                    <div
                      className="px-avatar-circle w-16 h-16"
                      style={{
                        backgroundColor: "#e0e0e0",
                        backgroundImage: `url(${friend.pfp})`,
                        // Idle sprites are a single full-body portrait (78x130), not a
                        // frame strip -- "cover" + anchoring near the top crops in on the
                        // head/face instead of squishing the whole body into the circle.
                        backgroundSize: "cover",
                        backgroundPosition: avatarBackgroundPosition(friend.pfp),
                      }}
                    />
                    <span
                      className="text-[10px] font-bold text-center truncate w-full"
                      style={{ color: "var(--px-white)", textShadow: "1px 1px 0 var(--px-shadow)" }}
                    >
                      {friend.username}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-8 text-sm" style={{ color: "var(--px-white)" }}>No friends yet.</div>
            )
          ) : requests.length > 0 ? (
            <div className="flex flex-col gap-3">
              {requests.map((req) => (
                <AvatarRow key={req.id} username={req.username} pfp={req.pfp} onViewProfile={() => setViewingRequest(req)}>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => respond(req.id)}
                      className="px-btn px-btn-sm px-btn-dark"
                    >
                      ACCEPT
                    </button>
                    <button
                      type="button"
                      onClick={() => respond(req.id)}
                      className="px-btn px-btn-sm px-btn-ghost"
                    >
                      DECLINE
                    </button>
                  </div>
                </AvatarRow>
              ))}
            </div>
          ) : (
            <div className="text-center p-8 text-sm" style={{ color: "var(--px-white)" }}>No pending requests.</div>
          )}
        </div>

        {/* Navigation */}
        <TabBar />
      </div>

      {/* Account details sub-window, opened from a request row's profile area */}
      <PixelModal
        open={viewingRequest !== null}
        title="ACCOUNT DETAILS"
        onClose={() => setViewingRequest(null)}
      >
        {viewingRequest && (
          <>
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-24 h-24 border-4 border-[var(--px-border)] shadow-[4px_4px_0_var(--px-shadow)]"
                style={{
                  backgroundColor: "#e0e0e0",
                  backgroundImage: `url(${viewingRequest.pfp})`,
                  backgroundSize: "cover",
                  backgroundPosition: avatarBackgroundPosition(viewingRequest.pfp),
                  imageRendering: "pixelated",
                }}
              />
              <h3 className="text-base font-bold" style={{ color: "var(--px-text)" }}>{viewingRequest.username}</h3>
              <p className="text-xs" style={{ color: "var(--px-muted)" }}>Age {viewingRequest.age}</p>
              <p className="text-xs text-center" style={{ color: "var(--px-text)" }}>{viewingRequest.bio}</p>
            </div>
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => respond(viewingRequest.id)}
                className="px-btn px-btn-dark flex-1 p-3"
                style={{ fontSize: 11 }}
              >
                ACCEPT
              </button>
              <button
                type="button"
                onClick={() => respond(viewingRequest.id)}
                className="px-btn px-btn-ghost flex-1 p-3"
                style={{ fontSize: 11 }}
              >
                DECLINE
              </button>
            </div>
          </>
        )}
      </PixelModal>
    </div>
  );
}
