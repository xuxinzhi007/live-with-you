#!/usr/bin/env python3
"""Legacy MeinaMix 7-group dress runner (NOT live official character production).

As of 2026-11-13, live official CHARACTER production is the Qwen-Image-Edit-2509 Q4
workflow `Qwen_Image_Edit_2509_Q4_官方出图.json` (master image + prompts),
not this MeinaMix 7-group IPAdapter/OpenPose path.
Default is to refuse and exit. Historical replay of the archived 7-group path requires --legacy-meinamix.

Does not accept --prompt/--negative (those are unofficial API overrides).
Optional --seed only. Frees VRAM between heavy groups (8GB).
Saves a named intermediate for every group.
Group 6 is tools/official-isnet-rematte.py (isnet-anime).
Group 7 is a documented stain hook (passthrough if no stain node).
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(r"C:\Users\ZhuanZ1\Desktop\wenbebi")
TOOLS = ROOT / "tools"
sys.path.insert(0, str(TOOLS))
from comfy_workflow_to_api import load_official_api, ui_to_api  # noqa: E402

COMFY = "http://127.0.0.1:8188"
LIVE = Path(
    r"D:\xuxinzhi\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable"
    r"\ComfyUI\user\default\workflows\MeinaMix_雯宝LoRA_换装抠图.json"
)
REPO = TOOLS / "workflows" / "MeinaMix_雯宝LoRA_换装抠图.json"
ARCHIVE_DIR = Path(
    r"D:\xuxinzhi\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable"
    r"\ComfyUI\user\default\workflows\_archive_20261113_meinamix"
)
ARCHIVE_WF = ARCHIVE_DIR / "MeinaMix_雯宝LoRA_换装抠图.json"
REPO_ARCHIVE_WF = TOOLS / "workflows" / "_archive_20261113_meinamix" / "MeinaMix_雯宝LoRA_换装抠图.json"
QWEN_OFFICIAL = Path(
    r"D:\xuxinzhi\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable"
    r"\ComfyUI\user\default\workflows\Qwen_Image_Edit_2509_Q4_官方出图.json"
)
STAGE = Path(r"C:\Users\ZhuanZ1\Desktop\wenbebi\tools\out\wenbao-assets\_compare")
INPUT_DIR = Path(
    r"D:\xuxinzhi\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable\ComfyUI\input"
)
CLIENT_ID = "wenbebi-official-dress-seven"

# Node id sets for stepwise API prompts (muted color-key never included)
IDS_GEN = {4, 12, 10, 6, 7, 5, 3, 8, 9, 20, 21, 22, 23, 24, 25, 26, 27, 28, 45}
# upscale + load raw (load node injected by runner)
# FD + identity model reload


def request(method: str, path: str, data=None, timeout=60):
    body = None
    headers = {}
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(COMFY + path, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            return json.loads(raw.decode("utf-8")) if raw else None
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", "replace")
        raise SystemExit(f"HTTP {e.code} {path}: {err}") from e


def free_cache():
    request("POST", "/free", {"unload_models": True, "free_memory": True})
    print("freed Comfy cache")


def subset_prompt(full: dict, keep_ids) -> dict:
    keep = {str(i) for i in keep_ids}
    out = {}
    for nid, node in full.items():
        if nid not in keep:
            continue
        node = json.loads(json.dumps(node))
        inputs = node.get("inputs") or {}
        # drop links that point outside the subset (optional inputs)
        cleaned = {}
        for k, v in inputs.items():
            if isinstance(v, list) and len(v) == 2 and isinstance(v[0], str):
                if v[0] not in keep:
                    continue
            cleaned[k] = v
        node["inputs"] = cleaned
        out[nid] = node
    return out


def queue_graph(graph: dict, timeout_s: int = 600) -> dict:
    submit = request("POST", "/prompt", {"client_id": CLIENT_ID, "prompt": graph})
    if not submit or "prompt_id" not in submit:
        raise SystemExit(f"no prompt_id: {submit}")
    if submit.get("node_errors"):
        raise SystemExit(
            f"node_errors: {json.dumps(submit['node_errors'], indent=2, ensure_ascii=False)}"
        )
    prompt_id = submit["prompt_id"]
    print(f"queued {prompt_id}")
    start = time.time()
    while time.time() - start < timeout_s:
        time.sleep(1.5)
        try:
            hist = request("GET", f"/history/{urllib.parse.quote(prompt_id)}", timeout=30)
        except Exception as e:
            print(f"history poll error: {e}")
            continue
        record = (hist or {}).get(prompt_id)
        if not record:
            continue
        status = record.get("status") or {}
        if status.get("completed") is False and status.get("status_str") == "error":
            raise SystemExit(f"Comfy error: {json.dumps(status, indent=2)[:4000]}")
        outputs = record.get("outputs") or {}
        images = []
        for node_id, node_out in outputs.items():
            for img in node_out.get("images") or []:
                images.append({"nodeId": str(node_id), **img})
        if images:
            print(f"completed {prompt_id} in {time.time()-start:.1f}s, {len(images)} image(s)")
            return {"prompt_id": prompt_id, "record": record, "images": images}
        if status.get("status_str") == "error":
            raise SystemExit(f"Comfy error: {json.dumps(status, indent=2)[:4000]}")
    raise SystemExit(f"timeout waiting for {prompt_id}")


def download_image(img: dict, dest: Path) -> int:
    q = urllib.parse.urlencode(
        {
            "filename": img["filename"],
            "subfolder": img.get("subfolder") or "",
            "type": img.get("type") or "output",
        }
    )
    dest.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(f"{COMFY}/view?{q}", timeout=120) as resp:
        data = resp.read()
    dest.write_bytes(data)
    print(f"saved {dest} ({len(data)} bytes) from {img['filename']} node {img.get('nodeId')}")
    return len(data)


def pick(images, node_id=None, prefix=None):
    for img in images:
        if node_id is not None and str(img.get("nodeId")) == str(node_id):
            return img
    if prefix:
        for img in images:
            if prefix in (img.get("filename") or ""):
                return img
    return None


def copy_to_input(src: Path, name: str) -> str:
    INPUT_DIR.mkdir(parents=True, exist_ok=True)
    dest = INPUT_DIR / name
    shutil.copy2(src, dest)
    print(f"copied to Comfy input {dest}")
    return name


def run_rematte(src: Path, stem: str, outdir: Path) -> dict:
    script = TOOLS / "official-isnet-rematte.py"
    if not script.is_file():
        raise SystemExit(f"missing official rematte script {script}")
    # Prefer a rembg-capable interpreter; portable Comfy python usually has none.
    print(
        "official rematte must run where rembg+isnet-anime is installed "
        f"(box venv or local). src={src}"
    )
    try:
        import rembg  # noqa: F401
    except Exception:
        return {"ran": False, "src": str(src), "script": str(script)}
    import subprocess

    cmd = [sys.executable, str(script), "--src", str(src), "--stem", stem, "--outdir", str(outdir)]
    print("running official rematte:", " ".join(cmd))
    rc = subprocess.call(cmd)
    if rc != 0:
        raise SystemExit(f"official isnet rematte failed with {rc}")
    return {"ran": True, "src": str(src), "script": str(script)}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--name", default="character-xiaoyan-official-compare.png")
    p.add_argument("--seed", type=int, default=None)
    p.add_argument("--workflow", default="")
    p.add_argument("--skip-rematte", action="store_true")
    p.add_argument("--no-free", action="store_true")
    p.add_argument(
        "--legacy-meinamix",
        action="store_true",
        help="Explicit opt-in to replay the archived MeinaMix 7-group path (not official production).",
    )
    args = p.parse_args()

    refuse_msg = (
        "REFUSED: tools/run-official-dress.py no longer runs the old MeinaMix 7-group path by default.\n"
        "As of 2026-11-13, live official character production is:\n"
        f"  {QWEN_OFFICIAL}\n"
        "The old official MeinaMix graphs (换装抠图 / 姿势训练集 v2) were archived to:\n"
        f"  {ARCHIVE_DIR}\n"
        f"  {REPO_ARCHIVE_WF.parent}\n"
        "To historically replay the archived 7-group MeinaMix dress path, pass --legacy-meinamix explicitly. "
        "That is not official production."
    )
    if not args.legacy_meinamix:
        print(refuse_msg, file=sys.stderr)
        raise SystemExit(2)

    print(
        "WARNING: --legacy-meinamix is set. This will launch the ARCHIVED MeinaMix 7-group path "
        "(IPAdapter/OpenPose/FaceDetailer), which is not live official production. "
        f"Live official is {QWEN_OFFICIAL}"
    )

    if args.workflow:
        wf = Path(args.workflow)
    else:
        wf = next((c for c in (ARCHIVE_WF, REPO_ARCHIVE_WF, LIVE, REPO) if c.is_file()), None)
        if wf is None:
            raise SystemExit("archived official MeinaMix dress workflow not found in archive or old live paths")
    if not wf.is_file():
        raise SystemExit(f"official workflow not found: {wf}")
    print(f"loading official workflow {wf}")
    ui = json.loads(wf.read_text(encoding="utf-8"))
    full = ui_to_api(ui) if "nodes" in ui else load_official_api(wf)
    # never submit color-key
    for banned in ("14", "15", "16", "17", "18", "19"):
        full.pop(banned, None)
    if args.seed is not None:
        if "3" not in full or full["3"].get("class_type") != "KSampler":
            raise SystemExit("official graph missing KSampler node 3")
        full["3"]["inputs"]["seed"] = int(args.seed)
        if "52" in full and full["52"].get("class_type") == "FaceDetailer":
            full["52"]["inputs"]["seed"] = int(args.seed)
        print(f"seed override {args.seed} (prompts unchanged from official JSON)")

    pos = (full.get("6") or {}).get("inputs", {}).get("text")
    neg = (full.get("7") or {}).get("inputs", {}).get("text")
    face = (full.get("21") or {}).get("inputs", {}).get("image")
    pose = (full.get("23") or {}).get("inputs", {}).get("image")
    ipw = (full.get("22") or {}).get("inputs", {}).get("weight")
    print(json.dumps({"workflow": str(wf), "face": face, "pose": pose, "ipadapter": ipw, "seed": args.seed}, ensure_ascii=False, indent=2))
    print("POSITIVE:", pos)
    print("NEGATIVE:", neg)
    low = (pos or "").lower()
    if "chibi" in low or "q-version" in low or "large head" in low:
        raise SystemExit("official positive still contains chibi/q-version/large-head forcing; fix the template first")

    stem = args.name.replace(".png", "")
    STAGE.mkdir(parents=True, exist_ok=True)
    (STAGE / "raw").mkdir(parents=True, exist_ok=True)
    saved = {}
    prompt_ids = {}

    # ----- Groups 1-3: identity ref + pose skel + 512 base -----
    if not args.no_free:
        free_cache()
        time.sleep(1)
    g13 = subset_prompt(full, IDS_GEN)
    print("STAGE 1-3 submitting identity + clothes/pose + 512 base")
    r13 = queue_graph(g13, timeout_s=480)
    prompt_ids["groups_1_3"] = r13["prompt_id"]
    mapping = {
        "45": ("01_identity", STAGE / f"{stem}_01_identity.png"),
        "28": ("02_clothes_pose", STAGE / f"{stem}_02_clothes_pose.png"),
        "9": ("03_512_base", STAGE / f"{stem}_03_512_base.png"),
    }
    for img in r13["images"]:
        nid = str(img.get("nodeId"))
        if nid in mapping:
            key, dest = mapping[nid]
            download_image(img, dest)
            saved[key] = str(dest)
            if key == "03_512_base":
                shutil.copy2(dest, STAGE / "raw" / f"{stem}_raw.png")
                shutil.copy2(dest, STAGE / f"{stem}_raw.png")
        else:
            # keep unexpected extras with node tag
            extra = STAGE / f"{stem}_g13_node{nid}_{img['filename']}"
            download_image(img, extra)
    for k in ("01_identity", "02_clothes_pose", "03_512_base"):
        if k not in saved:
            raise SystemExit(f"missing intermediate for {k}")

    # ----- Group 4: AnimeSharp -----
    if not args.no_free:
        free_cache()
        time.sleep(1)
    raw_name = copy_to_input(Path(saved["03_512_base"]), f"{stem}_03_512_base.png")
    up = {
        "140": {"class_type": "LoadImage", "inputs": {"image": raw_name}},
        "40": {"class_type": "UpscaleModelLoader", "inputs": {"model_name": "4x-AnimeSharp.pth"}},
        "41": {
            "class_type": "ImageUpscaleWithModel",
            "inputs": {"upscale_model": ["40", 0], "image": ["140", 0]},
        },
        "42": {
            "class_type": "SaveImage",
            "inputs": {"images": ["41", 0], "filename_prefix": "Wenbao_Official_04_AnimeSharp4x"},
        },
        "43": {
            "class_type": "ImageScale",
            "inputs": {
                "image": ["41", 0],
                "upscale_method": "lanczos",
                "width": 1024,
                "height": 1280,
                "crop": "disabled",
            },
        },
        "44": {
            "class_type": "SaveImage",
            "inputs": {"images": ["43", 0], "filename_prefix": "Wenbao_Official_04_AnimeSharp2x"},
        },
    }
    print("STAGE 4 submitting AnimeSharp upscale")
    r4 = queue_graph(up, timeout_s=300)
    prompt_ids["group_4"] = r4["prompt_id"]
    img4 = pick(r4["images"], "42", "AnimeSharp4x")
    img2 = pick(r4["images"], "44", "AnimeSharp2x")
    if not img4 or not img2:
        raise SystemExit(f"upscale missing outputs: {r4['images']}")
    dest4 = STAGE / f"{stem}_04_animesharp4x.png"
    dest2 = STAGE / f"{stem}_04_animesharp2x.png"
    download_image(img4, dest4)
    download_image(img2, dest2)
    saved["04_animesharp4x"] = str(dest4)
    saved["04_animesharp2x"] = str(dest2)

    # ----- Group 5: FaceDetailer on 2x, model is IPAdapter + official face ref -----
    if not args.no_free:
        free_cache()
        time.sleep(2)
    fd_in = copy_to_input(Path(saved["04_animesharp2x"]), f"{stem}_04_animesharp2x.png")
    # Rebuild FD graph from official nodes, but LoadImage the 2x file instead of linking to 43
    fd_keep = {4, 12, 10, 6, 7, 20, 21, 22, 50, 51, 52, 53}
    fd_graph = subset_prompt(full, fd_keep)
    fd_graph["155"] = {"class_type": "LoadImage", "inputs": {"image": fd_in}}
    if "52" not in fd_graph:
        raise SystemExit("official graph missing FaceDetailer node 52")
    fd_graph["52"]["inputs"]["image"] = ["155", 0]
    # identity ref must remain standby-bust-white / 待机状态 crop — never the generated face
    face_used = fd_graph["21"]["inputs"].get("image")
    print(f"STAGE 5 FaceDetailer face ref={face_used} (must be official identity, not generated face)")
    if face_used not in ("standby-bust-white.png", "待机状态.png"):
        raise SystemExit(f"FaceDetailer / IPAdapter face ref is not official identity: {face_used}")
    r5 = queue_graph(fd_graph, timeout_s=480)
    prompt_ids["group_5"] = r5["prompt_id"]
    img_fd = pick(r5["images"], "53", "FaceDetailer")
    if not img_fd:
        # fallback: largest / first from node 52
        img_fd = pick(r5["images"], "52") or (r5["images"][0] if r5["images"] else None)
    if not img_fd:
        raise SystemExit("FaceDetailer produced no image")
    dest_fd = STAGE / f"{stem}_05_facedetailer.png"
    download_image(img_fd, dest_fd)
    saved["05_facedetailer"] = str(dest_fd)
    # stash extras
    for img in r5["images"]:
        if img is img_fd:
            continue
        extra = STAGE / f"{stem}_05_fd_node{img.get('nodeId')}_{img['filename']}"
        download_image(img, extra)

    # ----- Group 6: official isnet rematte on FaceDetailer output -----
    rematte_src = Path(saved["05_facedetailer"])
    rematte_info = {"ran": False, "src": str(rematte_src)}
    if args.skip_rematte:
        print("skipped rematte (--skip-rematte); caller should run official-isnet-rematte.py")
        rematte_info["skipped"] = True
    else:
        rematte_info = run_rematte(rematte_src, stem, STAGE)
    saved["06_rematte_src"] = str(rematte_src)

    # ----- Group 7 hook: filled after rematte files exist -----
    meta = {
        "official": True,
        "official_json": str(wf),
        "source": "7-group official UI workflow, stepwise official runner (not an API prompt override)",
        "name": args.name,
        "seed": args.seed,
        "face": face,
        "pose": pose,
        "ipadapter_weight": ipw,
        "prompt": pos,
        "negative": neg,
        "prompt_ids": prompt_ids,
        "facedetailer": {
            "node": 52,
            "image": "AnimeSharp 2x (1024x1280), not the raw generated face as IPAdapter ref",
            "ipadapter_ref": face,
            "model": "IPAdapter PLUS FACE on meinamix + wenbao_v1 LoRA 0.8/0.8",
            "guide_size": 512,
            "guide_size_for": "bbox",
            "max_size": 1024,
            "steps": 20,
            "cfg": 6.8,
            "sampler": "dpmpp_2m",
            "scheduler": "karras",
            "denoise": 0.45,
            "bbox_detector": "bbox/face_yolov8m.pt",
            "sam": "sam_vit_b_01ec64.pth AUTO",
            "note": "FaceDetailer refine is feature-guided by 待机状态 via IPAdapter; it must not restyle the body into chibi",
        },
        "stain_removal": {
            "group": 7,
            "status": "hook / passthrough if no conservative Comfy stain node",
        },
        "rematte": rematte_info,
        "saved": saved,
        "note": "compare only; not ingested; not uploaded to nikki or :8788; color-key disabled",
    }
    meta_path = STAGE / f"{stem}_meta.json"
    meta_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"meta {meta_path}")
    print("DONE official 7-group staging through FaceDetailer (rematte may be completed off-box)")


if __name__ == "__main__":
    main()
