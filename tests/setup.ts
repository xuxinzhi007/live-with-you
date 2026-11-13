import "@testing-library/jest-dom/vitest";

// jsdom 没实现 scrollIntoView；ChatScreen 进入时要滚到底部，否则整个 WorldApp 渲染会抛错。
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
