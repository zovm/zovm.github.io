(() => {
  const $=id=>document.getElementById(id),params=new URLSearchParams(location.search),kind=['game','food'].includes(params.get('kind'))?params.get('kind'):'daily',game=kind==='game',food=kind==='food',id=params.get('id'),isNew=params.has('new');
  const listURL=food?'foodM.html':game?'gameM.html':'dailyM.html';document.body.dataset.journal=kind;$('back-records').href=listURL;$('back-records').textContent=food?'foodM':game?'gameM':'dailyM';
  $('mood-field').hidden=game||food;$('food-fields').hidden=!food;$('game-name-field').hidden=!game;$('duration-field').hidden=!game;$('record-game-name').required=game;
  let row=null,photos=[],additions=[],removed=[],dirty=false,busy=false,viewerIndex=0,timer,deletePending=false;const urls=new Map();
  function toast(text){clearTimeout(timer);$('journal-toast').textContent=text;$('journal-toast').classList.add('visible');timer=setTimeout(()=>$('journal-toast').classList.remove('visible'),3000);}
  function today(){const values=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return ['year','month','day'].map(k=>values.find(p=>p.type===k).value).join('-');}
  async function source(photoId){if(urls.has(photoId))return urls.get(photoId);const addition=additions.find(p=>p.id===photoId),photo=addition||await Memories.image(photoId);if(!photo)return '';const url=URL.createObjectURL(photo.blob);urls.set(photoId,url);return url;}
  async function show(){
    if(food)$('back-records').href=`foodM.html?type=${row.foodType}`;
    $('record-form').hidden=true;$('record-view').hidden=false;$('edit-record').hidden=false;$('delete-record').hidden=false;
    $('detail-title').textContent=row.title;document.title=`${row.title} · 曾❤敏`;
    $('detail-meta').textContent=row.date.replaceAll('-','.')+(food?` · ${{meal:'每日饮食',favorite:'喜欢吃的',avoid:'忌口'}[row.foodType]} · ${row.person}${row.foodType==='meal'?' · '+row.meal:''}`:game?` · ${row.duration} 分钟`:` · ${row.mood}`);$('detail-game').hidden=!(game||food);$('detail-game').textContent=food?row.foodName:row.gameName;
    $('detail-body').replaceChildren();for(const text of row.note.split(/\n\s*\n/)){if(!text.trim())continue;const p=document.createElement('p');p.textContent=text;$('detail-body').append(p);}
    photos=[...row.imageIds];$('detail-photos').replaceChildren();
    for(const [index,photoId]of photos.entries()){const src=await source(photoId);if(!src)continue;const button=document.createElement('button');button.type='button';button.className='detail-photo';button.setAttribute('aria-label',`放大第 ${index+1} 张图片`);const img=document.createElement('img');img.src=src;img.alt=`${row.title}，图片 ${index+1}`;img.loading='lazy';button.append(img);button.addEventListener('click',()=>openViewer(index));$('detail-photos').append(button);}
  }
  async function edit(){
    additions=[];removed=[];photos=[...(row?.imageIds||[])];dirty=false;$('record-view').hidden=true;$('record-form').hidden=false;$('edit-record').hidden=true;$('delete-record').hidden=true;
    $('editor-title').textContent=row?'编辑记录':food?'记录食物':game?'记一场游戏':'记录今天';$('record-title').value=row?.title||'';$('record-game-name').value=row?.gameName||'';$('record-date').value=row?.date||today();$('record-mood').value=row?.mood||'晴朗';$('record-duration').value=String(row?.duration??60);$('record-note').value=row?.note||'';$('record-error').textContent='';$('record-food-type').value=row?.foodType||(['meal','favorite','avoid'].includes(params.get('type'))?params.get('type'):'meal');$('record-food-name').value=row?.foodName||'';$('record-person').value=row?.person||'我们';$('record-meal').value=row?.meal||'午餐';$('meal-field').hidden=$('record-food-type').value!=='meal';await renderEditor();
  }
  async function renderEditor(){
    $('editor-photos').replaceChildren();for(const [index,photoId]of photos.entries()){const src=await source(photoId);if(!src)continue;const tile=document.createElement('div');tile.className='editor-photo';const img=document.createElement('img');img.src=src;img.alt=`待保存图片 ${index+1}`;const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label',`移除第 ${index+1} 张图片`);remove.addEventListener('click',()=>{photos=photos.filter(x=>x!==photoId);if(additions.some(p=>p.id===photoId))additions=additions.filter(p=>p.id!==photoId);else removed.push(photoId);dirty=true;renderEditor();});tile.append(img,remove);$('editor-photos').append(tile);}
  }
  async function preparePhoto(file){
    if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('请选择 JPG、PNG 或 WebP 图片');if(file.size>20000000)throw new Error('单张图片请小于 20 MB');
    const url=URL.createObjectURL(file),img=new Image();img.src=url;
    try{await img.decode();const ratio=Math.min(1,1800/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(img.naturalHeight*ratio));const context=canvas.getContext('2d');context.drawImage(img,0,0,canvas.width,canvas.height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.88));if(!blob)throw new Error('图片读取失败');return {id:Memories.uid(),blob};}finally{URL.revokeObjectURL(url);}
  }
  $('record-food-type').addEventListener('change',()=>{$('meal-field').hidden=$('record-food-type').value!=='meal';});
  $('record-files').addEventListener('change',async event=>{
    const files=[...(event.target.files||[])];if(!files.length)return;if(photos.length+files.length>20){$('record-error').textContent='每条记录最多添加 20 张图片';event.target.value='';return;}
    busy=true;$('save-record').disabled=true;$('record-error').textContent='';
    try{const next=await Promise.all(files.map(preparePhoto));additions.push(...next);photos.push(...next.map(p=>p.id));dirty=true;await renderEditor();}catch(error){$('record-error').textContent=error.message||'图片读取失败';}finally{busy=false;$('save-record').disabled=false;event.target.value='';}
  });
  $('record-form').addEventListener('input',()=>{dirty=true;});
  $('record-form').addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;
    const title=$('record-title').value.trim(),note=$('record-note').value.trim(),gameName=$('record-game-name').value.trim();if(!title||(!note&&!photos.length)||(game&&!gameName)){$('record-error').textContent='请填写标题，并添加正文或图片';return;}
    const value={foodType:$('record-food-type').value,foodName:$('record-food-name').value.trim(),person:$('record-person').value,meal:$('record-meal').value,id:row?.id||Memories.uid(),kind,title,note,gameName,date:$('record-date').value,mood:$('record-mood').value,duration:game?Number($('record-duration').value):0,imageIds:photos,updated:new Date().toISOString()};
    $('save-record').disabled=true;
    try{await Memories.save(value,additions,removed);dirty=false;location.replace(`record.html?kind=${kind}&id=${encodeURIComponent(value.id)}`);}catch{$('record-error').textContent='这次未能保存，请检查浏览器存储空间；内容仍保留在这里。';$('save-record').disabled=false;}
  });
  $('cancel-edit').addEventListener('click',()=>{dirty=false;if(row)show();else location.href=$('back-records').getAttribute('href');});$('edit-record').addEventListener('click',edit);
  $('delete-record').addEventListener('click',async()=>{if(!deletePending){deletePending=true;$('delete-record').textContent='确认删除';setTimeout(()=>{deletePending=false;$('delete-record').textContent='删除';},3500);return;}try{await Memories.remove(row.id);location.replace($('back-records').getAttribute('href'));}catch{toast('删除未完成，请重试');}});
  async function openViewer(index){viewerIndex=(index+photos.length)%photos.length;$('viewer-image').src=await source(photos[viewerIndex]);$('viewer-image').alt=`${row.title}，图片 ${viewerIndex+1}`;$('viewer-prev').hidden=$('viewer-next').hidden=photos.length<2;if(!$('photo-viewer').open)$('photo-viewer').showModal();}
  $('viewer-close').addEventListener('click',()=>$('photo-viewer').close());$('viewer-prev').addEventListener('click',()=>openViewer(viewerIndex-1));$('viewer-next').addEventListener('click',()=>openViewer(viewerIndex+1));$('photo-viewer').addEventListener('keydown',event=>{if(event.key==='ArrowRight')openViewer(viewerIndex+1);if(event.key==='ArrowLeft')openViewer(viewerIndex-1);});
  addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});addEventListener('pagehide',()=>{for(const url of urls.values())URL.revokeObjectURL(url);});
  (async()=>{try{await Memories.init();if(isNew)await edit();else{row=id?await Memories.get(id):null;if(row&&row.kind===kind)await show();else $('record-missing').hidden=false;}}catch{toast('记录暂时无法读取，请检查浏览器的网站存储权限。');}})();
})();
