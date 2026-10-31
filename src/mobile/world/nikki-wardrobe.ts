/**
 * V4.5 · 《奇迹暖暖》深度游戏化核心系统：
 * - 5 大穿搭与卡牌槽位（全部使用 Android 100% 兼容符号 + 服装微缩立绘预览）
 * - 4 大主题典藏套装（【初雪白茶】【深海小鲸鱼】【暮色蔷薇】【星河眠云】），穿齐或收集激活套装共鸣加成
 * - 单品详情检视与升星强化（消耗礼券提升单品星级 ★1 -> ★5，每星 +15% 全属性）
 * - 6 大主题闯关章节 + 互动式「搭配对决 PK 技能系统」（暖暖微笑 / 迷人飞吻 / 免疫挑剔 / 真爱之吻）
 */
import type { CharacterSkinId } from "../engine/types.ts";

export type WardrobeSlot = "dress" | "hairAcc" | "handheld" | "aura" | "memoryCard";
export type StyleAttr = "sweet" | "elegant" | "pure" | "warm" | "cool";
export type ItemRarity = "R" | "SR" | "SSR";
export type StageRank = "C" | "B" | "A" | "S" | "SS" | "SSS";
export type SuitId = "suit-snow-tea" | "suit-whale-maid" | "suit-rose-waltz" | "suit-starlight";

export const STYLE_ATTR_LABELS: Record<StyleAttr, { name: string; color: string; tagBg: string }> = {
  sweet:   { name: "甜美", color: "#d65c83", tagBg: "#fce8ef" },
  elegant: { name: "优雅", color: "#7958b3", tagBg: "#efe9fa" },
  pure:    { name: "清纯", color: "#3d8b6e", tagBg: "#e4f4ed" },
  warm:    { name: "温暖", color: "#c97a36", tagBg: "#fdf0e2" },
  cool:    { name: "清凉", color: "#3e7cb8", tagBg: "#e4effa" },
};

export const SLOT_META: Record<WardrobeSlot, { label: string; short: string; icon: string }> = {
  dress:      { label: "主装扮", short: "装扮", icon: "👗" },
  hairAcc:    { label: "头饰发饰", short: "头饰", icon: "🎀" },
  handheld:   { label: "手持小物", short: "手持", icon: "👜" },
  aura:       { label: "香氛光环", short: "香氛", icon: "✨" },
  memoryCard: { label: "心境羁绊", short: "羁绊", icon: "🃏" },
};

export const WARDROBE_SLOTS: WardrobeSlot[] = ["dress", "hairAcc", "handheld", "aura", "memoryCard"];

export interface StyleStats {
  sweet: number;
  elegant: number;
  pure: number;
  warm: number;
  cool: number;
}

export interface SuitDef {
  id: SuitId;
  name: string;
  rarity: ItemRarity;
  themeDesc: string;
  bonusAttr: StyleAttr;
  bonusScore: number;
  itemIds: string[];
}

export const SUIT_DEFS: SuitDef[] = [
  {
    id: "suit-snow-tea",
    name: "初雪白茶套装",
    rarity: "SR",
    themeDesc: "清晨阳光洒在白茶花瓣与陶土茶杯上，干净温柔的初遇日常。",
    bonusAttr: "pure",
    bonusScore: 450,
    itemIds: ["dress-snow-white", "hair-daisy-clip", "hand-teacup", "aura-morning-breeze", "card-first-tea"],
  },
  {
    id: "suit-whale-maid",
    name: "深海小鲸鱼套装",
    rarity: "SSR",
    themeDesc: "海浪荷叶边与极光水晶球交织的夏日海风甜品店典藏套装。",
    bonusAttr: "cool",
    bonusScore: 950,
    itemIds: ["dress-whale-maid", "hair-whale-beret", "hand-whale-globe", "aura-ocean-bubbles", "card-ocean-promise"],
  },
  {
    id: "suit-rose-waltz",
    name: "暮色蔷薇圆舞曲套装",
    rarity: "SR",
    themeDesc: "黄昏喷泉边的复古音乐茶会，丝绒玫瑰与八音盒的低语。",
    bonusAttr: "elegant",
    bonusScore: 700,
    itemIds: ["dress-rose-waltz", "hair-lace-ribbon", "hand-music-box", "aura-rose-petals", "card-rainy-window"],
  },
  {
    id: "suit-starlight",
    name: "星河眠云典藏套装",
    rarity: "SSR",
    themeDesc: "将漫天流萤、月光珍珠与停驻时光的怀表收入梦境的终极礼服。",
    bonusAttr: "elegant",
    bonusScore: 1200,
    itemIds: ["dress-starlight-dream", "hair-pearl-tiara", "hand-pocket-watch", "aura-starlight-firefly", "card-starlight-waltz"],
  },
];

