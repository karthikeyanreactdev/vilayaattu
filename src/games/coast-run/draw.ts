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
  ctx.fillStyle = "#166534";
  ctx.beginPath();
  ctx.moveTo(x, y - s * 2.2);
  ctx.lineTo(x - s * 0.72, y);
  ctx.lineTo(x + s * 0.72, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#14532d";
  ctx.beginPath();
  ctx.moveTo(x, y - s * 1.35);
  ctx.lineTo(x - s * 0.48, y - s * 0.15);
  ctx.lineTo(x + s * 0.48, y - s * 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#3f2a1d";
  ctx.fillRect(x - s * 0.1, y - s * 0.05, s * 0.2, s * 0.4);
}

export type CoastSprite = {
  /** Lateral position in road units. 0 is the middle of the asphalt. */
  x: number;
  /** Distance along the road. */
  z: number;
  color: string;
  name: string;
};

export const CAR_COLORS = ["#e85d04", "#38bdf8", "#f8fafc", "#a3e635"];

/** A small car. `s` is its length in pixels. */
export function paintCar(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, name: string | null, lean = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean * 0.16);
  const w = s * 0.72;
  const h = s;
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, h * 0.42, w * 0.85, h * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#111";
  ctx.fillRect(-w * 0.95, h * 0.12, w * 0.32, h * 0.22);
  ctx.fillRect(w * 0.63, h * 0.12, w * 0.32, h * 0.22);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-w * 0.7, h * 0.38);
  ctx.lineTo(w * 0.7, h * 0.38);
  ctx.lineTo(w * 0.48, -h * 0.05);
  ctx.lineTo(w * 0.28, -h * 0.42);
  ctx.lineTo(-w * 0.28, -h * 0.42);
  ctx.lineTo(-w * 0.48, -h * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = color === "#f8fafc" ? "#0f172a" : "#fff7ed";
  ctx.fillRect(-w * 0.22, -h * 0.28, w * 0.44, h * 0.22);
  if (name) {
    ctx.font = `700 ${Math.max(11, Math.round(s * 0.28))}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0,0,0,0.65)";
    ctx.strokeText(name, 0, -h * 0.55);
    ctx.fillStyle = "#fff";
    ctx.fillText(name, 0, -h * 0.55);
  }
  ctx.restore();
}

/** Paint one frame. The camera follows `drive`. Other cars share that picture. */
export function drawCoast(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  drive: Drive,
  track: Track,
  lean: number,
  cars: CoastSprite[],
  me: { color: string; name: string } | null,
) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#16324f");
  sky.addColorStop(0.38, "#f08a5d");
  sky.addColorStop(0.62, "#f6d365");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255,246,216,0.95)";
  ctx.beginPath();
  ctx.arc(w * 0.78, h * 0.18, Math.min(w, h) * 0.055, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.ellipse(w * 0.22, h * 0.16, w * 0.08, h * 0.025, 0, 0, Math.PI * 2);
  ctx.ellipse(w * 0.3, h * 0.15, w * 0.05, h * 0.02, 0, 0, Math.PI * 2);
  ctx.fill();

  const baseIndex = Math.floor(drive.position / SEGMENT_LENGTH) % track.segments.length;
  const base = track.segments[baseIndex];
  const basePercent = (drive.position % SEGMENT_LENGTH) / SEGMENT_LENGTH;
  const playerY = base.y1 + (base.y2 - base.y1) * basePercent;
  let x = 0;
  let dx = -(base.curve * basePercent);
  let maxY = h;
  const sprites: { sx: number; sy: number; s: number; car: CoastSprite }[] = [];
  const placeSprite = (sprite: { sx: number; sy: number; s: number; car: CoastSprite }) => {
    for (let guard = 0; guard < 6; guard++) {
      const hit = sprites.find(
        (o) => Math.abs(o.sy - sprite.sy) < Math.max(o.s, sprite.s) * 0.8 && Math.abs(o.sx - sprite.sx) < Math.max(o.s, sprite.s) * 0.85,
      );
      if (!hit) break;
      const dir = sprite.sx > hit.sx ? 1 : sprite.sx < hit.sx ? -1 : sprites.length % 2 === 0 ? 1 : -1;
      sprite.sx += dir * Math.max(hit.s, sprite.s) * 0.75;
    }
    const pad = Math.max(16, sprite.s * 0.7);
    sprite.sx = Math.max(pad, Math.min(w - pad, sprite.sx));
    sprites.push(sprite);
  };

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
    if (!p2) continue;
    const drawable = !!p1 && p2.y < p1.y && p2.y < maxY;
    if (drawable && p1) {
    const rumble = Math.floor(index / 3) % 2 === 0;
    const span = p1.y - p2.y;
    ctx.fillStyle = "#23724a";
    ctx.fillRect(0, Math.floor(p2.y), w, Math.ceil(span) + 1);
    // A strip of sea on the far left of the first grass, so the coast reads as a coast.
    if (n > DRAW_DISTANCE - 8) {
      ctx.fillStyle = "rgba(56, 140, 168, 0.55)";
      ctx.fillRect(0, Math.floor(p2.y), w * 0.18, Math.ceil(span) + 1);
    }
    quad(ctx, p1.x, p1.y, p1.w * 1.18, p2.x, p2.y, p2.w * 1.18, rumble ? "#f4f1ea" : "#c0392b");
    quad(ctx, p1.x, p1.y, p1.w, p2.x, p2.y, p2.w, rumble ? "#3a3a3a" : "#2a2a2a");
    if (index % 6 < 3) quad(ctx, p1.x, p1.y, p1.w * 0.04, p2.x, p2.y, p2.w * 0.04, "#f7f3ea");
    if (index === track.finish) quad(ctx, p1.x, p1.y, p1.w, p2.x, p2.y, p2.w, "#f8fafc");

    if (index % 8 === 0) {
      const side = index % 16 === 0 ? -1 : 1;
      const tx = p2.x + side * p2.w * 1.7;
      tree(ctx, tx, p2.y, Math.max(4, p2.w * 0.32));
    }
    maxY = p2.y;
    }

    for (const car of cars) {
      const segIndex = Math.floor(car.z / SEGMENT_LENGTH);
      if (segIndex !== index || sprites.some((s) => s.car === car)) continue;
      const carZ = car.z + (looped ? track.segments.length * SEGMENT_LENGTH : 0);
      const ahead = carZ - drive.position;
      if (ahead < 0 || ahead > DRAW_DISTANCE * SEGMENT_LENGTH) continue;
      const rel = car.x - drive.x;
      // A car on your bumper has no road quad yet. Park it beside you so it stays in frame.
      if (ahead < SEGMENT_LENGTH * 0.65) {
        const lane = Math.abs(rel) < 0.08 ? (cars.indexOf(car) % 2 === 0 ? -0.22 : 0.22) : rel;
        placeSprite({
          sx: w / 2 + lane * w * 0.36,
          sy: h * 0.68,
          s: Math.min(72, h * 0.15),
          car,
        });
        continue;
      }
      placeSprite({
        sx: p2.x + rel * p2.w,
        sy: p2.y,
        s: Math.max(16, Math.min(h * 0.24, p2.w * 0.28)),
        car,
      });
    }
  }

  // Anyone who has fallen behind still shares this picture, at the bottom edge.
  cars.forEach((car, i) => {
    if (sprites.some((s) => s.car === car)) return;
    if (car.z > drive.position) return;
    const rel = car.x - drive.x;
    const lane = rel === 0 ? (i % 2 === 0 ? -1 : 1) : Math.sign(rel);
    const s = Math.min(52, h * 0.12);
    placeSprite({
      sx: w / 2 + lane * w * 0.32,
      sy: h - 10 - s * 0.45,
      s,
      car,
    });
  });

  sprites.sort((a, b) => a.sy - b.sy);
  for (const sprite of sprites) {
    const crowded = sprites.some(
      (o) => o !== sprite && Math.abs(o.sx - sprite.sx) < 56 && Math.abs(o.sy - sprite.sy) < sprite.s,
    );
    paintCar(ctx, sprite.sx, sprite.sy, sprite.s, sprite.car.color, crowded ? null : sprite.car.name);
  }

  if (me) paintCar(ctx, w / 2 + lean * 18, h - 28, Math.min(78, h * 0.16), me.color, null, lean);
}
