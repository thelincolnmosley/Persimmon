# Persimmon

> A tranquil snake game in four lights, set upon a floating garden.

Play online: **[thelincolnmosley.github.io/Persimmon](https://thelincolnmosley.github.io/Persimmon/)**

---

## About

**Persimmon** is a minimalist, atmospheric reimagining of the classic snake game. Steer the serpent across an axonometric floating garden, harvesting persimmons as the world gently turns through four times of day: **morning**, **noon**, **dusk**, and **night**.

### Features

- **Four Lights of the Day**: Dynamic lighting, cloud shadows, and color shifts cycle as you harvest fruit.
- **Pure Canvas 2D**: Beautiful isometric/axonometric projection, tile depth, soft shadows, and subtle particle effects rendered on a single HTML5 2D canvas.
- **100% Procedural Audio**: Built with the Web Audio API without a single audio sample. Features generative ambient pentatonic melodies and chord progressions tuned to each phase of day.
- **Zero Dependencies**: Pure vanilla JavaScript, HTML5, and CSS with no build step, bundlers, or external libraries required.
- **Responsive Controls**: Fully playable on desktop and mobile with touch gestures and keyboard controls.

## Controls

| Key | Action |
| --- | --- |
| `↑` `↓` `←` `→` or `W` `A` `S` `D` | Steer the snake |
| `Space` | Start game / Restart after tangle |
| `P` | Pause / Resume |
| *Sound button* (bottom-right) | Toggle procedural audio on/off |
| *Touch / Swipe* | Touch steering on mobile devices |

## Quick Start

To play locally without a server:

```bash
git clone https://github.com/thelincolnmosley/Persimmon.git
cd Persimmon
open index.html
```

Or serve with any static web server:

```bash
npx serve .
# or
python3 -m http.server 8000
```

## License

MIT