export interface WardrobeItem {
  id: string;
  slot: WardrobeSlot;
  rarity: ItemRarity;
  name: string;
  subtitle: string;
  icon: string;
  /** 本地 ComfyUI (meinamix_v12Final) 生成的高清二次元插画路径 */
  image: string;
  suitId?: SuitId;
  mainTag: StyleAttr;
  subTag: StyleAttr;
  stats: StyleStats;
  desc: string;
  /** 仅 dress 槽位使用：映射到实际角色皮肤帧 + 舞台背景图 + 滤镜 */
  skinId?: CharacterSkinId;
  stageTheme?: "daylight" | "ocean" | "sunset" | "starlight" | "rose";
  bgScene?: string;
  spriteFilter?: string;
  /** 仅 memoryCard 槽位使用：闯关评分时额外提升某项属性的百分比 */
  skillAttr?: StyleAttr;
  skillBoost?: number;
  skillName?: string;
}

export const WARDROBE_ITEMS: WardrobeItem[] = [
  /* ==================== 1. 主装扮 (dress · 5 件) ==================== */
  {
    id: "dress-snow-white",
    slot: "dress",
    rarity: "SR",
    name: "初雪白茶连衣裙",
    subtitle: "初雪白茶套装",
    icon: "👗",
    image: "assets/characters/original/idle.webp",
    suitId: "suit-snow-tea",
    mainTag: "pure",
    subTag: "sweet",
    stats: { sweet: 320, elegant: 280, pure: 460, warm: 300, cool: 240 },
    desc: "带着阳光晒过棉布香气的纯白连衣裙，裙摆轻盈柔软。",
    skinId: "original",
    stageTheme: "daylight",
    bgScene: "assets/scenes/home.webp",
  },
  {
    id: "dress-whale-maid",
    slot: "dress",
    rarity: "SSR",
    name: "深海小鲸鱼女仆",
    subtitle: "深海小鲸鱼套装",
    icon: "⚓",
    image: "assets/characters/maid/idle.webp",
    suitId: "suit-whale-maid",
    mainTag: "sweet",
    subTag: "cool",
    stats: { sweet: 540, elegant: 420, pure: 400, warm: 220, cool: 520 },
    desc: "蓝白海浪荷叶边围裙配小鲸鱼胸针，海风吹过时裙角像浪花一样翻飞。",
    skinId: "maid",
    stageTheme: "ocean",
    bgScene: "assets/scenes/street.webp",
  },
  {
    id: "dress-apricot-tea",
    slot: "dress",
    rarity: "R",
    name: "杏仁奶昔针织裙",
    subtitle: "午后烘焙坊",
    icon: "🍰",
    image: "assets/nikki/dress-apricot-tea.png",
    mainTag: "warm",
    subTag: "sweet",
    stats: { sweet: 350, elegant: 240, pure: 280, warm: 430, cool: 160 },
    desc: "融化了焦糖与杏仁香气的暖色针织长裙，最适合微凉的雨天。",
    skinId: "original",
    stageTheme: "sunset",
    bgScene: "assets/scenes/home.webp",
    spriteFilter: "sepia(0.18) saturate(1.22) brightness(1.02)",
  },
  {
    id: "dress-rose-waltz",
    slot: "dress",
    rarity: "SR",
    name: "暮色蔷薇圆舞曲",
    subtitle: "暮色蔷薇套装",
    icon: "🌹",
    image: "assets/nikki/dress-rose-waltz.png",
    suitId: "suit-rose-waltz",
    mainTag: "elegant",
    subTag: "sweet",
    stats: { sweet: 430, elegant: 510, pure: 310, warm: 340, cool: 260 },
    desc: "领口缀着丝绒小玫瑰的茶歇礼裙，举手投足都像在跳一曲慢华尔兹。",
    skinId: "original",
    stageTheme: "rose",
    bgScene: "assets/scenes/garden.webp",
    spriteFilter: "hue-rotate(-14deg) saturate(1.18) contrast(1.03)",
  },
  {
    id: "dress-starlight-dream",
    slot: "dress",
    rarity: "SSR",
    name: "星河眠云轻纱裙",
    subtitle: "星河眠云套装",
    icon: "🌌",
    image: "assets/nikki/dress-starlight-dream.png",
    suitId: "suit-starlight",
    mainTag: "elegant",
    subTag: "cool",
    stats: { sweet: 390, elegant: 580, pure: 480, warm: 250, cool: 530 },
    desc: "将整片夜空的细碎星光织进薄纱，走动时仿佛踩在柔软的云朵与银河上。",
    skinId: "maid",
    stageTheme: "starlight",
    bgScene: "assets/scenes/street.webp",
    spriteFilter: "hue-rotate(18deg) saturate(1.15) brightness(1.04)",
  },

  /* ==================== 2. 头饰发饰 (hairAcc · 6 件) ==================== */
  {
    id: "hair-daisy-clip",
    slot: "hairAcc",
    rarity: "R",
    name: "奶油雏菊发夹",
    subtitle: "初雪白茶套装",
    icon: "🌼",
    image: "assets/nikki/item-daisy-clip.png",
    suitId: "suit-snow-tea",
    mainTag: "pure",
    subTag: "sweet",
    stats: { sweet: 180, elegant: 120, pure: 260, warm: 140, cool: 150 },
    desc: "清晨从庭院摘下的小雏菊做成的发夹，干净又温柔。",
  },
  {
    id: "hair-lace-ribbon",
    slot: "hairAcc",
    rarity: "R",
    name: "蕾丝蝴蝶结发带",
    subtitle: "暮色蔷薇套装",
    icon: "🎀",
    image: "assets/nikki/item-lace-ribbon.png",
    suitId: "suit-rose-waltz",
    mainTag: "sweet",
    subTag: "pure",
    stats: { sweet: 270, elegant: 170, pure: 210, warm: 150, cool: 120 },
    desc: "垂在耳畔的双层米白蕾丝缎带，随微风轻轻晃动。",
  },
  {
    id: "hair-plush-bunny",
    slot: "hairAcc",
    rarity: "SR",
    name: "暖绒垂耳兔发箍",
    subtitle: "居家甜梦",
    icon: "🐰",
    image: "assets/nikki/item-plush-bunny.png",
    mainTag: "warm",
    subTag: "sweet",
    stats: { sweet: 340, elegant: 160, pure: 240, warm: 380, cool: 110 },
    desc: "软乎乎的毛绒兔耳，戴上后连发呆都变得格外可爱。",
  },
  {
    id: "hair-whale-beret",
    slot: "hairAcc",
    rarity: "SR",
    name: "海盐海军风礼帽",
    subtitle: "深海小鲸鱼套装",
    icon: "🎩",
    image: "assets/nikki/item-whale-beret.png",
    suitId: "suit-whale-maid",
    mainTag: "cool",
    subTag: "sweet",
    stats: { sweet: 310, elegant: 260, pure: 280, warm: 150, cool: 370 },
    desc: "别着金色船锚徽章的蓝白海军帽，带着清爽的海盐气息。",
  },
  {
    id: "hair-pearl-tiara",
    slot: "hairAcc",
    rarity: "SSR",
    name: "月光珍珠花冠",
    subtitle: "星河眠云套装",
    icon: "👑",
    image: "assets/nikki/item-pearl-tiara.png",
    suitId: "suit-starlight",
    mainTag: "elegant",
    subTag: "pure",
    stats: { sweet: 320, elegant: 460, pure: 410, warm: 200, cool: 340 },
    desc: "由淡水珍珠与银丝藤蔓编织而成的花冠，在夜色下泛着温润月光。",
  },
  {
    id: "hair-sunflower-hat",
    slot: "hairAcc",
    rarity: "SR",
    name: "夏日向日葵草帽",
    subtitle: "晴空野餐",
    icon: "👒",
    image: "assets/nikki/item-sunflower-hat.png",
    mainTag: "cool",
    subTag: "pure",
    stats: { sweet: 290, elegant: 220, pure: 350, warm: 180, cool: 360 },
    desc: "宽檐编织草帽上别着一朵盛开的向日葵，挡住盛夏的烈日。",
  },

  /* ==================== 3. 手持小物 (handheld · 6 件) ==================== */
  {
    id: "hand-teacup",
    slot: "handheld",
    rarity: "R",
    name: "暖白陶土茶杯",
    subtitle: "初雪白茶套装",
    icon: "🍵",
    image: "assets/nikki/item-teacup.png",
    suitId: "suit-snow-tea",
    mainTag: "warm",
    subTag: "pure",
    stats: { sweet: 150, elegant: 190, pure: 230, warm: 260, cool: 110 },
    desc: "装着热伯爵红茶的陶土杯，捧在手心里暖洋洋的。",
  },
  {
    id: "hand-cookie-basket",
    slot: "handheld",
    rarity: "R",
    name: "蜂蜜曲奇藤编篮",
    subtitle: "野餐必备",
    icon: "🍪",
    image: "assets/nikki/item-cookie-basket.png",
    mainTag: "sweet",
    subTag: "warm",
    stats: { sweet: 280, elegant: 140, pure: 200, warm: 250, cool: 100 },
    desc: "铺着红白格餐布的小藤篮，装满了刚出炉的黄油曲奇。",
  },
  {
    id: "hand-sunflower-bouquet",
    slot: "handheld",
    rarity: "SR",
    name: "向日葵满怀花束",
    subtitle: "花房限定",
    icon: "💐",
    image: "assets/nikki/item-sunflower-bouquet.png",
    mainTag: "sweet",
    subTag: "pure",
    stats: { sweet: 360, elegant: 280, pure: 340, warm: 260, cool: 180 },
    desc: "用牛皮纸系着麻绳的饱满花束，把整座庭院的阳光都抱在怀里。",
  },
  {
    id: "hand-music-box",
    slot: "handheld",
    rarity: "SR",
    name: "发条木八音盒",
    subtitle: "暮色蔷薇套装",
    icon: "🎵",
    image: "assets/nikki/item-music-box.png",
    suitId: "suit-rose-waltz",
    mainTag: "elegant",
    subTag: "warm",
    stats: { sweet: 240, elegant: 380, pure: 280, warm: 310, cool: 170 },
    desc: "雕花胡桃木八音盒，轻轻转动发条便流淌出清脆的音符。",
  },
  {
    id: "hand-whale-globe",
    slot: "handheld",
    rarity: "SSR",
    name: "极光小鲸鱼水晶球",
    subtitle: "深海小鲸鱼套装",
    icon: "🔮",
    image: "assets/nikki/item-whale-globe.png",
    suitId: "suit-whale-maid",
    mainTag: "cool",
    subTag: "elegant",
    stats: { sweet: 340, elegant: 430, pure: 390, warm: 190, cool: 470 },
    desc: "剔透的水晶球里封存着一抹极光与游动的小鲸鱼，摇晃时星屑纷飞。",
  },
  {
    id: "hand-pocket-watch",
    slot: "handheld",
    rarity: "SSR",
    name: "停驻时光古董怀表",
    subtitle: "星河眠云套装",
    icon: "⌚",
    image: "assets/nikki/item-pocket-watch.png",
    suitId: "suit-starlight",
    mainTag: "elegant",
    subTag: "warm",
    stats: { sweet: 270, elegant: 490, pure: 320, warm: 410, cool: 260 },
    desc: "烫金表盖内藏着初遇那天的合影，滴答声格外温柔。",
  },

  /* ==================== 4. 香氛光环 (aura · 5 件) ==================== */
  {
    id: "aura-morning-breeze",
    slot: "aura",
    rarity: "R",
    name: "清晨草木微风",
    subtitle: "初雪白茶套装",
    icon: "🍃",
    image: "assets/nikki/item-morning-breeze.png",
    suitId: "suit-snow-tea",
    mainTag: "pure",
    subTag: "cool",
    stats: { sweet: 140, elegant: 160, pure: 260, warm: 120, cool: 230 },
    desc: "雨后庭院里青草与露珠的清爽气息。",
  },
  {
    id: "aura-honey-amber",
    slot: "aura",
    rarity: "SR",
    name: "焦糖暖阳烘焙香",
    subtitle: "冬日暖意",
    icon: "🔥",
    image: "assets/nikki/item-honey-amber.png",
    mainTag: "warm",
    subTag: "sweet",
    stats: { sweet: 310, elegant: 240, pure: 200, warm: 390, cool: 120 },
    desc: "混合着香草、肉桂与热牛奶的温暖烛光光晕。",
  },
  {
    id: "aura-rose-petals",
    slot: "aura",
    rarity: "SR",
    name: "漫天绯色花吹雪",
    subtitle: "暮色蔷薇套装",
    icon: "🌸",
    image: "assets/nikki/item-rose-petals.png",
    suitId: "suit-rose-waltz",
    mainTag: "sweet",
    subTag: "elegant",
    stats: { sweet: 380, elegant: 350, pure: 260, warm: 220, cool: 190 },
    desc: "纷飞的粉色花瓣围绕在身侧，空气里尽是清甜花香。",
  },
  {
    id: "aura-ocean-bubbles",
    slot: "aura",
    rarity: "SR",
    name: "蔚蓝海沫幻彩星泡",
    subtitle: "深海小鲸鱼套装",
    icon: "💧",
    image: "assets/nikki/item-ocean-bubbles.png",
    suitId: "suit-whale-maid",
    mainTag: "cool",
    subTag: "pure",
    stats: { sweet: 280, elegant: 250, pure: 340, warm: 130, cool: 410 },
    desc: "折射着阳光的透明水泡缓缓升起，带来海风般的沁凉。",
  },
  {
    id: "aura-starlight-firefly",
    slot: "aura",
    rarity: "SSR",
    name: "仲夏夜流萤星尘",
    subtitle: "星河眠云套装",
    icon: "✨",
    image: "assets/nikki/item-starlight-firefly.png",
    suitId: "suit-starlight",
    mainTag: "elegant",
    subTag: "pure",
    stats: { sweet: 350, elegant: 480, pure: 440, warm: 260, cool: 390 },
    desc: "点点金色流萤与星尘在裙摆四周环绕闪烁，如同置身童话梦境。",
  },

  /* ==================== 5. 心境羁绊卡 (memoryCard · 5 张) ==================== */
  {
    id: "card-first-tea",
    slot: "memoryCard",
    rarity: "R",
    name: "午后阳光茶会",
    subtitle: "甜美加成 +12%",
    icon: "🍰",
    image: "assets/nikki/card-first-tea.png",
    suitId: "suit-snow-tea",
    mainTag: "sweet",
    subTag: "warm",
    stats: { sweet: 260, elegant: 180, pure: 220, warm: 240, cool: 140 },
    desc: "「第一块草莓蛋糕要分你一半！」—— 评比时【甜美】总分额外提升 12%。",
    skillAttr: "sweet",
    skillBoost: 0.12,
    skillName: "草莓甜心 +12%",
  },
  {
    id: "card-rainy-window",
    slot: "memoryCard",
    rarity: "SR",
    name: "窗边的听雨午后",
    subtitle: "清纯加成 +16%",
    icon: "🌧️",
    image: "assets/nikki/card-rainy-window.png",
    suitId: "suit-rose-waltz",
    mainTag: "pure",
    subTag: "elegant",
    stats: { sweet: 240, elegant: 320, pure: 380, warm: 220, cool: 280 },
    desc: "两个人在小屋窗边并肩听雨，玻璃上画着小小笑脸 —— 评比时【清纯】总分额外提升 16%。",
    skillAttr: "pure",
    skillBoost: 0.16,
    skillName: "雨露澄心 +16%",
  },
  {
    id: "card-midnight-cocoa",
    slot: "memoryCard",
    rarity: "SR",
    name: "深夜棉花糖可可",
    subtitle: "温暖加成 +16%",
    icon: "☕",
    image: "assets/nikki/card-midnight-cocoa.png",
    mainTag: "warm",
    subTag: "sweet",
    stats: { sweet: 310, elegant: 260, pure: 240, warm: 410, cool: 150 },
    desc: "睡不着的夜晚，两杯冒着热气的可可聊到星星入睡 —— 评比时【温暖】总分额外提升 16%。",
    skillAttr: "warm",
    skillBoost: 0.16,
    skillName: "暖夜可可 +16%",
  },
  {
    id: "card-ocean-promise",
    slot: "memoryCard",
    rarity: "SSR",
    name: "蔚蓝海风的约定",
    subtitle: "清凉加成 +22%",
    icon: "🌊",
    image: "assets/nikki/card-ocean-promise.png",
    suitId: "suit-whale-maid",
    mainTag: "cool",
    subTag: "sweet",
    stats: { sweet: 410, elegant: 360, pure: 390, warm: 200, cool: 510 },
    desc: "小鲸鱼女仆在海浪边的回眸一笑 —— 评比时【清凉】总分额外提升 22%。",
    skillAttr: "cool",
    skillBoost: 0.22,
    skillName: "海风轻吟 +22%",
  },
  {
    id: "card-starlight-waltz",
    slot: "memoryCard",
    rarity: "SSR",
    name: "星河下的圆舞曲",
    subtitle: "优雅加成 +22%",
    icon: "🌟",
    image: "assets/nikki/card-starlight-waltz.png",
    suitId: "suit-starlight",
    mainTag: "elegant",
    subTag: "pure",
    stats: { sweet: 380, elegant: 530, pure: 420, warm: 290, cool: 350 },
    desc: "当喷泉亮起星光，她在漫天花瓣中向你伸出手 —— 评比时【优雅】总分额外提升 22%。",
    skillAttr: "elegant",
    skillBoost: 0.22,
    skillName: "星河华尔兹 +22%",
  },
];

