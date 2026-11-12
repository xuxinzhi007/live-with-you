import json, urllib.request
def req(method, path, data=None, timeout=60):
    body = None
    headers = {}
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"
    r = urllib.request.Request("http://127.0.0.1:8188"+path, data=body, headers=headers, method=method)
    with urllib.request.urlopen(r, timeout=timeout) as resp:
        raw = resp.read()
        print(method, path, resp.status)
        if raw:
            try:
                return json.loads(raw.decode("utf-8"))
            except Exception:
                print(raw[:500])
                return raw

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "free":
        print(req("POST", "/free", {"unload_models": True, "free_memory": True}))
    st = req("GET", "/system_stats")
    d = st["devices"][0]
    print("device", d["name"])
    print("vram_free", d["vram_free"], "vram_total", d["vram_total"], "used", d["vram_total"]-d["vram_free"])
    print("torch_vram_total", d.get("torch_vram_total"), "torch_vram_free", d.get("torch_vram_free"))
    q = req("GET", "/queue")
    print("queue", q)
