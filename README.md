# 雯宝

浏览器里的陪伴小世界。打开就能看见雯宝在小屋、阳台、街区和咖啡店里生活；点她、点家具、出门、布置房间，今天的事会留在这个浏览器里。

技术栈是 React、TypeScript 和 Vite。它是网页，不是要单独安装的桌面程序。

## 先装 Node.js

`npm install` 和 `npm run dev` 这两条命令是对的。如果终端提示 `zsh: command not found: npm`，是这台电脑还没装 Node.js，npm 会跟着 Node 一起装上。

本仓库锁定的 Vite 需要 **Node.js 20.19 及以上，或 22.12 及以上**。

macOS 上如果已经有 [Homebrew](https://brew.sh)：

```bash
brew install node
node -v
npm -v
```

两条版本命令都能打出数字后，关掉当前终端再开一个，然后回到项目目录。

还没有 Homebrew 时，去 [nodejs.org](https://nodejs.org) 安装标为 LTS 的版本，装完同样新开一个终端。

## 本地运行

```bash
npm install
npm run dev
```

浏览器打开终端里打印的地址，一般是 http://localhost:5173 。

看构建后的页面：

```bash
npm run build
npm run preview
```

进度、房间布置、花园、照片和生活小记都写在**当前浏览器**的 localStorage 里。换浏览器、开无痕窗口，或清除这个站点的数据，存档会消失。

## 怎么玩

- 点地板：雯宝走过去
- 点她：摸头、挥手；连点会开心跳
- 拖起来再放下：落地；从很高的地方摔下会晕一下
- 点家具：她先走过去，再坐下、睡觉、吃点心或听唱片
- 拖小球再松开：她会去捡；连续接住三次会留下纪念
- 点门口、楼梯或路口：她先走到出口，再去下一个地方
- 底栏「布置」：拖动家具，角色和小球不受影响
- 底栏「回忆」：放进最多 6 张照片，并查看生活小记

电脑上也可以用方向键或 `A` / `D` 走动，空格或 `W` 跳跃，`S` / `E` 坐下，`Q` 睡觉，`F` 丢球。手机上双指可以平移看房间，不改变游戏状态。

手机浏览器可以用「添加到主屏幕」单独打开。清单和图标在 `public/manifest.webmanifest`、`public/icon.svg`。当前不缓存离线页面，发布后会用到最新版本。

## 改内容从哪下手

新台词、新家具、新的「今天在做什么」，优先改数据，不要先改运行逻辑。

- `src/game/data/pet.js`：名字、动作图、台词
- `src/game/data/room.js`：房间里的物件和点下去会发生什么
- `src/game/data/today-stories.js`：每天进小屋时的生活片段
- `src/game/data/controls.js`：更多菜单里的动作按钮
- `public/assets`：页面里用的图片，路径写成 `assets/...`

只有出现新的玩法机制时，才改 `src/game` 里的运行时代码。界面、布置和回忆录在 `src/App.tsx`。

地址加上 `?studio` 会打开角色调试页，例如 http://localhost:5173/?studio 。

产品方向和后续顺序写在：

- [docs/product-charter.md](docs/product-charter.md)
- [docs/current-state-and-next.md](docs/current-state-and-next.md)

## 发布

Netlify 执行 `npm run build`，发布 `dist` 目录。配置见 `netlify.toml`。
