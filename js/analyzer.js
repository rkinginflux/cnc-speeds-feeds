// Gcode Analyzer
// Compares parsed gcode values against tool database specs and generates
// warnings, suggestions, and recommendations.

class GcodeAnalyzer {
  constructor(toolDatabase) {
    this.tools = toolDatabase;
    // Build a lookup index by part number and name fragments
    this._buildIndex();
  }

  _buildIndex() {
    this.partNumberIndex = new Map();
    this.nameIndex = new Map();
    this.keywordIndex = new Map();

    for (const tool of this.tools) {
      // Index by part number (lowercase, no spaces)
      if (tool.partNumber) {
        const pn = tool.partNumber.toLowerCase().replace(/\s+/g, '');
        this.partNumberIndex.set(pn, tool);
      }

      // Index by full name
      const name = tool.name.toLowerCase();
      this.nameIndex.set(name, tool);

      // Index by keywords from name and part number
      const keywords = this._extractKeywords(tool.name + " " + (tool.partNumber || ""));
      for (const kw of keywords) {
        if (!this.keywordIndex.has(kw)) {
          this.keywordIndex.set(kw, []);
        }
        this.keywordIndex.get(kw).push(tool);
      }
    }
  }

  _extractKeywords(text) {
    // Extract meaningful keywords: amana, 46202, 46202-k, spetool, w04022, freud, idc, beast, etc.
    const lower = text.toLowerCase();
    const words = lower.split(/[\s\-]+/).filter(w => w.length >= 2);
    const keywords = new Set();

    for (const w of words) {
      keywords.add(w);
    }

    // Also add compound forms like "46202-k"
    const partMatches = text.match(/\d+[-–][a-z]/gi);
    if (partMatches) {
      for (const pm of partMatches) {
        keywords.add(pm.toLowerCase().replace(/\s+/g, ''));
      }
    }

    return Array.from(keywords);
  }

  // Try to match a tool from gcode comments or tool number to the database
  matchTool(comment, toolNumber) {
    if (!comment) return null;

    const lower = comment.toLowerCase();

    // 1. Try exact part number match
    for (const [pn, tool] of this.partNumberIndex) {
      if (lower.includes(pn)) {
        return tool;
      }
    }

    // 2. Try name match
    for (const [name, tool] of this.nameIndex) {
      if (lower.includes(name)) {
        return tool;
      }
    }

    // 3. Try keyword matches — find the tool with the most keyword hits
    let bestMatch = null;
    let bestScore = 0;

    for (const [kw, tools] of this.keywordIndex) {
      if (lower.includes(kw) && kw.length >= 3) {
        for (const tool of tools) {
          const score = kw.length;
          if (score > bestScore) {
            bestScore = score;
            bestMatch = tool;
          }
        }
      }
    }

    return bestMatch;
  }

  // Core calculations (ported from the Go code)
  calculateSFM(rpm, diameter) {
    return 0.262 * diameter * rpm;
  }

  calculateRPM(sfm, diameter) {
    return (sfm * 3.82) / diameter;
  }

  calculateFeedRate(rpm, flutes, chipLoad) {
    return rpm * flutes * chipLoad;
  }

  calculateChipLoad(feedRate, rpm, flutes) {
    return feedRate / (rpm * flutes);
  }

  calculateRampDown(feedRate, flutes) {
    return feedRate / flutes;
  }

