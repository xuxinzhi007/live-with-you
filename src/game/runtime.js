import { Camera, viewSize } from "./camera.js";
import { FX } from "./fx.js";
import { Pet } from "./pet.js";
import { wenbebi } from "./data/pet.js";
import { spotActions } from "./data/room.js";
import { todayStories } from "./data/today-stories.js";
import { queueWorldSnapshotSync } from "./world-save.js";

export function startGame(root) {
  const SAVE_KEY = "wenbebi-v1";
  const BAG_KEY = "wenbebi-life-bag-v1";
  const GARDEN_KEY = "wenbebi-balcony-garden-v1";
  const STREET_LOG_KEY = "wenbebi-street-log-v1";
  const WEATHER_KEY = "wenbebi-weather-v1";
  const JOURNAL_KEY = "wenbebi-life-journal-v1";
  const PLAY_KEY = "wenbebi-play-streak-v1";
  const TODAY_STORY_KEY = "wenbebi-today-story-v1";
  const TOY_POSITION_KEY = "wenbebi-toy-position-v1";
  const ROOM_STATE_KEY = "wenbebi-room-state-v1";
  const viewport = root.querySelector("#viewport");
  const worldEl = root.querySelector("#world");
  const petEl = root.querySelector("#pet");
  const fxCanvas = root.querySelector("#fx");
  const plate = root.querySelector("#plate");

  const world = { w: 0, h: 0, floorH: 0, period: "day", chasingToy: false };
  const camera = new Camera(worldEl);
  const fx = new FX(fxCanvas);
  const pet = new Pet(petEl, world, fx, wenbebi);
  camera.setTarget(pet);

  let last = performance.now();
  const ball = { held: false, target: null, carryUntil: 0, x: 0, y: 0, vx: 0, vy: 0, air: false, launchedAt: 0, lastChaseAt: 0, chaseCancelled: false };
  let play = loadPlay();
  let gesture = null;
  let toyDrag = null;
  const touchPoints = new Map();
  let twoFingerPan = null;
  const lifecycle = new AbortController();
  let animationFrame = 0;
  let periodTimer = 0;
  let persistTimer = 0;
  let nextStatusUpdate = 0;
  let lampOn = loadRoomState().lampOn;
  let currentScene = root.dataset.scene || "bedroom";
  let bag = loadBag();
  let garden = loadGarden();
  let streetLog = loadStreetLog();
  let weather = loadWeather();
  let journal = loadJournal();
  let todayStory = null;
  let storyExpandTimer = 0;
  let playStreakHideTimer = 0;

  const streetEvents = {
    fountain: {
      title: "喷泉边的纸船",
      copy: "一只小纸船停在水边，上面写着：愿今天也有好心情。",
      choices: [
        { label: "把纸船放回水里", reward: { mementos: 1 }, mood: 7, line: "把小心意带回家。" },
        { label: "坐在旁边听一会儿", reward: { coins: 2 }, energy: 7, line: "水声让人慢慢安静下来。" },
      ],
    },
    streetFlower: {
      title: "花摊的余香",
      copy: "花摊老板正在收摊，留下一小包还没种下的花种。",
      choices: [
        { label: "买一包花种", cost: { coins: 2 }, reward: { seeds: 1 }, mood: 5, line: "挑好啦，阳台会开花的。" },
        { label: "帮忙整理花束", reward: { coins: 3 }, mood: 8, line: "今天也帮上忙啦。" },
      ],
    },
    streetBench: {
      title: "长椅上的空位",
      copy: "傍晚的风刚好，长椅旁留着一枚闪闪的小徽章。",
      choices: [
        { label: "坐下来等一会儿", reward: { mementos: 1 }, energy: 10, line: "慢一点也没关系。" },
        { label: "把徽章交给失主留言板", reward: { coins: 4 }, mood: 10, line: "也许失主会回来找它。" },
      ],
    },
  };

  const cafeEvents = {
    cafeCounter: {
      title: "吧台的一杯暖饮",
      copy: "店主刚好煮好一壶热牛奶，空气里都是甜甜的香气。",
      choices: [
        { label: "点一杯热牛奶", cost: { coins: 3 }, reward: {}, mood: 9, energy: 8, line: "暖暖的，慢慢喝。" },
        { label: "和店主聊两句", reward: { mementos: 1 }, mood: 6, line: "今天也收到一段小故事。" },
      ],
    },
  };

  // 同一地点随着天气与时段变化，不把每日生活压缩成同一段固定文案。
  const livingStreetEvents = {
    rainy: {
      fountain: {
        title: "雨里的纸船",
        copy: "雨点在喷泉里打出一圈圈波纹，一只纸船被水流推到雯宝脚边。",
        choices: [
          { label: "替纸船挡一会儿雨", reward: { mementos: 1 }, mood: 8, line: "小纸船也有一个干燥的角落了。" },
          { label: "看着它顺水漂走", reward: { coins: 2 }, energy: 5, line: "雨声把脚步放慢了。" },
        ],
      },
      streetFlower: {
        title: "雨棚下的花摊",
        copy: "花摊的雨棚被风吹得轻轻响，店主把几盆小花挪到了里面。",
        choices: [
          { label: "买一包花种", cost: { coins: 2 }, reward: { seeds: 1 }, mood: 6, line: "雨天种下的期待，也会慢慢发芽。" },
          { label: "帮忙把花搬进来", reward: { coins: 3 }, mood: 9, line: "雨没有淋到它们。" },
        ],
      },
    },
    breezy: {
      streetBench: {
        title: "被风吹来的徽章",
        copy: "一枚小徽章滚到长椅脚边，风把树叶也吹成了小小的旋涡。",
        choices: [
          { label: "追上它，收进回忆", reward: { mementos: 1 }, mood: 8, line: "今天的风送来了一件礼物。" },
          { label: "交给路边的失物箱", reward: { coins: 4 }, mood: 10, line: "也许有人正想念它。" },
        ],
      },
    },
    dusk: {
      fountain: {
        title: "傍晚的喷泉灯",
        copy: "喷泉的灯刚亮起来，水面像把橘色的天空收了进去。",
        choices: [
          { label: "留下一张小纸条", reward: { mementos: 1 }, mood: 7, line: "把今天的晚霞带回家。" },
          { label: "安静看一会儿", reward: { coins: 2 }, energy: 8, line: "天色慢慢变软了。" },
        ],
      },
    },
  };

  function eventFor(kind) {
    if (currentScene === "cafe") return cafeEvents[kind];
    const weatherVariant = livingStreetEvents[weather?.kind]?.[kind];
    const duskVariant = world.period === "dusk" ? livingStreetEvents.dusk?.[kind] : null;
    return weatherVariant || duskVariant || streetEvents[kind];
  }

  function loadBag() {
    try {
      const saved = JSON.parse(localStorage.getItem(BAG_KEY) || "{}");
      return {
        seeds: Math.max(0, saved.seeds || 0),
        flowers: Math.max(0, saved.flowers || 0),
        mementos: Math.max(0, saved.mementos || 0),
        coins: Math.max(0, saved.coins || 0),
      };
    } catch (err) {
      return { seeds: 0, flowers: 0, mementos: 0, coins: 0 };
    }
  }

  function saveBag() {
    try { localStorage.setItem(BAG_KEY, JSON.stringify(bag)); } catch (err) { /* 当前会话仍可获得收获 */ }
  }

  function loadGarden() {
    try {
      const saved = JSON.parse(localStorage.getItem(GARDEN_KEY) || "{}");
      return saved.plantedAt ? { plantedAt: Number(saved.plantedAt), wateredAt: Number(saved.wateredAt) || 0 } : { plantedAt: 0, wateredAt: 0 };
    } catch (err) { return { plantedAt: 0, wateredAt: 0 }; }
  }

  function saveGarden() {
    try { localStorage.setItem(GARDEN_KEY, JSON.stringify(garden)); } catch (err) { /* 当前会话仍可继续养花 */ }
  }

  function todayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  }

  function loadStreetLog() {
    try {
      const saved = JSON.parse(localStorage.getItem(STREET_LOG_KEY) || "{}");
      return saved.day === todayKey() && saved.completed && typeof saved.completed === "object"
        ? { day: saved.day, completed: saved.completed }
        : { day: todayKey(), completed: {} };
    } catch (err) { return { day: todayKey(), completed: {} }; }
  }

  function refreshStreetDay() {
    if (streetLog.day !== todayKey()) streetLog = { day: todayKey(), completed: {} };
  }

  function saveStreetLog() {
    try { localStorage.setItem(STREET_LOG_KEY, JSON.stringify(streetLog)); } catch (err) { /* 当前会话仍可继续游玩 */ }
  }

  function loadWeather() {
    try {
      const saved = JSON.parse(localStorage.getItem(WEATHER_KEY) || "{}");
      if (saved.day === todayKey() && ["sunny", "breezy", "rainy"].includes(saved.kind)) return saved;
    } catch (err) { /* 生成一个新的天气 */ }
    const dayNumber = Math.floor(Date.now() / 86400000);
    const kind = ["sunny", "breezy", "rainy"][Math.abs((dayNumber * 9301 + 49297) % 233280) % 3];
    const next = { day: todayKey(), kind, rainWatered: false };
    try { localStorage.setItem(WEATHER_KEY, JSON.stringify(next)); } catch (err) { /* 当前会话继续使用 */ }
    return next;
  }

  function applyWeather() {
    if (weather.day !== todayKey()) weather = loadWeather();
    document.body.classList.remove("is-weather-sunny", "is-weather-breezy", "is-weather-rainy");
    document.body.classList.add(`is-weather-${weather.kind}`);
    const weatherLabel = { sunny: "晴天", breezy: "有风", rainy: "小雨" }[weather.kind];
    const hint = root.querySelector("[data-weather]");
    if (hint) hint.textContent = weatherLabel;
    if (weather.kind === "rainy" && garden.plantedAt && !weather.rainWatered) {
      garden.wateredAt = Date.now();
      weather.rainWatered = true;
      saveGarden();
      try { localStorage.setItem(WEATHER_KEY, JSON.stringify(weather)); } catch (err) { /* ignore */ }
      renderGarden();
    }
  }

  function loadJournal() {
    try {
      const saved = JSON.parse(localStorage.getItem(JOURNAL_KEY) || "[]");
      return Array.isArray(saved) ? saved.filter((item) => typeof item?.title === "string" && typeof item?.copy === "string").slice(0, 12) : [];
    } catch (err) { return []; }
  }

  function writeJournal(title, copy) {
    journal = [{ id: `${Date.now()}-${Math.random()}`, title, copy, time: Date.now() }, ...journal].slice(0, 12);
    try { localStorage.setItem(JOURNAL_KEY, JSON.stringify(journal)); } catch (err) { /* 记录只在本次会话保留 */ }
    root.dispatchEvent(new CustomEvent("journal:update", { detail: journal }));
  }

  function storyDayKey() { return todayKey(); }

  function chooseTodayStory() {
    const context = {
      weather: weather.kind,
      period: world.period,
      energy: pet.energy,
      hunger: pet.hunger,
      mementos: bag.mementos,
      flowers: bag.flowers,
    };
    const eligible = todayStories.filter((story) => story.matches(context));
    const daySeed = Math.floor(Date.now() / 86400000);
    return eligible[Math.abs((daySeed * 7919 + (pet.pats || 0)) % eligible.length)] || todayStories[todayStories.length - 1];
  }

  function loadTodayStory() {
    try {
      const saved = JSON.parse(localStorage.getItem(TODAY_STORY_KEY) || "{}");
      const story = todayStories.find((item) => item.id === saved.id);
      if (saved.day === storyDayKey() && story) return { story, completed: saved.completed === true };
    } catch (err) { /* 选择今天的片段 */ }
    return { story: chooseTodayStory(), completed: false };
  }

  function saveTodayStory() {
    if (!todayStory) return;
    try { localStorage.setItem(TODAY_STORY_KEY, JSON.stringify({ day: storyDayKey(), id: todayStory.story.id, completed: todayStory.completed })); } catch (err) { /* 当前会话仍可继续 */ }
  }

  function renderTodayStory() {
    const story = todayStory?.story;
    const card = root.querySelector("#todayStory");
    const hint = root.querySelector("[data-life-compass]");
    root.querySelectorAll("[data-spot]").forEach((el) => el.classList.remove("is-story-spot"));
    if (!story || currentScene !== "bedroom") {
      if (card) card.hidden = true;
      return;
    }
    const targets = story.spot === "mementoShelf"
      ? root.querySelectorAll('[data-spot="mementoShelf"]')
      : root.querySelectorAll(`[data-spot="${story.spot}"]`);
    targets.forEach((el) => el.classList.toggle("is-story-spot", !todayStory.completed));
    if (card) {
      card.hidden = false;
      card.dataset.completed = String(todayStory.completed);
      if (todayStory.completed) card.dataset.expanded = "false";
      const title = card.querySelector("[data-today-story-title]");
      const copy = card.querySelector("[data-today-story-copy]");
      if (title) title.textContent = todayStory.completed ? "今天的小片段" : story.label;
      if (copy) copy.textContent = todayStory.completed ? "今天已经陪她度过这一会儿了。" : story.hint;
    }
    if (hint) hint.textContent = todayStory.completed ? "今天已经陪她度过这一会儿了。" : story.label;
  }

  function startTodayStory() {
    const card = root.querySelector("#todayStory");
    if (card) card.dataset.expanded = "false";
    window.clearTimeout(storyExpandTimer);
    if (todayStory?.completed || currentScene !== "bedroom") return;
    const story = todayStory.story;
    const target = story.spot === "mementoShelf"
      ? root.querySelector('[data-spot="mementoShelf"]')
      : root.querySelector(`[data-spot="${story.spot}"]`);
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const pos = camera.screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
    resumeCameraFollow();
    pet.walkTo(pos.x - pet.w / 2, true, `story:${story.id}:${story.action}`);
  }

  function previewTodayStory() {
    if (todayStory?.completed || currentScene !== "bedroom") return;
    const story = todayStory.story;
    const target = story.spot === "mementoShelf"
      ? root.querySelector('[data-spot="mementoShelf"]')
      : root.querySelector(`[data-spot="${story.spot}"]`);
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const pos = camera.screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
    // 先让她自然靠近今天的生活场景；真正互动由玩家点击片段后决定。
    pet.walkTo(pos.x - pet.w / 2, true);
  }

  function completeTodayStory(id) {
    if (!todayStory || todayStory.story.id !== id || todayStory.completed) return;
    todayStory.completed = true;
    saveTodayStory();
    renderTodayStory();
    pet.bubble.textContent = todayStory.story.line;
    pet.bubble.classList.add("show");
    pet.nudgeMood(3);
  }

  function loadPlay() {
    try {
      const saved = JSON.parse(localStorage.getItem(PLAY_KEY) || "{}");
      return { streak: Math.max(0, Math.min(2, saved.streak || 0)), lastSuccessAt: Number(saved.lastSuccessAt) || 0, qualifyingThrow: false };
    } catch (err) { return { streak: 0, lastSuccessAt: 0, qualifyingThrow: false }; }
  }

  function savePlay() {
    try { localStorage.setItem(PLAY_KEY, JSON.stringify({ streak: play.streak, lastSuccessAt: play.lastSuccessAt })); } catch (err) { /* 当前会话继续记录 */ }
  }

  function renderPlayStreak() {
    const badge = root.querySelector("#playStreak");
    if (!badge) return;
    window.clearTimeout(playStreakHideTimer);
    if (!play.streak) {
      badge.hidden = true;
      return;
    }
    badge.hidden = false;
    badge.textContent = `接球默契 ${play.streak}/3`;
    playStreakHideTimer = window.setTimeout(() => {
      badge.hidden = true;
    }, 5200);
  }

  function recordToyCatch() {
    if (!play.qualifyingThrow) return;
    play.qualifyingThrow = false;
    if (Date.now() - play.lastSuccessAt > 45000) play.streak = 0;
    play.streak += 1;
    play.lastSuccessAt = Date.now();
    if (play.streak >= 3) {
      play.streak = 0;
      bag.mementos += 1;
      saveBag();
      writeJournal("接球默契", "连续三次把球抛给雯宝，她把这段陪玩收成了一件小纪念。" );
      pet.bubble.textContent = "三次都接到啦！这是我们的默契。";
      pet.bubble.classList.add("show");
      fx.burst(pet.center().x, pet.y + pet.h * 0.22, "star");
      renderBag();
    }
    savePlay();
    renderPlayStreak();
  }

  function renderStreetActivities() {
    refreshStreetDay();
    Object.entries({ fountain: "小喷泉", streetFlower: "街角花摊", streetBench: "长椅" }).forEach(([kind, label]) => {
      const spot = root.querySelector(`[data-spot="${kind}"]`);
      if (!spot) return;
      const complete = Boolean(streetLog.completed[kind]);
      spot.classList.toggle("is-settled", complete);
      spot.setAttribute("aria-label", complete ? `${label}，今天已经一起停留过` : label);
      spot.dataset.activityState = complete ? "settled" : "available";
    });
  }

  function gardenStage() {
    if (!garden.plantedAt) return "empty";
    const age = Date.now() - garden.plantedAt;
    const wateredBonus = garden.wateredAt ? 2 * 60 * 1000 : 0;
    if (age + wateredBonus >= 8 * 60 * 1000) return "bloom";
    if (age + wateredBonus >= 3 * 60 * 1000) return "sprout";
    return "seed";
  }

  function renderGarden() {
    const bed = root.querySelector(".garden-bed");
    if (!bed) return;
    const stage = gardenStage();
    bed.dataset.stage = stage;
    bed.setAttribute("aria-label", ({ empty: "阳台花圃", seed: "刚种下的花种", sprout: "正在长大的小花", bloom: "开花的阳台" })[stage]);
  }

  function tendGarden() {
    if (currentScene !== "balcony") return;
    resumeCameraFollow();
    const stage = gardenStage();
    if (stage === "empty") {
      if (bag.seeds < 1) { pet.bubble.textContent = "去街区花摊找找花种吧。"; pet.bubble.classList.add("show"); return; }
      bag.seeds -= 1;
      garden = { plantedAt: Date.now(), wateredAt: 0 };
      saveBag(); saveGarden(); renderBag(); renderGarden();
      pet.nudgeMood(6);
      pet.bubble.textContent = "种下啦，慢慢等它开花。";
      pet.bubble.classList.add("show");
      fx.burst(pet.center().x, pet.y + pet.h * 0.3, "sparkle");
      return;
    }
    if (stage === "bloom") {
      bag.flowers += 1;
      garden = { plantedAt: 0, wateredAt: 0 };
      saveBag(); saveGarden(); renderBag(); renderGarden();
      pet.nudgeMood(8);
      pet.pats += 2;
      pet.bubble.textContent = "收下一束花，带回小屋吧。";
      writeJournal("阳台开花了", "雯宝收下一束慢慢长大的花。" );
      pet.bubble.classList.add("show");
      fx.burst(pet.center().x, pet.y + pet.h * 0.25, "heart");
      return;
    }
    if (Date.now() - garden.wateredAt < 60 * 1000) { pet.bubble.textContent = "刚浇过水，等它喝一会儿吧。"; pet.bubble.classList.add("show"); return; }
    garden.wateredAt = Date.now();
    saveGarden(); renderGarden();
    pet.nudgeMood(3);
    pet.bubble.textContent = "浇好水啦，小花会长得更快。";
    pet.bubble.classList.add("show");
    fx.burst(pet.center().x, pet.y + pet.h * 0.28, "sparkle");
  }

  function renderBag() {
    const total = bag.seeds + bag.flowers + bag.mementos + bag.coins;
    const write = (selector, value) => { const el = root.querySelector(selector); if (el) el.textContent = String(value); };
    write("[data-bag-total]", total);
    write("[data-bag-seeds]", bag.seeds);
    write("[data-bag-flowers]", bag.flowers);
    write("[data-bag-mementos]", bag.mementos);
    write("[data-bag-coins]", bag.coins);
    root.dataset.mementoLevel = String(Math.min(4, bag.mementos));
    const hint = root.querySelector("[data-life-hint]");
    const compass = root.querySelector("[data-life-compass]");
    if (hint || compass) {
      refreshStreetDay();
      const unfinishedStreet = ["fountain", "streetFlower", "streetBench"].some((kind) => !streetLog.completed[kind]);
      const stage = gardenStage();
      const message = stage === "bloom"
        ? "阳台的花已经开了，去收下一束吧。"
        : stage === "seed" || stage === "sprout"
          ? "阳台的小花正在等一场水。"
          : bag.seeds > 0
            ? "阳台花圃在等一颗花种。"
            : bag.coins >= 2
              ? "花摊的花种，正好能带回阳台。"
              : unfinishedStreet
                ? "街区里还有一件小事，等着一起遇见。"
                : "今天已经很充实了，慢慢陪她待一会儿吧。";
      if (hint) hint.textContent = message;
      if (compass) compass.textContent = message;
    }
    const collection = root.querySelector("#homeCollection");
    if (collection) {
      collection.replaceChildren(...Array.from({ length: Math.min(4, bag.mementos) }, () => {
        const item = document.createElement("span"); item.textContent = "✦"; return item;
      }), ...Array.from({ length: Math.min(3, bag.seeds) }, () => {
        const item = document.createElement("span"); item.textContent = "✿"; return item;
      }), ...Array.from({ length: Math.min(5, bag.flowers) }, () => {
        const item = document.createElement("span"); item.className = "home-collection__flower"; item.textContent = "❀"; return item;
      }));
    }
    renderGarden();
  }

  function closeLifeEvent() {
    const modal = root.querySelector("#lifeEvent");
    if (modal) modal.hidden = true;
  }

  const travelRoutes = {
    bedroom: [{ scene: "street", label: "沿着小路去街区", note: "去散步、遇见花摊和喷泉" }],
    balcony: [{ scene: "street", label: "下楼去街区", note: "把阳台的风景带到街上" }],
    street: [
      { scene: "bedroom", label: "回小屋", note: "回到熟悉的房间" },
      { scene: "balcony", label: "上楼去阳台", note: "去看看花和天空" },
      { scene: "cafe", label: "去街角咖啡店", note: "坐坐、喝点暖的、听听故事" },
    ],
    cafe: [{ scene: "street", label: "回到街区", note: "继续在街上慢慢走" }],
  };

  function closeTravelMap() {
    const modal = root.querySelector("#travelEvent");
    if (modal) modal.hidden = true;
  }

  function openTravelMap() {
    const modal = root.querySelector("#travelEvent");
    const title = root.querySelector("[data-travel-title]");
    const copy = root.querySelector("[data-travel-copy]");
    const choices = root.querySelector("[data-travel-choices]");
    if (!modal || !title || !copy || !choices) return;
    const placeName = { bedroom: "小屋门口", balcony: "阳台楼梯", street: "街区路口", cafe: "咖啡店门口" }[currentScene] || "路口";
    title.textContent = `从${placeName}出发`;
    copy.textContent = "雯宝已经准备好了。接下来想一起去哪里？";
    choices.replaceChildren(...(travelRoutes[currentScene] || []).map((route) => {
      const button = document.createElement("button");
      button.type = "button";
      button.innerHTML = `<strong>${route.label}</strong><small>${route.note}</small>`;
      button.addEventListener("click", () => {
        closeTravelMap();
        root.dispatchEvent(new CustomEvent("scene:request", { detail: route.scene }));
      }, { once: true });
      return button;
    }));
    modal.hidden = false;
  }

  function openStreetEvent(kind) {
    const event = eventFor(kind);
    if (!event) return false;
    // 这是角色正在参与的世界事件；即使玩家刚浏览过远处，也把视线带回角色。
    resumeCameraFollow();
    const modal = root.querySelector("#lifeEvent");
    const title = root.querySelector("[data-life-event-title]");
    const copy = root.querySelector("[data-life-event-copy]");
    const choices = root.querySelector("[data-life-event-choices]");
    if (!modal || !title || !copy || !choices) return true;
    refreshStreetDay();
    const alreadyCompleted = Boolean(streetLog.completed[kind]);
    title.textContent = alreadyCompleted ? `${event.title} · 今天的余韵` : event.title;
    copy.textContent = alreadyCompleted
      ? "今天已经在这里留下了一点小故事。雯宝想再安静待一会儿。"
      : event.copy;
    const availableChoices = alreadyCompleted
      ? [{ label: "陪她再待一会儿", reward: {}, mood: 2, energy: 2, line: "今天的风也很好。", repeat: true }]
      : event.choices;
    choices.replaceChildren(...availableChoices.map((choice) => {
      const button = document.createElement("button");
      button.type = "button";
      const canAfford = !choice.cost || Object.entries(choice.cost).every(([key, value]) => bag[key] >= value);
      button.textContent = choice.cost ? `${choice.label}（${Object.entries(choice.cost).map(([key, value]) => `${value}${key === "coins" ? "零钱" : key}`).join("、")}）` : choice.label;
      button.disabled = !canAfford;
      if (!canAfford) button.title = "零钱不够，先在街区做点小事吧";
      button.addEventListener("click", () => {
        resumeCameraFollow();
        if (choice.cost) Object.entries(choice.cost).forEach(([key, value]) => { bag[key] = Math.max(0, bag[key] - value); });
        Object.entries(choice.reward).forEach(([key, value]) => { bag[key] += value; });
        if (choice.mood) pet.nudgeMood(choice.mood);
        if (choice.energy) pet.nudgeNeed("energy", choice.energy);
        pet.pats += 1;
        if (!choice.repeat) {
          streetLog.completed[kind] = true;
          saveStreetLog();
          renderStreetActivities();
        }
        saveBag(); renderBag();
        pet.speak("idle");
        pet.bubble.textContent = choice.line;
        if (!choice.repeat) writeJournal(event.title, choice.label);
        pet.bubble.classList.add("show");
        fx.burst(pet.center().x, pet.y + pet.h * 0.24, "star");
        closeLifeEvent();
      }, { once: true });
      return button;
    }));
    modal.hidden = false;
    return true;
  }

  function listen(target, type, listener, options = {}) {
    target.addEventListener(type, listener, { ...options, signal: lifecycle.signal });
  }

  function isCoarse() {
    return window.matchMedia("(pointer: coarse)").matches;
  }

  function measureHud() {
    const view = viewSize();
    if (root.dataset.talking === "true") {
      const dock = root.querySelector(".talk-dock");
      if (dock && !dock.hidden) {
        const rect = dock.getBoundingClientRect();
        if (rect.height > 0) return Math.max(0, view.top + view.h - rect.top);
      }
      return 0;
    }
    if (view.w > 768) return 0;
    // 展开的更多抽屉只是覆盖层，沿用折叠底栏的预留高度，避免把场景整体顶起来。
    if (plate.classList.contains("is-open")) {
      const compactHud = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hud-h"));
      if (Number.isFinite(compactHud) && compactHud > 0) return compactHud;
    }
    const rect = plate.getBoundingClientRect();
    return Math.max(0, view.top + view.h - rect.top);
  }

  function setMoreOpen(open) {
    plate.classList.toggle("is-open", open);
    root.querySelector("#menuToggle")?.setAttribute("aria-expanded", String(open));
  }

  function closeBagPanel() {
    const panel = root.querySelector("#bagPanel");
    panel?.classList.remove("is-open");
    root.querySelector("#bagToggle")?.setAttribute("aria-expanded", "false");
  }

  function syncKeyboardInset() {
    const vv = window.visualViewport;
    let kb = 0;
    if (vv) kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    root.style.setProperty("--kb-inset", `${Math.round(kb)}px`);
  }

  function loadSave() {
    try {
      return JSON.parse(localStorage.getItem(SAVE_KEY) || "null") || {};
    } catch (err) {
      return {};
    }
  }

  function persist() {
    const prev = loadSave();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        savedAt: Date.now(),
        mood: pet.mood,
        pats: pet.pats,
        energy: pet.energy,
        hunger: pet.hunger,
        visits: prev.visits || 1,
      }));
    } catch (err) {
      /* 无痕模式可能写不了 */
    }
    queueWorldSnapshotSync();
  }

  function currentPeriod() {
    const hour = new Date().getHours();
    if (hour >= 21 || hour < 6) return "night";
    if (hour >= 17) return "dusk";
    if (hour >= 6 && hour < 8) return "dawn";
    return "day";
  }

  function applyPeriod() {
    const period = currentPeriod();
    world.period = period;
    document.body.classList.remove("is-dawn", "is-day", "is-dusk", "is-night");
    document.body.classList.add(`is-${period}`);
    applyWeather();
    renderStreetActivities();
  }

  function floorRest() {
    return world.floorH * 0.55;
  }

  world.getSpots = function getSpots() {
    return Array.from(root.querySelectorAll("[data-spot]")).map((el) => {
      const rect = el.getBoundingClientRect();
      const pos = camera.screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return { el, kind: el.getAttribute("data-spot"), x: pos.x };
    }).filter((spot) => spot.kind !== "travel" && spot.kind !== "garden" && spot.kind !== "toy");
  };

  function layout() {
    pet.measure();
    const view = viewSize();
    const mobile = view.w <= 768;
    const hud = measureHud();
    world.h = view.h;
    world.w = Math.max(view.w * 2.35, mobile ? 1120 : 2200);
    world.hudH = hud;
    world.floorH = mobile ? Math.max(hud + 72, view.h * 0.2) : Math.max(88, view.h * 0.18);
    world.dragThreshold = isCoarse() ? 20 : 8;
    camera.setHudInset(hud);
    document.documentElement.style.setProperty("--floor-h", `${world.floorH}px`);
    document.documentElement.style.setProperty("--hud-h", `${hud}px`);
    worldEl.style.width = `${world.w}px`;
    worldEl.style.height = `${world.h}px`;
    fx.resize(world.w, world.h);
    camera.setBounds(0, 0, world.w, world.h);
    pet.y = pet.floorY();
    pet.place();
  }

  function loadRoomState() {
    try {
      const saved = JSON.parse(localStorage.getItem(ROOM_STATE_KEY) || "{}");
      return { lampOn: saved.lampOn === true };
    } catch (err) {
      return { lampOn: false };
    }
  }

  function applyLampState() {
    const lamp = root.querySelector('[data-spot="lamp"]');
    lamp?.classList.toggle("is-on", lampOn);
    root.classList.toggle("has-lamp-light", lampOn);
  }

  function changeScene(nextScene) {
    if (!nextScene || nextScene === currentScene) return;
    currentScene = nextScene;
    ball.target = null;
    world.chasingToy = false;
    ball.held = false;
    toyElement()?.classList.remove("is-held", "is-aiming");
    pet.goIdle(true);
    pet.x = pet.clampX(world.w * (nextScene === "street" ? 0.34 : nextScene === "balcony" ? 0.44 : nextScene === "cafe" ? 0.38 : 0.38));
    pet.y = pet.floorY();
    pet.place();
    camera.setEnabled(true);
    root.querySelector("#cameraToggle").checked = true;
    camera.snapToTarget();
    applyLampState();
    renderBag();
    renderGarden();
    renderStreetActivities();
    renderTodayStory();
    if (nextScene === "bedroom") renderToy();
  }

  function toggleLamp() {
    resumeCameraFollow();
    lampOn = !lampOn;
    applyLampState();
    try {
      localStorage.setItem(ROOM_STATE_KEY, JSON.stringify({ lampOn }));
    } catch (err) {
      /* 无痕模式可能写不了 */
    }
    const lamp = root.querySelector('[data-spot="lamp"]');
    if (lamp) {
      const rect = lamp.getBoundingClientRect();
      const pos = camera.screenToWorld(rect.left + rect.width / 2, rect.top + rect.height * 0.2);
      fx.burst(pos.x, pos.y, "sparkle");
    }
  }

  function toyElement() {
    return root.querySelector('[data-spot="toy"]');
  }

  function resumeCameraFollow() {
    camera.setEnabled(true);
    const toggle = root.querySelector("#cameraToggle");
    if (toggle) toggle.checked = true;
  }

  function loadToyPosition() {
    try {
      const saved = JSON.parse(localStorage.getItem(TOY_POSITION_KEY) || "null");
      return Number.isFinite(saved?.x) && Number.isFinite(saved?.y) ? saved : null;
    } catch (err) {
      return null;
    }
  }

  function saveToyPosition(x, y) {
    try {
      localStorage.setItem(TOY_POSITION_KEY, JSON.stringify({ x, y }));
    } catch (err) {
      /* 无痕模式可能写不了 */
    }
  }

  function inviteToyPlay() {
    const toy = toyElement();
    if (!toy || ball.held || ball.air) return;
    resumeCameraFollow();
    ball.chaseCancelled = false;
    ball.target = ball.x;
    world.chasingToy = true;
    pet.speak("toy");
    pet.walkTo(ball.x - pet.w * 0.45, true);
  }

  function toySize() {
    return toyElement()?.offsetWidth || 38;
  }

  function groundToyY() {
    return world.h - floorRest() - toySize() / 2;
  }

  function renderToy() {
    const toy = toyElement();
    if (!toy) return;
    const size = toySize();
    toy.style.left = `${ball.x - size / 2}px`;
    toy.style.bottom = `${world.h - ball.y - size / 2}px`;
  }

  function setToyPosition(worldX) {
    const size = toySize();
    ball.x = Math.min(world.w - size / 2, Math.max(size / 2, worldX));
    ball.y = groundToyY();
    ball.vx = 0;
    ball.vy = 0;
    ball.air = false;
    renderToy();
    saveToyPosition(ball.x, ball.y);
  }

  function updateToy(dt, now) {
    if (ball.held || !ball.air) return;
    const size = toySize();
    ball.vy += 1750 * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    if (ball.x < size / 2 || ball.x > world.w - size / 2) {
      ball.x = Math.min(world.w - size / 2, Math.max(size / 2, ball.x));
      ball.vx *= -0.48;
    }
    if (ball.y >= groundToyY()) {
      ball.y = groundToyY();
      if (Math.abs(ball.vy) > 105) {
        ball.vy *= -0.38;
        ball.vx *= 0.7;
        fx.burst(ball.x, world.h - floorRest(), "dust");
      } else {
        ball.vy = 0;
        ball.air = false;
        saveToyPosition(ball.x, ball.y);
        // 球真正停住后才让角色以落点为目标，避免追向用户拖动时的空中位置。
        if (!ball.chaseCancelled) {
          ball.target = ball.x;
          world.chasingToy = true;
          pet.walkTo(ball.x - pet.w * 0.45, true);
        }
      }
    }
    renderToy();

    // 球飞离后才作出反应；追逐目标始终是球的当前坐标，因此球从头顶飞过时会自然转身。
    const hasLeftPet = Math.abs(ball.x - pet.center().x) > pet.w * 0.28;
    if (!ball.chaseCancelled && now - ball.launchedAt > 160 && hasLeftPet && now - ball.lastChaseAt > 90) {
      ball.lastChaseAt = now;
      ball.target = ball.x;
      world.chasingToy = true;
      pet.walkTo(ball.x - pet.w * 0.45, true);
    }
  }

  function heldToyPosition() {
    const toy = toyElement();
    const size = toy?.offsetWidth || 38;
    // 立绘还不是分层骨骼，先把球放在角色身体侧边、手腕高度，避免挡住脸。
    const side = pet.dir >= 0 ? 0.94 : 0.06;
    return {
      x: pet.x + pet.w * side - size / 2,
      y: pet.y + pet.h * 0.69 - size / 2,
    };
  }

  function putToyDown() {
    if (!ball.held) return;
    const toy = toyElement();
    if (!toy) return;
    const size = toy.offsetWidth || 38;
    const side = pet.dir >= 0 ? 1 : -1;
    ball.held = false;
    ball.carryUntil = 0;
    toy.classList.remove("is-held");
    setToyPosition(pet.x + pet.w / 2 + side * (pet.w * 0.56));
  }

  function bringToyToPet() {
    const toy = toyElement();
    if (!toy || ball.target == null || ball.air || pet.dragging) return;
    const closeEnough = Math.abs(pet.center().x - ball.target) < Math.max(52, pet.w * 0.45);
    if (!closeEnough || pet.state === "walk") return;
    ball.target = null;
    world.chasingToy = false;
    recordToyCatch();
    // 她会自己决定：有时抱着玩一会儿，有时只是在原地玩，不会每次都强制拿起。
    const carryChance = 0.28 + (pet.mood ?? 64) / 250;
    if (Math.random() < carryChance) {
      ball.held = true;
      ball.carryUntil = performance.now() + 4500 + Math.random() * 5500;
      toy.classList.add("is-held");
      const heldAt = heldToyPosition();
      ball.x = heldAt.x + toy.offsetWidth / 2;
      ball.y = heldAt.y + toy.offsetHeight / 2;
      renderToy();
      pet.happy("bringToy");
    } else {
      pet.happy("catch");
    }
  }

  function syncHeldToy(now) {
    if (!ball.held) return;
    const toy = toyElement();
    if (!toy) return;
    if (now >= ball.carryUntil) {
      putToyDown();
      return;
    }
    const heldAt = heldToyPosition();
    ball.x = heldAt.x + toy.offsetWidth / 2;
    ball.y = heldAt.y + toy.offsetHeight / 2;
    renderToy();
  }

  function returnToyToBox() {
    const toy = toyElement();
    const box = root.querySelector('[data-spot="toybox"]');
    if (!toy || !box) return;
    ball.held = false;
    ball.target = null;
    ball.carryUntil = 0;
    world.chasingToy = false;
    toy.classList.remove("is-held");
    const rect = box.getBoundingClientRect();
    const boxPos = camera.screenToWorld(rect.left + rect.width / 2, rect.top + rect.height * 0.62);
    setToyPosition(boxPos.x);
    pet.speak("toybox");
  }

  function nearbyTouchSpot(event, decorating) {
    const direct = event.target instanceof Element ? event.target.closest("[data-spot]") : null;
    if (direct || decorating || !isCoarse()) return direct;
    const hitSlop = 18;
    let nearest = null;
    let nearestDistance = hitSlop + 1;
    root.querySelectorAll(".room [data-spot]").forEach((candidate) => {
      const rect = candidate.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dx = Math.max(rect.left - event.clientX, 0, event.clientX - rect.right);
      const dy = Math.max(rect.top - event.clientY, 0, event.clientY - rect.bottom);
      const distance = Math.hypot(dx, dy);
      if (distance < nearestDistance) {
        nearest = candidate;
        nearestDistance = distance;
      }
    });
    return nearest;
  }

  function goToSpot(el) {
    const kind = el.getAttribute("data-spot");
    // 今日片段的关联物件也是主入口；点物件与点片段卡片得到同一段生活反馈。
    if (currentScene === "bedroom" && !todayStory?.completed && kind === todayStory?.story.spot) {
      startTodayStory();
      return;
    }
    if (kind === "travel") {
      const rect = el.getBoundingClientRect();
      const pos = camera.screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
      resumeCameraFollow();
      // 出门是转场，不让玩家等角色横穿整张可浏览场景。
      pet.walkTo(pos.x - pet.w / 2, false, `travel:${currentScene}`, 720);
      return;
    }
    if (kind === "garden") { tendGarden(); return; }
    if ((currentScene === "street" && eventFor(kind)) || (currentScene === "cafe" && eventFor(kind))) {
      const rect = el.getBoundingClientRect();
      const pos = camera.screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
      resumeCameraFollow();
      pet.walkTo(pos.x - pet.w / 2, false, `event:${kind}`);
      return;
    }
    if (kind === "frame") {
      root.dispatchEvent(new CustomEvent("memory:open"));
      return;
    }
    if (kind === "mementoShelf") {
      if (bag.mementos < 1) {
        pet.bubble.textContent = "去街区带一点小故事回来吧。";
        pet.bubble.classList.add("show");
        return;
      }
      const rect = el.getBoundingClientRect();
      const pos = camera.screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
      resumeCameraFollow();
      pet.walkTo(pos.x - pet.w / 2, false, "mementoShelf");
      return;
    }
    if (kind === "lamp") {
      toggleLamp();
      return;
    }
    if (kind === "toybox") {
      returnToyToBox();
      return;
    }
    if (kind === "toy") {
      inviteToyPlay();
      return;
    }
    const rect = el.getBoundingClientRect();
    const pos = camera.screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const action = spotActions[kind] || kind;
    resumeCameraFollow();
    pet.walkTo(pos.x - pet.w / 2, false, action);
  }

  listen(viewport, "pointerdown", (event) => {
    if (event.target.closest(".desk-plate")) return;
    if (root.dataset.memoryOpen === "true") return;
    if (root.dataset.onboarding === "true") return;
    if (!root.querySelector("#lifeEvent")?.hidden) return;
    if (!root.querySelector("#travelEvent")?.hidden) return;
    if (event.button) return;
    if (event.pointerType === "touch") {
      touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (touchPoints.size >= 2) {
        const points = Array.from(touchPoints.values());
        twoFingerPan = {
          x: (points[0].x + points[1].x) / 2,
          y: (points[0].y + points[1].y) / 2,
        };
        gesture = null;
        if (toyDrag) {
          toyDrag = null;
          toyElement()?.classList.remove("is-aiming");
          setToyPosition(ball.x);
        }
        if (pet.dragging) pet.endDrag();
        return;
      }
    }
    const decorating = root.dataset.decorating === "true";
    // 家具的事件由 React 接管；其余空白区域仍可拖动镜头查看整个房间。
    if (decorating && event.target.closest("[data-decor-item]")) return;
    const worldPos = camera.screenToWorld(event.clientX, event.clientY);
    const toyTarget = event.target.closest('[data-spot="toy"]');
    if (toyTarget && !decorating) {
      event.preventDefault();
      event.stopPropagation();
      ball.held = false;
      ball.carryUntil = 0;
      toyTarget.classList.remove("is-held");
      ball.air = false;
      ball.vx = 0;
      ball.vy = 0;
      ball.chaseCancelled = false;
      toyDrag = { pointerId: event.pointerId, moved: false, startX: event.clientX, startY: event.clientY, startWorld: { x: ball.x, y: ball.y } };
      toyTarget.classList.add("is-aiming");
      toyTarget.setPointerCapture?.(event.pointerId);
      return;
    }
    const pad = isCoarse() ? (pet.state === "sleep" ? 40 : 32) : 0;
    const onPet = !decorating &&
      worldPos.x >= pet.x - pad &&
      worldPos.x <= pet.x + pet.w + pad &&
      worldPos.y >= pet.y - pad &&
      worldPos.y <= pet.y + pet.h + pad;

    if (onPet) {
      event.preventDefault();
      resumeCameraFollow();
      // 玩家亲自移动角色时，当前的自主追球立即让位，避免和拖拽/落地物理抢状态。
      ball.chaseCancelled = true;
      ball.target = null;
      world.chasingToy = false;
      try {
        petEl.setPointerCapture(event.pointerId);
      } catch (err) {
        /* iOS 旧版可能不支持 */
      }
      pet.startDrag(worldPos.x, worldPos.y);
      return;
    }

    gesture = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      mode: "pending",
      decorating,
      spot: nearbyTouchSpot(event, decorating),
      worldPos,
    };
    try {
      viewport.setPointerCapture(event.pointerId);
    } catch (err) {
      /* ignore */
    }
  });

  listen(viewport, "touchmove", (event) => {
    if (pet.dragging || (gesture && gesture.mode === "pan")) event.preventDefault();
  }, { passive: false });

  listen(window, "pointermove", (event) => {
    if (event.pointerType === "touch" && touchPoints.has(event.pointerId)) {
      touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    if (twoFingerPan && touchPoints.size >= 2) {
      const points = Array.from(touchPoints.values());
      const centerX = (points[0].x + points[1].x) / 2;
      const centerY = (points[0].y + points[1].y) / 2;
      camera.setEnabled(false);
      root.querySelector("#cameraToggle").checked = false;
      camera.nudge(centerX - twoFingerPan.x, centerY - twoFingerPan.y);
      twoFingerPan.x = centerX;
      twoFingerPan.y = centerY;
      return;
    }
    const worldPos = camera.screenToWorld(event.clientX, event.clientY);
    if (toyDrag && event.pointerId === toyDrag.pointerId) {
      if (Math.hypot(event.clientX - toyDrag.startX, event.clientY - toyDrag.startY) > 8) toyDrag.moved = true;
      // 按住时是“拿起球”，松手后才按重力落下；不把中途高度当成永久位置。
      ball.x = Math.min(world.w - toySize() / 2, Math.max(toySize() / 2, worldPos.x));
      ball.y = Math.min(groundToyY(), Math.max(toySize() / 2, worldPos.y));
      renderToy();
      return;
    }
    if (!(gesture && gesture.mode === "pan")) pet.pointerWorldX = worldPos.x;
    if (pet.dragging) {
      pet.dragTo(worldPos.x, worldPos.y);
      return;
    }
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    const slop = isCoarse() ? 16 : 8;
    if (gesture.mode === "pending" && Math.hypot(dx, dy) > slop) {
      gesture.mode = "pan";
      // 手动查看房间后，始终把镜头控制权交给玩家，避免被角色立刻拉回。
      camera.setEnabled(false);
      root.querySelector("#cameraToggle").checked = false;
    }
    if (gesture.mode === "pan") {
      camera.nudge(event.clientX - gesture.lastX, event.clientY - gesture.lastY);
      gesture.lastX = event.clientX;
      gesture.lastY = event.clientY;
    }
  });

  listen(window, "pointerup", onPointerUp);
  listen(window, "pointercancel", onPointerUp);

  function onPointerUp(event) {
    if (event.pointerType === "touch") {
      touchPoints.delete(event.pointerId);
      if (twoFingerPan) {
        if (touchPoints.size < 2) twoFingerPan = null;
        return;
      }
    }
    if (toyDrag && event.pointerId === toyDrag.pointerId) {
      const worldPos = camera.screenToWorld(event.clientX, event.clientY);
      const moved = toyDrag.moved;
      const startWorld = toyDrag.startWorld;
      toyDrag = null;
      toyElement()?.classList.remove("is-aiming");
      if (moved) {
        // 抛出后是和角色一起玩的行为，恢复跟随，但不在按住球时抢走玩家的拖拽。
        resumeCameraFollow();
        ball.held = false;
        ball.vx = Math.min(920, Math.max(-920, (worldPos.x - startWorld.x) * 3.2));
        ball.vy = Math.min(300, Math.max(-920, (worldPos.y - startWorld.y) * 2.7 - 280));
        ball.air = true;
        ball.launchedAt = performance.now();
        ball.lastChaseAt = 0;
        ball.chaseCancelled = false;
        ball.target = null;
        play.qualifyingThrow = Math.abs(worldPos.x - startWorld.x) > pet.w * 0.65;
        // 等球先离手，再实时追向它当前的位置；不会预判一个固定落点。
        world.chasingToy = false;
      } else {
        inviteToyPlay();
      }
      return;
    }
    if (pet.dragging) {
      const worldPos = camera.screenToWorld(event.clientX, event.clientY);
      const moved = pet.endDrag();
      if (!moved) {
        const action = pet.onTap(worldPos.y - pet.y);
        if (action === "wave") {
          setMoreOpen(false);
          closeBagPanel();
          root.dispatchEvent(new CustomEvent("companion:talk"));
        }
      }
      return;
    }
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    if (gesture.mode === "pending" && !gesture.decorating) {
      if (gesture.spot) goToSpot(gesture.spot);
      else {
        resumeCameraFollow();
        pet.walkTo(gesture.worldPos.x - pet.w / 2);
      }
    }
    gesture = null;
  }

  listen(root.querySelector("#followToggle"), "change", (event) => {
    pet.followMouse = event.target.checked;
    if (pet.followMouse) pet.speak("follow");
  });

  listen(root.querySelector("#cameraToggle"), "change", (event) => {
    camera.setEnabled(event.target.checked);
  });

  listen(root.querySelector("#flipToggle"), "change", (event) => {
    pet.flipInvert = event.target.checked;
    pet.setFacing(pet.dir);
  });

  listen(window, "keydown", (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    if (event.repeat && event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "a" && event.key !== "d") return;
    if (event.key === "ArrowLeft" || event.key === "a") pet.walkTo(pet.x - 220, true);
    if (event.key === "ArrowRight" || event.key === "d") pet.walkTo(pet.x + 220, true);
    if (event.key === " " || event.key === "ArrowUp" || event.key === "w") {
      event.preventDefault();
      pet.jump();
    }
    if (event.key === "s" || event.key === "e") pet.sit();
    if (event.key === "q") pet.sleep();
    if (event.key === "f") inviteToyPlay();
  });

  listen(root.querySelector("#menuToggle"), "click", () => {
    const open = !plate.classList.contains("is-open");
    setMoreOpen(open);
    if (open) root.dispatchEvent(new CustomEvent("companion:talk-end"));
  });

  listen(root, "companion:talk", () => {
    setMoreOpen(false);
    closeBagPanel();
    requestAnimationFrame(() => relayout());
  });
  listen(root, "companion:talk-end", () => {
    requestAnimationFrame(() => relayout());
  });
  listen(root, "hud:change", () => {
    requestAnimationFrame(() => relayout());
  });
  listen(root, "companion:said", (event) => {
    const text = event.detail?.text;
    if (typeof text === "string" && text) pet.speakLine(text);
  });

  listen(window, "resize", relayout);
  if (window.visualViewport) {
    listen(window.visualViewport, "resize", relayout);
    listen(window.visualViewport, "scroll", () => camera.apply());
  }

  function updateStatus() {
    const write = (selector, value, fill) => {
      const el = root.querySelector(selector);
      if (!el) return;
      el.textContent = String(value);
      const stat = el.closest("[data-stat]");
      if (stat) stat.style.setProperty("--stat-value", `${Math.max(0, Math.min(100, fill))}%`);
    };
    write("[data-mood]", Math.round(pet.mood), pet.mood);
    write("[data-pats]", pet.pats, Math.min(100, pet.pats * 4));
    write("[data-energy]", Math.round(pet.energy), pet.energy);
    write("[data-hunger]", Math.round(pet.hunger), pet.hunger);
  }

  listen(document, "visibilitychange", () => {
    if (document.hidden) {
      persist();
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    } else {
      applyPeriod();
      last = performance.now();
      if (!animationFrame) animationFrame = requestAnimationFrame(tick);
    }
  });

  listen(root.querySelector("[data-life-event-close]"), "click", closeLifeEvent);
  listen(root.querySelector("#lifeEvent"), "pointerdown", (event) => {
    if (event.target === event.currentTarget) closeLifeEvent();
  });
  listen(root.querySelector("[data-travel-event-close]"), "click", closeTravelMap);
  listen(root.querySelector("#travelEvent"), "pointerdown", (event) => {
    if (event.target === event.currentTarget) closeTravelMap();
  });
  listen(root, "pet:arrived", (event) => {
    const action = event.detail?.action;
    if (typeof action !== "string") return;
    if (action.startsWith("travel:")) openTravelMap();
    if (action.startsWith("event:")) openStreetEvent(action.slice("event:".length));
    if (action.startsWith("story:")) completeTodayStory(action.slice("story:".length));
  });
  listen(root.querySelector("#todayStory"), "click", () => {
    const card = root.querySelector("#todayStory");
    if (!card) return;
    const mobile = window.matchMedia("(max-width: 768px)").matches;
    if (mobile && card.dataset.expanded !== "true") {
      card.dataset.expanded = "true";
      window.clearTimeout(storyExpandTimer);
      storyExpandTimer = window.setTimeout(() => {
        card.dataset.expanded = "false";
      }, 4000);
      return;
    }
    startTodayStory();
  });
  listen(root.querySelector("#bagToggle"), "click", () => {
    const panel = root.querySelector("#bagPanel");
    const open = panel.classList.toggle("is-open");
    root.querySelector("#bagToggle").setAttribute("aria-expanded", String(open));
  });

  listen(root, "scene:change", (event) => changeScene(event.detail));
  listen(window, "pagehide", persist);

  function relayout() {
    syncKeyboardInset();
    const ratio = world.w ? pet.x / world.w : 0.5;
    layout();
    pet.x = pet.clampX(ratio * world.w);
    pet.place();
    if (camera.enabled) camera.snapToTarget();
    else {
      camera.clamp();
      camera.apply();
    }
  }

  function tick(now) {
    if (document.hidden) {
      animationFrame = 0;
      return;
    }
    const dt = Math.min(0.032, (now - last) / 1000);
    last = now;

    if (now >= nextStatusUpdate) {
      updateStatus();
      nextStatusUpdate = now + 500;
    }

    updateToy(dt, now);
    const landed = pet.update(dt, now);
    syncHeldToy(now);
    if (landed === "landed") {
      camera.shake(pet.state === "sit" ? 10 : 5);
      camera.setZoom(1);
    }
    if (pet.state === "sleep") camera.setZoom(viewSize().w < 768 ? 1.02 : 1.16);
    else if (pet.state === "walk") camera.setZoom(1);
    else if (pet.state !== "sit") camera.setZoom(1);

    bringToyToPet();

    fx.update(dt);
    camera.update(dt);
    animationFrame = requestAnimationFrame(tick);
  }

  function greetFromMemory() {
    const save = loadSave();
    pet.mood = typeof save.mood === "number" ? save.mood : 64;
    pet.pats = save.pats || 0;
    pet.energy = typeof save.energy === "number" ? save.energy : 76;
    pet.hunger = typeof save.hunger === "number" ? save.hunger : 72;
    const visits = (save.visits || 0) + 1;
    let group = "greet";
    if (save.savedAt) {
      const hours = (Date.now() - save.savedAt) / 3600000;
      pet.applyOfflineTime(hours);
      if (hours > 8) group = "miss";
      else if (hours > 0.75) group = "back";
      else if (hours < 0.04) group = "again";
    }
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        savedAt: Date.now(),
        mood: pet.mood,
        pats: pet.pats,
        energy: pet.energy,
        hunger: pet.hunger,
        visits,
      }));
    } catch (err) {
      /* ignore */
    }
    window.setTimeout(() => pet.speak(group), 450);
  }

  function boot() {
    applyPeriod();
    layout();
    applyLampState();
    const savedToyPosition = loadToyPosition();
    todayStory = loadTodayStory();
    pet.x = world.w * 0.38;
    pet.goIdle(true);
    camera.snapToTarget();
    if (savedToyPosition) setToyPosition(savedToyPosition.x);
    else {
      const toyRect = toyElement()?.getBoundingClientRect();
      const toyPos = toyRect ? camera.screenToWorld(toyRect.left + toyRect.width / 2, toyRect.top + toyRect.height / 2) : { x: world.w * 0.34 };
      setToyPosition(toyPos.x);
    }
    greetFromMemory();
    renderBag();
    renderTodayStory();
    window.setTimeout(previewTodayStory, 760);
    renderPlayStreak();
    updateStatus();
    periodTimer = window.setInterval(applyPeriod, 60000);
    persistTimer = window.setInterval(persist, 8000);
    const sprite = petEl.querySelector("img");
    if (sprite) {
      listen(sprite, "error", () => {
        pet.bubble.textContent = "立绘加载失败，请重新部署 assets";
        pet.bubble.classList.add("show");
      });
      if (sprite.complete && sprite.naturalWidth === 0) {
        sprite.dispatchEvent(new Event("error"));
      }
    }
    animationFrame = requestAnimationFrame(tick);
  }

  if (document.readyState === "complete") boot();
  else listen(window, "load", boot, { once: true });

  return () => {
    lifecycle.abort();
    if (animationFrame) cancelAnimationFrame(animationFrame);
    if (periodTimer) clearInterval(periodTimer);
    if (persistTimer) clearInterval(persistTimer);
    pet.destroy();
    document.body.classList.remove("is-dawn", "is-day", "is-dusk", "is-night");
  };
}
