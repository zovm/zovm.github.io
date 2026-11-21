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
  const breadcrumbs = document.createElement('nav');
  breadcrumbs.className = 'gallery-path'; breadcrumbs.setAttribute('aria-label', '相册路径');
  breadcrumbs.hidden = true; gallery.querySelector('.gallery-header').append(breadcrumbs);
  const emptyAlbum = document.createElement('p');
  emptyAlbum.className = 'gallery-empty'; emptyAlbum.textContent = '暂无照片'; emptyAlbum.hidden = true;
  room.append(emptyAlbum);
  let albums = null, catalogPromise = null, selected = null;
  let ancestors = [], requestedAlbum = document.body.dataset.galleryPage ? new URLSearchParams(location.search).get('album') : null;
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
  function validateCatalog(list, ids = new Set()) {
    if (!Array.isArray(list)) throw new Error('Invalid album list');
    for (const album of list) {
      if (!album.id || !album.title || ids.has(album.id)) throw new Error('Invalid album');
      ids.add(album.id);
      if (Array.isArray(album.children)) validateCatalog(album.children, ids);
      else if (!Array.isArray(album.items) || album.items.some(item => !['image', 'video'].includes(item.type) || !item.src || !item.alt)) throw new Error('Invalid media');
    }
  }
  function currentAlbums() { return ancestors.length ? ancestors[ancestors.length - 1].children : albums; }
  function findAlbum(id, list = albums, parents = []) {
    for (const album of list) {
      if (album.id === id) return { album, parents };
      if (album.children) { const found = findAlbum(id, album.children, [...parents, album]); if (found) return found; }
    }
    return null;
  }
  function updatePath() {
    const path = [...ancestors]; if (selected) path.push(selected);
    breadcrumbs.replaceChildren(); breadcrumbs.hidden = !path.length;
    gallery.classList.toggle('has-album-path', path.length > 0);
    function part(title, action) {
      if (breadcrumbs.children.length) { const slash = document.createElement('span'); slash.textContent = '/'; slash.setAttribute('aria-hidden', 'true'); breadcrumbs.append(slash); }
      const element = document.createElement(action ? 'button' : 'span'); element.textContent = title;
      if (action) { element.type = 'button'; element.addEventListener('click', action); }
      else element.setAttribute('aria-current', 'page');
      breadcrumbs.append(element);
    }
    if (path.length) part('照相馆', () => categories(true));
    path.forEach((album, index) => part(album.title, index < path.length - 1 ? () => { ancestors = ancestors.slice(0, index + 1); categories(); } : null));
    const backTitle = selected ? (ancestors[ancestors.length - 1]?.title || '相册分类') : (ancestors[ancestors.length - 2]?.title || '照相馆');
    $('gallery-back').setAttribute('aria-label', '返回' + backTitle); $('gallery-back').title = '返回' + backTitle;
    if (document.body.dataset.galleryPage && albums) {
      const url = new URL(location.href), active = selected || ancestors[ancestors.length - 1];
      if (active) url.searchParams.set('album', active.id); else url.searchParams.delete('album');
      history.replaceState(history.state, '', url);
    }
  }
  async function catalog() {
    if (albums) return albums;
    if (!catalogPromise) catalogPromise = (async () => {
      const data = await GalleryData.load();
      validateCatalog(data);
      albums = data; return albums;
    })().finally(() => { catalogPromise = null; });
    return catalogPromise;
  }
  function renderCategories(focusId = null) {
    categoryList.replaceChildren();
    for (const album of currentAlbums()) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'album-cover'; button.dataset.album = album.id;
      if (album.display === 'screenshot') button.classList.add('screenshot-cover');
      if (album.children) button.classList.add('album-folder');
      const cover = document.createElement('span'); cover.className = 'cover-photo';
      if (album.cover) {
        const image = document.createElement('img'); image.src = album.cover;
        image.alt = album.title + '相册封面'; image.loading = 'lazy'; image.decoding = 'async'; cover.append(image);
      } else {
        cover.classList.add('album-placeholder');
        cover.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M15 15h18c8 0 14 23 9 25s-9-8-12-8H18c-3 0-7 10-12 8S7 15 15 15Z"/><path d="M10 23h10M15 18v10M31 22h.1M36 26h.1"/></svg>';
      }
      if (album.children) { const badge = document.createElement('span'); badge.className = 'album-folder-mark'; badge.setAttribute('aria-hidden', 'true'); badge.innerHTML = '<svg viewBox="0 0 24 24"><path d="M3 7V5h7l3 3h8v12H3ZM3 8h18"/></svg>'; cover.append(badge); }
      const name = document.createElement('span'); name.className = 'album-name'; name.textContent = album.title;
      const count = document.createElement('span'); count.className = 'album-count';
      const clips = (album.items || []).filter(item => item.type === 'video').length;
      const photos = (album.items || []).length - clips;
      count.textContent = album.children ? `${album.children.length} 个相册` : [photos ? `${photos} 张` : '', clips ? `${clips} 段视频` : ''].filter(Boolean).join(' · ') || '0 张';
      button.append(cover, name, count);
      button.addEventListener('click', () => selectAlbum(album.id));
      categoryList.append(button);
      if (album.id === focusId) button.focus();
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
  function rotate(direction) { if (cards.length > 1) { angle += direction * Math.PI * 2 / cards.length; paint(); } }
  function selectAlbum(key) {
    const album = currentAlbums().find(album => album.id === key); if (!album) return;
    if (album.children) { ancestors.push(album); categories(); categoryList.scrollTop = 0; return; }
    selected = album;
    stopVideo(); angle = 0; dragging = dragged = hovering = false;
    categoryList.hidden = true; room.hidden = false; $('gallery-back').hidden = false;
    $('gallery-title').textContent = selected.title;
    emptyAlbum.hidden = selected.items.length > 0; orbit.hidden = selected.items.length === 0;
    updatePath(); manage();
    orbit.replaceChildren();
    cards = selected.items.map((item, index) => {
      const card = document.createElement('button'); card.type = 'button'; card.className = 'orbit-card';
      if (selected.id === 'pair') card.classList.add('illustration-card');
      if (selected.display === 'screenshot') card.classList.add('screenshot-card');
      if (item.type === 'video') card.classList.add('video-card');
      card.setAttribute('aria-label', `${item.type === 'video' ? '播放视频：' : '放大'}${item.alt}`);
      const image = document.createElement('img');
      image.src = item.type === 'video' ? item.poster : (item.thumb || item.src); image.alt = item.alt;
      image.draggable = false; image.decoding = 'async';
      const number = document.createElement('span'); number.className = 'media-number';
      number.textContent = String(index + 1).padStart(2, '0'); number.setAttribute('aria-hidden', 'true');
      card.append(image, number);
      if (item.type === 'video') {
        const play = document.createElement('span'); play.className = 'media-play'; play.setAttribute('aria-hidden', 'true');
        play.innerHTML = '<svg viewBox="0 0 24 24"><path d="m9 5 10 7-10 7Z"/></svg>';
        const length = document.createElement('span'); length.className = 'media-length'; length.textContent = Number.isFinite(item.duration) ? duration(item.duration) : '视频';
        card.append(play, length);
      }
      card.addEventListener('click', event => { if (dragged) { event.preventDefault(); return; } showMedia(index); });
      card.addEventListener('focus', () => { hovering = true; });
      card.addEventListener('blur', () => { hovering = false; });
      orbit.append(card); return card;
    });
    for (const id of ['orbit-prev', 'orbit-next', 'orbit-pause']) $(id).hidden = cards.length <= 1;
    layout(); if (cards.length) start();
  }
  function categories(reset = false, focusId = null) {
    stopVideo(); room.hidden = true; categoryList.hidden = false;
    if (reset) ancestors = [];
    $('gallery-back').hidden = ancestors.length === 0;
    $('gallery-title').textContent = ancestors[ancestors.length - 1]?.title || '照相馆';
    if (frame) cancelAnimationFrame(frame);
    frame = 0; selected = null; hovering = dragging = dragged = false;
    if (albums) renderCategories(focusId);
    updatePath(); manage();
  }
  function back() {
    if (!room.hidden) { const focusId = selected?.id; categories(false, focusId); }
    else if (ancestors.length) { const focusId = ancestors.pop().id; categories(false, focusId); }
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
    const label = selected.display === 'screenshot' ? item.alt : selected.title;
    $('lightbox-caption').textContent = `${item.recordId ? item.alt : label} · ${mediaIndex + 1} / ${selected.items.length}`;
    if (item.recordId) { const detail=document.createElement('a');detail.href=`record.html?kind=gallery&id=${encodeURIComponent(item.recordId)}`;detail.className='lightbox-detail-link';detail.textContent='查看记录';$('lightbox-caption').append(detail); }
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
    categories(true); if (!gallery.open) gallery.showModal();
    if (albums) return;
    const loading = document.createElement('p'); loading.className = 'gallery-state';
    loading.textContent = '正在翻开相册…'; loading.setAttribute('role', 'status'); categoryList.replaceChildren(loading);
    categoryList.setAttribute('aria-busy', 'true');
    try {
      await catalog(); renderCategories();
      if (requestedAlbum) {
        let destination = findAlbum(requestedAlbum);
        if(!destination){await Memories.refresh();albums=null;await catalog();destination=findAlbum(requestedAlbum);}
        requestedAlbum = null;
        if (destination) { ancestors = destination.parents; selectAlbum(destination.album.id); }
        else updatePath();
      }
    }
    catch {
      const retry = document.createElement('button'); retry.className = 'quiet-button gallery-retry';
      retry.type = 'button'; retry.textContent = '重新加载相册'; retry.addEventListener('click', openGallery);
      categoryList.replaceChildren(retry);
    } finally { categoryList.removeAttribute('aria-busy'); }
  }
  const manageBar=$('gallery-manage-bar');
  const createAlbum=document.createElement('button');createAlbum.type='button';createAlbum.className='quiet-button';createAlbum.textContent='＋ 新建相册';
  const addMedia=document.createElement('a');addMedia.className='primary-button';addMedia.textContent='＋ 照片 / 视频';addMedia.hidden=true;
  manageBar.prepend(createAlbum,addMedia);
  const createDialog=document.createElement('dialog');createDialog.className='sync-dialog album-create-dialog';createDialog.setAttribute('aria-labelledby','album-create-title');
  createDialog.innerHTML='<header class="sync-heading"><h2 id="album-create-title">新建相册</h2><button class="sync-close" type="button" aria-label="关闭新建相册">×</button></header><form><label for="new-album-title">名称</label><input id="new-album-title" maxlength="60" required autocomplete="off"><label for="new-album-folder" class="album-folder-label"><input id="new-album-folder" type="checkbox"> 创建分类，里面可以放子相册</label><p class="form-error" role="alert"></p><button class="primary-button" type="submit">创建</button></form>';
  document.body.append(createDialog);
  function manage(){createAlbum.hidden=!!selected;addMedia.hidden=!selected;if(selected)addMedia.href=`record.html?kind=gallery&album=${encodeURIComponent(selected.id)}&new=1`;}
  createAlbum.addEventListener('click',()=>{$('new-album-title').value='';$('new-album-folder').checked=false;createDialog.querySelector('.form-error').textContent='';createDialog.querySelector('[type=submit]').textContent=GitHubSync.connected()?'创建并同步':'创建';createDialog.showModal();});
  createDialog.querySelector('.sync-close').addEventListener('click',()=>createDialog.close());
  createDialog.querySelector('form').addEventListener('submit',async event=>{
    event.preventDefault();const submit=event.target.querySelector('[type=submit]');submit.disabled=true;
    try{const row=await Memories.addAlbum($('new-album-title').value.trim(),ancestors[ancestors.length-1]?.id||'',$('new-album-folder').checked);createDialog.close();await reloadCatalog(row.id);if(GitHubSync.connected())GitHubSync.sync().catch(()=>{});}catch(error){createDialog.querySelector('.form-error').textContent=error.message;}finally{submit.disabled=false;}
  });
  let reloadTimer;
  async function reloadCatalog(targetId){
    const activeId=targetId||selected?.id||ancestors[ancestors.length-1]?.id;
    if(catalogPromise)await catalogPromise;
    albums=null;await catalog();const found=activeId?findAlbum(activeId):null;
    if(found){ancestors=found.parents;selectAlbum(found.album.id);}else categories(true);
  }
  document.addEventListener('zengmin:content-changed',()=>{if(!gallery.open)return;clearTimeout(reloadTimer);reloadTimer=setTimeout(()=>reloadCatalog().catch(()=>{}),120);});
  addEventListener('storage',event=>{if(event.key==='zengmin:records-changed'&&albums)reloadCatalog().catch(()=>{});});
  $('gallery-open')?.addEventListener('click', openGallery);
  document.addEventListener('open-gallery', openGallery);
  $('gallery-close').addEventListener('click', () => {
    if (document.body.dataset.galleryPage) location.href = './?home=1'; else gallery.close();
  });
  $('gallery-back').addEventListener('click', back);
  $('orbit-prev').addEventListener('click', () => rotate(-1));
  $('orbit-next').addEventListener('click', () => rotate(1));
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
    if (!room.hidden || ancestors.length) { event.preventDefault(); back(); }
    else if (document.body.dataset.galleryPage) { event.preventDefault(); location.href = './?home=1'; }
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
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); rotate(event.key === 'ArrowRight' ? 1 : -1); }
  });
  addEventListener('pagehide', () => video.pause());
  addEventListener('resize', () => { if (gallery.open && !room.hidden) layout(); }, { passive: true });
  document.addEventListener('visibilitychange', () => { last = 0; if (document.hidden) video.pause(); });
  reduce.addEventListener('change', () => { paused = reduce.matches; pauseButton(); });
  pauseButton();
  if (location.hash === '#gallery' || document.body.dataset.galleryPage) openGallery();
})();