  // Main analysis function
  analyze(parsedGcode) {
    const results = [];
    const seenTools = new Set();

    for (const toolData of parsedGcode.tools) {
      const toolNumber = toolData.number;

      // Try to match this tool to our database
      let matchedTool = null;
      let matchSource = null;

      // First try matching from comments
      for (const comment of toolData.comments) {
        const match = this.matchTool(comment, toolNumber);
        if (match) {
          matchedTool = match;
          matchSource = `Comment: "${comment}"`;
          break;
        }
      }

      // Note: We only check the tool's own comments (assigned by the parser
      // based on proximity to the T command). We intentionally do NOT search
      // all comments in the file, as that would cause false matches from
      // other tools' comments.

      const result = {
        toolNumber,
        matchedTool,
        matchSource,
        feedRates: toolData.feedRates,
        spindleSpeeds: toolData.spindleSpeeds,
        maxDepth: toolData.maxDepthAbs,
        issues: [],
        info: []
      };

      if (!matchedTool) {
        result.issues.push({
          level: 'info',
          message: `Tool ${toolNumber} could not be matched to the tool database. Add a comment with the tool part number (e.g. "(Amana 46202-K)") for automatic analysis.`
        });
        results.push(result);
        continue;
      }

      result.matchedToolName = matchedTool.name;
      seenTools.add(matchedTool.id);

      // --- Analyze Feed Rate ---
      for (const fr of toolData.feedRates) {
        if (matchedTool.feedRateMin !== null && matchedTool.feedRateMin !== undefined) {
          if (fr < matchedTool.feedRateMin) {
            result.issues.push({
              level: 'warning',
              category: 'Feed Rate',
              message: `Feed rate ${fr} IPM is below the recommended minimum of ${matchedTool.feedRateMin} IPM for ${matchedTool.name}. This may cause rubbing/burning instead of proper cutting. Consider increasing to ${matchedTool.feedRateMin}–${matchedTool.feedRateMax} IPM.`
            });
          } else if (fr > matchedTool.feedRateMax) {
            result.issues.push({
              level: 'warning',
              category: 'Feed Rate',
              message: `Feed rate ${fr} IPM exceeds the recommended maximum of ${matchedTool.feedRateMax} IPM for ${matchedTool.name}. This may cause poor cut quality, bit breakage, or excessive chip load. Consider reducing to ${matchedTool.feedRateMin}–${matchedTool.feedRateMax} IPM.`
            });
          } else {
            result.info.push({
              level: 'ok',
              category: 'Feed Rate',
              message: `Feed rate ${fr} IPM is within the recommended range (${matchedTool.feedRateMin}–${matchedTool.feedRateMax} IPM) for ${matchedTool.name}.`
            });
          }
        }

        // Calculate chip load if we have spindle speed and flute count
        if (matchedTool.flutes && toolData.spindleSpeeds.length > 0) {
          for (const ss of toolData.spindleSpeeds) {
            const chipLoad = this.calculateChipLoad(fr, ss, matchedTool.flutes);
            const sfm = this.calculateSFM(ss, matchedTool.diameter);

            result.info.push({
              level: 'info',
              category: 'Calculated',
              message: `At ${ss} RPM with ${matchedTool.flutes} flutes: Chip Load = ${chipLoad.toFixed(6)} in/tooth, SFM = ${sfm.toFixed(1)} fpm`
            });

            if (matchedTool.chipLoadMin !== null && matchedTool.chipLoadMin !== undefined) {
              if (chipLoad < matchedTool.chipLoadMin) {
                result.issues.push({
                  level: 'warning',
                  category: 'Chip Load',
                  message: `Calculated chip load ${chipLoad.toFixed(6)} in/tooth is below the recommended minimum of ${matchedTool.chipLoadMin} in/tooth for ${matchedTool.name}. At ${ss} RPM, consider a feed rate of ${Math.ceil(this.calculateFeedRate(ss, matchedTool.flutes, matchedTool.chipLoadMin))} IPM or higher.`
                });
              } else if (chipLoad > matchedTool.chipLoadMax) {
                result.issues.push({
                  level: 'warning',
                  category: 'Chip Load',
                  message: `Calculated chip load ${chipLoad.toFixed(6)} in/tooth exceeds the recommended maximum of ${matchedTool.chipLoadMax} in/tooth for ${matchedTool.name}. At ${ss} RPM, consider a feed rate of ${Math.floor(this.calculateFeedRate(ss, matchedTool.flutes, matchedTool.chipLoadMax))} IPM or lower.`
                });
              } else {
                result.info.push({
                  level: 'ok',
                  category: 'Chip Load',
                  message: `Chip load ${chipLoad.toFixed(6)} in/tooth is within the recommended range (${matchedTool.chipLoadMin}–${matchedTool.chipLoadMax} in/tooth) for ${matchedTool.name}.`
                });
              }
            }
          }
        }
      }

      // --- Analyze Spindle Speed ---
      for (const ss of toolData.spindleSpeeds) {
        if (ss < 10000) {
          result.issues.push({
            level: 'warning',
            category: 'Spindle Speed',
            message: `Spindle speed ${ss} RPM is below the Makita RT0701C minimum of 10,000 RPM.`
          });
        } else if (ss > 30000) {
          result.issues.push({
            level: 'warning',
            category: 'Spindle Speed',
            message: `Spindle speed ${ss} RPM exceeds the Makita RT0701C maximum of 30,000 RPM.`
          });
        }
      }

      // --- Analyze Depth Per Pass ---
      if (toolData.maxDepthAbs > 0 && matchedTool.diameter) {
        const maxRecommendedDepth = matchedTool.diameter / 2;

        if (matchedTool.depthPerPass && matchedTool.depthPerPass > 0) {
          // Tool has a specific depth-per-pass spec
          if (matchedTool.depthPerPassNotRecommended) {
            result.issues.push({
              level: 'warning',
              category: 'Depth Per Pass',
              message: `Max Z depth ${toolData.maxDepthAbs.toFixed(4)}" detected. The listed depth per pass for ${matchedTool.name} is ${matchedTool.depthPerPassStr} — this spec is marked as NOT RECOMMENDED.`
            });
          } else if (toolData.maxDepthAbs > matchedTool.depthPerPass) {
            result.issues.push({
              level: 'warning',
              category: 'Depth Per Pass',
              message: `Max Z depth ${toolData.maxDepthAbs.toFixed(4)}" exceeds the recommended depth per pass of ${matchedTool.depthPerPass}" for ${matchedTool.name}. Consider reducing depth per pass.`
            });
          } else {
            result.info.push({
              level: 'ok',
              category: 'Depth Per Pass',
              message: `Max Z depth ${toolData.maxDepthAbs.toFixed(4)}" is within the recommended depth per pass of ${matchedTool.depthPerPass}" for ${matchedTool.name}.`
            });
          }
        }

        // General rule: depth per pass should not exceed half the cutting diameter
        if (toolData.maxDepthAbs > maxRecommendedDepth) {
          result.issues.push({
            level: 'warning',
            category: 'Depth Per Pass',
            message: `Max Z depth ${toolData.maxDepthAbs.toFixed(4)}" exceeds half the tool diameter (${maxRecommendedDepth.toFixed(4)}") for ${matchedTool.name} (dia: ${matchedTool.diameterStr}). General rule: depth per pass should not exceed half the cutting diameter.`
          });
        }
      }

      // --- Analyze Ramp Down ---
      if (matchedTool.rampDown && matchedTool.flutes) {
        for (const fr of toolData.feedRates) {
          const calculatedRampDown = this.calculateRampDown(fr, matchedTool.flutes);
          if (calculatedRampDown > matchedTool.rampDown) {
            result.issues.push({
              level: 'warning',
              category: 'Ramp Down',
              message: `Calculated ramp down ${calculatedRampDown.toFixed(2)}" exceeds the recommended ${matchedTool.rampDown}" for ${matchedTool.name}. Consider reducing feed rate or ramp angle.`
            });
          }
        }
      }

      // --- Small Bit Warning (bits under 1/8") ---
      // Source: Easel articles warn that bits under 1/8" (especially under 1/16")
      // need more conservative settings and are prone to breaking.
      if (matchedTool.diameter && matchedTool.diameter < 0.125) {
        result.issues.push({
          level: 'warning',
          category: 'Small Bit',
          message: `${matchedTool.name} has a small cutting diameter (${matchedTool.diameterStr}). Bits under 1/8" require conservative settings — reduce depth per pass and feed rate to avoid breaking the delicate tip.`
        });
      } else if (matchedTool.diameter && matchedTool.diameter < 0.0625) {
        result.issues.push({
          level: 'warning',
          category: 'Small Bit',
          message: `${matchedTool.name} has a very small cutting diameter (${matchedTool.diameterStr}). Bits under 1/16" are extremely fragile. Use very conservative depth per pass and feed rate. Consider test runs on scrap material first.`
        });
      }

      // --- Down-Cut Burning Risk ---
      // Source: Easel articles note that down-cut bits push chips downward,
      // making them prone to melting/burning, especially with many passes.
      if (matchedTool.direction && matchedTool.direction.toLowerCase().includes('down')) {
        result.info.push({
          level: 'info',
          category: 'Bit Direction',
          message: `${matchedTool.name} is a down-cut bit. Down-cut bits push chips downward, which can cause melting or burning in materials prone to heat. They're good for thin materials (holds them down) but consider an up-cut bit for plastics or deep cuts.`
        });
      }

      // --- Flute Count Implications ---
      // Source: Easel articles explain that more flutes = smoother finish
      // but need slower feed; fewer flutes = faster removal but rougher edges.
      if (matchedTool.flutes) {
        if (matchedTool.flutes >= 4) {
          result.info.push({
            level: 'info',
            category: 'Flutes',
            message: `${matchedTool.name} has ${matchedTool.flutes} flutes. More flutes produce a smoother edge finish but have less space for chip evacuation. Use a slower feed rate and avoid deep cuts in soft/meltable materials (plastics, HDPE).`
          });
        } else if (matchedTool.flutes <= 1) {
          result.info.push({
            level: 'info',
            category: 'Flutes',
            message: `${matchedTool.name} has ${matchedTool.flutes} flute. Single-flute bits excel at fast material removal and chip evacuation — great for soft plastics that melt easily. Edge finish will be rougher than multi-flute bits.`
          });
        }
      }

      // --- Pass Count Calculation ---
      // Source: Easel articles: total passes = overall depth / depth per pass
      if (toolData.maxDepthAbs > 0 && matchedTool.depthPerPass && matchedTool.depthPerPass > 0) {
        const passCount = Math.ceil(toolData.maxDepthAbs / matchedTool.depthPerPass);
        result.info.push({
          level: 'info',
          category: 'Pass Count',
          message: `At max Z depth ${toolData.maxDepthAbs.toFixed(4)}" with recommended depth per pass of ${matchedTool.depthPerPass}", this tool would need approximately ${passCount} pass${passCount !== 1 ? 's' : ''}.`
        });
      }

      results.push(result);
    }

    // --- General analysis (no tool matched) ---
    const general = {
      issues: [],
      info: []
    };

    if (parsedGcode.maxZDepthAbs > 0) {
      general.info.push({
        level: 'info',
        message: `Maximum Z depth across all operations: ${parsedGcode.maxZDepthAbs.toFixed(4)}"`
      });
    }

    // Check for operations with no tool loaded
    for (const op of parsedGcode.operations) {
      if (op.tool === null || op.tool === undefined) {
        general.issues.push({
          level: 'info',
          message: `Cutting operation at line ${op.line} has no tool loaded (T command).`
        });
      }
    }

    return {
      toolResults: results,
      general,
      summary: this._buildSummary(results)
    };
  }

  _buildSummary(results) {
    let warnings = 0;
    let ok = 0;
    let info = 0;
    let unmatched = 0;

    for (const r of results) {
      for (const issue of r.issues) {
        if (issue.level === 'warning') warnings++;
        else if (issue.level === 'info') info++;
      }
      for (const i of r.info) {
        if (i.level === 'ok') ok++;
        else info++;
      }
      if (!r.matchedTool) unmatched++;
    }

    return { warnings, ok, info, unmatched, totalTools: results.length };
  }
}

// Export for Node
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GcodeAnalyzer;
}