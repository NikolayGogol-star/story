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
  let prologueRead = false;
  let lastPage = null;
  let restoredCurrent = null;
  let busy = false;
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pause = ms => new Promise(resolve => setTimeout(resolve, reducedMotion() ? 0 : ms));
  try {
    const saved = JSON.parse(localStorage.getItem(config.STORAGE_KEY));
    if (saved && Number.isInteger(saved.unlocked) && saved.unlocked >= 0 && saved.unlocked < content.length) {
      unlocked = saved.unlocked;
      opened = saved.opened === true || saved.unlocked > 0;
      prologueRead = saved.prologueRead === true || (saved.prologueRead === undefined && opened);
      if(Number.isInteger(saved.current) && saved.current >= -1 && saved.current <= unlocked) restoredCurrent = saved.current;
      if(saved.lastPage === 'cover' || (Number.isInteger(saved.lastPage) && saved.lastPage >= -1 && saved.lastPage <= unlocked)) lastPage = saved.lastPage;
      complete = saved.complete === true && unlocked === content.length - 1;
    }
  } catch (_) { /* Reading still works when storage is unavailable. */ }
  current = restoredCurrent !== null ? restoredCurrent : typeof lastPage === 'number' ? lastPage : opened && !prologueRead ? -1 : unlocked;
  function save() {
    try { localStorage.setItem(config.STORAGE_KEY, JSON.stringify({ unlocked, complete, opened, prologueRead, current, lastPage })); } catch (_) { /* Keep in-memory progress. */ }
  }
  function render(focus = false, persist = true) {
    if (persist && opened) { lastPage = current; save(); }
    const chapter = current === -1 ? window.STORY_PROLOG : content[current];
    $('title').textContent = chapter.title;
    $('subtitle').textContent = chapter.subtitle || '';
    $('subtitle').hidden = !chapter.subtitle;
    $('waiting-title').textContent = chapter.waitingTitle || '';
    $('waiting-text').textContent = chapter.waitingText || '';
    $('number').textContent = current === -1 ? 'Пролог' : `Глава ${numerals[current]}`;
    $('folio').textContent = current === -1 ? 'Пролог' : numerals[current];
    $('progress').textContent = `Открыто ${unlocked + 1} из ${content.length} глав`;
    $('feedback').after($('ending'));
    $('prose').replaceChildren(...(chapter.paragraphs.length ? chapter.paragraphs : ['Полный текст этого раздела будет добавлен.']).map((text, index) => { if(text === '[Встретиться с Автором]') return $('ending'); const p = document.createElement('p'); if((chapter.signatureParagraphs || []).includes(index)) p.classList.add('author-signature'); const tag = (chapter.boldParagraphs || []).includes(index) ? 'strong' : (chapter.italicParagraphs || []).includes(index) ? 'em' : null; if(tag) { const span = document.createElement(tag); span.textContent = text; p.append(span); } else p.textContent = text; return p; }));
    $('illustration-frame').hidden = !chapter.illustration;
    const figure = $('illustration-frame');
    $('number').before(figure);
    $('waiting').hidden = current !== unlocked || current === content.length-1;
    document.querySelector('.book').classList.toggle('final-chapter', current === content.length - 1);
    $('key-reveal').hidden = true;
    $('key-form').classList.remove('key-departing');
    if (chapter.illustration) { $('illustration').src = chapter.illustration; $('illustration').alt = chapter.illustrationAlt || ''; }
    else $('illustration').removeAttribute('src');
    const prologueButton = document.createElement('button');
    prologueButton.type='button';prologueButton.textContent='П';prologueButton.setAttribute('aria-label','Пролог');
    if(current === -1) prologueButton.setAttribute('aria-current','page');
    prologueButton.addEventListener('click',()=>{if(!busy){current=-1;render(true);}});
    $('chapters').replaceChildren(prologueButton, ...content.slice(0, unlocked + 1).map((entry, index) => {
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
    $('previous').hidden = current === -1;
    $('next').hidden = current >= unlocked;
    $('next').textContent = current === -1 ? 'Перевернуть страницу →' : 'Следующая глава →';
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
      $('feedback').textContent = 'Кажется, эта страница пока хранит свою тайну. Попробуй ещё раз';
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
  $('previous').addEventListener('click', () => { if (!busy && current > -1) { current--; render(true); } });
  $('next').addEventListener('click', async () => {
    if (busy || current >= unlocked) return;
    if (current === -1) {
      busy = true;
      const page = $('chapter');
      page.classList.add('prologue-turn');
      await pause(800);
      prologueRead = true; save(); current = 0;
      page.classList.remove('prologue-turn');
      render(true);
      page.classList.add('chapter-arrival');
      await pause(500);
      page.classList.remove('chapter-arrival');
      busy = false;
    } else { current++; render(true); }
  });
  $('telegram').addEventListener('click', event => { if ($('telegram').getAttribute('aria-disabled') === 'true') event.preventDefault(); });
  async function animateBook() {
    const canvas = $('book-cinema');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const coverImage = new Image();
    coverImage.src = './assets/cover.png';
    await Promise.race([typeof coverImage.decode === 'function' ? coverImage.decode().catch(() => {}) : new Promise(r => { coverImage.onload=r; coverImage.onerror=r; if(coverImage.complete) r(); }), new Promise(r => setTimeout(r, 1200))]);
    const rect = $('cover').getBoundingClientRect();
    const texture = document.createElement('canvas');
    texture.width = 1024; texture.height = 1536;
    const ink = texture.getContext('2d');
    if (coverImage.naturalWidth) ink.drawImage(coverImage,0,0,1024,1536);
    else { ink.fillStyle='#521b24'; ink.fillRect(0,0,1024,1536); }
    const factor = 1024/rect.width;
    function imprint(selector, lines) {
      const element = document.querySelector(selector);
      const box = element.getBoundingClientRect(), style = getComputedStyle(element);
      const size = parseFloat(style.fontSize)*factor;
      ink.font = `${style.fontStyle} ${style.fontWeight} ${size}px ${style.fontFamily}`;
      ink.fillStyle = style.color; ink.textAlign='center';
      const lineHeight = parseFloat(style.lineHeight)*factor || size*1.2;
      lines.forEach((line,i)=>ink.fillText(line,(box.left-rect.left+box.width/2)*factor,(box.top-rect.top)*factor+size*.84+i*lineHeight));
    }
    imprint('.cover-edition',['ЛИЧНЫЙ ЭКЗЕМПЛЯР']);
    // Wrap the title using the same available width and font as the HTML cover.
    const titleStyle=getComputedStyle(document.querySelector('.cover-title'));
    ink.font=`${parseFloat(titleStyle.fontSize)*factor}px ${titleStyle.fontFamily}`;
    const titleWidth=document.querySelector('.cover-title').getBoundingClientRect().width*factor;
    let titleLines=['ИСТОРИЯ,'], line='';
    for(const word of ['КОТОРОЙ','ЕЩЁ','НЕТ']) {
      const candidate=line?line+' '+word:word;
      if(line && ink.measureText(candidate).width>titleWidth){titleLines.push(line);line=word;}else line=candidate;
    }
    titleLines.push(line); imprint('.cover-title',titleLines);
    imprint('.cover-subtitle',['История в четырёх главах']);
    const buttonRect=$('open-book').getBoundingClientRect();
    ink.fillStyle='#30151c70'; ink.strokeStyle='#b69a62';ink.lineWidth=factor;
    const bx=(buttonRect.left-rect.left)*factor, by=(buttonRect.top-rect.top)*factor;
    ink.fillRect(bx,by,buttonRect.width*factor,buttonRect.height*factor);ink.strokeRect(bx,by,buttonRect.width*factor,buttonRect.height*factor);
    ink.fillStyle='#f0d7a1';ink.font=`${parseFloat(getComputedStyle($('open-book')).fontSize)*factor}px Georgia`;ink.fillText('Открыть книгу   →',bx+buttonRect.width*factor/2,by+buttonRect.height*factor*.62);
    canvas.hidden = false;
    const width = innerWidth, height = innerHeight;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = width * ratio; canvas.height = height * ratio;
    ctx.scale(ratio, ratio);
    const targetWidth = Math.min(width * .40, 275, height * .31);
    let pw = rect.width, ph = rect.height, centerY = rect.top+rect.height/2;
    const ease = x => { x = Math.max(0, Math.min(1, x)); return x*x*(3-2*x); };
    const sheet = (spine, progress, cover = false, offset = 0) => {
      if(cover) {
        const angle=Math.PI*progress;
        ctx.save();ctx.translate(spine,centerY-ph/2);
        ctx.transform(Math.cos(angle),-Math.sin(angle)*.38,0,1,0,0);
        if(progress<.5) ctx.drawImage(texture,0,0,pw,ph);
        else {
          ctx.fillStyle='#521b24';ctx.fillRect(0,0,pw,ph);
          ctx.strokeStyle='#b69a6260';ctx.lineWidth=1;ctx.strokeRect(10,10,pw-20,ph-20);
        }
        ctx.restore();return;
      }
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

    };
    await new Promise(resolve => {
      let origin, raf;
      let finished = false;
      const finish = () => { if(finished) return; finished=true; clearTimeout(watchdog); cancelAnimationFrame(raf); window.removeEventListener('resize',finish); document.removeEventListener('visibilitychange',onVisibility); resolve(); };
      const onVisibility = () => { if(document.hidden) finish(); };
      const watchdog = setTimeout(finish,6500);
      window.addEventListener('resize',finish,{once:true});
      document.addEventListener('visibilitychange',onVisibility);
      function frame(now) {
        if(finished) return;
        if(origin === undefined) origin=now;
        const elapsed=(now-origin)/1000;
        const t=Math.max(0,elapsed-.65);
        const framing=ease(elapsed/.65);
        pw=rect.width+(targetWidth-rect.width)*framing; ph=pw*1.5;
        centerY=rect.top+rect.height/2+(height*.5-rect.top-rect.height/2)*framing;
        ctx.clearRect(0,0,width,height);
        ctx.fillStyle='#30151c';ctx.fillRect(0,0,width,height);
        const framedSpine=width/2-pw/2*(1-ease(t/1.6));
        const spine=rect.left+(framedSpine-rect.left)*framing;
        ctx.save();ctx.shadowColor='#10070b80';ctx.shadowBlur=28;ctx.shadowOffsetY=14;
        ctx.fillStyle='#521b24';
        const left=pw*Math.max(0,-Math.cos(Math.PI*ease(t/1.5)));
        ctx.fillRect(spine-left-7,centerY-ph/2-7,left+pw+14,ph+14);ctx.restore();
        // Page block with fine, closely spaced paper edges.
        for(let i=6;i>=0;i--){ctx.fillStyle=i%2?'#c9b896':'#e8dbc1';ctx.fillRect(spine,centerY-ph/2+i,pw+2,ph);}
        if(t>2.9)sheet(spine,1,false);
        sheet(spine,0,false);
        const pages=Array.from({length:7},(_,i)=>({p:ease((t-.8-i*.18)/2.1),i}));
        pages.sort((a,b)=>Math.sin(a.p*Math.PI)-Math.sin(b.p*Math.PI));
        for(const page of pages) if(page.p>0) sheet(spine,page.p,false,page.i*.18);
        if(t<1.5)sheet(spine,ease(t/1.5),true);
        const shadow=ctx.createLinearGradient(spine-18,0,spine+18,0);shadow.addColorStop(0,'#39272000');shadow.addColorStop(.5,'#39272040');shadow.addColorStop(1,'#39272000');ctx.fillStyle=shadow;ctx.fillRect(spine-18,centerY-ph/2,36,ph);
        if(t>4.25){ctx.fillStyle=`rgba(48,21,28,${ease((t-4.25)/.55)})`;ctx.fillRect(0,0,width,height);}
        if(t<4.8)raf=requestAnimationFrame(frame);else finish();
      }
      raf=requestAnimationFrame(frame);
    });
    canvas.hidden=true;
  }
  function showCover() {
    lastPage = 'cover'; save();
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
    document.body.classList.add('book-is-opening');
    try { if (!reducedMotion()) await animateBook(); } catch (_) { /* Always allow reading if drawing is unavailable. */ } finally { $('book-cinema').hidden = true; document.body.classList.remove('book-is-opening'); }
    $('cover-screen').hidden = true; $('reading-screen').hidden = false;
    current = prologueRead ? current : -1; render(true); busy = false;
  });
  window.resetAnnaStory = () => { try { localStorage.removeItem(config.STORAGE_KEY); } catch (_) {} location.reload(); };
  render(false, false);
  if (opened && lastPage !== 'cover') { $('cover-screen').hidden = true; $('reading-screen').hidden = false; }
  else showCover();
})();
