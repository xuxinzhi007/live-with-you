window.FX = class FX {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.particles = [];
  }

  resize(worldW, worldH) {
    this.canvas.width = worldW;
    this.canvas.height = worldH;
    this.canvas.style.width = `${worldW}px`;
    this.canvas.style.height = `${worldH}px`;
  }

  burst(x, y, kind) {
    const specs = {
      heart: { n: 7, color: ["#e58b8b", "#f3b6b6", "#d46a6a"], life: 0.9, size: 7, up: true },
      dust: { n: 8, color: ["#c4a882", "#e6d3b5"], life: 0.45, size: 4, up: false },
      star: { n: 6, color: ["#f0d27a", "#fff4c8"], life: 0.7, size: 5, up: true },
      zzz: { n: 1, color: ["#7a6a5c"], life: 1.4, size: 12, up: true, text: "z" },
    };
    const spec = specs[kind] || specs.dust;
    for (let i = 0; i < spec.n; i += 1) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 24,
        y: y + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * (spec.up ? 40 : 70),
        vy: spec.up ? -40 - Math.random() * 50 : -10 - Math.random() * 20,
        life: spec.life,
        max: spec.life,
        size: spec.size + Math.random() * 4,
        color: spec.color[i % spec.color.length],
        text: spec.text || "",
      });
    }
  }

  update(dt) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.particles = this.particles.filter((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.text ? -20 : 40) * dt;
      const a = Math.max(0, p.life / p.max);
      if (p.text) {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.font = "16px Georgia, serif";
        ctx.fillText("z", p.x, p.y);
      } else {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      return p.life > 0;
    });
  }
};
