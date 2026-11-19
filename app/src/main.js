// Wires the Vice City Cover Maker page: load photos (FileReader, never uploaded),
// pick a panel layout, crop and position each panel, edit the caption, pick a
// grade, and export the cover as a PNG. A `?shot=` query sets up a fixed scene
// for a screenshot instead (./shots.js).
import { drawCover, renderCover, LAYOUTS, SIZES, GRADES, LETTERINGS } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const statusEl = document.getElementById('status');

/** The cover state: photos live here as loaded images, panels point at them. */
const state = {
  layout: 'trio',
  size: '1080x1080',
  panels: [],
  title: 'Boulevard Queen',
  subtitle: 'A Vice City story',
  lettering: 'sunset',
  titlePos: 'bottom',
  grade: 'sunset',
};

/** Loaded photos: { id, name, img }. Panel.photo holds the photo's id. */
const photos = [];
let photoSeq = 0;

function layoutPanelCount() {
  return (LAYOUTS[state.layout] || LAYOUTS.trio).panels.length;
}

/** Keeps state.panels in step with the layout: new panels start on photo 0. */
function syncPanels() {
  const n = layoutPanelCount();
  while (state.panels.length < n) {
    state.panels.push({ photo: photos[0]?.id ?? null, zoom: 1, ox: 0, oy: 0 });
  }
  state.panels.length = n;
}

function photoById(id) {
  return photos.find((p) => p.id === id) || null;
}

/** The state the engine draws: panel photo ids resolved to images. */
function drawableState() {
  return {
    ...state,
    panels: state.panels.map((p) => ({ ...p, photo: photoById(p.photo)?.img ?? null })),
  };
}

function redraw() {
  const size = SIZES[state.size];
  if (canvas.width !== size.w || canvas.height !== size.h) {
    canvas.width = size.w;
    canvas.height = size.h;
  }
  drawCover(canvas, drawableState());
}

/** Loads an image from a URL, resolving to the image once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Reads image files on this machine into the photo tray (FileReader only). */
async function addFiles(files) {
  let added = 0;
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const img = await loadImage(dataUrl);
    photos.push({ id: `p${++photoSeq}`, name: file.name, img });
    added += 1;
  }
  if (added) {
    // Panels with no photo yet take the first photo that arrived.
    for (const panel of state.panels) {
      if (!panel.photo) panel.photo = photos[0].id;
    }
    renderTray();
    renderPanelControls();
    redraw();
    statusEl.textContent = `${added} photo${added > 1 ? 's' : ''} loaded — kept on this machine, never uploaded.`;
  }
}

function renderTray() {
  const tray = document.getElementById('tray');
  tray.innerHTML = '';
  if (!photos.length) {
    const empty = document.createElement('span');
    empty.className = 'empty';
    empty.textContent = 'No photos yet — add yours, or load the samples.';
    tray.appendChild(empty);
    return;
  }
  for (const photo of photos) {
    const thumb = document.createElement('img');
    thumb.src = photo.img.src;
    thumb.alt = photo.name;
    thumb.title = `${photo.name} — click to put it in the first empty panel`;
    thumb.addEventListener('click', () => {
      const panel = state.panels.find((p) => !p.photo) || state.panels[0];
      if (panel) {
        panel.photo = photo.id;
        renderPanelControls();
        redraw();
      }
    });
    tray.appendChild(thumb);
  }
}

