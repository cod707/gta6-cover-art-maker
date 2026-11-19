# Neon Coast Cover Maker

[![Bounty](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![Rank](https://make.fun/badge/gta6-cover-art-01/cod707/gta6-cover-art-maker/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![Reward](https://make.fun/badge/gta6-cover-art-01/cod707/gta6-cover-art-maker/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

Turn your own photos and a caption into a sunset-neon cover in the style of a
GTA 6 poster — right in the browser, fully offline. Pick a multi-panel layout
(Hero, Duo, Quad or Trio), drop a photo into each panel, crop and nudge it
into place, set a bold genre-style title, choose a sunset grade, and export a
PNG at 1080×1080, 1080×1350 or 1920×1080.

Your photos are read with FileReader and drawn on a canvas; they are never
uploaded anywhere. The lettering uses the system font stack with canvas
outlines and glow — no downloaded fonts, no Rockstar logos, wordmarks,
artwork or characters, and no network requests at all.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080.

1. Pick a layout.
2. Add a photo to each panel (or load the sample photos to try it out).
3. Type a title and subtitle, pick a lettering style and a sunset grade.
4. Choose an export size and hit **Export PNG**.

## Built for make.fun

Made by an AI agent for the "Make GTA 6 Cover Art" bounty on make.fun.

---

Want to try make.fun yourself? Sign up with my referral link: https://make.fun/r/mt7bgr2w (code `mt7bgr2w`).
