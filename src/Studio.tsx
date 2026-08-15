import { ChangeEvent, useMemo, useRef, useState } from "react";

type PartId = "body" | "head" | "hairBack" | "hairFront" | "leftArm" | "rightArm" | "leftLeg" | "rightLeg";

type Part = {
  id: PartId;
  label: string;
  parent: string;
  fileName: string;
  previewUrl: string;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  pivotX: number;
  pivotY: number;
  width: number;
  height: number;
  z: number;
};

const initialParts: Part[] = [
  { id: "body", label: "身体", parent: "root", fileName: "", previewUrl: "", x: 0, y: 16, rotation: 0, scale: 1, pivotX: 50, pivotY: 8, width: 512, height: 720, z: 2 },
  { id: "head", label: "头部", parent: "body", fileName: "", previewUrl: "", x: 0, y: -90, rotation: 0, scale: 1, pivotX: 50, pivotY: 88, width: 512, height: 720, z: 4 },
  { id: "hairBack", label: "后发", parent: "head", fileName: "", previewUrl: "", x: 0, y: -92, rotation: 0, scale: 1, pivotX: 50, pivotY: 88, width: 512, height: 720, z: 3 },
  { id: "hairFront", label: "前发", parent: "head", fileName: "", previewUrl: "", x: 0, y: -92, rotation: 0, scale: 1, pivotX: 50, pivotY: 88, width: 512, height: 720, z: 5 },
  { id: "leftArm", label: "左手臂", parent: "body", fileName: "", previewUrl: "", x: -54, y: -8, rotation: 0, scale: 1, pivotX: 72, pivotY: 10, width: 512, height: 720, z: 1 },
  { id: "rightArm", label: "右手臂", parent: "body", fileName: "", previewUrl: "", x: 54, y: -8, rotation: 0, scale: 1, pivotX: 28, pivotY: 10, width: 512, height: 720, z: 1 },
  { id: "leftLeg", label: "左腿", parent: "body", fileName: "", previewUrl: "", x: -22, y: 96, rotation: 0, scale: 1, pivotX: 50, pivotY: 6, width: 512, height: 720, z: 0 },
  { id: "rightLeg", label: "右腿", parent: "body", fileName: "", previewUrl: "", x: 22, y: 96, rotation: 0, scale: 1, pivotX: 50, pivotY: 6, width: 512, height: 720, z: 0 },
];

const numericFields = [
  ["x", "横向偏移", "px"], ["y", "纵向偏移", "px"], ["rotation", "旋转", "deg"], ["scale", "缩放", "x"], ["pivotX", "锚点 X", "%"], ["pivotY", "锚点 Y", "%"], ["z", "显示层级", ""],
] as const;