export const DEFAULT_UNLOCKED_ITEM_IDS: string[] = [
  "dress-snow-white",
  "hair-daisy-clip",
  "hand-teacup",
  "aura-morning-breeze",
  "card-first-tea",
];

export type EquippedOutfit = Record<WardrobeSlot, string>;

export const DEFAULT_EQUIPPED_OUTFIT: EquippedOutfit = {
  dress: "dress-snow-white",
  hairAcc: "hair-daisy-clip",
  handheld: "hand-teacup",
  aura: "aura-morning-breeze",
  memoryCard: "card-first-tea",
};

export function getWardrobeItem(id: string): WardrobeItem {
  return WARDROBE_ITEMS.find((item) => item.id === id) ?? WARDROBE_ITEMS[0];
}

/* ==================== 《奇迹暖暖》式舞台 PK 主动技能 ==================== */

export interface StylingSkill {
  id: "smile" | "charm" | "shield" | "bloom";
  name: string;
  icon: string;
  desc: string;
  bonusMultiplier: number;
  flatBonus: number;
}

export const STYLING_SKILLS: StylingSkill[] = [
  {
    id: "smile",
    name: "暖暖微笑",
    icon: "😊",
    desc: "甜美一笑，主考核属性得分 +25%",
    bonusMultiplier: 0.25,
    flatBonus: 260,
  },
  {
    id: "charm",
    name: "迷人飞吻",
    icon: "💖",
    desc: "眨眼飞吻，副考核属性得分 +32%",
    bonusMultiplier: 0.32,
    flatBonus: 310,
  },
  {
    id: "shield",
    name: "优雅气场",
    icon: "🛡️",
    desc: "从容转身，全五维基础得分 +12%",
    bonusMultiplier: 0.12,
    flatBonus: 420,
  },
  {
    id: "bloom",
    name: "星光绽放",
    icon: "✨",
    desc: "点亮聚光灯，直接追加 +680 舞台魅力分",
    bonusMultiplier: 0.15,
    flatBonus: 680,
  },
];

