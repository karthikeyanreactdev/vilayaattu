import { CAMERA_HEIGHT, DRAW_DISTANCE, project, ROAD_WIDTH, SEGMENT_LENGTH, type Drive, type Track } from "./sim";

function quad(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  w1: number,
  x2: number,
  y2: number,
  w2: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x1 - w1, y1);
  ctx.lineTo(x1 + w1, y1);
  ctx.lineTo(x2 + w2, y2);
  ctx.lineTo(x2 - w2, y2);
  ctx.closePath();
  ctx.fill();
}

function tree(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = "#1f6b3a";
  ctx.beginPath();
  ctx.moveTo(x, y - s * 2.1);
  ctx.lineTo(x - s * 0.7, y);
  ctx.lineTo(x + s * 0.7, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#14532d";
  ctx.fillRect(x - s * 0.12, y, s * 0.24, s * 0.35);
}

/** Paint one frame of the coast. The car stays at the bottom; the road moves. */
export function drawCoast(ctx: CanvasRenderingContext2D, w: number, h: number, drive: Drive, track: Track, lean: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#16324f");
  sky.addColorStop(0.42, "#f08a5d");
  sky.addColorStop(0.7, "#f6d365");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#fff6d8";
  ctx.beginPath();
  ctx.arc(w * 0.78, h * 0.22, Math.min(w, h) * 0.06, 0, Math.PI * 2);
  ctx.fill();

  const baseIndex = Math.floor(drive.position / SEGMENT_LENGTH) % track.segments.length;
  const base = track.segments[baseIndex];
  const basePercent = (drive.position % SEGMENT_LENGTH) / SEGMENT_LENGTH;
  const playerY = base.y1 + (base.y2 - base.y1) * basePercent;
  let x = 0;
  let dx = -(base.curve * basePercent);
  let maxY = h;

  for (let n = 0; n < DRAW_DISTANCE; n++) {
    const index = (baseIndex + n) % track.segments.length;
    const seg = track.segments[index];
    const looped = index < baseIndex;
    const zShift = looped ? track.segments.length * SEGMENT_LENGTH : 0;
    const camY = playerY + CAMERA_HEIGHT;
    const camZ = drive.position - zShift;
    const p1 = project(0, seg.y1, index * SEGMENT_LENGTH, drive.x * ROAD_WIDTH - x, camY, camZ, w, h);
    const p2 = project(0, seg.y2, (index + 1) * SEGMENT_LENGTH, drive.x * ROAD_WIDTH - x - dx, camY, camZ, w, h);
    x += dx;
    dx += seg.curve;
    if (!p1 || !p2 || p2.y >= p1.y || p2.y >= maxY) continue;

    const rumble = Math.floor(index / 3) % 2 === 0;
    const span = p1.y - p2.y;
    ctx.fillStyle = "#2c6b3e";
    ctx.fillRect(0, Math.floor(p2.y), w, Math.ceil(span) + 1);
    quad(ctx, p1.x, p1.y, p1.w * 1.18, p2.x, p2.y, p2.w * 1.18, rumble ? "#f4f1ea" : "#c0392b");
    quad(ctx, p1.x, p1.y, p1.w, p2.x, p2.y, p2.w, rumble ? "#4b4b4b" : "#3c3c3c");
    if (index % 6 < 3) quad(ctx, p1.x, p1.y, p1.w * 0.045, p2.x, p2.y, p2.w * 0.045, "#f7f3ea");
    if (index === track.finish) quad(ctx, p1.x, p1.y, p1.w, p2.x, p2.y, p2.w, "#f8fafc");

    if (index % 8 === 0) {
      const side = index % 16 === 0 ? -1 : 1;
      const tx = p2.x + side * p2.w * 1.55;
      tree(ctx, tx, p2.y, Math.max(4, p2.w * 0.35));
    }
    maxY = p2.y;
  }

  ctx.save();
  ctx.translate(w / 2 + lean * 18, h - 26);
  ctx.rotate(lean * 0.18);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 10, 34, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#111";
  ctx.fillRect(-30, 2, 12, 10);
  ctx.fillRect(18, 2, 12, 10);
  ctx.fillStyle = "#e85d04";
  ctx.beginPath();
  ctx.moveTo(-18, 8);
  ctx.lineTo(18, 8);
  ctx.lineTo(14, -8);
  ctx.lineTo(-14, -8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffd166";
  ctx.fillRect(-8, -6, 16, 8);
  ctx.restore();
}
