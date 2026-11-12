#!/usr/bin/env python3
"""Download Qwen-Image-Edit-2509 8GB GGUF stack onto this ComfyUI portable install."""
import os
import sys
import time
import urllib.request

ROOT = r"D:\xuxinzhi\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable\ComfyUI"
LOG = os.path.join(ROOT, "models", "qwen_edit_download.log")
FILES = [
    (
        "https://hf-mirror.com/QuantStack/Qwen-Image-Edit-2509-GGUF/resolve/main/Qwen-Image-Edit-2509-Q4_K_M.gguf",
        os.path.join(ROOT, "models", "unet", "Qwen-Image-Edit-2509-Q4_K_M.gguf"),
    ),
    (
        "https://hf-mirror.com/Comfy-Org/Qwen-Image/resolve/main/split_files/text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors",
        os.path.join(ROOT, "models", "text_encoders", "qwen_2.5_vl_7b_fp8_scaled.safetensors"),
    ),
    (
        "https://hf-mirror.com/Comfy-Org/Qwen-Image/resolve/main/split_files/vae/qwen_image_vae.safetensors",
        os.path.join(ROOT, "models", "vae", "qwen_image_vae.safetensors"),
    ),
    (
        "https://hf-mirror.com/lightx2v/Qwen-Image-Lightning/resolve/main/Qwen-Image-Edit-2509/Qwen-Image-Edit-2509-Lightning-8steps-V1.0-bf16.safetensors",
        os.path.join(ROOT, "models", "loras", "Qwen-Image-Edit-2509-Lightning-8steps-V1.0-bf16.safetensors"),
    ),
]

def log(msg):
    line = time.strftime("%Y-%m-%d %H:%M:%S") + " " + msg
    print(line, flush=True)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")

def download(url, dest):
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    part = dest + ".part"
    existing = os.path.getsize(part) if os.path.exists(part) else 0
    if os.path.exists(dest) and os.path.getsize(dest) > 0 and not os.path.exists(part):
        log("SKIP already complete: %s (%d bytes)" % (dest, os.path.getsize(dest)))
        return
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 wenbao-qwen-dl"})
    if existing:
        req.add_header("Range", "bytes=%d-" % existing)
        log("RESUME %s from %d" % (dest, existing))
    else:
        log("START %s" % dest)
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            mode = "ab" if existing and resp.getcode() in (206, 200) and existing else "wb"
            if resp.getcode() == 200 and existing:
                # server ignored range, restart
                mode = "wb"
                existing = 0
            total = resp.headers.get("Content-Length")
            if total is not None:
                total = int(total) + (existing if resp.getcode() == 206 else 0)
            last = time.time()
            written = existing
            with open(part, mode) as out:
                while True:
                    chunk = resp.read(1024 * 1024)
                    if not chunk:
                        break
                    out.write(chunk)
                    written += len(chunk)
                    now = time.time()
                    if now - last >= 15:
                        if total:
                            log("PROGRESS %s %.1f%% %d/%d" % (os.path.basename(dest), 100.0 * written / total, written, total))
                        else:
                            log("PROGRESS %s %d bytes" % (os.path.basename(dest), written))
                        last = now
    except Exception as e:
        log("ERROR %s: %s" % (dest, e))
        raise
    os.replace(part, dest)
    log("DONE %s (%d bytes)" % (dest, os.path.getsize(dest)))

def main():
    log("BEGIN download stack")
    for url, dest in FILES:
        download(url, dest)
    log("ALL COMPLETE")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        log("FAILED: %s" % e)
        sys.exit(1)