/* ==================== 6 大主题出行搭配闯关 (Styling Stages) ==================== */

export interface StylingStage {
  id: string;
  chapter: string;
  title: string;
  rivalName: string;
  rivalScore: number;
  desc: string;
  hint: string;
  icon: string;
  primaryAttr: StyleAttr;
  secondaryAttr: StyleAttr;
  weights: StyleStats;
  sScore: number;
  ssScore: number;
  sssScore: number;
  rewardCoins: number;
  firstSRewardItem?: string;
}

export const STYLING_STAGES: StylingStage[] = [
  {
    id: "stage-1",
    chapter: "第 1 话",
    title: "初遇·阳光下的白茶会",
    rivalName: "邻家学姐·苏苏",
    rivalScore: 3800,
    desc: "搬进小屋的第一个周末，阳光洒在窗台，适合换上一身清爽干净的装扮和雯宝喝杯早茶。",
    hint: "主打风格：【清纯】与【甜美】",
    icon: "🍵",
    primaryAttr: "pure",
    secondaryAttr: "sweet",
    weights: { pure: 1.8, sweet: 1.5, warm: 1.0, elegant: 0.9, cool: 0.8 },
    sScore: 4200,
    ssScore: 5400,
    sssScore: 6800,
    rewardCoins: 8,
    firstSRewardItem: "hair-lace-ribbon",
  },
  {
    id: "stage-2",
    chapter: "第 2 话",
    title: "烘焙·微雨午后的曲奇香",
    rivalName: "甜点师·可可",
    rivalScore: 4300,
    desc: "窗外下起了淅淅沥沥的小雨，屋里烤箱叮的一声，穿得暖暖和和地一起分享蜂蜜曲奇吧。",
    hint: "主打风格：【温暖】与【甜美】",
    icon: "🍪",
    primaryAttr: "warm",
    secondaryAttr: "sweet",
    weights: { warm: 1.9, sweet: 1.6, pure: 1.0, elegant: 0.8, cool: 0.5 },
    sScore: 4600,
    ssScore: 6000,
    sssScore: 7500,
    rewardCoins: 10,
    firstSRewardItem: "dress-apricot-tea",
  },
  {
    id: "stage-3",
    chapter: "第 3 话",
    title: "庭院·向日葵盛开的晴空",
    rivalName: "花房少女·葵",
    rivalScore: 4700,
    desc: "雨过天晴，庭院里的花朵全开了！搭配一身清爽有活力的郊游装扮去拍照留念吧。",
    hint: "主打风格：【清凉】与【清纯】",
    icon: "🌻",
    primaryAttr: "cool",
    secondaryAttr: "pure",
    weights: { cool: 1.8, pure: 1.6, sweet: 1.2, elegant: 0.9, warm: 0.6 },
    sScore: 5000,
    ssScore: 6500,
    sssScore: 8200,
    rewardCoins: 12,
    firstSRewardItem: "hand-sunflower-bouquet",
  },
  {
    id: "stage-4",
    chapter: "第 4 话",
    title: "街角·海风女仆咖啡屋",
    rivalName: "店长·玛奇朵",
    rivalScore: 5200,
    desc: "街区新开了一家海洋主题的甜品屋，快换上最灵动甜美的海风装扮去当一日店长！",
    hint: "主打风格：【甜美】与【清凉】",
    icon: "⚓",
    primaryAttr: "sweet",
    secondaryAttr: "cool",
    weights: { sweet: 1.9, cool: 1.7, elegant: 1.1, pure: 1.1, warm: 0.5 },
    sScore: 5600,
    ssScore: 7200,
    sssScore: 9000,
    rewardCoins: 15,
    firstSRewardItem: "hair-whale-beret",
  },
  {
    id: "stage-5",
    chapter: "第 5 话",
    title: "暮色·喷泉边的蔷薇晚宴",
    rivalName: "提琴手·薇薇安",
    rivalScore: 5700,
    desc: "傍晚的街区亮起了复古路灯，喷泉边正在举办小型音乐茶会，需要得体又优雅的礼服搭配。",
    hint: "主打风格：【优雅】与【温暖】",
    icon: "🌹",
    primaryAttr: "elegant",
    secondaryAttr: "warm",
    weights: { elegant: 2.0, warm: 1.5, sweet: 1.2, pure: 0.9, cool: 0.8 },
    sScore: 6000,
    ssScore: 7800,
    sssScore: 9600,
    rewardCoins: 18,
    firstSRewardItem: "dress-rose-waltz",
  },
  {
    id: "stage-6",
    chapter: "终章",
    title: "星河·仲夏夜的许愿庆典",
    rivalName: "星夜女王·艾莉",
    rivalScore: 6500,
    desc: "满天星河落入喷泉，整条街区被流萤点亮。换上最璀璨的典藏盛装，和雯宝许下永恒心愿！",
    hint: "主打风格：【优雅】与【清纯】",
    icon: "🌌",
    primaryAttr: "elegant",
    secondaryAttr: "pure",
    weights: { elegant: 2.1, pure: 1.8, cool: 1.4, sweet: 1.3, warm: 0.8 },
    sScore: 6800,
    ssScore: 8800,
    sssScore: 10800,
    rewardCoins: 24,
    firstSRewardItem: "aura-starlight-firefly",
  },
];

