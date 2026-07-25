// Gcode Parser
// Extracts feed rates (F), spindle speeds (S), tool numbers (T),
// Z-axis depths, and comments from gcode files.
// Groups movements by tool and feed rate to identify distinct cutting operations.

class GcodeParser {
  constructor() {
    this.lines = [];
    this.tools = new Map();       // toolNumber -> { number, comments, feedRates: Set, spindleSpeeds: Set, maxDepth, operations: [] }
    this.operations = [];          // flat list of all cutting operations detected
    this.globalFeedRate = null;
    this.globalSpindleSpeed = null;
    this.currentTool = null;
    this.currentFeedRate = null;
    this.currentSpindleSpeed = null;
    this.currentZ = 0;
    this.maxZDepth = 0;           // deepest Z cut (most negative Z)
    this.warnings = [];
  }

  parse(text) {
    this.lines = text.split(/\r?\n/);
    let lineNumber = 0;
    let currentComment = "";
    let operationStartZ = null;
    let currentOperation = null;

    for (const rawLine of this.lines) {
      lineNumber++;
      const line = rawLine.trim();
      if (!line) continue;

      // Extract comment (parenthetical or semicolon-style)
      let codePart = line;
      let lineComment = "";

      // Parenthetical comments: (comment)
      const parenMatch = line.match(/\(([^)]*)\)/g);
      if (parenMatch) {
        lineComment = parenMatch.map(m => m.slice(1, -1)).join(" ");
        codePart = line.replace(/\([^)]*\)/g, '').trim();
      }

      // Semicolon comments: ;comment
      const semiIdx = codePart.indexOf(';');
      if (semiIdx >= 0) {
        lineComment = (lineComment ? lineComment + " " : "") + codePart.slice(semiIdx + 1).trim();
        codePart = codePart.slice(0, semiIdx).trim();
      }

      if (!codePart) {
        // Comment-only line — might contain tool name
        if (lineComment) {
          currentComment = lineComment;
          // Try to detect tool name in comment
          this._tryMatchToolInComment(lineComment, lineNumber);
        }
        continue;
      }

      // Tokenize the code part
      const tokens = this._tokenize(codePart);

      // Process tokens
      let isMotion = false;
      let motionType = null;
      let newFeedRate = null;
      let newSpindleSpeed = null;
      let newTool = null;
      let zMove = null;

      for (const token of tokens) {
        const letter = token.letter.toUpperCase();
        const value = token.value;

        switch (letter) {
          case 'G':
            if (value === 0 || value === 0.0) { isMotion = true; motionType = 'G0 (rapid)'; }
            else if (value === 1 || value === 1.0) { isMotion = true; motionType = 'G1 (linear feed)'; }
            else if (value === 2 || value === 2.0) { isMotion = true; motionType = 'G2 (cw arc)'; }
            else if (value === 3 || value === 3.0) { isMotion = true; motionType = 'G3 (ccw arc)'; }
            break;
          case 'F':
            newFeedRate = value;
            break;
          case 'S':
            newSpindleSpeed = value;
            break;
          case 'T':
            newTool = Math.round(value);
            break;
          case 'Z':
            zMove = value;
            break;
        }
      }

      // Update current state
      if (newTool !== null) {
        this.currentTool = newTool;
        if (!this.tools.has(newTool)) {
          this.tools.set(newTool, {
            number: newTool,
            comments: [],
            feedRates: new Set(),
            spindleSpeeds: new Set(),
            maxDepth: 0,
            operations: []
          });
        }
        if (currentComment && !this.tools.get(newTool).comments.includes(currentComment)) {
          this.tools.get(newTool).comments.push(currentComment);
        }
      }

      if (newFeedRate !== null) {
        this.currentFeedRate = newFeedRate;
        if (this.currentTool !== null) {
          this.tools.get(this.currentTool).feedRates.add(newFeedRate);
        }
      }

      if (newSpindleSpeed !== null) {
        this.currentSpindleSpeed = newSpindleSpeed;
        if (this.currentTool !== null) {
          this.tools.get(this.currentTool).spindleSpeeds.add(newSpindleSpeed);
        }
      }

      // Track Z depth
      if (zMove !== null) {
        this.currentZ = zMove;
        if (zMove < this.maxZDepth) {
          this.maxZDepth = zMove;
          if (this.currentTool !== null) {
            const toolData = this.tools.get(this.currentTool);
            if (zMove < toolData.maxDepth) {
              toolData.maxDepth = zMove;
            }
          }
        }

        // Detect plunge (Z goes negative on a feed move)
        if (isMotion && motionType !== 'G0 (rapid)' && zMove < 0) {
          if (currentOperation === null || currentOperation.feedRate !== this.currentFeedRate) {
            // Start a new operation
            currentOperation = {
              tool: this.currentTool,
              feedRate: this.currentFeedRate,
              spindleSpeed: this.currentSpindleSpeed,
              zDepth: zMove,
              line: lineNumber,
              comment: currentComment
            };
            this.operations.push(currentOperation);
            if (this.currentTool !== null) {
              this.tools.get(this.currentTool).operations.push(currentOperation);
            }
          } else {
            // Update depth if deeper
            if (zMove < currentOperation.zDepth) {
              currentOperation.zDepth = zMove;
            }
          }
        }
      }

      // Record operation on linear/arc move with Z or feed change
      if (isMotion && motionType !== 'G0 (rapid)') {
        if (this.currentFeedRate !== null && this.currentTool !== null) {
          // Ensure the tool has this feed rate recorded
          this.tools.get(this.currentTool).feedRates.add(this.currentFeedRate);
        }
      }
    }

    return this._buildResult();
  }

  _tokenize(codePart) {
    const tokens = [];
    // Match letter+number patterns: G1, F180, S18000, Z-0.125, X1.5, etc.
    const regex = /([A-Za-z])\s*(-?\d*\.?\d+)/g;
    let match;
    while ((match = regex.exec(codePart)) !== null) {
      tokens.push({
        letter: match[1],
        value: parseFloat(match[2])
      });
    }
    return tokens;
  }

  _tryMatchToolInComment(comment, lineNumber) {
    // Check if comment contains a known tool part number or name
    // We'll store these for the analyzer to use
    if (!this._commentToolMatches) this._commentToolMatches = [];
    this._commentToolMatches.push({ comment, lineNumber });
  }

  _buildResult() {
    const toolsArray = [];
    for (const [num, data] of this.tools) {
      toolsArray.push({
        number: data.number,
        comments: data.comments,
        feedRates: Array.from(data.feedRates).sort((a, b) => a - b),
        spindleSpeeds: Array.from(data.spindleSpeeds).sort((a, b) => a - b),
        maxDepth: data.maxDepth,
        maxDepthAbs: Math.abs(data.maxDepth),
        operations: data.operations
      });
    }

    return {
      tools: toolsArray,
      operations: this.operations,
      maxZDepth: this.maxZDepth,
      maxZDepthAbs: Math.abs(this.maxZDepth),
      commentToolMatches: this._commentToolMatches || [],
      totalLines: this.lines.length,
      warnings: this.warnings
    };
  }
}

// Export for Node
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GcodeParser;
}