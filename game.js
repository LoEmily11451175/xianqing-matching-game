/* 閒情記趣 · 想像小花園 — 完全在瀏覽器內運作，毋須連線或帳戶。 */
(() => {
  'use strict';
  const pairs = [
    {id:'mosquito', real:'蚊子', imagined:'飛舞的鶴', detail:'小小飛蟲', symbol:'♧', note:'蚊群飛舞，宛如群鶴舞於空中。', explanation:'蚊子飛舞的姿態，讓沈復聯想到飛舞的鶴。'},
    {id:'mist', real:'煙霧', imagined:'青雲', detail:'裊裊輕煙', symbol:'☁', note:'輕煙化作青雲，群鶴在雲中飛鳴。', explanation:'噴出的煙霧，被沈復想像成讓群鶴飛鳴的青雲。'},
    {id:'grass', real:'草叢', imagined:'森林', detail:'叢草之間', symbol:'♧', note:'以叢草為林，小草變成大森林。', explanation:'沈復把叢草當作森林，小小花園便有了另一個世界。'},
    {id:'insects', real:'蟲蟻', imagined:'野獸', detail:'細小生靈', symbol:'✧', note:'以蟲蟻為獸，小蟲變成林中野獸。', explanation:'在想像的森林裏，蟲蟻成了穿梭其中的野獸。'},
    {id:'pebbles', real:'土礫', imagined:'山丘、山谷', detail:'泥土碎石', symbol:'△', note:'凸起為丘，凹下為壑。', explanation:'土礫凸起的地方成了山丘，凹下的地方則成了山谷。'},
    {id:'toad', real:'癩蝦蟆', imagined:'龐然大物', detail:'忽然出現', symbol:'✦', note:'小小癩蝦蟆，竟成了龐然大物。', explanation:'當沈復沉浸於小蟲的世界，突然出現的癩蝦蟆便像龐然大物。'}
  ];
  const $ = (id) => document.getElementById(id);
  const options = $('options'), targets = $('targets'), feedback = $('feedback');
  const completed = new Set();
  let selected = null, attempts = 0, drag = null, suppressClickUntil = 0, finishTimer = null, dragScrollFrame = null;
  let musicEnabled = true, sfxEnabled = true, audio = null, musicGain = null, sfxGain = null, musicTimer = null, nextBeat = 0, beatIndex = 0;
  const errorTimers = new Map();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
    // Never display the answers in the same order as the questions.
    if (copy.every((item, i) => item.id === items[i].id)) copy.push(copy.shift());
    return copy;
  }
  function render() {
    options.innerHTML = shuffle(pairs).map(p => `<button type="button" class="option-card" data-option="${p.id}" aria-pressed="false" aria-label="想像卡：${p.imagined}。點選後，再點選所見事物的答案格。"><span class="grip" aria-hidden="true">⠿</span><span class="option-symbol" aria-hidden="true">${p.symbol}</span><span class="option-text">${p.imagined}</span><span class="option-check" aria-hidden="true">✓</span></button>`).join('');
    targets.innerHTML = pairs.map((p,i) => `<article class="target-card" data-card="${p.id}"><span class="target-number" aria-hidden="true">0${i+1}</span><div class="target-top"><img class="target-image" src="assets/${p.id}.webp" alt="手繪${p.real}" draggable="false" width="100" height="100"><div class="target-info"><h4>${p.real}</h4><p>${p.detail}</p></div></div><button type="button" class="drop-zone" data-target="${p.id}" aria-label="${p.real}的答案格；先選一張想像卡"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12"/></svg><span>把想像卡放在這裏</span></button><p class="match-note"></p></article>`).join('');
    updateProgress();
  }
  function updateProgress() {
    $('matched-count').textContent = completed.size;
    document.querySelectorAll('.progress-dots i').forEach((dot,i) => dot.classList.toggle('filled',i < completed.size));
    document.querySelector('.progress-wrap').setAttribute('aria-label',`配對進度：${completed.size} / 6`);
  }
  function say(kind, title, description) {
    feedback.className = 'feedback-strip' + (kind ? ' ' + kind : '');
    feedback.querySelector('.feedback-icon').textContent = kind === 'correct' ? '✓' : kind === 'incorrect' ? '↻' : '✧';
    feedback.querySelector('strong').textContent = title;
    feedback.querySelector(':scope > div > span').textContent = description;
  }
  function choose(id) {
    if (completed.has(id)) return;
    selected = selected === id ? null : id;
    document.body.classList.toggle('selecting', Boolean(selected));
    document.querySelectorAll('[data-option]').forEach(button => {
      const active = button.dataset.option === selected;
      button.classList.toggle('selected',active);
      button.setAttribute('aria-pressed',String(active));
    });
    document.querySelectorAll('[data-target]').forEach(button => {
      if (button.disabled) return;
      const p = pairs.find(p => p.id === button.dataset.target);
      button.setAttribute('aria-label',selected ? `把${pairs.find(p=>p.id===selected).imagined}配對到${p.real}` : `${p.real}的答案格；先選一張想像卡`);
    });
    if (selected) say('',`已拿起「${pairs.find(p => p.id === id).imagined}」`,'點選對應的答案格，或拖動卡片完成配對。');
    else say('','讓想像力出發！','六組小發現，等你來配對。');
  }
  function clearSelection() {
    selected = null;
    document.body.classList.remove('selecting');
    document.querySelectorAll('[data-option]').forEach(button => {button.classList.remove('selected');button.setAttribute('aria-pressed','false');});
    document.querySelectorAll('[data-target]:not(:disabled)').forEach(button => {
      const p = pairs.find(p => p.id === button.dataset.target);
      button.setAttribute('aria-label',`${p.real}的答案格；先選一張想像卡`);
    });
  }
  function tryMatch(optionId,targetId) {
    if (!optionId || completed.has(optionId) || completed.has(targetId)) return;
    attempts++;
    const p = pairs.find(p => p.id === targetId);
    const card = targets.querySelector(`[data-card="${targetId}"]`);
    const zone = card.querySelector('.drop-zone');
    let result = card.querySelector('.card-result');
    if (!result) { result = document.createElement('span'); result.className = 'card-result'; card.appendChild(result); }
    clearTimeout(errorTimers.get(targetId));
    errorTimers.delete(targetId);
    card.classList.remove('error');
    if (optionId === targetId) {
      completed.add(targetId);
      clearSelection();
      const option = options.querySelector(`[data-option="${optionId}"]`);
      const hadFocus = document.activeElement === option || document.activeElement === zone;
      option.classList.add('used'); option.disabled = true;
      option.setAttribute('aria-label',`${p.imagined}，已正確配對到${p.real}`);
      card.classList.add('matched','success-pop');
      result.textContent = '回答正確';
      zone.innerHTML = `<span class="match-tick" aria-hidden="true">✓</span><span>${p.imagined}</span>`;
      zone.disabled = true;
      zone.setAttribute('aria-label',`${p.real}配對${p.imagined}，回答正確`);
      card.querySelector('.match-note').textContent = p.note;
      say('correct','回答正確',p.explanation);
      playEffect(true);
      updateProgress();
      if (hadFocus && completed.size < pairs.length) options.querySelector('.option-card:not(:disabled)')?.focus({preventScroll:true});
      if (completed.size === pairs.length) {
        say('correct','回答正確 · 六組配對全部完成！','細心觀察與豐富想像，讓沈復發現了物外之趣。');
        finishTimer = setTimeout(showCompletion,1000);
      }
    } else {
      clearSelection();
      void card.offsetWidth;
      card.classList.add('error');
      result.textContent = '回答錯誤';
      zone.innerHTML = '<span aria-hidden="true">↻</span><span>再試一次</span>';
      say('incorrect','回答錯誤','沒關係，想像卡已放回原位。再觀察一下，隨時可以重試！');
      playEffect(false);
      errorTimers.set(targetId,setTimeout(() => {
        card.classList.remove('error');
        if (!completed.has(targetId)) result.textContent = '';
        if (!completed.has(targetId)) zone.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12"/></svg><span>把想像卡放在這裏</span>';
        errorTimers.delete(targetId);
      },1200));
    }
  }

  // Pointer-based dragging supports mouse, stylus and touch, with click/keyboard alternatives.
  options.addEventListener('pointerdown', event => {
    const button = event.target.closest('[data-option]');
    if (!button || button.disabled || !event.isPrimary || event.button !== 0) return;
    unlockAudio();
    button.focus({preventScroll:true});
    drag = {id:button.dataset.option,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,button,active:false,ghost:null,hover:null};
    button.setPointerCapture(event.pointerId);
  });
  options.addEventListener('pointermove', event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.x = event.clientX; drag.y = event.clientY;
    if (!drag.active && Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY) > 7) {
      drag.active = true;
      drag.button.classList.add('dragging');
      document.body.classList.add('is-dragging','selecting');
      drag.ghost = drag.button.cloneNode(true);
      drag.ghost.removeAttribute('data-option');drag.ghost.removeAttribute('aria-label');drag.ghost.removeAttribute('aria-pressed');
      drag.ghost.setAttribute('aria-hidden','true');drag.ghost.tabIndex = -1;
      drag.ghost.className = 'option-card drag-ghost';
      document.body.appendChild(drag.ghost);
      dragScrollFrame = requestAnimationFrame(scrollWhileDragging);
    }
    if (drag.active) {event.preventDefault();moveGhost();highlightTarget();}
  });
  function moveGhost() { if (drag?.ghost) { drag.ghost.style.left = `${drag.x-106}px`; drag.ghost.style.top = `${drag.y-23}px`; } }
  function highlightTarget() {
    if (!drag) return;
    const zone = targetAt(drag.x,drag.y);
    const card = zone && !zone.disabled ? zone.closest('.target-card') : null;
    if (drag.hover !== card) { drag.hover?.classList.remove('over');card?.classList.add('over');drag.hover = card; }
  }
  function targetAt(x,y) {
    return document.elementFromPoint(x,y)?.closest('[data-card]')?.querySelector('[data-target]') || null;
  }
  function scrollWhileDragging() {
    if (!drag?.active) return;
    const edge = 58;
    if (drag.y < edge) window.scrollBy(0,-Math.ceil((edge-drag.y)/5));
    else if (drag.y > innerHeight-edge) window.scrollBy(0,Math.ceil((drag.y-(innerHeight-edge))/5));
    highlightTarget();
    dragScrollFrame = requestAnimationFrame(scrollWhileDragging);
  }
  function cleanupDrag() {
    if (!drag) return;
    drag.ghost?.remove();drag.hover?.classList.remove('over');drag.button.classList.remove('dragging');
    if (drag.button.hasPointerCapture(drag.pointerId)) drag.button.releasePointerCapture(drag.pointerId);
    cancelAnimationFrame(dragScrollFrame);
    document.body.classList.remove('is-dragging');
    document.body.classList.toggle('selecting', Boolean(selected));
    drag = null;
  }
  options.addEventListener('pointerup', event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const wasDragging = drag.active, id = drag.id;
    const zone = wasDragging ? targetAt(event.clientX,event.clientY) : null;
    cleanupDrag();
    if (wasDragging) {
      suppressClickUntil = Date.now()+350;
      if (zone && !zone.disabled) tryMatch(id,zone.dataset.target);
      else if (completed.size < pairs.length) say('','想像卡已放回原位','把卡片放進虛線答案格，或先點卡片再點答案格。');
    }
  });
  options.addEventListener('pointercancel',cleanupDrag);
  options.addEventListener('lostpointercapture',event => {if (drag?.pointerId === event.pointerId) cleanupDrag();});
  options.addEventListener('click',event => {
    const button = event.target.closest('[data-option]');
    if (!button || button.disabled || Date.now() < suppressClickUntil) return;
    unlockAudio();choose(button.dataset.option);
  });
  targets.addEventListener('click',event => {
    const zone = event.target.closest('[data-target]');
    if (!zone || zone.disabled) return;
    unlockAudio();
    if (!selected) say('','先拿起一張想像卡','點選選項區的一張卡片，再點選對應的答案格。');
    else tryMatch(selected,zone.dataset.target);
  });
  document.addEventListener('keydown',event => {if (event.key === 'Escape') {cleanupDrag();if (selected) {clearSelection();say('','已放回想像卡','選一張新卡片，繼續探索小花園。');}}});

  // An original cheerful 112 bpm pentatonic tune: soft plucked melody, bass and brush-like percussion.
  // Browsers unlock sound after the first user gesture; no external audio files or network are needed.
  function unlockAudio() {
    if (!audio) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) { $('music-toggle').disabled = true;$('sfx-toggle').disabled = true;$('music-label').textContent = '聲音未支援';return; }
      try {
        audio = new AudioContext();
        musicGain = audio.createGain();musicGain.gain.value = .18;musicGain.connect(audio.destination);
        sfxGain = audio.createGain();sfxGain.gain.value = .3;sfxGain.connect(audio.destination);
      } catch { return; }
    }
    if (audio.state === 'suspended') audio.resume().then(() => {if (musicEnabled && !document.hidden) startMusic();}).catch(() => {});
    else if (musicEnabled && !document.hidden) startMusic();
  }
  function note(frequency,when,duration,volume,destination,type='sine') {
    if (!audio) return;
    const osc = audio.createOscillator(), envelope = audio.createGain();
    osc.type = type;osc.frequency.value = frequency;
    envelope.gain.setValueAtTime(0,when);
    envelope.gain.linearRampToValueAtTime(volume,when+.012);
    envelope.gain.exponentialRampToValueAtTime(.0001,when+duration);
    osc.connect(envelope);envelope.connect(destination);osc.start(when);osc.stop(when+duration+.02);
    osc.onended=()=>{osc.disconnect();envelope.disconnect();};
  }
  const melody = [72,76,79,76,81,79,76,0,74,76,79,81,79,76,74,0,72,76,79,84,81,79,76,0,74,76,79,76,74,72,72,0];
  const midi = n => 440*Math.pow(2,(n-69)/12);
  function scheduleBeat(index,time) {
    const step = index % melody.length, n = melody[step];
    if (n) {note(midi(n),time,.26,.27,musicGain,'sine');note(midi(n)*2,time,.16,.035,musicGain,'sine');}
    if (step%4===0) {const roots=[48,53,55,48];note(midi(roots[Math.floor(step/8)]),time,.68,.27,musicGain,'triangle');}
    if (step%4===2) {const chords=[[60,64,67],[65,69,72],[67,71,74],[60,64,67]];chords[Math.floor(step/8)].forEach(n => note(midi(n),time,.19,.045,musicGain,'triangle'));}
    if (step%2===1) note(1250,time,.035,.018,musicGain,'triangle');
  }
  function startMusic() {
    if (!audio || !musicEnabled || musicTimer || audio.state !== 'running' || document.hidden) return;
    musicGain.gain.cancelScheduledValues(audio.currentTime);musicGain.gain.setTargetAtTime(.18,audio.currentTime,.09);
    nextBeat = audio.currentTime+.04;
    const schedule = () => { if (!audio || audio.state !== 'running') return;while (nextBeat < audio.currentTime+.16) {scheduleBeat(beatIndex++,nextBeat);nextBeat += 60/112/2;} };
    schedule();musicTimer = setInterval(schedule,70);
    document.body.classList.add('music-playing');$('music-toggle').title='關閉背景音樂';
  }
  function stopMusic() {
    clearInterval(musicTimer);musicTimer=null;
    if (audio && musicGain) {musicGain.gain.cancelScheduledValues(audio.currentTime);musicGain.gain.setTargetAtTime(0,audio.currentTime,.05);}
    document.body.classList.remove('music-playing');
  }
  function playEffect(correct) {
    if (!sfxEnabled || !audio || audio.state !== 'running') return;
    const t = audio.currentTime;
    if (correct) [72,76,79,84].forEach((n,i) => note(midi(n),t+i*.075,.32,.34,sfxGain));
    else [65,61].forEach((n,i) => note(midi(n),t+i*.16,.24,.22,sfxGain,'triangle'));
  }
  $('music-toggle').addEventListener('click',() => {
    // The first click starts the enabled, but browser-paused, music.
    if (musicEnabled && (!audio || audio.state !== 'running')) {unlockAudio();return;}
    musicEnabled=!musicEnabled;$('music-toggle').setAttribute('aria-pressed',String(musicEnabled));
    $('music-label').textContent=musicEnabled?'背景音樂':'音樂已關';
    $('music-toggle').title=musicEnabled?'關閉背景音樂':'開啟背景音樂';
    if (musicEnabled) unlockAudio();else stopMusic();
  });
  $('sfx-toggle').addEventListener('click',() => {sfxEnabled=!sfxEnabled;$('sfx-toggle').setAttribute('aria-pressed',String(sfxEnabled));$('sfx-toggle').setAttribute('aria-label',sfxEnabled?'關閉答題音效':'開啟答題音效');unlockAudio();});
  document.addEventListener('pointerdown',event=>{if(!event.target.closest('#music-toggle'))unlockAudio();},{once:true});
  document.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' ')unlockAudio();},{once:true});
  document.addEventListener('visibilitychange',() => {if(document.hidden){stopMusic();cleanupDrag();}else if(musicEnabled && audio)startMusic();});
  window.addEventListener('pagehide',stopMusic);

  function showCompletion() {
    finishTimer=null;
    $('attempt-count').textContent=attempts;
    $('complete-dialog').showModal();
    if (sfxEnabled && audio?.state === 'running') [72,76,79,84,79,84].forEach((n,i)=>note(midi(n),audio.currentTime+i*.12,.5,.3,sfxGain));
    if (!reducedMotion) {
      const colors=['#87a56c','#d8b86b','#e7bd94','#bacba4','#f2df99'];
      for(let i=0;i<48;i++){const confetto=document.createElement('i');confetto.className='confetti-piece';confetto.style.cssText=`left:${Math.random()*100}%;background:${colors[i%colors.length]};animation-delay:${Math.random()*.65}s;--drift:${Math.random()*260-130}px;--spin:${Math.random()*900-450}deg`; $('confetti').appendChild(confetto);}
      setTimeout(()=>$('confetti').replaceChildren(),3500);
    }
  }
  function resetGame() {
    cleanupDrag();clearSelection();clearTimeout(finishTimer);finishTimer=null;
    errorTimers.forEach(timer=>clearTimeout(timer));errorTimers.clear();
    completed.clear();attempts=0;suppressClickUntil=0;
    $('confetti').replaceChildren();
    if($('complete-dialog').open)$('complete-dialog').close();
    if($('reset-dialog').open)$('reset-dialog').close();
    render();say('','新的想像旅程開始了！','想像卡已重新洗牌，試試看能否一一配對。');
    options.querySelector('.option-card').focus({preventScroll:true});
  }
  $('reset-btn').addEventListener('click',()=>{if(attempts || completed.size)$('reset-dialog').showModal();else resetGame();});
  $('confirm-reset').addEventListener('click',resetGame);
  $('cancel-reset').addEventListener('click',()=>$('reset-dialog').close());
  $('play-again').addEventListener('click',resetGame);
  $('review-btn').addEventListener('click',()=>$('complete-dialog').close());
  $('close-complete').addEventListener('click',()=>$('complete-dialog').close());
  [$('complete-dialog'),$('reset-dialog')].forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}}));
  render();
})();
