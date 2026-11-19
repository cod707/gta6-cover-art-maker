// Vice City Cover Maker — the cover engine. Draws a multi-panel poster from the
// user's own photos onto any 2D canvas, at any export size. Everything is drawn
// with the canvas API and the system font stack: no downloaded fonts, no
// third-party artwork, no network request of any kind.
//
// A cover state looks like:
//   { layout: 'trio', size: '1080x1080',
//     panels: [ { photo: <HTMLImageElement|null>, zoom: 1.2, ox: 0, oy: 0 }, ... ],
//     title: 'BOULEVARD QUEEN', subtitle: 'A VICE CITY STORY',
//     lettering: 'sunset' | 'neon' | 'bold', titlePos: 'bottom' | 'top',
//     grade: 'sunset' | 'neon' | 'pastel' | 'noir' }

/** Panel layouts, as fractions of the cover: x, y, width, height. */
export const LAYOUTS = {
  hero: {
    label: 'Hero — one big photo',
    panels: [{ x: 0, y: 0, w: 1, h: 1 }],
  },
  split: {
    label: 'Split — two tall panels',
    panels: [
      { x: 0, y: 0, w: 0.5, h: 1 },
      { x: 0.5, y: 0, w: 0.5, h: 1 },
    ],
  },
  trio: {
    label: 'Trio — hero plus two stacked',
    panels: [
      { x: 0, y: 0, w: 0.62, h: 1 },
      { x: 0.62, y: 0, w: 0.38, h: 0.5 },
      { x: 0.62, y: 0.5, w: 0.38, h: 0.5 },
    ],
  },
  grid: {
    label: 'Grid — four panels',
    panels: [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
};

/** The three post sizes the bounty asks for. */
export const SIZES = {
  '1080x1080': { w: 1080, h: 1080, label: 'Square · 1080 × 1080' },
  '1080x1350': { w: 1080, h: 1350, label: 'Portrait · 1080 × 1350' },
  '1920x1080': { w: 1920, h: 1080, label: 'Wide · 1920 × 1080' },
};

/** Sunset / neon colour grades, as canvas filter + overlay washes. */
export const GRADES = {
  sunset: {
    label: 'Sunset',
    filter: 'saturate(1.3) contrast(1.08) brightness(1.02)',
    washes: [
      { x0: 0, y0: 0, x1: 0, y1: 1, stops: [[0, 'rgba(255,120,40,0)'], [0.55, 'rgba(255,90,60,0.10)'], [1, 'rgba(190,30,110,0.42)']] },
      { x0: 0, y0: 0, x1: 1, y1: 0, stops: [[0, 'rgba(255,190,80,0.10)'], [1, 'rgba(255,190,80,0)']] },
    ],
  },
  neon: {
    label: 'Neon Night',
    filter: 'saturate(1.45) contrast(1.14) brightness(0.96)',
    washes: [
      { x0: 0, y0: 0, x1: 1, y1: 1, stops: [[0, 'rgba(0,220,255,0.16)'], [0.5, 'rgba(0,0,0,0)'], [1, 'rgba(255,0,160,0.22)']] },
      { x0: 0, y0: 0, x1: 1, y1: 1, stops: [[0, 'rgba(20,0,60,0.18)'], [1, 'rgba(20,0,60,0)']] },
    ],
  },
  pastel: {
    label: 'Pastel Dawn',
    filter: 'saturate(1.05) contrast(0.98) brightness(1.08)',
    washes: [
      { x0: 0, y0: 0, x1: 0, y1: 1, stops: [[0, 'rgba(255,210,220,0.20)'], [1, 'rgba(255,170,120,0.16)']] },
    ],
  },
  noir: {
    label: 'Noir',
    filter: 'grayscale(1) contrast(1.18) brightness(0.94)',
    washes: [
      { x0: 0, y0: 0, x1: 0, y1: 1, stops: [[0, 'rgba(0,0,0,0.10)'], [1, 'rgba(0,0,0,0.38)']] },
    ],
  },
};

/** Lettering styles for the caption, all drawn from the system font stack. */
export const LETTERINGS = {
  sunset: { label: 'Sunset gradient', fill: 'gradient', stroke: '#2b0a2e', glow: 'rgba(255,90,40,0.55)' },
  neon: { label: 'Neon glow', fill: '#ffffff', stroke: '#12002e', glow: 'rgba(0,229,255,0.9)' },
  bold: { label: 'Bold white', fill: '#ffffff', stroke: '#111111', glow: 'rgba(0,0,0,0.45)' },
};

const FONT_STACK = '"Arial Black", "Helvetica Neue", Arial, sans-serif';
const SUB_STACK = '"Helvetica Neue", Arial, sans-serif';

let grainTile = null;
/** A small tiled noise pattern, generated once, for the film-grain finish. */
function getGrainTile() {
  if (grainTile) return grainTile;
  const tile = document.createElement('canvas');
  tile.width = 140;
  tile.height = 140;
  const tctx = tile.getContext('2d');
  const img = tctx.createImageData(140, 140);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 22;
  }
  tctx.putImageData(img, 0, 0);
  grainTile = tile;
  return grainTile;
}

/** Draws one photo into a panel rect, cover-fit, with the panel's zoom and pan. */
function drawPanelPhoto(ctx, rect, panel, grade) {
  const { photo, zoom = 1, ox = 0, oy = 0 } = panel;
  if (!photo) return;
  const pw = rect.w;
  const ph = rect.h;
  const base = Math.max(pw / photo.naturalWidth, ph / photo.naturalHeight);
  const scale = base * Math.max(0.5, zoom);
  const dw = photo.naturalWidth * scale;
  const dh = photo.naturalHeight * scale;
  // ox / oy shift the photo inside the panel, from -1 (one edge) to 1 (the other).
  const dx = rect.x + (pw - dw) / 2 + ox * Math.max(0, (dw - pw) / 2);
  const dy = rect.y + (ph - dh) / 2 + oy * Math.max(0, (dh - ph) / 2);
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, pw, ph);
  ctx.clip();
  ctx.filter = grade.filter;
  ctx.drawImage(photo, dx, dy, dw, dh);
  ctx.restore();
}

