(() => {
  const STORAGE_KEY = 'ug-columns:settings';
  const ROOT_ID = 'ug-cols-root';
  const MAX_COLUMNS = 10;
  const DEFAULTS = { columns: 3, width: 0, fontPx: 0 };

  if (document.getElementById(ROOT_ID)) {
    location.reload();
    return;
  }

  try { window.innerHeight = 10000; } catch (e) { /* getter on Window in strict envs */ }

  const pre =
    document.querySelector('pre.k_vI3') ||
    document.querySelector('section.s-juq pre') ||
    document.querySelector('code > pre');
  if (!pre) {
    alert('UG-cols: chord block <pre> not found on this page.');
    return;
  }
  const meta = document.querySelector('.GwtfQ');

  const pathKey = location.pathname;
  const allSettings = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  const settings = Object.assign({}, DEFAULTS, allSettings[pathKey] || {});
  if (!settings.fontPx) {
    settings.fontPx = parseInt(getComputedStyle(pre).fontSize, 10) || 13;
  }
  const saveSettings = () => {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    s[pathKey] = settings;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  };

  function readMeta() {
    const out = { Tuning: '', Key: '', Capo: '' };
    if (!meta) return out;
    meta.querySelectorAll('.NC05z').forEach(b => {
      const kids = b.querySelectorAll(':scope > span, :scope > a');
      if (kids.length < 2) return;
      const k = kids[0].textContent.replace(/[: ]+$/, '').trim();
      if (k in out) out[k] = kids[kids.length - 1].textContent.trim();
    });
    if (!out.Tuning && !out.Key && !out.Capo) {
      ['Tuning', 'Key', 'Capo'].forEach(k => {
        const labelText = k + ':';
        for (const el of meta.querySelectorAll('span, a')) {
          if (el.textContent.trim() === labelText) {
            const sib = el.nextElementSibling || el.parentElement.querySelector('a, span:not(:first-child)');
            if (sib && sib !== el) out[k] = sib.textContent.trim();
            break;
          }
        }
      });
    }
    return out;
  }

  function hasChordSpan(line) {
    return line.nodes.some(n => n.nodeType === 1 && n.matches && n.matches('span[data-name]'));
  }
  // Plain-text chord-line fallback. UG hydrates chord spans lazily as lines
  // scroll into view, so chord lines that are still below the fold (or never
  // wrapped at all in some sections) arrive as bare text. We accept a line as
  // a chord line if at least one token is chord-shaped and every other token
  // is either chord-shaped or a pure separator like `( - ) | , : /`.
  const CHORD_TOKEN = /^[A-G][#b]?[a-zA-Z0-9+\-]*(?:\/[A-G][#b]?)?$/;
  const CHORD_SEPARATOR = /^[()\-|,.:\/]+$/;
  function looksLikeChordText(text) {
    const t = text.trim();
    if (!t) return false;
    const tokens = t.split(/\s+/);
    let chordCount = 0;
    for (const tok of tokens) {
      if (CHORD_TOKEN.test(tok)) chordCount++;
      else if (!CHORD_SEPARATOR.test(tok)) return false;
    }
    return chordCount > 0;
  }
  // For lines we recognised as chord lines but UG hasn't wrapped, synthesise
  // span[data-name] elements so the styleTag rule (bold + inherited color)
  // applies. Whitespace runs are preserved as-is so column alignment matches
  // the original source.
  function wrapChordTokens(text) {
    const out = [];
    const parts = text.split(/(\s+)/);
    for (const part of parts) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        out.push(document.createTextNode(part));
      } else if (CHORD_TOKEN.test(part)) {
        const span = document.createElement('span');
        span.setAttribute('data-name', part);
        span.textContent = part;
        out.push(span);
      } else {
        out.push(document.createTextNode(part));
      }
    }
    return out;
  }
  function isTabLine(text) {
    const t = text.trim();
    return /^[A-Ga-ge]\|/.test(t) || t.indexOf('|--') !== -1;
  }
  function isChordLine(line) {
    return hasChordSpan(line) || looksLikeChordText(line.text);
  }
  function isChordOrTab(line) {
    return isChordLine(line) || isTabLine(line.text);
  }

  function splitLines(preEl) {
    const lines = [];
    let curNodes = [];
    let curText = '';
    const flush = () => {
      const line = { nodes: curNodes, text: curText };
      if (!hasChordSpan(line) && looksLikeChordText(curText)) {
        line.nodes = wrapChordTokens(curText);
      }
      lines.push(line);
      curNodes = [];
      curText = '';
    };
    const consumeText = (s) => {
      const parts = s.split('\n');
      for (let i = 0; i < parts.length; i++) {
        if (parts[i].length) {
          curNodes.push(document.createTextNode(parts[i]));
          curText += parts[i];
        }
        if (i < parts.length - 1) flush();
      }
    };
    for (const child of Array.from(preEl.childNodes)) {
      if (child.nodeType === 3) {
        consumeText(child.textContent);
      } else if (child.nodeType === 1) {
        const txt = child.textContent;
        if (txt.includes('\n')) {
          consumeText(txt);
        } else {
          curNodes.push(child.cloneNode(true));
          curText += txt;
        }
      }
    }
    if (curNodes.length || curText.length) flush();
    while (lines.length && !lines[lines.length - 1].text && !lines[lines.length - 1].nodes.length) {
      lines.pop();
    }
    return lines;
  }

  function buildUnits(lines) {
    const units = [];
    for (let i = 0; i < lines.length; ) {
      if (isChordLine(lines[i]) && i + 1 < lines.length) {
        units.push([lines[i], lines[i + 1]]);
        i += 2;
      } else {
        units.push([lines[i]]);
        i += 1;
      }
    }
    return units;
  }

  function distribute(units, n) {
    const total = units.reduce((s, u) => s + u.length, 0);
    const target = Math.ceil(total / n);
    const cols = [];
    let cur = [];
    let count = 0;
    for (const unit of units) {
      if (count > 0 && count + unit.length > target && cols.length < n - 1) {
        cols.push(cur);
        cur = [];
        count = 0;
      }
      for (const line of unit) cur.push(line);
      count += unit.length;
    }
    if (cur.length) cols.push(cur);
    while (cols.length < n) cols.push([]);
    return cols;
  }

  function colWidths(cols, requested) {
    return cols.map(col => {
      let maxLen = 0;
      for (const line of col) {
        if (isChordOrTab(line) && line.text.length > maxLen) maxLen = line.text.length;
      }
      const padded = maxLen + 4;
      return requested > 0 ? Math.min(padded, requested) : padded;
    });
  }

  function buildColumnDiv(lines) {
    const div = document.createElement('div');
    div.style.cssText =
      'white-space: pre-wrap;' +
      ' min-width: 0;' +
      ' font-family: ui-monospace, SFMono-Regular, Menlo, monospace;' +
      ' font-size: ' + settings.fontPx + 'px;' +
      ' line-height: 1.3;' +
      ' color: #111;';
    for (let i = 0; i < lines.length; i++) {
      for (const node of lines[i].nodes) div.appendChild(node);
      if (i < lines.length - 1) div.appendChild(document.createTextNode('\n'));
    }
    return div;
  }

  // ---- UI ----
  function makeBtn(label, onClick, title) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    if (title) b.title = title;
    b.style.cssText =
      'background:#333;color:#eee;border:1px solid #555;' +
      'padding:4px 10px;cursor:pointer;font:inherit;border-radius:3px;line-height:1;';
    b.addEventListener('click', onClick);
    return b;
  }

  function makeStepper(label, getValue, dec, inc) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:center;gap:4px;';
    const lab = document.createElement('span');
    lab.textContent = label;
    lab.style.cssText = 'opacity:0.7;font-size:12px;';
    const val = document.createElement('span');
    val.style.cssText = 'min-width:42px;text-align:center;font-variant-numeric:tabular-nums;';
    const sync = () => { val.textContent = getValue(); };
    sync();
    wrap.append(lab, makeBtn('−', () => { dec(); sync(); }), val, makeBtn('+', () => { inc(); sync(); }));
    wrap._update = sync;
    return wrap;
  }

  function makeChip(label, value) {
    const span = document.createElement('span');
    span.style.cssText =
      'background:#2a2a2a;color:#ccc;padding:3px 9px;border-radius:10px;' +
      'font-size:12px;white-space:nowrap;';
    span.textContent = label + ': ' + (value || '—');
    return span;
  }

  // ---- root + action bar ----
  const root = document.createElement('div');
  root.id = ROOT_ID;
  root.style.cssText =
    'position:fixed;inset:0;background:#fff;color:#000;' +
    'z-index:2147483647;overflow:auto;' +
    'padding:56px 16px 16px;' +
    'font-family:system-ui,-apple-system,Segoe UI,sans-serif;';

  const actionBar = document.createElement('div');
  actionBar.style.cssText =
    'position:fixed;top:0;left:0;right:0;height:48px;' +
    'background:#1a1a1a;color:#eee;z-index:2147483647;' +
    'display:flex;align-items:center;gap:12px;padding:0 12px;' +
    'font-size:13px;font-family:system-ui,-apple-system,Segoe UI,sans-serif;' +
    'box-shadow:0 1px 4px rgba(0,0,0,.3);' +
    'overflow-x:auto;overflow-y:hidden;';

  const colsStep = makeStepper(
    'Cols',
    () => String(settings.columns),
    () => { settings.columns = Math.max(1, settings.columns - 1); saveSettings(); render(); },
    () => { settings.columns = Math.min(MAX_COLUMNS, settings.columns + 1); saveSettings(); render(); }
  );
  const widthStep = makeStepper(
    'Width',
    () => settings.width === 0 ? 'auto' : settings.width + 'ch',
    () => {
      if (settings.width > 20) settings.width -= 10;
      else settings.width = 0;
      saveSettings(); render();
    },
    () => {
      settings.width = settings.width === 0 ? 20 : settings.width + 10;
      saveSettings(); render();
    }
  );
  const fontStep = makeStepper(
    'Font',
    () => settings.fontPx + 'px',
    () => { settings.fontPx = Math.max(8, settings.fontPx - 1); saveSettings(); render(); },
    () => { settings.fontPx = Math.min(48, settings.fontPx + 1); saveSettings(); render(); }
  );

  // Transpose: proxy UG's own buttons; read offset from UG's "Tr. N" label.
  function getUGBtn(label) {
    return document.querySelector('button[aria-label="' + label + '"]');
  }
  function getUGTranspose() {
    const sbs = document.querySelectorAll('[role="spinbutton"]');
    for (const sb of sbs) {
      const lab = sb.querySelector('label, .CF9h5');
      if (lab && lab.textContent.trim() === 'Transpose') {
        const valEl = sb.querySelector('div[aria-hidden="true"]');
        if (valEl) return valEl.textContent.trim();
      }
    }
    return 'Tr. 0';
  }
  const transposeStep = makeStepper(
    'Trans',
    () => getUGTranspose(),
    () => { const b = getUGBtn('Transpose Down'); if (b) b.click(); setTimeout(() => transposeStep._update(), 50); },
    () => { const b = getUGBtn('Transpose Up'); if (b) b.click(); setTimeout(() => transposeStep._update(), 50); }
  );

  const flatsBtn = makeBtn('♭/♯', () => {
    const b = getUGBtn('Use Flats');
    if (b) b.click();
  }, 'Toggle flats / sharps');

  const metaInfo = readMeta();
  const tuningChip = makeChip('Tuning', metaInfo.Tuning);
  const keyChip = makeChip('Key', metaInfo.Key);
  const capoChip = makeChip('Capo', metaInfo.Capo);

  const spacer = document.createElement('div');
  spacer.style.flex = '1';
  const resetBtn = makeBtn('×', () => location.reload(), 'Reload page (exit)');

  actionBar.append(
    colsStep, widthStep, fontStep, transposeStep, flatsBtn,
    tuningChip, keyChip, capoChip,
    spacer, resetBtn
  );

  const grid = document.createElement('div');
  grid.id = 'ug-cols-grid';

  // UG sets `color: var(--ug-color-text-primary)` inline on chord spans; that
  // variable resolves to a near-white inside our overlay, making chords
  // invisible. Force-inherit so they pick up the column's text color, and
  // bold them for the conventional chord look.
  const styleTag = document.createElement('style');
  styleTag.textContent =
    '#' + ROOT_ID + ' span[data-name] { color: inherit !important; font-weight: bold; }';

  root.append(styleTag, actionBar, grid);
  document.body.appendChild(root);

  // ---- render ----
  function render() {
    colsStep._update();
    widthStep._update();
    fontStep._update();
    transposeStep._update();

    const lines = splitLines(pre);
    const units = buildUnits(lines);
    const cols = distribute(units, settings.columns);
    const widths = colWidths(cols, settings.width);

    grid.style.cssText =
      'display:grid;' +
      'grid-template-columns:' + widths.map(w => w + 'ch').join(' ') + ';' +
      'gap:1.5rem;overflow-x:auto;padding-bottom:32px;';

    grid.replaceChildren();
    for (let i = 0; i < cols.length; i++) {
      const colDiv = buildColumnDiv(cols[i]);
      if (settings.width > 0) {
        colDiv.style.maxWidth = settings.width + 'ch';
        colDiv.style.overflow = 'hidden';
      }
      grid.appendChild(colDiv);
    }
  }

  render();

  // Re-render whenever UG mutates the chord block (e.g. transpose, use-flats).
  let pending = 0;
  const observer = new MutationObserver(() => {
    if (pending) return;
    pending = requestAnimationFrame(() => {
      pending = 0;
      render();
    });
  });
  observer.observe(pre, { childList: true, subtree: true, characterData: true });
})();
