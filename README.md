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

1. Click **Enter first person**. The browser captures your mouse so you can aim. If the capture is released, click the scene to capture it again.
2. Move with **W/A/S/D** and aim by moving your mouse. A mouse and keyboard are recommended.
3. Press **1** for the pistol, **2** for the shotgun, **3** for the physics grab tool, or **4** for the bat.
4. **Left-click** to fire or swing. The bat works within a short distance. The pistol holds 12 rounds and the shotgun holds 6; press **R** to reload from unlimited reserve ammunition.
5. With the grab tool equipped, aim at a nearby prop or character and click to hold it in front of you. Move or aim to drag it around, then click again to release it.
6. Press **E** to spawn a character ahead of you, or use **Spawn person** in the toolbar. Up to 12 characters can exist at once.
7. Characters stand in a stable idle pose until hit or grabbed, then release into lighter ragdolls with limited spine, neck, shoulder, elbow, hip, and knee joints. Weapon impacts make them collapse, rather than launching very light limbs. Hits trigger brief joint-limited curling and flinching, followed by fading reflex twitches. Characters also breathe and blink while standing. Blood uses stylized particles and floor marks; wounds intermittently drip for 5–10 seconds and follow the hit body part. Uncheck **Blood effects** to stop new effects and clear airborne droplets. Pause freezes reactions and bleeding. There is no dismemberment.
8. Press **Esc** to release the mouse and access the toolbar. Click **Exit first person** to return to the orbit camera.
9. Use **Clear people** to remove characters and their blood effects. **Reset scene** removes spawned props and restores the four starting characters.

This is a prototype: characters have simple faces and clothing, remain in place until hit or grabbed, and have no dialogue or autonomous combat AI. Weapons have basic models, recoil, firing sounds, spread, and reload timers. Movement follows the floor and obstacles, with no jumping yet.

The scene is a clean gray gridded test chamber with four standing subjects and no preset obstacles. Spawn props only when you want them. It supports up to 180 dynamic props and 12 subjects.

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

## Physics validation

Run `npm test` to check standing-pose stability, hit reactions at multiple body parts, joint separation, floor collisions, settling, and collisions between characters. Ragdolls use a 120 Hz physics step with 12 solver iterations. Self-collision is enabled for non-adjacent body parts. Only directly jointed neighboring parts ignore each other to prevent contact fighting at their shared anchors. Contact with the room, props, and other characters remains enabled. Characters weigh roughly 53 kg; stronger hit impulses make them less sluggish. Tests also check bounded reactions and wound emission lifetimes. The idle pose is held until activation; this is not an active walking or balance simulation.
