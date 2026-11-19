// Neon Coast cover engine — draws a multi-panel sunset-neon cover onto any
// canvas. Every panel holds one user photo (never uploaded anywhere); the
// engine crops it cover-style, grades it, then letters the title on top.
//
// A "state" looks like:
//   { layout: 'hero' | 'duo' | 'quad' | 'trio',
//     panels: [{ img, zoom, ox, oy }],   // img is an HTMLImageElement or null
//     title: string, subtitle: string,
//     titleScale: number,                // 0.6 .. 1.4, relative to default
//     style: 'solid' | 'outline' | 'neon',
//     grade: 'sunset' | 'neon' | 'gold' | 'teal' }

export const LAYOUTS = {
  hero: { label: 'Hero', slots: 1 },
  duo: { label: 'Duo', slots: 2 },
  quad: { label: 'Quad', slots: 4 },
  trio: { label: 'Trio', slots: 3 },
};

const GRADES = {
  sunset: { top: 'rgba(255, 150, 70, 0.10)', mid: 'rgba(255, 90, 90, 0.16)', low: 'rgba(190, 30, 130, 0.34)', accent: '#ff5e7a', frame: '#ffb347' },
  neon: { top: 'rgba(60, 220, 255, 0.08)', mid: 'rgba(160, 60, 255, 0.18)', low: 'rgba(255, 30, 160, 0.38)', accent: '#ff2fb3', frame: '#37e6ff' },
  gold: { top: 'rgba(255, 210, 90, 0.12)', mid: 'rgba(255, 150, 40, 0.18)', low: 'rgba(160, 70, 10, 0.30)', accent: '#ffd166', frame: '#ffe9a8' },
  teal: { top: 'rgba(40, 200, 190, 0.10)', mid: 'rgba(20, 120, 160, 0.20)', low: 'rgba(8, 30, 70, 0.42)', accent: '#4ef0d0', frame: '#9ff5e4' },
};

/** Panel rectangles for a layout, in canvas pixels. Gaps stay dark. */
export function panelRects(layout, w, h) {
  const gap = Math.max(6, Math.round(w * 0.008));
  const half = (w - gap) / 2;
  const third = (h - gap) / 3;
  switch (layout) {
    case 'duo':
      return [
        { x: 0, y: 0, w: half, h },
        { x: half + gap, y: 0, w: half, h },
      ];
    case 'quad':
      return [
        { x: 0, y: 0, w: half, h: (h - gap) / 2 },
        { x: half + gap, y: 0, w: half, h: (h - gap) / 2 },
        { x: 0, y: (h - gap) / 2 + gap, w: half, h: (h - gap) / 2 },
        { x: half + gap, y: (h - gap) / 2 + gap, w: half, h: (h - gap) / 2 },
      ];
    case 'trio':
      return [
        { x: 0, y: 0, w, h: third * 2 },
        { x: 0, y: third * 2 + gap, w: half, h: third },
        { x: half + gap, y: third * 2 + gap, w: half, h: third },
      ];
    case 'hero':
    default:
      return [{ x: 0, y: 0, w, h }];
  }
}

function drawPhoto(ctx, rect, panel) {
  const img = panel?.img;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  if (!img) {
    // Empty slot: a dusk gradient with a dashed hint frame.
    const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    g.addColorStop(0, '#3a2350');
    g.addColorStop(1, '#120a1e');
    ctx.fillStyle = g;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.setLineDash([14, 10]);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.x + 14, rect.y + 14, rect.w - 28, rect.h - 28);
    ctx.setLineDash([]);
    ctx.restore();
    return;
  }
  const zoom = panel.zoom ?? 1;
  const scale = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const ox = (panel.ox ?? 0) * rect.w * 0.25;
  const oy = (panel.oy ?? 0) * rect.h * 0.25;
  ctx.filter = 'saturate(1.28) contrast(1.1) brightness(1.03)';
  ctx.drawImage(img, rect.x + (rect.w - dw) / 2 + ox, rect.y + (rect.h - dh) / 2 + oy, dw, dh);
  ctx.filter = 'none';
  ctx.restore();
}

function gradeWash(ctx, w, h, grade) {
  const wash = ctx.createLinearGradient(0, 0, 0, h);
  wash.addColorStop(0, grade.top);
  wash.addColorStop(0.55, grade.mid);
  wash.addColorStop(1, grade.low);
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = wash;
  ctx.globalAlpha = 0.45;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;
  // Vignette: darker corners pull the eye to the middle.
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(10,0,20,0.38)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

function fitFont(ctx, text, maxWidth, startSize) {
  let size = startSize;
  ctx.font = `900 ${size}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
  while (size > 14 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `900 ${size}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
  }
  return size;
}

function drawLettering(ctx, w, h, state, grade) {
  const title = (state.title || '').trim().toUpperCase();
  const subtitle = (state.subtitle || '').trim().toUpperCase();
  const base = h * 0.105 * (state.titleScale ?? 1);
  const bottom = h * 0.055;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  if (subtitle) {
    const subSize = Math.max(16, Math.round(h * 0.028));
    ctx.font = `700 ${subSize}px "Helvetica Neue", Arial, sans-serif`;
    const subY = h - bottom - base - h * 0.045;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = subSize * 0.35;
    // Manual tracking: draw the subtitle letter by letter, spaced out.
    const spaced = subtitle.split('').join('  ');
    const tw = ctx.measureText(spaced).width;
    ctx.fillText(spaced, w / 2, subY);
    ctx.shadowBlur = 0;
    void tw;
  }

  if (!title) return;
  const size = fitFont(ctx, title, w * 0.92, base);
  const y = h - bottom;
  ctx.lineJoin = 'round';
  if (state.style === 'neon') {
    ctx.shadowColor = grade.accent;
    ctx.shadowBlur = size * 0.45;
    ctx.strokeStyle = grade.accent;
    ctx.lineWidth = Math.max(2, size * 0.045);
    ctx.strokeText(title, w / 2, y);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(title, w / 2, y);
    ctx.shadowBlur = 0;
  } else if (state.style === 'outline') {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2, size * 0.07);
    ctx.strokeText(title, w / 2, y);
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = size * 0.18;
    ctx.fillStyle = 'rgba(20,4,30,0.55)';
    ctx.fillText(title, w / 2, y);
    ctx.shadowBlur = 0;
  } else {
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = size * 0.22;
    ctx.lineWidth = Math.max(2, size * 0.09);
    ctx.strokeStyle = 'rgba(20,4,30,0.85)';
    ctx.strokeText(title, w / 2, y);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(title, w / 2, y);
    ctx.shadowBlur = 0;
  }
}

/** Draws the whole cover for `state` onto `canvas` (uses its own pixel size). */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const grade = GRADES[state.grade] || GRADES.sunset;
  ctx.fillStyle = '#120a1e';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < (LAYOUTS[state.layout]?.slots ?? 1); i += 1) {
    drawPhoto(ctx, panelRects(state.layout, w, h)[i], state.panels[i]);
  }
  gradeWash(ctx, w, h, grade);
  // Neon frame: two hairlines hugging the edge.
  const inset = Math.max(10, Math.round(w * 0.014));
  ctx.strokeStyle = grade.frame;
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = Math.max(2, w * 0.004);
  ctx.shadowColor = grade.accent;
  ctx.shadowBlur = w * 0.012;
  ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  drawLettering(ctx, w, h, state, grade);
}
