import "./WardrobeScreen.css";
import {
  SLOT_META,
  STYLE_ATTR_LABELS,
  WARDROBE_SLOTS,
  type SavedNikkiState,
  type WardrobeItem,
  type WardrobeSlot,
} from "../world/nikki-wardrobe";
import { isComfyDressSource } from "../world/remote-assets";

interface WardrobeScreenProps {
  nikki: SavedNikkiState;
  activeSlot: WardrobeSlot;
  inspectedItem: WardrobeItem;
  inspectedStars: number;
  inspectedOwned: boolean;
  slotItems: WardrobeItem[];
  unlockedSet: Set<string>;
  cutoutMap: Record<string, string>;
  itemImage: (item: WardrobeItem) => string;
  onSelectSlot: (slot: WardrobeSlot) => void;
  onSelectOrEquip: (item: WardrobeItem) => void;
  onUpgradeOrCraft: (item: WardrobeItem) => void;
}

export function WardrobeScreen({
  nikki,
  activeSlot,
  inspectedItem,
  inspectedStars,
  inspectedOwned,
  slotItems,
  unlockedSet,
  cutoutMap,
  itemImage,
  onSelectSlot,
  onSelectOrEquip,
  onUpgradeOrCraft,
}: WardrobeScreenProps) {
  return (
    <section className="nk-panel nk-panel-enter" aria-label="换装衣橱">
      <div className="nk-slot-tabs" role="tablist">
        {WARDROBE_SLOTS.map((slot) => {
          const meta = SLOT_META[slot];
          const active = activeSlot === slot;
          return (
            <button
              key={slot}
              type="button"
              role="tab"
              aria-selected={active}
              className={`nk-slot-tab${active ? " m-active" : ""}`}
              onClick={() => onSelectSlot(slot)}
            >
              <span>{meta.icon}</span>
              <b>{meta.short}</b>
            </button>
          );
        })}
      </div>

      <div className="nk-slim-bar">
        <div className="nk-slim-info">
          <span className={`nk-rarity-badge m-${inspectedItem.rarity}`}>{inspectedItem.rarity}</span>
          <strong>{inspectedItem.name}</strong>
          <span className="nk-item-stars">{"★".repeat(inspectedStars)}</span>
          <small>
            {STYLE_ATTR_LABELS[inspectedItem.mainTag].name}+{inspectedItem.stats[inspectedItem.mainTag]} ·{" "}
            {inspectedItem.skillName ||
              `${STYLE_ATTR_LABELS[inspectedItem.subTag].name}+${inspectedItem.stats[inspectedItem.subTag]}`}
          </small>
        </div>
        <button
          type="button"
          className={`nk-slim-btn${inspectedOwned ? "" : " m-craft"}`}
          onClick={() => onUpgradeOrCraft(inspectedItem)}
        >
          {inspectedOwned
            ? inspectedStars < 5
              ? `⭐ 升星 (${inspectedStars * 8}券)`
              : "✨ 已满星"
            : `🔨 定制 (${inspectedItem.rarity === "SSR" ? 28 : inspectedItem.rarity === "SR" ? 16 : 10}券)`}
        </button>
      </div>

      <div className="nk-carousel">
        {slotItems.map((item) => {
          const owned = unlockedSet.has(item.id);
          const isEquipped = nikki.equipped[item.slot] === item.id;
          const isInspected = inspectedItem.id === item.id;
          const stars = nikki.itemStars[item.id] ?? 1;
          const mainMeta = STYLE_ATTR_LABELS[item.mainTag];
          const subMeta = STYLE_ATTR_LABELS[item.subTag];

          return (
            <button
              key={item.id}
              type="button"
              className={`nk-art-card m-rarity-${item.rarity}${isEquipped ? " m-equipped" : ""}${isInspected ? " m-selected" : ""}${!owned ? " m-locked" : ""}`}
              onClick={() => onSelectOrEquip(item)}
            >
              {item.slot === "dress" && isComfyDressSource(item.image) && !cutoutMap[item.id] ? (
                <span className="nk-art-pending" aria-hidden="true" />
              ) : (
                <img
                  className="nk-art-img"
                  src={item.slot === "dress" ? cutoutMap[item.id] || itemImage(item) : itemImage(item)}
                  alt={item.name}
                  draggable={false}
                />
              )}
              {item.rarity === "SSR" && <i className="nk-foil-shimmer" aria-hidden="true" />}

              <div className="nk-art-top">
                <span className={`nk-rarity-badge m-${item.rarity}`}>{item.rarity}</span>
                {isEquipped ? (
                  <span className="nk-equipped-pill">穿戴</span>
                ) : (
                  <span className="nk-art-stars">{"★".repeat(stars)}</span>
                )}
              </div>

              {!owned && <span className="nk-art-lock">🔒 未解锁</span>}

              <div className="nk-art-footer">
                <strong className="nk-art-name">{item.name}</strong>
                <div className="nk-art-tags">
                  <span style={{ background: mainMeta.tagBg, color: mainMeta.color }}>{mainMeta.name}</span>
                  <span style={{ background: subMeta.tagBg, color: subMeta.color }}>{subMeta.name}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
