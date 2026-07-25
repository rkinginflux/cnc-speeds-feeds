// Speeds & Feeds Calculator
// Ported from the Go code in Rick's documentation.
// All formulas match the Go implementation:
//   SFM = 0.262 * diameter * RPM
//   RPM = (SFM * 3.82) / diameter
//   Feed Rate = RPM * flutes * chipLoad
//   Chip Load = Feed Rate / (RPM * flutes)
//   Ramp Down = Feed Rate / flutes
//   Plunge Rate = Chip Load (30-50% of feed chip load) * flutes * RPM
// Source: Easel/Inventables support articles

const Calculator = {
  calculateSFM(rpm, diameter) {
    return 0.262 * diameter * rpm;
  },

  calculateRPM(sfm, diameter) {
    return (sfm * 3.82) / diameter;
  },

  calculateFeedRate(rpm, flutes, chipLoad) {
    return rpm * flutes * chipLoad;
  },

  calculateChipLoad(feedRate, rpm, flutes) {
    return feedRate / (rpm * flutes);
  },

  calculateRampDown(feedRate, flutes) {
    return feedRate / flutes;
  },

  // Plunge rate uses 30-50% of the feed chip load
  // Source: Easel "Calculating Your Cut Settings" article
  calculatePlungeRate(rpm, flutes, feedChipLoad, plungePercent) {
    const pct = plungePercent || 0.40; // default 40% (middle of 30-50%)
    const plungeChipLoad = feedChipLoad * pct;
    return rpm * flutes * plungeChipLoad;
  },

  // Full calculation from inputs
  calculate(params) {
    const { rpm, diameter, flutes, chipLoad, feedRate, mode } = params;
    const result = {};

    let actualRpm, actualChipLoad, actualFeedRate;

    if (mode === 'from-chipload') {
      actualRpm = rpm;
      actualChipLoad = chipLoad;
      actualFeedRate = this.calculateFeedRate(rpm, flutes, chipLoad);
      result.sfm = this.calculateSFM(rpm, diameter);
      result.feedRate = actualFeedRate;
      result.chipLoad = chipLoad;
    } else if (mode === 'from-feedrate') {
      actualRpm = rpm;
      actualFeedRate = feedRate;
      actualChipLoad = this.calculateChipLoad(feedRate, rpm, flutes);
      result.sfm = this.calculateSFM(rpm, diameter);
      result.feedRate = feedRate;
      result.chipLoad = actualChipLoad;
    } else if (mode === 'from-sfm') {
      actualRpm = this.calculateRPM(params.sfm, diameter);
      actualChipLoad = chipLoad;
      actualFeedRate = this.calculateFeedRate(actualRpm, flutes, chipLoad);
      result.rpm = actualRpm;
      result.sfm = params.sfm;
      result.feedRate = actualFeedRate;
      result.chipLoad = chipLoad;
    }

    // Ramp down
    result.rampDown = this.calculateRampDown(actualFeedRate, flutes);

    // Plunge rate at 30% and 50% of chip load (range)
    result.plungeRate30 = this.calculatePlungeRate(actualRpm, flutes, actualChipLoad, 0.30);
    result.plungeRate50 = this.calculatePlungeRate(actualRpm, flutes, actualChipLoad, 0.50);

    // Max recommended depth per pass = half the diameter
    result.maxDepthPerPass = diameter / 2;

    // Small bit warning: bits under 1/8" need conservative settings
    result.smallBitWarning = diameter < 0.125;

    // Find matching tools from the database by diameter + flutes
    result.matchingTools = [];
    if (typeof TOOL_DATABASE !== 'undefined') {
      for (const tool of TOOL_DATABASE) {
        if (tool.diameter === diameter && tool.flutes === flutes) {
          result.matchingTools.push({
            name: tool.name,
            partNumber: tool.partNumber,
            feedRateMin: tool.feedRateMin,
            feedRateMax: tool.feedRateMax,
            chipLoadMin: tool.chipLoadMin,
            chipLoadMax: tool.chipLoadMax
          });
        }
      }
    }

    return result;
  },

  // Format a number for display
  fmt(val, decimals = 2) {
    if (val === null || val === undefined || isNaN(val)) return '—';
    return Number(val).toFixed(decimals);
  }
};

// Export for Node
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Calculator;
}