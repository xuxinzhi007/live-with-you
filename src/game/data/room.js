export const roomSpots = [
  { id: "window-a", kind: "window", className: "window window--a", label: "窗户" },
  { id: "window-b", kind: "window", className: "window window--b", label: "窗户" },
  { id: "frame-a", kind: "frame", className: "frame frame--a", label: "相框" },
  { id: "frame-b", kind: "frame", className: "frame frame--b", label: "相框" },
  { id: "plant-a", kind: "plant", className: "plant plant--a", label: "盆栽" },
  { id: "plant-b", kind: "plant", className: "plant plant--b", label: "盆栽" },
  { id: "rug-a", kind: "rug", className: "rug rug--a", label: "地毯" },
  { id: "rug-b", kind: "rug", className: "rug rug--b", label: "地毯" },
  { id: "shelf", kind: "shelf", className: "shelf", label: "架子" },
  { id: "desk", kind: "desk", className: "desk", label: "书桌", movable: true, x: 38, y: 0, width: 220, height: 96 },
  { id: "bed", kind: "bed", className: "bed", label: "小床", movable: true, x: 8, y: 0, width: 244, height: 118 },
  { id: "armchair", kind: "armchair", className: "armchair", label: "休闲椅", movable: true, x: 54, y: 0, width: 142, height: 114 },
  { id: "lamp", kind: "lamp", className: "lamp", label: "落地灯", movable: true, x: 67, y: 0, width: 84, height: 156 },
  { id: "record-player", kind: "record", className: "record-player", label: "唱片机", movable: true, x: 29, y: 2, width: 82, height: 60 },
  { id: "snack", kind: "snack", className: "snack", label: "点心", movable: true, x: 79, y: 8, width: 68, height: 48 },
  { id: "toy-box", kind: "toybox", className: "toy-box", label: "玩具筐", movable: true, x: 29, y: 0, width: 92, height: 70 },
  { id: "toy", kind: "toy", className: "toy", label: "小球", movable: true, x: 33, y: 44, width: 38, height: 38 },
];

export const spotActions = {
  rug: "sit",
  plant: "sniff",
  armchair: "sit",
  record: "dance",
  snack: "treat",
  bed: "sleep",
  toy: "toy",
};
