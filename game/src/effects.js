// Particles, skid marks, floating text and screen shake. Purely visual;
// nothing here touches game rules.

export class Effects {
  constructor() {
    this.particles = [];
    this.skids = [];
    this.texts = [];
    this.shake = 0;
    this.shakeX = 0;
    this.shakeY = 0;
  }

  burst(x, y, n, color, speed = 180, life = 0.7, size = 4) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 20 + Math.random() * (speed - 20);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: life * (0.5 + Math.random() * 0.5), maxLife: life,
        size: size * (0.5 + Math.random() * 0.9), color,
      });
    }
    if (this.particles.length > 600) this.particles.splice(0, this.particles.length - 600);
  }

  smoke(x, y, n = 6) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: x + (Math.random() * 16 - 8), y: y + (Math.random() * 16 - 8),
        vx: Math.random() * 30 - 15, vy: -10 - Math.random() * 30,
        life: 0.8 + Math.random() * 0.8, maxLife: 1.6,
        size: 8 + Math.random() * 8, color: '#5a5a5a', smoke: true,
      });
    }
  }

  explosion(x, y) {
    this.burst(x, y, 42, '#ff9a2a', 320, 0.9, 6);
    this.burst(x, y, 26, '#ffd23e', 220, 0.6, 5);
    this.burst(x, y, 18, '#3a3a3a', 120, 1.4, 9);
    this.smoke(x, y, 10);
    this.addShake(14);
  }

  muzzle(x, y, angle) {
    this.burst(x + Math.cos(angle) * 14, y + Math.sin(angle) * 14, 4, '#ffd23e', 260, 0.15, 3);
  }

  blood(x, y) {
    this.burst(x, y, 10, '#a02020', 140, 0.5, 3);
  }

  addSkid(x, y, angle) {
    this.skids.push({ x, y, angle, life: 6 });
    if (this.skids.length > 500) this.skids.splice(0, this.skids.length - 500);
  }

  floatText(x, y, text, color = '#ffffff') {
    this.texts.push({ x, y, text, color, life: 1.4 });
  }

  addShake(amount) {
    this.shake = Math.max(this.shake, amount);
  }

  update(dt) {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const s of this.skids) s.life -= dt;
    this.skids = this.skids.filter((s) => s.life > 0);
    for (const t of this.texts) {
      t.y -= 34 * dt;
      t.life -= dt;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 30);
      this.shakeX = (Math.random() * 2 - 1) * this.shake;
      this.shakeY = (Math.random() * 2 - 1) * this.shake;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  draw(ctx) {
    // Skid marks lie flat on the road.
    for (const s of this.skids) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      ctx.globalAlpha = Math.min(0.5, s.life * 0.2);
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(-7, -2.5, 14, 5);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    for (const p of this.particles) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = p.smoke ? a * 0.45 : a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (p.smoke ? 1 + (1 - a) : 1), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const t of this.texts) {
      ctx.globalAlpha = Math.min(1, t.life);
      ctx.font = 'bold 17px Verdana, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#111';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
}
