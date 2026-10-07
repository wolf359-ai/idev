#!/usr/bin/env python3
"""Generate original Factory Line Operations Splunk app icons.

Industrial mark (station columns on a conveyor). Not derived from any
other product artwork. Stdlib only — no image libraries, no source PNGs.
"""

from __future__ import annotations

import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Nav color from packages/factory_line_ops/default/data/ui/nav/default.xml
BG = (11, 61, 46, 255)  # #0B3D2E
BG_ALT = (232, 244, 238, 255)  # light selected-state variant
AMBER = (240, 180, 41, 255)  # #F0B429
MINT = (124, 182, 154, 255)
CREAM = (236, 244, 240, 255)
INK = (11, 61, 46, 255)

GLYPHS = {
    "F": [
        "#####",
        "#    ",
        "#### ",
        "#    ",
        "#    ",
    ],
    "L": [
        "#    ",
        "#    ",
        "#    ",
        "#    ",
        "#####",
    ],
    "O": [
        " ### ",
        "#   #",
        "#   #",
        "#   #",
        " ### ",
    ],
}


class Canvas:
    def __init__(self, width: int, height: int, fill: tuple[int, int, int, int]) -> None:
        self.width = width
        self.height = height
        self.px = [fill] * (width * height)

    def _set(self, x: int, y: int, color: tuple[int, int, int, int]) -> None:
        if 0 <= x < self.width and 0 <= y < self.height:
            self.px[y * self.width + x] = color

    def fill_rect(self, x: int, y: int, w: int, h: int, color: tuple[int, int, int, int]) -> None:
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self._set(xx, yy, color)

    def fill_disc(self, cx: int, cy: int, r: int, color: tuple[int, int, int, int]) -> None:
        r2 = r * r
        for yy in range(cy - r, cy + r + 1):
            for xx in range(cx - r, cx + r + 1):
                if (xx - cx) * (xx - cx) + (yy - cy) * (yy - cy) <= r2:
                    self._set(xx, yy, color)

    def rounded_rect(
        self, x: int, y: int, w: int, h: int, r: int, color: tuple[int, int, int, int]
    ) -> None:
        self.fill_rect(x + r, y, w - 2 * r, h, color)
        self.fill_rect(x, y + r, w, h - 2 * r, color)
        self.fill_disc(x + r, y + r, r, color)
        self.fill_disc(x + w - 1 - r, y + r, r, color)
        self.fill_disc(x + r, y + h - 1 - r, r, color)
        self.fill_disc(x + w - 1 - r, y + h - 1 - r, r, color)

    def blit(self, other: "Canvas", ox: int, oy: int) -> None:
        for yy in range(other.height):
            for xx in range(other.width):
                self._set(ox + xx, oy + yy, other.px[yy * other.width + xx])

    def write_png(self, path: Path) -> None:
        def chunk(tag: bytes, data: bytes) -> bytes:
            crc = zlib.crc32(tag + data) & 0xFFFFFFFF
            return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)

        raw = bytearray()
        for y in range(self.height):
            raw.append(0)
            for x in range(self.width):
                raw.extend(self.px[y * self.width + x])
        ihdr = struct.pack(">IIBBBBB", self.width, self.height, 8, 6, 0, 0, 0)
        png = (
            b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", ihdr)
            + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
            + chunk(b"IEND", b"")
        )
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(png)


def draw_mark(
    size: int,
    *,
    bg: tuple[int, int, int, int],
    station_a: tuple[int, int, int, int],
    station_b: tuple[int, int, int, int],
    station_c: tuple[int, int, int, int],
    belt: tuple[int, int, int, int],
) -> Canvas:
    """Station columns of mixed height on a conveyor — a factory line, not a lettermark."""
    s = size / 36.0
    c = Canvas(size, size, bg)
    radius = max(2, int(round(4 * s)))
    c.rounded_rect(0, 0, size, size, radius, bg)

    def r(x: float, y: float, w: float, h: float, color: tuple[int, int, int, int]) -> None:
        c.fill_rect(int(round(x * s)), int(round(y * s)), max(1, int(round(w * s))), max(1, int(round(h * s))), color)

    # Conveyor
    r(5, 26, 22, 3, belt)
    # Flow chevron (rightward)
    r(27, 25, 2, 5, belt)
    r(29, 26, 2, 3, belt)
    r(31, 27, 2, 1, belt)
    # Stations: short / tall / mid
    r(6, 16, 6, 10, station_a)
    r(15, 8, 6, 18, station_b)
    r(24, 13, 6, 13, station_c)
    # Status ticks on the live station
    r(16, 10, 4, 2, bg)
    return c


def draw_glyph(
    canvas: Canvas,
    ch: str,
    ox: int,
    oy: int,
    pixel: int,
    color: tuple[int, int, int, int],
) -> int:
    rows = GLYPHS[ch]
    for gy, row in enumerate(rows):
        for gx, cell in enumerate(row):
            if cell == "#":
                canvas.fill_rect(ox + gx * pixel, oy + gy * pixel, pixel, pixel, color)
    return len(rows[0]) * pixel


def draw_logo(scale: int, *, alt: bool = False) -> Canvas:
    width, height = 160 * scale, 40 * scale
    bg = BG_ALT if alt else BG
    cream = INK if alt else CREAM
    belt = AMBER
    icon = draw_mark(
        36 * scale,
        bg=bg,
        station_a=MINT if not alt else (76, 140, 118, 255),
        station_b=belt,
        station_c=cream,
        belt=belt,
    )
    c = Canvas(width, height, bg)
    c.rounded_rect(0, 0, width, height, 4 * scale, bg)
    c.blit(icon, 2 * scale, 2 * scale)
    pixel = 3 * scale
    x = 44 * scale
    y = 9 * scale
    for i, ch in enumerate("FLO"):
        x += draw_glyph(c, ch, x, y, pixel, cream) + (3 * scale if i < 2 else 0)
    # Rule under the wordmark — the production line
    c.fill_rect(44 * scale, 32 * scale, 72 * scale, 2 * scale, belt)
    return c


def write_set(dest: Path) -> None:
    dest.mkdir(parents=True, exist_ok=True)
    draw_mark(
        36,
        bg=BG,
        station_a=MINT,
        station_b=AMBER,
        station_c=CREAM,
        belt=AMBER,
    ).write_png(dest / "appIcon.png")
    draw_mark(
        72,
        bg=BG,
        station_a=MINT,
        station_b=AMBER,
        station_c=CREAM,
        belt=AMBER,
    ).write_png(dest / "appIcon_2x.png")
    draw_mark(
        36,
        bg=BG_ALT,
        station_a=(76, 140, 118, 255),
        station_b=AMBER,
        station_c=INK,
        belt=AMBER,
    ).write_png(dest / "appIconAlt.png")
    draw_mark(
        72,
        bg=BG_ALT,
        station_a=(76, 140, 118, 255),
        station_b=AMBER,
        station_c=INK,
        belt=AMBER,
    ).write_png(dest / "appIconAlt_2x.png")
    draw_logo(1).write_png(dest / "appLogo.png")
    draw_logo(2).write_png(dest / "appLogo_2x.png")


def main() -> None:
    apps = (
        ROOT / "packages" / "factory_line_ops" / "appserver" / "static",
        ROOT / "packages" / "TA-factory_line" / "appserver" / "static",
    )
    for dest in apps:
        write_set(dest)
        gitkeep = dest / ".gitkeep"
        if gitkeep.exists():
            gitkeep.unlink()
        print(f"Wrote icons in {dest.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
