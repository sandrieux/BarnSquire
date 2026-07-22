// Turns a QR module matrix into a 3D-printable binary STL: a base plate with the
// dark modules raised as relief, an optional framing rim, and an optional
// zip-tie mount loop. No external mesh/CSG dependency — we emit closed
// axis-aligned boxes (base plate + one box per dark module + frame/mount bars)
// and let the slicer union the overlapping solids at slice time, which is the
// standard, reliable approach for relief-on-plate prints.

export interface QrStlOptions {
  /** Overall tag width/height in mm (square). */
  tagSizeMm?: number;
  /** Plate thickness in mm. */
  baseThicknessMm?: number;
  /** How far the dark modules rise above the plate, in mm. */
  moduleHeightMm?: number;
  /** Blank quiet-zone border, in modules, kept between the code and the edge/rim. */
  quietZoneModules?: number;
  /** Raised rim width in mm around the perimeter (0 = no rim). */
  borderMm?: number;
  /** Add a zip-tie mount loop above the top edge. */
  mountSlot?: boolean;
}

const DEFAULTS: Required<QrStlOptions> = {
  tagSizeMm: 50,
  baseThicknessMm: 2,
  moduleHeightMm: 1.2,
  quietZoneModules: 4,
  borderMm: 0,
  mountSlot: true,
};

type Vec3 = [number, number, number];
type Triangle = { n: Vec3; v: [Vec3, Vec3, Vec3] };

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function normalize(a: Vec3): Vec3 {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

// Two CCW-from-outside triangles for a quad; the stored normal is computed from
// the winding so it always agrees with the geometry.
function quad(tris: Triangle[], a: Vec3, b: Vec3, c: Vec3, d: Vec3) {
  const n = normalize(cross(sub(b, a), sub(c, a)));
  tris.push({ n, v: [a, b, c] });
  tris.push({ n, v: [a, c, d] });
}

// A closed, watertight axis-aligned box.
function box(tris: Triangle[], x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
  if (x1 <= x0 || y1 <= y0 || z1 <= z0) return;
  const v000: Vec3 = [x0, y0, z0], v100: Vec3 = [x1, y0, z0], v110: Vec3 = [x1, y1, z0], v010: Vec3 = [x0, y1, z0];
  const v001: Vec3 = [x0, y0, z1], v101: Vec3 = [x1, y0, z1], v111: Vec3 = [x1, y1, z1], v011: Vec3 = [x0, y1, z1];
  quad(tris, v001, v101, v111, v011); // top    (+z)
  quad(tris, v000, v010, v110, v100); // bottom (-z)
  quad(tris, v000, v100, v101, v001); // front  (-y)
  quad(tris, v010, v011, v111, v110); // back   (+y)
  quad(tris, v000, v001, v011, v010); // left   (-x)
  quad(tris, v100, v110, v111, v101); // right  (+x)
}

// A rectangular frame (outer rect minus a centered hole) as four bars — a
// closed loop you can thread a zip tie or screw through.
function rectRing(
  tris: Triangle[],
  ox0: number, oy0: number, ox1: number, oy1: number,
  hx0: number, hy0: number, hx1: number, hy1: number,
  z0: number, z1: number
) {
  // box() takes (x0, y0, z0, x1, y1, z1).
  box(tris, ox0, oy0, z0, ox1, hy0, z1);          // bottom bar
  box(tris, ox0, hy1, z0, ox1, oy1, z1);          // top bar
  box(tris, ox0, hy0, z0, hx0, hy1, z1);          // left bar
  box(tris, hx1, hy0, z0, ox1, hy1, z1);          // right bar
}

function serializeBinaryStl(tris: Triangle[]): ArrayBuffer {
  const buf = new ArrayBuffer(84 + tris.length * 50);
  const dv = new DataView(buf);
  dv.setUint32(80, tris.length, true); // 80-byte header left zeroed
  let off = 84;
  for (const t of tris) {
    dv.setFloat32(off, t.n[0], true); dv.setFloat32(off + 4, t.n[1], true); dv.setFloat32(off + 8, t.n[2], true);
    off += 12;
    for (const p of t.v) {
      dv.setFloat32(off, p[0], true); dv.setFloat32(off + 4, p[1], true); dv.setFloat32(off + 8, p[2], true);
      off += 12;
    }
    dv.setUint16(off, 0, true); // attribute byte count
    off += 2;
  }
  return buf;
}

/**
 * Build an STL from a QR matrix. `modules[row][col] === true` is a dark module.
 * Row 0 is the top row, so the relief reads un-mirrored from the +Z (printed) face.
 */
export function qrMatrixToStl(modules: boolean[][], options: QrStlOptions = {}): Blob {
  const o = { ...DEFAULTS, ...options };
  const n = modules.length;
  if (!n) throw new Error("Empty QR matrix");

  const tris: Triangle[] = [];
  const size = o.tagSizeMm;
  const base = o.baseThicknessMm;
  const top = base + o.moduleHeightMm;

  // Base plate.
  box(tris, 0, 0, 0, size, size, base);

  // Optional raised rim around the perimeter.
  if (o.borderMm > 0) {
    rectRing(
      tris,
      0, 0, size, size,
      o.borderMm, o.borderMm, size - o.borderMm, size - o.borderMm,
      base, top
    );
  }

  // The code + its quiet zone live inside the rim.
  const inner = size - 2 * o.borderMm;
  const pitch = inner / (n + 2 * o.quietZoneModules);
  const origin = o.borderMm + o.quietZoneModules * pitch;

  for (let row = 0; row < n; row++) {
    const line = modules[row]!;
    for (let col = 0; col < n; col++) {
      if (!line[col]) continue;
      const x0 = origin + col * pitch;
      // Flip rows so row 0 is at the top (y high).
      const y0 = origin + (n - 1 - row) * pitch;
      box(tris, x0, y0, base, x0 + pitch, y0 + pitch, top);
    }
  }

  // Zip-tie mount loop centered above the top edge.
  if (o.mountSlot) {
    const cx = size / 2;
    const tabW = Math.min(18, size * 0.4);
    const tabH = 10;
    const holeW = tabW * 0.5;
    const holeH = 4;
    const oy0 = size - 2;            // overlap the plate so it fuses
    const oy1 = size + tabH;
    const hy0 = size + 2;
    rectRing(
      tris,
      cx - tabW / 2, oy0, cx + tabW / 2, oy1,
      cx - holeW / 2, hy0, cx + holeW / 2, hy0 + holeH,
      0, base
    );
  }

  return new Blob([serializeBinaryStl(tris)], { type: "model/stl" });
}
