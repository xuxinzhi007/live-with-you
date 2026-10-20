# 移动端 App 策略调研：雯宝桌面宠物

> 调研日期：2026-10-20
> 调研原则：所有结论均追到一手来源（官方文档、官方规范、第一方 API），关键结论后紧跟来源 URL。
> 决策优先级（约束）：**网页（Web）> 安卓 App > iOS App**
> 项目前提：纯前端 React + TypeScript + Vite，Canvas/DOM 渲染（`src/game/renderers/`），已支持 PWA Manifest，部署 Netlify（输出 `dist/`），竖屏移动端优先。

---

## TL;DR 结论表

| 方案 | 复用现有 Canvas/DOM 代码 | 移动端增量成本 | 是否需要 Mac（iOS） | 对本项目的适配度 | 一句话结论 |
| --- | --- | --- | --- | --- | --- |
| **纯 PWA（现状）** | 100%（就是它本身） | 零（已是现状） | 否 | Web 端最贴合 | 作为 Web 主形态保留，是"Web 优先"的地基，但不解决"用户在手机上要一个 App 图标/推送/不被 Safari 清数据"的刚需。 |
| **Capacitor（Ionic）** | 100%（WebView 直接跑 `dist/`） | 极小（`npx cap` 加平台壳） | 是（iOS 必须 Xcode） | **推荐** | 增量成本最小、与 Vite 天然兼容、不干扰现有 Netlify 构建；Android 立即受益，iOS 仅受"无 Mac"约束拖累。 |
| **React Native + react-native-skia** | 低（Canvas/DOM 逻辑需用 RN + Skia API 重写） | 大（原生重写 + 学新 API） | 是 | 不推荐（当前阶段） | 性能上限高，但要重写渲染层与 UI，违背"先复用、后续再上 App"的诉求。 |
| **Flutter** | 零（Dart 全重写） | 最大 | 是 | 不推荐 | 语言栈（Dart）与团队（Go/Python/React）不匹配，全重写代价最高。 |
| **Tauri 2.0 Mobile** | 高（也是系统 WebView），但需引入 Rust | 中（Rust 工具链 + 移动端插件不齐） | 是 | 暂不推荐（观察） | 官方自称移动端"并非全部插件受支持""对开发体验不满意"，且强绑定 Rust，对纯前端团队增量成本偏高。 |

**核心结论**：在"网页优先、复用现有 Canvas 游戏代码、后续再上 App"的诉求下，**Capacitor 是增量成本最小、最贴合的方向**——它直接把你已有的 `dist/` 包进原生 WebView，Web 代码一行不改；Android 用系统 WebView（Chromium），iOS 用 WKWebView，Canvas 2D / WebGL 走的是与手机浏览器相同的 GPU 加速渲染。iOS 侧唯一的硬约束是"构建/签名/上架必须 macOS + Xcode"，与选型无关，可被云端 macOS CI 绕过。

---

## 1. 跨端方案选型

### 1.1 Capacitor（Ionic）—— WebView 包裹，推荐

官方定位：Capacitor 是一个把 Web 应用"装进原生 WebView"并暴露原生能力的桥（Native Bridge）。你的 Web 代码原样保留，构建产物被复制进原生工程。

- 接入方式（官方）：`npm i @capacitor/core`、`npm i -D @capacitor/cli` → `npx cap init`（生成 `capacitor.config`，其中 `webDir` 指向 Web 构建输出目录）→ `npx cap add android` / `npx cap add ios` → `npx cap sync`（把 Web 产物复制进原生工程）。
  - 来源：https://capacitorjs.com/docs/getting-started
- 与 React 的关系（官方）："Build native mobile apps with web technology and React"，"The compiled web assets will be copied into each Capacitor native platform"，原生工程位于独立的顶层目录（`ios/`、`android/`）。
  - 来源：https://capacitorjs.com/solution/react
- Android 侧运行时（官方）："Capacitor requires an Android WebView with Chrome version 60 or later"，"On Android 6, and 10+ Capacitor uses the Android System WebView"，最低支持 "API 23+ (Android 6 or later)"，通过 Android Studio 管理。
  - 来源：https://capacitorjs.com/docs/v7/android
