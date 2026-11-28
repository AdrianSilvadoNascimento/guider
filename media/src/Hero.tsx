import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { colors, mono, sans } from "./theme";

const PILLARS = ["Standards in AGENTS.md", "Agent hooks", "Security first", "Code graph", "7-day release quarantine"];

export const Hero: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const titleIn = spring({ frame, fps, config: { damping: 14 } });
  const taglineIn = spring({ frame: frame - 12, fps, config: { damping: 16 } });
  // Fade out at the end so the GIF loops cleanly.
  const outro = interpolate(frame, [durationInFrames - 15, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: colors.bg,
        fontFamily: sans,
        color: colors.text,
        padding: "0 72px",
        justifyContent: "center",
        opacity: outro,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24, transform: `translateY(${(1 - titleIn) * 30}px)`, opacity: titleIn }}>
        <div
          style={{
            fontFamily: mono,
            fontSize: 112,
            fontWeight: 800,
            letterSpacing: -4,
            color: colors.text,
            textShadow: "0 0 32px rgba(124,156,255,0.5)",
          }}
        >
          guider
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <Badge label="Claude" color={colors.claude} delay={20} />
          <Badge label="Codex / ChatGPT" color={colors.codex} delay={28} />
        </div>
      </div>

      <div style={{ fontSize: 36, marginTop: 8, color: colors.muted, opacity: taglineIn, transform: `translateX(${(1 - taglineIn) * -20}px)` }}>
        Easy to do the <span style={{ color: colors.accent2, fontWeight: 700 }}>right</span> thing.{" "}
        Hard to do the <span style={{ color: colors.warn, fontWeight: 700 }}>wrong</span> one.
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 36 }}>
        {PILLARS.map((label, i) => {
          const s = spring({ frame: frame - 40 - i * 8, fps, config: { damping: 15 } });
          return (
            <div
              key={label}
              style={{
                fontSize: 22,
                padding: "8px 16px",
                borderRadius: 999,
                border: `1px solid ${colors.border}`,
                background: colors.panel,
                opacity: s,
                transform: `scale(${0.8 + s * 0.2})`,
              }}
            >
              <span style={{ color: colors.accent2 }}>✓</span> {label}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const Badge: React.FC<{ label: string; color: string; delay: number }> = ({ label, color, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 12 } });
  return (
    <div
      style={{
        fontSize: 22,
        fontWeight: 600,
        padding: "6px 14px",
        borderRadius: 8,
        color,
        border: `2px solid ${color}`,
        opacity: s,
        transform: `translateY(${(1 - s) * -16}px)`,
      }}
    >
      {label}
    </div>
  );
};