/* ==================== 穿搭属性汇总、套装共鸣与打分引擎 ==================== */

export interface OutfitEvaluation {
  stage: StylingStage;
  rawStats: StyleStats;
  weightedStats: StyleStats;
  skillBonusScore: number;
  skillLabel: string;
  activeSkillBonus: number;
  activeSuit: SuitDef | null;
  suitBonusScore: number;
  totalScore: number;
  rank: StageRank;
  passedS: boolean;
  beatRival: boolean;
  comment: string;
}

export function getItemStarMultiplier(starLevel = 1): number {
  const clamped = Math.max(1, Math.min(5, Math.floor(starLevel)));
  return 1 + (clamped - 1) * 0.15;
}

/** 检查当前穿戴是否凑齐了某套典藏套装（穿齐 ≥3 件同套装即触发共鸣，5 件全齐触发满额套装加成） */
export function detectActiveSuit(equipped: EquippedOutfit): { suit: SuitDef | null; pieceCount: number; bonusScore: number } {
  const counts = new Map<SuitId, number>();
  for (const slot of WARDROBE_SLOTS) {
    const item = getWardrobeItem(equipped[slot] || DEFAULT_EQUIPPED_OUTFIT[slot]);
    if (item.suitId) {
      counts.set(item.suitId, (counts.get(item.suitId) ?? 0) + 1);
    }
  }
  for (const suit of SUIT_DEFS) {
    const c = counts.get(suit.id) ?? 0;
    if (c >= 3) {
      const ratio = c >= 5 ? 1 : c === 4 ? 0.65 : 0.4;
      return { suit, pieceCount: c, bonusScore: Math.round(suit.bonusScore * ratio) };
    }
  }
  return { suit: null, pieceCount: 0, bonusScore: 0 };
}