- iOS 侧运行时：Capacitor 在 iOS 使用 **WKWebView**（系统 WebView）。
  - 来源：https://capacitorjs.com/docs/v7/ios
- 关键点：Capacitor 支持"Web"作为一等平台——同一份代码既能部署为普通网站/PWA，也能被包成 App，与"Web 优先"完全同构，不会产生"Web 版与 App 版分叉"。

### 1.2 React Native（+ react-native-skia）—— 原生重写

官方定位：RN "render to native platform UI"，"the app uses the same native platform APIs other apps do"，"rendered with native code"（不是 WebView）。哲学是 "Learn once, write anywhere"。
- 来源：https://reactnative.dev/
- 画布：RN 本身没有 HTML `<canvas>`，做 2D 游戏要用 **react-native-skia**（Shopify 维护）："High-performance 2d Graphics for React Native using Skia"，后端是 Metal/Vulkan。它提供的是 Skia 自己的 API，**不能直接复用 HTML Canvas 2D / WebGL 代码**。
  - 来源：https://github.com/Shopify/react-native-skia
- 结论：对"已有 Canvas 网页游戏"意味着**渲染层与 UI 都要重写**，还要学习 RN/Skia 的新 API。增量成本远高于 Capacitor。

### 1.3 Flutter —— 全重写

官方定位：Flutter 是"natively compiled, multi-platform applications from a single codebase"，用 **Dart** 语言，"compiles to ARM or Intel machine code as well as JavaScript"，覆盖 mobile/web/desktop/embedded。它有自己的渲染引擎（Skia/Impeller），不是 WebView。
- 来源：https://flutter.dev/
- 结论：语言栈（Dart）与团队（Go/Python + React/TS）不匹配，且**无法复用任何现有 HTML/CSS/JS/Canvas 代码**，全重写代价最高。

### 1.4 Tauri 2.0 Mobile —— Rust + 系统 WebView

- Tauri 2.0 已发布稳定版并支持 iOS/Android，但官方在发布博客中明确写出两点保留意见："On mobile not all of the official plugins are supported"（移动端并非全部官方插件受支持）、"We are not completely happy about the developer experience at the moment"（对当前移动端开发体验不完全满意）。
  - 来源：https://v2.tauri.app/blog/tauri-20/
- 前置要求（官方）：**Rust 必装**（"Tauri is built with Rust and requires it"）；iOS "macOS Only... iOS development requires Xcode and is only available on macOS"；Android 需 Android Studio + `JAVA_HOME` + Android SDK/NDK/Build-Tools。
  - 来源：https://v2.tauri.app/start/prerequisites/
- WebView 引擎（官方）：Windows=WebView2，**Android=Android WebView（系统 WebView）**，**macOS & iOS=WebKit（WKWebView）**，Linux=webkit2gtk。
  - 来源：https://v2.tauri.app/reference/webview-versions/
- 结论：渲染层同样复用系统 WebView（这点与 Capacitor 类似），但引入 Rust 工具链、移动端插件生态不完整、官方自评开发体验欠佳，对纯前端团队增量成本偏高。**可观察，不急于采用。**

### 1.5 纯 PWA（现状）

官方定义：PWA 是"web apps built and enhanced with modern APIs"，三大支柱是 capable、reliable、installable。
- 来源：https://web.dev/articles/what-are-pwas
- 结论：这是"Web 优先"的正确地基，应继续保留并强化（补离线缓存、补安装提示）。但它无法在 iOS 上提供与原生等同的分发、推送与数据持久性体验（详见第 6 节），因此在"用户主要靠手机、要一个 App"的刚需下，需用 Capacitor 补 App 形态。

---

## 2. Canvas 游戏在 WebView 里的性能

Capacitor 的 iOS（WKWebView）与 Android（Android System WebView）本质上是 Safari/Chromium 的嵌入式渲染器，Canvas 2D / WebGL 走的是与手机浏览器**相同的 GPU 加速合成路径**。这不是"重新实现的慢渲染器"。

