"use client";

import { useEffect, useRef, useState } from "react";
import { TabBar } from "@/components/scene/TabBar";
import { NotchedFrame, notchedRectPoints } from "@/components/ui/NotchedFrame";
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

function ProfileLeaf({ className, style }: { className?: string, style?: React.CSSProperties }) {
  const grid = [
    "             XXX ",
    "           XX22X ",
    "         XX2221X ",
    "        X222211X ",
    "       X2222111X ",
    "      X22221110X ",
    "     X222021101X ",
    "    X2222011011X ",
    "   X22222110111X ",
    "   X22201101111X ",
    "  X22210100111X  ",
    "  X2211101101X   ",
    "   X1110111XX    ",
    "    X1011XX      ",
    "  XXX0XXX        ",
    " X0XX            ",
    " XX              "
  ];

  const colors: Record<string, string> = {
    "X": "#3A5630",
    "0": "#3A5630",
    "1": "#8DA66A",
    "2": "#A3BC76"
  };

  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 17 17"
      aria-hidden
      className={className}
      style={{ flexShrink: 0, imageRendering: "pixelated", ...style }}
    >
      {grid.map((row, y) =>
        row.split("").map((char, x) =>
          colors[char] ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={colors[char]} /> : null
        )
      )}
    </svg>
  );
}

function ProfileCloud({ className, style, lightFill = "#C19672", darkFill = "#A87A4F" }: { className?: string, style?: React.CSSProperties, lightFill?: string, darkFill?: string }) {
  return (
    <svg width={20} height={10} viewBox="0 0 20 10" aria-hidden className={className} style={{ flexShrink: 0, imageRendering: "pixelated", ...style }}>
      <g fill={lightFill}>
        <rect x="8" y="1" width="5" height="1" />
        <rect x="7" y="2" width="7" height="1" />
        <rect x="7" y="3" width="8" height="1" />
        <rect x="4" y="4" width="13" height="1" />
        <rect x="3" y="5" width="15" height="1" />
        <rect x="2" y="6" width="16" height="1" />
      </g>
      <g fill={darkFill}>
        <rect x="7" y="5" width="5" height="1" />
        <rect x="14" y="5" width="3" height="1" />
        <rect x="3" y="6" width="3" height="1" />
        <rect x="2" y="7" width="15" height="1" />
        <rect x="3" y="8" width="13" height="1" />
        <rect x="6" y="9" width="7" height="1" />
      </g>
    </svg>
  );
}

function ProfileSparkle({ className, style, fill = "#9CB579" }: { className?: string, style?: React.CSSProperties, fill?: string }) {
  return (
    <svg width={5} height={5} viewBox="0 0 5 5" aria-hidden className={className} style={{ flexShrink: 0, imageRendering: "pixelated", ...style }}>
      <path d="M2,0 H3 V1 H4 V2 H5 V3 H4 V4 H3 V5 H2 V4 H1 V3 H0 V2 H1 V1 H2 V0 Z M2,2 V3 H3 V2 H2 Z" fill={fill} fillRule="evenodd" />
    </svg>
  );
}


