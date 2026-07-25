// Gcode Q&A Engine
// Answers natural-language questions about parsed gcode and analysis results.
// Works entirely client-side — no server, no API calls.

class QaEngine {
  constructor(parsed, analysis, toolDatabase) {
    this.parsed = parsed;
    this.analysis = analysis;
    this.tools = toolDatabase;
    this._buildToolIndex();
  }

  _buildToolIndex() {
    // Map tool numbers to analysis results
    this.toolResultsMap = new Map();
    for (const tr of this.analysis.toolResults) {
      this.toolResultsMap.set(tr.toolNumber, tr);
    }
  }

  // Main entry point — takes a question string, returns an answer string
  ask(question) {
    const q = question.toLowerCase().trim();
    if (!q) return "Please ask a question about your gcode.";

    // Route to the matching handler
    const handlers = [
      this._qFeedRateRecommendation,    // "is feed rate 180 recommended for X"
      this._qWhatFeedRate,              // "what feed rate is tool 1 using"
      this._qRecommendedFeedRate,       // "what is the recommended feed rate for tool 1"
      this._qChipLoad,                  // "what is the chip load for tool 2"
      this._qRPM,                       // "what rpm is tool 1 using" / "what spindle speed"
      this._qSFM,                       // "what is the sfm for tool 1"
      this._qDepth,                     // "what is the max depth for tool 1" / "how deep"
      this._qDepthRecommendation,       // "is the depth ok for tool 1" / "is depth within spec"
      this._qToolsList,                 // "what tools are being used" / "which tools"
      this._qWarnings,                  // "which tools have warnings" / "are there any issues"
      this._qToolWarnings,              // "what are the warnings for tool 1"
      this._qHighestFeedRate,           // "which tool has the highest feed rate"
      this._qLowestFeedRate,            // "which tool has the lowest feed rate"
      this._qSummary,                   // "give me a summary" / "overview"
      this._qMaxDepthOverall,           // "what is the maximum depth in this gcode"
      this._qSpindleRange,              // "is the spindle speed ok" / "is rpm in range"
      this._qUnmatched,                 // "which tools are not in the database"
      this._qRampDown,                  // "what is the ramp down for tool 1"
      this._qToolMatch,                 // "what tool is tool 1" / "which bit is tool 3"
      this._qHelp,                      // "what can I ask" / "help"
    ];

    for (const handler of handlers) {
      const result = handler.call(this, q, question);
      if (result !== null) return result;
    }

    // Fallback — try to find relevant info
    return this._fallback(q, question);
  }

  // Extract tool number from question (e.g. "tool 1", "tool 3", "T1")
  _extractToolNumber(q) {
    const patterns = [
      /tool\s*(\d+)/i,
      /\bt(\d+)\b/i,
      /\bt\s*(\d+)/i,
    ];
    for (const p of patterns) {
      const m = q.match(p);
      if (m) return parseInt(m[1]);
    }
    return null;
  }

  // Find a tool in the database by name fragment
  _findToolByName(q) {
    for (const tool of this.tools) {
      const name = tool.name.toLowerCase();
      const pn = (tool.partNumber || '').toLowerCase();
      // Check if any significant part of the tool name/part number is in the question
      if (q.includes(pn) && pn.length > 3) return tool;
      if (q.includes(name)) return tool;
      // Try partial part number (e.g. "46202" in "46202-k")
      const pnBase = pn.split(/[-\s]/)[0];
      if (pnBase.length > 3 && q.includes(pnBase)) return tool;
    }
    return null;
  }

  // Find the analysis result for a tool, either by tool number or name match
  _findToolResult(q) {
    // By tool number
    const toolNum = this._extractToolNumber(q);
    if (toolNum !== null && this.toolResultsMap.has(toolNum)) {
      return this.toolResultsMap.get(toolNum);
    }
    // By tool name in question → find which tool number it matched to
    const namedTool = this._findToolByName(q);
    if (namedTool) {
      for (const tr of this.analysis.toolResults) {
        if (tr.matchedTool && tr.matchedTool.id === namedTool.id) return tr;
      }
    }
    return null;
  }