### 2.1 硬件加速现状

- Android：硬件加速从 **API 11（Android 3.0）** 起进入 2D 渲染管线；当 `targetSdk >= 14` 时**默认开启**。所有 `View` 的 canvas 绘制操作都走 GPU。可对单个 View 用 `setLayerType(View.LAYER_TYPE_SOFTWARE, null)` 强制回退到软件渲染（但不能在 View 级开启硬件加速）。
  - 来源：https://developer.android.com/develop/ui/views/graphics/hardware-accel
- Android WebView：Capacitor 要求 "Android WebView with Chrome version 60 or later"，即运行时是随系统/商店更新的 Chromium 内核，GPU 能力与 Chrome 基本一致。
  - 来源：https://capacitorjs.com/docs/v7/android
- iOS WKWebView：Apple 官方 API 文档（WKWebView）将其定义为完整的网页渲染视图；WebGL/WebGL2 支持状态见 WebKit 官方功能状态追踪。
  - 来源：https://developer.apple.com/documentation/webkit/wkwebview 、 https://webkit.org/status/

### 2.2 已知坑（都有官方出处）

1. **requestAnimationFrame 在后台被暂停**：`requestAnimationFrame()` 在"后台标签页或隐藏 iframe"中会被浏览器暂停以省电。App 切到后台时 WebView 同样会暂停主循环，游戏需要监听 `visibilitychange` 恢复动画并处理时间差，否则角色会"瞬移"或状态漂移。
   - 来源：https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame
2. **音频自动播放被拦截**：
   - Chrome/Android WebView：**静音自动播放始终允许**；带声音的自动播放需要用户手势或较高的 Media Engagement Index（且播放时长需 > 7 秒）。开发时应"先 muted 自动播放、首次交互后再解锁声音"，并检查 `play()` 返回的 Promise 是否被拒。
     - 来源：https://developer.chrome.com/blog/autoplay/
   - WebKit/Safari（iOS WKWebView）：**默认阻止带声音的媒体自动播放**，"Websites should assume any use of `<video>` or `<audio>` requires a user gesture"；设 `muted` 属性可豁免。
     - 来源：https://webkit.org/blog/7734/auto-play-policy-changes-for-macos/
3. **触控延迟（300ms tap delay）**：现代移动浏览器在设置 `<meta name="viewport" width=device-width">` 后已消除 300ms 点击延迟；Capacitor 生成的 WebView 页面已带该 viewport，但需确保游戏内自定义手势不走默认的"双击缩放"路径。
   - 来源：https://developer.chrome.com/blog/300ms-tap-delay-gone-away
4. **WKWebView 的离屏/合成差异**：WKWebView 是独立进程渲染（out-of-process），动画/合成时序与 Safari 一致，但历史上存在"离屏 canvas / 大图合成"的边缘性能差异。官方层面的原则是：避免超大离屏 Canvas，优先用单个前台 Canvas + `requestAnimationFrame` 统一绘制（与现有渲染器做法一致）。

---

## 3. Capacitor + Vite 集成

### 3.1 官方推荐接入方式

对一个已有 `package.json` + 输出目录（`dist`）+ `index.html` 的项目，官方步骤就是：

1. `npm i @capacitor/core`、`npm i -D @capacitor/cli`
2. `npx cap init`（生成 `capacitor.config`，把 `webDir` 设为 `dist`）
3. `npx cap add android` / `npx cap add ios`
4. `npx cap sync`（把 `dist` 复制进原生工程并安装原生依赖）

- 来源：https://capacitorjs.com/docs/getting-started

### 3.2 开发工作流与 live reload

- 官方工作流：先在 Web 侧 `build`（得到 `dist`）→ `npx cap sync` → 真机 `npx cap run ios/android`（或 `npx cap open ios/android` 进 IDE）。"build your web app for distribution" 是每次把改动送进原生工程的必要步骤。
  - 来源：https://capacitorjs.com/docs/basics/workflow
