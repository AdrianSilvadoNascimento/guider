import React from "react";
import { Composition } from "remotion";
import { Hero } from "./Hero";
import { InstallDemo } from "./InstallDemo";

export const FPS = 30;

export const Root: React.FC = () => (
  <>
    <Composition id="Hero" component={Hero} durationInFrames={FPS * 6} fps={FPS} width={1280} height={400} />
    <Composition id="InstallDemo" component={InstallDemo} durationInFrames={FPS * 14} fps={FPS} width={1000} height={420} />
  </>
);
