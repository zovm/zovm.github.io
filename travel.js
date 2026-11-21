(() => {
  const $ = id => document.getElementById(id), svg = $('travel-map');
  const ns = 'http://www.w3.org/2000/svg';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 760px)');
  const create = (tag, attributes = {}, parent = svg) => {
    const element = document.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    if (parent) parent.append(element); return element;
  };
  let data, index = 0, playing = false, timer = 0, progress = 0;
  let progressFrame = 0, viewFrame = 0, currentBox = [0, 0, 1100, 720], enlarged = mobile.matches;
  let route, heart, insetGroup, totalLength = 0, targets = [], nodes = [], stopButtons = [], segments = [];
  const ease = t => t * t * (3 - 2 * t);
  const quadratic = (a, c, b, t) => a.map((value, i) => (1 - t) ** 2 * value + 2 * (1 - t) * t * c[i] + t ** 2 * b[i]);

  function fit(bounds) {
    const aspect = Math.max(.6, svg.clientWidth / Math.max(1, svg.clientHeight));
    let [x, y, width, height] = bounds;
    if (width / height < aspect) { const next = height * aspect; x -= (next - width) / 2; width = next; }
    else { const next = width / aspect; y -= (next - height) / 2; height = next; }
    return [x, y, width, height];
  }
  function decorations() {
    if (!data) return;
    const unit = currentBox[2] / Math.max(1, svg.clientWidth);
    for (const node of nodes) {
      const offset = mobile.matches ? [0, -34] : node.city.labelOffset;
      const [dx, dy] = offset.map(value => value * unit);
      const width = (node.city.name.length * 16 + 22) * unit, height = 31 * unit;
      node.hit.setAttribute('r', (enlarged || mobile.matches ? 17 : 9) * unit); node.halo.setAttribute('r', 12 * unit);
      node.ring.setAttribute('r', 8 * unit); node.dot.setAttribute('r', 4.5 * unit);
      node.leader.setAttribute('d', `M0,0L${dx},${dy}`);
      node.labelBox.setAttribute('x', dx - width / 2); node.labelBox.setAttribute('y', dy - height / 2);
      node.labelBox.setAttribute('width', width); node.labelBox.setAttribute('height', height); node.labelBox.setAttribute('rx', 10 * unit);
      node.labelText.setAttribute('x', dx); node.labelText.setAttribute('y', dy + 5 * unit);
      node.labelText.setAttribute('font-size', 16 * unit);
    }
    heart.setAttribute('font-size', 23 * unit);
  }
  function setBox(box) {
    currentBox = box; svg.setAttribute('viewBox', box.join(' ')); decorations();
    if (route && heart) drawProgress(progress);
  }
  function frameMap(animate = true) {
    if (!data) return;
    cancelAnimationFrame(viewFrame);
    let bounds = [0, 0, 1100, 720];
    if (enlarged) {
      const points = data.cities.map(city => city.point), padding = mobile.matches ? 31 : 85;
      const xs = points.map(point => point[0]), ys = points.map(point => point[1]);
      bounds = [Math.min(...xs) - padding, Math.min(...ys) - padding,
        Math.max(...xs) - Math.min(...xs) + padding * 2, Math.max(...ys) - Math.min(...ys) + padding * 2];
    }
    const target = fit(bounds), from = [...currentBox], start = performance.now();
    svg.classList.toggle('is-enlarged', enlarged); insetGroup.hidden = enlarged;
    insetGroup.style.display = enlarged ? 'none' : '';
    $('map-mode').textContent = enlarged ? '全国视图' : '放大足迹';
    $('map-mode').setAttribute('aria-pressed', String(enlarged));
    if (!animate || reduced.matches) { setBox(target); return; }
    function tick(now) {
      const amount = Math.min(1, (now - start) / 700), t = ease(amount);
      setBox(target.map((value, i) => from[i] + (value - from[i]) * t));
      if (amount < 1) viewFrame = requestAnimationFrame(tick);
    }
    viewFrame = requestAnimationFrame(tick);
  }
  function drawProgress(value) {
    progress = value; let remaining = totalLength * value, point = data.cities[0].point;
    const parts = [];
    for (const segment of segments) {
      if (remaining >= segment.length - .000001) {
        parts.push(segment.part); remaining -= segment.length; point = segment.b; continue;
      }
      if (remaining > 0) {
        const upperIndex = segment.arc.findIndex(entry => entry.length >= remaining);
        const upper = segment.arc[Math.max(1, upperIndex)], lower = segment.arc[Math.max(0, upperIndex - 1)];
        const t = lower.t + (upper.t - lower.t) * (remaining - lower.length) / Math.max(.000001, upper.length - lower.length);
        const control = segment.a.map((value, i) => value + (segment.c[i] - value) * t);
        point = quadratic(segment.a, segment.c, segment.b, t);
        parts.push(`Q${control.join(',')} ${point.join(',')}`);
      }
      break;
    }
    route.setAttribute('d', `M${data.cities[0].point.join(',')} ${parts.join(' ')}`);
    heart.setAttribute('x', point[0]); heart.setAttribute('y', point[1] - currentBox[2] / Math.max(1, svg.clientWidth) * 17);
  }
  function moveProgress(target, animate) {
    cancelAnimationFrame(progressFrame);
    if (!animate || reduced.matches) { drawProgress(target); return; }
    const from = progress, start = performance.now();
    function tick(now) {
      const amount = Math.min(1, (now - start) / 1100);
      drawProgress(from + (target - from) * ease(amount));
      if (amount < 1) progressFrame = requestAnimationFrame(tick);
    }
    progressFrame = requestAnimationFrame(tick);
  }
  function controls() {
    $('trip-prev').disabled = index === 0; $('trip-next').disabled = index === data.cities.length - 1;
    $('trip-play').disabled = false; $('trip-replay').disabled = false; $('map-mode').disabled = false;
    $('trip-play').textContent = playing ? '暂停旅程' : index === data.cities.length - 1 ? '重温旅程' : '播放旅程';
    $('trip-play').setAttribute('aria-pressed', String(playing));
  }
  function pause() { playing = false; clearTimeout(timer); if (data) controls(); }
  function select(next, animate = true, automatic = false) {
    if (!data) return;
    if (!automatic) pause();
    index = Math.max(0, Math.min(data.cities.length - 1, next));
    const city = data.cities[index];
    $('city-name').textContent = city.name; $('city-province').textContent = city.province;
    $('city-position').textContent = `${index + 1} / ${data.cities.length}`;
    $('city-memory-link').href = 'city.html?city=' + city.id;
    $('city-memory-link').textContent = '收藏' + city.name + '的回忆';
    nodes.forEach((node, i) => {
      node.group.classList.toggle('is-current', i === index); node.group.classList.toggle('is-visited', i <= index);
      node.hit.setAttribute('aria-pressed', String(i === index));
      stopButtons[i].setAttribute('aria-pressed', String(i === index));
      stopButtons[i].classList.toggle('is-visited', i <= index);
    });
    svg.querySelectorAll('.map-province').forEach(path => path.classList.toggle('is-current-province', path.dataset.code === city.provinceCode));
    moveProgress(targets[index], animate); controls();
  }
  function play(restart = false) {
    if (!data) return;
    pause(); if (restart || index === data.cities.length - 1) select(0, false);
    playing = true; controls();
    function advance() {
      if (!playing) return;
      if (index === data.cities.length - 1) { pause(); return; }
      select(index + 1, true, true); timer = setTimeout(advance, 1950);
    }
    timer = setTimeout(advance, 1100);
  }
  function build() {
    svg.replaceChildren(); $('travel-stops').replaceChildren(); nodes = []; stopButtons = [];
    const defs = create('defs');
    const clip = create('clipPath', { id: 'south-sea-clip' }, defs); create('rect', { x: 0, y: 0, width: 140, height: 178, rx: 8 }, clip);
    const land = create('g', { class: 'map-land' });
    for (const province of data.provinces) {
      const path = create('path', { d: province.path, class: 'map-province', 'data-code': province.code, 'fill-rule': 'evenodd' }, land);
      const title = create('title', {}, path); title.textContent = province.name;
    }
    segments = data.cities.slice(1).map((city, i) => {
      const a = data.cities[i].point, b = city.point;
      const bend = i % 2 ? -.23 : .23;
      const cx = (a[0] + b[0]) / 2 - (b[1] - a[1]) * bend;
      const cy = (a[1] + b[1]) / 2 + (b[0] - a[0]) * bend;
      const part = `Q${cx},${cy} ${b[0]},${b[1]}`;
      const c = [cx, cy], arc = [{ t: 0, length: 0 }]; let length = 0, previous = a;
      for (let step = 1; step <= 80; step++) {
        const t = step / 80, point = quadratic(a, c, b, t);
        length += Math.hypot(point[0] - previous[0], point[1] - previous[1]); arc.push({ t, length }); previous = point;
      }
      return { a, b, c, part, arc, length };
    });
    const d = `M${data.cities[0].point.join(',')} ` + segments.map(part => part.part).join(' ');
    create('path', { d, class: 'travel-route-base' });
    route = create('path', { class: 'travel-route-progress' }); totalLength = segments.reduce((sum, part) => sum + part.length, 0); targets = [0];
    let sum = 0; for (const part of segments) { sum += part.length; targets.push(sum / totalLength); }
    targets[targets.length - 1] = 1;
    const nodeLayer = create('g', { class: 'map-cities' });
    for (const [i, city] of data.cities.entries()) {
      const group = create('g', { class: 'map-city', transform: `translate(${city.point.join(' ')})` }, nodeLayer);
      const hit = create('circle', { class: 'city-hit', tabindex: 0, role: 'button', 'aria-label': `查看${city.name}`, 'aria-pressed': 'false' }, group);
      const halo = create('circle', { class: 'city-halo' }, group);
      const ring = create('circle', { class: 'city-ring' }, group), dot = create('circle', { class: 'city-dot' }, group);
      const label = create('g', { class: 'city-label' }, group);
      const leader = create('path', { class: 'city-leader' }, label);
      const labelBox = create('rect', { class: 'city-label-box' }, label);
      const labelText = create('text', { class: 'city-label-text', 'text-anchor': 'middle' }, label); labelText.textContent = city.name;
      group.addEventListener('click', () => select(i));
      group.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(i); } });
      nodes.push({ city, group, hit, halo, ring, dot, leader, labelBox, labelText });
      const button = document.createElement('button'); button.type = 'button'; button.textContent = city.name;
      button.setAttribute('aria-pressed', 'false'); button.addEventListener('click', () => select(i));
      button.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault(); const next = (i + (event.key === 'ArrowRight' ? 1 : -1) + data.cities.length) % data.cities.length;
        select(next); stopButtons[next].focus();
      });
      $('travel-stops').append(button); stopButtons.push(button);
    }
    heart = create('text', { class: 'travel-heart', 'text-anchor': 'middle', 'aria-hidden': 'true' }); heart.textContent = '♥';
    insetGroup = create('g', { class: 'map-inset', transform: 'translate(926 510)', 'aria-label': '南海诸岛' });
    create('rect', { width: 140, height: 178, rx: 8, class: 'inset-paper' }, insetGroup);
    const insetShapes = create('g', { 'clip-path': 'url(#south-sea-clip)' }, insetGroup);
    for (const area of data.inset) create('path', { d: area.path, class: 'inset-land' }, insetShapes);
    const title = create('text', { x: 70, y: 165, 'text-anchor': 'middle', class: 'inset-title' }, insetGroup); title.textContent = '南海诸岛';
    frameMap(false); select(0, false);
  }
  async function load() {
    $('travel-loading').hidden = false; $('map-retry').hidden = true; $('map-status').textContent = '正在展开地图…';
    $('map-panel').setAttribute('aria-busy', 'true');
    try {
      const response = await fetch('assets/travel/map.json?v=20261121-11'); if (!response.ok) throw new Error('Map unavailable');
      data = await response.json(); build(); $('travel-loading').hidden = true; $('travel-city-card').hidden = false;
      if (!reduced.matches) play();
    } catch {
      $('map-status').textContent = '地图暂时没有展开'; $('map-retry').hidden = false;
    } finally { $('map-panel').removeAttribute('aria-busy'); }
  }
  $('map-mode').addEventListener('click', () => { enlarged = !enlarged; frameMap(); });
  $('trip-prev').addEventListener('click', () => select(index - 1)); $('trip-next').addEventListener('click', () => select(index + 1));
  $('trip-play').addEventListener('click', () => playing ? pause() : play()); $('trip-replay').addEventListener('click', () => play(true));
  $('map-retry').addEventListener('click', load);
  new ResizeObserver(() => { if (data) frameMap(false); }).observe($('map-panel'));
  reduced.addEventListener('change', () => { pause(); if (data) { frameMap(false); moveProgress(targets[index], false); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  addEventListener('pagehide', pause); load();
})();
