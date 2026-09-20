# Ironhide — 3D seat cover configurator (concept demo)

A single-page demo that shows a real 3D vehicle in the browser (three.js),
lets you drag/rotate/zoom it, recolour the paint live, and pick a seat
cover colour (which also shows the matching real seat cover photo).

This is a concept/demo build, not a production app. It's not affiliated
with Ford or Black Duck SeatCovers.

## Running it

Browsers block `fetch()` on local files opened directly (`file://`), so
you need to serve this folder over HTTP, not just double-click `index.html`.

Easiest options:

```bash
# Python 3
python3 -m http.server 8000

# Node (if you have npx)
npx serve .
```

Then open `http://localhost:8000`.

## Deploying to GitHub Pages

1. Push this folder to a GitHub repo.
2. In the repo, go to **Settings → Pages**.
3. Set the source to your default branch, root folder.
4. GitHub will give you a URL like `https://<you>.github.io/<repo>/`.

No build step, no dependencies to install, it's plain HTML/CSS/JS.

## File structure

```
index.html          the page and all UI
app.js               all the three.js scene, camera and controls logic
vendor/three.min.js   three.js r128, MIT licensed (bundled locally, not a CDN)
vendor/GLTFLoader.js   three.js's GLTF loader addon, same version
assets/raptor.glb      the 3D vehicle model (see note below)
assets/seat-*.jpg      seat cover reference photos shown in the sidebar
```

## About the assets

- `raptor.glb` was decimated and texture-compressed from a much larger
  source file so it loads reasonably fast in a browser. It came from a
  paid download, so before using this publicly or commercially, check
  that your license for that model covers your use.
- The `seat-*.jpg` photos are cropped from Black Duck SeatCovers product
  photography and still carry their logo. Swap these for your own images
  if you plan to publish this anywhere real.

## How the colour swapping works

- **Paint**: the GLTF's own materials named with `PAINT` in them (a
  common convention in this kind of asset) get their `material.color`
  set directly, so any hex colour works, no extra assets needed.
- **Seats**: materials named with `leather` in them get tinted the same
  way as a rough approximation. The sidebar photo is the accurate
  reference, since the model's interior isn't UV-unwrapped for a real
  fabric swap.

If you use a different `.glb` file, open `app.js` and adjust the
`/paint/i` and `/leather/i` regexes in `loadModel()` to match whatever
your model's material names actually are (check by loading it in
[gltf.report](https://gltf.report) or similar first).
