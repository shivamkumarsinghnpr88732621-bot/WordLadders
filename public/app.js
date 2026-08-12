(() => {
  const form = document.getElementById('searchForm');
  const input = document.getElementById('wordInput');
  const btn = document.getElementById('samjhaoBtn');
  const resultArea = document.getElementById('resultArea');
  const historyBtn = document.getElementById('historyBtn');
  const settingsBtn = document.getElementById('settingsBtn');

  const HISTORY_KEY = 'wordladder_history_v1';
  const SETTINGS_KEY = 'wordladder_settings_v1';

  function getHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
    catch { return []; }
  }
  function saveHistory(list) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 40)));
  }
  function pushHistory(word, data) {
    const list = getHistory().filter(h => h.word.toLowerCase() !== word.toLowerCase());
    list.unshift({ word, data, ts: Date.now() });
    saveHistory(list);
  }
  function getSettings() {
    try { return { sentenceCount: 6, ...JSON.parse(localStorage.getItem(SETTINGS_KEY)) }; }
    catch { return { sentenceCount: 6 }; }
  }
  function saveSettings(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }

  function renderEmpty() {
    resultArea.innerHTML = '';
    resultArea.appendChild(document.getElementById('tpl-empty').content.cloneNode(true));
  }

  function renderLoading() {
    resultArea.innerHTML = '';
    resultArea.appendChild(document.getElementById('tpl-loading').content.cloneNode(true));
  }

  function renderError(title, msg) {
    resultArea.innerHTML = '';
    const node = document.getElementById('tpl-error').content.cloneNode(true);
    node.querySelector('h3').textContent = title;
    node.querySelector('p').textContent = msg;
    resultArea.appendChild(node);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  function highlightWord(sentence, target) {
    if (!target) return escapeHtml(sentence);
    const safe = escapeHtml(sentence);
    try {
      const re = new RegExp('(' + target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
      return safe.replace(re, '<mark>$1</mark>');
    } catch { return safe; }
  }

  function renderResult(word, data) {
    resultArea.innerHTML = '';

    const wordCard = document.createElement('div');
    wordCard.className = 'word-card';
    wordCard.innerHTML = `
      <div class="word-head">
        <h2>${escapeHtml(data.word || word)}</h2>
        <span class="pos-tag">${escapeHtml((data.wordTypes || []).join(', '))}</span>
      </div>
      <p class="phonetic">${escapeHtml(data.phonetic || '')}</p>
      <div class="rule"></div>
      <p class="meaning-en">${escapeHtml(data.meaningEnglish || '')}</p>
      <p class="meaning-hi">${escapeHtml(data.meaningHindi || '')}</p>
    `;
    resultArea.appendChild(wordCard);

    const sentences = Array.isArray(data.sentences) ? data.sentences : [];
    if (sentences.length) {
      const sCard = document.createElement('div');
      sCard.className = 'sentences-card';
      const eyebrow = document.createElement('p');
      eyebrow.className = 'sentences-eyebrow';
      eyebrow.textContent = `${sentences.length} sentences — easy se advanced tak`;
      sCard.appendChild(eyebrow);

      sentences.forEach((s, i) => {
        const row = document.createElement('div');
        row.className = 'sentence-row';
        const diffLevel = Math.max(1, Math.min(6, Number(s.difficulty) || i + 1));
        const dots = Array.from({ length: 6 }, (_, di) =>
          `<span class="${di < diffLevel ? 'on' : ''}"></span>`).join('');
        row.innerHTML = `
          <div class="sentence-num">${i + 1}</div>
          <div class="sentence-body">
            <p class="sentence-text">${highlightWord(s.text || '', s.highlight || data.word)}</p>
            <p class="sentence-note">${escapeHtml(s.explanation || '')}</p>
            <div class="difficulty">${dots}</div>
          </div>
        `;
        sCard.appendChild(row);
      });
      resultArea.appendChild(sCard);
    }

    if (data.tip) {
      const tip = document.createElement('div');
      tip.className = 'tip-bar';
      tip.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none"><path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3z" fill="currentColor"/></svg>
        <span>${escapeHtml(data.tip)}</span>
      `;
      resultArea.appendChild(tip);
    }
  }

  async function samjhao(word) {
    renderLoading();
    btn.disabled = true;
    try {
      const settings = getSettings();
      const res = await fetch('/.netlify/functions/samjhao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word, sentenceCount: Number(settings.sentenceCount) || 6 }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error (${res.status})`);
      }
      const data = await res.json();
      renderResult(word, data);
      pushHistory(word, data);
    } catch (err) {
      console.error(err);
      renderError(
        'Kuch gadbad ho gayi',
        err.message === 'Failed to fetch'
          ? 'Internet check karo, ya thodi der mein phir try karo.'
          : (err.message || 'Word samjha nahi paaya. Phir se try karo.')
      );
    } finally {
      btn.disabled = false;
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const word = input.value.trim();
    if (!word) { input.focus(); return; }
    samjhao(word);
  });

  function openHistory() {
    const node = document.getElementById('tpl-history-panel').content.cloneNode(true);
    document.body.appendChild(node);
    const backdrop = document.body.lastElementChild;
    const list = backdrop.querySelector('#historyList');
    const items = getHistory();

    if (!items.length) {
      list.innerHTML = '<p class="history-empty">Abhi tak koi word search nahi kiya</p>';
    } else {
      items.forEach(h => {
        const row = document.createElement('div');
        row.className = 'history-item';
        const d = new Date(h.ts);
        row.innerHTML = `<span class="hw">${escapeHtml(h.word)}</span><span class="ht">${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>`;
        row.addEventListener('click', () => {
          input.value = h.word;
          renderResult(h.word, h.data);
          closePanel(backdrop);
        });
        list.appendChild(row);
      });
    }

    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closePanel(backdrop); });
    backdrop.querySelector('[data-close]').addEventListener('click', () => closePanel(backdrop));
  }

  function openSettings() {
    const node = document.getElementById('tpl-settings-panel').content.cloneNode(true);
    document.body.appendChild(node);
    const backdrop = document.body.lastElementChild;
    const select = backdrop.querySelector('#sentenceCount');
    select.value = String(getSettings().sentenceCount);
    select.addEventListener('change', () => saveSettings({ sentenceCount: Number(select.value) }));

    backdrop.querySelector('#clearHistoryBtn').addEventListener('click', () => {
      localStorage.removeItem(HISTORY_KEY);
      closePanel(backdrop);
    });
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closePanel(backdrop); });
    backdrop.querySelector('[data-close]').addEventListener('click', () => closePanel(backdrop));
  }

  function closePanel(backdrop) { backdrop.remove(); }

  historyBtn.addEventListener('click', openHistory);
  settingsBtn.addEventListener('click', openSettings);

  renderEmpty();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
})();
