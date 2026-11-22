(() => {
  const $=id=>document.getElementById(id),mode=document.body.dataset.journal,game=mode==='game',food=mode==='food',travel=mode==='travel',cityId=new URLSearchParams(location.search).get('city')||'360500';let rows=[],version=0,timer,foodType=['meal','favorite','avoid'].includes(new URLSearchParams(location.search).get('type'))?new URLSearchParams(location.search).get('type'):'meal';
  if(travel){const name=SyncModel.cities[cityId];if(!name){location.replace('travelM.html');return;}document.title=name+' · 曾❤敏';$('city-title').textContent=name;$('new-record').href=`record.html?kind=travel&city=${cityId}&new=1`;}
  const labels={meal:'每日饮食',favorite:'喜欢吃的',avoid:'忌口'};
  const localDay=()=>{const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return ['year','month','day'].map(k=>p.find(v=>v.type===k).value).join('-');};
  function toast(text){clearTimeout(timer);$('journal-toast').textContent=text;$('journal-toast').classList.add('visible');timer=setTimeout(()=>$('journal-toast').classList.remove('visible'),3000);}
  async function load(){try{rows=await Memories.list(mode,travel?{cityId}:{});render();}catch{toast('记录暂时无法读取，请检查浏览器的网站存储权限。');}}
  async function render(){
    const current=++version,query=$('record-search').value.trim().toLocaleLowerCase(),list=$('record-list');list.replaceChildren();
    $('record-summary').textContent=food?`${rows.filter(r=>r.foodType===foodType).length} 条${labels[foodType]}记录`:game?`${rows.length} 条记录 · ${new Set(rows.map(r=>r.gameName)).size} 款游戏`:travel?`${rows.length} 段旅行回忆`:`${rows.length} 篇日常`;
    const shown=rows.filter(r=>(!food||r.foodType===foodType)&&`${r.title} ${r.gameName} ${r.note} ${r.date}`.toLocaleLowerCase().includes(query));
    if(!shown.length){const empty=document.createElement('div');empty.className='empty-records';const icon=document.createElement('span');icon.textContent='✧';icon.className='empty-icon';const h=document.createElement('h2');h.textContent=query?'没有找到记录':'暂无记录';empty.append(icon,h);list.append(empty);return;}
    for(const row of shown){
      const link=document.createElement('a');link.className='record-card';link.href=`record.html?kind=${mode}&id=${encodeURIComponent(row.id)}`;
      const content=document.createElement('div');content.className='record-card-content';const date=document.createElement('time');date.dateTime=row.date;date.className='record-date';date.textContent=row.date.replaceAll('-','.');
      const title=document.createElement('h2');title.textContent=row.title;content.append(date,title);
      if(game||food){const name=document.createElement('p');name.className='record-game-name';name.textContent=food?`${row.foodName||labels[row.foodType]} · ${row.person}${row.foodType==='meal'?' · '+row.meal:''}`:row.gameName;content.append(name);const duration=document.createElement('span');duration.className='record-duration';duration.textContent=`${row.duration} 分钟`;if(game)content.append(duration);}
      if(row._dirty){const status=document.createElement('span');status.className='record-pending-mark';status.textContent='本地 · 待同步';content.append(status);}
      link.append(content);if(row.imageIds.length){const photo=await MediaKit.resolve(row.imageIds[0]);if(current!==version)return;if(photo){const img=document.createElement('img');img.src=photo.type==='video'?photo.poster:photo.src;img.alt=row.title;img.className='record-cover';img.loading='lazy';link.append(img);}}
      const mark=document.createElement('span');mark.className='record-open-mark';mark.textContent='＋';mark.setAttribute('aria-hidden','true');link.append(mark);list.append(link);
    }
  }
  $('record-search').addEventListener('input',render);
  $('export-records').addEventListener('click',async()=>{try{const data=await Memories.backup(mode),url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`${travel?'travelM':food?'foodM':game?'gameM':'dailyM'}-${localDay()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);toast('已导出备份');}catch(error){toast(error.message||'导出未完成，请重试。');}});
  $('import-file').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;try{if(file.size>60000000)throw new Error('备份文件过大');const count=await Memories.restore(JSON.parse(await file.text()),mode);await load();toast(`已导入 ${count} 条记录`);}catch(error){toast(error.message||'这份备份无法导入');}finally{event.target.value='';}});
  document.querySelectorAll('[data-food-tab]').forEach(button=>button.addEventListener('click',()=>{foodType=button.dataset.foodTab;document.querySelectorAll('[data-food-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));$('new-record').href=`record.html?kind=food&new=1&type=${foodType}`;render();}));
  if(food){document.querySelectorAll('[data-food-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.foodTab===foodType)));$('new-record').href=`record.html?kind=food&new=1&type=${foodType}`;}
  document.addEventListener('zengmin:content-changed',load);addEventListener('storage',event=>{if(event.key==='zengmin:records-changed')load();});load();
})();
