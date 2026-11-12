import json
from pathlib import Path
p = Path(r"C:\Users\ZhuanZ1\Desktop\wenbebi\tools\out\wenbao-assets\_compare\character-xiaoyan-official-202611110701_meta.json")
meta = json.loads(p.read_text(encoding="utf-8"))
meta["rematte"] = {
    "ran": True,
    "where": "box rembg venv /workspace/wenbao-pipeline/.venv-rembg",
    "script": "tools/official-isnet-rematte.py",
    "model": "isnet-anime",
    "src": "character-xiaoyan-official-202611110701_05_facedetailer.png",
    "keep_gt16": 0.711,
    "note": "keep-mask 0.711 includes the large grey ring/prop; not a clean solid white",
}
meta["saved"].update({
    "06_isnet_white": r"C:\Users\ZhuanZ1\Desktop\wenbebi\tools\out\wenbao-assets\_compare\character-xiaoyan-official-202611110701_06_isnet_white.png",
    "06_isnet_rgba": r"C:\Users\ZhuanZ1\Desktop\wenbebi\tools\out\wenbao-assets\_compare\character-xiaoyan-official-202611110701_06_isnet_rgba.png",
    "07_stain_removal": r"C:\Users\ZhuanZ1\Desktop\wenbebi\tools\out\wenbao-assets\_compare\character-xiaoyan-official-202611110701_07_stain_removal.png",
})
meta["stain_removal"] = {
    "group": 7,
    "status": "passthrough",
    "reason": "No stable conservative Comfy stain node (ImageBlend/ImageSharpen are not stain fixers). This file is a passthrough of stage 6.",
}
meta["gate"] = (
    "FAIL face-first: bangs are not 齐刘海 and eyes are not the large round brown of 待机状态 "
    "(smile improved after FaceDetailer; body is a normal full-body plate, Q-version ratio is not a gate). "
    "Also fail: isnet kept a large grey ring/prop (keep 0.711). Clothes white T+shorts and feet-in-frame are OK. "
    "Compare only; not ingested."
)
p.write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")
print("updated", p)
# list all 701 files
cmp = p.parent
for f in sorted(cmp.glob("character-xiaoyan-official-202611110701*")):
    print(f"{f.stat().st_size:10d}  {f.name}")
