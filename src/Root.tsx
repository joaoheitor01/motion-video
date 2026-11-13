import React from "react";
import { Composition } from "remotion";
import "./fonts";
import { VIDEO } from "./config";
import { RageAreaAluno } from "./Video";

export const Root: React.FC = () => (
  <Composition
    id={VIDEO.id}
    component={RageAreaAluno}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={900}
  />
);
