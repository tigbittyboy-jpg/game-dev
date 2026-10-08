# Gravity Yard

A browser-based 3D physics sandbox built with Three.js and Rapier.

## Run

Requires Node.js 20.19+ or 22.12+.

```sh
npm ci --cache /workspace/.npm-cache
npm run dev
```

Run `npm run build` for a production build, or `npm run preview` to serve it.

## Play

- Drag to orbit, right drag to pan, scroll to zoom.
- Pick a shape, size and color, then click Drop object or press Space.
- Click an object to kick it; Shift-click to remove it.
- Adjust gravity and bounciness live, pause, trigger object rain, or reset.

The playground starts with a block pyramid, a ramp, and assorted objects. The scene supports up to 180 dynamic objects. A WebGL-capable browser is required.
