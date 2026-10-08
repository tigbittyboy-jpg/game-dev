# Gravity Yard

A browser-based 3D physics sandbox built with Three.js and Rapier. Spawn objects, build stacks, change gravity, and experiment with collisions.

## macOS: step-by-step setup

The game is designed to work on both Apple Silicon and Intel Macs in a current version of Safari, Chrome, or Firefox with WebGL enabled. It does not require a desktop game engine. The build and physics have been checked in Linux; macOS browser behavior has not yet been tested directly.

### 1. Install Node.js

1. Visit [nodejs.org](https://nodejs.org/).
2. Download the **LTS macOS installer** and open the downloaded `.pkg` file.
3. Follow the installer prompts. Node.js includes npm, which installs the game's dependencies.
4. Open **Terminal** from Applications → Utilities.
5. Check that both tools are installed:

   ```sh
   node --version
   npm --version
   ```

Use the current Node.js LTS release. The build tools require Node.js 20.19+ on the 20.x line, or 22.12+ on newer supported lines.

### 2. Download the game

The simplest option does not require Git:

1. Open [the GitHub repository](https://github.com/tigbittyboy-jpg/game-dev).
2. Select **Code → Download ZIP**.
3. Double-click the ZIP in Downloads to extract it.
4. In Terminal, enter the extracted folder:

   ```sh
   cd ~/Downloads/game-dev-main
   ```

If you extracted or renamed the folder elsewhere, type `cd ` with a trailing space, drag the extracted folder from Finder into Terminal, then press Return.

Alternatively, if Git is already installed:

```sh
mkdir -p ~/Projects
cd ~/Projects
git clone https://github.com/tigbittyboy-jpg/game-dev.git
cd game-dev
```

If the repository is private, sign in to GitHub with an account that has access before downloading it.

### 3. Install dependencies

From inside the game folder, run:

```sh
npm ci
```

Wait for the command to finish. Internet access is needed for this first installation. Repeat this step after downloading an updated version of the project.

### 4. Start the game

Run:

```sh
npm run dev
```

Keep this Terminal window open while playing. Vite will print a **Local** address, normally `http://localhost:5173/`. If that port is already in use, use the address it prints instead.

### 5. Open it in your browser

1. Open Safari, Chrome, or Firefox.
2. Enter the Local address from Terminal into the browser's address bar.
3. Wait for the playground to appear.

The game must be served with the command above; double-clicking `index.html` will not launch it correctly.

### 6. Play

- **Orbit:** click and drag on empty space.
- **Zoom:** scroll with your mouse or use a two-finger scroll on a trackpad.
- **Pan:** right-click and drag. On a trackpad, use a secondary click and drag, or hold Shift while dragging on empty space.
- **Spawn:** select Cube, Sphere, Cylinder, or Plank; choose a size and color; then click **Drop object**. You can also press Space when a slider or button is not focused.
- **Kick:** click an object to launch it upward.
- **Remove:** hold Shift and click an object.
- **Experiment:** adjust Gravity and Bounciness. Bounciness applies to existing and newly spawned objects.
- **Pause:** click Pause; click Resume to continue the simulation.
- **Object rain:** drop a batch of mixed objects.
- **Reset scene:** clear the objects and restore the starting arrangement. Your current world settings remain selected.

The playground starts with a block pyramid, a ramp, and assorted objects. It supports up to 180 dynamic objects.

### 7. Stop and restart

To stop the server, return to Terminal and press **Control + C**.

To play again later, open Terminal and run:

```sh
cd ~/Downloads/game-dev-main
npm run dev
```

Use your actual game folder if you downloaded it elsewhere or used the Git option. You do not need to reinstall dependencies every time.

## Troubleshooting on Mac

- **`node` or `npm` command not found:** install Node.js, close Terminal, open a new Terminal window, and check the versions again.
- **`npm` cannot find `package.json`:** you are in the wrong folder. Run `pwd` and `ls`; the game folder should contain `package.json`, `index.html`, and `src`.
- **The page cannot connect:** keep `npm run dev` running and use its exact Local address.
- **Blank page or a WebGL error:** update your browser and try another supported browser. In Chrome, ensure graphics acceleration is enabled under Settings → System, then relaunch Chrome. If it persists, check the browser's developer console for an error.
- **Slow performance:** reset the scene, spawn fewer objects, and close other demanding applications.

## Production build

From the game folder:

```sh
npm run build
npm run preview
```

Open the Local address printed by the preview command. The generated static website is in `dist/`; it can be deployed to a static hosting service. Preview is for checking the build locally.

## Codex cloud environment

In the prepared cloud environment, the checkout is `/workspace/game-dev`:

```sh
cd /workspace/game-dev
npm ci --cache /workspace/.npm-cache
npm run dev
```

The `/workspace` paths are specific to the cloud environment; use the macOS steps above on your Mac.