  // Extract a numeric value from the question (e.g. "feed rate of 180", "180 ipm")
  _extractNumber(q) {
    const patterns = [
      /(?:feed(?:\s*rate)?\s*(?:of|is|at)?\s*)(\d+(?:\.\d+)?)/i,
      /(\d+(?:\.\d+)?)\s*(?:ipm|in\/min)/i,
      /(\d+(?:\.\d+)?)\s*(?:rpm)/i,
      /\b(\d+(?:\.\d+)?)\b/,
    ];
    for (const p of patterns) {
      const m = q.match(p);
      if (m) return parseFloat(m[1]);
    }
    return null;
  }

  // === Handlers ===

  _qHelp(q) {
    if (q.includes('help') || q.includes('what can i ask') || q.includes('what can you do') || q === '?') {
      return [
        "Here are some questions you can ask about your gcode:",
        "",
        "  • \"Is the feed rate of 180 recommended for Amana 46202-K?\"",
        "  • \"What feed rate is tool 1 using?\"",
        "  • \"What is the recommended feed rate for tool 1?\"",
        "  • \"What is the chip load for tool 2?\"",
        "  • \"What RPM is tool 1 using?\"",
        "  • \"What is the SFM for tool 1?\"",
        "  • \"What is the max depth for tool 1?\"",
        "  • \"Is the depth OK for tool 1?\"",
        "  • \"What tools are being used?\"",
        "  • \"Which tools have warnings?\"",
        "  • \"What are the warnings for tool 1?\"",
        "  • \"Which tool has the highest feed rate?\"",
        "  • \"What is the maximum depth in this gcode?\"",
        "  • \"Is the spindle speed OK for tool 1?\"",
        "  • \"What is the ramp down for tool 1?\"",
        "  • \"What bit is tool 1?\"",
        "  • \"Give me a summary\"",
        "",
        "You can refer to tools by number (tool 1, T1) or by name (Amana 46202-K).",
      ].join('\n');
    }
    return null;
  }

  _qFeedRateRecommendation(q) {
    // "is feed rate 180 recommended for amana 46202-k" or "is 180 ipm ok for tool 1"
    if (!(q.includes('feed') && (q.includes('recommend') || q.includes('ok') || q.includes('safe') || q.includes('good') || q.includes('appropriate')))) return null;

    const tr = this._findToolResult(q);
    if (!tr) return null;
    if (!tr.matchedTool) {
      return `Tool ${tr.toolNumber} could not be matched to the tool database, so I can't verify if the feed rate is recommended. Add a comment with the tool part number in your gcode for automatic matching.`;
    }

    const feedRate = this._extractNumber(q);
    const tool = tr.matchedTool;

    if (feedRate === null) {
      // No specific number — check all feed rates used by this tool
      if (tr.feedRates.length === 0) return `No feed rates detected for tool ${tr.toolNumber} (${tool.name}).`;
      let response = `Tool ${tr.toolNumber} (${tool.name}) uses feed rate(s): ${tr.feedRates.join(', ')} IPM.\n\n`;
      response += `Recommended range: ${tool.feedRateMin}–${tool.feedRateMax} IPM.\n\n`;
      for (const fr of tr.feedRates) {
        if (fr < tool.feedRateMin) {
          response += `  ⚠️ ${fr} IPM is BELOW the recommended minimum of ${tool.feedRateMin} IPM. This may cause rubbing or burning.\n`;
        } else if (fr > tool.feedRateMax) {
          response += `  ⚠️ ${fr} IPM EXCEEDS the recommended maximum of ${tool.feedRateMax} IPM. This may cause poor cut quality or bit breakage.\n`;
        } else {
          response += `  ✅ ${fr} IPM is within the recommended range.\n`;
        }
      }
      return response.trim();
    }

    // Specific feed rate value asked about
    if (feedRate < tool.feedRateMin) {
      return `⚠️ No, a feed rate of ${feedRate} IPM is NOT recommended for ${tool.name}. The recommended range is ${tool.feedRateMin}–${tool.feedRateMax} IPM. At ${feedRate} IPM, you're below the minimum — this may cause rubbing, burning, or premature tool wear instead of proper cutting. Consider increasing to at least ${tool.feedRateMin} IPM.`;
    } else if (feedRate > tool.feedRateMax) {
      return `⚠️ No, a feed rate of ${feedRate} IPM is NOT recommended for ${tool.name}. The recommended range is ${tool.feedRateMin}–${tool.feedRateMax} IPM. At ${feedRate} IPM, you exceed the maximum — this may cause poor cut quality, bit breakage, or excessive chip load. Consider reducing to ${tool.feedRateMax} IPM or lower.`;
    } else {
      return `✅ Yes, a feed rate of ${feedRate} IPM is within the recommended range (${tool.feedRateMin}–${tool.feedRateMax} IPM) for ${tool.name}. This should give good cut quality.`;
    }
  }

