"""Agrupa o CSS da SPA em seis arquivos sem alterar a ordem da cascata."""
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STYLES = ROOT / "frontend_spa" / "styles"
GROUPS = {
    "bundle-foundation.css": ("tokens.css", "layout.css", "components.css"),
    "bundle-screens.css": ("screens.css", "activities.css", "interactions.css"),
    "bundle-polish.css": ("polish.css", "refinements.css", "elegance.css"),
    "bundle-responsive.css": ("memory-focus.css", "responsive.css", "palette.css"),
    "bundle-theme.css": ("themes.css", "access.css", "compact.css", "welcome.css"),
    "bundle-final.css": ("final-fixes.css", "auth-refresh.css", "mobile-ux.css"),
}


def main() -> None:
    for output, sources in GROUPS.items():
        parts = ["/* Gerado por tools/build_css.py. Edite os arquivos-fonte, não este bundle. */\n"]
        for source in sources:
            path = STYLES / source
            parts.append(f"\n/* source: {source} */\n")
            parts.append(path.read_text(encoding="utf-8-sig").rstrip() + "\n")
        target = STYLES / output
        target.write_text("".join(parts), encoding="utf-8", newline="\n")
        print(f"{output}: {', '.join(sources)}")


if __name__ == "__main__":
    main()
