import {
  STYLING_SKILLS,
  STYLING_STAGES,
  isStageUnlocked,
  type SavedNikkiState,
  type StylingSkill,
  type StylingStage,
} from "../world/nikki-wardrobe";

interface StagesScreenProps {
  nikki: SavedNikkiState;
  selectedStage: StylingStage;
  selectedSkills: StylingSkill["id"][];
  livePreviewEval: { rank: string };
  selectedStageOpen: boolean;
  onSelectStage: (id: string) => void;
  onToggleSkill: (id: StylingSkill["id"]) => void;
  onAutoRecommend: (stage: StylingStage) => void;
  onStartEval: (stage: StylingStage) => void;
}

export function StagesScreen({
  nikki,
  selectedStage,
  selectedSkills,
  livePreviewEval,
  selectedStageOpen,
  onSelectStage,
  onToggleSkill,
  onAutoRecommend,
  onStartEval,
}: StagesScreenProps) {
  return (
    <section className="nk-panel nk-panel-enter" aria-label="主题搭配闯关">
      <div className="nk-stage-selector">
        {STYLING_STAGES.map((st) => {
          const active = st.id === selectedStage.id;
          const bestRank = nikki.clearedStages[st.id];
          const open = isStageUnlocked(st.id, nikki.clearedStages);
          return (
            <button
              key={st.id}
              type="button"
              className={`nk-stage-pill${active ? " m-active" : ""}${open ? "" : " m-locked"}`}
              onClick={() => onSelectStage(st.id)}
            >
              <span>{st.chapter}</span>
              {open ? (
                bestRank && <b className={`nk-rank-mini m-${bestRank}`}>{bestRank}</b>
              ) : (
                <b>未开</b>
              )}
            </button>
          );
        })}
      </div>

      <div className="nk-stage-detail">
        <div className="nk-stage-head">
          <span className="nk-stage-ic">{selectedStage.icon}</span>
          <div className="nk-stage-title-box">
            <div className="nk-stage-vs-line">
              <h3>
                {selectedStage.chapter} · {selectedStage.title}
              </h3>
              <span className="nk-rival-tag">
                对手: {selectedStage.rivalName} ({selectedStage.rivalScore})
              </span>
            </div>
            <p>{selectedStage.desc}</p>
          </div>
        </div>

        <div className="nk-skill-picker">
          <span className="nk-skill-label">技能(2项)：</span>
          {STYLING_SKILLS.map((sk) => {
            const chosen = selectedSkills.includes(sk.id);
            return (
              <button
                key={sk.id}
                type="button"
                className={`nk-skill-chip${chosen ? " m-on" : ""}`}
                onClick={() => onToggleSkill(sk.id)}
              >
                <span>{sk.icon}</span>
                <b>{sk.name}</b>
              </button>
            );
          })}
        </div>

        <div className="nk-stage-actions">
          <button
            type="button"
            className="nk-btn-secondary"
            onClick={() => onAutoRecommend(selectedStage)}
            disabled={!selectedStageOpen}
          >
            最优推荐
          </button>
          <button
            type="button"
            className="nk-btn-primary"
            onClick={() => onStartEval(selectedStage)}
            disabled={!selectedStageOpen}
          >
            {selectedStageOpen ? `开始对决 (预估 ${livePreviewEval.rank})` : "上一话达到 S 后开放"}
          </button>
        </div>
      </div>
    </section>
  );
}
