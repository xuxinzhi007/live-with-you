window.Pet = class Pet {
  constructor(el, world, fx) {
    this.el = el;
    this.actor = el.querySelector(".pet-actor");
    this.bubble = document.getElementById("bubble");
    this.world = world;
    this.fx = fx;
    this.w = 168;
    this.h = 282;
    this.x = 0;
    this.y = 0;
    this.vy = 0;
    this.dir = 1;
    this.state = "idle";
    this.speed = 150;
    this.targetX = 0;
    this.followMouse = false;
    this.dragging = false;
    this.dragMoved = false;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    this.dropFromY = 0;
    this.idleSince = 0;
    this.nextWalkAt = 0;
    this.nextZzz = 0;
    this.speakTimer = 0;
    this.clickCount = 0;
    this.clickTimer = 0;
    this.flipInvert = false;
    this.pointerWorldX = 0;
    this.thenAction = null;
    this.busyUntil = 0;
    this.mood = 64;
    this.pats = 0;
    this.spriteName = "idle";
    this.sprites = {
      idle: "idle",
      walk: "idle",
      sit: "rest",
      sleep: "sleep",
      jump: "jump",
      fall: "jump",
      wave: "idle",
      happy: "jump",
      look: "idle",
    };
    this.img = el.querySelector("img");
    this.source = el.querySelector("source");
    this.lines = {
      greet: ["你好，我是雯宝。", "我在这儿。", "今天也要摸鱼吗？"],
      again: ["又来啦", "我还在。", "嘿嘿"],
      back: ["你回来啦", "等你很久了", "我一直在。"],
      miss: ["你去哪儿了…", "我想你了", "好久没见"],
      idle: ["发呆中", "站一会儿。", "……"],
      pat: ["嘿嘿", "好痒", "再摸摸～"],
      poke: ["嗯？", "干嘛啦", "轻轻的。"],
      walk: ["去那边看看", "散步～", "我过来啦"],
      sit: ["歇一会儿", "摸鱼中", "坐着也挺好"],
      sleep: ["困了…", "先睡一下", "Zzz"],
      wake: ["嗯？", "我醒啦", "谁叫我"],
      drop: ["哇！", "轻一点啦", "吓我一跳"],
      dizzy: ["头好晕…", "下次轻点！"],
      jump: ["嘿！", "跳～"],
      toy: ["球！", "我去捡！", "给我给我"],
      catch: ["拿到啦", "是我的。", "再丢一次？"],
      follow: ["跟着你", "去哪儿？"],
      window: ["外面好亮", "在看云。", "发呆中"],
      night: ["好暗啊", "该睡觉了", "星星…"],
      plant: ["绿绿的", "香香的？", "别吃土"],
      frame: ["这张好看", "谁拍的", "嗯…"],
      shelf: ["够不着", "放这儿的？", "积灰了"],
      sad: ["……", "不想动", "哼"],
    };
  }

  measure() {
    const styles = getComputedStyle(document.documentElement);
    this.w = parseFloat(styles.getPropertyValue("--pet-w")) || 168;
    this.h = parseFloat(styles.getPropertyValue("--pet-h")) || 282;
  }

  floorY() {
    const hud = this.world.hudH || 0;
    return this.world.h - this.h - Math.max(this.world.floorH * 0.42, hud + 10);
  }

  clampX(value) {
    return Math.min(this.world.w - this.w, Math.max(0, value));
  }

  nudgeMood(delta) {
    this.mood = Math.max(0, Math.min(100, (this.mood ?? 64) + delta));
  }

  setState(next) {
    this.state = next;
    this.el.classList.remove(
      "is-idle", "is-walk", "is-jump", "is-sit", "is-sleep",
      "is-wave", "is-happy", "is-fall", "is-look"
    );
    this.el.classList.add(`is-${next}`);
    this.el.classList.toggle("is-airborne", next === "jump" || next === "fall" || this.dragging);
    this.setSprite(next);
  }

  setSprite(state) {
    const name = this.sprites[state] || "idle";
    if (this.spriteName === name) return;
    this.spriteName = name;
    if (this.source) this.source.srcset = `assets/${name}.webp`;
    if (this.img) {
      this.img.src = `assets/${name}.png`;
      if (this.source && this.source.parentElement) {
        this.source.parentElement.insertBefore(this.source, this.img);
      }
    }
  }

  setFacing(dir) {
    if (!dir) return;
    this.dir = dir;
    // 立绘默认朝右；勾选「左右纠正」后改为朝左再镜像。
    const flipped = this.flipInvert ? dir > 0 : dir < 0;
    this.el.classList.toggle("is-flipped", flipped);
  }

  speak(group) {
    let key = group;
    if (
      (this.mood ?? 64) < 28 &&
      ["idle", "walk", "sit"].includes(group) &&
      Math.random() < 0.5
    ) {
      key = "sad";
    }
    const lines = this.lines[key] || this.lines.idle;
    this.bubble.textContent = lines[Math.floor(Math.random() * lines.length)];
    this.bubble.classList.add("show");
    clearTimeout(this.speakTimer);
    this.speakTimer = window.setTimeout(() => this.bubble.classList.remove("show"), 1500);
  }

  place() {
    this.x = this.clampX(this.x);
    this.el.style.left = `${this.x}px`;
    this.el.style.top = `${this.y}px`;
  }

  center() {
    return { x: this.x + this.w / 2, y: this.y + this.h * 0.35 };
  }

  runThen(action) {
    if (action === "sit") this.sit();
    else if (action === "sniff") this.sniff();
    else if (action === "sleep") this.sleep();
    else if (action === "frame") this.look("frame");
    else if (action === "shelf") this.look("shelf");
    else this.look(action || "window");
  }

  goIdle(silent) {
    const then = this.thenAction;
    this.thenAction = null;
    this.vy = 0;
    this.y = this.floorY();
    this.place();
    if (then) {
      this.runThen(then);
      return;
    }
    this.busyUntil = 0;
    this.setState("idle");
    this.idleSince = performance.now();
    this.nextWalkAt = performance.now() + 3800 + Math.random() * 2800;
    if (!silent) this.speak("idle");
  }

  walkTo(toX, silent, then) {
    if (this.dragging) return;
    this.thenAction = then || null;
    this.busyUntil = 0;
    if (this.state === "sleep") this.speak("wake");
    const nextX = this.clampX(toX);
    if (Math.abs(nextX - this.x) < 10) {
      const queued = this.thenAction;
      this.thenAction = null;
      if (queued) this.runThen(queued);
      return;
    }
    const keepWalk = this.state === "walk";
    this.targetX = nextX;
    this.setFacing(nextX > this.x ? 1 : -1);
    if (!keepWalk) {
      this.setState("walk");
      if (!silent) this.speak("walk");
    }
  }

  sit(silent, ms) {
    if (this.dragging) return;
    this.thenAction = null;
    this.y = this.floorY();
    this.setState("sit");
    this.place();
    this.busyUntil = performance.now() + (ms ?? 8000 + Math.random() * 6000);
    if (!silent) this.speak("sit");
  }

  sleep(ms) {
    if (this.dragging) return;
    this.thenAction = null;
    this.y = this.floorY();
    this.setState("sleep");
    this.place();
    this.speak("sleep");
    this.nextZzz = performance.now() + 400;
    const night = this.world.period === "night";
    this.busyUntil = performance.now() + (
      ms ?? (night ? 26000 + Math.random() * 16000 : 12000 + Math.random() * 8000)
    );
  }

  look(kind) {
    if (this.dragging) return;
    this.thenAction = null;
    this.y = this.floorY();
    this.setState("look");
    this.place();
    const night = this.world.period === "night";
    const group = kind === "frame" ? "frame" : kind === "shelf" ? "shelf" : (night ? "night" : "window");
    this.speak(group);
    this.busyUntil = performance.now() + 5200 + Math.random() * 4000;
  }

  sniff() {
    if (this.dragging) return;
    this.thenAction = null;
    this.setState("wave");
    this.speak("plant");
    this.nudgeMood(2);
    this.fx.burst(this.center().x, this.y + this.h * 0.55, "dust");
    window.setTimeout(() => {
      if (!this.dragging && this.state === "wave") this.goIdle(true);
    }, 700);
  }

  jump() {
    if (this.dragging || this.state === "jump" || this.state === "fall") return;
    this.thenAction = null;
    this.busyUntil = 0;
    this.setState("jump");
    this.speak("jump");
    this.fx.burst(this.x + this.w / 2, this.y + this.h, "dust");
    window.setTimeout(() => {
      if (!this.dragging && this.state === "jump") {
        this.fx.burst(this.x + this.w / 2, this.y + this.h, "dust");
        this.goIdle(true);
      }
    }, 620);
  }

  wave() {
    if (this.dragging) return;
    this.thenAction = null;
    this.setState("wave");
    this.speak("poke");
    window.setTimeout(() => {
      if (!this.dragging && this.state === "wave") this.goIdle(true);
    }, 700);
  }

  happy(group) {
    if (this.dragging) return;
    this.thenAction = null;
    this.nudgeMood(10);
    this.setState("happy");
    this.speak(group || "pat");
    this.fx.burst(this.center().x, this.center().y, "heart");
    window.setTimeout(() => {
      if (!this.dragging && this.state === "happy") this.goIdle(true);
    }, 800);
  }

  pat() {
    this.nudgeMood(6);
    this.pats += 1;
    this.fx.burst(this.center().x, this.y + 36, "heart");
    this.speak("pat");
    if (this.state === "sleep") {
      this.goIdle(true);
      this.speak("wake");
    } else if (this.state === "idle" || this.state === "sit" || this.state === "look") {
      this.setState("wave");
      window.setTimeout(() => {
        if (!this.dragging && this.state === "wave") this.goIdle(true);
      }, 700);
    }
  }

  onTap(localY) {
    if (this.state === "sleep") {
      this.goIdle(true);
      this.speak("wake");
      return;
    }
    this.clickCount += 1;
    clearTimeout(this.clickTimer);
    this.clickTimer = window.setTimeout(() => {
      this.clickCount = 0;
    }, window.matchMedia("(pointer: coarse)").matches ? 560 : 420);
    if (this.clickCount >= 3) {
      this.clickCount = 0;
      this.happy();
      return;
    }
    if (localY < this.h * 0.32) this.pat();
    else this.wave();
  }

  startDrag(worldX, worldY) {
    this.dragging = true;
    this.dragMoved = false;
    this.thenAction = null;
    this.busyUntil = 0;
    this.dragOffsetX = worldX - this.x;
    this.dragOffsetY = worldY - this.y;
    this.dropFromY = this.y;
    this.el.classList.add("is-dragging", "is-airborne");
    this.setState("idle");
  }

  dragTo(worldX, worldY) {
    const nx = worldX - this.dragOffsetX;
    const ny = worldY - this.dragOffsetY;
    if (Math.hypot(nx - this.x, ny - this.y) > (this.world.dragThreshold || 8)) this.dragMoved = true;
    this.setFacing(nx > this.x ? 1 : nx < this.x ? -1 : this.dir);
    this.x = nx;
    this.y = ny;
    this.place();
  }

  endDrag() {
    if (!this.dragging) return false;
    this.dragging = false;
    this.el.classList.remove("is-dragging");
    if (this.dragMoved) {
      this.dropFromY = this.y;
      this.vy = 0;
      this.nudgeMood(-4);
      this.setState("fall");
      this.speak("drop");
      return true;
    }
    return false;
  }

  live() {
    if (this.world.chasingToy) return;
    const night = this.world.period === "night" || this.world.period === "dusk";
    const mood = this.mood ?? 64;
    const spots = this.world.getSpots ? this.world.getSpots() : [];
    const roll = Math.random();
    let sleepChance = night ? 0.32 : 0.07;
    if (mood < 30) sleepChance += 0.12;

    if (roll < sleepChance) {
      this.sleep();
      return;
    }

    const sitChance = mood < 35 ? 0.26 : 0.14;
    if (roll < sleepChance + sitChance) {
      const rugs = spots.filter((spot) => spot.kind === "rug");
      if (rugs.length && Math.random() < 0.72) {
        const rug = rugs[Math.floor(Math.random() * rugs.length)];
        this.walkTo(rug.x - this.w / 2, true, "sit");
      } else {
        this.sit();
      }
      return;
    }

    if (spots.length && roll < 0.8) {
      const kinds = night ? ["window", "rug", "frame"] : ["window", "plant", "rug", "frame", "shelf"];
      const pool = spots.filter((spot) => kinds.includes(spot.kind));
      const pickFrom = pool.length ? pool : spots;
      const spot = pickFrom[Math.floor(Math.random() * pickFrom.length)];
      const action = spot.kind === "rug" ? "sit" : spot.kind === "plant" ? "sniff" : spot.kind;
      this.walkTo(spot.x - this.w / 2, Math.random() < 0.55, action);
      return;
    }

    this.walkTo(Math.random() * (this.world.w - this.w), true);
  }

  update(dt, now) {
    if (this.dragging) return;

    this.nudgeMood(-dt * 0.0012);

    if (this.busyUntil && now >= this.busyUntil && (this.state === "sit" || this.state === "look" || this.state === "sleep")) {
      this.busyUntil = 0;
      if (this.state === "sleep") this.speak("wake");
      this.goIdle(true);
      return "";
    }

    if (
      this.followMouse &&
      this.state !== "sleep" &&
      this.state !== "sit" &&
      this.state !== "jump" &&
      this.state !== "look"
    ) {
      const goal = this.clampX(this.pointerWorldX - this.w / 2);
      if (Math.abs(goal - this.x) > 20) this.walkTo(goal, true);
    }

    if (this.state === "walk") {
      const dir = Math.sign(this.targetX - this.x) || this.dir;
      this.setFacing(dir);
      this.x += dir * this.speed * dt;
      if ((dir > 0 && this.x >= this.targetX) || (dir < 0 && this.x <= this.targetX)) {
        this.x = this.targetX;
        this.goIdle(true);
      }
      this.y = this.floorY();
      this.place();
      if (Math.random() < dt * 6) {
        this.fx.burst(this.x + this.w / 2, this.y + this.h - 8, "dust");
      }
    }

    if (this.state === "fall") {
      this.vy += 2400 * dt;
      this.y += this.vy * dt;
      const ground = this.floorY();
      if (this.y >= ground) {
        const fall = ground - this.dropFromY;
        this.y = ground;
        this.vy = 0;
        this.fx.burst(this.x + this.w / 2, this.y + this.h, "dust");
        if (fall > 140) {
          this.fx.burst(this.center().x, this.center().y, "star");
          this.nudgeMood(-12);
          this.speak("dizzy");
          this.sit(true, 2800);
        } else {
          this.goIdle(true);
        }
        return "landed";
      }
      this.place();
    }

    if (this.state === "sleep" && now > this.nextZzz) {
      this.fx.burst(this.x + this.w * 0.62, this.y + this.h * 0.42, "zzz");
      this.nextZzz = now + 1100;
    }

    if (!this.followMouse && this.state === "idle") {
      if (now > this.nextWalkAt) {
        this.live();
      } else if (this.pointerWorldX) {
        this.setFacing(this.pointerWorldX < this.x + this.w / 2 ? -1 : 1);
      }
    }
    return "";
  }
};
