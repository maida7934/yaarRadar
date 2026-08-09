"use client";

import { useState } from "react";
import { TabBar } from "@/components/scene/TabBar";
import { PixelModal } from "@/components/ui/PixelModal";
import { avatarBackgroundPosition } from "@/lib/spriteAvatar";

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

export default function MePage() {
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [layoutTab, setLayoutTab] = useState<"character" | "background">("character");

  const [name, setName] = useState("PlayerOne");
  const [age, setAge] = useState("24");
  const [bio, setBio] = useState("Just here to find my friends.");

  const [characterId, setCharacterId] = useState("default");
  const [backgroundId, setBackgroundId] = useState("road");

  const activeCharacter = CHARACTER_OPTIONS.find((c) => c.id === characterId) ?? CHARACTER_OPTIONS[0];

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
                backgroundImage: `url(${activeCharacter.pfp})`,
                // Idle sprites are a single full-body portrait (78x130), not a
                // frame strip -- "cover" + anchoring near the top crops in on the
                // head/face instead of squishing the whole body into the square.
                backgroundSize: "cover",
                backgroundPosition: avatarBackgroundPosition(activeCharacter.pfp),
                imageRendering: "pixelated",
              }}
            />

            <div>
              <h2 className="text-lg font-bold" style={{ color: "var(--px-text)" }}>{name}</h2>
              <p className="text-xs mt-1" style={{ color: "var(--px-muted)" }}>Age {age} &middot; Explorer</p>
            </div>

          </div>

          {/* Settings Options */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-bold" style={{ color: "var(--px-white)", textShadow: "2px 2px 0 var(--px-shadow)" }}>OPTIONS</h3>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => setActiveModal("profile")}
                className="px-btn px-btn-ghost w-full justify-start p-4 text-left"
                style={{ fontSize: 12 }}
              >
                <span className="px-icon px-icon-me mr-2" aria-hidden></span> CHANGE PROFILE
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
            <button className="px-btn px-btn-dark w-full p-4" style={{ fontSize: 12 }}>
              LOG OUT
            </button>
          </div>

        </div>

        {/* Navigation */}
        <TabBar />
      </div>

      {/* Change Profile sub-window */}
      <PixelModal open={activeModal === "profile"} title="CHANGE PROFILE" onClose={() => setActiveModal(null)}>
        <label className="flex flex-col gap-1">
          <span className="text-[10px]" style={{ color: "var(--px-muted)" }}>NAME</span>
          <input className="px-input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px]" style={{ color: "var(--px-muted)" }}>AGE</span>
          <input className="px-input" type="number" value={age} onChange={(e) => setAge(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px]" style={{ color: "var(--px-muted)" }}>BIO</span>
          <input className="px-input" value={bio} onChange={(e) => setBio(e.target.value)} />
        </label>
        <button
          className="px-btn px-btn-dark w-full p-3 mt-2"
          style={{ fontSize: 11 }}
          onClick={() => setActiveModal(null)}
        >
          SAVE
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
                onClick={() => setCharacterId(option.id)}
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
