import "./CodexScreen.css";
import { SUIT_DEFS, WARDROBE_ITEMS, type SavedNikkiState } from "../world/nikki-wardrobe";

interface CodexScreenProps {
  nikki: SavedNikkiState;
  unlockedSet: Set<string>;
  itemImage: (item: (typeof WARDROBE_ITEMS)[number]) => string;
}

export function CodexScreen({ nikki, unlockedSet, itemImage }: CodexScreenProps) {
  const collectionPercent = Math.round((nikki.unlockedIds.length / WARDROBE_ITEMS.length) * 100);
  return (
    <section className="nk-full-view nk-panel-enter" aria-label="全衣橱图鉴">
      <div className="nk-codex-head">
        <div>
          <h2>典藏套装与原画图鉴</h2>
          <p>
            已收集 {nikki.unlockedIds.length} / {WARDROBE_ITEMS.length} 件 ({collectionPercent}%)
          </p>
        </div>
        <div className="nk-codex-bar">
          <i style={{ width: `${collectionPercent}%` }} />
        </div>
      </div>

      <div className="nk-suit-gallery">
        {SUIT_DEFS.map((suit) => {
          const ownedPieces = suit.itemIds.filter((id) => unlockedSet.has(id)).length;
          const complete = ownedPieces === suit.itemIds.length;
          return (
            <div key={suit.id} className={`nk-suit-card${complete ? " m-complete" : ""}`}>
              <div className="nk-suit-top">
                <span className={`nk-rarity-badge m-${suit.rarity}`}>{suit.rarity}</span>
                <strong>{suit.name}</strong>
                <span className="nk-suit-prog">
                  {ownedPieces}/{suit.itemIds.length}
                </span>
              </div>
              <p>{suit.themeDesc}</p>
              <small className="nk-suit-bonus">
                ✨ 共鸣加成：<b>+{suit.bonusScore}</b> 魅力分
              </small>
            </div>
          );
        })}
      </div>

      <div className="nk-codex-list">
        {WARDROBE_ITEMS.map((item) => {
          const owned = unlockedSet.has(item.id);
          const stars = nikki.itemStars[item.id] ?? 1;
          return (
            <div key={item.id} className={`nk-codex-row${owned ? "" : " m-locked"}`}>
              <img className="nk-codex-thumb" src={itemImage(item)} alt={item.name} />
              <div className="nk-codex-info">
                <div className="nk-codex-title">
                  <span className={`nk-rarity-badge m-${item.rarity}`}>{item.rarity}</span>
                  <strong>{owned ? item.name : `${item.name} (未解锁)`}</strong>
                  {owned && <span className="nk-item-stars">{"★".repeat(stars)}</span>}
                </div>
                <p>{item.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
