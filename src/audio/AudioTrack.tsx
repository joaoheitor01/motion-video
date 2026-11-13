import React from "react";
import { Audio, Sequence, interpolate, staticFile, useVideoConfig } from "remotion";
import { AUDIO } from "../config";

/** Trilha (fade in/out, -6 dB) + efeitos sonoros (-3 dB) nos frames de config.AUDIO. */
export const AudioTrack: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
  const m = AUDIO.music;
  return (
    <>
      <Audio
        src={staticFile(m.file)}
        startFrom={m.startFrom}
        volume={(f) =>
          m.volume *
          interpolate(f, [0, m.fadeInFrames, durationInFrames - m.fadeOutFrames, durationInFrames], [0, 1, 1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />
      {AUDIO.sfx.map((s, i) => (
        <Sequence key={i} from={Math.max(0, s.at)} layout="none">
          <Audio src={staticFile(s.file)} volume={AUDIO.sfxVolume} />
        </Sequence>
      ))}
    </>
  );
};
