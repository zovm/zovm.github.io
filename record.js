(() => {
  'use strict';
  const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
  const kind=SyncModel.kinds.includes(params.get('kind'))?params.get('kind'):'daily';
  const game=kind==='game',food=kind==='food',travel=kind==='travel',gallery=kind==='gallery';
  const id=params.get('id'),isNew=params.has('new');
  let cityId=params.get('city')||'360500',albumId=params.get('album')||'',row=null,photos=[],additions=[],dirty=false,busy=false,viewerIndex=0,timer,deletePending=false;
  document.body.dataset.journal=travel?'travel':gallery?'gallery':kind;
  $('mood-field').hidden=game||food||travel||gallery;$('food-fields').hidden=!food;$('game-name-field').hidden=!game;$('duration-field').hidden=!game;$('record-game-name').required=game;
  const cityField=document.createElement('label');cityField.textContent='城市';cityField.hidden=!travel;
  const citySelect=document.createElement('select');citySelect.id='record-city';for(const [value,label]of Object.entries(SyncModel.cities)){const option=document.createElement('option');option.value=value;option.textContent=label;citySelect.append(option);}cityField.append(citySelect);$('record-title').parentElement.after(cityField);
  const saveLocal=document.createElement('button');saveLocal.type='submit';saveLocal.className='quiet-button';saveLocal.id='save-local-only';saveLocal.textContent='仅存本地';saveLocal.hidden=!GitHubSync.connected();$('save-record').after(saveLocal);
  const viewerVideo=document.createElement('video');viewerVideo.controls=true;viewerVideo.playsInline=true;viewerVideo.hidden=true;$('viewer-image').after(viewerVideo);
  const viewerError=document.createElement('p');viewerError.className='viewer-media-error';viewerError.hidden=true;viewerVideo.after(viewerError);
  function today(){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return ['year','month','day'].map(k=>p.find(v=>v.type===k).value).join('-');}
  function toast(text){clearTimeout(timer);$('journal-toast').textContent=text;$('journal-toast').classList.add('visible');timer=setTimeout(()=>$('journal-toast').classList.remove('visible'),4000);}
  function backLink(){
    const url=travel?`city.html?city=${encodeURIComponent(row?.cityId||cityId)}`:gallery?`gallery.html?album=${encodeURIComponent(row?.albumId||albumId)}`:food?`foodM.html?type=${row?.foodType||'meal'}`:game?'gameM.html':'dailyM.html';
    $('back-records').href=url;$('back-records').textContent=travel?SyncModel.cities[row?.cityId||cityId]||'旅行轨迹':gallery?'照相馆':food?'foodM':game?'gameM':'dailyM';
  }
  function state(){saveLocal.hidden=!GitHubSync.connected();$('save-record').textContent=GitHubSync.connected()?'保存并同步':'保存到本地';$('save-record').disabled=saveLocal.disabled=busy||GitHubSync.busy();}
  async function source(photoId){return MediaKit.resolve(photoId,additions);}
  function thumb(media,alt){const image=document.createElement('img');image.src=media.type==='video'?media.poster:media.src;image.alt=alt;image.loading='lazy';return image;}
  async function show(){
    backLink();$('record-form').hidden=true;$('record-view').hidden=false;$('edit-record').hidden=false;$('delete-record').hidden=false;
    $('detail-title').textContent=row.title;document.title=`${row.title} · 曾❤敏`;
    $('detail-meta').textContent=row.date.replaceAll('-','.')+(travel?' · '+SyncModel.cities[row.cityId]:food?` · ${{meal:'每日饮食',favorite:'喜欢吃的',avoid:'忌口'}[row.foodType]} · ${row.person}${row.foodType==='meal'?' · '+row.meal:''}`:game?` · ${row.duration} 分钟`:gallery?'':` · ${row.mood}`);
    $('detail-game').hidden=!(game||food);$('detail-game').textContent=food?row.foodName:row.gameName;
    $('detail-body').replaceChildren();for(const text of row.note.split(/\n\s*\n/)){if(!text.trim())continue;const p=document.createElement('p');p.textContent=text;$('detail-body').append(p);}
    photos=[...row.imageIds];$('detail-photos').replaceChildren();
    for(const [index,photoId]of photos.entries()){
      const media=await source(photoId);if(!media)continue;const button=document.createElement('button');button.type='button';button.className='detail-photo';button.setAttribute('aria-label',`${media.type==='video'?'播放视频':'放大照片'} ${index+1}`);button.append(thumb(media,row.title));
      if(media.type==='video'){const mark=document.createElement('span');mark.className='detail-video-mark';mark.textContent='▷';mark.setAttribute('aria-hidden','true');button.append(mark);}
      button.addEventListener('click',()=>openViewer(index));$('detail-photos').append(button);
    }
  }
  async function renderEditor(){
    $('editor-photos').replaceChildren();
    for(const [index,photoId]of photos.entries()){
      const media=await source(photoId);if(!media)continue;const tile=document.createElement('div');tile.className='editor-photo';const image=thumb(media,`待保存${media.type==='video'?'视频':'照片'} ${index+1}`),remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label',`移除第 ${index+1} 项`);
      remove.addEventListener('click',()=>{photos=photos.filter(id=>id!==photoId);dirty=true;renderEditor();});tile.append(image,remove);$('editor-photos').append(tile);
    }
  }
  async function edit(){
    additions=[];photos=[...(row?.imageIds||[])];dirty=false;backLink();$('record-view').hidden=true;$('record-form').hidden=false;$('edit-record').hidden=true;$('delete-record').hidden=true;
    $('editor-title').textContent=row?'编辑记录':travel?'收藏这一程':gallery?'添加相册回忆':food?'记录食物':game?'记一场游戏':'记录今天';
    $('record-title').value=row?.title||'';$('record-game-name').value=row?.gameName||'';$('record-date').value=row?.date||today();$('record-mood').value=row?.mood||'晴朗';$('record-duration').value=String(row?.duration??60);$('record-note').value=row?.note||'';$('record-error').textContent='';
    $('record-food-type').value=row?.foodType||(['meal','favorite','avoid'].includes(params.get('type'))?params.get('type'):'meal');$('record-food-name').value=row?.foodName||'';$('record-person').value=row?.person||'我们';$('record-meal').value=row?.meal||'午餐';$('meal-field').hidden=$('record-food-type').value!=='meal';citySelect.value=row?.cityId||cityId;await renderEditor();state();
  }
  $('record-food-type').addEventListener('change',()=>{$('meal-field').hidden=$('record-food-type').value!=='meal';});
  $('record-files').addEventListener('change',async event=>{
    const files=[...(event.target.files||[])];if(!files.length)return;
    if(photos.length+files.length>20){$('record-error').textContent='每条记录最多添加 20 个照片或视频';event.target.value='';return;}
    busy=true;state();$('record-error').textContent='正在整理照片和视频…';
    try{
      const prepared=[];for(const file of files)prepared.push(await MediaKit.prepare(file));
      additions.push(...prepared.flatMap(item=>item.assets));photos.push(...prepared.map(item=>item.id));dirty=true;await renderEditor();$('record-error').textContent='';
    }catch(error){$('record-error').textContent=error.message||'文件读取失败';}finally{busy=false;state();event.target.value='';}
  });
  $('record-form').addEventListener('input',()=>{dirty=true;});
  $('record-form').addEventListener('submit',async event=>{
    event.preventDefault();if(busy||GitHubSync.busy())return;
    const title=$('record-title').value.trim(),note=$('record-note').value.trim(),gameName=$('record-game-name').value.trim();
    if(!title||(!note&&!photos.length)||(game&&!gameName)){$('record-error').textContent='请填写标题，并添加正文、照片或视频';return;}
    const publish=GitHubSync.connected()&&event.submitter!==saveLocal;
    const value={id:row?.id||Memories.uid(),_rev:row?._rev,kind,title,note,gameName,date:$('record-date').value,mood:$('record-mood').value,duration:game?Number($('record-duration').value):0,foodType:$('record-food-type').value,foodName:$('record-food-name').value.trim(),person:$('record-person').value,meal:$('record-meal').value,cityId:citySelect.value,albumId:row?.albumId||albumId,imageIds:[...photos]};
    busy=true;state();
    try{
      const keep=new Set(photos);for(const photo of additions)if(keep.has(photo.id)&&photo.posterId)keep.add(photo.posterId);
      const saved=await Memories.save(value,additions.filter(photo=>keep.has(photo.id)));dirty=false;additions=[];
      row=await Memories.get(saved.id);history.replaceState(null,'',`record.html?kind=${kind}&id=${encodeURIComponent(saved.id)}`);await show();toast('已保存在当前设备');
      if(publish){
        try{const result=await GitHubSync.sync(),target=result.acks?.find(item=>item.store==='records'&&item.id===saved.id)?.targetId||saved.id;row=await Memories.get(target);history.replaceState(null,'',`record.html?kind=${kind}&id=${encodeURIComponent(target)}`);await show();}catch{}
      }
    }catch(error){$('record-error').textContent=error.message||'未能保存，请检查浏览器存储空间；内容仍保留在这里。';}finally{busy=false;state();}
  });
  $('cancel-edit').addEventListener('click',()=>{dirty=false;if(row){additions=[];show();}else location.href=$('back-records').getAttribute('href');});$('edit-record').addEventListener('click',edit);
  $('delete-record').addEventListener('click',async()=>{
    if(GitHubSync.busy()){toast('请等待同步完成');return;}
    if(!deletePending){deletePending=true;$('delete-record').textContent='确认删除';setTimeout(()=>{deletePending=false;$('delete-record').textContent='删除';},3500);return;}
    try{await Memories.remove(row.id,row._rev);location.replace($('back-records').getAttribute('href'));}catch(error){toast(error.message||'删除未完成，请重试');}
  });
  function stopVideo(){viewerVideo.pause();viewerVideo.removeAttribute('src');viewerVideo.load();viewerVideo.hidden=true;viewerError.hidden=true;}
  async function openViewer(index){
    stopVideo();viewerIndex=(index+photos.length)%photos.length;const media=await source(photos[viewerIndex]);if(!media)return;
    $('viewer-image').hidden=media.type==='video';
    if(media.type==='video'){viewerVideo.poster=media.poster;viewerVideo.src=media.src;viewerVideo.hidden=false;}else{$('viewer-image').src=media.src;$('viewer-image').alt=row.title;}
    $('viewer-prev').hidden=$('viewer-next').hidden=photos.length<2;if(!$('photo-viewer').open)$('photo-viewer').showModal();if(media.type==='video')viewerVideo.play().catch(()=>{});
  }
  viewerVideo.addEventListener('play',()=>document.dispatchEvent(new Event('zengmin:video-play')));
  viewerVideo.addEventListener('error',()=>{if(!viewerVideo.getAttribute('src'))return;const link=document.createElement('a');link.href=viewerVideo.src;link.download='';link.textContent='下载视频';viewerError.replaceChildren(document.createTextNode('此浏览器暂时无法播放，'),link);viewerError.hidden=false;});
  $('viewer-close').addEventListener('click',()=>$('photo-viewer').close());$('photo-viewer').addEventListener('close',stopVideo);$('viewer-prev').addEventListener('click',()=>openViewer(viewerIndex-1));$('viewer-next').addEventListener('click',()=>openViewer(viewerIndex+1));
  $('photo-viewer').addEventListener('keydown',event=>{if(event.target===viewerVideo)return;if(event.key==='ArrowRight')openViewer(viewerIndex+1);if(event.key==='ArrowLeft')openViewer(viewerIndex-1);});
  document.addEventListener('zengmin:account-changed',state);
  addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});addEventListener('pagehide',()=>viewerVideo.pause());
  (async()=>{
    try{
      await Memories.init();
      if(isNew){
        if(travel&&!SyncModel.cities[cityId])throw new Error('请选择旅行城市');
        if(gallery){let catalog=await GalleryData.load(),album=GalleryData.find(albumId,catalog);if(!album){await Memories.refresh();catalog=await GalleryData.load();album=GalleryData.find(albumId,catalog);}if(!album||album.children)throw new Error('请先从照相馆中选择一个相册');}
        await edit();
      }else{row=id?await Memories.get(id):null;if(row&&row.kind===kind)await show();else{$('record-missing').hidden=false;backLink();}}
    }catch(error){toast(error.message||'记录暂时无法读取，请检查浏览器存储权限。');$('record-missing').hidden=false;backLink();}
  })();
})();
