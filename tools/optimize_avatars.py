"""Recria os avatares WebP a partir dos PNG oficiais da LISE.

Usa o encoder WebP do Chromium já exigido pelos testes de navegador, evitando
uma segunda biblioteca de imagem apenas para este passo de manutenção.
"""
from __future__ import annotations

import base64
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
AVATAR_DIR = ROOT / "frontend_spa" / "assets" / "avatars"
QUALITY = 0.92
PNG_NAMES = (
    "axolote",
    "beija-flor",
    "chimpanze",
    "coruja",
    "golfinho",
    "louva-a-deus",
    "polvo",
    "suricato",
    "tartaruga",
)


def encode_webp(page, source: Path) -> tuple[bytes, int, int]:
    source_url = "data:image/png;base64," + base64.b64encode(source.read_bytes()).decode("ascii")
    result = page.evaluate(
        """async ({source, quality}) => {
          const image = new Image();
          image.src = source;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          canvas.getContext('2d', {alpha: false}).drawImage(image, 0, 0);
          const encoded = canvas.toDataURL('image/webp', quality);
          if (!encoded.startsWith('data:image/webp;base64,')) {
            throw new Error('Este navegador não oferece encoder WebP.');
          }
          return {
            data: encoded.slice(encoded.indexOf(',') + 1),
            width: canvas.width,
            height: canvas.height,
          };
        }""",
        {"source": source_url, "quality": QUALITY},
    )
    return base64.b64decode(result["data"]), result["width"], result["height"]


def main() -> None:
    expected = {f"{name}.png" for name in PNG_NAMES}
    available = {path.name for path in AVATAR_DIR.glob("*.png")}
    if available != expected:
        missing = sorted(expected - available)
        unexpected = sorted(available - expected)
        raise SystemExit(f"Catálogo PNG divergente. Ausentes={missing}; inesperados={unexpected}")

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel="msedge", headless=True)
        page = browser.new_page()
        try:
            for name in PNG_NAMES:
                source = AVATAR_DIR / f"{name}.png"
                target = AVATAR_DIR / f"{name}.webp"
                encoded, width, height = encode_webp(page, source)
                if (width, height) != (1254, 1254):
                    raise SystemExit(f"Dimensão inesperada em {source.name}: {width}×{height}")
                if not (encoded.startswith(b"RIFF") and encoded[8:12] == b"WEBP"):
                    raise SystemExit(f"Saída WebP inválida para {source.name}")
                temporary = target.with_suffix(".webp.tmp")
                temporary.write_bytes(encoded)
                temporary.replace(target)
                reduction = 100 * (1 - target.stat().st_size / source.stat().st_size)
                print(f"{target.name}: {target.stat().st_size / 1024:.1f} KiB ({reduction:.1f}% menor)")
        finally:
            browser.close()

    obsolete = AVATAR_DIR / "tardigrado.webp"
    if obsolete.exists():
        obsolete.unlink()
        print("tardigrado.webp removido; o avatar continua em SVG.")


if __name__ == "__main__":
    main()