- Live Reload：开发期可让原生 App 直接连到本地 Vite dev server（`capacitor.config` 里配置 `server.url`），实现改 Web 代码原生端热更新。
  - 来源：https://capacitorjs.com/docs/guides/live-reload

### 3.3 迁移量评估（对本项目）

- **要改的**：新增 `capacitor.config`、安装 `@capacitor/core` + `@capacitor/cli`、`npx cap add android`（/`ios`）生成原生壳目录、把 `webDir` 指向 `dist`、可能新增 Android 图标/启动屏资源。**游戏代码、React 组件、`vite.config.ts`、`netlify.toml` 均无需改动。**
- **对 Netlify 的影响：零**。Capacitor 的原生工程位于独立顶层目录（`android/`、`ios/`），读取的只是 `npm run build` 产出的 `dist/`；Netlify 仍以 `netlify.toml` 的 `command = "npm run build"`、`publish = "dist"` 发布 Web 版。二者并行不冲突。
  - 依据：https://capacitorjs.com/solution/react（"native projects exist in their own top-level folders"）

---

## 4. 安卓分发

### 4.1 APK vs AAB

- **AAB（Android App Bundle）是上架 Google Play 的发布格式**，把 APK 的生成与签名"推迟给 Google Play"；Play 用 AAB 生成并下发针对每台设备优化的 APK。
- **自 2021 年 8 月起，所有新应用上架 Google Play 必须使用 AAB**。
- 大应用限制：新应用 > 200 MB 必须用 Play Feature/Asset Delivery；压缩后总下载（Base + Configuration APK + feature）不得超过 4 GB；AAB 不支持 `*.obb` 扩展文件。
  - 来源：https://developer.android.com/guide/app-bundle

### 4.2 开发者账号费用

- 注册 Google Play 开发者账号需支付**一次性 US$25 注册费**（非年费）。
  - 来源：https://support.google.com/googleplay/android-developer/answer/6112435

### 4.3 签名要求

- 所有上架产物必须数字签名。Google 提供 **Play App Signing**：`App Signing Key` 由 Google 持有（终身不变，用于给最终用户签名），你只需用 `Upload Key`（本地 keystore 里）签名上传产物即可。
- 密钥有效期须 ≥ 25 年，且到期日须晚于 **2033-10-22**。Upload Key 丢失可向 Play 申请重置（不影响 App Signing Key）。
  - 来源：https://developer.android.com/studio/publish/app-signing

### 4.4 侧载（sideload）

- Android 允许从 Google Play 之外安装 APK（"Alternative distribution options" 为官方支持的路径之一）。因此可以先构建 APK 直接分发给目标用户/内测，无需先上架。
  - 来源：https://developer.android.com/distribute/marketing-tools/alternative-distribution
- 对"用户没有电脑、主要靠手机"的场景，侧载 APK 是快速验证的可行路径；正式面向大众再上 Play。

---

## 5. iOS 分发与"没有 Mac"的约束（关键）

### 5.1 官方硬性要求：必须有 macOS + Xcode

- Xcode 只能运行在 macOS 上（从 Mac App Store 下载，Apple 官方页面反复以 "all from your Mac" 表述）。没有 Windows/Linux 版本。
  - 来源：https://developer.apple.com/xcode/
- 官方分发文档：构建 iOS App 的起点是"create an archive of your app"——在 **Xcode** 中 Product > Archive，再用 Xcode 的 Organizer 进行 Distribute App、签名（"Xcode uses cloud-managed signing certificates to automatically code sign"）并上传 App Store Connect。**整条链路以 Xcode（macOS）为工具载体。**
  - 来源：https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases
- Tauri 官方对同一事实的表述（可交叉印证）："iOS development requires Xcode and is only available on macOS"。
  - 来源：https://v2.tauri.app/start/prerequisites/

**结论：本地构建/签名/上架 iOS App 必须有一台 Mac。** 这与选型（Capacitor / RN / Flutter / Tauri）无关——iOS 工具链本身被 Apple 锁死在 macOS 上。

### 5.2 Apple Developer Program 费用与能力

