// 像素风家具 SVG Sprite 生成器
// 每个 sprite 返回 data URI 可直接用作 img src

const PIXEL = "data:image/svg+xml,";

function svg(content: string, w = 32, h = 32): string {
  return PIXEL + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" shape-rendering="crispEdges">${content}</svg>`
  );
}

function rect(x: number, y: number, w: number, h: number, fill: string): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
}

// ========== 卧室家具 ==========

export const SPRITE_BED = svg(`
  ${rect(0,8,32,16,'#c97c6e')}
  ${rect(2,6,28,20,'#e8b4a8')}
  ${rect(4,8,12,14,'#f5e6d3')}
  ${rect(18,8,12,14,'#f0ddd0')}
  ${rect(0,24,32,8,'#8b5e4a')}
  ${rect(2,2,16,6,'#f5e6d3')}
  ${rect(18,2,16,6,'#e8c8b8')}
`, 32, 32);

export const SPRITE_DESK = svg(`
  ${rect(2,10,28,2,'#d4a574')}
  ${rect(2,12,28,4,'#c99d6a')}
  ${rect(4,16,4,14,'#a07848')}
  ${rect(24,16,4,14,'#a07848')}
  ${rect(8,16,16,2,'#b89060')}
  ${rect(10,2,12,8,'#e8d4b8')}
  ${rect(12,4,8,4,'#f0e0c8')}
`, 32, 32);

export const SPRITE_ARMCHAIR = svg(`
  ${rect(4,14,24,14,'#c07872')}
  ${rect(6,12,20,4,'#d49088')}
  ${rect(6,16,20,10,'#a86058')}
  ${rect(2,16,4,12,'#b07068')}
  ${rect(26,16,4,12,'#b07068')}
  ${rect(8,22,6,4,'#d4a098')}
  ${rect(18,22,6,4,'#d4a098')}
`, 32, 32);

export const SPRITE_WINDOW = svg(`
  ${rect(0,0,32,32,'#8ec5dd')}
  ${rect(2,2,28,28,'#b0d8ec')}
  ${rect(15,0,2,32,'#a0c8dc')}
  ${rect(0,15,32,2,'#a0c8dc')}
  ${rect(4,4,10,10,'#d0e8f5')}
  ${rect(18,4,10,10,'#d0e8f5')}
  ${rect(4,18,10,10,'#c8e0f0')}
  ${rect(18,18,10,10,'#c8e0f0')}
  ${rect(0,0,32,2,'#7ab0c8')}
  ${rect(0,0,2,32,'#7ab0c8')}
  ${rect(0,30,32,2,'#7ab0c8')}
  ${rect(30,0,2,32,'#7ab0c8')}
`, 32, 32);

export const SPRITE_PLANT = svg(`
  ${rect(10,22,12,10,'#c9704e')}
  ${rect(12,24,8,6,'#d4805e')}
  ${rect(14,2,4,18,'#5a8a4a')}
  ${rect(10,6,12,4,'#6aa05a')}
  ${rect(8,10,16,4,'#7ab46a')}
  ${rect(12,0,8,6,'#4a7a3a')}
  ${rect(6,14,4,4,'#8ab87a')}
  ${rect(22,14,4,4,'#8ab87a')}
`, 32, 32);

export const SPRITE_LAMP = svg(`
  ${rect(12,24,8,8,'#8b7355')}
  ${rect(14,10,4,14,'#a08060')}
  ${rect(8,4,16,8,'#f5e0a8')}
  ${rect(10,2,12,4,'#fde8b8')}
  ${rect(6,6,4,4,'#fce898')}
  ${rect(22,6,4,4,'#fce898')}
  ${rect(10,0,12,2,'#fff0c8')}
`, 32, 32);

export const SPRITE_RUG = svg(`
  ${rect(0,4,32,24,'#d9b49a')}
  ${rect(2,2,28,28,'#e8c8a8')}
  ${rect(4,6,24,20,'#f0d4b8')}
  ${rect(8,8,16,16,'#d9a888')}
  ${rect(12,12,8,8,'#c99878')}
`, 32, 32);

export const SPRITE_TOY_BOX = svg(`
  ${rect(2,6,28,24,'#e8a87c')}
  ${rect(4,4,24,4,'#f0b88a')}
  ${rect(6,8,20,18,'#d4986c')}
  ${rect(8,10,16,14,'#c98860')}
  ${rect(12,12,8,8,'#e8a87c')}
  ${rect(14,14,4,4,'#f5c8a0')}
  ${rect(12,2,8,4,'#f5c8a0')}
`, 32, 32);

export const SPRITE_SNACK = svg(`
  ${rect(8,8,16,16,'#f5c6aa')}
  ${rect(10,6,12,20,'#fce0c0')}
  ${rect(12,10,8,12,'#fdd8b0')}
  ${rect(14,12,4,8,'#f0a080')}
  ${rect(10,14,2,2,'#e89070')}
  ${rect(20,14,2,2,'#e89070')}
  ${rect(14,20,4,2,'#e89070')}
`, 32, 32);

export const SPRITE_RECORD = svg(`
  ${rect(6,6,20,20,'#8b6f5c')}
  ${rect(8,4,16,4,'#a0806c')}
  ${rect(10,8,12,12,'#6b5548')}
  ${rect(14,12,4,4,'#4a3a30')}
  ${rect(8,28,16,4,'#a0806c')}
`, 32, 32);

export const SPRITE_DOOR = svg(`
  ${rect(4,0,24,32,'#a07050')}
  ${rect(6,2,20,28,'#b8846a')}
  ${rect(8,4,16,24,'#c99878')}
  ${rect(22,14,4,4,'#d4a888')}
  ${rect(2,0,28,4,'#8b5e3a')}
`, 32, 32);

