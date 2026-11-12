import json, urllib.request, sys
from pathlib import Path

ids = [
    "54994179-d98d-487a-bf2f-18e730678cbf",
    "726a5666-b03f-4ae3-b04a-6b3524fb09be",
]
# also pick last prompt id from argv
ids.extend(sys.argv[1:])

def get(path):
    with urllib.request.urlopen("http://127.0.0.1:8188"+path, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))

# dump recent history keys
# /history may be huge; fetch by id
needles = ("wenbao", "xiaoyan", "seed", "lora", "safetensors")
for pid in ids:
    if not pid:
        continue
    try:
        hist = get("/history/" + pid)
    except Exception as e:
        print("FAIL", pid, e)
        continue
    rec = hist.get(pid) or {}
    prompt = rec.get("prompt")
    # Comfy history prompt is often [number, prompt_id, prompt_dict, extra, outputs?]
    graph = None
    if isinstance(prompt, list) and len(prompt) >= 3 and isinstance(prompt[2], dict):
        graph = prompt[2]
    elif isinstance(prompt, dict) and "prompt" in prompt:
        graph = prompt["prompt"]
    elif isinstance(prompt, dict):
        # maybe already the graph
        graph = prompt
    print("="*60)
    print("prompt_id", pid)
    print("status", rec.get("status"))
    # scan graph
    if not graph:
        print("no graph, prompt type", type(prompt), str(prompt)[:300])
        continue
    for nid, node in graph.items():
        if not isinstance(node, dict):
            continue
        typ = node.get("class_type")
        inputs = node.get("inputs") or {}
        blob = json.dumps(inputs, ensure_ascii=False)
        low = blob.lower()
        if typ in ("LoraLoader", "KSampler", "CLIPTextEncode", "LoadImage", "IPAdapter", "FaceDetailer", "CheckpointLoaderSimple") or "wenbao" in low or "xiaoyan" in low:
            print(f"  node {nid} {typ}: {blob[:500]}")
    outs = rec.get("outputs") or {}
    for nid, o in outs.items():
        imgs = o.get("images") or []
        for im in imgs:
            print(f"  OUT node {nid}: {im}")
