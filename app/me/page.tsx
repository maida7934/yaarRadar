"use client";

import { useEffect, useState } from "react";
import { TabBar } from "@/components/scene/TabBar";
import { avatarBackgroundPosition } from "@/lib/spriteAvatar";
import { useAuth } from "@/lib/authState";
import { useCharacter } from "@/lib/characterState";
import { CHARACTER_OPTIONS } from "@/lib/characterAvatars";
import { getMe, updateMe } from "@/lib/api";

const BACKGROUND_OPTIONS = [
  { id: "road", label: "Stone Road" },
  { id: "grass", label: "Grass Field" },
];

type ActiveModal = "profile" | "layout" | null;

const GENDER_OPTIONS = ["Alpha", "Beta", "Other"];

interface ProfileMetadata {
  name?: string;
  gender?: string;
}

export default function MePage() {
  const { user, accessToken, logOut, updateProfile } = useAuth();
  const { characterId, setCharacterId, loading: characterLoading } = useCharacter();
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [layoutTab, setLayoutTab] = useState<"character" | "background">("character");

  // Name/gender still live on the account's own Supabase user record
  // (user_metadata) -- see lib/authState.tsx's updateProfile for why (the
  // backend still has no field for either). Falls back to placeholder copy
  // for a freshly-signed-up account that's never set any of this yet.
  const metadata = (user?.user_metadata ?? {}) as ProfileMetadata;
  const name = metadata.name ?? "PlayerOne";
  const gender = metadata.gender ?? GENDER_OPTIONS[0];

  // Bio, unlike name/age, is a real backend field now (PATCH/GET
  // /users/me) -- it's what makes it visible to other people on Friends,
  // so it has to actually be the backend's copy, not something only this
  // account's own Supabase session can see.
  const [bio, setBio] = useState("Just here to find my friends.");
  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    getMe(accessToken)
      .then((profile) => {
        if (!cancelled && profile.bio) setBio(profile.bio);
      })
      .catch(() => {
        // Leave the placeholder -- Edit Profile still works locally even
        // if this fetch fails.
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  // Draft copies for the modal's inputs -- only committed to the account on
  // SAVE, reset from the real values each time the modal opens.
  const [draftName, setDraftName] = useState(name);
  const [draftGender, setDraftGender] = useState(gender);
  const [draftBio, setDraftBio] = useState(bio);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const openProfileModal = () => {
    setDraftName(name);
    setDraftGender(gender);
    setDraftBio(bio);
    setProfileError(null);
    setActiveModal("profile");
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    setProfileError(null);
    try {
      await updateProfile({ name: draftName, gender: draftGender });
      if (accessToken) {
        // characterId is a required field on this endpoint even when only
        // bio is actually changing (confirmed live) -- resend the current
        // pick unchanged rather than making the caller re-specify it.
        const updated = await updateMe(accessToken, { characterId, bio: draftBio });
        setBio(updated.bio ?? draftBio);
      }
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
    <div className="flex flex-1 justify-center" style={{ backgroundColor: "#e0bd8f" }}>
      <div className="w-full max-w-md relative min-h-dvh flex flex-col pb-[68px] overflow-hidden" style={{ backgroundColor: "#f7ecd9" }}>

        {/* Header */}
        <div className="relative z-10 p-4 flex items-center justify-center">
          <div
            className="flex items-center justify-center"
            style={{
              width: "95%",
              height: 56,
              backgroundColor: "#bfc08e",
              backgroundImage: "url(/pixelated-icons/buttons/heading-banner.png)",
              backgroundSize: "100% 100%",
              backgroundRepeat: "no-repeat",
              imageRendering: "pixelated",
              borderRadius: 16,
            }}
          >
            <h1 className="text-xl font-bold tracking-wide" style={{ color: "var(--px-text)" }}>MY PROFILE</h1>
          </div>
        </div>

        {/* Content - road-photo background shows through behind the cards */}
        <div className="relative z-10 flex-1 overflow-y-auto p-5 flex flex-col gap-6">

          {/* Profile Card */}
          <div
            className="p-4 text-center flex flex-col items-center gap-4 self-center"
            style={{
              width: "95%",
              backgroundColor: "var(--px-white)",
              borderStyle: "solid",
              borderWidth: 14,
              borderImageSource: "url(/pixelated-icons/buttons/popup-frame.png)",
              borderImageSlice: 55,
              borderImageRepeat: "stretch",
              imageRendering: "pixelated",
              borderRadius: 18,
            }}
          >

            <div
              className="w-24 h-24 relative"
              style={{
                backgroundImage: `url(${avatarPfp})`,
                // Idle sprites are a single full-body portrait (78x130), not a
                // frame strip -- "cover" + anchoring near the top crops in on the
                // head/face instead of squishing the whole body into the square.
                backgroundSize: "cover",
                backgroundPosition: avatarBackgroundPosition(avatarPfp),
                imageRendering: "pixelated",
                borderStyle: "solid",
                borderWidth: 10,
                borderImageSource: "url(/pixelated-icons/buttons/avatar-frame.png)",
                borderImageSlice: 38,
                borderImageRepeat: "stretch",
              }}
            />

            <div>
              <h2 className="text-lg font-bold" style={{ color: "var(--px-text)" }}>{name}</h2>
              <p className="text-xs mt-1" style={{ color: "var(--px-muted)" }}>{bio}</p>
            </div>

          </div>

          {/* Settings Options */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-bold" style={{ color: "var(--px-text)" }}>OPTIONS</h3>

            <div className="flex flex-col gap-3">
              <button
                onClick={openProfileModal}
                className="w-full flex items-center gap-3 p-4 text-left"
                style={{
                  backgroundImage: "url(/pixelated-icons/buttons/option-btn-edit-profile.png)",
                  backgroundSize: "100% 100%",
                  backgroundRepeat: "no-repeat",
                  imageRendering: "pixelated",
                  border: "none",
                }}
              >
                <span className="px-icon px-icon-me shrink-0" style={{ color: "#4a5a35" }} aria-hidden></span>
                <span className="flex-1 text-xs font-bold tracking-wide" style={{ color: "#3e4a2c", fontFamily: "var(--font-pixel)" }}>
                  EDIT PROFILE
                </span>
                <span className="text-lg font-bold shrink-0" style={{ color: "#4a5a35" }}>&rsaquo;</span>
              </button>

              <button
                onClick={() => setActiveModal("layout")}
                className="w-full flex items-center gap-3 p-4 text-left"
                style={{
                  backgroundImage: "url(/pixelated-icons/buttons/option-btn-change-layout.png)",
                  backgroundSize: "100% 100%",
                  backgroundRepeat: "no-repeat",
                  imageRendering: "pixelated",
                  border: "none",
                }}
              >
                <span className="px-icon px-icon-friends shrink-0" style={{ color: "#344068" }} aria-hidden></span>
                <span className="flex-1 text-xs font-bold tracking-wide" style={{ color: "#2b3557", fontFamily: "var(--font-pixel)" }}>
                  CHANGE LAYOUT
                </span>
                <span className="text-lg font-bold shrink-0" style={{ color: "#344068" }}>&rsaquo;</span>
              </button>

              <button
                onClick={logOut}
                className="w-full flex items-center gap-3 p-4 text-left"
                style={{
                  backgroundImage: "url(/pixelated-icons/buttons/option-btn-logout.png)",
                  backgroundSize: "100% 100%",
                  backgroundRepeat: "no-repeat",
                  imageRendering: "pixelated",
                  border: "none",
                }}
              >
                <span className="w-[22px] shrink-0" aria-hidden></span>
                <span className="flex-1 text-xs font-bold tracking-wide" style={{ color: "#7a2422", fontFamily: "var(--font-pixel)" }}>
                  LOG OUT
                </span>
                <span className="text-lg font-bold shrink-0" style={{ color: "#8f2a28" }}>&rsaquo;</span>
              </button>
            </div>
          </div>

        </div>

        {/* Navigation */}
        <TabBar />
      </div>

      {/* Edit Profile sub-window -- same box/frame resources as the Friends
          page's Account Details / Friend Profile popups (popup-frame.png,
          dark navy header bar, pill-green save button). */}
      {activeModal === "profile" && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          onClick={() => setActiveModal(null)}
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
                <h2 className="text-sm font-bold text-white tracking-widest">EDIT PROFILE</h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-7 h-7 flex items-center justify-center border-[3px] border-[#2c394c] bg-[#f5eedc] rounded-md text-[#2c394c] font-bold select-none active:scale-95"
                style={{ fontFamily: "var(--font-pixel)" }}
              >
                X
              </button>
            </div>

            {/* Body */}
            <div className="p-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold" style={{ color: "#8c8277" }}>NAME</span>
                <input className="px-input" value={draftName} onChange={(e) => setDraftName(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold" style={{ color: "#8c8277" }}>GENDER</span>
                <select className="px-input" value={draftGender} onChange={(e) => setDraftGender(e.target.value)}>
                  {GENDER_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold" style={{ color: "#8c8277" }}>BIO</span>
                <input className="px-input" value={draftBio} onChange={(e) => setDraftBio(e.target.value)} />
              </label>
              {profileError && (
                <p className="text-[10px] font-bold" style={{ color: "#d9776a" }}>{profileError}</p>
              )}
              <button
                type="button"
                onClick={saveProfile}
                disabled={savingProfile}
                className="w-full py-2 px-2 mt-1 border-4 border-[#314a38] rounded-xl font-bold text-white tracking-widest active:scale-95 transition-transform disabled:opacity-50 relative overflow-hidden"
                style={{ backgroundColor: "#749270", fontFamily: "var(--font-pixel)" }}
              >
                <div className="absolute inset-1 border-[2px] border-dashed border-[#8eb488] rounded-lg pointer-events-none opacity-60"></div>
                <span className="relative z-10 text-sm">{savingProfile ? "..." : "SAVE"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Layout sub-window -- same box/frame resources as the Edit
          Profile popup (popup-frame.png, dark navy header bar, green SAVE
          pill button). */}
      {activeModal === "layout" && (
      <div
        className="fixed inset-0 z-40 flex items-center justify-center p-4"
        style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
        onClick={() => setActiveModal(null)}
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
              <h2 className="text-sm font-bold text-white tracking-widest">CHANGE LAYOUT</h2>
            </div>
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="w-7 h-7 flex items-center justify-center border-[3px] border-[#2c394c] bg-[#f5eedc] rounded-md text-[#2c394c] font-bold select-none active:scale-95"
              style={{ fontFamily: "var(--font-pixel)" }}
            >
              X
            </button>
          </div>

          {/* Body */}
          <div className="p-4 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
        <div
          className="flex gap-1.5 p-1.5"
          style={{
            backgroundImage: "url(/pixelated-icons/buttons/layout-toggle-box.png)",
            backgroundSize: "100% 100%",
            backgroundRepeat: "no-repeat",
            imageRendering: "pixelated",
          }}
        >
          <button
            type="button"
            onClick={() => setLayoutTab("character")}
            className="flex-1 py-2 rounded-lg text-xs font-bold tracking-wide"
            style={{
              fontFamily: "var(--font-pixel)",
              color: "var(--px-text)",
              backgroundColor: layoutTab === "character" ? "#adc2cf" : "transparent",
              border: "none",
            }}
          >
            CHARACTER
          </button>
          <button
            type="button"
            onClick={() => setLayoutTab("background")}
            className="flex-1 py-2 rounded-lg text-xs font-bold tracking-wide"
            style={{
              fontFamily: "var(--font-pixel)",
              color: "var(--px-text)",
              backgroundColor: layoutTab === "background" ? "#adc2cf" : "transparent",
              border: "none",
            }}
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
                className="flex flex-col items-center gap-2 p-3"
                style={{
                  backgroundColor: option.id === characterId ? "#adc2cf" : "var(--px-white)",
                  borderStyle: "solid",
                  borderWidth: 8,
                  borderImageSource: "url(/pixelated-icons/buttons/character-card-frame.png)",
                  borderImageSlice: 30,
                  borderImageRepeat: "stretch",
                  imageRendering: "pixelated",
                  borderRadius: 10,
                }}
              >
                <div
                  className="w-16 h-16 p-1 flex items-center justify-center mt-3"
                  style={{
                    backgroundColor: "var(--px-white)",
                    border: "2px solid #4a6b8a",
                    borderRadius: 6,
                  }}
                >
                  <div
                    className="w-full h-full"
                    style={{
                      backgroundImage: `url(${option.pfp})`,
                      backgroundSize: "cover",
                      backgroundPosition: avatarBackgroundPosition(option.pfp),
                      imageRendering: "pixelated",
                    }}
                  />
                </div>
                <span
                  className="text-[10px] font-bold"
                  style={{ color: "var(--px-text)" }}
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
                className="flex items-center gap-3 p-3"
                style={{
                  backgroundColor: option.id === backgroundId ? "#adc2cf" : "var(--px-white)",
                  backgroundImage: "url(/pixelated-icons/buttons/background-choice-box.png)",
                  backgroundSize: "100% 100%",
                  backgroundRepeat: "no-repeat",
                  imageRendering: "pixelated",
                  borderRadius: 16,
                }}
              >
                <div
                  className={`w-10 h-10 border-2 border-[var(--px-border)] ${option.id === "road" ? "px-bg-road" : ""}`}
                  style={option.id === "grass" ? { backgroundImage: "url(/backgrounds/ground-tile.png)", backgroundSize: "cover" } : undefined}
                />
                <span
                  className="text-xs font-bold"
                  style={{ color: "var(--px-text)" }}
                >
                  {option.label}
                </span>
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => setActiveModal(null)}
          className="w-full py-2 px-2 mt-1 border-4 border-[#314a38] rounded-xl font-bold text-white tracking-widest active:scale-95 transition-transform relative overflow-hidden"
          style={{ backgroundColor: "#749270", fontFamily: "var(--font-pixel)" }}
        >
          <div className="absolute inset-1 border-[2px] border-dashed border-[#8eb488] rounded-lg pointer-events-none opacity-60"></div>
          <span className="relative z-10 text-sm">SAVE</span>
        </button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