  _qWhatFeedRate(q) {
    if (!q.includes('feed') || !q.includes('what') && !q.includes('which') && !q.includes('show')) return null;
    if (q.includes('recommend') || q.includes('ok') || q.includes('safe') || q.includes('good')) return null;
    if (q.includes('highest') || q.includes('lowest') || q.includes('max') || q.includes('min')) return null;

    const tr = this._findToolResult(q);
    if (!tr) return null;

    if (tr.feedRates.length === 0) return `No feed rates (F commands) were detected for tool ${tr.toolNumber}.`;
    const toolName = tr.matchedTool ? ` (${tr.matchedTool.name})` : '';
    return `Tool ${tr.toolNumber}${toolName} uses a feed rate of ${tr.feedRates.join(', ')} IPM.`;
  }

  _qRecommendedFeedRate(q) {
    if (!(q.includes('feed') && q.includes('recommend'))) return null;
    if (q.includes('ok') || q.includes('safe') || q.includes('good') || q.includes('appropriate')) return null; // handled by _qFeedRateRecommendation

    const tr = this._findToolResult(q);
    if (!tr) return null;
    if (!tr.matchedTool) return `Tool ${tr.toolNumber} is not in the tool database, so I can't provide a recommended feed rate.`;

    const tool = tr.matchedTool;
    let response = `Recommended feed rate for ${tool.name}: ${tool.feedRateMin}–${tool.feedRateMax} IPM.\n`;
    if (tr.feedRates.length > 0) {
      response += `Your gcode uses: ${tr.feedRates.join(', ')} IPM.\n`;
      for (const fr of tr.feedRates) {
        if (fr < tool.feedRateMin) {
          response += `  ⚠️ ${fr} IPM is below the recommended minimum.\n`;
        } else if (fr > tool.feedRateMax) {
          response += `  ⚠️ ${fr} IPM exceeds the recommended maximum.\n`;
        } else {
          response += `  ✅ ${fr} IPM is within range.\n`;
        }
      }
    }
    return response.trim();
  }

  _qChipLoad(q) {
    if (!q.includes('chip') || !q.includes('load')) return null;

    const tr = this._findToolResult(q);
    if (!tr) return null;
    const toolName = tr.matchedTool ? ` (${tr.matchedTool.name})` : '';

    // Find chip load info from the analysis
    let chipLoadInfo = null;
    for (const info of tr.info) {
      if (info.message.includes('Chip Load')) {
        chipLoadInfo = info;
        break;
      }
    }

    let response = '';
    if (chipLoadInfo) {
      response = `${chipLoadInfo.message}\n`;
    }

    if (tr.matchedTool) {
      const tool = tr.matchedTool;
      if (tool.chipLoadMin !== null && tool.chipLoadMin !== undefined) {
        response += `Recommended chip load range for ${tool.name}: ${tool.chipLoadMin}–${tool.chipLoadMax} in/tooth.\n`;
      }
    }

    if (!response) {
      return `No chip load information available for tool ${tr.toolNumber}${toolName}. The tool database may not have chip load specs for this bit.`;
    }

    return response.trim();
  }

