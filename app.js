(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const night = $('night'), canvas = $('scene'), ctx = canvas.getContext('2d', { alpha: true });
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const START = Date.parse('2025-12-09T00:00:00+08:00');
  const WISH_KEY = 'our-christmas:wishes:v1';
  const PROMISE_KEY = 'our-christmas:promises:v1';
  const gold = '#e7c78b';
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = (a, b, t) => { const p = clamp((t - a) / (b - a)); return p * p * (3 - 2 * p); };
  let width = 0, height = 0, dpr = 1, mobile = false, layout = {};
  let elapsed = reducedMotion.matches ? 13 : 0, lastTime = 0, running = false;
  let snow = [], sparks = [], skyStars = [], pointer = { x: 0, y: 0 }, drift = { x: 0, y: 0 };
  let glowPulse = 0, hintStage = -1, sceneFlags = '', frameId = 0, toastTimer = 0, typedCount = -1;
  let wishData = [];
  let sceneReady = false, sceneAssetsReady = false;
  const embedded = window.self !== window.top && new URLSearchParams(location.search).has('embedded');
  const tree = document.createElement('canvas'); tree.width = 800; tree.height = 1000;
  const tc = tree.getContext('2d');
  let seed = 1209;
  function random() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

  // The detailed fir is painted once. Animation reveals the cached branches,
  // keeping thousands of needles out of the per-frame work.
  function paintTree() {
    const base = 878, top = 85, span = base - top;
    const trunk = tc.createLinearGradient(380, 0, 420, 0);
    trunk.addColorStop(0, '#24372c'); trunk.addColorStop(.5, '#7b6b46'); trunk.addColorStop(1, '#22372f');
    tc.fillStyle = trunk;
    tc.beginPath(); tc.moveTo(397, 94); tc.lineTo(420, 937); tc.lineTo(378, 937); tc.closePath(); tc.fill();
    const body = tc.createLinearGradient(185, 0, 630, 0);
    body.addColorStop(0, '#173f37'); body.addColorStop(.44, '#315a45'); body.addColorStop(.58, '#284d3c'); body.addColorStop(1, '#143a33');
    tc.fillStyle = body;
    tc.beginPath(); tc.moveTo(400, top);
    for (let y = top + 8; y <= base; y += 8) {
      const f = (y - top) / span, r = Math.pow(f, .92) * 305;
      tc.lineTo(400 + r * (.82 + .18 * Math.sin(y * .069) ** 2), y);
    }
    for (let y = base; y > top; y -= 8) {
      const f = (y - top) / span, r = Math.pow(f, .92) * 305;
      tc.lineTo(400 - r * (.82 + .18 * Math.sin(y * .073 + 1) ** 2), y);
    }
    tc.closePath(); tc.fill();
    for (let y = top + 20; y < base; y += 7) {
      const f = (y - top) / span, radius = Math.pow(f, .94) * 305;
      for (const side of [-1, 1]) {
        const reach = radius * (.68 + random() * .34);
        const startY = y - 31 * f - random() * 12;
        const endY = y + (20 + random() * 21) * f;
        tc.strokeStyle = ['#355d45', '#3d664c', '#416d51', '#204a3c', '#527557'][Math.floor(random() * 5)];
        tc.lineWidth = 2.1 + 2.7 * f;
        tc.beginPath(); tc.moveTo(400, startY); tc.quadraticCurveTo(400 + reach * .62 * side, y - 6, 400 + reach * side, endY); tc.stroke();
        for (let k = 0; k < reach; k += 5 + random() * 2) {
          const p = k / reach, x = 400 + k * side, by = startY + (endY - startY) * p;
          const needle = (8 + random() * 13) * (.45 + .55 * f);
          tc.lineWidth = .65 + random() * .65;
          tc.strokeStyle = ['#5f7f59', '#73906a', '#496c50', '#345d47', '#7f936b'][Math.floor(random() * 5)];
          tc.globalAlpha = .3 + random() * .55;
          tc.beginPath(); tc.moveTo(x, by); tc.lineTo(x + side * needle * .58, by - needle * .68); tc.moveTo(x, by); tc.lineTo(x + side * needle, by + needle * .42); tc.stroke();
        }
        if (random() > .35) {
          const snowStart = .55 + random() * .15;
          tc.globalAlpha = .23 + random() * .2; tc.strokeStyle = '#b5c7b0'; tc.lineWidth = 1.5 + random() * 2;
          tc.beginPath(); tc.moveTo(400 + side * reach * snowStart, startY + (endY - startY) * snowStart - 3); tc.lineTo(400 + side * reach, endY - 4); tc.stroke();
        }
        tc.globalAlpha = 1;
      }
    }
    for (let i = 0; i < 135; i++) {
      const f = .15 + random() * .82, y = top + span * f, x = 400 + (random() * 2 - 1) * Math.pow(f, .94) * 255;
      tc.fillStyle = i % 3 ? '#d2b780' : '#b88771'; tc.globalAlpha = .2 + random() * .4;
      tc.beginPath(); tc.arc(x, y, 1.4 + random() * 1.5, 0, Math.PI * 2); tc.fill();
    }
    tc.globalAlpha = 1;
    // A few small ornaments keep the original drawn fir light and delicate.
    for (const [x,y,r,color] of [[454,380,5,'#b88968'],[315,572,6,'#a26461'],[485,654,6,'#c9aa6a'],[254,772,7,'#b57d72'],[543,823,6,'#d4bb7d']]) {
      tc.fillStyle=color;tc.beginPath();tc.arc(x,y,r,0,Math.PI*2);tc.fill();tc.fillStyle='#f7e4ae88';tc.beginPath();tc.arc(x-r*.3,y-r*.35,r*.25,0,Math.PI*2);tc.fill();tc.strokeStyle='#b7a16f';tc.lineWidth=1;tc.beginPath();tc.moveTo(x,y-r);tc.lineTo(x,y-r-5);tc.stroke();
    }
  }
  paintTree();
  const spriteColors = { gold: '#ffe2a1', rose: '#f0aab6', mint: '#a0ddd0', blue: '#a2c9fa', violet: '#c2b0ed', white: '#fff7d8' };
  const sprites = {};
  for (const [name, color] of Object.entries(spriteColors)) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, color); gradient.addColorStop(.065, color); gradient.addColorStop(.17, color + 'b3'); gradient.addColorStop(.43, color + '25'); gradient.addColorStop(1, color + '00');
    g.fillStyle = gradient; g.fillRect(0, 0, 64, 64); sprites[name] = c;
  }

  function position(element, x, y, w, h) {
    element.style.left = x + 'px'; element.style.top = y + 'px';
    if (w) element.style.width = w + 'px'; if (h) element.style.height = h + 'px';
  }
  function resize() {
    const rect = night.getBoundingClientRect(); width = rect.width; height = rect.height;
    dpr = Math.min(devicePixelRatio || 1, 2); mobile = width <= 760;
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const treeHeight = mobile ? Math.min(height * .66, width * 1.28) : Math.min(height * .68, 760, width * .78);
    const baseY = height * (mobile ? .84 : .88);
    layout = { cx: width * .5, base: baseY, h: treeHeight, half: treeHeight * .385 };
    layout.top = layout.base - layout.h;
    layout.scale = layout.h / 793;
    position($('tree-star'), layout.cx, layout.top - 5);
    position($('tree-touch'), layout.cx - layout.half, layout.top + 25, layout.half * 2, layout.h - 20);
    const coupleHeight = mobile ? Math.min(layout.h * .39, 180) : Math.min(layout.h * .39, 224);
    position($('couple'), layout.cx + layout.half * .04, layout.base + 70 * layout.scale, coupleHeight * .82, coupleHeight);
    position(document.querySelector('.gift-memory'), layout.cx - layout.half * (mobile ? .66 : .71), layout.base + 25 * layout.scale);
    position(document.querySelector('.gift-letter'), layout.cx + layout.half * (mobile ? .30 : .51), layout.base + 15 * layout.scale);
    position(document.querySelector('.gift-together'), layout.cx + layout.half * (mobile ? .66 : .88), layout.base + 30 * layout.scale);
    const count = reducedMotion.matches ? 35 : Math.round(Math.min(210, mobile ? 82 : width / 7));
    snow = Array.from({ length: count }, () => ({ x: Math.random() * width, y: Math.random() * height, r: .45 + Math.random() ** 2 * 2.3, speed: 11 + Math.random() * 28, phase: Math.random() * 6.28, alpha: .15 + Math.random() * .52 }));
    skyStars = Array.from({ length: mobile ? 38 : 90 }, () => ({ x: Math.random() * width, y: Math.random() * height * .77, r: .3 + Math.random() * .65, phase: Math.random() * 7 }));
    if (!running) draw(0);
  }
  function bulbPoint(p, extra = 1, rotation = 0) {
    const angle = p * Math.PI * 2 * 5.2 + .65 + rotation;
    const radius = Math.pow(1 - p, .94) * layout.half * extra;
    return { x: layout.cx + Math.sin(angle) * radius, y: layout.base - layout.h * p + Math.cos(angle) * 9 * layout.scale, front: Math.cos(angle) >= 0 };
  }
  function glow(x, y, size, color = 'gold', alpha = 1) {
    ctx.globalAlpha = alpha; ctx.drawImage(sprites[color], x - size / 2, y - size / 2, size, size); ctx.globalAlpha = 1;
  }
  function drawWire(front, progress) {
    ctx.lineWidth = .6; ctx.strokeStyle = '#d2ba7c'; ctx.globalAlpha = .17 * progress;
    ctx.beginPath(); let connected = false;
    for (let i = 0; i <= 420; i++) {
      const point = bulbPoint(i / 420);
      if (point.front === front) { if (!connected) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y); connected = true; } else connected = false;
    }
    ctx.stroke(); ctx.globalAlpha = 1;
  }
  function drawBulbs(front, lit, time) {
    for (let i = 0; i < 70; i++) {
      const p = (i + .4) / 70, point = bulbPoint(p);
      if (point.front !== front || p > lit) continue;
      const light = smooth(p - .04, p + .025, lit), breathe = .76 + .2 * Math.sin(time * 1.3 + i * 1.7);
      const color = elapsed < 9.5 ? 'gold' : ['gold', 'gold', 'rose', 'gold', 'mint', 'gold', 'blue'][i % 7];
      glow(point.x, point.y, (mobile ? 16 : 21) * (1 + glowPulse * .5), color, light * breathe * (front ? 1 : .6));
    }
  }
  function drawOrbit(front, time, alpha) {
    const palette = ['gold', 'rose', 'mint', 'blue', 'violet'];
    for (let i = 0; i < 100; i++) {
      const p = (i / 100 + time * .022) % 1, point = bulbPoint(p, 1.18, time * .1);
      if (point.front !== front) continue;
      const fade = Math.sin(Math.PI * p) * alpha;
      glow(point.x, point.y, (mobile ? 10 : 14) * (.65 + .35 * Math.sin(i * 2)), palette[Math.floor(i / 20)], fade * (front ? .7 : .35));
    }
  }
  function distantPeople(time, alpha) {
    const floor=height*.695;
    function person(x,y,h,color,phase,play=false) {
      const step=Math.sin(time*(play?5:1.7)+phase),bob=Math.abs(step)*(play?1.1:.3);
      ctx.save();ctx.translate(x,y-bob);ctx.globalAlpha=alpha*.7;ctx.fillStyle=color;ctx.strokeStyle=color;ctx.lineWidth=Math.max(.8,h*.085);ctx.lineCap='round';
      ctx.beginPath();ctx.arc(0,-h*.87,h*.12,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.moveTo(-h*.16,-h*.71);ctx.quadraticCurveTo(0,-h*.82,h*.16,-h*.71);ctx.lineTo(h*.21,-h*.27);ctx.lineTo(-h*.2,-h*.27);ctx.closePath();ctx.fill();
      ctx.beginPath();ctx.moveTo(-h*.07,-h*.3);ctx.lineTo(-h*.12-step*h*.08,0);ctx.moveTo(h*.07,-h*.3);ctx.lineTo(h*.12+step*h*.08,0);ctx.moveTo(-h*.11,-h*.65);ctx.lineTo(-h*.3,-h*(play?.5+step*.2:.43));ctx.moveTo(h*.11,-h*.65);ctx.lineTo(h*.3,-h*(play?.5-step*.2:.43));ctx.stroke();ctx.restore();
    }
    const s=mobile?.72:1;
    const stroll=Math.sin(time*.09)*width*.012;
    person(width*.16+stroll,floor,22*s,'#78929a',0);person(width*.16+stroll+10*s,floor+1,20*s,'#aa969a',1);
    person(width*.84-stroll,floor-5,19*s,'#7b9298',2);person(width*.84-stroll+9*s,floor-4,21*s,'#8f9f9a',3);
    const run=Math.sin(time*.38)*width*.025;
    person(width*.09+run,floor+8,12*s,'#b28e87',.5,true);person(width*.09+run-17*s,floor+10+Math.sin(time)*2,11*s,'#8eaaa0',2,true);
  }
  function draw(time) {
    ctx.clearRect(0, 0, width, height);
    const show = smooth(0, 1.8, elapsed), growth = smooth(1.6, 6.3, elapsed), lit = smooth(5.9, 9.2, elapsed), orbit = smooth(10, 12.2, elapsed);
    const sky = ctx.createRadialGradient(layout.cx, layout.top + layout.h * .65, 0, layout.cx, layout.top + layout.h * .65, layout.h * .92);
    sky.addColorStop(0, '#c6a965' + Math.round((.045 + lit * .04) * 255).toString(16).padStart(2, '0')); sky.addColorStop(1, '#c6a96500');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
    for (const star of skyStars) {
      ctx.fillStyle = '#c784a3'; ctx.globalAlpha = (.12 + .2 * Math.sin(time * .45 + star.phase) ** 2) * show;
      ctx.beginPath(); ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    const ground = ctx.createRadialGradient(layout.cx, layout.base + 18 * layout.scale, 3, layout.cx, layout.base + 18 * layout.scale, layout.half * 1.65);
    ground.addColorStop(0, '#d8dfc836'); ground.addColorStop(.35, '#a5c2bd1d'); ground.addColorStop(1, '#a5c2bd00');
    ctx.save(); ctx.translate(0, layout.base); ctx.scale(1, .24); ctx.translate(0, -layout.base); ctx.globalAlpha = show; ctx.fillStyle = ground; ctx.fillRect(layout.cx - layout.half * 2, layout.base - layout.half * 2, layout.half * 4, layout.half * 4); ctx.restore();
    distantPeople(time, show);
    ctx.save(); ctx.translate(drift.x, drift.y);
    drawWire(false, growth); if (orbit) drawOrbit(false, time, orbit); drawBulbs(false, lit, time);
    if (growth > 0) {
      const sx = layout.scale, drawX = layout.cx - 400 * sx, drawY = layout.top - 85 * sx;
      const reveal = 1000 * smooth(1, 6.1, elapsed);
      ctx.save(); ctx.beginPath(); ctx.rect(drawX, drawY + 1000 * sx - reveal * sx, 800 * sx, reveal * sx); ctx.clip();
      ctx.globalAlpha = smooth(1.4, 2.4, elapsed); ctx.drawImage(tree, drawX, drawY, 800 * sx, 1000 * sx); ctx.restore();
      if (growth < .995) {
        const buildY = layout.base - layout.h * growth, buildRadius = Math.pow(1 - growth, .94) * layout.half;
        for (let i = 0; i < 20; i++) {
          const x = layout.cx + Math.sin(time * 1.4 + i * 1.8) * buildRadius;
          glow(x, buildY + Math.sin(i * 3 + time) * 10, mobile ? 10 : 15, 'gold', Math.sin(Math.PI * growth) * .6);
        }
      }
    }
    drawWire(true, growth); drawBulbs(true, lit, time);
    if (lit > 0 && lit < 1) {
      for (let i = 0; i < 12; i++) {
        const point = bulbPoint(Math.max(0, lit - i * .003));
        if (point.front) glow(point.x, point.y, 37 - i * 1.7, 'white', (1 - i / 12) * .9);
      }
    }
    if (orbit) drawOrbit(true, time, orbit);
    if (elapsed > 8.8) glow(layout.cx, layout.top - 5, 100 + Math.sin(time) * 10, 'gold', smooth(8.8, 10.4, elapsed) * .48);
    ctx.restore();
    for (const flake of snow) {
      ctx.globalAlpha = flake.alpha * show;
      ctx.fillStyle = '#cc84a5'; ctx.beginPath(); ctx.arc(flake.x + drift.x * .15, flake.y, flake.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const spark of sparks) {
      const opacity = clamp(spark.life / spark.max);
      if (spark.heart) {
        ctx.globalAlpha = opacity; ctx.fillStyle = '#eab7a8'; ctx.font = `${spark.size}px Georgia`; ctx.fillText('♡', spark.x, spark.y); ctx.globalAlpha = 1;
      } else glow(spark.x, spark.y, spark.size * opacity, spark.color, opacity);
    }
  }
  function frame(now) {
    if (!running) return;
    const delta = Math.min((now - (lastTime || now)) / 1000, .045); lastTime = now;
    elapsed += delta; const time = now / 1000;
    const limit = mobile ? 1.4 : 3;
    drift.x += (pointer.x * limit - drift.x) * .035; drift.y += (pointer.y * limit * .5 - drift.y) * .035;
    if (!reducedMotion.matches) for (const flake of snow) {
      flake.y += delta * flake.speed; flake.x += Math.sin(time * .55 + flake.phase) * delta * 7;
      if (flake.y > height + 5) { flake.y = -5; flake.x = Math.random() * width; }
    }
    for (const spark of sparks) { spark.life -= delta; spark.x += spark.vx * delta; spark.y += spark.vy * delta; spark.vy += delta * 7; }
    sparks = sparks.filter((spark) => spark.life > 0); glowPulse = Math.max(0, glowPulse - delta * .9);
    updateStages(); draw(reducedMotion.matches ? 0 : time); frameId = requestAnimationFrame(frame);
  }
  function updateStages() {
    const count = Math.max(0, Math.min(6, Math.floor((elapsed - 9.5) * 3.5)));
    if (count !== typedCount) { typedCount = count; $('typed-title').textContent = '敏，冬日暖阳'.slice(0, count); $('title').classList.toggle('typing', count > 0 && count < 6); }
    const ready = elapsed >= 12.4 && sceneAssetsReady;
    if (ready !== sceneReady) {
      sceneReady = ready; night.classList.toggle('scene-ready', ready);
      document.querySelector('.welcome-enter').hidden = embedded || !ready;
      if (embedded) parent.postMessage({ type: ready ? 'winter:ready' : 'winter:building' }, location.origin);
    }
    const flags = [elapsed > .7, elapsed > 9, elapsed > 9.5, elapsed >= 11.5].join(',');
    if (flags !== sceneFlags) {
      sceneFlags = flags;
      night.classList.toggle('has-snow', elapsed > .7); night.classList.toggle('lights-on', elapsed > 9); night.classList.toggle('gifts-ready', elapsed > 9.5);
      $('skip').hidden = elapsed >= 11.5;
      // Invisible scene targets cannot intercept clicks during the opening.
      for (const el of [$('tree-star'), $('couple'), ...document.querySelectorAll('[data-gift]')]) {
        const visible = elapsed > (el.id === 'tree-star' ? 9 : 9.5);
        el.disabled = !visible; el.style.pointerEvents = visible ? 'auto' : 'none';
      }
    }
  }
  function skipIntro() { elapsed = Math.max(elapsed, 13); updateStages(); }
  function replay() { elapsed = reducedMotion.matches ? 13 : 0; hintStage = -1; sparks = []; glowPulse = 0; updateStages(); toast('再等一次，属于我们的圣诞。'); }
  function burst(x, y, hearts = false) {
    const count = reducedMotion.matches ? 8 : (hearts ? 16 : 38);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2, speed = 10 + Math.random() * 55, life = 1.1 + Math.random() * 1.2;
      sparks.push({ x, y, vx: Math.cos(angle) * speed, vy: -20 + Math.sin(angle) * speed * .65, life, max: life, size: hearts ? 16 + Math.random() * 11 : 12 + Math.random() * 20, heart: hearts, color: ['gold', 'rose', 'mint', 'blue'][i % 4] });
    }
  }
  function toast(message) { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').classList.add('visible'); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3400); }
  function tickClock() {
    const duration = Math.max(0, Date.now() - START), days = Math.floor(duration / 86400000);
    $('days').textContent = String(days);
    const hours = Math.floor(duration / 3600000) % 24, minutes = Math.floor(duration / 60000) % 60, seconds = Math.floor(duration / 1000) % 60;
    $('clock-detail').textContent = `${String(hours).padStart(2, '0')} : ${String(minutes).padStart(2, '0')} : ${String(seconds).padStart(2, '0')}`;
    $('love-clock').setAttribute('aria-label', `从2025年12月9日起，已相恋${days}天${hours}小时${minutes}分${seconds}秒`);
    return days;
  }

  function readWishes() {
    try {
      const parsed = JSON.parse(localStorage.getItem(WISH_KEY) || '[]');
      wishData = Array.isArray(parsed) ? parsed.filter(w => w && typeof w.id === 'string' && typeof w.text === 'string' && w.text.trim() && w.text.length <= 240 && typeof w.at === 'string' && Number.isFinite(Date.parse(w.at))).slice(0, 30) : [];
    } catch { wishData = []; }
  }
  function renderWishes() {
    $('wish-count').textContent = String(wishData.length); $('wish-list').replaceChildren();
    if (!wishData.length) return;
    const dateFormat = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' });
    for (const wish of wishData) {
      const article = document.createElement('article'); article.className = 'wish-entry';
      const text = document.createElement('p'); text.textContent = wish.text;
      const footer = document.createElement('footer'), date = document.createElement('time'); date.dateTime = wish.at; date.textContent = dateFormat.format(new Date(wish.at));
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'wish-delete'; remove.textContent = '删除'; remove.setAttribute('aria-label', '删除这条心愿');
      remove.addEventListener('click', () => {
        const next = wishData.filter(w => w.id !== wish.id);
        try { localStorage.setItem(WISH_KEY, JSON.stringify(next)); wishData = next; renderWishes(); } catch { $('wish-error').textContent = '当前浏览器无法修改心愿，请检查网站存储权限。'; }
      });
      footer.append(date, remove); article.append(text, footer); $('wish-list').append(article);
    }
  }
  function openWish() { skipIntro(); readWishes(); renderWishes(); $('wish-error').textContent = ''; if (!$('wish-dialog').open) $('wish-dialog').showModal(); }
  function flyWish() {
    const rect = $('tree-star').getBoundingClientRect(), paper = document.createElement('div'); paper.className = 'flying-paper'; paper.setAttribute('aria-hidden', 'true'); document.body.append(paper);
    const startX = innerWidth / 2 - 19, startY = innerHeight * .54, endX = rect.left + rect.width / 2 - 19, endY = rect.top + rect.height / 2 - 14;
    const animation = paper.animate([{ transform: `translate(${startX}px,${startY}px) scale(1) rotate(-8deg)`, opacity: 1 }, { transform: `translate(${startX + (endX - startX) * .3 - 25}px,${endY + 80}px) scale(.75) rotate(18deg)`, opacity: 1, offset: .55 }, { transform: `translate(${endX}px,${endY}px) scale(.08) rotate(100deg)`, opacity: 0 }], { duration: reducedMotion.matches ? 100 : 1400, easing: 'cubic-bezier(.3,.1,.25,1)', fill: 'forwards' });
    animation.finished.then(() => { paper.remove(); glowPulse = 1; burst(layout.cx, layout.top, false); toast('星星记住啦。愿望已保存在这台设备。'); }).catch(() => paper.remove());
  }
  $('wish-text').addEventListener('input', () => { $('char-count').textContent = `${$('wish-text').value.length} / 240`; $('wish-text').setCustomValidity(''); $('wish-error').textContent = ''; });
  $('wish-form').addEventListener('submit', (event) => {
    event.preventDefault(); const text = $('wish-text').value.trim();
    if (!text) { $('wish-text').setCustomValidity('先写下一个小小心愿吧。'); $('wish-text').reportValidity(); return; }
    readWishes();
    if (wishData.length >= 30) { $('wish-error').textContent = '星星已经记住了 30 个心愿。先整理一下旧心愿，再写一个新的吧。'; return; }
    const next = [{ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), text, at: new Date().toISOString() }, ...wishData];
    try { localStorage.setItem(WISH_KEY, JSON.stringify(next)); } catch { $('wish-error').textContent = '这次没能保存。请允许浏览器存储网站数据，文字会留在这里。'; return; }
    wishData = next; $('wish-text').value = ''; $('char-count').textContent = '0 / 240'; renderWishes(); $('wish-dialog').close(); flyWish();
  });
  for (const dialog of document.querySelectorAll('.wish-dialog, .gift-dialog')) {
    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { const r = dialog.getBoundingClientRect(); if (event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) dialog.close(); });
  }
  function openGift(kind) {
    const content = $('gift-content'); content.replaceChildren();
    const titles = { memory: ['A MOMENT OF US', '我有此妻，夫复何求'], letter: ['A LITTLE LETTER FOR YOU', '这个冬天，想对你说。'], together: ['LITTLE THINGS, TOGETHER', '一起过冬的小约定。'], help: ['A LITTLE GUIDE', '这里，藏着一些小惊喜。'] };
    $('gift-kicker').textContent = titles[kind][0]; $('gift-title').textContent = titles[kind][1];
    if (kind === 'memory') {
      const figure = document.createElement('figure'); figure.className = 'gift-photo';
      const photo = document.createElement('img'); photo.src = 'assets/our-memory.jpg'; photo.alt = '红地毯上，我们牵手的影子'; photo.width = 1080; photo.height = 1440;
      figure.append(photo); content.append(figure);
    } else if (kind === 'letter') {
      const copy = document.createElement('div'); copy.className = 'letter-copy';
      for (const line of ['从 2025 年 12 月 9 日开始，很多平常的日子，因为有你，变得值得纪念。', '想把这场雪、这棵树，还有一盏盏慢慢亮起来的灯，都送给你。', '愿以后的冬天，都能牵着你的手。']) { const p = document.createElement('p'); p.textContent = line; copy.append(p); }
      const sign = document.createElement('p'); sign.className = 'letter-sign'; sign.textContent = 'Love 敏'; copy.append(sign); content.append(copy);
    } else if (kind === 'together') {
      let saved = []; try { const data = JSON.parse(localStorage.getItem(PROMISE_KEY) || '[]'); saved = Array.isArray(data) ? data : []; } catch {}
      const list = document.createElement('div'); list.className = 'promise-list';
      ['一起喝一杯热可可', '一起看一场雪', '拍一张属于这个冬天的合照', '把手牵紧，再走远一点'].forEach((line, i) => {
        const label = document.createElement('label'), input = document.createElement('input'), text = document.createElement('span'); input.type = 'checkbox'; input.checked = saved.includes(i); text.textContent = line;
        input.addEventListener('change', () => { const next = [...list.querySelectorAll('input')].flatMap((el, index) => el.checked ? [index] : []); try { localStorage.setItem(PROMISE_KEY, JSON.stringify(next)); } catch { toast('浏览器暂时无法保存打卡。'); } if (input.checked) burst(layout.cx, layout.base - 30); });
        label.append(input, text); list.append(label);
      });
      const note = document.createElement('p'); note.className = 'promise-note'; note.textContent = '做过的小事，轻轻打个勾。打卡也会保存在当前浏览器。'; content.append(list);
    } else {
      const copy = document.createElement('div'); copy.className = 'help-copy';
      for (const line of ['点树顶星星：写下心愿，也能查看已经保存的心愿。', '点树下礼物：翻开一张回忆、一封小信和一起过冬的约定。', '点牵手的我们：让爱心升起，看看一起走过的天数。', '轻触圣诞树：点亮一片星光。右下角可以开音乐、重播开场。', '心愿和打卡仅保存在当前浏览器。清理网站数据后将不再保留。']) { const p = document.createElement('p'); p.textContent = line; copy.append(p); } content.append(copy);
    }
    $('gift-dialog').showModal();
  }

  $('skip').addEventListener('click', skipIntro); $('replay')?.addEventListener('click', replay); $('tree-star').addEventListener('click', openWish);
  $('tree-touch').addEventListener('click', event => { skipIntro(); const r = night.getBoundingClientRect(); burst(event.detail === 0 ? layout.cx : event.clientX - r.left, event.detail === 0 ? layout.base - layout.h * .5 : event.clientY - r.top); glowPulse = 1; });
  $('couple').addEventListener('click', () => { burst(layout.cx, layout.base - layout.h * .24, true); toast(`从 2025.12.09 到今天，我们已一起走过 ${tickClock()} 天。`); });
  document.querySelectorAll('[data-gift]').forEach(button => button.addEventListener('click', () => openGift(button.dataset.gift)));
  $('help')?.addEventListener('click', () => openGift('help'));
  night.addEventListener('pointermove', event => { const rect = night.getBoundingClientRect(); pointer.x = (event.clientX - rect.left) / width * 2 - 1; pointer.y = (event.clientY - rect.top) / height * 2 - 1; });
  night.addEventListener('pointerleave', () => { pointer.x = pointer.y = 0; });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { running = false; cancelAnimationFrame(frameId); }
    else { lastTime = 0; if (!running) { running = true; frameId = requestAnimationFrame(frame); } }
  });
  addEventListener('storage', event => { if (event.key === WISH_KEY && $('wish-dialog').open) { readWishes(); renderWishes(); } });
  addEventListener('resize', resize, { passive: true });
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) skipIntro(); resize(); });
  document.querySelector('.welcome-enter').hidden = true;
  resize(); tickClock(); setInterval(tickClock, 1000); readWishes();
  // The entrance waits for the finished animation and both scene images.
  // Loading failures still settle, keeping the homepage reachable.
  const figure = $('couple').querySelector('img'), town = new Image(); town.src = 'assets/winter-town.webp';
  const decoded = image => image.decode ? image.decode() : new Promise(resolve => {
    if (image.complete) resolve(); else { image.addEventListener('load', resolve, { once: true }); image.addEventListener('error', resolve, { once: true }); }
  });
  Promise.allSettled([decoded(figure), decoded(town)]).then(() => { sceneAssetsReady = true; updateStages(); });
  running = true; frameId = requestAnimationFrame(frame);
})();
