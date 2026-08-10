"use client";

import { useState } from "react";
import { TabBar } from "@/components/scene/TabBar";
import { PixelModal } from "@/components/ui/PixelModal";
import { avatarBackgroundPosition } from "@/lib/spriteAvatar";
import { useAuth } from "@/lib/authState";
import { useCharacter } from "@/lib/characterState";

const CHARACTER_OPTIONS = [
  { id: "default", label: "Classic", pfp: "/sprites/chibi-down-idle.png" },
  { id: "purple", label: "Purple", pfp: "/sprites-purple/chibi-down-idle.png" },
  { id: "hat", label: "Hat Girl", pfp: "/sprites-hat/chibi-down-idle.png" },
  { id: "officer", label: "Officer", pfp: "/sprites-officer/chibi-down-idle.png" },
];

const BACKGROUND_OPTIONS = [
  { id: "road", label: "Stone Road" },
  { id: "grass", label: "Grass Field" },
];

type ActiveModal = "profile" | "layout" | null;

interface ProfileMetadata {
  name?: string;
  age?: string;
  bio?: string;
}

export default function MePage() {
  const { user, logOut, updateProfile } = useAuth();
  const { characterId, setCharacterId, loading: characterLoading } = useCharacter();
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [layoutTab, setLayoutTab] = useState<"character" | "background">("character");

  // Source of truth is the account's own Supabase user record
  // (user_metadata) -- see lib/authState.tsx's updateProfile for why (the
  // backend has no field for these). Falls back to placeholder copy for a
  // freshly-signed-up account that's never set any of this yet.
  const metadata = (user?.user_metadata ?? {}) as ProfileMetadata;
  const name = metadata.name ?? "PlayerOne";
  const age = metadata.age ?? "24";
  const bio = metadata.bio ?? "Just here to find my friends.";

  // Draft copies for the modal's inputs -- only committed to the account on
  // SAVE, reset from the real values each time the modal opens.
  const [draftName, setDraftName] = useState(name);
  const [draftAge, setDraftAge] = useState(age);
  const [draftBio, setDraftBio] = useState(bio);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const openProfileModal = () => {
    setDraftName(name);
    setDraftAge(age);
    setDraftBio(bio);
    setProfileError(null);
    setActiveModal("profile");
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    setProfileError(null);
    try {
      await updateProfile({ name: draftName, age: draftAge, bio: draftBio });
      setActiveModal(null);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Could not save. Try again.");
    } finally {
      setSavingProfile(false);
    }
  };

  const [backgroundId, setBackgroundId] = useState("road");

  const activeCharacter = CHARACTER_OPTIONS.find((c) => c.id === characterId) ?? CHARACTER_OPTIONS[0];
  // Last resort only -- characterLoading is true just for a first-ever
  // login on this browser (nothing cached yet, see lib/characterState.tsx),
  // where we genuinely don't know the real pick. Showing this generic icon
  // instead of the default sprite avoids implying "default" is the answer.
  const avatarPfp = characterLoading ? "/pixelated-icons/profile-avatar.png" : activeCharacter.pfp;

  return (
    <div className="flex flex-1 justify-center" style={{ backgroundColor: "var(--px-border)" }}>
      <div className="w-full max-w-md relative min-h-dvh flex flex-col pb-[68px] overflow-hidden">

        {/* Decorative road-texture background, grayscaled to stay black/white */}
        <div className="absolute inset-0 z-0 px-bg-road" aria-hidden />

        {/* Header - white panel, black text only, no color accents */}
        <div className="relative z-10 p-4 border-b-4 border-[var(--px-border)] shadow-[0_4px_0_var(--px-shadow)]" style={{ backgroundColor: "var(--px-white)" }}>
          <h1 className="text-xl font-bold text-center" style={{ color: "var(--px-text)", textShadow: "2px 2px 0 var(--px-shadow)" }}>MY PROFILE</h1>
        </div>

        {/* Content - road-photo background shows through behind the cards */}
        <div className="relative z-10 flex-1 overflow-y-auto p-5 flex flex-col gap-6">

          {/* Profile Card */}
          <div className="p-4 border-4 border-[var(--px-border)] shadow-[4px_4px_0_var(--px-shadow)] text-center flex flex-col items-center gap-4" style={{ backgroundColor: "var(--px-white)" }}>

            <div
              className="w-24 h-24 border-4 border-[var(--px-border)] shadow-[4px_4px_0_var(--px-shadow)] relative"
              style={{
                backgroundColor: "#e0e0e0",
                backgroundImage: `url(${avatarPfp})`,
                // Idle sprites are a single full-body portrait (78x130), not a
                // frame strip -- "cover" + anchoring near the top crops in on the
                // head/face instead of squishing the whole body into the square.
                backgroundSize: "cover",
                backgroundPosition: avatarBackgroundPosition(avatarPfp),
                imageRendering: "pixelated",
              }}
            />

            <div>
              <h2 className="text-lg font-bold" style={{ color: "var(--px-text)" }}>{name}</h2>
              <p className="text-xs mt-1" style={{ color: "var(--px-muted)" }}>{bio}</p>
            </div>

          </div>

          {/* Settings Options */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-bold" style={{ color: "var(--px-white)", textShadow: "2px 2px 0 var(--px-shadow)" }}>OPTIONS</h3>

            <div className="flex flex-col gap-3">
              <button
                onClick={openProfileModal}
                className="px-btn px-btn-ghost w-full justify-start p-4 text-left"
                style={{ fontSize: 12 }}
              >
                <span className="px-icon px-icon-me mr-2" aria-hidden></span> EDIT PROFILE
              </button>

              <button
                onClick={() => setActiveModal("layout")}
                className="px-btn px-btn-ghost w-full justify-start p-4 text-left"
                style={{ fontSize: 12 }}
              >
                <span className="px-icon px-icon-friends mr-2" aria-hidden></span> CHANGE LAYOUT
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="flex flex-col gap-3 mt-4">
            <button className="px-btn px-btn-dark w-full p-4" style={{ fontSize: 12 }} onClick={logOut}>
              LOG OUT
            </button>
          </div>

        </div>

        {/* Navigation */}
        <TabBar />
      </div>

      {/* Edit Profile sub-window */}
      <PixelModal open={activeModal === "profile"} title="EDIT PROFILE" onClose={() => setActiveModal(null)}>
        <label className="flex flex-col gap-1">
          <span className="text-[10px]" style={{ color: "var(--px-muted)" }}>NAME</span>
          <input className="px-input" value={draftName} onChange={(e) => setDraftName(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px]" style={{ color: "var(--px-muted)" }}>AGE</span>
          <input className="px-input" type="number" value={draftAge} onChange={(e) => setDraftAge(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px]" style={{ color: "var(--px-muted)" }}>BIO</span>
          <input className="px-input" value={draftBio} onChange={(e) => setDraftBio(e.target.value)} />
        </label>
        {profileError && (
          <p className="text-[10px] font-bold" style={{ color: "var(--px-red)" }}>{profileError}</p>
        )}
        <button
          className="px-btn px-btn-dark w-full p-3 mt-2"
          style={{ fontSize: 11 }}
          onClick={saveProfile}
          disabled={savingProfile}
        >
          {savingProfile ? "..." : "SAVE"}
        </button>
      </PixelModal>

      {/* Change Layout sub-window */}
      <PixelModal open={activeModal === "layout"} title="CHANGE LAYOUT" onClose={() => setActiveModal(null)}>
        <div className="px-segment">
          <button
            className={layoutTab === "character" ? "active" : ""}
            onClick={() => setLayoutTab("character")}
          >
            CHARACTER
          </button>
          <button
            className={layoutTab === "background" ? "active" : ""}
            onClick={() => setLayoutTab("background")}
          >
            BACKGROUND
          </button>
        </div>

        {layoutTab === "character" ? (
          <div className="grid grid-cols-2 gap-3">
            {CHARACTER_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => {
                  setCharacterId(option.id).catch(() => {
                    // Reverted optimistically inside setCharacterId already --
                    // nothing further to do here yet (no toast system).
                  });
                }}
                className="flex flex-col items-center gap-2 p-2 border-4"
                style={{
                  borderColor: "var(--px-border)",
                  backgroundColor: option.id === characterId ? "var(--px-text)" : "var(--px-white)",
                }}
              >
                <div
                  className="w-14 h-14 border-2 border-[var(--px-border)]"
                  style={{
                    backgroundColor: "#e0e0e0",
                    backgroundImage: `url(${option.pfp})`,
                    backgroundSize: "cover",
                    backgroundPosition: avatarBackgroundPosition(option.pfp),
                    imageRendering: "pixelated",
                  }}
                />
                <span
                  className="text-[10px] font-bold"
                  style={{ color: option.id === characterId ? "var(--px-white)" : "var(--px-text)" }}
                >
                  {option.label}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {BACKGROUND_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => setBackgroundId(option.id)}
                className="flex items-center gap-3 p-3 border-4"
                style={{
                  borderColor: "var(--px-border)",
                  backgroundColor: option.id === backgroundId ? "var(--px-text)" : "var(--px-white)",
                }}
              >
                <div
                  className={`w-10 h-10 border-2 border-[var(--px-border)] ${option.id === "road" ? "px-bg-road" : ""}`}
                  style={option.id === "grass" ? { backgroundImage: "url(/backgrounds/ground-tile.png)", backgroundSize: "cover" } : undefined}
                />
                <span
                  className="text-xs font-bold"
                  style={{ color: option.id === backgroundId ? "var(--px-white)" : "var(--px-text)" }}
                >
                  {option.label}
                </span>
              </button>
            ))}
          </div>
        )}
      </PixelModal>
    </div>
  );
}
