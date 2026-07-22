import { z } from "zod";

// QR-tag payloads. The web app ENCODES these into printable/3D-printed codes;
// the mobile scanner PARSES them. Lives in @barnsquire/validators because both
// web and mobile import it (single source of truth, no drift).

export const tagTypeSchema = z.enum([
  "animal",
  "barn",
  "building",
  "stall",
  "pasture",
  "arena",
]);
export type TagType = z.infer<typeof tagTypeSchema>;

export interface TagPayload {
  type: TagType;
  // The barn the tagged entity lives in. Always present in newly-encoded tags so
  // the scanner can switch barn + resolve context without a bare-id lookup
  // (there is no id→barn resolver endpoint). Optional only for legacy animal tags.
  barnId?: string;
  id: string;
}

const SCHEME = "barnsquire";
const TAG_TYPES = tagTypeSchema.options as readonly TagType[];

// Encoded as an app deep link so an OS-camera scan opens the `scan` route
// directly (expo-router filesystem linking), which handles the same dispatch as
// a live in-app scan. For a barn tag, id === barnId.
export function encodeTag(payload: { type: TagType; barnId: string; id: string }): string {
  const b = encodeURIComponent(payload.barnId);
  const id = encodeURIComponent(payload.id);
  return `${SCHEME}://scan?t=${payload.type}&b=${b}&id=${id}`;
}

function parseQuery(qs: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of qs.split("&")) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    try {
      out[decodeURIComponent(pair.slice(0, eq))] = decodeURIComponent(pair.slice(eq + 1));
    } catch {
      // ignore malformed component
    }
  }
  return out;
}

// Parses any scanned string. Returns null if it isn't a BarnSquire tag.
// Hand-rolls the query parse (no URL/URLSearchParams) so it works uniformly in
// Hermes (React Native) without a polyfill.
export function parseTag(data: string): TagPayload | null {
  const s = (data ?? "").trim();
  if (!s) return null;

  // Current form: "...scan?t=<type>&b=<barnId>&id=<id>"
  const q = s.indexOf("?");
  if (q !== -1) {
    const params = parseQuery(s.slice(q + 1));
    const t = params["t"];
    const id = params["id"];
    if (t && (TAG_TYPES as readonly string[]).includes(t) && id) {
      const barnId = params["b"] || (t === "barn" ? id : undefined);
      return { type: t as TagType, id, barnId };
    }
  }

  // Back-compat with the original scanner: a string containing "animal/<id>"…
  const m = s.match(/animal\/([a-z0-9]+)/i);
  if (m?.[1]) return { type: "animal", id: m[1] };

  // …or a bare cuid.
  if (/^c[a-z0-9]{20,}$/i.test(s)) return { type: "animal", id: s };

  return null;
}
