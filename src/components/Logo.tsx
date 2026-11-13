import React from "react";
import { Img, staticFile } from "remotion";
import { has } from "../config";
import { theme } from "../theme";

/** Logo RAGE: usa o PNG se existir; senão, "ACADEMIA" + "RAGE" em Anton. */
export const Logo: React.FC<{ file: string; text: string[]; width?: number }> = ({ file, text, width = 520 }) => {
  if (has(file)) {
    return <Img src={staticFile(file)} style={{ width, height: "auto", display: "block" }} />;
  }
  return (
    <div style={{ fontFamily: theme.font.title, textAlign: "center", textTransform: "uppercase", lineHeight: 0.9 }}>
      <div style={{ fontSize: width * 0.115, letterSpacing: "0.42em", marginRight: "-0.42em", color: theme.color.white }}>{text[0]}</div>
      <div
        style={{
          fontSize: width * 0.44,
          letterSpacing: "0.02em",
          color: theme.color.red,
          textShadow: `0 0 44px ${theme.color.redGlow}, 0 6px 30px rgba(0,0,0,.6)`,
          marginTop: width * 0.07,
        }}
      >
        {text[1]}
      </div>
    </div>
  );
};
