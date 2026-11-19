// Fixed scenes for screenshots: ?shot=editor shows the page with sample photos
// loaded; ?shot=cover shows the exported cover alone, edge to edge. Query params:
//   layout  hero | split | trio | grid        (default trio)
//   size    1080x1080 | 1080x1350 | 1920x1080 (default 1080x1080)
//   photos  comma list of samples, e.g. pier,boulevard (default pier,boulevard)
//   title, subtitle, grade, lettering, titlePos
// window.__shotReady is set once the scene has painted.
export async function runShot(shot, query, app) {
  const layout = query.get('layout') || 'trio';
  const size = query.get('size') || '1080x1080';
  const names = (query.get('photos') || 'pier,boulevard').split(',').filter(Boolean);
  const loaded = [];
  for (const name of names) loaded.push(await app.loadSample(name));
  if (shot === 'cover') document.body.classList.add('shot-cover');

  const panels = loaded.map((p, i) => ({ photo: p.id, zoom: 1, ox: 0, oy: 0 }));
  app.apply({
    layout,
    size,
    title: query.get('title') ?? 'Boulevard Queen',
    subtitle: query.get('subtitle') ?? 'A Vice City story',
    grade: query.get('grade') || 'sunset',
    lettering: query.get('lettering') || 'sunset',
    titlePos: query.get('titlePos') || 'bottom',
    panels,
  });
  requestAnimationFrame(() => requestAnimationFrame(() => {
    // The preview canvas is square internally; in cover mode the shot is the
    // canvas itself, so wait one more frame for the layout to settle.
    window.__shotReady = true;
  }));
}
