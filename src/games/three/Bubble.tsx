"use client";

import { useMemo } from "react";
import * as THREE from "three";

const bubbleTextures = new Map<string, THREE.CanvasTexture>();

/** A white comic bubble with bold text, drawn once per phrase. */
function bubbleTexture(text: string) {
  const hit = bubbleTextures.get(text);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.roundRect(12, 12, 488, 130, 60);
  ctx.moveTo(220, 140);
  ctx.lineTo(256, 184);
  ctx.lineTo(292, 140);
  ctx.fill();
  ctx.stroke();
  ctx.fillRect(222, 128, 68, 14); // hide the outline where the tail meets the bubble
  ctx.fillStyle = "#111111";
  ctx.font = "900 76px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 80);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  bubbleTextures.set(text, tex);
  return tex;
}

/** Comic speech bubble over a figure; the frame loop shows and hides it. */
export function Bubble({ text, height, bubbleRef }: { text: string; height: number; bubbleRef: React.RefObject<THREE.Sprite | null> }) {
  const map = useMemo(() => bubbleTexture(text), [text]);
  return (
    <sprite ref={bubbleRef} position={[0, height, 0]} scale={0} renderOrder={10}>
      <spriteMaterial map={map} transparent depthTest={false} />
    </sprite>
  );
}

/** Pop the bubble in or out. */
export function showBubble(s: THREE.Sprite | null, on: boolean) {
  if (!s) return;
  const goal = on ? 1 : 0;
  const k = THREE.MathUtils.lerp(s.scale.y / 0.6, goal, 0.3);
  s.scale.set(1.6 * k, 0.6 * k, 1);
  s.visible = k > 0.02;
}
