/** V2 素材映射。所有路径相对 public/。 */
import type { WorldRoomId } from "../engine/types";
import type { FlowerKind } from "../engine/types";
import type { PropKind } from "./rooms";

export const ROOM_BACKGROUND: Record<WorldRoomId, string> = {
  home: "assets/scenes/home.webp",
  garden: "assets/scenes/garden.webp",
  street: "assets/scenes/street.webp",
};

/* 角色帧不在这里：见 ./skins.ts（original / maid 两套皮肤）。 */

export const PROP_ASSETS: Record<PropKind, string> = {
  door: "assets/scenes/prop-door.webp",
  bed: "assets/scenes/prop-bed.webp",
  desk: "assets/scenes/prop-desk.webp",
  shelf: "assets/scenes/prop-shelf.webp",
  plant: "assets/scenes/prop-plant.webp",
  rug: "assets/scenes/prop-rug.webp",
  plot: "assets/scenes/prop-plot.webp",
  stall: "assets/scenes/prop-stall.webp",
  bench: "assets/scenes/prop-bench.webp",
  fountain: "assets/scenes/prop-fountain.webp",
  lamp: "assets/scenes/prop-lamp.webp",
  tree: "assets/scenes/prop-tree.webp",
  crate: "assets/scenes/prop-crate.webp",
  ball: "assets/scenes/prop-ball.webp",
};

export const PLOT_ASSETS: Record<"sprout" | "bud", string> = {
  sprout: "assets/scenes/plot-sprout.webp",
  bud: "assets/scenes/plot-bud.webp",
};

export const BLOOM_ASSETS: Record<FlowerKind, string> = {
  daisy: "assets/scenes/plot-bloom-daisy.webp",
  rose: "assets/scenes/plot-bloom-rose.webp",
  sunflower: "assets/scenes/plot-bloom-sunflower.webp",
};

/** 花圃植物覆盖图的画布比例（与 prop-plot 同宽）。 */
export const PLOT_OVERLAY_ASPECT = 195 / 213;
