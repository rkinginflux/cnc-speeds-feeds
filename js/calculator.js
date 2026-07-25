// Speeds & Feeds Calculator
// Ported from the Go code in Rick's documentation.
// All formulas match the Go implementation:
//   SFM = 0.262 * diameter * RPM
//   RPM = (SFM * 3.82) / diameter
//   Feed Rate = RPM * flutes * chipLoad
//   Chip Load = Feed Rate / (RPM * flutes)
//   Ramp Down = Feed Rate / flutes

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

  // Full calculation from inputs
  calculate(params) {
    const { rpm, diameter, flutes, chipLoad, feedRate, mode } = params;
    const result = {};

    if (mode === 'from-chipload') {
      // User provides rpm, diameter, flutes, chipLoad → calculate feed rate
      result.sfm = this.calculateSFM(rpm, diameter);
      result.feedRate = this.calculateFeedRate(rpm, flutes, chipLoad);
      result.chipLoad = chipLoad;
      result.rampDown = this.calculateRampDown(result.feedRate, flutes);
    } else if (mode === 'from-feedrate') {
      // User provides rpm, diameter, flutes, feedRate → calculate chip load
      result.sfm = this.calculateSFM(rpm, diameter);
      result.feedRate = feedRate;
      result.chipLoad = this.calculateChipLoad(feedRate, rpm, flutes);
      result.rampDown = this.calculateRampDown(feedRate, flutes);
    } else if (mode === 'from-sfm') {
      // User provides sfm, diameter, flutes, chipLoad → calculate rpm and feed rate
      result.rpm = this.calculateRPM(params.sfm, diameter);
      result.sfm = params.sfm;
      result.feedRate = this.calculateFeedRate(result.rpm, flutes, chipLoad);
      result.chipLoad = chipLoad;
      result.rampDown = this.calculateRampDown(result.feedRate, flutes);
    }

    // Max recommended depth per pass = half the diameter
    result.maxDepthPerPass = diameter / 2;

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