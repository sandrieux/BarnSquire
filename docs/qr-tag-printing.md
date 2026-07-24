# QR Tag 3D-Printing — Best Practices

The **Tags** page (web app) generates both a **PNG** (print on paper/sticker) and
a **3D-printable STL** for every barn, location, and animal. This guide covers how
to print the STL tags so they scan quickly and reliably. It's based on test prints
— three tags at different settings — summarized below.

## TL;DR

| Setting | Recommendation |
| --- | --- |
| **Layer height** | **0.18–0.20 mm** — not 0.30 mm |
| **Tag size** | **50 mm** for stall doors; **75 mm** when scanned from farther / in poor light |
| **Contrast** | **Swap filament color** at the base→module boundary (or paint the raised squares) — the single biggest reliability factor |
| **Module height** | **1.2 mm** (the default) |
| **Orientation** | Flat on the bed, QR face up, **no supports** |
| **Material** | **PETG or ABS/ASA** — resists barn heat and sun far better than PLA |
| **Finish** | **Matte** filament — avoid glossy/silk/metallic (glare blinds the camera) |

## What the test prints showed

Three tags of the same code, each printed at different settings:

| Sample | Layer height | Tag size | Contrast | Result |
| --- | --- | --- | --- | --- |
| **A** | 0.30 mm | 50 × 50 mm | none (raised modules in the base color) | Scannable but **not ideal** — coarse layers round the module edges and the low contrast forces the scanner to rely on shadow alone |
| **B** *(recommended)* | 0.18 mm | 50 × 50 mm | raised modules in a contrasting color | **Optimal** — crisp square modules, high contrast, fast lock |
| **C** | 0.18 mm | 75 × 75 mm | raised modules in a contrasting color | **Excellent**, and the easiest to scan from a distance |

Two variables did the work: dropping the layer height **0.30 → 0.18 mm** sharpened
the modules, and adding **color contrast** (raised modules in a second color) made
the code readable regardless of lighting angle. The 75 mm size (sample **C**) is
simply more forgiving still.

## 1. Layer height — use 0.18–0.20 mm

A QR scanner needs crisp light/dark boundaries between modules. At **0.30 mm** the
layers round and blob the small raised squares, and adjacent modules start to merge
— it still scans (sample A does), but it's marginal and fails more often at an angle
or in low light. **0.18–0.20 mm** prints clean-edged modules. Going finer
than 0.18 mm helps very little and just adds print time.

## 2. Tag size — 50 mm is the default, 75 mm is more forgiving

Set this with the **Tag size (mm)** control on the Tags page (range 20–200 mm).

- **50 mm** is compact and fine for a tag the phone is held close to (a stall door,
  a halter).
- **75 mm** has larger individual modules, so it scans faster, from farther away,
  and tolerates print artifacts, dust, and grime much better. Use it for anything
  scanned in passing or in a dim barn aisle.

Bigger modules = more built-in error tolerance. If in doubt, size up.

## 3. Contrast — the single biggest factor

A scanner reads **dark vs. light**, not height. A one-color tag (raised modules in
the base color, like sample A) only reads because the relief casts a shadow — which
works at some angles and lighting and not others. Add **real color contrast** and it
reads every time:

- **Filament color swap (recommended).** Insert a color change at the boundary
  between the base and the raised modules, so the modules print in a second color.
  In PrusaSlicer/OrcaSlicer use *Add color change* on the layer-height slider (or a
  manual `M600`) at **Z = 2.0 mm** — the base is 2 mm thick and the modules rise
  1.2 mm above it, so everything below 2.0 mm is the background color and everything
  above is the module color. At a 0.18 mm layer height that's ~6 top-color layers —
  plenty of coverage.
- **Multi-material / AMS.** Assign the module color directly, no manual swap.
- **Paint.** The raised modules are the highest surface, so a foam roller, paint
  pen, or a light sanding pass over painted tops colors only the module faces.

**Polarity:** both *dark-on-light* and *light-on-dark* scan reliably as long as the
contrast is strong — e.g. light raised modules on a darker base (inverted) read
fine, and the app's scanner handles either. If you ever meet a stubborn third-party
scanner, fall back to the textbook scheme: **dark raised modules on a light base**.

**Color pairing:** pick a high-contrast pair — white/black, white/red, yellow/black.
Avoid low-contrast pairs (red/orange, blue/black) and translucent filament for the
modules. Prefer **matte** filament; glossy, silk, and metallic finishes throw
specular highlights that can wash out the camera.

## 4. Module height — keep it around 1.2 mm

The **Module height (mm)** control defaults to **1.2 mm** (range 0.4–5). Keep it in
the **1.0–1.5 mm** band:

- Tall enough for a solid multi-layer color swap and a clear shadow.
- Not so tall that modules cast harsh self-shadows or waste filament.

0.4 mm is too shallow for a dependable color swap; heights above ~1.5 mm give
diminishing returns.

## 5. Print setup

- **Orientation:** flat on the bed, QR face up — exactly as the STL is exported
  (row 0 is the top, so the code reads un-mirrored from the printed top face). **No
  supports** needed.
- **Nozzle:** a standard 0.4 mm nozzle is fine. At 50 mm the module pitch is roughly
  1.1–1.4 mm, which is a few extrusion widths per module — another reason to keep
  layers fine so edges stay square.
- **Keep the quiet zone.** The generator already bakes in a 4-module blank border
  around the code — don't crop or shrink the tag into it.
- **Mounting:** leave the **zip-tie mount slot** enabled (default) and thread a zip
  tie or S-hook through the loop to hang the tag. The loop prints in the base color.
- **Name label:** leave **Emboss name** on (default) to raise the location/animal
  name under the code (e.g. a stall number or a horse's name), so a shelf of tags is
  legible before scanning. Give it the same color swap as the modules for readability.

## 6. Material — prefer PETG or ABS/ASA over PLA

Barn tags live in heat and sunlight, and **PLA is the wrong material for that**. PLA
softens and warps at ~50–60 °C — a closed barn in summer, a sunny window, or direct
sun on a stall door can reach that, and a warped tag distorts the code and can stop
it scanning. Print tags in a heat- and weather-resistant filament instead:

- **PETG** — the easiest recommendation. Handles ~80 °C, is tough and moisture-
  resistant, and prints on any printer without an enclosure. Good all-round choice.
- **ABS / ASA** — highest heat resistance (~95–100 °C); **ASA** is also UV-stable,
  so it's the best pick for tags in direct, year-round sun. These need an enclosure
  and good ventilation to print well.

The filament color swap for contrast (section 3) works identically in any of these —
just use two spools of the same material.

## Recommended recipe (sample B)

- Tag size **50 mm**, module height **1.2 mm**, mount slot **on**, emboss name **on**
- Material **PETG** (or ASA for full-sun tags), **matte**
- Slicer layer height **0.18 mm**
- Color change at **Z = 2.0 mm** — e.g. a red base with white modules (and a matching
  white name)

For a larger tag (sample C), keep everything the same and set **Tag size = 75 mm**.

## No 3D printer? Use the PNG

The PNG export is the zero-printer path: print it on paper or an adhesive label,
then laminate or slip it into a sleeve for the barn. Print it black-on-white at a
generous size and it will always be maximum contrast.
