(() => {
  const SAVE_KEY = "wenbebi-v1";
  const viewport = document.getElementById("viewport");
  const worldEl = document.getElementById("world");
  const toy = document.getElementById("toy");
  const petEl = document.getElementById("pet");
  const fxCanvas = document.getElementById("fx");
  const plate = document.getElementById("plate");

  const world = { w: 0, h: 0, floorH: 0, period: "day", chasingToy: false };
  const camera = new Camera(worldEl);
  const fx = new FX(fxCanvas);
  const pet = new Pet(petEl, world, fx);
  camera.setTarget(pet);

  let last = performance.now();
  const ball = { x: 0, bottom: 0, vx: 0, vy: 0, air: false };
  let gesture = null;

  function isCoarse() {
    return window.matchMedia("(pointer: coarse)").matches;
  }

  function measureHud() {
    const view = viewSize();
    if (view.w > 768) return 0;
    const rect = plate.getBoundingClientRect();
    return Math.max(0, view.top + view.h - rect.top);
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
        visits: prev.visits || 1,
      }));
    } catch (err) {
      /* 无痕模式可能写不了 */
    }
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
  }

  function floorRest() {
    return world.floorH * 0.55;
  }

  world.getSpots = function getSpots() {
    return Array.from(document.querySelectorAll("[data-spot]")).map((el) => {
      const rect = el.getBoundingClientRect();
      const pos = camera.screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return { el, kind: el.getAttribute("data-spot"), x: pos.x };
    });
  };

  function layout() {
    pet.measure();
    const view = viewSize();
    const mobile = view.w <= 768;
    const hud = measureHud();
    world.h = view.h;
    world.w = Math.max(view.w * 2.8, mobile ? 1400 : 2200);
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
    if (!toy.hidden) placeToy();
  }

  function toySize() {
    return toy.offsetWidth || 28;
  }

  function placeToy() {
    const size = toySize();
    ball.x = Math.min(world.w - size, Math.max(12, ball.x));
    ball.bottom = Math.max(floorRest(), ball.bottom);
    toy.style.left = `${ball.x}px`;
    toy.style.bottom = `${ball.bottom}px`;
  }

  function hideToy() {
    toy.hidden = true;
    world.chasingToy = false;
    ball.vx = 0;
    ball.vy = 0;
    ball.air = false;
  }

  function throwToy() {
    const dir = pet.dir || 1;
    const power = viewSize().w <= 768 ? 0.72 : 1;
    ball.x = pet.x + pet.w * (dir > 0 ? 0.72 : 0.08);
    ball.bottom = floorRest() + 40;
    ball.vx = dir * (280 + Math.random() * 180) * power;
    ball.vy = (400 + Math.random() * 100) * power;
    ball.air = true;
    world.chasingToy = true;
    toy.hidden = false;
    placeToy();
    pet.speak("toy");
    pet.walkTo(ball.x - pet.w * 0.45, true);
  }

  function updateToy(dt) {
    if (toy.hidden) return;
    const rest = floorRest();
    if (ball.air) {
      ball.vy -= 1650 * dt;
      ball.x += ball.vx * dt;
      ball.bottom += ball.vy * dt;
      if (ball.x < 12 || ball.x > world.w - toySize()) {
        ball.x = Math.min(world.w - toySize(), Math.max(12, ball.x));
        ball.vx *= -0.52;
      }
      if (ball.bottom <= rest) {
        ball.bottom = rest;
        if (Math.abs(ball.vy) > 90) {
          ball.vy *= -0.42;
          ball.vx *= 0.76;
          fx.burst(ball.x + 14, world.h - rest, "dust");
        } else {
          ball.air = false;
          ball.vy = 0;
        }
      }
    } else if (Math.abs(ball.vx) > 7) {
      ball.x += ball.vx * dt;
      ball.vx *= Math.pow(0.32, dt);
      if (ball.x < 12 || ball.x > world.w - toySize()) {
        ball.x = Math.min(world.w - toySize(), Math.max(12, ball.x));
        ball.vx *= -0.4;
      }
      if (Math.abs(ball.vx) <= 7) ball.vx = 0;
    }
    placeToy();
  }

  function chaseToy() {
    if (!world.chasingToy || toy.hidden || pet.dragging) return;
    if (pet.state === "jump" || pet.state === "fall") return;
    const goal = pet.clampX(ball.x - pet.w * 0.45);
    if (Math.abs((pet.state === "walk" ? pet.targetX : pet.x) - goal) > 28) {
      pet.walkTo(goal, true);
    }
  }

  function maybeCatchToy() {
    if (!world.chasingToy || toy.hidden) return;
    const petMid = pet.x + pet.w / 2;
    const size = toySize();
    const near = Math.abs(petMid - (ball.x + size / 2)) < Math.max(48, pet.w * 0.42);
    const settled = !ball.air && Math.abs(ball.vx) < 110;
    if (near && settled) {
      hideToy();
      pet.happy("catch");
    }
  }

  function goToSpot(el) {
    const kind = el.getAttribute("data-spot");
    const rect = el.getBoundingClientRect();
    const pos = camera.screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const action = kind === "rug" ? "sit" : kind === "plant" ? "sniff" : kind;
    pet.walkTo(pos.x - pet.w / 2, false, action);
  }

  viewport.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".desk-plate")) return;
    if (event.button) return;
    const worldPos = camera.screenToWorld(event.clientX, event.clientY);
    const pad = isCoarse() ? (pet.state === "sleep" ? 40 : 32) : 0;
    const onPet =
      worldPos.x >= pet.x - pad &&
      worldPos.x <= pet.x + pet.w + pad &&
      worldPos.y >= pet.y - pad &&
      worldPos.y <= pet.y + pet.h + pad;

    if (onPet) {
      event.preventDefault();
      try {
        petEl.setPointerCapture(event.pointerId);
      } catch (err) {
        /* iOS 旧版可能不支持 */
      }
      pet.startDrag(worldPos.x, worldPos.y);
      return;
    }

    if (event.target.closest(".toy")) return;

    gesture = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      mode: "pending",
      spot: event.target.closest("[data-spot]"),
      worldPos,
    };
    try {
      viewport.setPointerCapture(event.pointerId);
    } catch (err) {
      /* ignore */
    }
  });

  viewport.addEventListener("touchmove", (event) => {
    if (pet.dragging || (gesture && gesture.mode === "pan")) event.preventDefault();
  }, { passive: false });

  window.addEventListener("pointermove", (event) => {
    const worldPos = camera.screenToWorld(event.clientX, event.clientY);
    if (!(gesture && gesture.mode === "pan")) pet.pointerWorldX = worldPos.x;
    if (pet.dragging) {
      pet.dragTo(worldPos.x, worldPos.y);
      return;
    }
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    const slop = isCoarse() ? 12 : 8;
    if (gesture.mode === "pending" && Math.hypot(dx, dy) > slop) {
      gesture.mode = "pan";
      camera.setEnabled(false);
      document.getElementById("cameraToggle").checked = false;
    }
    if (gesture.mode === "pan") {
      camera.nudge(event.clientX - gesture.lastX, event.clientY - gesture.lastY);
      gesture.lastX = event.clientX;
      gesture.lastY = event.clientY;
    }
  });

  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);

  function onPointerUp(event) {
    if (pet.dragging) {
      const worldPos = camera.screenToWorld(event.clientX, event.clientY);
      const moved = pet.endDrag();
      if (!moved) pet.onTap(worldPos.y - pet.y);
      return;
    }
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    if (gesture.mode === "pending") {
      if (gesture.spot) goToSpot(gesture.spot);
      else pet.walkTo(gesture.worldPos.x - pet.w / 2);
    }
    gesture = null;
  }

  toy.addEventListener("click", (event) => {
    event.stopPropagation();
    hideToy();
    pet.happy("catch");
  });

  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.getAttribute("data-action");
      camera.setEnabled(true);
      document.getElementById("cameraToggle").checked = true;
      if (action === "idle") pet.goIdle();
      if (action === "walk") pet.walkTo(Math.random() * (world.w - pet.w));
      if (action === "sit") pet.sit();
      if (action === "sleep") {
        pet.sleep();
        camera.setZoom(viewSize().w < 768 ? 1.02 : 1.18);
      }
      if (action === "jump") pet.jump();
      if (action === "toy") throwToy();
    });
  });

  document.getElementById("followToggle").addEventListener("change", (event) => {
    pet.followMouse = event.target.checked;
    if (pet.followMouse) pet.speak("follow");
  });

  document.getElementById("cameraToggle").addEventListener("change", (event) => {
    camera.setEnabled(event.target.checked);
  });

  document.getElementById("flipToggle").addEventListener("change", (event) => {
    pet.flipInvert = event.target.checked;
    pet.setFacing(pet.dir);
  });

  document.getElementById("clearToggle").addEventListener("change", (event) => {
    document.body.classList.toggle("is-clear", event.target.checked);
  });

  window.addEventListener("keydown", (event) => {
    if (event.repeat && event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "a" && event.key !== "d") return;
    if (event.key === "ArrowLeft" || event.key === "a") pet.walkTo(pet.x - 220, true);
    if (event.key === "ArrowRight" || event.key === "d") pet.walkTo(pet.x + 220, true);
    if (event.key === " " || event.key === "ArrowUp" || event.key === "w") {
      event.preventDefault();
      pet.jump();
    }
    if (event.key === "s" || event.key === "e") pet.sit();
    if (event.key === "q") pet.sleep();
    if (event.key === "f") throwToy();
  });

  document.getElementById("menuToggle").addEventListener("click", () => {
    const open = plate.classList.toggle("is-open");
    document.getElementById("menuToggle").setAttribute("aria-expanded", String(open));
    window.requestAnimationFrame(() => {
      layout();
      pet.y = pet.floorY();
      pet.place();
    });
  });

  window.addEventListener("resize", relayout);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", relayout);
    window.visualViewport.addEventListener("scroll", () => camera.apply());
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) persist();
    else applyPeriod();
  });
  window.addEventListener("pagehide", persist);

  function relayout() {
    const ratio = world.w ? pet.x / world.w : 0.5;
    layout();
    pet.x = pet.clampX(ratio * world.w);
    pet.place();
    camera.snapToTarget();
  }

  function tick(now) {
    const dt = Math.min(0.032, (now - last) / 1000);
    last = now;

    updateToy(dt);
    chaseToy();

    const landed = pet.update(dt, now);
    if (landed === "landed") {
      camera.shake(pet.state === "sit" ? 10 : 5);
      camera.setZoom(1);
    }
    if (pet.state === "sleep") camera.setZoom(viewSize().w < 768 ? 1.02 : 1.16);
    else if (pet.state === "walk") camera.setZoom(1);
    else if (pet.state !== "sit") camera.setZoom(1);

    maybeCatchToy();

    fx.update(dt);
    camera.update(dt);
    requestAnimationFrame(tick);
  }

  function greetFromMemory() {
    const save = loadSave();
    pet.mood = typeof save.mood === "number" ? save.mood : 64;
    pet.pats = save.pats || 0;
    const visits = (save.visits || 0) + 1;
    let group = "greet";
    if (save.savedAt) {
      const hours = (Date.now() - save.savedAt) / 3600000;
      if (hours > 8) group = "miss";
      else if (hours > 0.75) group = "back";
      else if (hours < 0.04) group = "again";
    }
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        savedAt: Date.now(),
        mood: pet.mood,
        pats: pet.pats,
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
    pet.x = world.w * 0.38;
    pet.goIdle(true);
    camera.snapToTarget();
    greetFromMemory();
    window.setInterval(applyPeriod, 60000);
    window.setInterval(persist, 8000);
    const sprite = petEl.querySelector("img");
    if (sprite) {
      sprite.addEventListener("error", () => {
        pet.bubble.textContent = "立绘加载失败，请重新部署 assets";
        pet.bubble.classList.add("show");
      });
      if (sprite.complete && sprite.naturalWidth === 0) {
        sprite.dispatchEvent(new Event("error"));
      }
    }
    requestAnimationFrame(tick);
  }

  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot);
})();
