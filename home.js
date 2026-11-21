(() => {
  const $=id=>document.getElementById(id),cover=$('entry-cover'),frame=$('entry-frame');
  const origin=Date.parse('2025-12-09T00:00:00+08:00');
  function clock(){const now=Date.now(),elapsed=Math.max(0,now-origin);$('home-days').textContent=Math.floor(elapsed/86400000);for(const [id,div]of[['hours',3600000],['minutes',60000],['seconds',1000]])$(`home-${id}`).textContent=String(Math.floor(elapsed/div)%(id==='hours'?24:60)).padStart(2,'0');
    const anniversary=ZengMinTime.anniversary(now);
    $('anniversary-title').textContent=anniversary.today?`今天是我们的 ${anniversary.number} 周年`:`距离我们的 ${anniversary.number} 周年`;
    $('anniversary-date').textContent=`${anniversary.year}.12.09`;$('anniversary-date').dateTime=`${anniversary.year}-12-09`;
    $('anniversary-days').textContent=Math.floor(anniversary.remaining/86400000);
    for(const [id,div]of[['hours',3600000],['minutes',60000],['seconds',1000]])$(`anniversary-${id}`).textContent=String(Math.floor(anniversary.remaining/div)%(id==='hours'?24:60)).padStart(2,'0');
    $('anniversary-countdown').hidden=anniversary.today;$('anniversary-celebration').hidden=!anniversary.today;
  }
  clock();setInterval(clock,1000);
  function entryReady(ready){$('enter-home').hidden=!ready;$('enter-home').disabled=!ready;cover.classList.toggle('entry-ready',ready);cover.setAttribute('aria-busy',String(!ready));}
  function showCover(){entryReady(false);frame.src='welcome.html?embedded=1&v=20261121-11';cover.hidden=false;document.body.classList.add('cover-open');frame.focus();}
  function enter(){if($('enter-home').disabled)return;try{sessionStorage.setItem('zengmin:entered','1');}catch{}cover.classList.add('leaving');setTimeout(()=>{cover.hidden=true;cover.classList.remove('leaving');frame.src='about:blank';document.body.classList.remove('cover-open');$('heart-button').focus();},matchMedia('(prefers-reduced-motion: reduce)').matches?0:650);}
  $('enter-home').addEventListener('click',enter);$('replay-cover').addEventListener('click',showCover);
  addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==frame.contentWindow||cover.hidden)return;if(event.data?.type==='winter:ready')entryReady(true);else if(event.data?.type==='winter:building')entryReady(false);else if(event.data?.type==='winter:enter')enter();});
  let entered=false;try{entered=sessionStorage.getItem('zengmin:entered')==='1';}catch{}
  if(new URLSearchParams(location.search).has('home')){entered=true;try{sessionStorage.setItem('zengmin:entered','1');}catch{}}
  if(!entered)showCover();
  const petals=document.querySelector('.petals');for(let i=0;i<17;i++){const petal=document.createElement('span');petal.style.cssText=`--x:${(i*37+13)%100}%;--delay:${-i*1.7}s;--duration:${18+i%7}s;--scale:${.5+i%4*.18}`;petals.append(petal);}
  let timer;function heart(){const el=$('heart-button');el.classList.remove('heart-pop');void el.offsetWidth;el.classList.add('heart-pop');$('home-toast').textContent='曾 ❤ 敏';$('home-toast').classList.add('visible');clearTimeout(timer);timer=setTimeout(()=>$('home-toast').classList.remove('visible'),1800);}
  $('heart-button').addEventListener('click',heart);$('avatar-zeng').addEventListener('click',heart);$('avatar-min').addEventListener('click',heart);
})();