export function computeOutfitStats(
  equipped: EquippedOutfit,
  itemStars: Record<string, number> = {},
): StyleStats {
  const total: StyleStats = { sweet: 0, elegant: 0, pure: 0, warm: 0, cool: 0 };
  for (const slot of WARDROBE_SLOTS) {
    const itemId = equipped[slot] || DEFAULT_EQUIPPED_OUTFIT[slot];
    const item = getWardrobeItem(itemId);
    const mult = getItemStarMultiplier(itemStars[item.id] ?? 1);
    total.sweet += Math.round(item.stats.sweet * mult);
    total.elegant += Math.round(item.stats.elegant * mult);
    total.pure += Math.round(item.stats.pure * mult);
    total.warm += Math.round(item.stats.warm * mult);
    total.cool += Math.round(item.stats.cool * mult);
  }
  return total;
}

export function evaluateOutfitForStage(
  stage: StylingStage,
  equipped: EquippedOutfit,
  itemStars: Record<string, number> = {},
  castSkills: StylingSkill["id"][] = ["smile", "charm"],
): OutfitEvaluation {
  const raw = computeOutfitStats(equipped, itemStars);
  const weighted: StyleStats = {
    sweet: Math.round(raw.sweet * stage.weights.sweet),
    elegant: Math.round(raw.elegant * stage.weights.elegant),
    pure: Math.round(raw.pure * stage.weights.pure),
    warm: Math.round(raw.warm * stage.weights.warm),
    cool: Math.round(raw.cool * stage.weights.cool),
  };

  // 1. 心境羁绊卡被动加成
  const cardItem = getWardrobeItem(equipped.memoryCard || DEFAULT_EQUIPPED_OUTFIT.memoryCard);
  let skillBonusScore = 0;
  let skillLabel = "羁绊共鸣";
  if (cardItem.skillAttr && cardItem.skillBoost) {
    const attrScore = weighted[cardItem.skillAttr];
    skillBonusScore = Math.round(attrScore * cardItem.skillBoost);
    skillLabel = cardItem.skillName || `${STYLE_ATTR_LABELS[cardItem.skillAttr].name}加成`;
  }

  // 2. 玩家释放的主动舞台技能加成
  let activeSkillBonus = 0;
  for (const skId of castSkills.slice(0, 2)) {
    const sk = STYLING_SKILLS.find((s) => s.id === skId);
    if (!sk) continue;
    if (sk.id === "smile") {
      activeSkillBonus += Math.round(weighted[stage.primaryAttr] * sk.bonusMultiplier) + sk.flatBonus;
    } else if (sk.id === "charm") {
      activeSkillBonus += Math.round(weighted[stage.secondaryAttr] * sk.bonusMultiplier) + sk.flatBonus;
    } else {
      activeSkillBonus += sk.flatBonus;
    }
  }

  // 3. 套装共鸣加成
  const suitInfo = detectActiveSuit(equipped);

  const baseSum = weighted.sweet + weighted.elegant + weighted.pure + weighted.warm + weighted.cool;
  const totalScore = baseSum + skillBonusScore + activeSkillBonus + suitInfo.bonusScore;

  let rank: StageRank = "C";
  if (totalScore >= stage.sssScore) rank = "SSS";
  else if (totalScore >= stage.ssScore) rank = "SS";
  else if (totalScore >= stage.sScore) rank = "S";
  else if (totalScore >= stage.sScore * 0.82) rank = "A";
  else if (totalScore >= stage.sScore * 0.65) rank = "B";

  const passedS = rank === "S" || rank === "SS" || rank === "SSS";
  const beatRival = totalScore >= stage.rivalScore;

  const pName = STYLE_ATTR_LABELS[stage.primaryAttr].name;
  const sName = STYLE_ATTR_LABELS[stage.secondaryAttr].name;
  const comment =
    rank === "SSS"
      ? `✨ 完美无瑕的【${pName}·${sName}】传奇搭配！远超对手 ${stage.rivalName}，惊艳全场！`
      : rank === "SS"
        ? `🌟 非常亮眼的搭配！【${pName}】气质拉满，雯宝开心得转了个圈～`
        : rank === "S"
          ? `💖 顺利达成 S 级评价！成功赢过 ${stage.rivalName}！`
          : `💡 离 S 级（${stage.sScore} 分）还差 ${Math.max(10, stage.sScore - totalScore)} 分，试试给单品【升星强化】或去星愿幻阁抽新套装吧！`;

  return {
    stage,
    rawStats: raw,
    weightedStats: weighted,
    skillBonusScore,
    skillLabel,
    activeSkillBonus,
    activeSuit: suitInfo.suit,
    suitBonusScore: suitInfo.bonusScore,
    totalScore,
    rank,
    passedS,
    beatRival,
    comment,
  };
}