  _qRPM(q) {
    if (!(q.includes('rpm') || q.includes('spindle')) || !q.includes('what') && !q.includes('which') && !q.includes('show')) return null;
    if (q.includes('ok') || q.includes('range') || q.includes('safe') || q.includes('recommend')) return null; // handled elsewhere

    const tr = this._findToolResult(q);
    if (!tr) return null;

    if (tr.spindleSpeeds.length === 0) return `No spindle speeds (S commands) were detected for tool ${tr.toolNumber}.`;
    const toolName = tr.matchedTool ? ` (${tr.matchedTool.name})` : '';
    return `Tool ${tr.toolNumber}${toolName} runs at ${tr.spindleSpeeds.join(', ')} RPM.`;
  }

  _qSFM(q) {
    if (!q.includes('sfm') && !(q.includes('surface') && q.includes('feet'))) return null;

    const tr = this._findToolResult(q);
    if (!tr) return null;
    const toolName = tr.matchedTool ? ` (${tr.matchedTool.name})` : '';

    // Find SFM from analysis info
    let sfmInfo = null;
    for (const info of tr.info) {
      if (info.message.includes('SFM')) {
        sfmInfo = info;
        break;
      }
    }

    if (sfmInfo) {
      return `Tool ${tr.toolNumber}${toolName}: ${sfmInfo.message}`;
    }

    // Calculate it
    if (tr.matchedTool && tr.spindleSpeeds.length > 0) {
      const tool = tr.matchedTool;
      let response = '';
      for (const ss of tr.spindleSpeeds) {
        const sfm = 0.262 * tool.diameter * ss;
        response += `At ${ss} RPM with ${tool.diameterStr} diameter: SFM = ${sfm.toFixed(1)} fpm.\n`;
      }
      return response.trim();
    }

    return `Cannot calculate SFM for tool ${tr.toolNumber} — missing tool diameter or spindle speed data.`;
  }

  _qDepth(q) {
    if (!q.includes('depth') || q.includes('ok') || q.includes('safe') || q.includes('recommend') || q.includes('spec') || q.includes('within')) return null;
    if (!(q.includes('what') || q.includes('how') || q.includes('which') || q.includes('show') || q.includes('max'))) return null;

    const tr = this._findToolResult(q);
    if (!tr) return null;

    const toolName = tr.matchedTool ? ` (${tr.matchedTool.name})` : '';
    if (tr.maxDepth === 0) return `No Z-axis cutting depth was detected for tool ${tr.toolNumber}${toolName}.`;
    return `Tool ${tr.toolNumber}${toolName} has a maximum Z depth of ${tr.maxDepth.toFixed(4)}" (${this._fractionStr(tr.maxDepth)}).`;
  }

