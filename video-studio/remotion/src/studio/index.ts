// Entry point separado do Video Studio. NÃO substitui src/index.ts (Studio original).
// Render: npx remotion render src/studio/index.ts StudioSegment out.mp4 --props=props.json
import { registerRoot } from "remotion";
import { StudioRoot } from "./StudioRoot";

registerRoot(StudioRoot);