- **$99/年**（"$99 annual membership"），解锁：App Store 分发、**TestFlight**、App Store Connect、代码级技术支持等。免费账号只能在 Xcode 里用有限的 Personal Team（设备/App ID 7 天过期）。
  - 来源：https://developer.apple.com/programs/ 、 https://developer.apple.com/support/compare-memberships/

### 5.3 TestFlight 机制

- TestFlight 用于正式上架前 Beta 测试：可邀请 **最多 10,000 名外部测试者**、同时共享 **最多 100 个构建**、每个测试者最多 **30 台设备**；内部团队测试者上限 100 人。构建通过 App Store Connect 上传、经 App Review 批准后分发，测试者用 TestFlight App 安装。
  - 来源：https://developer.apple.com/testflight/

### 5.4 "无 Mac"时的替代路径（云端 macOS 构建）

虽然"本地必须 Mac"，但构建可以外包给**跑在 macOS 上的 CI**，开发者只需一台普通电脑 + Apple 账号 + 签名证书：

1. **GitHub Actions macOS runner**（GitHub 托管，自带 Xcode，官方支持）：在 `macos` runner 上执行 `xcodebuild`/`npx cap build ios` + 上传 App Store Connect。
   - 来源：https://docs.github.com/actions/using-github-hosted-runners/about-github-hosted-runners
2. **Codemagic**（面向 iOS/Android/Flutter/RN 的 CI/CD，官方宣传"用云端 Mac 构建 iOS，无需本地 Mac"）。
   - 来源：https://codemagic.io/start
3. **MacStadium / 其他专用 Mac 云**：按小时租用远程 Mac 主机，可完整运行 Xcode GUI（适合无法纯脚本化的场景）。

> 注意：云端构建只是解决"没有 Mac 硬件"，**Apple Developer Program（$99/年）+ 签名证书 + App Store Connect 账号仍然必须**，这部分无法绕过。

---

## 6. iOS 上的 PWA 现状（2025–2026）

### 6.1 安装到主屏幕

- iOS Safari 支持"把网站变成 App"添加到主屏幕（Add to Home Screen，即主屏幕 Web App）。
  - 来源：https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios
- 安装能力要求 Web App 具备 manifest 且满足可安装标准（web.dev 的 installable 标准）。
  - 来源：https://web.dev/articles/what-are-pwas

### 6.2 推送通知

- WebKit 官方（2025-03）：iOS/iPadOS 上**已支持主屏幕 Web App 的 Web Push**，并推出 **Declarative Web Push**（无需 Service Worker 即可订阅）。限制：**不允许静默推送**（所有推送必须可见），推送需用户把 App 加到主屏幕并授予权限。
  - 来源：https://webkit.org/blog/16535/meet-declarative-web-push/

### 6.3 存储被回收（关键坑）

- WebKit ITP 2.3（官方）：对 7 天内无用户交互的站点，**脚本可写的网站数据（含 localStorage/IndexedDB/Service Worker 缓存）会被删除**（"After seven days of Safari use without the user interacting with a webpage on website.example, all of website.example's non-cookie website data is deleted"）。
  - 来源：https://webkit.org/blog/9521/intelligent-tracking-prevention-2-3/
- 含义：雯宝的存档目前全部在 `localStorage`，在 iOS 主屏幕 Web App 场景下，**若用户 7 天不打开，存档有被系统回收的风险**——这是"iOS 上用 PWA 做陪伴类游戏"最需要警惕的点，也是上原生 App（Capacitor，可改用原生文件/键值存储持久化）的强理由。

### 6.4 EU 地区的政策波动（风险提示）

- 2024 年初 Apple 曾宣布在 EU（为配合 DMA）移除 iOS 17.4 的主屏幕 Web App，引发社区强烈反对后于 2024 年 3 月**撤回**，继续保留主屏幕 Web App 能力。EU 仍是浏览器引擎/Web App 政策最不稳定的地区。
  - 来源：https://www.apple.com/newsroom/2024/01/apple-announces-changes-to-ios-safari-and-the-app-store-in-the-european-union/ 、 https://developer.apple.com/support/apps-in-the-eu/

---

