export class FX {
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
      heart: { n: 12, color: ["#e56f82", "#ffb1bd", "#fff0f1", "#d94f6b"], life: 1.25, size: 11, up: true, heart: true },
      sparkle: { n: 10, color: ["#f4c76d", "#fff5c9", "#ef9c77"], life: 0.9, size: 7, up: true, sparkle: true },
      dust: { n: 8, color: ["#c4a882", "#e6d3b5"], life: 0.45, size: 4, up: false },
      star: { n: 6, color: ["#f0d27a", "#fff4c8"], life: 0.7, size: 5, up: true },
      zzz: { n: 1, color: ["#7a6a5c"], life: 1.4, size: 12, up: true, text: "z" },
    };
    const spec = specs[kind] || specs.dust;
    for (let i = 0; i < spec.n; i += 1) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 24,
        y: y + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * (spec.up ? 76 : 70),
        vy: spec.up ? -58 - Math.random() * 82 : -10 - Math.random() * 20,
        life: spec.life,
        max: spec.life,
        size: spec.size + Math.random() * 4,
        color: spec.color[i % spec.color.length],
        text: spec.text || "",
        heart: spec.heart || false,
        sparkle: spec.sparkle || false,
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
      } else if (p.heart) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.sin(p.life * 8) * 0.15);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        const s = p.size * Math.min(1, a * 1.45);
        ctx.moveTo(0, s * 0.9);
        ctx.bezierCurveTo(-s * 1.3, s * 0.05, -s * 0.8, -s, 0, -s * 0.34);
        ctx.bezierCurveTo(s * 0.8, -s, s * 1.3, s * 0.05, 0, s * 0.9);
        ctx.fill();
        ctx.restore();
      } else if (p.sparkle) {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        const s = p.size * a;
        ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x + s * 0.42, p.y - s * 0.42);
        ctx.lineTo(p.x + s, p.y); ctx.lineTo(p.x + s * 0.42, p.y + s * 0.42);
        ctx.lineTo(p.x, p.y + s); ctx.lineTo(p.x - s * 0.42, p.y + s * 0.42);
        ctx.lineTo(p.x - s, p.y); ctx.lineTo(p.x - s * 0.42, p.y - s * 0.42);
        ctx.closePath(); ctx.fill();
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
