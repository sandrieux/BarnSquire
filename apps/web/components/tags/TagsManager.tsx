"use client";

import { useMemo, useState } from "react";
import QRCode from "qrcode";
import { useTranslations } from "next-intl";
import { Download, Image as ImageIcon, Loader2, Printer, Box } from "lucide-react";
import { encodeTag, type TagType } from "@barnsquire/validators";
import { trpc } from "@/lib/trpc/client";
import { qrMatrixToStl } from "@/lib/qr-stl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TagEntry {
  type: TagType;
  id: string;
  name: string;
  sub?: string;
}

const EC = "M" as const; // QR error-correction level (balance of density vs. tolerance)

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function safeName(s: string) {
  return s.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase() || "tag";
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}

// Bare QR module matrix (no margin — the STL builder adds its own quiet zone).
function qrMatrix(text: string): boolean[][] {
  const qr = QRCode.create(text, { errorCorrectionLevel: EC });
  const size = qr.modules.size;
  const data = qr.modules.data;
  const m: boolean[][] = [];
  for (let r = 0; r < size; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < size; c++) row.push(!!data[r * size + c]);
    m.push(row);
  }
  return m;
}

async function renderPngBlob(text: string, label: string): Promise<Blob> {
  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, text, { width: 512, margin: 4, errorCorrectionLevel: EC });
  const labelH = 72;
  const out = document.createElement("canvas");
  out.width = qrCanvas.width;
  out.height = qrCanvas.height + labelH;
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(qrCanvas, 0, 0);
  ctx.fillStyle = "#000000";
  ctx.font = "bold 30px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, out.width / 2, qrCanvas.height + labelH / 2, out.width - 32);
  return await new Promise<Blob>((resolve) => out.toBlob((b) => resolve(b!), "image/png"));
}

// Crop a bitmap to its ink bounding box so the STL scaler fills the label band
// tightly instead of scaling around whitespace.
function trimBitmap(rows: boolean[][]): boolean[][] {
  const has = (r: boolean[]) => r.some(Boolean);
  let top = 0, bot = rows.length - 1;
  while (top <= bot && !has(rows[top]!)) top++;
  while (bot >= top && !has(rows[bot]!)) bot--;
  if (bot < top) return [];
  let left = Infinity, right = -1;
  for (let r = top; r <= bot; r++) {
    const row = rows[r]!;
    for (let c = 0; c < row.length; c++) if (row[c]) { left = Math.min(left, c); right = Math.max(right, c); }
  }
  const out: boolean[][] = [];
  for (let r = top; r <= bot; r++) out.push(rows[r]!.slice(left, right + 1));
  return out;
}

// Rasterize a single line of text to a trimmed ink bitmap (row 0 = top) for the
// STL emboss. Shrinks the font to fit the tag width, then truncates with "…".
function rasterizeLabel(text: string): boolean[][] {
  const label = (text || "").trim();
  if (!label) return [];
  const W = 400, H = 80;                 // 8 px/mm over a 50mm × 10mm band
  const margin = 24;                     // ~3mm side margins
  const availW = W - 2 * margin;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  let font = Math.round(H * 0.7);
  const minFont = Math.round(H * 0.35);
  const setFont = (px: number) => { ctx.font = `bold ${px}px sans-serif`; };
  setFont(font);
  let display = label;
  while (ctx.measureText(display).width > availW && font > minFont) {
    font -= 2;
    setFont(font);
  }
  if (ctx.measureText(display).width > availW) {
    while (display.length > 1 && ctx.measureText(display + "…").width > availW) display = display.slice(0, -1);
    display += "…";
  }
  ctx.fillText(display, W / 2, H / 2, availW);

  const px = ctx.getImageData(0, 0, W, H).data;
  const rows: boolean[][] = [];
  for (let y = 0; y < H; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < W; x++) row.push(px[(y * W + x) * 4]! < 128);
    rows.push(row);
  }
  return trimBitmap(rows);
}