  _qDepthRecommendation(q) {
    if (!q.includes('depth')) return null;
    if (!(q.includes('ok') || q.includes('safe') || q.includes('recommend') || q.includes('spec') || q.includes('within') || q.includes('too') || q.includes('much') || q.includes('deep'))) return null;

    const tr = this._findToolResult(q);
    if (!tr) return null;
    if (!tr.matchedTool) return `Tool ${tr.toolNumber} is not in the database, so I can't verify depth recommendations.`;

    const tool = tr.matchedTool;
    const maxDepth = tr.maxDepth;
    if (maxDepth === 0) return `No cutting depth detected for tool ${tr.toolNumber} (${tool.name}).`;

    const halfDiameter = tool.diameter / 2;
    let response = `Tool ${tr.toolNumber} (${tool.name}) has a max Z depth of ${maxDepth.toFixed(4)}".\n\n`;

    // Check against half-diameter rule
    if (maxDepth > halfDiameter) {
      response += `⚠️ This exceeds half the tool diameter (${halfDiameter.toFixed(4)}"). The general rule is: depth per pass should not exceed half the cutting diameter.\n`;
    } else {
      response += `✅ This is within half the tool diameter (${halfDiameter.toFixed(4)}"), which is the general guideline.\n`;
    }

    // Check against tool-specific depth per pass
    if (tool.depthPerPass && tool.depthPerPass > 0) {
      if (tool.depthPerPassNotRecommended) {
        response += `⚠️ Note: The listed depth per pass for this tool is "${tool.depthPerPassStr}" — the manufacturer marks this as NOT RECOMMENDED.\n`;
      } else if (maxDepth > tool.depthPerPass) {
        response += `⚠️ This exceeds the recommended depth per pass of ${tool.depthPerPass}" for this tool.\n`;
      } else {
        response += `✅ This is within the tool's recommended depth per pass of ${tool.depthPerPass}".\n`;
      }
    }

    return response.trim();
  }

  _qToolsList(q) {
    if (!(q.includes('what tool') || q.includes('which tool') || q.includes('what bit') || q.includes('which bit') || q.includes('what are the tool') || q.includes('list tool') || q.includes('list the tool') || q.includes('tools are') || q.includes('tools being'))) return null;
    if (q.includes('warning') || q.includes('issue') || q.includes('problem') || q.includes('highest') || q.includes('lowest') || q.includes('not in') || q.includes('unmatched')) return null;

    if (this.analysis.toolResults.length === 0) return "No tools were detected in this gcode.";

    let lines = [`This gcode uses ${this.analysis.toolResults.length} tool${this.analysis.toolResults.length !== 1 ? 's' : ''}:`, ""];
    for (const tr of this.analysis.toolResults) {
      if (tr.matchedTool) {
        lines.push(`  Tool ${tr.toolNumber}: ${tr.matchedTool.name} (${tr.matchedTool.diameterStr}, ${tr.matchedTool.flutes || '?'} flutes, ${tr.matchedTool.direction || 'N/A'})`);
      } else {
        lines.push(`  Tool ${tr.toolNumber}: Unknown — not in tool database`);
      }
    }
    return lines.join('\n');
  }

  _qWarnings(q) {
    if (!(q.includes('warning') || q.includes('issue') || q.includes('problem') || q.includes('error') || q.includes('concern'))) return null;
    if (q.includes('tool') && this._extractToolNumber(q) !== null) return null; // handled by _qToolWarnings

    const warnings = [];
    for (const tr of this.analysis.toolResults) {
      for (const issue of tr.issues) {
        if (issue.level === 'warning') {
          warnings.push({ tool: tr.toolNumber, toolName: tr.matchedTool ? tr.matchedTool.name : 'Unknown', message: issue.message, category: issue.category });
        }
      }
    }

    if (warnings.length === 0) return `✅ No warnings detected! All tools appear to be within their recommended ranges.`;

    let lines = [`Found ${warnings.length} warning${warnings.length !== 1 ? 's' : ''}:`, ""];
    for (const w of warnings) {
      lines.push(`  ⚠️ Tool ${w.tool} (${w.toolName}) — ${w.category || 'General'}:`);
      lines.push(`     ${w.message}`);
      lines.push("");
    }
    return lines.join('\n').trim();
  }

