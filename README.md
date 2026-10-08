# Gravity Yard

A browser-based 3D physics sandbox built with Three.js and Rapier. A first-person physics playground with fictional ragdoll characters, a pistol, shotgun, bat, physics grab tool, and optional stylized blood effects. You can also orbit the scene, spawn props, and experiment with gravity.

## macOS: step-by-step setup

The game is designed to work on both Apple Silicon and Intel Macs in a current version of Safari, Chrome, or Firefox with WebGL enabled. It does not require a desktop game engine. The build, physics, and browser startup have been checked in Linux Chromium; macOS browser behavior has not yet been tested directly.

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
- **Reset scene:** clear the objects and restore the empty test chamber and starting subjects. Your current world settings remain selected.

### First-person mode, characters, and weapons

1. Click **Play first person**. The browser captures your mouse. Click the chamber again to recapture it after pressing **Esc**.
2. Move with **W/A/S/D**, hold **Shift** to sprint, and press **Space** to jump. Move the mouse to aim.
3. Press **1** for the pistol, **2** for the shotgun, **3** for the grab tool, or **4** for the baton. You can also select a weapon in the lower-left tray when the mouse is released.
4. **Left-click** to fire or swing. Hold **right-click** with a gun to aim more closely. The baton reaches 2.8 metres. The pistol holds 12 rounds and the shotgun holds 6; **R** reloads from unlimited reserve ammunition.
5. The orange hit marker confirms a character impact. Aim at a character to inspect its body part, vitality, injury state, and number of bleeding wounds. Damage is location-dependent: head hits do more damage; shin and forearm hits do less. These are game values, not a medical simulation.
6. With the grab tool, click a nearby body part or prop to hold it. **Scroll** changes the holding distance; click again to release, or **right-click** to throw it. Grabbed bodies remain physical.
7. Press **E** to spawn a subject ahead of you, or click **＋ Subject**. Up to 12 subjects can exist at once.
8. Press **P** to pause or resume. Pausing freezes physics, reactions, wounds, firing cooldowns, and reload progress. Press **X** to reset the chamber, starting subjects, and ammunition.
9. Press **Esc** to release the mouse. **Controls** or **H** toggles the expanded help panel. **Orbit view** returns to the editor camera. **Clear subjects** removes characters and their blood effects.

### Character behavior

Characters breathe, blink, and shift slightly while standing. Hits or grabbing release them into connected physics bodies. Light injuries use foot-grounded balance assistance so subjects stagger and guard while staying upright; substantial leg injury, low vitality, loss of footing, or grabbing disables that support. The neck has a hard angular limit even after incapacitation. Surviving characters continue guarded arm movement, curling, head movement, and asymmetric leg reactions; they no longer stop moving when a short reaction timer expires. Repeated hits restart the immediate flinch, reduce vitality, and weaken the affected limb. An unresponsive character stops voluntary movement but remains collidable, grabbable, and responsive to external impacts.

Wounds stay attached to the hit body part and intermittently drip for roughly 14–30 seconds, gradually slowing down. Closely spaced pellet hits merge into one wound. Blood effects include small impact marks, airborne droplets, and floor stains. The **Blood** checkbox disables new effects and clears airborne droplets; clearing subjects or resetting removes all marks and stains. There is no dismemberment.

The clean gridded chamber starts with four subjects and no obstacles. It supports up to 180 spawned props and 12 subjects. The models and reactions are procedural; characters do not walk, navigate, speak, or simulate an anatomically accurate medical system. Idle subjects use a controlled pose. Injured standing subjects use assisted physical balance; this is not a full walking controller.

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

## Tests

```sh
npm test
```

The physics regression tests check continued visible limb movement long after a first hit, repeated-hit wake-up and momentum, incapacitated settling, neck limits under head impacts, resistance to mild hits, grounded struggle after leg injury, self-collision, floor collisions, coherent idle motion, wound expiry, and stability with multiple injured characters. Physics runs at 120 Hz with 12 solver iterations. Bodies weigh about 53 kg. Only directly joined neighbors disable collision at their attachment points.

For browser play tests:

```sh
npx playwright install chromium
npm run test:browser
```

The cloud environment uses its existing system Chromium when available. The browser suite checks actual aiming and shooting, ongoing reactions, repeated hits, reload, pause, jump, grabbing and throwing, shotgun and baton impacts, blood controls, and reset. Failure screenshots and traces are written to ignored `test-results/`.

## Update an existing Git checkout

Stop the development server with **Control + C**, then run in the game folder:

```sh
git pull origin main
npm ci
npm run dev
```

Refresh the browser after the server restarts. If you originally downloaded a ZIP, download and extract the latest ZIP and repeat the installation steps in its new folder.