export function recommendBestOutfitForStage(
  stage: StylingStage,
  unlockedIds: Set<string>,
  itemStars: Record<string, number> = {},
): EquippedOutfit {
  const best: EquippedOutfit = { ...DEFAULT_EQUIPPED_OUTFIT };

  for (const slot of WARDROBE_SLOTS) {
    const candidates = WARDROBE_ITEMS.filter(
      (item) => item.slot === slot && (unlockedIds.has(item.id) || DEFAULT_UNLOCKED_ITEM_IDS.includes(item.id)),
    );
    let bestId = best[slot];
    let bestScore = -1;
    for (const item of candidates) {
      const mult = getItemStarMultiplier(itemStars[item.id] ?? 1);
      let score =
        (item.stats.sweet * stage.weights.sweet +
          item.stats.elegant * stage.weights.elegant +
          item.stats.pure * stage.weights.pure +
          item.stats.warm * stage.weights.warm +
          item.stats.cool * stage.weights.cool) *
        mult;
      if (item.skillAttr && item.skillBoost) {
        score *= 1 + item.skillBoost * 0.6;
      }
      if (score > bestScore) {
        bestScore = score;
        bestId = item.id;
      }
    }
    best[slot] = bestId;
  }

  return best;
}

/* ==================== 星愿幻阁抽卡 ==================== */

