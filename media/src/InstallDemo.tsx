import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { colors, mono } from "./theme";

const COMMAND = "npx @adrianfsf/guider@2.0.0 skills install guider --claude --project --allow-fresh";

type Line = { at: number; text: React.ReactNode };

const Dim: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ color: colors.muted }}>{children}</span>
);

// Frame at which each output line appears (30 fps).
const TYPE_START = 15;
const CHARS_PER_FRAME = 1.6;
const TYPE_END = TYPE_START + Math.ceil(COMMAND.length / CHARS_PER_FRAME);

const OUTPUT: Line[] = [
  {
    at: TYPE_END + 30,
    text: (
      <>
        <span style={{ color: colors.accent2 }}>✔ ✓ Installed</span> <b>guider</b> v2.0.0{" "}
        <Dim>→ ./.claude/skills/guider</Dim>
      </>
    ),
  },
  { at: TYPE_END + 70, text: <span>&nbsp;</span> },
  { at: TYPE_END + 70, text: <Dim># then, inside Claude Code or Codex:</Dim> },
  { at: TYPE_END + 90, text: <span style={{ color: colors.warn, fontWeight: 700 }}>/guider init</span> },
];

export const InstallDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const typed = COMMAND.slice(0, Math.max(0, Math.floor((frame - TYPE_START) * CHARS_PER_FRAME)));
  const cursorOn = Math.floor(frame / 15) % 2 === 0;
  const fadeIn = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: colors.bg, padding: 32, opacity: fadeIn }}>
      <div
        style={{
          flex: 1,
          borderRadius: 14,
          border: `1px solid ${colors.border}`,
          background: colors.panel,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", gap: 8, padding: "14px 18px", borderBottom: `1px solid ${colors.border}` }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <div key={c} style={{ width: 14, height: 14, borderRadius: 7, background: c }} />
          ))}
          <div style={{ marginLeft: 12, fontFamily: mono, fontSize: 15, color: colors.muted }}>~/my-project</div>
        </div>
        <div style={{ padding: "22px 26px", fontFamily: mono, fontSize: 21, lineHeight: 1.7, color: colors.text }}>
          <div style={{ whiteSpace: "pre-wrap" }}>
            <span style={{ color: colors.accent2 }}>$ </span>
            {typed.replace(/-/g, "\u2011")}
            {frame < TYPE_END + 8 && cursorOn ? <span style={{ background: colors.text }}>&nbsp;</span> : null}
          </div>
          {frame >= TYPE_END + 8 && frame < TYPE_END + 30 ? (
            <div style={{ color: colors.accent }}>
              {"⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"[Math.floor(frame / 2) % 10]} <span style={{ color: colors.text }}>Installing <b>guider</b>...</span>
            </div>
          ) : null}
          {OUTPUT.filter((l) => frame >= l.at).map((l, i) => (
            <div key={i} style={{ opacity: interpolate(frame, [l.at, l.at + 6], [0, 1], { extrapolateRight: "clamp" }) }}>
              {l.text}
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