export function TagsManager({ barnId }: { barnId: string }) {
  const t = useTranslations("tags");
  const { data, isLoading } = trpc.tag.listTargets.useQuery({ barnId });

  const [tagSizeMm, setTagSizeMm] = useState(50);
  const [moduleHeightMm, setModuleHeightMm] = useState(1.2);
  const [mountSlot, setMountSlot] = useState(true);
  const [embossName, setEmbossName] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const sections = useMemo<{ key: string; label: string; items: TagEntry[] }[]>(() => {
    if (!data) return [];
    const s: { key: string; label: string; items: TagEntry[] }[] = [
      { key: "barn", label: t("barn"), items: [{ type: "barn", id: data.barn.id, name: data.barn.name }] },
      { key: "buildings", label: t("buildings"), items: data.buildings.map((b) => ({ type: "building", id: b.id, name: b.name })) },
      { key: "stalls", label: t("stalls"), items: data.stalls.map((x) => ({ type: "stall", id: x.id, name: x.name, sub: x.buildingName })) },
      { key: "pastures", label: t("pastures"), items: data.pastures.map((p) => ({ type: "pasture", id: p.id, name: p.name })) },
      { key: "arenas", label: t("arenas"), items: data.arenas.map((a) => ({ type: "arena", id: a.id, name: a.name })) },
      { key: "animals", label: t("animals"), items: data.animals.map((a) => ({ type: "animal", id: a.id, name: a.name })) },
    ];
    return s.filter((x) => x.items.length > 0);
  }, [data, t]);

  async function onPng(entry: TagEntry) {
    setBusy(`png:${entry.id}`);
    try {
      const text = encodeTag({ type: entry.type, barnId, id: entry.id });
      download(await renderPngBlob(text, entry.name), `${entry.type}-${safeName(entry.name)}.png`);
    } finally {
      setBusy(null);
    }
  }

  function onStl(entry: TagEntry) {
    setBusy(`stl:${entry.id}`);
    try {
      const text = encodeTag({ type: entry.type, barnId, id: entry.id });
      const label = embossName ? { bitmap: rasterizeLabel(entry.name) } : undefined;
      const blob = qrMatrixToStl(qrMatrix(text), { tagSizeMm, moduleHeightMm, mountSlot, label });
      download(blob, `${entry.type}-${safeName(entry.name)}.stl`);
    } finally {
      setBusy(null);
    }
  }

  async function onPrintSheet() {
    if (!data) return;
    setBusy("print");
    try {
      const all = sections.flatMap((s) => s.items);
      const cells = await Promise.all(
        all.map(async (e) => {
          const url = await QRCode.toDataURL(encodeTag({ type: e.type, barnId, id: e.id }), {
            width: 240,
            margin: 2,
            errorCorrectionLevel: EC,
          });
          return `<div class="cell"><img src="${url}" width="150" height="150"/><div class="lbl">${escapeHtml(e.name)}</div><div class="type">${e.type}</div></div>`;
        })
      );
      const win = window.open("", "_blank", "width=900,height=700");
      if (!win) return;
      win.document.write(
        `<!doctype html><html><head><title>${escapeHtml(data.barn.name)} — tags</title><style>
          body{font-family:sans-serif;margin:16px}
          .grid{display:flex;flex-wrap:wrap;gap:16px}
          .cell{border:1px solid #ddd;border-radius:8px;padding:10px;text-align:center;width:172px;page-break-inside:avoid}
          .lbl{font-weight:700;font-size:13px;margin-top:6px;word-break:break-word}
          .type{color:#666;font-size:11px;text-transform:uppercase}
        </style></head><body><div class="grid">${cells.join("")}</div></body></html>`
      );
      win.document.close();
      win.focus();
      win.print();
    } finally {
      setBusy(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> {t("loading")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("optionsTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label htmlFor="tagSize">{t("tagSizeMm")}</Label>
              <Input
                id="tagSize"
                type="number"
                min={20}
                max={200}
                value={tagSizeMm}
                onChange={(e) => setTagSizeMm(Number(e.target.value) || 50)}
                className="w-28"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="modHeight">{t("moduleHeightMm")}</Label>
              <Input
                id="modHeight"
                type="number"
                min={0.4}
                max={5}
                step={0.1}
                value={moduleHeightMm}
                onChange={(e) => setModuleHeightMm(Number(e.target.value) || 1.2)}
                className="w-28"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={mountSlot} onChange={(e) => setMountSlot(e.target.checked)} />
              {t("mountSlot")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={embossName} onChange={(e) => setEmbossName(e.target.checked)} />
              {t("embossName")}
            </label>
            <Button variant="outline" onClick={onPrintSheet} disabled={busy !== null}>
              <Printer className="h-4 w-4 mr-2" /> {t("printSheet")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("scanHint")}</p>
        </CardContent>
      </Card>

      {sections.map((section) => (
        <Card key={section.key}>
          <CardHeader>
            <CardTitle className="text-base">
              {section.label} <span className="text-muted-foreground font-normal">({section.items.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {section.items.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <div className="font-medium truncate">{entry.name}</div>
                  {entry.sub ? (
                    <Badge variant="secondary" className="mt-0.5">{entry.sub}</Badge>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="sm" onClick={() => onPng(entry)} disabled={busy !== null}>
                    {busy === `png:${entry.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                    <span className="ml-1">{t("png")}</span>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onStl(entry)} disabled={busy !== null}>
                    {busy === `stl:${entry.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Box className="h-4 w-4" />}
                    <span className="ml-1">{t("stl")}</span>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
