import { Camera, viewSize } from "./camera.js";
import { FX } from "./fx.js";
import { Pet } from "./pet.js";
import { wenbebi } from "./data/pet.js";
import { spotActions } from "./data/room.js";

export function startGame(root) {
  const SAVE_KEY = "wenbebi-v1";
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
  let gesture = null;
  let toyDrag = null;
  const lifecycle = new AbortController();
  let animationFrame = 0;
  let periodTimer = 0;
  let persistTimer = 0;
  let nextStatusUpdate = 0;
  let lampOn = loadRoomState().lampOn;

  function listen(target, type, listener, options = {}) {
    target.addEventListener(type, listener, { ...options, signal: lifecycle.signal });
  }

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
        energy: pet.energy,
        hunger: pet.hunger,
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
    return Array.from(root.querySelectorAll("[data-spot]")).map((el) => {
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

  function toggleLamp() {
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

  function goToSpot(el) {
    const kind = el.getAttribute("data-spot");
    if (kind === "frame") {
      root.dispatchEvent(new CustomEvent("memory:open"));
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
    pet.walkTo(pos.x - pet.w / 2, false, action);
  }

  listen(viewport, "pointerdown", (event) => {
    if (event.target.closest(".desk-plate")) return;
    if (root.dataset.memoryOpen === "true") return;
    if (root.dataset.decorating === "true") return;
    if (event.button) return;
    const worldPos = camera.screenToWorld(event.clientX, event.clientY);
    const toyTarget = event.target.closest('[data-spot="toy"]');
    if (toyTarget) {
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
    const onPet =
      worldPos.x >= pet.x - pad &&
      worldPos.x <= pet.x + pet.w + pad &&
      worldPos.y >= pet.y - pad &&
      worldPos.y <= pet.y + pet.h + pad;

    if (onPet) {
      event.preventDefault();
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
      spot: event.target.closest("[data-spot]"),
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
    const slop = isCoarse() ? 12 : 8;
    if (gesture.mode === "pending" && Math.hypot(dx, dy) > slop) {
      gesture.mode = "pan";
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
    if (toyDrag && event.pointerId === toyDrag.pointerId) {
      const worldPos = camera.screenToWorld(event.clientX, event.clientY);
      const moved = toyDrag.moved;
      const startWorld = toyDrag.startWorld;
      toyDrag = null;
      toyElement()?.classList.remove("is-aiming");
      if (moved) {
        ball.held = false;
        ball.vx = Math.min(920, Math.max(-920, (worldPos.x - startWorld.x) * 3.2));
        ball.vy = Math.min(300, Math.max(-920, (worldPos.y - startWorld.y) * 2.7 - 280));
        ball.air = true;
        ball.launchedAt = performance.now();
        ball.lastChaseAt = 0;
        ball.chaseCancelled = false;
        ball.target = null;
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

  listen(root.querySelector("#clearToggle"), "change", (event) => {
    document.body.classList.toggle("is-clear", event.target.checked);
  });

  listen(window, "keydown", (event) => {
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
    const open = plate.classList.toggle("is-open");
    root.querySelector("#menuToggle").setAttribute("aria-expanded", String(open));
    window.requestAnimationFrame(() => {
      layout();
      pet.y = pet.floorY();
      pet.place();
    });
  });

  listen(window, "resize", relayout);
  if (window.visualViewport) {
    listen(window.visualViewport, "resize", relayout);
    listen(window.visualViewport, "scroll", () => camera.apply());
  }

  function updateStatus() {
    const mood = root.querySelector("[data-mood]");
    const pats = root.querySelector("[data-pats]");
    const energy = root.querySelector("[data-energy]");
    const hunger = root.querySelector("[data-hunger]");
    if (mood) mood.textContent = String(Math.round(pet.mood));
    if (pats) pats.textContent = String(pet.pats);
    if (energy) energy.textContent = String(Math.round(pet.energy));
    if (hunger) hunger.textContent = String(Math.round(pet.hunger));
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
  listen(window, "pagehide", persist);

  function relayout() {
    const ratio = world.w ? pet.x / world.w : 0.5;
    layout();
    pet.x = pet.clampX(ratio * world.w);
    pet.place();
    camera.snapToTarget();
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
    document.body.classList.remove("is-dawn", "is-day", "is-dusk", "is-night", "is-clear");
  };
}
