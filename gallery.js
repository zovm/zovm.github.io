(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const gallery = $('gallery-dialog'), room = $('gallery-room'), orbit = $('photo-orbit');
  const lightbox = $('lightbox-dialog'), categoryList = $('gallery-categories');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const video = document.createElement('video');
  video.id = 'lightbox-video'; video.controls = true; video.playsInline = true;
  video.preload = 'metadata'; video.hidden = true;
  $('lightbox-image').after(video);
  const mediaError = document.createElement('p');
  mediaError.className = 'gallery-media-error'; mediaError.hidden = true;
  mediaError.setAttribute('role', 'alert'); $('lightbox-caption').after(mediaError);
  let albums = null, catalogPromise = null, selected = null;
  let angle = 0, cards = [], frame = 0, last = 0, paused = reduce.matches, hovering = false;
  let dragging = false, dragged = false, dragStart = 0, dragAngle = 0, mediaIndex = 0;
  let radiusX = 0, radiusY = 0;

  function duration(seconds) {
    return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  }
  function stopVideo() {
    video.pause(); video.removeAttribute('src'); video.load(); video.hidden = true;
    mediaError.hidden = true; mediaError.replaceChildren();
  }
  async function catalog() {
    if (albums) return albums;
    if (!catalogPromise) catalogPromise = (async () => {
      const response = await fetch('assets/gallery/albums.json?v=20261121-10');
      if (!response.ok) throw new Error('Cannot load albums');
      const data = await response.json();
      if (!Array.isArray(data) || !data.length || data.some(a => !a.id || !a.title || !a.items?.length)) throw new Error('Invalid album');
      albums = data; return albums;
    })().finally(() => { catalogPromise = null; });
    return catalogPromise;
  }
  function renderCategories() {
    categoryList.replaceChildren();
    for (const album of albums) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'album-cover'; button.dataset.album = album.id;
      const cover = document.createElement('span'); cover.className = 'cover-photo';
      const image = document.createElement('img'); image.src = album.cover;
      image.alt = album.title + '相册封面'; image.loading = 'lazy'; image.decoding = 'async';
      cover.append(image);
      const name = document.createElement('span'); name.className = 'album-name'; name.textContent = album.title;
      const count = document.createElement('span'); count.className = 'album-count';
      const clips = album.items.filter(item => item.type === 'video').length;
      const photos = album.items.length - clips;
      count.textContent = [photos ? `${photos} 张` : '', clips ? `${clips} 段视频` : ''].filter(Boolean).join(' · ');
      button.append(cover, name, count);
      button.addEventListener('click', () => selectAlbum(album.id));
      categoryList.append(button);
    }
  }
  function layout() {
    radiusX = Math.min(orbit.clientWidth * .305, 370);
    radiusY = Math.min(orbit.clientHeight * .28, 150); paint();
  }
  function paint() {
    const count = cards.length;
    cards.forEach((card, i) => {
      const theta = angle + i / count * Math.PI * 2, depth = (Math.cos(theta) + 1) / 2;
      const x = count === 1 ? 0 : Math.sin(theta) * radiusX;
      const y = count === 1 ? 0 : Math.cos(theta) * radiusY;
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
    selected = albums.find(album => album.id === key); if (!selected) return;
    stopVideo(); angle = 0; dragging = dragged = hovering = false;
    categoryList.hidden = true; room.hidden = false; $('gallery-back').hidden = false;
    $('gallery-title').textContent = selected.title;
    orbit.replaceChildren();
    cards = selected.items.map((item, index) => {
      const card = document.createElement('button'); card.type = 'button'; card.className = 'orbit-card';
      if (selected.id === 'pair') card.classList.add('illustration-card');
      if (item.type === 'video') card.classList.add('video-card');
      card.setAttribute('aria-label', `${item.type === 'video' ? '播放视频：' : '放大'}${item.alt}`);
      const image = document.createElement('img');
      image.src = item.type === 'video' ? item.poster : item.src; image.alt = item.alt;
      image.draggable = false; image.decoding = 'async';
      const number = document.createElement('span'); number.className = 'media-number';
      number.textContent = String(index + 1).padStart(2, '0'); number.setAttribute('aria-hidden', 'true');
      card.append(image, number);
      if (item.type === 'video') {
        const play = document.createElement('span'); play.className = 'media-play'; play.setAttribute('aria-hidden', 'true');
        play.innerHTML = '<svg viewBox="0 0 24 24"><path d="m9 5 10 7-10 7Z"/></svg>';
        const length = document.createElement('span'); length.className = 'media-length'; length.textContent = duration(item.duration);
        card.append(play, length);
      }
      card.addEventListener('click', event => { if (dragged) { event.preventDefault(); return; } showMedia(index); });
      card.addEventListener('focus', () => { hovering = true; });
      card.addEventListener('blur', () => { hovering = false; });
      orbit.append(card); return card;
    });
    for (const id of ['orbit-prev', 'orbit-next', 'orbit-pause']) $(id).hidden = cards.length <= 1;
    layout(); start();
  }
  function categories() {
    stopVideo(); room.hidden = true; categoryList.hidden = false;
    $('gallery-back').hidden = true; $('gallery-title').textContent = '照相馆';
    if (frame) cancelAnimationFrame(frame);
    frame = 0; selected = null; hovering = dragging = dragged = false;
  }
  function showMedia(index) {
    stopVideo(); mediaIndex = (index + selected.items.length) % selected.items.length;
    const item = selected.items[mediaIndex], image = $('lightbox-image');
    image.hidden = item.type === 'video';
    if (item.type === 'video') {
      video.poster = item.poster; video.src = item.src; video.hidden = false;
      video.setAttribute('aria-label', item.alt); lightbox.setAttribute('aria-label', '播放视频');
    } else {
      image.src = item.src; image.alt = item.alt; lightbox.setAttribute('aria-label', '放大照片');
    }
    $('lightbox-caption').textContent = `${selected.title} · ${mediaIndex + 1} / ${selected.items.length}`;
    $('lightbox-prev').hidden = $('lightbox-next').hidden = selected.items.length < 2;
    if (!lightbox.open) lightbox.showModal();
    if (item.type === 'video') video.play().catch(() => {});
  }
  function pauseButton() {
    $('orbit-pause').setAttribute('aria-pressed', String(paused));
    $('orbit-pause').setAttribute('aria-label', paused ? '继续转动' : '暂停转动');
    $('orbit-pause').title = paused ? '继续转动' : '暂停转动';
    $('orbit-pause').querySelector('use').setAttribute('href', paused ? '#i-play' : '#i-pause');
  }
  async function openGallery() {
    categories(); if (!gallery.open) gallery.showModal();
    if (albums) return;
    const loading = document.createElement('p'); loading.className = 'gallery-state';
    loading.textContent = '正在翻开相册…'; loading.setAttribute('role', 'status'); categoryList.replaceChildren(loading);
    categoryList.setAttribute('aria-busy', 'true');
    try { await catalog(); renderCategories(); }
    catch {
      const retry = document.createElement('button'); retry.className = 'quiet-button gallery-retry';
      retry.type = 'button'; retry.textContent = '重新加载相册'; retry.addEventListener('click', openGallery);
      categoryList.replaceChildren(retry);
    } finally { categoryList.removeAttribute('aria-busy'); }
  }
  $('gallery-open')?.addEventListener('click', openGallery);
  document.addEventListener('open-gallery', openGallery);
  $('gallery-close').addEventListener('click', () => {
    if (document.body.dataset.galleryPage) location.href = './?home=1'; else gallery.close();
  });
  $('gallery-back').addEventListener('click', categories);
  $('orbit-prev').addEventListener('click', () => { angle -= Math.PI / 2; paint(); });
  $('orbit-next').addEventListener('click', () => { angle += Math.PI / 2; paint(); });
  $('orbit-pause').addEventListener('click', () => { paused = !paused; pauseButton(); });
  $('lightbox-close').addEventListener('click', () => lightbox.close());
  $('lightbox-prev').addEventListener('click', () => showMedia(mediaIndex - 1));
  $('lightbox-next').addEventListener('click', () => showMedia(mediaIndex + 1));
  lightbox.addEventListener('close', stopVideo);
  video.addEventListener('play', () => document.dispatchEvent(new Event('zengmin:video-play')));
  video.addEventListener('error', () => {
    if (!video.getAttribute('src')) return;
    const link = document.createElement('a'); link.href = video.getAttribute('src'); link.download = '';
    link.textContent = '下载视频'; mediaError.replaceChildren(document.createTextNode('视频暂时无法播放，'), link); mediaError.hidden = false;
  });
  gallery.addEventListener('close', () => { stopVideo(); if (frame) cancelAnimationFrame(frame); frame = 0; });
  gallery.addEventListener('cancel', event => {
    if (document.body.dataset.galleryPage) { event.preventDefault(); location.href = './?home=1'; }
  });
  orbit.addEventListener('pointerenter', () => { hovering = true; });
  orbit.addEventListener('pointerleave', () => { if (!dragging) hovering = false; });
  orbit.addEventListener('pointerdown', event => {
    if (event.button !== 0) return; dragging = true; dragged = false; dragStart = event.clientX; dragAngle = angle;
  });
  addEventListener('pointermove', event => {
    if (!dragging) return;
    const dx = event.clientX - dragStart;
    if (Math.abs(dx) > 7) { dragged = true; angle = dragAngle + dx * .009; paint(); }
  }, { passive: true });
  addEventListener('pointerup', () => {
    if (!dragging) return; dragging = false; hovering = false; setTimeout(() => { dragged = false; }, 80);
  });
  addEventListener('pointercancel', () => { dragging = dragged = hovering = false; });
  lightbox.addEventListener('keydown', event => {
    if (event.target === video) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); showMedia(mediaIndex + (event.key === 'ArrowRight' ? 1 : -1)); }
  });
  gallery.addEventListener('keydown', event => {
    if (room.hidden || lightbox.open) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); angle += (event.key === 'ArrowRight' ? 1 : -1) * Math.PI / 2; paint(); }
  });
  addEventListener('pagehide', () => video.pause());
  addEventListener('resize', () => { if (gallery.open && !room.hidden) layout(); }, { passive: true });
  document.addEventListener('visibilitychange', () => { last = 0; if (document.hidden) video.pause(); });
  reduce.addEventListener('change', () => { paused = reduce.matches; pauseButton(); });
  pauseButton();
  if (location.hash === '#gallery' || document.body.dataset.galleryPage) openGallery();
})();
