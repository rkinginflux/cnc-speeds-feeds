// Main App — ties together parser, analyzer, calculator, and UI

document.addEventListener('DOMContentLoaded', () => {

  // ---- Tab switching ----
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(tc => tc.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    });
  });

  // ---- Gcode Analyzer ----
  const dropArea = document.getElementById('dropArea');
  const fileInput = document.getElementById('fileInput');
  const gcodePaste = document.getElementById('gcodePaste');
  const analyzePasteBtn = document.getElementById('analyzePasteBtn');
  const analysisResults = document.getElementById('analysisResults');
  const summaryBar = document.getElementById('summaryBar');
  const resultsDetail = document.getElementById('resultsDetail');

  // Q&A state
  let currentQaEngine = null;
  let currentParsed = null;
  let currentAnalysis = null;

  // Q&A elements
  const qaInput = document.getElementById('qaInput');
  const qaAskBtn = document.getElementById('qaAskBtn');
  const qaConversation = document.getElementById('qaConversation');
  const qaSuggestions = document.getElementById('qaSuggestions');

  // Drop area click to browse
  dropArea.addEventListener('click', () => fileInput.click());

  // Drag and drop
  dropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropArea.classList.add('dragover');
  });
  dropArea.addEventListener('dragleave', () => {
    dropArea.classList.remove('dragover');
  });
  dropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    dropArea.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  });

  function handleFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      runAnalysis(text, file.name);
    };
    reader.readAsText(file);
  }

  analyzePasteBtn.addEventListener('click', () => {
    const text = gcodePaste.value.trim();
    if (!text) {
      alert('Please paste some gcode first.');
      return;
    }
    runAnalysis(text, 'pasted gcode');
  });

  function runAnalysis(text, sourceName) {
    const parser = new GcodeParser();
    const parsed = parser.parse(text);

    const analyzer = new GcodeAnalyzer(TOOL_DATABASE);
    const analysis = analyzer.analyze(parsed);

    // Show results
    analysisResults.classList.remove('hidden');

    // Build summary bar
    const s = analysis.summary;
    summaryBar.innerHTML = '';
    summaryBar.appendChild(makeChip('warnings', `⚠️ ${s.warnings} Warning${s.warnings !== 1 ? 's' : ''}`));
    summaryBar.appendChild(makeChip('ok', `✅ ${s.ok} OK`));
    summaryBar.appendChild(makeChip('info', `ℹ️ ${s.info} Info`));
    if (s.unmatched > 0) {
      summaryBar.appendChild(makeChip('unmatched', `❓ ${s.unmatched} Unmatched Tool${s.unmatched !== 1 ? 's' : ''}`));
    }
    summaryBar.appendChild(makeChip('info', `📋 ${s.totalTools} Tool${s.totalTools !== 1 ? 's' : ''} in gcode`));

    // Build detail results
    resultsDetail.innerHTML = '';

    // File info
    const fileInfo = document.createElement('div');
    fileInfo.className = 'tool-result-card';
    fileInfo.innerHTML = `
      <div class="tool-header">
        <h3>📄 ${sourceName}</h3>
        <span class="tool-badge">${parsed.totalLines} lines</span>
      </div>
      <div class="tool-specs">
        <span class="tool-spec"><strong>Max Z Depth:</strong> ${parsed.maxZDepthAbs.toFixed(4)}"</span>
        <span class="tool-spec"><strong>Operations detected:</strong> ${parsed.operations.length}</span>
      </div>
    `;
    resultsDetail.appendChild(fileInfo);

    // Each tool result
    for (const tr of analysis.toolResults) {
      const card = document.createElement('div');
      card.className = 'tool-result-card';

      const matched = tr.matchedTool;
      const matchBadge = matched
        ? `<span class="tool-badge matched">✅ ${matched.name}</span>`
        : `<span class="tool-badge unmatched">❓ Not in database</span>`;

      let specsHtml = '';
      if (matched) {
        specsHtml = `
          <div class="tool-specs">
            <span class="tool-spec"><strong>Diameter:</strong> ${matched.diameterStr}</span>
            <span class="tool-spec"><strong>Flutes:</strong> ${matched.flutes || '—'}</span>
            <span class="tool-spec"><strong>Direction:</strong> ${matched.direction || '—'}</span>
            <span class="tool-spec"><strong>Feed Rate:</strong> ${matched.feedRateStr || '—'} IPM</span>
            <span class="tool-spec"><strong>Chip Load:</strong> ${matched.chipLoadMin ? matched.chipLoadMin + '–' + matched.chipLoadMax : '—'} in/tooth</span>
            <span class="tool-spec"><strong>Max Depth/Pass:</strong> ${matched.depthPerPassStr || '—'}</span>
          </div>
        `;
      }

      // Gcode-detected values
      let gcodeValuesHtml = `
        <div class="tool-specs">
          <span class="tool-spec"><strong>Gcode Feed Rates:</strong> ${tr.feedRates.length > 0 ? tr.feedRates.join(', ') + ' IPM' : 'None'}</span>
          <span class="tool-spec"><strong>Gcode Spindle:</strong> ${tr.spindleSpeeds.length > 0 ? tr.spindleSpeeds.join(', ') + ' RPM' : 'None'}</span>
          <span class="tool-spec"><strong>Gcode Max Z Depth:</strong> ${tr.maxDepth.toFixed(4)}"</span>
        </div>
      `;

      // Issues
      let issuesHtml = '<ul class="issue-list">';
      for (const issue of tr.issues) {
        const icon = issue.level === 'warning' ? '⚠️' : 'ℹ️';
        issuesHtml += `
          <li class="issue-item ${issue.level}">
            <span class="issue-icon">${icon}</span>
            <div>
              ${issue.category ? `<div class="issue-category">${issue.category}</div>` : ''}
              ${issue.message}
            </div>
          </li>
        `;
      }
      for (const info of tr.info) {
        const icon = info.level === 'ok' ? '✅' : 'ℹ️';
        issuesHtml += `
          <li class="issue-item ${info.level}">
            <span class="issue-icon">${icon}</span>
            <div>
              ${info.category ? `<div class="issue-category">${info.category}</div>` : ''}
              ${info.message}
            </div>
          </li>
        `;
      }
      issuesHtml += '</ul>';

      card.innerHTML = `
        <div class="tool-header">
          <h3>🔧 Tool ${tr.toolNumber}</h3>
          ${matchBadge}
        </div>
        ${specsHtml}
        ${gcodeValuesHtml}
        ${issuesHtml}
      `;
      resultsDetail.appendChild(card);
    }

    // General issues
    if (analysis.general.issues.length > 0 || analysis.general.info.length > 0) {
      const generalCard = document.createElement('div');
      generalCard.className = 'tool-result-card';
      let html = '<div class="tool-header"><h3>📋 General</h3></div><ul class="issue-list">';
      for (const issue of analysis.general.issues) {
        const icon = issue.level === 'warning' ? '⚠️' : 'ℹ️';
        html += `<li class="issue-item ${issue.level}"><span class="issue-icon">${icon}</span><div>${issue.message}</div></li>`;
      }
      for (const info of analysis.general.info) {
        const icon = info.level === 'ok' ? '✅' : 'ℹ️';
        html += `<li class="issue-item ${info.level}"><span class="issue-icon">${icon}</span><div>${info.message}</div></li>`;
      }
      html += '</ul>';
      generalCard.innerHTML = html;
      resultsDetail.appendChild(generalCard);
    }

    // Initialize Q&A engine with this analysis
    currentParsed = parsed;
    currentAnalysis = analysis;
    currentQaEngine = new QaEngine(parsed, analysis, TOOL_DATABASE);

    // Reset Q&A conversation
    qaConversation.innerHTML = '';
    renderQaSuggestions();

    // Scroll to results
    analysisResults.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function makeChip(level, text) {
    const chip = document.createElement('span');
    chip.className = 'summary-chip ' + level;
    chip.textContent = text;
    return chip;
  }

  // ---- Q&A Engine ----

  // Generate contextual suggestion pills based on the analyzed gcode
  function renderQaSuggestions() {
    if (!currentAnalysis || currentAnalysis.toolResults.length === 0) {
      qaSuggestions.innerHTML = '';
      return;
    }

    const suggestions = [];
    const firstTool = currentAnalysis.toolResults[0];
    const firstToolName = firstTool.matchedTool ? firstTool.matchedTool.name : 'tool ' + firstTool.toolNumber;
    const firstFeedRate = firstTool.feedRates.length > 0 ? firstTool.feedRates[0] : null;

    // Always show these
    suggestions.push('What tools are being used?');
    suggestions.push('Which tools have warnings?');
    suggestions.push('Give me a summary');

    // Tool-specific suggestions
    if (firstFeedRate !== null && firstTool.matchedTool) {
      suggestions.push(`Is the feed rate of ${firstFeedRate} recommended for ${firstToolName}?`);
    }
    if (firstTool.matchedTool) {
      suggestions.push(`What is the chip load for tool ${firstTool.toolNumber}?`);
      suggestions.push(`What is the max depth for tool ${firstTool.toolNumber}?`);
    }

    // If there are warnings, add a suggestion about them
    if (currentAnalysis.summary.warnings > 0) {
      suggestions.push(`What are the warnings for tool ${firstTool.toolNumber}?`);
    }

    // Render pills
    qaSuggestions.innerHTML = '';
    for (const s of suggestions.slice(0, 6)) {
      const pill = document.createElement('span');
      pill.className = 'qa-suggestion-pill';
      pill.textContent = s;
      pill.addEventListener('click', () => {
        qaInput.value = s;
        askQuestion();
      });
      qaSuggestions.appendChild(pill);
    }
  }

  function askQuestion() {
    const question = qaInput.value.trim();
    if (!question) return;
    if (!currentQaEngine) {
      addQaMessage('question', question);
      addQaMessage('answer', 'Please analyze some gcode first, then ask questions about it.');
      return;
    }

    addQaMessage('question', question);
    const answer = currentQaEngine.ask(question);
    addQaMessage('answer', answer);

    qaInput.value = '';
    qaInput.focus();
  }

  function addQaMessage(role, text) {
    const msg = document.createElement('div');
    msg.className = 'qa-message';

    if (role === 'question') {
      msg.innerHTML = `
        <div class="qa-q">
          <div class="avatar">🧑</div>
          <div class="text">${escapeHtml(text)}</div>
        </div>
      `;
    } else {
      msg.innerHTML = `
        <div class="qa-a">
          <div class="avatar">🤖</div>
          <div class="text">${escapeHtml(text)}</div>
        </div>
      `;
    }

    qaConversation.appendChild(msg);
    qaConversation.scrollTop = qaConversation.scrollHeight;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Q&A event listeners
  qaAskBtn.addEventListener('click', askQuestion);
  qaInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      askQuestion();
    }
  });

  // ---- Calculator ----
  const calcMode = document.getElementById('calcMode');
  const grpRpm = document.getElementById('grp-rpm');
  const grpSfm = document.getElementById('grp-sfm');
  const grpChipload = document.getElementById('grp-chipload');
  const grpFeedrate = document.getElementById('grp-feedrate');
  const calcBtn = document.getElementById('calcBtn');
  const calcResetBtn = document.getElementById('calcResetBtn');
  const calcResults = document.getElementById('calcResults');

  calcMode.addEventListener('change', () => {
    const mode = calcMode.value;
    grpRpm.style.display = (mode === 'from-sfm') ? 'none' : 'block';
    grpSfm.style.display = (mode === 'from-sfm') ? 'block' : 'none';
    grpChipload.style.display = (mode === 'from-feedrate') ? 'none' : 'block';
    grpFeedrate.style.display = (mode === 'from-feedrate') ? 'block' : 'none';
  });

  calcBtn.addEventListener('click', () => {
    const mode = calcMode.value;
    const diameter = parseFloat(document.getElementById('inputDiameter').value);
    const flutes = parseInt(document.getElementById('inputFlutes').value);

    if (!diameter || !flutes) {
      alert('Please enter tool diameter and number of flutes.');
      return;
    }

    const params = { mode, diameter, flutes };

    if (mode === 'from-chipload') {
      params.rpm = parseFloat(document.getElementById('inputRPM').value);
      params.chipLoad = parseFloat(document.getElementById('inputChipLoad').value);
      if (!params.rpm || !params.chipLoad) {
        alert('Please enter RPM and Chip Load.');
        return;
      }
    } else if (mode === 'from-feedrate') {
      params.rpm = parseFloat(document.getElementById('inputRPM').value);
      params.feedRate = parseFloat(document.getElementById('inputFeedRate').value);
      if (!params.rpm || !params.feedRate) {
        alert('Please enter RPM and Feed Rate.');
        return;
      }
    } else if (mode === 'from-sfm') {
      params.sfm = parseFloat(document.getElementById('inputSFM').value);
      params.chipLoad = parseFloat(document.getElementById('inputChipLoad').value);
      if (!params.sfm || !params.chipLoad) {
        alert('Please enter SFM and Chip Load.');
        return;
      }
    }

    const result = Calculator.calculate(params);
    displayCalcResults(result, mode);
  });

  calcResetBtn.addEventListener('click', () => {
    document.querySelectorAll('.calc-form input').forEach(inp => inp.value = '');
    calcResults.classList.add('hidden');
    calcMode.value = 'from-chipload';
    calcMode.dispatchEvent(new Event('change'));
  });

  function displayCalcResults(r, mode) {
    calcResults.classList.remove('hidden');
    let html = '<h2>Results</h2>';

    if (r.rpm) {
      html += calcRow('Spindle Speed', Calculator.fmt(r.rpm, 0), 'RPM');
    }
    if (r.sfm) {
      html += calcRow('SFM', Calculator.fmt(r.sfm, 1), 'ft/min');
    }
    html += calcRow('Feed Rate', Calculator.fmt(r.feedRate, 2), 'IPM');
    html += calcRow('Chip Load', Calculator.fmt(r.chipLoad, 6), 'in/tooth');
    html += calcRow('Ramp Down', Calculator.fmt(r.rampDown, 2), 'in/flute');
    html += calcRow('Max Depth/Pass', Calculator.fmt(r.maxDepthPerPass, 4), 'in (half diameter)');

    // Matching tools
    if (r.matchingTools && r.matchingTools.length > 0) {
      html += '<div class="calc-matching-tools"><h4>Matching tools in database:</h4>';
      for (const t of r.matchingTools) {
        const feedStr = (t.feedRateMin || t.feedRateMax) ? ` (${t.feedRateMin || '—'}–${t.feedRateMax || '—'} IPM)` : '';
        html += `<span class="matching-tool-pill">${t.name}${feedStr}</span>`;
      }
      html += '</div>';
    }

    calcResults.innerHTML = html;
  }

  function calcRow(label, value, unit) {
    return `
      <div class="calc-result-row">
        <span class="label">${label}</span>
        <span><span class="value">${value}</span><span class="unit">${unit}</span></span>
      </div>
    `;
  }

  // ---- Tool Database ----
  const toolsTable = document.getElementById('toolsTable');
  const toolSearch = document.getElementById('toolSearch');

  function renderToolsTable(filter = '') {
    const lower = filter.toLowerCase();
    const filtered = TOOL_DATABASE.filter(t => {
      if (!lower) return true;
      return t.name.toLowerCase().includes(lower) ||
             (t.partNumber && t.partNumber.toLowerCase().includes(lower)) ||
             t.diameterStr.includes(lower) ||
             (t.type && t.type.toLowerCase().includes(lower));
    });

    let html = `
      <table class="tool-table">
        <thead>
          <tr>
            <th>Tool</th>
            <th>Flutes</th>
            <th>Dir</th>
            <th>Dia</th>
            <th>Type</th>
            <th>Feed Rate</th>
            <th>Chip Load</th>
            <th>Depth/Pass</th>
            <th>Link</th>
          </tr>
        </thead>
        <tbody>
    `;

    for (const t of filtered) {
      const flutes = t.flutes || '—';
      const dir = t.direction || '—';
      const feedRate = t.feedRateStr || '—';
      const chipLoad = (t.chipLoadMin || t.chipLoadMax) ? `${t.chipLoadMin}–${t.chipLoadMax}` : '—';
      const depth = t.depthPerPassStr || '—';
      const link = t.url ? `<a href="${t.url}" target="_blank">↗</a>` : '—';

      html += `
        <tr data-tool-id="${t.id}">
          <td class="tool-name">${t.name}</td>
          <td>${flutes}</td>
          <td>${dir}</td>
          <td>${t.diameterStr}</td>
          <td>${t.type || '—'}</td>
          <td>${feedRate}</td>
          <td>${chipLoad}</td>
          <td>${depth}</td>
          <td>${link}</td>
        </tr>
      `;
    }

    html += '</tbody></table>';
    if (filtered.length === 0) {
      html = '<p class="small">No tools match your search.</p>';
    }
    toolsTable.innerHTML = html;

    // Add click handlers for tool detail
    toolsTable.querySelectorAll('tr[data-tool-id]').forEach(row => {
      row.addEventListener('click', () => {
        const toolId = row.dataset.toolId;
        const tool = TOOL_DATABASE.find(t => t.id === toolId);
        if (tool) showToolModal(tool);
      });
    });
  }

  toolSearch.addEventListener('input', () => {
    renderToolsTable(toolSearch.value);
  });

  renderToolsTable();

  function showToolModal(tool) {
    const overlay = document.createElement('div');
    overlay.className = 'tool-modal-overlay';
    overlay.innerHTML = `
      <div class="tool-modal">
        <h2>${tool.name}</h2>
        <div class="spec-grid">
          <div class="spec-item"><span class="spec-label">Part Number</span><span class="spec-value">${tool.partNumber || '—'}</span></div>
          <div class="spec-item"><span class="spec-label">Type</span><span class="spec-value">${tool.type || '—'}</span></div>
          <div class="spec-item"><span class="spec-label">Flutes</span><span class="spec-value">${tool.flutes || '—'}</span></div>
          <div class="spec-item"><span class="spec-label">Direction</span><span class="spec-value">${tool.direction || '—'}</span></div>
          <div class="spec-item"><span class="spec-label">Diameter</span><span class="spec-value">${tool.diameterStr}</span></div>
          <div class="spec-item"><span class="spec-label">Angle</span><span class="spec-value">${tool.angle ? tool.angle + '°' : '—'}</span></div>
          <div class="spec-item"><span class="spec-label">Radius</span><span class="spec-value">${tool.radius ? tool.radius + '"' : '—'}</span></div>
          <div class="spec-item"><span class="spec-label">Cutting Height</span><span class="spec-value">${tool.cuttingHeight ? tool.cuttingHeight + '"' : '—'}</span></div>
          <div class="spec-item"><span class="spec-label">Shank</span><span class="spec-value">${tool.shank ? tool.shank + '"' : '—'}</span></div>
          <div class="spec-item"><span class="spec-label">Overall Length</span><span class="spec-value">${tool.overallLength ? tool.overallLength + '"' : '—'}</span></div>
          <div class="spec-item"><span class="spec-label">Chip Load</span><span class="spec-value">${(tool.chipLoadMin || tool.chipLoadMax) ? tool.chipLoadMin + '–' + tool.chipLoadMax + ' in/tooth' : '—'}</span></div>
          <div class="spec-item"><span class="spec-label">Feed Rate</span><span class="spec-value">${tool.feedRateStr ? tool.feedRateStr + ' IPM' : '—'}</span></div>
          <div class="spec-item"><span class="spec-label">Ramp Down</span><span class="spec-value">${tool.rampDown ? tool.rampDown + '"' : '—'}</span></div>
          <div class="spec-item"><span class="spec-label">Depth Per Pass</span><span class="spec-value">${tool.depthPerPassStr || '—'}</span></div>
        </div>
        ${tool.url ? `<p style="margin-top:16px"><a href="${tool.url}" target="_blank" style="color:var(--accent2)">View manufacturer page ↗</a></p>` : ''}
        <button class="btn-secondary close-btn" onclick="this.closest('.tool-modal-overlay').remove()">Close</button>
      </div>
    `;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
  }

  // ---- Keyboard shortcut: Enter in paste area to analyze ----
  gcodePaste.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      analyzePasteBtn.click();
    }
  });

}); // DOMContentLoaded