  _qToolWarnings(q) {
    if (!(q.includes('warning') || q.includes('issue') || q.includes('problem') || q.includes('error') || q.includes('concern') || q.includes('wrong') || q.includes('bad'))) return null;

    const tr = this._findToolResult(q);
    if (!tr) return null;

    const toolName = tr.matchedTool ? ` (${tr.matchedTool.name})` : '';
    const warnings = tr.issues.filter(i => i.level === 'warning');
    const oks = tr.info.filter(i => i.level === 'ok');

    if (warnings.length === 0 && oks.length === 0) {
      return `No specific warnings or issues found for tool ${tr.toolNumber}${toolName}.`;
    }

    let lines = [`Tool ${tr.toolNumber}${toolName}:`, ""];
    if (warnings.length === 0) {
      lines.push("  ✅ No warnings — everything looks good!");
    } else {
      for (const w of warnings) {
        lines.push(`  ⚠️ ${w.category || 'General'}: ${w.message}`);
      }
    }
    if (oks.length > 0) {
      lines.push("");
      for (const ok of oks) {
        lines.push(`  ✅ ${ok.category || 'General'}: ${ok.message}`);
      }
    }
    return lines.join('\n');
  }

  _qHighestFeedRate(q) {
    if (!(q.includes('feed') && (q.includes('highest') || q.includes('fastest') || q.includes('max')))) return null;

    let highest = null;
    for (const tr of this.analysis.toolResults) {
      for (const fr of tr.feedRates) {
        if (!highest || fr > highest.feedRate) {
          highest = { feedRate: fr, toolNumber: tr.toolNumber, toolName: tr.matchedTool ? tr.matchedTool.name : 'Unknown' };
        }
      }
    }
    if (!highest) return "No feed rates were detected in this gcode.";
    return `The highest feed rate is ${highest.feedRate} IPM, used by Tool ${highest.toolNumber} (${highest.toolName}).`;
  }

  _qLowestFeedRate(q) {
    if (!(q.includes('feed') && (q.includes('lowest') || q.includes('slowest') || q.includes('min')))) return null;

    let lowest = null;
    for (const tr of this.analysis.toolResults) {
      for (const fr of tr.feedRates) {
        if (!lowest || fr < lowest.feedRate) {
          lowest = { feedRate: fr, toolNumber: tr.toolNumber, toolName: tr.matchedTool ? tr.matchedTool.name : 'Unknown' };
        }
      }
    }
    if (!lowest) return "No feed rates were detected in this gcode.";
    return `The lowest feed rate is ${lowest.feedRate} IPM, used by Tool ${lowest.toolNumber} (${lowest.toolName}).`;
  }

  _qSummary(q) {
    if (!(q.includes('summary') || q.includes('overview') || q.includes('tldr') || q.includes('overall') || (q.includes('how') && q.includes('look')))) return null;

    const s = this.analysis.summary;
    let lines = [
      `Gcode Analysis Summary`,
      `${'─'.repeat(40)}`,
      `  Tools detected:      ${s.totalTools}`,
      `  Warnings:            ${s.warnings}`,
      `  OK:                  ${s.ok}`,
      `  Info:                ${s.info}`,
      `  Unmatched tools:     ${s.unmatched}`,
      `  Max Z depth (all):   ${this.parsed.maxZDepthAbs.toFixed(4)}"`,
      `  Total operations:    ${this.parsed.operations.length}`,
      "",
    ];

    if (s.warnings > 0) {
      lines.push("Key warnings:");
      for (const tr of this.analysis.toolResults) {
        const ws = tr.issues.filter(i => i.level === 'warning');
        for (const w of ws) {
          const name = tr.matchedTool ? tr.matchedTool.name : 'Unknown';
          lines.push(`  ⚠️ Tool ${tr.toolNumber} (${name}): ${w.category || 'General'}`);
        }
      }
    } else {
      lines.push("✅ No warnings — all tools appear to be within recommended ranges.");
    }

    return lines.join('\n');
  }