export interface PavilionPullItem {
  item: WardrobeItem;
  isNew: boolean;
  newStarLevel: number;
}

export function rollPavilionGacha(
  count: 1 | 5,
  unlockedIds: Set<string>,
  currentStars: Record<string, number>,
  rng = Math.random,
): {
  pulls: PavilionPullItem[];
  nextUnlockedIds: string[];
  nextStars: Record<string, number>;
  bondGained: number;
} {
  const nextUnlocked = new Set<string>([...DEFAULT_UNLOCKED_ITEM_IDS, ...unlockedIds]);
  const nextStars: Record<string, number> = { ...currentStars };
  const pulls: PavilionPullItem[] = [];
  let bondGained = 0;

  for (let i = 0; i < count; i++) {
    const guaranteeHigh = count === 5 && i === 4 && !pulls.some((p) => p.item.rarity === "SR" || p.item.rarity === "SSR");
    const pool = guaranteeHigh
      ? WARDROBE_ITEMS.filter((it) => it.rarity === "SR" || it.rarity === "SSR")
      : WARDROBE_ITEMS;

    const weights = pool.map((it) => {
      const base = it.rarity === "SSR" ? 14 : it.rarity === "SR" ? 36 : 60;
      return nextUnlocked.has(it.id) ? base : base * 2.2;
    });
    const sum = weights.reduce((a, b) => a + b, 0);
    let r = rng() * sum;
    let picked = pool[0];
    for (let j = 0; j < pool.length; j++) {
      r -= weights[j];
      if (r <= 0) {
        picked = pool[j];
        break;
      }
    }

    const isNew = !nextUnlocked.has(picked.id);
    nextUnlocked.add(picked.id);
    const prevStar = nextStars[picked.id] ?? 1;
    const newStarLevel = isNew ? 1 : Math.min(5, prevStar + 1);
    nextStars[picked.id] = newStarLevel;

    bondGained += picked.rarity === "SSR" ? 18 : picked.rarity === "SR" ? 10 : 6;
    pulls.push({ item: picked, isNew, newStarLevel });
  }

  return {
    pulls,
    nextUnlockedIds: Array.from(nextUnlocked),
    nextStars,
    bondGained,
  };
}
