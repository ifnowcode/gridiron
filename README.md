# 🏈 Gridiron — A Turn-Based Canvas Strategy Board Game

[https://ifnowcode.github.io/gridiron](https://ifnowcode.github.io/gridiron)

---

Disclaimer: This was created by AI as focused ipsum lorem.

---

Gridiron is a fast, tactical, turn-based football-inspired strategy game rendered entirely on an HTML5 canvas.

Players (or AIs) move pieces across a grid, tackle opponents, carry the ball, and score goals using deterministic Manhattan-distance movement.

The project began as a DOM-based prototype using hundreds of `<div>` elements, then evolved into a clean, memory-safe, canvas-driven engine with centralized rendering, deterministic AI scheduling, and a modular ruleset.

---

## 🎮 Gameplay Overview

Gridiron is played on a 21×11 grid with a center ball and two opposing teams:

  * **Blue Team** (typically left-to-right)

  * **Red Team** (typically right-to-left)

Each team has multiple pieces placed according to a selectable formation.
The objective is simple:

### Carry the ball into the opponent’s goal.

Or, in some modes:

  * Eliminate all opposing pieces

  * Exploit Classic Mode tackle rules

  * Play AI vs Human or AI vs AI (Auto Play)

---

## 🧠 Core Mechanics

### Movement

  * Movement uses Manhattan distance

  * A die roll determines the exact number of spaces a piece must move

  * Movement is orthogonal (no diagonals)

### Tackling

  * Landing on an enemy piece removes it

  * In Classic Mode, only the ball carrier can be tackled

      * Unless a defender is standing on their own goal square

### Ball Handling

  * If a piece moves onto the ball, it picks it up

  * Carriers move the ball with them

  * Scoring occurs when the carrier enters the opponent’s goal cell

### Turn Flow

  1. Roll the die

  2. Drag a piece to a legal destination

  3. Resolve tackles, pickups, and scoring

  4. Switch players

  5. AI takes over if enabled

---

## 🤖 AI System

Gridiron includes multiple AI difficulty levels:

  * **Level 0**: Random legal moves

  * **Level 1**: Greedy Manhattan-distance heuristic

  * **Higher levels** can be added modularly

### AI Scheduling

AI turns are serialized using a centralized scheduler:

  * Prevents overlapping AI calls

  * Prevents race conditions

  * Ensures deterministic turn order

  * Allows Auto Play (AI vs AI) at a controlled pace

---

## 🖥️ Canvas Rendering Engine

The entire board is drawn using a single `<canvas>` element:

  * No DOM churn

  * No per-cell event listeners

  * No memory leaks

  * Deterministic rendering

  * Easy to animate and extend

### Rendering Features

  * Grid lines

  * Team pieces (round or square)

  * Emoji ball overlay

  * Goal markers

  * Drag ghost

  * Scoreboard drawn directly on canvas

  * Optional coordinate debug overlay

---

## 🧩 Formations

Gridiron supports a wide range of formations, including:

  * Diamond

  * Spread

  * Tight

  * Line

  * Pyramid

  * Blitz

  * Moshpit

  * Gauntlet

  * Custom experimental setups

Each formation defines:

  * Blue piece positions

  * Red piece positions

  * Optional custom ball spawn

  * Optional custom goal positions

---

## ⚙️ Game Modes

### Classic Mode

  * Only the ball carrier can be tackled

  * Exception: defenders standing on their own goal may be tackled

  * Encourages positional play and blocking

### Standard Mode

  * Any enemy piece may be tackled

  * Faster, more aggressive gameplay

### Auto Play

  * Both sides controlled by AI

  * Useful for:

      * Testing

      * Debugging

      * Watching AI strategies evolve

---

## 🖱️ Controls

### Human Player

  * **Roll**: Click the Roll button

  * **Move**: Drag a piece to a legal destination

  * **Pass**: Skip your turn

  * **Restart**: Begin a new round

  * **Ball Select**: Choose the emoji used for the ball

### Debug Options

  * Toggle coordinate overlay

  * Enable/disable auto-roll

  * Enable/disable auto-play

  * Switch formations

  * Switch AI difficulty

  * Switch match mode

---

### 🧼 Architecture & Code Design

Gridiron is built around several core principles:

### 1. Deterministic State Model

All game state lives in plain JS objects:

  * `board`

  * `pieces`

  * `ball`

  * `currentPlayer`

  * `rollValue`

  * `gameOver`

### 2. Single Render Path

The canvas is redrawn from scratch every frame:

  * No incremental DOM updates

  * No stale nodes

  * No memory leaks

### 3. Centralized AI Scheduler

AI turns are serialized using:

  * A single timeout

  * A cancellation mechanism

  * A guard to prevent double-scheduling

### 4. Clean Separation of Concerns

  * Rendering

  * Input

  * Game rules

  * AI logic

  * Scheduling

  * Formations

Each subsystem is isolated and predictable.

---

## 🧪 Debugging Tools

Gridiron includes built-in debugging features:

  * Coordinate overlay

  * Trace flags for:

      * movement

      * AI decisions

      * scoring

      * tackling

      * scheduling

  * Auto-play for stress testing

  * Deterministic AI behavior

---

## 🚀 Future Enhancements

Potential extensions include:

  * Animated movement

  * Particle effects on tackles

  * Replay system

  * Smarter AI (A*, Monte Carlo, influence maps)

  * Online multiplayer

  * Formation editor

  * Custom rulesets