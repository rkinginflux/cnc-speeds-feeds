# CNC Speeds & Feeds Analyzer

A web-based tool for CNC woodworkers to:
1. **Upload gcode files** and get tool-specific feed rate, spindle speed, and depth-per-pass recommendations
2. **Calculate speeds & feeds** using standard CNC formulas (SFM, RPM, Feed Rate, Chip Load, Ramp Down)
3. **Browse a tool database** of CNC bits with full specs and manufacturer links

## Features

### Gcode Analyzer
- Drag-and-drop or paste gcode directly
- Automatically detects tool changes (T commands), feed rates (F), spindle speeds (S), and Z-axis depths
- Matches tools from gcode comments to the built-in tool database
- Generates warnings when:
  - Feed rate is outside the tool's recommended range
  - Chip load exceeds or falls below the tool's spec
  - Depth per pass exceeds half the tool diameter (general rule)
  - Spindle speed is outside the Makita RT0701C range (10,000–30,000 RPM)
  - Ramp down exceeds the tool's recommendation
- Shows calculated SFM and chip load for each tool/spindle combination

### Speeds & Feeds Calculator
Three calculation modes:
- **From Chip Load**: Enter RPM, diameter, flutes, chip load → get feed rate
- **From Feed Rate**: Enter RPM, diameter, flutes, feed rate → get chip load
- **From SFM**: Enter SFM, diameter, flutes, chip load → get RPM and feed rate

All formulas match the Go implementation:
```
SFM = 0.262 × diameter × RPM
RPM = (SFM × 3.82) / diameter
Feed Rate = RPM × flutes × chip load
Chip Load = Feed Rate / (RPM × flutes)
Ramp Down = Feed Rate / flutes
```

### Tool Database
- 11 CNC bits from Amana, SpeTool, IDC, and Freud
- Full specs: flutes, direction, diameter, angle, cutting height, shank, overall length, chip load, feed rate, ramp down, depth per pass
- Searchable by name, part number, or diameter
- Click any tool for a detailed spec sheet
- Links to manufacturer product pages

## How to Use

### For Gcode Analysis
1. Open the website
2. Go to the "Gcode Analyzer" tab
3. Either drag-and-drop a `.gcode`/`.nc`/`.tap` file, or paste gcode into the text area
4. Click "Analyze Pasted Gcode" (or just drop the file)
5. Review the results — each tool gets its own card with warnings and recommendations

**Tip:** Add tool name comments in your gcode for automatic matching:
```
(Tool: Amana 46202-K)
T1 M6
S18000 M3
```

### For Speeds & Feeds Calculation
1. Go to the "Speeds & Feeds Calculator" tab
2. Choose a calculation mode
3. Enter your tool parameters
4. Click "Calculate"

## Tool Database

| Tool | Flutes | Direction | Diameter | Feed Rate | Chip Load |
|------|--------|-----------|----------|-----------|-----------|
| Amana 46202-K | 2 | Down | 1/4" | 180 IPM | 0.005 |
| Amana 46282-K | 4 | Up-Cut | 1/16" | 35–45 IPM | 0.0005–0.00065 |
| Amana 45771-K | — | — | 0.005" | 50–125 IPM | 0.003–0.007 |
| Amana 51766 | 2 | Up-Cut | 1/8" | 70–110 IPM | — |
| Amana 45624-K | 3 | — | 1/4" | 90 IPM | 0.0024 |
| Amana 45704 | 2 | — | 1/2" | 90 IPM | — |
| Amana 45982 | 2 | — | 3/4" | 80 IPM | 0.0023 |
| SpeTool W04022 | 2 | Up | 1/4" | 180 IPM | 0.005 |
| IDC Ball Nose Down-Cut | 2 | Down | 1/4" | 70 IPM | — |
| Freud 04-096 | 2 | — | 1/16" | — | 0.001008 |
| IDC "THE BEAST" | 3 | — | 1/4" | 100 IPM | — |

## Spindle Info

Designed for the **Makita RT0701C (110v)** router:
- Setting 1: ~10,000 RPM
- Setting 2: ~12,000 RPM
- Setting 3: ~16,000 RPM
- Setting 4: ~20,000 RPM
- Setting 5: ~24,000 RPM
- Setting 6: ~30,000 RPM

**Recommendation:** Stay between settings 1–2 (10,000–12,000 RPM) for most projects.

## Deployment (GitHub Pages)

This is a fully static website — no server needed.

1. Push to your GitHub repo
2. Go to repo Settings → Pages
3. Set Source to "Deploy from a branch"
4. Select `main` branch and `/ (root)` folder
5. Save — your site will be live at `https://<username>.github.io/cnc-speeds-feeds/`

## Project Structure

```
cnc-speeds-feeds/
├── index.html              # Main page with 3 tabs
├── css/
│   └── style.css           # All styling
├── js/
│   ├── tools.js            # Tool database (11 CNC bits)
│   ├── gcode-parser.js     # Gcode parser (F, S, T, Z, comments)
│   ├── analyzer.js         # Analysis engine (compares gcode vs tool specs)
│   ├── calculator.js       # Speeds & feeds calculator (Go formulas ported to JS)
│   └── app.js              # UI logic and event handlers
├── samples/
│   ├── sample.gcode        # Sample gcode for testing
│   └── edge-cases.gcode    # Edge cases (warnings, unmatched tools)
└── README.md               # This file
```

## Adding New Tools

Edit `js/tools.js` and add a new entry to the `TOOL_DATABASE` array:

```javascript
{
  id: "your-tool-id",
  name: "Brand Model",
  partNumber: "MODEL-123",
  flutes: 2,
  direction: "Up",
  type: "Spiral",
  diameter: 0.125,
  diameterStr: "1/8\"",
  feedRateMin: 80,
  feedRateMax: 120,
  feedRateStr: "80–120",
  chipLoadMin: 0.003,
  chipLoadMax: 0.005,
  depthPerPass: 0.0625,
  depthPerPassStr: "0.0625\"",
  url: "https://example.com/product"
}
```

## Tech Stack

- Pure HTML/CSS/JavaScript — no frameworks, no build step
- Runs entirely in the browser — no server required
- Compatible with GitHub Pages

## License

Personal use. Tool data sourced from manufacturer specifications.