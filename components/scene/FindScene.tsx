"use client";

import { useEffect, useState, useRef } from "react";
import { useMotionValue, useAnimationFrame } from "framer-motion";
import { usePreloadImages } from "@/hooks/usePreloadImages";
import { useCharacter } from "@/lib/characterState";
import { useAuth } from "@/lib/authState";
import { getFriends, type Friend } from "@/lib/api";
import { ConnectionLine } from "./ConnectionLine";
import { ScrollingBackground } from "./ScrollingBackground";
import { TabBar } from "./TabBar";
import { GROUND_TILE } from "./backgroundTiles";
import { SpriteCharacter } from "./SpriteCharacter";
import {
  CHARACTER_SPRITE_BUNDLES,
  DEFAULT_CHARACTER_ID,
  ALL_SPRITE_SRCS,
  type CharacterSpriteBundle,
  type DirectionalSpriteSet,
} from "./spriteSets";
import { PixelModal } from "@/components/ui/PixelModal";
import { avatarBackgroundPosition } from "@/lib/spriteAvatar";

const TEST_ANCHOR_X_PERCENT = 50;
const TEST_ANCHOR_Y_PERCENT = 65;

export function FindScene() {
  usePreloadImages(ALL_SPRITE_SRCS);

  const keysRef = useRef<Record<string, boolean>>({});
  
  // Independent World Coordinates for both characters
  const meWorldX = useMotionValue(0);
  const meWorldY = useMotionValue(0);
  
  const friendWorldX = useMotionValue(20);
  const friendWorldY = useMotionValue(-30);

  // Screen coordinates for rendering
  const meScreenX = useMotionValue(TEST_ANCHOR_X_PERCENT);
  const meScreenY = useMotionValue(TEST_ANCHOR_Y_PERCENT);
  const friendScreenX = useMotionValue(TEST_ANCHOR_X_PERCENT + 20);
  const friendScreenY = useMotionValue(TEST_ANCHOR_Y_PERCENT - 30);
  
  // Background scrolling offset (moves inverse to Me)
  const bgOffsetX = useMotionValue(0);
  const bgOffsetY = useMotionValue(0);
  const scaleOne = useMotionValue(1);

  type Facing = "up" | "down" | "left" | "right" | "upleft" | "upright" | "downleft" | "downright";
  
  const [meState, setMeState] = useState<{ moving: boolean; facing: Facing }>({ moving: false, facing: "up" });
  const [friendState, setFriendState] = useState<{ moving: boolean; facing: Facing }>({ moving: false, facing: "down" });
  
  const [distance, setDistance] = useState(0);
  const [bearing, setBearing] = useState(0);

  // Character selection
  const { characterId } = useCharacter();
  const myCharacterBundle = CHARACTER_SPRITE_BUNDLES[characterId || DEFAULT_CHARACTER_ID] ?? CHARACTER_SPRITE_BUNDLES[DEFAULT_CHARACTER_ID];

  // Friend selection
  const { accessToken } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [friendPickerOpen, setFriendPickerOpen] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    getFriends(accessToken)
      .then((list) => {
        setFriends(list);
        setSelectedFriend((current) => current ?? list[0] ?? null);
      })
      .catch(() => {})
      .finally(() => setFriendsLoading(false));
  }, [accessToken]);

  const friendCharacterBundle =
    CHARACTER_SPRITE_BUNDLES[selectedFriend?.character_id ?? DEFAULT_CHARACTER_ID] ??
    CHARACTER_SPRITE_BUNDLES[DEFAULT_CHARACTER_ID];

  useEffect(() => {
    function updateState() {
      const keys = keysRef.current;
      
      // Me (Arrow Keys)
      const up = keys["ArrowUp"];
      const down = keys["ArrowDown"];
      const left = keys["ArrowLeft"];
      const right = keys["ArrowRight"];
      
      setMeState((prev) => {
        let nextFacing = prev.facing;
        if (up && left) nextFacing = "upleft";
        else if (up && right) nextFacing = "upright";
        else if (down && left) nextFacing = "downleft";
        else if (down && right) nextFacing = "downright";
        else if (up) nextFacing = "up";
        else if (down) nextFacing = "down";
        else if (left) nextFacing = "left";
        else if (right) nextFacing = "right";
        const nextMoving = Boolean(up || down || left || right);
        if (prev.moving === nextMoving && prev.facing === nextFacing) return prev;
        return { moving: nextMoving, facing: nextFacing };
      });
      
      // Friend (WASD)
      const w = keys["w"] || keys["W"];
      const s = keys["s"] || keys["S"];
      const a = keys["a"] || keys["A"];
      const d = keys["d"] || keys["D"];
      
      setFriendState((prev) => {
        let nextFacing = prev.facing;
        if (w && a) nextFacing = "upleft";
        else if (w && d) nextFacing = "upright";
        else if (s && a) nextFacing = "downleft";
        else if (s && d) nextFacing = "downright";
        else if (w) nextFacing = "up";
        else if (s) nextFacing = "down";
        else if (a) nextFacing = "left";
        else if (d) nextFacing = "right";
        const nextMoving = Boolean(w || s || a || d);
        if (prev.moving === nextMoving && prev.facing === nextFacing) return prev;
        return { moving: nextMoving, facing: nextFacing };
      });
    }

    function onKeyDown(e: KeyboardEvent) {
      if (keysRef.current[e.key]) return;
      keysRef.current[e.key] = true;
      updateState();
    }
    function onKeyUp(e: KeyboardEvent) {
      keysRef.current[e.key] = false;
      updateState();
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useAnimationFrame((t, delta) => {
    const speed = 0.05 * delta;
    const keys = keysRef.current;
    
    // Move Me
    let mx = 0; let my = 0;
    if (keys["ArrowUp"]) my -= speed;
    if (keys["ArrowDown"]) my += speed;
    if (keys["ArrowLeft"]) mx -= speed;
    if (keys["ArrowRight"]) mx += speed;
    if (mx !== 0 || my !== 0) {
      meWorldX.set(meWorldX.get() + mx);
      meWorldY.set(meWorldY.get() + my);
    }
    
    // Move Friend
    let fx = 0; let fy = 0;
    if (keys["w"] || keys["W"]) fy -= speed;
    if (keys["s"] || keys["S"]) fy += speed;
    if (keys["a"] || keys["A"]) fx -= speed;
    if (keys["d"] || keys["D"]) fx += speed;
    if (fx !== 0 || fy !== 0) {
      friendWorldX.set(friendWorldX.get() + fx);
      friendWorldY.set(friendWorldY.get() + fy);
    }

    // Camera follows Me (background scrolls inverse to me)
    bgOffsetX.set(-meWorldX.get());
    bgOffsetY.set(-meWorldY.get());

    // Friend Screen Position relative to Me
    const dx = friendWorldX.get() - meWorldX.get();
    const dy = friendWorldY.get() - meWorldY.get();
    
    friendScreenX.set(TEST_ANCHOR_X_PERCENT + dx);
    friendScreenY.set(TEST_ANCHOR_Y_PERCENT + dy);
    
    // Update live HUD state metrics
    const dist = Math.sqrt(dx * dx + dy * dy) * 8; // arbitrary scale for "meters"
    const brg = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
    
    setDistance((prev) => Math.round(dist) !== Math.round(prev) ? dist : prev);
    setBearing((prev) => Math.round(brg) !== Math.round(prev) ? brg : prev);
  });

  function getSpritesForFacing(bundle: CharacterSpriteBundle, facing: Facing): DirectionalSpriteSet {
    let sprites = bundle.towardCamera;
    if (facing === "up") sprites = bundle.you;
    else if (facing === "left") sprites = bundle.faceLeft;
    else if (facing === "right") sprites = bundle.faceRight;
    else if (facing === "upleft") sprites = { ...bundle.you, straight: bundle.you.left.settled };
    else if (facing === "upright") sprites = { ...bundle.you, straight: bundle.you.right.settled };
    else if (facing === "downleft") sprites = { ...bundle.towardCamera, straight: bundle.towardCamera.left.settled };
    else if (facing === "downright") sprites = { ...bundle.towardCamera, straight: bundle.towardCamera.right.settled };
    return sprites;
  }

  const meSprites = getSpritesForFacing(myCharacterBundle, meState.facing);
  const friendSprites = getSpritesForFacing(friendCharacterBundle, friendState.facing);

  return (
    <div className="relative flex min-h-dvh w-full flex-col overflow-hidden">
      <ScrollingBackground tile={GROUND_TILE} isMoving={false} offsetX={bgOffsetX} offsetY={bgOffsetY} />

      <div className="relative z-10 flex flex-1 w-full flex-col" style={{ paddingBottom: 68 }}>

        {/* HUD */}
        <div className="flex items-start justify-between gap-2 px-3 pt-3">
          <div className="px-panel" style={{ padding: "10px 14px" }}>
            <div style={{ fontFamily: "var(--font-pixel, 'Courier New', monospace)", fontSize: 10, lineHeight: 2, color: "var(--px-text)" }}>
              <span className="px-cursor" style={{ color: "var(--px-orange)", fontSize: 12 }}>
                {Math.round(distance)}M
              </span>
              <br />
              <span style={{ color: "var(--px-blue)" }}>
                {Math.round(bearing)}&deg; BRG
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <ConnectionLine
            x1={meScreenX} y1={meScreenY}
            x2={friendScreenX} y2={friendScreenY}
          />
          
          <SpriteCharacter
            sprites={meSprites}
            scale={scaleOne}
            lookSway={0}
            isMoving={meState.moving}
            xPercent={meScreenX} yPercent={meScreenY}
            label="Me (Arrows)"
          />

          <SpriteCharacter
            sprites={friendSprites}
            scale={scaleOne}
            lookSway={0}
            isMoving={friendState.moving}
            xPercent={friendScreenX} yPercent={friendScreenY}
            label={selectedFriend?.username ?? "Friend (WASD)"}
          />
        </div>

        {/* ── SELECT FRIEND ─────────────────────────────────── */}
        <div className="relative z-40 flex justify-center px-3 pb-3">
          <button
            type="button"
            onClick={() => setFriendPickerOpen(true)}
            className="px-btn px-btn-ghost"
            style={{ padding: "10px 16px", fontSize: 10 }}
          >
            <span className="px-icon px-icon-friends" aria-hidden></span>
            {friendsLoading ? "LOADING..." : selectedFriend ? `SELECT FRIEND: ${selectedFriend.username}` : "NO FRIENDS YET"}
          </button>
        </div>
      </div>

      <TabBar />

      <PixelModal open={friendPickerOpen} onClose={() => setFriendPickerOpen(false)} title="SELECT FRIEND">
        {friendsLoading ? (
          <div className="py-8 text-center text-[10px] text-[var(--px-text-dim)]">LOADING RADAR...</div>
        ) : friends.length === 0 ? (
          <div className="py-8 text-center text-[10px] text-[var(--px-text-dim)]">NO FRIENDS FOUND</div>
        ) : (
          <div className="flex flex-col gap-2 p-2">
            {friends.map((f) => {
              const isSelected = selectedFriend?.id === f.id;
              const bundle = CHARACTER_SPRITE_BUNDLES[f.character_id ?? DEFAULT_CHARACTER_ID] ?? CHARACTER_SPRITE_BUNDLES[DEFAULT_CHARACTER_ID];
              return (
                <button
                  key={f.id}
                  onClick={() => { setSelectedFriend(f); setFriendPickerOpen(false); }}
                  className="flex items-center gap-3 border-2 p-2 text-left transition-colors"
                  style={{
                    borderColor: isSelected ? "var(--px-green)" : "var(--px-border)",
                    background: isSelected ? "var(--px-bg-card-active)" : "var(--px-bg-card)",
                  }}
                >
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-black/20"
                    style={{
                      backgroundImage: `url('${bundle.towardCamera.straight.idleSrc}')`,
                      backgroundPosition: avatarBackgroundPosition(bundle.towardCamera.straight.idleSrc),
                      backgroundSize: "cover",
                      backgroundRepeat: "no-repeat",
                      imageRendering: "pixelated",
                    }}
                  />
                  <div className="flex-1 font-pixel text-[10px] uppercase text-[var(--px-text)]">
                    {f.username}
                  </div>
                  {isSelected && <div className="font-pixel text-[10px] text-[var(--px-green)]">SELECTED</div>}
                </button>
              );
            })}
          </div>
        )}
      </PixelModal>
    </div>
  );
}
