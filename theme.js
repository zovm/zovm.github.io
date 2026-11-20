(() => {
  const choices=[['gradient','渐变','linear-gradient(135deg,#f2b4cf,#d5c4f0,#abd8f2)'],['sakura','樱花粉','linear-gradient(135deg,#f6b6cf,#ffe2ec)'],['sky','天空蓝','linear-gradient(135deg,#a9d5f4,#dcecff)'],['lavender','薰衣草','linear-gradient(135deg,#c6b2e8,#ece3fa)'],['peach','蜜桃橙','linear-gradient(135deg,#f6bcaa,#ffe9c6)']];
  const apply=value=>{document.documentElement.dataset.theme=choices.some(c=>c[0]===value)?value:'gradient';};
  try{apply(localStorage.getItem('zengmin:theme')||'gradient');}catch{apply('gradient');}
  function controls(){
    const button=document.createElement('button');button.type='button';button.className='theme-toggle soft-icon';button.setAttribute('aria-label','切换主题色');button.title='切换主题色';button.innerHTML='<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1.5-3.3 1.8 1.8 0 0 1 1.4-3h1.6A3.5 3.5 0 0 0 21 11.2 9 9 0 0 0 12 3Z"/><circle cx="7.5" cy="11" r=".7"/><circle cx="10" cy="7" r=".7"/><circle cx="15" cy="7.5" r=".7"/></svg>';
    const dialog=document.createElement('dialog');dialog.className='theme-dialog';dialog.setAttribute('aria-label','选择主题色');
    const header=document.createElement('div');header.className='theme-heading';const title=document.createElement('h2');title.textContent='主题色';const close=document.createElement('button');close.type='button';close.className='theme-close';close.textContent='×';close.setAttribute('aria-label','关闭主题选择');header.append(title,close);dialog.append(header);
    const grid=document.createElement('div');grid.className='theme-options';
    for(const [id,label,gradient] of choices){const option=document.createElement('button');option.type='button';option.className='theme-option';option.dataset.choice=id;option.setAttribute('aria-label',label);const swatch=document.createElement('span');swatch.style.background=gradient;const text=document.createElement('span');text.textContent=label;option.append(swatch,text);option.addEventListener('click',()=>{apply(id);try{localStorage.setItem('zengmin:theme',id);}catch{}refresh();});grid.append(option);}
    function refresh(){grid.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.choice===document.documentElement.dataset.theme)));}
    dialog.append(grid);if(document.body.dataset.galleryPage){document.getElementById('gallery-dialog').append(button);document.body.append(dialog);}else document.body.append(button,dialog);button.addEventListener('click',()=>{refresh();dialog.showModal();});close.addEventListener('click',()=>dialog.close());dialog.addEventListener('click',event=>{const r=dialog.getBoundingClientRect();if(event.target===dialog&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom))dialog.close();});
  }
  addEventListener('storage',event=>{if(event.key==='zengmin:theme')apply(event.newValue);});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',controls);else controls();
})();
