(() => {
  const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'menu-toggle'; toggle.setAttribute('aria-label','打开导航菜单'); toggle.setAttribute('aria-expanded','false'); toggle.setAttribute('aria-controls','nav-drawer'); toggle.innerHTML = '<span></span><span></span><span></span>';
  const drawer = document.createElement('dialog'); drawer.id = 'nav-drawer'; drawer.className = 'nav-drawer'; drawer.setAttribute('aria-label','网站导航');
  drawer.innerHTML = `<button class="drawer-close" type="button" aria-label="关闭导航菜单">×</button><p class="drawer-name">敏，冬日暖阳</p><nav><a href="./" data-page="home"><svg viewBox="0 0 24 24"><path d="m3 10 9-7 9 7v11h-6v-7H9v7H3Z"/></svg>首页</a><a href="dailyM.html" data-page="daily"><svg viewBox="0 0 24 24"><path d="M5 3h14v18H5ZM8 7h8M8 11h8M8 15h5"/></svg>dailyM</a><a href="./#gallery" data-page="gallery"><svg viewBox="0 0 24 24"><path d="M3 7h4l2-3h6l2 3h4v13H3Z"/><circle cx="12" cy="13" r="4"/></svg>照相馆</a><a href="gameM.html" data-page="game"><svg viewBox="0 0 24 24"><path d="M7 7h10c3 0 5 10 3 11s-4-3-5-3H9c-1 0-3 4-5 3S4 7 7 7ZM6 11h5M8.5 8.5v5M16 10h.01M18 12h.01"/></svg>gameM</a></nav><span class="drawer-date">SINCE 2025.12.09</span>`;
  const page = document.body.dataset.journal || 'home'; drawer.querySelector(`[data-page="${page}"]`)?.setAttribute('aria-current','page');
  document.body.append(toggle, drawer);
  toggle.addEventListener('click', () => { drawer.showModal(); toggle.setAttribute('aria-expanded','true'); });
  drawer.querySelector('.drawer-close').addEventListener('click', () => drawer.close());
  drawer.addEventListener('close', () => toggle.setAttribute('aria-expanded','false'));
  drawer.addEventListener('click', event => { const r=drawer.getBoundingClientRect(); if(event.target===drawer && (event.clientX<r.left || event.clientX>r.right))drawer.close(); });
  drawer.querySelector('[data-page="gallery"]').addEventListener('click', event => { if(document.getElementById('gallery-dialog')) { event.preventDefault(); drawer.close(); document.dispatchEvent(new Event('open-gallery')); } });
})();