  _qMaxDepthOverall(q) {
    if (!(q.includes('depth') && (q.includes('overall') || q.includes('total') || q.includes('all') || q.includes('maximum') || (q.includes('max') && !q.includes('tool'))))) return null;

    if (this.parsed.maxZDepthAbs === 0) return "No Z-axis cutting depth was detected in this gcode.";
    return `The maximum Z depth across all operations is ${this.parsed.maxZDepthAbs.toFixed(4)}" (${this._fractionStr(this.parsed.maxZDepthAbs)}).`;
  }

  _qSpindleRange(q) {
    if (!(q.includes('spindle') || q.includes('rpm')) || !(q.includes('ok') || q.includes('range') || q.includes('safe') || q.includes('recommend') || q.includes('good') || q.includes('check'))) return null;

    const tr = this._findToolResult(q);
    if (!tr) {
      // General check across all tools
      let issues = [];
      for (const tr2 of this.analysis.toolResults) {
        for (const ss of tr2.spindleSpeeds) {
          if (ss < 10000 || ss > 30000) {
            const name = tr2.matchedTool ? tr2.matchedTool.name : 'Unknown';
            issues.push(`  ⚠️ Tool ${tr2.toolNumber} (${name}): ${ss} RPM is outside the Makita RT0701C range (10,000–30,000 RPM)`);
          }
        }
      }
      if (issues.length === 0) return `✅ All spindle speeds are within the Makita RT0701C range (10,000–30,000 RPM).`;
      return `Found ${issues.length} spindle speed issue(s):\n\n` + issues.join('\n');
    }

    if (tr.spindleSpeeds.length === 0) return `No spindle speeds detected for tool ${tr.toolNumber}.`;
    const toolName = tr.matchedTool ? ` (${tr.matchedTool.name})` : '';
    let response = `Tool ${tr.toolNumber}${toolName} spindle speeds: ${tr.spindleSpeeds.join(', ')} RPM.\n\n`;
    let allOk = true;
    for (const ss of tr.spindleSpeeds) {
      if (ss < 10000) {
        response += `  ⚠️ ${ss} RPM is below the Makita RT0701C minimum of 10,000 RPM.\n`;
        allOk = false;
      } else if (ss > 30000) {
        response += `  ⚠️ ${ss} RPM exceeds the Makita RT0701C maximum of 30,000 RPM.\n`;
        allOk = false;
      }
    }
    if (allOk) response += `  ✅ All spindle speeds are within the Makita RT0701C range (10,000–30,000 RPM).\n`;
    return response.trim();
  }

  _qUnmatched(q) {
    if (!(q.includes('unmatched') || q.includes('not in') || (q.includes('which') && q.includes('database')))) return null;

    const unmatched = this.analysis.toolResults.filter(tr => !tr.matchedTool);
    if (unmatched.length === 0) return `✅ All tools in this gcode were matched to the tool database.`;
    let lines = [`${unmatched.length} tool${unmatched.length !== 1 ? 's' : ''} could not be matched to the database:`, ""];
    for (const tr of unmatched) {
      lines.push(`  ❓ Tool ${tr.toolNumber} — add a comment like (Tool: Amana 46202-K) in your gcode for automatic matching.`);
    }
    return lines.join('\n');
  }

  _qRampDown(q) {
    if (!q.includes('ramp')) return null;

    const tr = this._findToolResult(q);
    if (!tr) return null;
    const toolName = tr.matchedTool ? ` (${tr.matchedTool.name})` : '';

    if (!tr.matchedTool) return `Tool ${tr.toolNumber} is not in the database — no ramp down data available.`;
    const tool = tr.matchedTool;

    if (!tool.rampDown) return `No ramp down specification available for ${tool.name}.`;

    // Check if any feed rates would cause ramp down issues
    let response = `Recommended ramp down for ${tool.name}: ${tool.rampDown}"\n\n`;
    if (tool.flutes && tr.feedRates.length > 0) {
      for (const fr of tr.feedRates) {
        const calcRamp = fr / tool.flutes;
        if (calcRamp > tool.rampDown) {
          response += `  ⚠️ At ${fr} IPM with ${tool.flutes} flutes: calculated ramp down = ${calcRamp.toFixed(2)}" (exceeds recommended ${tool.rampDown}")\n`;
        } else {
          response += `  ✅ At ${fr} IPM with ${tool.flutes} flutes: calculated ramp down = ${calcRamp.toFixed(2)}" (within recommended ${tool.rampDown}")\n`;
        }
      }
    }
    return response.trim();
  }

