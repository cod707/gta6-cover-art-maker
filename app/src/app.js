// Neon Coast Cover Maker — wiring: layout picker, photo slots, caption
// editor, grade picker, live preview, PNG export. Photos are read with
// FileReader into memory and never leave the browser.
import { drawCover, LAYOUTS } from './render.js';
import { runScene } from './scenes.js';

const canvas = document.getElementById('preview');
const statusEl = document.getElementById('status');
const slotsEl = document.getElementById('slots');
const titleInput = document.getElementById('title');
const subtitleInput = document.getElementById('subtitle');
const sizeInput = document.getElementById('titleSize');
const styleSelect = document.getElementById('style');
const gradeSelect = document.getElementById('grade');
const exportSize = document.getElementById('exportSize');
const layoutField = document.getElementById('layouts');

const state = {
  layout: 'duo',
  panels: [{ img: null, zoom: 1, ox: 0, oy: 0 }],
  title: 'Neon Coast',
  subtitle: 'A sunset drive',
  titleScale: 1,
  style: 'solid',
  grade: 'sunset',
};

const EXPORT_SIZES = {
  square: [1080, 1080],
  portrait: [1080, 1350],
  wide: [1920, 1080],
};

function slotCount() {
  return LAYOUTS[state.layout].slots;
}

function ensurePanels() {
  const n = slotCount();
  while (state.panels.length < n) state.panels.push({ img: null, zoom: 1, ox: 0, oy: 0 });
  state.panels.length = n;
}

function render() {
  ensurePanels();
  const [w, h] = EXPORT_SIZES[exportSize.value] || EXPORT_SIZES.square;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  drawCover(canvas, state);
}

/** Loads an image from a URL (local file or object URL), resolving once drawable. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

function readFileAsImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => loadImage(reader.result).then(resolve, reject);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function buildSlots() {
  ensurePanels();
  slotsEl.innerHTML = '';
  state.panels.forEach((panel, i) => {
    const box = document.createElement('div');
    box.className = 'slot';
    box.innerHTML = `
      <p class="slot-name">Panel ${i + 1} ${panel.img ? '· photo loaded' : '· empty'}</p>
      <label class="file-btn">Choose photo
        <input type="file" accept="image/*" data-slot="${i}">
      </label>
      <button type="button" class="sample-btn" data-sample="${i}">Use a sample photo</button>
      <label>Zoom <input type="range" min="1" max="2.5" step="0.05" value="${panel.zoom}" data-zoom="${i}"></label>
      <label>Move left–right <input type="range" min="-1" max="1" step="0.05" value="${panel.ox}" data-ox="${i}"></label>
      <label>Move up–down <input type="range" min="-1" max="1" step="0.05" value="${panel.oy}" data-oy="${i}"></label>`;
    slotsEl.appendChild(box);
  });
}

function refreshSlotLabels() {
  slotsEl.querySelectorAll('.slot-name').forEach((el, i) => {
    el.textContent = `Panel ${i + 1} ${state.panels[i]?.img ? '· photo loaded' : '· empty'}`;
  });
}

slotsEl.addEventListener('change', async (event) => {
  const input = event.target;
  if (input.matches('input[type="file"]')) {
    const file = input.files[0];
    if (!file) return;
    const i = Number(input.dataset.slot);
    try {
      state.panels[i].img = await readFileAsImage(file);
      statusEl.textContent = `Panel ${i + 1}: ${file.name} loaded. Nothing was uploaded.`;
    } catch {
      statusEl.textContent = `Panel ${i + 1}: that file could not be read as a photo.`;
    }
    refreshSlotLabels();
    render();
  }
});

slotsEl.addEventListener('input', (event) => {
  const input = event.target;
  const i = Number(input.dataset.zoom ?? input.dataset.ox ?? input.dataset.oy ?? -1);
  if (i < 0) return;
  if (input.dataset.zoom) state.panels[i].zoom = Number(input.value);
  if (input.dataset.ox) state.panels[i].ox = Number(input.value);
  if (input.dataset.oy) state.panels[i].oy = Number(input.value);
  render();
});

slotsEl.addEventListener('click', async (event) => {
  const btn = event.target.closest('[data-sample]');
  if (!btn) return;
  const i = Number(btn.dataset.sample);
  const sample = i % 2 === 0 ? 'samples/boulevard.jpg' : 'samples/pier.jpg';
  state.panels[i].img = await loadImage(sample);
  refreshSlotLabels();
  render();
});

layoutField.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-layout]');
  if (!btn) return;
  state.layout = btn.dataset.layout;
  layoutField.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
  buildSlots();
  render();
});

document.getElementById('fillSamples').addEventListener('click', async () => {
  ensurePanels();
  for (let i = 0; i < state.panels.length; i += 1) {
    state.panels[i].img = await loadImage(i % 2 === 0 ? 'samples/boulevard.jpg' : 'samples/pier.jpg');
  }
  refreshSlotLabels();
  render();
  statusEl.textContent = 'Sample photos loaded — swap any panel with your own photo.';
});

titleInput.addEventListener('input', () => { state.title = titleInput.value; render(); });
subtitleInput.addEventListener('input', () => { state.subtitle = subtitleInput.value; render(); });
sizeInput.addEventListener('input', () => { state.titleScale = Number(sizeInput.value); render(); });
styleSelect.addEventListener('change', () => { state.style = styleSelect.value; render(); });
gradeSelect.addEventListener('change', () => { state.grade = gradeSelect.value; render(); });
exportSize.addEventListener('change', render);

document.getElementById('export').addEventListener('click', () => {
  const [w, h] = EXPORT_SIZES[exportSize.value] || EXPORT_SIZES.square;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  drawCover(out, state);
  out.toBlob((blob) => {
    if (!blob) {
      statusEl.textContent = 'Export failed — try again.';
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `neon-coast-cover-${w}x${h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    statusEl.textContent = `Saved neon-coast-cover-${w}x${h}.png`;
  }, 'image/png');
});

// Public hooks for the screenshot scenes (?shot=...).
const api = {
  setLayout(layout) {
    if (!LAYOUTS[layout]) return;
    state.layout = layout;
    layoutField.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.layout === layout)));
    buildSlots();
  },
  async setPhoto(i, url) {
    ensurePanels();
    if (i < state.panels.length) state.panels[i].img = await loadImage(url);
    refreshSlotLabels();
  },
  setTitle(text) { state.title = text; titleInput.value = text; },
  setSubtitle(text) { state.subtitle = text; subtitleInput.value = text; },
  setGrade(grade) { state.grade = grade; gradeSelect.value = grade; },
  setStyle(style) { state.style = style; styleSelect.value = style; },
  render,
};

const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  runScene(shot, new URLSearchParams(location.search), api);
} else {
  buildSlots();
  render();
}