export function Studio() {
  const [parts, setParts] = useState(initialParts);
  const [selectedId, setSelectedId] = useState<PartId>("body");
  const configInputRef = useRef<HTMLInputElement>(null);
  const selected = parts.find((part) => part.id === selectedId) || parts[0];
  const orderedParts = useMemo(() => [...parts].sort((a, b) => a.z - b.z), [parts]);

  function updateSelected(update: Partial<Part>) {
    setParts((current) => current.map((part) => part.id === selectedId ? { ...part, ...update } : part));
  }

  function loadPartImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    if (selected.previewUrl) URL.revokeObjectURL(selected.previewUrl);
    const previewUrl = URL.createObjectURL(file);
    const selectedPartId = selected.id;
    const image = new Image();
    image.onload = () => setParts((current) => current.map((part) => part.id === selectedPartId ? { ...part, width: image.naturalWidth, height: image.naturalHeight } : part));
    image.src = previewUrl;
    updateSelected({ fileName: file.name, previewUrl });
    event.target.value = "";
  }

  function downloadConfig() {
    const config = {
      version: 1,
      characterId: "wenbebi",
      canvas: { width: 512, height: 720 },
      parts: parts.map(({ previewUrl, ...part }) => ({
        ...part,
        asset: part.fileName ? `assets/characters/wenbebi/parts/${part.fileName}` : "",
      })),
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(config, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "wenbebi-puppet.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function importConfig(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed.parts)) throw new Error("invalid configuration");
        setParts((current) => current.map((part) => {
          const saved = parsed.parts.find((item: { id?: string }) => item.id === part.id);
          if (!saved) return part;
          const asset = typeof saved.asset === "string" ? saved.asset : "";
          return {
            ...part,
            parent: typeof saved.parent === "string" ? saved.parent : part.parent,
            fileName: typeof saved.fileName === "string" ? saved.fileName : asset.split("/").pop() || "",
            previewUrl: asset,
            x: Number.isFinite(saved.x) ? saved.x : part.x,
            y: Number.isFinite(saved.y) ? saved.y : part.y,
            rotation: Number.isFinite(saved.rotation) ? saved.rotation : part.rotation,
            scale: Number.isFinite(saved.scale) ? saved.scale : part.scale,
            pivotX: Number.isFinite(saved.pivotX) ? saved.pivotX : part.pivotX,
            pivotY: Number.isFinite(saved.pivotY) ? saved.pivotY : part.pivotY,
            width: Number.isFinite(saved.width) ? saved.width : part.width,
            height: Number.isFinite(saved.height) ? saved.height : part.height,
            z: Number.isFinite(saved.z) ? saved.z : part.z,
          };
        }));
      } catch {
        window.alert("无法读取配置文件。请选择由角色部件工坊导出的 JSON。");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  return (
    <main className="studio-shell">
      <header className="studio-header">
        <div><p className="studio-kicker">角色部件工坊</p><h1>雯宝</h1></div>
        <div className="studio-actions"><a href="./">返回游戏</a><button type="button" onClick={() => configInputRef.current?.click()}>导入配置</button><button type="button" onClick={downloadConfig}>导出配置</button><input ref={configInputRef} className="studio-config-input" type="file" accept="application/json" onChange={importConfig} /></div>
      </header>
      <section className="studio-workspace">
        <nav className="studio-parts" aria-label="角色部件">
          <p className="studio-section-label">部件</p>
          {parts.map((part) => <button key={part.id} type="button" className={part.id === selectedId ? "is-selected" : ""} onClick={() => setSelectedId(part.id)}><span>{part.label}</span><small>{part.fileName || "未放入图片"}</small></button>)}
        </nav>
        <section className="studio-stage" aria-label="角色预览">
          <div className="studio-stage__guide"><span>中心线</span><span>地面</span></div>
          <div className="studio-puppet">
            {orderedParts.map((part) => part.previewUrl && <img key={part.id} className={part.id === selectedId ? "is-selected" : ""} src={part.previewUrl} alt="" style={{ width: part.width, height: part.height, zIndex: part.z, transformOrigin: `${part.pivotX}% ${part.pivotY}%`, transform: `translate(-50%, -50%) translate(${part.x}px, ${part.y}px) rotate(${part.rotation}deg) scale(${part.scale})` }} />)}
            {!parts.some((part) => part.previewUrl) && <p className="studio-stage__empty">从左侧选择部件，再导入透明 PNG</p>}
          </div>
        </section>
        <aside className="studio-inspector">
          <p className="studio-section-label">{selected.label}</p>
          <label className="studio-upload"><input type="file" accept="image/png,image/webp" onChange={loadPartImage} />{selected.fileName || "导入 PNG / WebP"}</label>
          <label>父级<select value={selected.parent} onChange={(event) => updateSelected({ parent: event.target.value })}><option value="root">根节点</option>{parts.filter((part) => part.id !== selected.id).map((part) => <option key={part.id} value={part.id}>{part.label}</option>)}</select></label>
          <div className="studio-fields">{numericFields.map(([key, label, unit]) => <label key={key}>{label}<span data-unit={unit}><input type="number" step={key === "scale" ? "0.05" : "1"} value={selected[key]} onChange={(event) => updateSelected({ [key]: Number(event.target.value) })} /></span></label>)}</div>
          <p className="studio-note">导出的 JSON 记录部件关系与参数。图片需要在发布前复制到对应的 assets 目录。</p>
        </aside>
      </section>
    </main>
  );
}
