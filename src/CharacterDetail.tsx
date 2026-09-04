import { wenbebi } from "./game/data/pet";

export function CharacterDetail() {
  return (
    <main className="character-detail">
      <div className="character-detail__glow" aria-hidden="true" />
      <header className="character-detail__header">
        <a className="character-detail__back" href="./" aria-label="返回小屋">←</a>
        <span>角色详情</span>
        <span aria-hidden="true" />
      </header>
      <section className="character-detail__hero">
        <div className="character-detail__avatar">
          <img src={`assets/${wenbebi.sprites.idle}.webp`} alt={`桌面宠物${wenbebi.name}`} />
        </div>
        <p className="character-detail__eyebrow">小屋里的陪伴者</p>
        <h1>{wenbebi.name}</h1>
        <p className="character-detail__tagline">小屋 · 在这里陪你</p>
      </section>
      <section className="character-detail__card" aria-label="雯宝介绍">
        <h2>关于雯宝</h2>
        <p>她喜欢在小屋里发呆、散步，也喜欢你偶尔来摸摸头。每天的相处，都会慢慢变成你们共同的生活。</p>
      </section>
      <section className="character-detail__card" aria-label="雯宝状态">
        <h2>现在的状态</h2>
        <div className="character-detail__stats">
          <span><b>心情</b><strong>100</strong></span>
          <span><b>亲密</b><strong>443</strong></span>
          <span><b>精力</b><strong>100</strong></span>
          <span><b>饱腹</b><strong>0</strong></span>
        </div>
      </section>
      <a className="character-detail__return" href="./">回到小屋</a>
    </main>
  );
}
