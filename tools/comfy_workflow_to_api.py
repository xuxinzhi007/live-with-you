#!/usr/bin/env python3
"""Convert a ComfyUI UI-format workflow JSON into an API prompt graph.

Skips MarkdownNote/Note and muted (mode==2) nodes. Drops the seed
control_after_generate widget so it is not sent as a sampler input.
"""
from __future__ import annotations

import json
from pathlib import Path

SKIP_TYPES = {"MarkdownNote", "Note", "PrimitiveNode", "Reroute"}
SEED_CONTROLS = {
    "randomize",
    "fixed",
    "increment",
    "decrement",
    "increment for each node",
    "decrement for each node",
}


def ui_to_api(workflow: dict) -> dict:
    links = {}
    for L in workflow.get("links") or []:
        # [id, src, src_slot, dst, dst_slot, type]
        links[L[0]] = L

    prompt = {}
    for node in workflow.get("nodes") or []:
        typ = node.get("type")
        mode = node.get("mode", 0)
        if typ in SKIP_TYPES:
            continue
        if mode == 2:  # Never / muted
            continue
        nid = str(node["id"])
        inputs = {}
        values = list(node.get("widgets_values") or [])
        vi = 0
        for inp in node.get("inputs") or []:
            name = inp["name"]
            link = inp.get("link")
            if link:
                src = links[link]
                inputs[name] = [str(src[1]), int(src[2])]
                continue
            if inp.get("type") == "IMAGEUPLOAD":
                if vi < len(values):
                    vi += 1
                continue
            if not inp.get("widget"):
                continue
            if vi >= len(values):
                continue
            inputs[name] = values[vi]
            vi += 1
            if name in ("seed", "noise_seed") and vi < len(values) and values[vi] in SEED_CONTROLS:
                vi += 1
        prompt[nid] = {"class_type": typ, "inputs": inputs}
    return prompt


def load_official_api(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, dict) and any(
        isinstance(v, dict) and "class_type" in v for v in data.values()
    ) and "nodes" not in data:
        return data
    return ui_to_api(data)


if __name__ == "__main__":
    import argparse

    p = argparse.ArgumentParser()
    p.add_argument("workflow")
    p.add_argument("--out", default="")
    args = p.parse_args()
    api = load_official_api(Path(args.workflow))
    text = json.dumps(api, ensure_ascii=False, indent=2)
    if args.out:
        Path(args.out).write_text(text, encoding="utf-8")
    else:
        print(text)
    print(f"nodes={len(api)} ids={','.join(api)}", file=__import__("sys").stderr)