  _qToolMatch(q) {
    if (!(q.includes('what') && (q.includes('tool') || q.includes('bit')) || q.includes('which') && (q.includes('tool') || q.includes('bit')))) return null;
    if (q.includes('using') || q.includes('warning') || q.includes('feed') || q.includes('rpm') || q.includes('depth') || q.includes('chip') || q.includes('ramp') || q.includes('highest') || q.includes('lowest') || q.includes('recommend')) return null;

    const tr = this._findToolResult(q);
    if (!tr) return null;

    if (tr.matchedTool) {
      const tool = tr.matchedTool;
      return `Tool ${tr.toolNumber} is ${tool.name} — ${tool.type || 'CNC bit'}, ${tool.diameterStr} diameter, ${tool.flutes || '?'} flutes, ${tool.direction || 'N/A'} direction.`;
    }
    return `Tool ${tr.toolNumber} could not be identified. It's not in the tool database. Add a comment like (Tool: Amana 46202-K) in your gcode for automatic matching.`;
  }

  _fallback(q) {
    // Try to find relevant info based on keywords
    const tr = this._findToolResult(q);
    if (tr) {
      let lines = [`Tool ${tr.toolNumber}${tr.matchedTool ? ' (' + tr.matchedTool.name + ')' : ''}:`, ""];
      lines.push(`  Feed rates: ${tr.feedRates.length > 0 ? tr.feedRates.join(', ') + ' IPM' : 'none detected'}`);
      lines.push(`  Spindle speeds: ${tr.spindleSpeeds.length > 0 ? tr.spindleSpeeds.join(', ') + ' RPM' : 'none detected'}`);
      lines.push(`  Max Z depth: ${tr.maxDepth.toFixed(4)}"`);
      if (tr.matchedTool) {
        lines.push(`  Recommended feed rate: ${tr.matchedTool.feedRateMin}–${tr.matchedTool.feedRateMax} IPM`);
      }
      const warnings = tr.issues.filter(i => i.level === 'warning');
      if (warnings.length > 0) {
        lines.push("");
        lines.push(`  ⚠️ ${warnings.length} warning(s):`);
        for (const w of warnings) {
          lines.push(`     ${w.category || 'General'}: ${w.message}`);
        }
      }
      lines.push("");
      lines.push("Try asking more specific questions, or type \"help\" to see what you can ask.");
      return lines.join('\n');
    }

    return `I'm not sure how to answer that. Try asking about feed rates, spindle speeds, chip load, depth per pass, warnings, or which tools are being used. Type "help" to see example questions.`;
  }

  // Helper: convert decimal to fraction string (approximate)
  _fractionStr(val) {
    const fractions = [
      [0.0625, '1/16'], [0.125, '1/8'], [0.1875, '3/16'], [0.25, '1/4'],
      [0.3125, '5/16'], [0.375, '3/8'], [0.4375, '7/16'], [0.5, '1/2'],
      [0.5625, '9/16'], [0.625, '5/8'], [0.6875, '11/16'], [0.75, '3/4'],
      [0.875, '7/8'], [1.0, '1']
    ];
    for (const [dec, frac] of fractions) {
      if (Math.abs(val - dec) < 0.001) return frac + '"';
    }
    return val.toFixed(4) + '"';
  }
}

// Export for Node
if (typeof module !== 'undefined' && module.exports) {
  module.exports = QaEngine;
}