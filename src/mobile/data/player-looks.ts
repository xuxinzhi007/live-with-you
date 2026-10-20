/** 玩家角色外观（方向 A：我在场）。先用现有立绘 + 滤镜区分，后续可换成 Avatar 定妆资源。 */
export type PlayerLookId = "soft" | "bright" | "calm";

export interface PlayerLook {
  id: PlayerLookId;
  label: string;
  /** public/ 下路径 */
  src: string;
  filter: string;
}

export const PLAYER_LOOKS: PlayerLook[] = [
  { id: "soft", label: "温柔", src: "assets/idle.webp", filter: "none" },
  { id: "bright", label: "开朗", src: "assets/jump.webp", filter: "saturate(1.15) brightness(1.05)" },
  { id: "calm", label: "安静", src: "assets/rest.webp", filter: "saturate(0.85) brightness(0.98)" },
];

export function getPlayerLook(id: PlayerLookId | string | undefined): PlayerLook {
  return PLAYER_LOOKS.find((look) => look.id === id) ?? PLAYER_LOOKS[0];
}
