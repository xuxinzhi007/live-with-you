#!/usr/bin/env python3
"""Deliver one dress PNG as a 760x760 pre-baked transparent frame.

Official wardrobe path (not the Comfy color-key draft):

  python tools/deliver-dress-frame.py path/to/raw-or-rgb.png
  python tools/deliver-dress-frame.py path/to/raw.png --name dress-apricot-tea.png
  python tools/deliver-dress-frame.py path/to/raw.png --upload   # optional mini-host

Output defaults to tools/out/wenbao-assets/dress/<name>.png (RGBA).

Matting: border-connected flood-fill (see tools/wenbao_matting.py). Prefer this
over ImageColorToMask when the dress/socks/lace are near-white.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Allow `python tools/deliver-dress-frame.py` from repo root.
TOOLS = Path(__file__).resolve().parent
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))

from wenbao_matting import deliver_dress, load_spec, measure_frame  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("src", help="Source RGB/RGBA PNG (Comfy raw or any white-bg plate)")
    ap.add_argument("--name", help="Output filename under tools/out/wenbao-assets/dress/")
    ap.add_argument(
        "--method",
        choices=("flood", "colorkey"),
        default="flood",
        help="flood = border flood-fill (default, safer for white clothes); colorkey = draft",
    )
    ap.add_argument("--fmt", choices=("png", "webp"), default="png")
    ap.add_argument("--upload", action="store_true", help="Try optional mini-host upload")
    ap.add_argument("--upload-base", default=None, help="Override WENBAO_ASSETS_URL")
    ap.add_argument("--check-spec", action="store_true", help="Exit 1 if feet/cx outside tolerance")
    args = ap.parse_args()

    out = deliver_dress(
        args.src,
        out_name=args.name,
        method=args.method,
        fmt=args.fmt,
        upload=args.upload,
        upload_base=args.upload_base,
    )

    if args.check_spec:
        from PIL import Image

        spec = load_spec()
        m = measure_frame(Image.open(out), spec["measure"]["alphaThreshold"])
        if not m:
            print("FAIL empty alpha")
            return 1
        tol = spec["tolerance"]
        fails = []
        if abs(m["feet"] - spec["frame"]["baselineY"]) > tol["feetY"]:
            fails.append(f"feet {m['feet']} != {spec['frame']['baselineY']}")
        if abs(m["cx"] - spec["frame"]["centerX"]) > tol["centerX"]:
            fails.append(f"cx {m['cx']} != {spec['frame']['centerX']}")
        if m["canvas"] != spec["frame"]["canvas"]:
            fails.append(f"canvas {m['canvas']} != {spec['frame']['canvas']}")
        if fails:
            for f in fails:
                print("FAIL", f)
            return 1
        print("SPEC OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
