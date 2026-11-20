(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const gallery = $('gallery-dialog'), room = $('gallery-room'), orbit = $('photo-orbit'), lightbox = $('lightbox-dialog');
  const albums = {
    love: { title: 'Love', photos: [1, 2, 3, 4].map(i => ({ src: `assets/gallery/love-${String(i).padStart(2, '0')}.jpg`, alt: `爱的日常，第 ${i} 张照片` })) },
    memory: { title: '牵手的瞬间', photos: [{ src: 'assets/our-memory.jpg', alt: '我们牵手的影子' }] }
  };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let selected = null, angle = 0, cards = [], frame = 0, last = 0, paused = reduce.matches, hovering = false, dragging = false, dragStart = 0, dragAngle = 0, dragged = false, photoIndex = 0, radiusX = 0, radiusY = 0;
  function layout() {
    const w = orbit.clientWidth, h = orbit.clientHeight;
    radiusX = Math.min(w * .305, 370); radiusY = Math.min(h * .28, 150); paint();
  }
  function paint() {
    const count = cards.length;
    cards.forEach((card, i) => {
      const theta = angle + i / count * Math.PI * 2, depth = (Math.cos(theta) + 1) / 2;
      const x = count === 1 ? 0 : Math.sin(theta) * radiusX, y = count === 1 ? 0 : Math.cos(theta) * radiusY;
      const scale = count === 1 ? 1.08 : .70 + depth * .30;
      const tilt = count === 1 ? -4 : Math.sin(theta) * 12;
      card.style.transform = `translate(-50%,-50%) translate(${x}px,${y}px) rotate(${tilt}deg) scale(${scale})`;
      card.style.zIndex = String(Math.round(depth * 100)); card.style.opacity = String(.55 + depth * .45);
    });
  }
  function animate(now) {
    if (!gallery.open || room.hidden) { frame = 0; return; }
    const dt = Math.min((now - (last || now)) / 1000, .05); last = now;
    if (!paused && !hovering && !dragging && !lightbox.open && !document.hidden && cards.length > 1) { angle += dt * .13; paint(); }
    frame = requestAnimationFrame(animate);
  }
  function start() { if (!frame) { last = 0; frame = requestAnimationFrame(animate); } }
  function selectAlbum(key) {
    selected = albums[key]; if (!selected) return;
    angle = 0; $('gallery-categories').hidden = true; room.hidden = false; $('gallery-back').hidden = false; $('gallery-title').textContent = selected.title;
    orbit.replaceChildren(); cards = selected.photos.map((photo, i) => {
      const card = document.createElement('button'); card.type = 'button'; card.className = 'orbit-card'; card.setAttribute('aria-label', `放大${photo.alt}`);
      const image = document.createElement('img'); image.src = photo.src; image.alt = photo.alt; image.draggable = false; image.decoding = 'async';
      const number = document.createElement('span'); number.textContent = String(i + 1).padStart(2, '0'); number.setAttribute('aria-hidden', 'true'); card.append(image, number);
      card.addEventListener('click', event => { if (dragged) { event.preventDefault(); return; } showPhoto(i); });
      card.addEventListener('focus', () => { hovering = true; }); card.addEventListener('blur', () => { hovering = false; });
      orbit.append(card); return card;
    });
    const single = cards.length <= 1;
    for (const id of ['orbit-prev', 'orbit-next', 'orbit-pause']) $(id).hidden = single;
    layout(); start();
  }
  function categories() {
    room.hidden = true; $('gallery-categories').hidden = false; $('gallery-back').hidden = true; $('gallery-title').textContent = '照相馆';
    if (frame) { cancelAnimationFrame(frame); frame = 0; } selected = null; hovering = false;
  }
  function showPhoto(index) {
    photoIndex = (index + selected.photos.length) % selected.photos.length;
    const photo = selected.photos[photoIndex], image = $('lightbox-image'); image.src = photo.src; image.alt = photo.alt;
    $('lightbox-caption').textContent = `${selected.title} · ${photoIndex + 1} / ${selected.photos.length}`;
    $('lightbox-prev').hidden = $('lightbox-next').hidden = selected.photos.length < 2;
    if (!lightbox.open) lightbox.showModal();
  }
  function pauseButton() {
    $('orbit-pause').setAttribute('aria-pressed', String(paused)); $('orbit-pause').setAttribute('aria-label', paused ? '继续转动' : '暂停转动'); $('orbit-pause').title = paused ? '继续转动' : '暂停转动';
    $('orbit-pause').querySelector('use').setAttribute('href', paused ? '#i-play' : '#i-pause');
  }
  function openGallery() { categories(); if(!gallery.open) gallery.showModal(); }
  $('gallery-open').addEventListener('click', openGallery);
  document.addEventListener('open-gallery', openGallery);
  $('gallery-close').addEventListener('click', () => { if(document.body.dataset.galleryPage) location.href='./?home=1'; else gallery.close(); }); $('gallery-back').addEventListener('click', categories);
  document.querySelectorAll('[data-album]').forEach(button => button.addEventListener('click', () => selectAlbum(button.dataset.album)));
  $('orbit-prev').addEventListener('click', () => { angle -= Math.PI / 2; paint(); }); $('orbit-next').addEventListener('click', () => { angle += Math.PI / 2; paint(); });
  $('orbit-pause').addEventListener('click', () => { paused = !paused; pauseButton(); });
  $('lightbox-close').addEventListener('click', () => lightbox.close()); $('lightbox-prev').addEventListener('click', () => showPhoto(photoIndex - 1)); $('lightbox-next').addEventListener('click', () => showPhoto(photoIndex + 1));
  gallery.addEventListener('close', () => { if (frame) cancelAnimationFrame(frame); frame = 0; });
  gallery.addEventListener('cancel', event=>{if(document.body.dataset.galleryPage){event.preventDefault();location.href='./?home=1';}});
  orbit.addEventListener('pointerenter', () => { hovering = true; }); orbit.addEventListener('pointerleave', () => { if (!dragging) hovering = false; });
  orbit.addEventListener('pointerdown', event => { if (event.button !== 0) return; dragging = true; dragged = false; dragStart = event.clientX; dragAngle = angle; });
  addEventListener('pointermove', event => { if (!dragging) return; const dx = event.clientX - dragStart; if (Math.abs(dx) > 7) { dragged = true; angle = dragAngle + dx * .009; paint(); } }, { passive: true });
  addEventListener('pointerup', () => { if (!dragging) return; dragging = false; hovering = false; setTimeout(() => { dragged = false; }, 80); });
  addEventListener('pointercancel', () => { dragging = false; dragged = false; hovering = false; });
  lightbox.addEventListener('keydown', event => { if (event.key === 'ArrowRight') { event.preventDefault(); showPhoto(photoIndex + 1); } if (event.key === 'ArrowLeft') { event.preventDefault(); showPhoto(photoIndex - 1); } });
  gallery.addEventListener('keydown', event => { if (room.hidden || lightbox.open) return; if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); angle += (event.key === 'ArrowRight' ? 1 : -1) * Math.PI / 2; paint(); } });
  addEventListener('resize', () => { if (gallery.open && !room.hidden) layout(); }, { passive: true });
  document.addEventListener('visibilitychange', () => { last = 0; });
  reduce.addEventListener('change', () => { paused = reduce.matches; pauseButton(); });
  pauseButton();
  if(location.hash === '#gallery' || document.body.dataset.galleryPage) openGallery();
})();
