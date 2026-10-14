(() => {
  'use strict';
  const config = window.STORY_CONFIG;
  const content = window.STORY_CONTENT;
  const $ = id => document.getElementById(id);
  const numerals = ['I', 'II', 'III', 'IV'];
  const normalize = value => String(value).normalize('NFC').toLocaleLowerCase('ru').replace(/ё/g, 'е').trim().replace(/\s+/g, ' ').replace(/[.,!?;:…。！？，]+$/u, '').trim();
  let unlocked = 0;
  let complete = false;
  let current = 0;
  try {
    const saved = JSON.parse(localStorage.getItem(config.STORAGE_KEY));
    if (saved && Number.isInteger(saved.unlocked) && saved.unlocked >= 0 && saved.unlocked < content.length) {
      unlocked = saved.unlocked;
      complete = saved.complete === true && unlocked === content.length - 1;
    }
  } catch (_) { /* Reading still works when storage is unavailable. */ }
  current = unlocked;
  function save() {
    try { localStorage.setItem(config.STORAGE_KEY, JSON.stringify({ unlocked, complete })); } catch (_) { /* Keep in-memory progress. */ }
  }
  function render(focus = false) {
    const chapter = content[current];
    $('title').textContent = chapter.title;
    $('number').textContent = `Глава ${numerals[current]}`;
    $('folio').textContent = numerals[current];
    $('progress').textContent = `Открыто ${unlocked + 1} из ${content.length} глав`;
    $('prose').replaceChildren(...chapter.paragraphs.map(text => { const p = document.createElement('p'); p.textContent = text; return p; }));
    $('illustration').hidden = !chapter.illustration;
    if (chapter.illustration) { $('illustration').src = chapter.illustration; $('illustration').alt = chapter.illustrationAlt || ''; }
    else $('illustration').removeAttribute('src');
    $('chapters').replaceChildren(...content.slice(0, unlocked + 1).map((entry, index) => {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = numerals[index];
      button.setAttribute('aria-label', `Глава ${numerals[index]}: ${entry.title}`);
      if (index === current) button.setAttribute('aria-current', 'page');
      button.addEventListener('click', () => { current = index; render(true); });
      return button;
    }));
    $('key-form').hidden = current !== unlocked || current === content.length - 1;
    $('ending').hidden = current !== content.length - 1;
    $('key').value = ''; $('feedback').textContent = '';
    $('previous').hidden = current === 0;
    $('next').hidden = current >= unlocked;
    $('chapter').classList.remove('success');
    const url = config.TELEGRAM_URL;
    const valid = /^https:\/\/t\.me\/[A-Za-z0-9_+/-]+(?:\?[^\s]*)?$/.test(url);
    $('telegram').removeAttribute('href');
    $('telegram').setAttribute('aria-disabled', String(!valid));
    if (valid) { $('telegram').href = url; $('telegram').target = '_blank'; $('telegram').rel = 'noopener noreferrer'; }
    $('telegram-note').textContent = valid ? '' : 'Адрес Автора будет добавлен перед началом истории.';
    $('chapter').style.animation = 'none';
    void $('chapter').offsetWidth;
    $('chapter').style.animation = '';
    if (focus) {
      $('chapter').focus({ preventScroll: true });
      $('chapter').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    }
  }
  $('key-form').addEventListener('submit', event => {
    event.preventDefault();
    if (current !== unlocked || current >= config.KEYS.length) return;
    if (normalize($('key').value) !== normalize(config.KEYS[current])) {
      $('feedback').textContent = 'Кажется, это ещё не тот ключ. Попробуй присмотреться внимательнее';
      return;
    }
    unlocked += 1; current = unlocked;
    complete = unlocked === content.length - 1;
    save(); render(true); $('chapter').classList.add('success');
    $('feedback').textContent = 'Следующая страница открыта.';
  });
  $('previous').addEventListener('click', () => { if (current > 0) { current--; render(true); } });
  $('next').addEventListener('click', () => { if (current < unlocked) { current++; render(true); } });
  $('telegram').addEventListener('click', event => { if ($('telegram').getAttribute('aria-disabled') === 'true') event.preventDefault(); });
  render();
})();
