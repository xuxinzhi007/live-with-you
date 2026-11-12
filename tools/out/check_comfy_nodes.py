import json, urllib.request
s = json.load(urllib.request.urlopen("http://127.0.0.1:8188/system_stats", timeout=8))
devs = s.get("devices") or s.get("system") or s
print("STATS", json.dumps(s, ensure_ascii=False)[:1500])
oi = json.load(urllib.request.urlopen("http://127.0.0.1:8188/object_info", timeout=30))
for name in ["FaceDetailer", "FaceDetailerPipe", "UltralyticsDetectorProvider", "SAMLoader", "SAMDetectorCombined", "ImpactWildcardProcessor", "ImageUpscaleWithModel", "UpscaleModelLoader"]:
    print(name, name in oi)
