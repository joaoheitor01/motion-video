import React from "react";
import { Composition } from "remotion";
import { SegmentProps, StudioSegment, calculateSegmentMetadata } from "./StudioSegment";

const demo: SegmentProps = {
  fps: 30,
  scenes: [
    { id: "a", template: "title", heading: "Video Studio Local", sub: "Remotion + HyperFrames", frames: 90 },
    { id: "b", template: "bullets", heading: "Pipeline", bullets: ["Roteiro", "Narração", "Render"], frames: 120 },
  ],
};

export const StudioRoot: React.FC = () => (
  <Composition
    id="StudioSegment"
    component={StudioSegment}
    width={1920}
    height={1080}
    fps={30}
    durationInFrames={210}
    defaultProps={demo}
    calculateMetadata={calculateSegmentMetadata}
  />
);