/** Fits the title on one line, then draws title + subtitle with the lettering style. */
function drawCaption(ctx, w, h, state) {
  const title = (state.title || '').trim().toUpperCase();
  const subtitle = (state.subtitle || '').trim().toUpperCase();
  if (!title && !subtitle) return;
  const style = LETTERINGS[state.lettering] || LETTERINGS.sunset;
  const atTop = state.titlePos === 'top';
  const bandH = h * 0.24;
  const bandY = atTop ? 0 : h - bandH;

  // A soft dark band so the lettering reads on any photo.
  const band = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
  if (atTop) {
    band.addColorStop(0, 'rgba(10,2,20,0.72)');
    band.addColorStop(1, 'rgba(10,2,20,0)');
  } else {
    band.addColorStop(0, 'rgba(10,2,20,0)');
    band.addColorStop(1, 'rgba(10,2,20,0.78)');
  }
  ctx.fillStyle = band;
  ctx.fillRect(0, bandY, w, bandH);

  const cx = w / 2;
  const titleBaseline = atTop ? bandY + h * 0.115 : h - h * 0.075;
  const subBaseline = atTop ? bandY + h * 0.175 : h - h * 0.028;

  if (title) {
    let size = Math.min(h * 0.115, w * 0.16);
    ctx.font = `900 ${size}px ${FONT_STACK}`;
    while (ctx.measureText(title).width > w * 0.92 && size > 14) {
      size -= 2;
      ctx.font = `900 ${size}px ${FONT_STACK}`;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.shadowColor = style.glow;
    ctx.shadowBlur = size * 0.35;
    ctx.lineWidth = Math.max(2, size * 0.14);
    ctx.strokeStyle = style.stroke;
    ctx.strokeText(title, cx, titleBaseline);
    if (style.fill === 'gradient') {
      const grad = ctx.createLinearGradient(0, titleBaseline - size, 0, titleBaseline + size * 0.12);
      grad.addColorStop(0, '#ffe259');
      grad.addColorStop(0.45, '#ff7e3d');
      grad.addColorStop(0.75, '#ff2e88');
      grad.addColorStop(1, '#b537f2');
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = style.fill;
    }
    ctx.fillText(title, cx, titleBaseline);
    ctx.shadowBlur = 0;
  }

  if (subtitle) {
    const size = Math.min(h * 0.038, w * 0.05);
    ctx.font = `700 ${size}px ${SUB_STACK}`;
    try {
      ctx.letterSpacing = `${Math.round(size * 0.35)}px`;
    } catch {
      // letterSpacing is Chromium-only; the subtitle still draws without it.
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = size * 0.3;
    ctx.lineWidth = Math.max(1, size * 0.12);
    ctx.strokeStyle = 'rgba(10,2,20,0.9)';
    ctx.strokeText(subtitle, cx, subBaseline);
    ctx.fillStyle = '#ffe9f4';
    ctx.fillText(subtitle, cx, subBaseline);
    ctx.shadowBlur = 0;
    try {
      ctx.letterSpacing = '0px';
    } catch {
      // ignore
    }
  }
}

/** Draws the whole cover onto `canvas` (at its own pixel size) from a cover state. */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const layout = LAYOUTS[state.layout] || LAYOUTS.trio;
  const grade = GRADES[state.grade] || GRADES.sunset;
  const gutter = Math.max(2, Math.round(Math.min(w, h) * 0.006));

  // Backdrop: deep plum, so empty panels read as part of the poster.
  ctx.fillStyle = '#1c0b2e';
  ctx.fillRect(0, 0, w, h);

  layout.panels.forEach((p, i) => {
    const rect = {
      x: p.x * w + (p.x > 0 ? gutter / 2 : 0),
      y: p.y * h + (p.y > 0 ? gutter / 2 : 0),
      w: p.w * w - (p.x > 0 ? gutter / 2 : 0) - (p.x + p.w < 1 ? gutter / 2 : 0),
      h: p.h * h - (p.y > 0 ? gutter / 2 : 0) - (p.y + p.h < 1 ? gutter / 2 : 0),
    };
    const panel = state.panels[i] || {};
    if (panel.photo) {
      drawPanelPhoto(ctx, rect, panel, grade);
    } else {
      // Empty panel: a diagonal sunset placeholder so the layout still reads.
      const ph = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
      ph.addColorStop(0, '#3d1454');
      ph.addColorStop(0.5, '#7a1e6e');
      ph.addColorStop(1, '#ff6a3d');
      ctx.fillStyle = ph;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = `700 ${Math.max(12, Math.round(rect.w * 0.045))}px ${SUB_STACK}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ADD A PHOTO', rect.x + rect.w / 2, rect.y + rect.h / 2);
    }
  });

  // White poster frame + hairline inner border.
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(3, Math.round(Math.min(w, h) * 0.008));
  ctx.strokeRect(
    ctx.lineWidth / 2,
    ctx.lineWidth / 2,
    w - ctx.lineWidth,
    h - ctx.lineWidth,
  );
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = Math.max(1, Math.round(Math.min(w, h) * 0.0015));
  const inset = Math.max(8, Math.round(Math.min(w, h) * 0.02));
  ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);

  // Colour grade washes over the whole poster.
  for (const wash of grade.washes) {
    const g = ctx.createLinearGradient(
      wash.x0 * w, wash.y0 * h, wash.x1 * w, wash.y1 * h,
    );
    for (const [stop, color] of wash.stops) g.addColorStop(stop, color);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  // Vignette: darken the corners so the centre pops.
  const vig = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.35,
    w / 2, h / 2, Math.max(w, h) * 0.75,
  );
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(10,0,20,0.38)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  // Film grain.
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = ctx.createPattern(getGrainTile(), 'repeat');
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  drawCaption(ctx, w, h, state);
}

/** Renders a cover state to a fresh canvas at the named export size. */
export function renderCover(state, sizeKey) {
  const size = SIZES[sizeKey] || SIZES['1080x1080'];
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  drawCover(canvas, state);
  return canvas;
}
