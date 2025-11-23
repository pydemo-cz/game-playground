# Mekanix - Development Overview

## Project Description
Mekanix is a physics-based construction game inspired by "Zip Zap" (iOS) and Meccano (Merkur) mechanics. The goal is to build robots from parts connected by rigid pivot joints (pins) to solve levels.

## Architecture
- **Engine:** Matter.js (via ESM imports)
- **Renderer:** Custom Canvas 2D renderer ("Merkur" style visualization)
- **State Management:** `GameManager` handles switching between `PLAY` and `EDIT` modes.
- **Level Management:** `LevelManager` handles loading/saving JSON level data.

## Core Mechanics
- **Joints:** Parts are connected by pin joints (hinges). They must rotate freely but hold parts together firmly without visual "gaps" or "floating" parts.
- **Editor:**
  - **Selection:** Parts, Joints, Platforms, and Holes can be selected.
  - **Manipulation:**
    - **Parts:** Move, Rotate, Resize.
    - **Joints:** Move (snap to holes), Define Angle Limits (Range of Motion).
    - **Holes:** Click empty hole -> Add Part.
  - **Gizmos:** Visual handles for interaction (no complex menus).
- **UI:**
  - **Editor Mode:** Full system menu (Save/Load/Reset).
  - **Play Mode:** Minimalist. Restart button only.

## Current Requirements (Tasks)
1. **Menu Visibility:** System menu button (hamburger) visible ONLY in Editor Mode.
2. **Restart Button:** Add a restart button in Play Mode (top-right, discreet).
3. **Visual Integrity:** Connected parts must look like they are pinned together (visual bolt/pin), not floating apart.
4. **Joint Editor:**
   - Select joints.
   - Define Range of Motion (angle limits) via gizmos.
   - Move joints to different holes.
5. **Hole Interaction:**
   - Click empty hole -> Select it -> Show Gizmo to add a new part.
6. **Mobile First:** All interactions must work via touch (tap/drag).

## Data Structure (Level JSON)
- `player`: { `bodies`: [...], `constraints`: [...] }
- `platforms`: [...]
- `goal`: { x, y, r }

## Future Goals
- Expand part types.
- More complex constraints (motors, springs).
