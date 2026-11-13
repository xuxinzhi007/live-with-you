Implement the approved design in docs/superpowers/specs/2026-11-06-layered-animation-design.md. Do not commit. Do not open a PR. Do not mention Cursor or any AI brand in comments or docs. Do not delete public/assets/characters, nikki, or scenes copies.

Repo: C:\Users\ZhuanZ1\Desktop\wenbebi (this directory). Runtime entry is src/main.tsx -> src/mobile/WorldApp.tsx.

Required:
1. Layered stage renderer: stack body, dress, head, arms-front (bottom to top) instead of a single character img when those transparent parts exist. Canvas 760x760, feet near y=748. Keep current whole-body image + runtime cutout as fallback when any required layer is missing.
2. Motion state machine on the stage: idle (gentle breathe via scale or existing skeleton motion, do not hard-cut 4 breathe frames when layered mode is active), react (tap character, then return to idle), equip (short dress-layer fade + short adjust pose, then idle). New input interrupts the previous clip. No walk/sit/sleep this pass.
3. Wire remote-assets.ts / manifest if needed so new part names resolve like other assets:
   - base/original-body.png, base/original-head.png, base/original-arms-front.png
   - dress/<outfit-id>.png
   Local public fallback paths should exist in the mapping even if the PNG files are not generated yet.
4. Keep paper-doll-rig SVG overlays and skeleton-system as the socket source of truth. Do not reintroduce pixi.js or Live2D. Do not revive deleted assets.ts / poses.ts / runtime.ts or unused useWorldGame APIs.
5. Update tests if needed. Run `npm run test:mobile` and `npx tsc --noEmit`. Fix failures you introduce.
6. Report: files changed, how to enable layered mode, what still needs generated art, test results.

Do not generate binary images. Do not start the dev server unless needed for a quick check you can stop.