export default function MePage() {
  const { user, accessToken, logOut, updateProfile } = useAuth();
  const { characterId, setCharacterId, loading: characterLoading } = useCharacter();
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [layoutTab, setLayoutTab] = useState<"character" | "background">("character");

  // The profile card's outline is drawn to its *actual* measured size (not a
  // guessed viewBox) so the notched corners never stretch/distort -- the
  // card's height is content-driven and varies, so a fixed viewBox aspect
  // ratio would only ever match it by coincidence.
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardSize, setCardSize] = useState({ width: 340, height: 420 });
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const update = () => setCardSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const metadata = (user?.user_metadata ?? {}) as ProfileMetadata;
  const name = metadata.name ?? "PlayerOne";
  const gender = metadata.gender ?? GENDER_OPTIONS[0];

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
  const avatarPfp = characterLoading ? "/pixelated-icons/profile-avatar.png" : activeCharacter.pfp;

  return (
    <div
      className="flex flex-1 justify-center"
      style={{
        backgroundImage: "url(/yaarRadar-assets/mebg.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center top",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div
        className="w-full max-w-md relative min-h-dvh flex flex-col pb-[68px] overflow-hidden"
        style={{ backgroundColor: "transparent" }}
      >

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="relative z-10 px-3 pt-5 pb-3 flex items-center justify-center gap-2">

          {/* Banner — drawn as an inline SVG (not a raster/border-image asset) so
              the notched double-outline scales crisply at any container width,
              instead of stretching a fixed-resolution image. Four concentric
              notched rings: dark outline, a cream gap, a light pink inner
              outline, then the cream fill. */}
          <div className="relative flex items-center justify-center flex-1" style={{ height: 56 }}>
            <svg
              className="absolute inset-0"
              width="100%"
              height="100%"
              viewBox="0 0 300 52"
              preserveAspectRatio="none"
              shapeRendering="crispEdges"
              aria-hidden
            >
              {/* Outer dark brown outline, rimmed with a light peach highlight for a
                  more dimensional pixel-art edge */}
              <polygon
                points="12,0 288,0 288,3 291,3 291,6 294,6 294,9 297,9 297,12 300,12 300,40 297,40 297,43 294,43 294,46 291,46 291,49 288,49 288,52 12,52 12,49 9,49 9,46 6,46 6,43 3,43 3,40 0,40 0,12 3,12 3,9 6,9 6,6 9,6 9,3 12,3 12,0"
                fill="#8C6551"
                stroke="#FFE3C2"
                strokeWidth={1.5}
                strokeLinejoin="miter"
              />
              {/* Gap between the two outlines, off-white */}
              <polygon
                points="15,3 285,3 285,6 288,6 288,9 291,9 291,12 294,12 294,15 297,15 297,37 294,37 294,40 291,40 291,43 288,43 288,46 285,46 285,49 15,49 15,46 12,46 12,43 9,43 9,40 6,40 6,37 3,37 3,15 6,15 6,12 9,12 9,9 12,9 12,6 15,6 15,3"
                fill="#F3E8DB"
              />
              {/* Browner fill directly inside the cream outline */}
              <polygon
                points="18,6 282,6 282,9 285,9 285,12 288,12 288,15 291,15 291,18 294,18 294,34 291,34 291,37 288,37 288,40 285,40 285,43 282,43 282,46 18,46 18,43 15,43 15,40 12,40 12,37 9,37 9,34 6,34 6,18 9,18 9,15 12,15 12,12 15,12 15,9 18,9 18,6"
                fill="#D4AC8D"
              />
            </svg>

            <div className="relative z-10 flex items-center justify-center w-full px-7 h-full">
              <img src="/yaarRadar-assets/leaf-transparent.png" className="absolute left-6 top-1/2 -translate-y-1/2 w-7 h-7 rotate-[-30deg] opacity-80" style={{ mixBlendMode: 'multiply', imageRendering: 'pixelated' }} alt="" />
              <h1
                className="tracking-widest"
                style={{
                  color: "#3A5630",
                  fontFamily: "var(--font-pixel)",
                  fontSize: 26,
                  fontWeight: 700,
                  WebkitTextStroke: "1px #3A5630",
                  letterSpacing: "0.1em",
                  margin: 0,
                  lineHeight: 1,
                }}
              >
                MY PROFILE
              </h1>
              <img src="/yaarRadar-assets/leaf-transparent.png" className="absolute right-6 top-1/2 -translate-y-1/2 w-7 h-7 rotate-[-30deg] opacity-80" style={{ mixBlendMode: 'multiply', imageRendering: 'pixelated' }} alt="" />
            </div>
          </div>
        </div>

        {/* ── Scrollable content ───────────────────────────────────── */}
        <div className="relative z-10 flex-1 overflow-y-auto px-4 flex flex-col gap-4">

          {/* ── Profile card ─────────────────────────────────────── */}
          <div
            ref={cardRef}
            className="flex flex-col items-center gap-4 mt-2"
            style={{
              position: "relative",
              overflow: "hidden",
              padding: "48px 18px 40px",
              marginLeft: 4,
              marginRight: 4,
            }}
          >
            {/* Frame — same drawn, notched-outline shape as the "MY PROFILE"
                banner (dark purple outline, cream gap, light pink inner
                outline, cream fill). Built from the card's own *measured*
                pixel size (cardSize, via ResizeObserver above) rather than a
                guessed viewBox, so the notched corners never stretch --
                content-driven height means a fixed aspect ratio would only
                ever match it by coincidence. */}
            <svg
              className="absolute inset-0"
              width="100%"
              height="100%"
              viewBox={`0 0 ${cardSize.width} ${cardSize.height}`}
              shapeRendering="crispEdges"
              aria-hidden
            >
              <polygon
                points={notchedRectPoints(0, 0, cardSize.width, cardSize.height, 8)}
                fill="#8C6551"
                stroke="#FFE3C2"
                strokeWidth={1.5}
                strokeLinejoin="miter"
              />
              <polygon
                points={notchedRectPoints(4, 4, cardSize.width - 8, cardSize.height - 8, 8)}
                fill="#F3E8DB"
              />
              <polygon
                points={notchedRectPoints(8, 8, cardSize.width - 16, cardSize.height - 16, 8)}
                fill="#D4AC8D"
              />
            </svg>

            {/* Charms */}
            {/* Corner Vines */}
            <img src="/yaarRadar-assets/corner_vine.jpg" className="absolute left-3 top-3 w-16 h-16 opacity-80" style={{ mixBlendMode: 'multiply', imageRendering: 'pixelated' }} alt="" />
            <img src="/yaarRadar-assets/corner_vine.jpg" className="absolute right-3 top-3 w-16 h-16 opacity-80 scale-x-[-1]" style={{ mixBlendMode: 'multiply', imageRendering: 'pixelated' }} alt="" />
            <img src="/yaarRadar-assets/corner_vine.jpg" className="absolute right-3 bottom-3 w-16 h-16 opacity-80 scale-x-[-1] scale-y-[-1]" style={{ mixBlendMode: 'multiply', imageRendering: 'pixelated' }} alt="" />
            <img src="/yaarRadar-assets/corner_vine.jpg" className="absolute left-3 bottom-3 w-16 h-16 opacity-80 scale-y-[-1]" style={{ mixBlendMode: 'multiply', imageRendering: 'pixelated' }} alt="" />

            {/* Clouds */}
            <ProfileCloud className="absolute left-[6%] top-[22%] opacity-90 w-20 h-10" />
            <ProfileCloud className="absolute right-[6%] top-[9%] opacity-80 w-20 h-10" />
            <ProfileCloud className="absolute left-[10%] bottom-[20%] opacity-80 w-16 h-8" />
            <ProfileCloud className="absolute right-[8%] bottom-[27%] opacity-70 w-16 h-8" />
            
            {/* Green Sparkles around */}
            <ProfileSparkle className="absolute right-[22%] top-[32%] w-3 h-3 opacity-100" />
            <ProfileSparkle className="absolute left-[14%] top-[45%] w-4 h-4 opacity-100" />
            <ProfileSparkle className="absolute right-[12%] top-[52%] w-4 h-4 opacity-100" />
            <ProfileSparkle className="absolute left-[20%] bottom-[26%] w-3 h-3 opacity-100" />

            {/* Small dot sparkles */}
            <div className="absolute right-[30%] top-[20%] w-1.5 h-1.5 bg-[#A87A4F] opacity-70" />
            <div className="absolute left-[30%] bottom-[25%] w-1.5 h-1.5 bg-[#A87A4F] opacity-70" />

            {/* Random brown squares */}
            <div className="absolute left-[38%] top-[12%] w-2 h-2 bg-[#8C6551] opacity-60" />
            <div className="absolute right-[36%] bottom-[8%] w-1 h-1 bg-[#8C6551] opacity-60" />
            <div className="absolute left-[45%] bottom-[30%] w-1.5 h-1.5 bg-[#8C6551] opacity-50" />

            {/* ── Avatar ──────────────────────────────────────────── */}
            <div className="relative z-10">
              {/* Frame — same drawn-not-asset approach as the header banner:
                  dark purple outline, then a white ring directly against it
                  (no gap this time), then the cream base fill underneath the
                  avatar. Corners are a stair-stepped pixel cut (not a smooth
                  border-radius arc) to match the app's pixel-art style. */}
              <div style={{ width: 140, height: 140, position: "relative" }}>
                <svg
                  className="absolute inset-0"
                  width="100%"
                  height="100%"
                  viewBox="0 0 100 100"
                  shapeRendering="crispEdges"
                  aria-hidden
                >
                  <polygon
                    points="12,0 88,0 88,4 92,4 92,8 96,8 96,12 100,12 100,88 96,88 96,92 92,92 92,96 88,96 88,100 12,100 12,96 8,96 8,92 4,92 4,88 0,88 0,12 4,12 4,8 8,8 8,4 12,4"
                    fill="#964B00"
                    stroke="#FFE3C2"
                    strokeWidth={1.5}
                    strokeLinejoin="miter"
                  />
                  <polygon
                    points="16,4 84,4 84,8 88,8 88,12 92,12 92,16 96,16 96,84 92,84 92,88 88,88 88,92 84,92 84,96 16,96 16,92 12,92 12,88 8,88 8,84 4,84 4,16 8,16 8,12 12,12 12,8 16,8"
                    fill="#F3E8DB"
                  />
                  <polygon
                    points="20,8 80,8 80,12 84,12 84,16 88,16 88,20 92,20 92,80 88,80 88,84 84,84 84,88 80,88 80,92 20,92 20,88 16,88 16,84 12,84 12,80 8,80 8,20 12,20 12,16 16,16 16,12 20,12"
                    fill="#964B00"
                  />
                </svg>
                {/* Sprite -- clipped to the same stair-stepped shape as the
                    inner cream fill so it sits flush inside the frame */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    clipPath:
                      "polygon(20% 8%, 80% 8%, 80% 12%, 84% 12%, 84% 16%, 88% 16%, 88% 20%, 92% 20%, 92% 80%, 88% 80%, 88% 84%, 84% 84%, 84% 88%, 80% 88%, 80% 92%, 20% 92%, 20% 88%, 16% 88%, 16% 84%, 12% 84%, 12% 80%, 8% 80%, 8% 20%, 12% 20%, 12% 16%, 16% 16%, 16% 12%, 20% 12%)",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      backgroundImage: `url(${avatarPfp})`,
                      backgroundSize: "cover",
                      backgroundPosition: avatarPfp.includes("/sprites-hat/") ? "center 29%" : "center 15%",
                      imageRendering: "pixelated",
                    }}
                  />
                </div>
              </div>
              {/* Edit badge -- small notched-corner cut, same pixel-art language */}
              <div style={{ position: "absolute", bottom: -6, right: -6, width: 28, height: 28, zIndex: 1 }}>
                <svg className="absolute inset-0" width="100%" height="100%" viewBox="0 0 28 28" shapeRendering="crispEdges" aria-hidden>
                  {/* Outer dark purple outline, pixelated corners */}
                  <polygon
                    points="5,0 23,0 23,2.5 25.5,2.5 25.5,5 28,5 28,23 25.5,23 25.5,25.5 23,25.5 23,28 5,28 5,25.5 2.5,25.5 2.5,23 0,23 0,5 2.5,5 2.5,2.5 5,2.5"
                    fill="#C39A72"
                    stroke="#FFE3C2"
                    strokeWidth={1}
                    strokeLinejoin="miter"
                  />
                  {/* Inner light pink line */}
                  <polygon
                    points="8,3 20,3 20,5.5 22.5,5.5 22.5,8 25,8 25,20 22.5,20 22.5,22.5 20,22.5 20,25 8,25 8,22.5 5.5,22.5 5.5,20 3,20 3,8 5.5,8 5.5,5.5 8,5.5"
                    fill="#FFFFFF"
                  />
                  {/* Cream fill */}
                  <polygon
                    points="11,6 17,6 17,8.5 19.5,8.5 19.5,11 22,11 22,17 19.5,17 19.5,19.5 17,19.5 17,22 11,22 11,19.5 8.5,19.5 8.5,17 6,17 6,11 8.5,11 8.5,8.5 11,8.5"
                    fill="#FFFFFF"
                  />
                </svg>
                <div
                  className="relative z-10 flex items-center justify-center"
                  style={{ width: "100%", height: "100%", fontSize: 13, color: "#C39A72" }}
                >
                  ✎
                </div>
              </div>
            </div>

            {/* ── Name + bio ──────────────────────────────────────── */}
            <div className="relative z-10 flex flex-col items-center gap-2">
              {/* Name */}
              <h2
                style={{
                  color: "#40593B",
                  fontFamily: "var(--font-pixel)",
                  fontSize: 16,
                  fontWeight: "bold",
                  letterSpacing: "0.05em",
                  lineHeight: 1.2,
                }}
              >
                {name}☆
              </h2>
              
              <div className="flex items-center gap-2 mt-1 mb-2 opacity-60 w-full max-w-[200px] justify-center">
                 <div style={{ flex: 1, height: 1, backgroundColor: "#964B00" }} />
                 <img
                   src="/yaarRadar-assets/leaf-transparent.png"
                   alt=""
                   className="w-7 h-7"
                   style={{ imageRendering: "pixelated", flexShrink: 0, transform: "rotate(-20deg)" }}
                 />
                 <div style={{ flex: 1, height: 1, backgroundColor: "#964B00" }} />
              </div>

              {/* Bio with inline SVG sparkles on sides */}
              <div className="flex items-center gap-2">
                <svg width="10" height="10" viewBox="0 0 10 10" shapeRendering="crispEdges" aria-hidden style={{ imageRendering: "pixelated", flexShrink: 0 }}>
                  <g fill="#6B4731">
                    <rect x="5" y="1" width="1" height="1" />
                    <rect x="6" y="2" width="1" height="1" />
                    <rect x="7" y="3" width="1" height="1" />
                    <rect x="8" y="4" width="1" height="1" />
                    <rect x="9" y="5" width="1" height="1" />
                    <rect x="4" y="2" width="1" height="1" />
                    <rect x="3" y="3" width="1" height="1" />
                    <rect x="2" y="4" width="1" height="1" />
                    <rect x="1" y="5" width="1" height="1" />
                    <rect x="8" y="6" width="1" height="1" />
                    <rect x="7" y="7" width="1" height="1" />
                    <rect x="6" y="8" width="1" height="1" />
                    <rect x="5" y="9" width="1" height="1" />
                    <rect x="2" y="6" width="1" height="1" />
                    <rect x="3" y="7" width="1" height="1" />
                    <rect x="4" y="8" width="1" height="1" />
                  </g>
                </svg>
                <p
                  style={{
                    color: "#40593B",
                    fontFamily: "var(--font-pixel)",
                    fontSize: 10,
                    textAlign: "center",
                    maxWidth: 180,
                    lineHeight: 1.6,
                  }}
                >
                  {bio}
                </p>
                <svg width="10" height="10" viewBox="0 0 10 10" shapeRendering="crispEdges" aria-hidden style={{ imageRendering: "pixelated", flexShrink: 0 }}>
                  <g fill="#6B4731">
                    <rect x="5" y="1" width="1" height="1" />
                    <rect x="6" y="2" width="1" height="1" />
                    <rect x="7" y="3" width="1" height="1" />
                    <rect x="8" y="4" width="1" height="1" />
                    <rect x="9" y="5" width="1" height="1" />
                    <rect x="4" y="2" width="1" height="1" />
                    <rect x="3" y="3" width="1" height="1" />
                    <rect x="2" y="4" width="1" height="1" />
                    <rect x="1" y="5" width="1" height="1" />
                    <rect x="8" y="6" width="1" height="1" />
                    <rect x="7" y="7" width="1" height="1" />
                    <rect x="6" y="8" width="1" height="1" />
                    <rect x="5" y="9" width="1" height="1" />
                    <rect x="2" y="6" width="1" height="1" />
                    <rect x="3" y="7" width="1" height="1" />
                    <rect x="4" y="8" width="1" height="1" />
                  </g>
                </svg>
              </div>
            </div>

          </div>{/* end profile card */}

          {/* ── OPTIONS section ──────────────────────────────────── */}
          <div
            className="flex flex-col items-center gap-4 -mt-2 mb-2"
            style={{
              padding: "50px 14px 46px",
              marginLeft: 4,
              marginRight: 4,
              position: "relative"
            }}
          >
            <NotchedFrame colors={["#8C6551", "#F3E8DB", "#365224", "#B9D793"]} step={5} ringWidth={4} />

            {/* OPTIONS ribbon banner — the yaarRadar-assets ribbon art with its
                background chroma-keyed out (see optionsbg-transparent.png),
                text overlaid on top */}
            <div
              className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center"
              style={{ top: -4, width: 190, height: 39 }}
            >
              <img
                src="/yaarRadar-assets/optionsbg-transparent.png"
                alt=""
                className="absolute inset-0 w-full h-full"
                style={{ imageRendering: "pixelated" }}
              />
              <span
                className="relative z-10 font-bold tracking-widest"
                style={{ color: "#F0DEC3", fontFamily: "var(--font-pixel)", fontSize: 11, letterSpacing: "0.12em", textShadow: "1px 1px 0 #2B1A0A" }}
              >
                OPTIONS
              </span>
            </div>

            <div className="w-full flex flex-col gap-2.5 px-1.5">
              {/* ── Edit Profile ───────────────────────────── */}
              <button
                id="btn-edit-profile"
                onClick={openProfileModal}
                className="w-full flex items-center gap-3 active:scale-95 transition-transform"
                style={{
                  padding: "14px 12px",
                  textAlign: "left",
                  position: "relative",
                }}
              >
                <NotchedFrame colors={["#365224", "#8FA873", "#94B66B"]} step={5} ringWidth={3.5} />
                {/* Icon box */}
                <div style={{ width: 28, height: 28, backgroundColor: "#84A85B", border: "2px solid #365224", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="#E8F5D8">
                    <rect x="5" y="1" width="6" height="6" rx="1" />
                    <path d="M3 14V11C3 9.5 4 8.5 8 8.5C12 8.5 13 9.5 13 11V14H3Z" />
                  </svg>
                </div>
                {/* Text */}
                <div className="flex-1 flex flex-col gap-0.5">
                  <span className="text-xs font-bold tracking-wide" style={{ color: "#2C421C", fontFamily: "var(--font-pixel)" }}>EDIT PROFILE</span>
                  <span className="text-[9px]" style={{ color: "#4A6D36", fontFamily: "var(--font-pixel)" }}>Update your info and avatar</span>
                </div>
                <span className="text-base font-bold shrink-0" style={{ color: "#2C421C" }}>›</span>
              </button>

              {/* ── Change Layout ──────────────────────────── */}
              <button
                id="btn-change-layout"
                onClick={() => setActiveModal("layout")}
                className="w-full flex items-center gap-3 active:scale-95 transition-transform"
                style={{
                  padding: "14px 12px",
                  textAlign: "left",
                  position: "relative",
                }}
              >
                <NotchedFrame colors={["#365224", "#8FA873", "#E1EDCB"]} step={5} ringWidth={3.5} />
                <div style={{ width: 28, height: 28, backgroundColor: "#D5E4BB", border: "2px solid #365224", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="18" height="14" viewBox="0 0 20 16" fill="#365224">
                    <rect x="1" y="4" width="4" height="4" rx="1" />
                    <path d="M0 14V12C0 11 1 10 3 10C5 10 6 11 6 12V14H0Z" />
                    <rect x="15" y="4" width="4" height="4" rx="1" />
                    <path d="M14 14V12C14 11 15 10 17 10C19 10 20 11 20 12V14H14Z" />
                    <rect x="7" y="1" width="6" height="6" rx="1" />
                    <path d="M5 14V11C5 9.5 6 8.5 10 8.5C14 8.5 15 9.5 15 11V14H5Z" />
                  </svg>
                </div>
                <div className="flex-1 flex flex-col gap-0.5">
                  <span className="text-xs font-bold tracking-wide" style={{ color: "#2C421C", fontFamily: "var(--font-pixel)" }}>CHANGE LAYOUT</span>
                  <span className="text-[9px]" style={{ color: "#4A6D36", fontFamily: "var(--font-pixel)" }}>Switch between layouts</span>
                </div>
                <span className="text-base font-bold shrink-0" style={{ color: "#2C421C" }}>›</span>
              </button>

              {/* ── Log Out ───────────────────────────────── */}
              <button
                id="btn-log-out"
                onClick={logOut}
                className="w-full flex items-center gap-3 active:scale-95 transition-transform"
                style={{
                  padding: "14px 12px",
                  textAlign: "left",
                  position: "relative",
                }}
              >
                <NotchedFrame colors={["#5C4528", "#8C6551", "#BCA782"]} step={5} ringWidth={3.5} />
                <div style={{ width: 28, height: 28, backgroundColor: "#A89069", border: "2px solid #5C4528", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="#F0DEC3" strokeWidth="2">
                    <rect x="3" y="2" width="7" height="14" rx="1" />
                    <path d="M10 9H16 M14 6L17 9L14 12" strokeLinecap="square" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="flex-1 flex flex-col gap-0.5">
                  <span className="text-xs font-bold tracking-wide" style={{ color: "#4A3219", fontFamily: "var(--font-pixel)" }}>LOG OUT</span>
                  <span className="text-[9px]" style={{ color: "#664C33", fontFamily: "var(--font-pixel)" }}>See you soon!</span>
                </div>
              </button>
            </div>
          </div>
        </div>


        {/* ── Navigation ──────────────────────────────────────────── */}
        <TabBar />
      </div>

      {/* ── Edit Profile modal ──────────────────────────────────── */}
      {activeModal === "profile" && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-w-sm relative overflow-hidden"
            style={{
              backgroundColor: "#EADBC8",
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
              className="flex items-center justify-between px-3 py-2 border-b-4 border-[#6B4731]"
              style={{ backgroundColor: "#6B4731" }}
            >
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 text-[#C2D6AD] text-lg leading-none select-none">✦</div>
                <h2 className="text-sm font-bold text-white tracking-widest">EDIT PROFILE</h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-7 h-7 flex items-center justify-center border-[3px] border-[#6B4731] bg-[#EADBC8] rounded-md text-[#6B4731] font-bold select-none active:scale-95"
                style={{ fontFamily: "var(--font-pixel)" }}
              >
                X
              </button>
            </div>

            {/* Body */}
            <div className="p-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold" style={{ color: "#6B4731" }}>NAME</span>
                <input className="px-input" value={draftName} onChange={(e) => setDraftName(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold" style={{ color: "#6B4731" }}>GENDER</span>
                <select className="px-input" value={draftGender} onChange={(e) => setDraftGender(e.target.value)}>
                  {GENDER_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold" style={{ color: "#6B4731" }}>BIO</span>
                <input className="px-input" value={draftBio} onChange={(e) => setDraftBio(e.target.value)} />
              </label>
              {profileError && (
                <p className="text-[10px] font-bold" style={{ color: "#C97F80" }}>{profileError}</p>
              )}
              <button
                type="button"
                onClick={saveProfile}
                disabled={savingProfile}
                className="w-full py-2 px-2 mt-1 border-4 border-[#3D271D] rounded-xl font-bold text-white tracking-widest active:scale-95 transition-transform disabled:opacity-50 relative overflow-hidden"
                style={{ backgroundColor: "#8EA971", fontFamily: "var(--font-pixel)" }}
              >
                <div className="absolute inset-1 border-[2px] border-dashed border-[#C2D6AD] rounded-lg pointer-events-none opacity-60" />
                <span className="relative z-10 text-sm">{savingProfile ? "..." : "SAVE"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Change Layout modal ─────────────────────────────────── */}
      {activeModal === "layout" && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-w-sm relative overflow-hidden"
            style={{
              backgroundColor: "#EADBC8",
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
              className="flex items-center justify-between px-3 py-2 border-b-4 border-[#6B4731]"
              style={{ backgroundColor: "#6B4731" }}
            >
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 text-[#C2D6AD] text-lg leading-none select-none">✦</div>
                <h2 className="text-sm font-bold text-white tracking-widest">CHANGE LAYOUT</h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-7 h-7 flex items-center justify-center border-[3px] border-[#6B4731] bg-[#EADBC8] rounded-md text-[#6B4731] font-bold select-none active:scale-95"
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
                    backgroundColor: layoutTab === "character" ? "#C2D6AD" : "transparent",
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
                    backgroundColor: layoutTab === "background" ? "#C2D6AD" : "transparent",
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
                        setCharacterId(option.id).catch(() => {});
                      }}
                      className="flex flex-col items-center gap-2 p-3"
                      style={{
                        backgroundColor: option.id === characterId ? "#C2D6AD" : "var(--px-white)",
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
                          border: "2px solid #6B4731",
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
                      <span className="text-[10px] font-bold" style={{ color: "var(--px-text)" }}>
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
                        backgroundColor: option.id === backgroundId ? "#C2D6AD" : "var(--px-white)",
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
                      <span className="text-xs font-bold" style={{ color: "var(--px-text)" }}>
                        {option.label}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-full py-2 px-2 mt-1 border-4 border-[#3D271D] rounded-xl font-bold text-white tracking-widest active:scale-95 transition-transform relative overflow-hidden"
                style={{ backgroundColor: "#8EA971", fontFamily: "var(--font-pixel)" }}
              >
                <div className="absolute inset-1 border-[2px] border-dashed border-[#C2D6AD] rounded-lg pointer-events-none opacity-60" />
                <span className="relative z-10 text-sm">SAVE</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
