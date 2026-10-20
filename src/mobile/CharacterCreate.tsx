import { useMemo, useState } from "react";
import { PLAYER_LOOKS, type PlayerLookId } from "./data/player-looks";

interface CharacterCreateProps {
  companionName: string;
  onCreate: (name: string, lookId: PlayerLookId) => boolean;
}

/** 方向 A：角色创建 3 步（名 → 外观 → 确认），贴合现网竖屏 Mobile 壳 */
export function CharacterCreate({ companionName, onCreate }: CharacterCreateProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("");
  const [lookId, setLookId] = useState<PlayerLookId>("soft");
  const [error, setError] = useState("");

  const look = useMemo(() => PLAYER_LOOKS.find((item) => item.id === lookId) ?? PLAYER_LOOKS[0], [lookId]);
  const trimmed = name.trim();

  const goLooks = () => {
    if (!trimmed) {
      setError("先给自己起个名字");
      return;
    }
    setError("");
    setStep(2);
  };

  const finish = () => {
    const ok = onCreate(trimmed, lookId);
    if (!ok) setError("名字不能为空");
  };

  return (
    <div className="m-create" role="dialog" aria-labelledby="m-create-title" aria-modal="true">
      <div className="m-create-card">
        <p className="m-create-step">步骤 {step} / 3</p>
        <h1 id="m-create-title">先让你也在场</h1>
        <p className="m-create-lead">
          {companionName} 已经在小屋里等你。创建自己的角色，才能一起待着。
        </p>

        {step === 1 && (
          <>
            <label className="m-create-label" htmlFor="m-create-name">你的名字</label>
            <input
              id="m-create-name"
              className="m-create-input"
              value={name}
              maxLength={12}
              placeholder="最多 12 个字"
              autoComplete="nickname"
              onChange={(event) => {
                setName(event.target.value);
                if (error) setError("");
              }}
            />
            {error && <p className="m-create-error" role="alert">{error}</p>}
            <button type="button" className="m-create-primary" onClick={goLooks}>
              下一步：选样子
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <p className="m-create-label">选一个样子</p>
            <div className="m-create-looks" role="listbox" aria-label="角色外观">
              {PLAYER_LOOKS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={lookId === item.id}
                  className={`m-create-look${lookId === item.id ? " m-selected" : ""}`}
                  onClick={() => setLookId(item.id)}
                >
                  <img src={item.src} alt="" style={{ filter: item.filter }} draggable={false} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
            <div className="m-create-row">
              <button type="button" className="m-create-ghost" onClick={() => setStep(1)}>上一步</button>
              <button type="button" className="m-create-primary" onClick={() => setStep(3)}>下一步：确认</button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="m-create-preview">
              <img src={look.src} alt="" style={{ filter: look.filter }} draggable={false} />
              <div>
                <strong>{trimmed || "？"}</strong>
                <small>和 {companionName} 一起</small>
              </div>
            </div>
            {error && <p className="m-create-error" role="alert">{error}</p>}
            <div className="m-create-row">
              <button type="button" className="m-create-ghost" onClick={() => setStep(2)}>上一步</button>
              <button type="button" className="m-create-primary" onClick={finish}>进入小屋</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
