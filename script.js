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
  let opened = false;
  let busy = false;
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pause = ms => new Promise(resolve => setTimeout(resolve, reducedMotion() ? 0 : ms));
  try {
    const saved = JSON.parse(localStorage.getItem(config.STORAGE_KEY));
    if (saved && Number.isInteger(saved.unlocked) && saved.unlocked >= 0 && saved.unlocked < content.length) {
      unlocked = saved.unlocked;
      opened = saved.opened === true || saved.unlocked > 0;
      complete = saved.complete === true && unlocked === content.length - 1;
    }
  } catch (_) { /* Reading still works when storage is unavailable. */ }
  current = unlocked;
  function save() {
    try { localStorage.setItem(config.STORAGE_KEY, JSON.stringify({ unlocked, complete, opened })); } catch (_) { /* Keep in-memory progress. */ }
  }
  function render(focus = false) {
    const chapter = content[current];
    $('title').textContent = chapter.title;
    $('number').textContent = `Глава ${numerals[current]}`;
    $('folio').textContent = numerals[current];
    $('progress').textContent = `Открыто ${unlocked + 1} из ${content.length} глав`;
    $('prose').replaceChildren(...chapter.paragraphs.map(text => { const p = document.createElement('p'); p.textContent = text; return p; }));
    $('illustration-frame').hidden = !chapter.illustration;
    $('revelation').hidden = current !== content.length - 1;
    document.querySelector('.book').classList.toggle('final-chapter', current === content.length - 1);
    $('key-reveal').hidden = true;
    $('key-form').classList.remove('key-departing');
    if (chapter.illustration) { $('illustration').src = chapter.illustration; $('illustration').alt = chapter.illustrationAlt || ''; }
    else $('illustration').removeAttribute('src');
    $('chapters').replaceChildren(...content.slice(0, unlocked + 1).map((entry, index) => {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = numerals[index];
      button.setAttribute('aria-label', `Глава ${numerals[index]}: ${entry.title}`);
      if (index === current) button.setAttribute('aria-current', 'page');
      button.addEventListener('click', () => { if (!busy) { current = index; render(true); } });
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
  $('key-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || current !== unlocked || current >= config.KEYS.length) return;
    if (normalize($('key').value) !== normalize(config.KEYS[current])) {
      $('feedback').textContent = 'Кажется, это ещё не тот ключ. Попробуй присмотреться внимательнее';
      return;
    }
    unlocked += 1; current = unlocked;
    complete = unlocked === content.length - 1;
    save();
    busy = true;
    $('key-form').classList.add('key-departing');
    $('key').blur();
    $('feedback').textContent = '';
    await pause(250);
    $('key-form').hidden = true;
    $('key-reveal').hidden = false;
    $('key-message').textContent = 'Ключ найден';
    await pause(650);
    $('key-message').textContent = 'Следующая глава открыта';
    await pause(700);
    render(true); $('chapter').classList.add('success');
    busy = false;
  });
  $('previous').addEventListener('click', () => { if (!busy && current > 0) { current--; render(true); } });
  $('next').addEventListener('click', () => { if (!busy && current < unlocked) { current++; render(true); } });
  $('telegram').addEventListener('click', event => { if ($('telegram').getAttribute('aria-disabled') === 'true') event.preventDefault(); });
  async function animateBook() {
    const canvas = $('book-cinema');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.hidden = false;
    const width = innerWidth, height = innerHeight;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = width * ratio; canvas.height = height * ratio;
    ctx.scale(ratio, ratio);
    const pw = Math.min(width * .40, 275, height * .33), ph = pw * 1.42;
    const centerY = height * .5;
    const ease = x => { x = Math.max(0, Math.min(1, x)); return x*x*(3-2*x); };
    const sheet = (spine, progress, cover = false, offset = 0) => {
      const points = []; let x = 0, z = 0;
      const bend = Math.sin(Math.PI * progress) * (cover ? 0 : .7);
      for (let i = 0; i <= 64; i++) {
        const u = i/64;
        if (i) {
          const a = Math.PI * progress - bend * Math.sin(Math.PI * (u - .008));
          x += Math.cos(a) * pw/64; z += Math.sin(a) * pw/64;
        }
        points.push({ x:spine+x, y:centerY-ph/2-z*.38-offset, z });
      }
      // A soft contact shadow falls onto the sheets underneath.
      ctx.save(); ctx.filter = 'blur(8px)'; ctx.fillStyle = '#24140f26';
      ctx.beginPath();ctx.moveTo(spine,centerY-ph/2);
      ctx.lineTo(points[64].x+z*.15,centerY-ph/2+15);ctx.lineTo(points[64].x+z*.15,centerY+ph/2+15);ctx.lineTo(spine,centerY+ph/2);ctx.closePath();ctx.fill();ctx.restore();
      for(let i=0;i<64;i++) {
        const a=points[i], b=points[i+1];
        const tangent=Math.PI*progress-bend*Math.sin(Math.PI*(i+.5)/64);
        const light = cover ? 1 : .78 + .20*Math.abs(Math.cos(tangent)) + .04*Math.sin(i/64*Math.PI);
        ctx.fillStyle=cover ? (progress<.5 ? '#521b24' : '#642a33') : `rgb(${Math.round(244*light)},${Math.round(232*light)},${Math.round(208*light)})`;
        ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(b.x,b.y+ph);ctx.lineTo(a.x,a.y+ph);ctx.closePath();ctx.fill();
        // Overlap strip edges to avoid hairline seams during the bend.
        ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=.7;ctx.stroke();
      }
      ctx.strokeStyle=cover?'#b69a6280':'#a8937240';ctx.lineWidth=.7;
      ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
      ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y+ph):ctx.moveTo(p.x,p.y+ph));ctx.stroke();
      if(cover && progress<.3) {
        ctx.save();const scale=Math.cos(Math.PI*progress);ctx.translate(spine,centerY-ph/2);ctx.scale(scale,1);
        ctx.strokeStyle='#b69a62';ctx.lineWidth=1;ctx.strokeRect(13,13,pw-26,ph-26);
        ctx.fillStyle='#e4cea0';ctx.textAlign='center';ctx.font=`${pw*.075}px Georgia`;
        ['ИСТОРИЯ,','КОТОРОЙ ЕЩЁ','НЕТ'].forEach((line,i)=>ctx.fillText(line,pw/2,ph*.30+i*pw*.10));
        ctx.font=`italic ${pw*.045}px Georgia`;ctx.fillText('История в четырёх главах',pw/2,ph*.57);ctx.restore();
      }
    };
    await new Promise(resolve => {
      let origin;
      function frame(now) {
        if(origin === undefined) origin=now;
        const t=(now-origin)/1000;
        ctx.clearRect(0,0,width,height);
        ctx.fillStyle='#30151c';ctx.fillRect(0,0,width,height);
        const spine=width/2-pw/2*(1-ease(t/1.6));
        ctx.save();ctx.shadowColor='#10070b80';ctx.shadowBlur=28;ctx.shadowOffsetY=14;
        ctx.fillStyle='#521b24';
        const left=pw*ease(t/1.4);
        ctx.fillRect(spine-left-7,centerY-ph/2-7,left+pw+14,ph+14);ctx.restore();
        // Page block with fine, closely spaced paper edges.
        for(let i=6;i>=0;i--){ctx.fillStyle=i%2?'#c9b896':'#e8dbc1';ctx.fillRect(spine,centerY-ph/2+i,pw+2,ph);}
        if(t>1.2)sheet(spine,1,false);
        sheet(spine,0,false);
        const pages=Array.from({length:7},(_,i)=>({p:ease((t-.8-i*.18)/2.1),i}));
        pages.sort((a,b)=>Math.sin(a.p*Math.PI)-Math.sin(b.p*Math.PI));
        for(const page of pages) if(page.p>0 && page.p<1) sheet(spine,page.p,false,page.i*.18);
        if(t<1.5)sheet(spine,ease(t/1.5),true);
        const shadow=ctx.createLinearGradient(spine-18,0,spine+18,0);shadow.addColorStop(0,'#39272000');shadow.addColorStop(.5,'#39272040');shadow.addColorStop(1,'#39272000');ctx.fillStyle=shadow;ctx.fillRect(spine-18,centerY-ph/2,36,ph);
        if(t>4.25){ctx.fillStyle=`rgba(48,21,28,${ease((t-4.25)/.55)})`;ctx.fillRect(0,0,width,height);}
        if(t<4.8)requestAnimationFrame(frame);else resolve();
      }
      requestAnimationFrame(frame);
    });
    canvas.hidden=true;
  }
  function showCover() {
    $('cover-screen').hidden = false;
    $('reading-screen').hidden = true;
    $('cover').classList.remove('cover-opening');
    $('cover-screen').classList.remove('book-unfolding');
    $('turning-pages').hidden = true;
  }
  $('back-cover').addEventListener('click', () => {
    if (busy) return;
    showCover(); $('open-book').focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  $('open-book').addEventListener('click', async () => {
    if (busy) return;
    busy = true; opened = true; save();
    if (!reducedMotion()) await animateBook();
    $('cover-screen').hidden = true; $('reading-screen').hidden = false;
    current = unlocked; render(true); busy = false;
  });
  render();
  if (opened) { $('cover-screen').hidden = true; $('reading-screen').hidden = false; }
  else showCover();
})();