/** Builds the per-panel controls (photo, zoom, pan) for the current layout. */
function renderPanelControls() {
  const box = document.getElementById('panels');
  box.innerHTML = '';
  state.panels.forEach((panel, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'panel-box';
    const heading = document.createElement('div');
    heading.className = 'panel-title';
    heading.textContent = `Panel ${i + 1}`;
    wrap.appendChild(heading);

    const photoLabel = document.createElement('label');
    photoLabel.textContent = 'Photo';
    const select = document.createElement('select');
    const none = document.createElement('option');
    none.value = '';
    none.textContent = '— empty —';
    select.appendChild(none);
    for (const photo of photos) {
      const opt = document.createElement('option');
      opt.value = photo.id;
      opt.textContent = photo.name;
      select.appendChild(opt);
    }
    select.value = panel.photo ?? '';
    select.addEventListener('change', () => {
      panel.photo = select.value || null;
      redraw();
    });
    photoLabel.appendChild(select);
    wrap.appendChild(photoLabel);

    for (const [key, label, min, max, step] of [
      ['zoom', 'Zoom', 1, 3, 0.05],
      ['ox', 'Move left ↔ right', -1, 1, 0.05],
      ['oy', 'Move up ↕ down', -1, 1, 0.05],
    ]) {
      const lab = document.createElement('label');
      lab.textContent = `${label}: ${panel[key].toFixed(2)}`;
      const range = document.createElement('input');
      range.type = 'range';
      range.min = String(min);
      range.max = String(max);
      range.step = String(step);
      range.value = String(panel[key]);
      range.addEventListener('input', () => {
        panel[key] = Number(range.value);
        lab.textContent = `${label}: ${panel[key].toFixed(2)}`;
        redraw();
      });
      lab.appendChild(range);
      wrap.appendChild(lab);
    }
    box.appendChild(wrap);
  });
}

/** Segmented buttons: one active choice out of a set. */
function buildSegment(el, entries, current, onPick) {
  el.innerHTML = '';
  for (const [key, label] of entries) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    if (key === current) btn.classList.add('active');
    btn.addEventListener('click', () => {
      onPick(key);
      el.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
    el.appendChild(btn);
  }
}

buildSegment(
  document.getElementById('layouts'),
  Object.entries(LAYOUTS).map(([k, v]) => [k, v.label.split(' — ')[0]]),
  state.layout,
  (key) => {
    state.layout = key;
    syncPanels();
    renderPanelControls();
    redraw();
  },
);

buildSegment(
  document.getElementById('grades'),
  Object.entries(GRADES).map(([k, v]) => [k, v.label]),
  state.grade,
  (key) => {
    state.grade = key;
    redraw();
  },
);

document.getElementById('photos').addEventListener('change', (e) => {
  addFiles(e.target.files);
  e.target.value = '';
});

document.getElementById('samples').addEventListener('click', async () => {
  for (const name of ['boulevard.jpg', 'pier.jpg']) {
    if (photos.some((p) => p.name === name)) continue;
    const img = await loadImage(`samples/${name}`);
    photos.push({ id: `p${++photoSeq}`, name, img });
  }
  for (const panel of state.panels) {
    if (!panel.photo) panel.photo = photos[0].id;
  }
  renderTray();
  renderPanelControls();
  redraw();
  statusEl.textContent = 'Sample photos loaded.';
});

document.getElementById('title').addEventListener('input', (e) => {
  state.title = e.target.value;
  redraw();
});
document.getElementById('subtitle').addEventListener('input', (e) => {
  state.subtitle = e.target.value;
  redraw();
});
document.getElementById('lettering').addEventListener('change', (e) => {
  state.lettering = e.target.value;
  redraw();
});
document.getElementById('titlePos').addEventListener('change', (e) => {
  state.titlePos = e.target.value;
  redraw();
});
document.getElementById('exportSize').addEventListener('change', (e) => {
  state.size = e.target.value;
  redraw();
});

/** Downloads one rendered cover PNG at the named size. */
function exportPng(sizeKey) {
  const out = renderCover(drawableState(), sizeKey);
  const size = SIZES[sizeKey];
  out.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-city-cover-${size.w}x${size.h}.png`;
    a.click();
    statusEl.textContent = `Saved vice-city-cover-${size.w}x${size.h}.png`;
  }, 'image/png');
}

document.getElementById('export').addEventListener('click', () => exportPng(state.size));
document.getElementById('exportAll').addEventListener('click', () => {
  for (const key of Object.keys(SIZES)) exportPng(key);
  statusEl.textContent = 'Exporting all three sizes…';
});

syncPanels();
renderTray();
renderPanelControls();

const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  runShot(shot, new URLSearchParams(location.search), {
    loadSample: async (name) => {
      const img = await loadImage(`samples/${name}.jpg`);
      photos.push({ id: `p${++photoSeq}`, name: `${name}.jpg`, img });
      return photos[photos.length - 1];
    },
    apply: (patch) => {
      Object.assign(state, patch);
      syncPanels();
      renderTray();
      renderPanelControls();
      redraw();
    },
    state,
    photos,
    redraw,
  });
} else {
  redraw();
}
