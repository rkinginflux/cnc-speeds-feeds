// CNC Reference Data
// Sourced from Easel/Inventables support articles:
// - Calculating Your Cut Settings: Basic Feeds and Speeds Information
// - Cut Depth and Depth Per Pass
// - Choosing Your Milling Bit

const REFERENCE_DATA = {

  // Troubleshooting guide from Easel article 1
  troubleshooting: [
    {
      symptom: "Dust or powder instead of chips",
      cause: "Feed rate too low, RPM too high (rubbing not cutting)",
      adjust: "Increase Feed Rate, Reduce RPM",
      why: "Increases chip load so the tool actually cuts, not polishes."
    },
    {
      symptom: "Long, stringy chips",
      cause: "Feed rate too high or poor chip evacuation",
      adjust: "Reduce Feed Rate, Improve chip clearance (air blast, upcut bit)",
      why: "Prevents overheating and tool stress."
    },
    {
      symptom: "Burn marks or smoke",
      cause: "RPM too high or feed too low",
      adjust: "Lower RPM, Increase Feed Rate, Improve cooling",
      why: "Reduces heat buildup and rubbing."
    },
    {
      symptom: "Bit breaks or dulls quickly",
      cause: "Feed too fast, depth too deep, poor rigidity",
      adjust: "Reduce Feed Rate, Reduce Depth of Cut, Check tool sharpness and clamping",
      why: "Lowers tool load and vibration."
    },
    {
      symptom: "Chatter or vibration sounds",
      cause: "Tool deflection, workpiece loose, wrong speed/feed ratio",
      adjust: "Reduce Depth/Step-over, Increase Feed Slightly, Secure workpiece, shorten tool stick-out",
      why: "Stabilizes cutting forces and harmonics."
    },
    {
      symptom: "Tear-out or fuzzy edges (wood)",
      cause: "Wrong cutter type or direction",
      adjust: "Use Down-Cut or Compression Bit, Increase RPM Slightly",
      why: "Shears fibers cleanly instead of pulling them."
    },
    {
      symptom: "Dull, gray, or discolored chips (metal)",
      cause: "Excessive heat or dull tool",
      adjust: "Reduce RPM, Apply coolant, Replace or resharpen bit",
      why: "Keeps temperature in proper range."
    },
    {
      symptom: "Tool leaves ridges or poor finish",
      cause: "Feed too high, tool deflecting, or worn bit",
      adjust: "Reduce Feed Rate, Reduce Step-over, Check runout or replace tool",
      why: "Ensures smoother passes and tighter tolerance."
    },
    {
      symptom: "Squealing or whining sound",
      cause: "Too high RPM or rubbing",
      adjust: "Lower RPM, Increase Feed Rate",
      why: "Brings chip load into optimal range, reducing friction."
    }
  ],

  // Bit education from Easel article 3
  bitTypes: [
    {
      type: "Up-Cut",
      description: "Expels cut material upward and smooths the bottom of the cut pass.",
      bestFor: "Plastics, metals, or materials prone to melting/burning. Pulls heat away from the bit.",
      caution: "Can fight the clamping system on thin materials due to upward-pulling motion.",
      icon: "⬆️"
    },
    {
      type: "Down-Cut",
      description: "Pushes chips downward (towards the material). Smooths the top edge of cuts.",
      bestFor: "Thin materials — downward pressure helps hold material to the cutting surface.",
      caution: "Prone to melting/burning because chips get pushed down instead of evacuated. Not ideal for deep cuts or plastics.",
      icon: "⬇️"
    },
    {
      type: "Compression",
      description: "Lower part uses up-cut, upper part uses down-cut. Smooths both top and bottom edges.",
      bestFor: "Thicker materials that will be cut through entirely (like plywood panels).",
      caution: "Not ideal for shallow cuts — only the bottom (up-cut) portion will be used, so the top won't get the compression benefit.",
      icon: "⬆️⬇️"
    },
    {
      type: "V-Bit (V-Carve)",
      description: "Creates a V-shaped pass. Commonly used for detailed engraving.",
      bestFor: "Engraving, signs, decorative inlays, and v-carved designs.",
      caution: "Requires CAM software that supports v-carving (like Easel Pro).",
      icon: "V"
    },
    {
      type: "Ballnose",
      description: "Rounded tip creates a rounded bottom of the cut.",
      bestFor: "3D contouring, stepped layers, and curved surfaces. Rounded tip reduces ridged edges between passes.",
      caution: "Not ideal for flat-bottom cuts or pocketing.",
      icon: "⚪"
    },
    {
      type: "Fishtail (Flat End)",
      description: "Flat tip produces a flat surface at the bottom of your cut.",
      bestFor: "Profile cutting, pocketing, and general-purpose milling.",
      caution: "Standard choice — no special cautions.",
      icon: "▬"
    },
    {
      type: "Engraving",
      description: "Very fine tip for detailed engraving work.",
      bestFor: "Fine details, signage, PCB milling.",
      caution: "Extremely fragile. Use very conservative settings. Bits under 1/16\" break easily.",
      icon: "✎"
    }
  ],

  // Flute education from Easel article 3
  fluteInfo: {
    title: "Understanding Flutes",
    content: [
      "Flutes are the cutting edges on a bit. The number of flutes affects both finish quality and chip evacuation.",
      "",
      "More flutes = smoother edge finish, but less space for chips. You'll need a slower feed rate so chips can clear properly. Good for harder materials.",
      "",
      "Fewer flutes = faster material removal with rougher edges. Better chip evacuation makes them ideal for soft materials that melt easily (like HDPE, acrylic, plastics).",
      "",
      "Single-flute bits: Best for soft plastics — maximum chip clearance prevents melting.",
      "2-flute bits: Good all-purpose choice. Balanced removal and finish.",
      "3-flute bits: Smoother finish, moderate removal rate.",
      "4+ flute bits: Smoothest finish, but need slower feeds. Not ideal for meltable materials.",
    ]
  },

  // Shank vs cutting diameter from Easel article 3
  shankVsCutting: {
    title: "Shank Diameter vs. Cutting Diameter",
    content: [
      "Shank diameter = the non-cutting part of the bit that goes into your router/collet.",
      "Cutting diameter = the actual cutting width of the bit.",
      "",
      "These are NOT always the same. Many bits have a 1/4\" shank with a smaller cutting diameter (e.g. 1/8\" or 1/16\").",
      "",
      "Always make sure the shank fits your router collet first, then choose the cutting diameter for your project.",
      "",
      "Tip: Use the largest cutting diameter your job allows. Smaller bits are more fragile and slower.",
    ]
  },

  // Key formulas reference
  formulas: [
    { name: "SFM (Surface Feet per Minute)", formula: "0.262 × Diameter × RPM" },
    { name: "RPM from SFM", formula: "(SFM × 3.82) / Diameter" },
    { name: "Feed Rate (IPM)", formula: "RPM × Flutes × Chip Load" },
    { name: "Chip Load", formula: "Feed Rate / (RPM × Flutes)" },
    { name: "Ramp Down", formula: "Feed Rate / Flutes" },
    { name: "Plunge Rate", formula: "RPM × Flutes × (Chip Load × 30-50%)" },
    { name: "Max Depth Per Pass", formula: "Cutting Diameter / 2" },
    { name: "Number of Passes", formula: "Overall Depth / Depth Per Pass" },
  ],

  // Chip load defaults from Easel article 1
  chipLoadDefaults: {
    title: "Default Chip Load Values",
    content: [
      "If you don't know your bit's chip load, 0.003\" to 0.005\" per tooth is a good starting range for most woodworking.",
      "",
      "Always check the bit manufacturer's specs first — they know the optimal chip load for their tools.",
      "",
      "Plunge rate should use a chip load that is 30-50% of your feed rate chip load. This means if your feed chip load is 0.005\", your plunge chip load should be 0.0015\" to 0.0025\".",
    ]
  },

  // Machine rigidity guidance from Easel article 1
  machineRigidity: {
    title: "Machine Rigidity",
    content: [
      "Less rigid machines (hobby-grade routers, machines with spindles that lose torque at low RPM) should use smaller depths per pass while keeping feed rate and RPM the same.",
      "",
      "This maintains the material removal rate (preventing heat from rubbing) but reduces the cutting forces by removing less material per pass.",
      "",
      "If you experience chatter, bit stalling, or poor finish, reduce depth per pass first before adjusting feed rate.",
    ]
  },

  // Depth per pass rules from Easel articles 1 + 2
  depthRules: {
    title: "Depth Per Pass Rules",
    content: [
      "General rule: depth per pass should NOT exceed half the cutting diameter of your bit.",
      "",
      "Examples:",
      "  • 1/4\" bit → max 1/8\" (0.125\") per pass",
      "  • 1/8\" bit → max 1/16\" (0.0625\") per pass",
      "  • 1/16\" bit → max 1/32\" (0.03125\") per pass",
      "",
      "These are MAXIMUM values — most settings are more conservative.",
      "",
      "For bits under 1/16\" or engraving bits, use even more conservative depth per pass to avoid breaking the tip.",
      "",
      "If you want to increase depth per pass, you'll need to reduce feed rate by 25-50% — but this isn't always optimal.",
    ]
  },

  // Spindle speed guidance
  spindleInfo: {
    name: "Makita RT0701C (110v)",
    rpmMin: 10000,
    rpmMax: 30000,
    settings: [
      { setting: 1, rpm: 10000 },
      { setting: 2, rpm: 12000 },
      { setting: 3, rpm: 16000 },
      { setting: 4, rpm: 20000 },
      { setting: 5, rpm: 24000 },
      { setting: 6, rpm: 30000 }
    ],
    note: "Recommended: stay between settings 1-2 (10,000-12,000 RPM) for most projects. Too slow = rubbing; too fast = overheating or vibration."
  }
};

// Export for Node
if (typeof module !== 'undefined' && module.exports) {
  module.exports = REFERENCE_DATA;
}