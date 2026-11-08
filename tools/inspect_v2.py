import json
from pathlib import Path
from datetime import datetime

def inspect(path):
    p = Path(path)
    d = json.loads(p.read_text(encoding='utf-8'))
    print('===', p.name, 'mtime', datetime.fromtimestamp(p.stat().st_mtime))
    nodes = d.get('nodes', [])
    print('node_count', len(nodes))
    types = {}
    for n in nodes:
        t = n.get('type')
        types[t] = types.get(t, 0) + 1
    for t,c in sorted(types.items()):
        if any(k in (t or '').lower() for k in ['lora','ipadap','openpose','control','check','clip','ksampler','loadimage','empty','save','text']):
            print(' type', t, c)
    print('---key nodes---')
    for n in nodes:
        t = n.get('type') or ''
        if t in ('LoraLoader','LoraLoaderModelOnly','CheckpointLoaderSimple','IPAdapter','IPAdapterUnifiedLoader','OpenposePreprocessor','ControlNetApplyAdvanced','KSampler','LoadImage','CLIPTextEncode','EmptyLatentImage','SaveImage','CLIPSetLastLayer','ControlNetLoader','MarkdownNote'):
            title = n.get('title') or ''
            wv = n.get('widgets_values')
            print(f"id={n.get('id')} type={t} title={title}")
            if wv is not None:
                s = str(wv)
                if len(s) > 220:
                    s = s[:220] + '...'
                print('  widgets=', s)

for path in [
    r'D:\xuxinzhi\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable\ComfyUI\user\default\workflows\MeinaMix_小燕_姿势训练集_v2.json',
    r'D:\xuxinzhi\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable\ComfyUI\user\default\workflows\MeinaMix_雯宝LoRA_换装抠图.json',
]:
    inspect(path)
    print()

# LoRA files
lora_dir = Path(r'D:\xuxinzhi\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable\ComfyUI\models\loras')
print('===LORAS===')
for p in sorted(lora_dir.glob('xiaoyan*'), key=lambda x: x.stat().st_mtime, reverse=True):
    print(p.name, datetime.fromtimestamp(p.stat().st_mtime), p.stat().st_size)
