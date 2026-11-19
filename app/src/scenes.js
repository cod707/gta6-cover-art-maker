// Fixed scenes for screenshots: ?shot=editor shows the editor with photos
// loaded; ?shot=cover shows the finished cover alone. Query params:
// layout, photo (sample name), photo2, photo3, photo4, title, subtitle,
// grade, style. window.__shotReady is set once the scene has painted.
export async function runScene(shot, query, api) {
  if (shot === 'cover') document.body.classList.add('shot-cover');

  const layout = query.get('layout') || 'hero';
  api.setLayout(layout);
  const names = ['photo', 'photo2', 'photo3', 'photo4'];
  for (let i = 0; i < names.length; i += 1) {
    const name = query.get(names[i]);
    if (name) await api.setPhoto(i, `samples/${name}.jpg`);
  }
  const title = query.get('title');
  if (title !== null) api.setTitle(title);
  const subtitle = query.get('subtitle');
  if (subtitle !== null) api.setSubtitle(subtitle);
  const grade = query.get('grade');
  if (grade) api.setGrade(grade);
  const style = query.get('style');
  if (style) api.setStyle(style);
  api.render();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}