## 7. Tauri 2.0 移动端成熟度

- **状态：iOS/Android 已随 2.0 稳定版发布，但官方自评为"移动端尚未到完全顺手"**。官方原话两点保留：移动端"并非全部官方插件受支持"、"对当前开发体验不完全满意"。
  - 来源：https://v2.tauri.app/blog/tauri-20/
- **硬门槛**：必须 Rust；iOS 必须 macOS + Xcode；Android 需 Android Studio + SDK/NDK + JDK。
  - 来源：https://v2.tauri.app/start/prerequisites/
- 移动端渲染：Android 用系统 WebView、iOS 用 WKWebView（与 Capacitor 同源），但移动端插件/DX 不如 Capacitor 成熟。
  - 来源：https://v2.tauri.app/reference/webview-versions/
- **结论**：Tauri 2.0 移动端"能用但不建议作为本项目的首选"。它在桌面端（Windows/macOS/Linux 小体积、Rust 后端）优势明显，但本项目是移动端优先的纯前端游戏，引入 Rust 收益低、成本高。

---

## 8. 针对"Web > Android > iOS"优先级的落地建议清单

### 第 0 步（现在，Web 优先，零成本）
- 保持并强化 PWA：给 `public/manifest.webmanifest` 补全 `purpose: "any maskable"` 对应的 PNG 图标（iOS 不支持 SVG 图标，需 PNG）、补一个最小离线缓存策略（Workbox/手写 Service Worker），让"加到主屏幕"在 iOS 上体验更好。
  - 依据：https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios 、 https://web.dev/articles/what-are-pwas
- 处理音频策略：游戏音效改为"首次交互后解锁 + muted 自动播放兜底"，避免 iOS/Android WebView 自动播放被拦。
  - 依据：https://developer.chrome.com/blog/autoplay/ 、 https://webkit.org/blog/7734/auto-play-policy-changes-for-macos/

### 第 1 步（Android App，优先补）
1. `npm i @capacitor/core` + `npm i -D @capacitor/cli`，`npx cap init`，`webDir = "dist"`。
2. `npx cap add android`，`npx cap sync`。
3. 生成 release keystore（有效期 ≥ 25 年、到期日 > 2033-10-22），用 Play App Signing 的 Upload Key 签名 AAB。
   - 依据：https://developer.android.com/studio/publish/app-signing
4. 先 **sideload APK** 给目标用户内测（无需上架），验证"手机主体验"后再决定是否上 Play（一次性 $25）。
   - 依据：https://developer.android.com/distribute/marketing-tools/alternative-distribution 、 https://support.google.com/googleplay/android-developer/answer/6112435

### 第 2 步（iOS App，最后、且受"无 Mac"约束）
1. 注册 Apple Developer Program（$99/年）。
   - 依据：https://developer.apple.com/programs/
2. 无本地 Mac → 用 **GitHub Actions macOS runner**（或 Codemagic）跑 `npx cap add ios` + `xcodebuild` 构建 + 签名 + 上传 App Store Connect。
   - 依据：https://docs.github.com/actions/using-github-hosted-runners/about-github-hosted-runners 、 https://codemagic.io/start
3. 用 **TestFlight** 做 Beta（最多 10,000 外部测试者）→ 提审上架。
   - 依据：https://developer.apple.com/testflight/

### 落地红线（必须记住的坑）
1. **iOS 的"无 Mac"不是选型问题，是工具链硬约束**：无论用 Capacitor 还是别的，iOS 构建/签名/上架都绕不开 macOS + Xcode（或云端 macOS CI），且 $99/年 + 证书一个都不能少。
2. **iOS PWA 的 7 天存储回收**：纯 PWA 形态下 `localStorage` 存档可能被 Safari 回收；上原生 App 后应改用原生持久化（Capacitor 的 Preferences/Filesystem），避免玩家 7 天没上线就丢档。
3. **WebView 的音频与后台动画**：自动播放需用户手势、后台 `requestAnimationFrame` 会暂停，游戏要在首次交互后解锁音频、并监听 `visibilitychange` 恢复循环。