// ========== 阳台 ==========

export const SPRITE_BALCONY_PLANT = svg(`
  ${rect(8,20,16,12,'#c9704e')}
  ${rect(10,22,12,8,'#d4805e')}
  ${rect(14,4,4,16,'#5a8a4a')}
  ${rect(10,8,12,4,'#6aa05a')}
  ${rect(8,12,16,4,'#7ab46a')}
  ${rect(6,16,20,4,'#8ac47a')}
  ${rect(12,0,8,6,'#4a7a3a')}
`, 32, 32);

export const SPRITE_BALCONY_CHAIR = svg(`
  ${rect(4,12,24,18,'#d9b681')}
  ${rect(6,10,20,4,'#e8c890')}
  ${rect(6,14,20,14,'#c9a070')}
  ${rect(4,14,4,16,'#b89060')}
  ${rect(24,14,4,16,'#b89060')}
  ${rect(8,24,16,4,'#e8c890')}
`, 32, 32);

export const SPRITE_RAILING = svg(`
  ${rect(0,8,32,4,'#9c714e')}
  ${rect(0,12,4,20,'#b0856a')}
  ${rect(28,12,4,20,'#b0856a')}
  ${rect(4,0,2,20,'#a07858')}
  ${rect(14,0,2,20,'#a07858')}
  ${rect(24,0,2,20,'#a07858')}
`, 32, 32);

// ========== 街道 ==========

export const SPRITE_FOUNTAIN = svg(`
  ${rect(4,16,24,16,'#78b8cf')}
  ${rect(6,14,20,4,'#8ac8dc')}
  ${rect(12,4,8,10,'#a0d8ec')}
  ${rect(14,0,4,6,'#b0e0f0')}
  ${rect(10,10,12,4,'#90c8d8')}
  ${rect(8,24,16,4,'#68a8c0')}
`, 32, 32);

export const SPRITE_FLOWER = svg(`
  ${rect(6,16,20,16,'#e8a0bf')}
  ${rect(8,14,16,4,'#f0b0cf')}
  ${rect(10,6,4,10,'#7ab46a')}
  ${rect(18,8,4,8,'#7ab46a')}
  ${rect(10,2,4,4,'#ff80a0')}
  ${rect(18,4,4,4,'#ff90b0')}
  ${rect(6,10,4,4,'#ffb0c0')}
`, 32, 32);

export const SPRITE_BENCH = svg(`
  ${rect(2,14,28,16,'#b78155')}
  ${rect(4,12,24,4,'#c8946a')}
  ${rect(4,16,24,4,'#a87048')}
  ${rect(2,18,4,12,'#986838')}
  ${rect(26,18,4,12,'#986838')}
  ${rect(6,24,20,4,'#d4a080')}
`, 32, 32);

export const SPRITE_SIGN = svg(`
  ${rect(14,0,4,32,'#795542')}
  ${rect(6,4,20,12,'#a07060')}
  ${rect(8,6,16,8,'#8b6050')}
  ${rect(10,8,12,4,'#f5e6d3')}
`, 32, 32);

export const SPRITE_GATE = svg(`
  ${rect(6,0,20,32,'#f5e6d1')}
  ${rect(8,2,16,28,'#faf0e0')}
  ${rect(10,4,12,24,'#f0e0c8')}
  ${rect(14,14,4,4,'#c99878')}
  ${rect(4,0,24,4,'#d4a888')}
`, 32, 32);

// ========== 咖啡馆 ==========

export const SPRITE_CAFE_COUNTER = svg(`
  ${rect(0,10,32,22,'#9b674c')}
  ${rect(2,8,28,4,'#b07a5c')}
  ${rect(4,12,24,18,'#8b5a3c')}
  ${rect(6,14,20,14,'#a06a48')}
  ${rect(8,4,4,6,'#e8d4b8')}
  ${rect(16,4,4,6,'#e8d4b8')}
  ${rect(24,4,4,6,'#e8d4b8')}
`, 32, 32);

export const SPRITE_CAFE_TABLE = svg(`
  ${rect(4,8,24,16,'#a85e4c')}
  ${rect(6,6,20,4,'#b8705e')}
  ${rect(14,24,4,8,'#8b4a38')}
  ${rect(8,2,16,4,'#c98070')}
  ${rect(10,4,12,2,'#d49080')}
`, 32, 32);

// ========== 导出映射 ==========
export const SPRITES: Record<string, string> = {
  bed: SPRITE_BED,
  desk: SPRITE_DESK,
  armchair: SPRITE_ARMCHAIR,
  "window-a": SPRITE_WINDOW,
  "window-b": SPRITE_WINDOW,
  "plant-a": SPRITE_PLANT,
  lamp: SPRITE_LAMP,
  rug: SPRITE_RUG,
  "toy-box": SPRITE_TOY_BOX,
  snack: SPRITE_SNACK,
  "record-player": SPRITE_RECORD,
  "home-door": SPRITE_DOOR,
  "balcony-plant": SPRITE_BALCONY_PLANT,
  "balcony-chair": SPRITE_BALCONY_CHAIR,
  railing: SPRITE_RAILING,
  "street-fountain": SPRITE_FOUNTAIN,
  "street-flower": SPRITE_FLOWER,
  "street-bench": SPRITE_BENCH,
  "street-sign": SPRITE_SIGN,
  "street-gate": SPRITE_GATE,
  "cafe-counter": SPRITE_CAFE_COUNTER,
  "cafe-table": SPRITE_CAFE_TABLE,
};
