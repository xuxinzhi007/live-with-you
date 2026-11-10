from pathlib import Path
from datetime import datetime

def ts(p):
    return datetime.fromtimestamp(p.stat().st_mtime).strftime("%Y-%m-%d %H:%M")

print("===PROJECT===")
root = Path(r"C:\Users\ZhuanZ1\Desktop\wenbebi")
keys = ["workflow", "换装", "抠图", "meinamix", "wenbao", "雯宝", "xiaoyan", "re_01", "solo", "fullbody", "layer", "graph_"]
skip = ["node_modules", "__pycache__", "diagnosis", "savedwf_", "consistent_set"]
files = []
for p in root.rglob("*.json"):
    s = str(p).lower().replace("\\", "/")
    if any(x in s for x in skip):
        continue
    name = p.name.lower()
    if any(k in name or k in s for k in keys):
        files.append(p)
for p in sorted(files, key=lambda x: x.stat().st_mtime, reverse=True)[:60]:
    print(f"{p.relative_to(root)} | {ts(p)}")

print("===COMFY_USER_WORKFLOWS===")
wf = Path(r"D:\xuxinzhi\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable\ComfyUI\user\default\workflows")
print("exists", wf.exists())
if wf.exists():
    for p in sorted(wf.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True)[:50]:
        print(f"{p.name} | {ts(p)}")

print("===COMFY_CUSTOM_NODES_WF_HINT===")
for cand in [
    Path(r"D:\xuxinzhi\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable\ComfyUI\workflows"),
    Path(r"C:\Users\ZhuanZ1\Desktop\wenbebi\workflows"),
    Path(r"C:\Users\ZhuanZ1\Desktop\wenbebi\tools\workflows"),
    Path(r"C:\Users\ZhuanZ1\Desktop\wenbebi\comfy"),
]:
    print(cand, "exists=", cand.exists())
    if cand.exists():
        for p in sorted(cand.rglob("*.json"), key=lambda x: x.stat().st_mtime, reverse=True)[:20]:
            print(" ", p.name, "|", ts(p))
