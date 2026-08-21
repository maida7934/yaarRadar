


"use client";

import { useState, type ButtonHTMLAttributes } from "react";

export type PixelButtonVariant = "primary" | "secondary";

// Real pixel-art pill sprites (see public/yaarRadar-assets/pixel-friend-buttons.png,
// labeled reference public/yaarRadar-assets/friends-pixel.png), each with a
// genuine normal/pressed pair -- not a CSS-simulated bevel. Add more entries
// here to support more colors; the sheet also has blue/purple/green pairs
// available if a future variant is needed.
const VARIANT_SRC: Record<PixelButtonVariant, { normal: string; pressed: string }> = {
  primary: {
    normal: "/pixelated-icons/buttons/pill-primary.png",
    pressed: "/pixelated-icons/buttons/pill-primary-pressed.png",
  },
  secondary: {
    normal: "/pixelated-icons/buttons/pill-secondary.png",
    pressed: "/pixelated-icons/buttons/pill-secondary-pressed.png",
  },
};

const VARIANT_TEXT_COLOR: Record<PixelButtonVariant, string> = {
  primary: "#ffffff",
  secondary: "#7a5a3a",
};

interface PixelButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: PixelButtonVariant;
  pressedColor?: string;
}

/**
 * Pill button skinned with real pixel-art sprites instead of flat CSS
 * colors -- background-image swaps to the sprite's own pressed-state crop
 * on press (mouse or touch), not just a transform/shadow trick. `variant`
 * picks the color pair; text color defaults per-variant but can be
 * overridden via `style.color` since it's just an ordinary <button>.
 */
export function PixelButton({
  variant = "primary",
  pressedColor,
  children,
  style,
  disabled,
  onMouseDown,
  onMouseUp,
  onMouseLeave,
  onTouchStart,
  onTouchEnd,
  ...props
}: PixelButtonProps) {
  const [pressed, setPressed] = useState(false);
  const src = VARIANT_SRC[variant];
  const release = () => setPressed(false);

  // If pressedColor is provided, we use the normal sprite but tint it
  const isTinted = pressed && !disabled && pressedColor;
  const activeImage = isTinted ? src.normal : (pressed && !disabled ? src.pressed : src.normal);

  return (
    <button
      {...props}
      disabled={disabled}
      onMouseDown={(e) => {
        setPressed(true);
        onMouseDown?.(e);
      }}
      onMouseUp={(e) => {
        release();
        onMouseUp?.(e);
      }}
      onMouseLeave={(e) => {
        release();
        onMouseLeave?.(e);
      }}
      onTouchStart={(e) => {
        setPressed(true);
        onTouchStart?.(e);
      }}
      onTouchEnd={(e) => {
        release();
        onTouchEnd?.(e);
      }}
      style={{
        border: "none",
        backgroundImage: `url(${activeImage})`,
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
        backgroundColor: isTinted ? pressedColor : "transparent",
        backgroundBlendMode: isTinted ? "multiply" : "normal",
        imageRendering: "pixelated",
        fontFamily: "var(--font-pixel)",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: VARIANT_TEXT_COLOR[variant],
        cursor: disabled ? "default" : undefined,
        opacity: disabled ? 0.55 : 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        // Icon+label content can be wider than the button on narrow phones
        // (e.g. Galaxy S8's 360px viewport) -- min-width:0 lets the button
        // actually shrink to its flex-1 parent's width instead of forcing
        // the row wider, and flexWrap lets the label drop to a second line
        // there instead of the icon overflowing past the pill sprite's
        // edges. Both are no-ops once content already fits on one line, so
        // wider screens render identically.
        minWidth: 0,
        flexWrap: "wrap",
        textAlign: "center",
        ...style,
      }}
    >
      {children}
    </button>
  );
}
