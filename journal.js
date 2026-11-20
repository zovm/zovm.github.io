(() => {
  'use strict';
  const $ = id => document.getElementById(id), mode = document.body.dataset.journal, game = mode === 'game';
  const key = `our-christmas:${mode}:v1`, dialog = $('record-dialog');
  let records = [], editing = null, toastTimer;
  $('mood-field').hidden = game; $('duration-field').hidden = !game;
  function today() {
    const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const get = kind => parts.find(p => p.type === kind).value; return `${get('year')}-${get('month')}-${get('day')}`;
  }
  function valid(row) {
    return row && typeof row.id === 'string' && row.id.length < 100 && typeof row.title === 'string' && row.title.trim() && row.title.length <= 60 && typeof row.note === 'string' && row.note.length <= 5000 && typeof row.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.date) && Number.isFinite(Date.parse(row.date)) && (!game || (Number.isInteger(row.duration) && row.duration >= 0 && row.duration <= 1440));
  }
  function load() { try { const data = JSON.parse(localStorage.getItem(key) || '[]'); records = Array.isArray(data) ? data.filter(valid).slice(0,200) : []; } catch { records = []; } }
  function persist(next) { try { localStorage.setItem(key,JSON.stringify(next)); records = next; return true; } catch { return false; } }
  function toast(message) { clearTimeout(toastTimer); $('journal-toast').textContent=message; $('journal-toast').classList.add('visible'); toastTimer=setTimeout(()=>$('journal-toast').classList.remove('visible'),3200); }
  function render() {
    $('record-list').replaceChildren();
    const query=$('record-search').value.trim().toLocaleLowerCase();
    const shown=records.filter(row=>(row.title+' '+row.note+' '+row.date).toLocaleLowerCase().includes(query)).sort((a,b)=>b.date.localeCompare(a.date) || (b.updated||'').localeCompare(a.updated||''));
    $('record-summary').textContent=game ? `${new Set(records.map(r=>r.title.trim().toLocaleLowerCase())).size} 款游戏 · ${records.length} 次一起玩 · ${records.reduce((n,r)=>n+r.duration,0)} 分钟` : `${records.length} 篇日常 · ${new Set(records.map(r=>r.date)).size} 个被记住的日子`;
    if(!shown.length) {
      const empty=document.createElement('div'); empty.className='empty-records';
      const icon=document.createElement('span'); icon.className='empty-icon'; icon.textContent=game?'♧':'✧'; icon.setAttribute('aria-hidden','true');
      const h=document.createElement('h2'); h.textContent=query?'还没有找到这条回忆。':game?'第一场一起玩的游戏，从这里记起。':'今天有什么想记住的小事？';
      const p=document.createElement('p'); p.textContent=query?'换一个词，再找找看。':game?'游戏名、日期和感想，都会慢慢成为共同的回忆。':'不用很特别，和你有关就值得留下。';
      empty.append(icon,h,p); $('record-list').append(empty); return;
    }
    for(const row of shown) {
      const card=document.createElement('article'); card.className='record-card';
      const meta=document.createElement('div'); meta.className='record-meta'; const date=document.createElement('time'); date.className='record-date'; date.dateTime=row.date; date.textContent=row.date.replaceAll('-','.');
      const tag=document.createElement('span'); tag.className='record-tag'; tag.textContent=game?`${row.duration} 分钟`:(['晴朗','开心','平静','想你','有点累'].includes(row.mood)?row.mood:'平静'); meta.append(date,tag);
      const title=document.createElement('h2'); title.textContent=row.title; const note=document.createElement('p'); note.className='record-body'; note.textContent=row.note;
      const actions=document.createElement('div'); actions.className='record-actions';
      const edit=document.createElement('button'); edit.type='button'; edit.textContent='编辑'; edit.setAttribute('aria-label',`编辑：${row.title}`); edit.addEventListener('click',()=>openForm(row));
      const remove=document.createElement('button'); remove.type='button'; remove.className='delete-record'; remove.textContent='删除'; remove.setAttribute('aria-label',`删除：${row.title}`); let confirmDelete=false;
      remove.addEventListener('click',()=>{ if(!confirmDelete){confirmDelete=true;remove.textContent='再点一次删除';setTimeout(()=>{confirmDelete=false;remove.textContent='删除';},3500);return;} const next=records.filter(r=>r.id!==row.id); if(persist(next)){render();toast('这条记录已删除。');}else toast('这次未能删除，请检查浏览器存储权限。'); });
      actions.append(edit,remove);card.append(meta,title,note,actions);$('record-list').append(card);
    }
  }
  function openForm(row) {
    editing=row?.id||null;$('record-form').reset();$('record-error').textContent='';$('record-dialog-title').textContent=row?'编辑这一刻':game?'记一场游戏':'记录今天';
    $('record-title').value=row?.title||'';$('record-note').value=row?.note||'';$('record-date').value=row?.date||today();$('record-mood').value=row?.mood||'晴朗';$('record-duration').value=String(row?.duration??60);dialog.showModal();
  }
  $('new-record').addEventListener('click',()=>openForm());$('record-close').addEventListener('click',()=>dialog.close());
  $('record-search').addEventListener('input',render);
  $('record-form').addEventListener('submit',event=>{
    event.preventDefault(); const row={id:editing||(crypto.randomUUID?crypto.randomUUID():String(Date.now())),title:$('record-title').value.trim(),note:$('record-note').value.trim(),date:$('record-date').value,mood:$('record-mood').value,duration:game?Number($('record-duration').value):0,updated:new Date().toISOString()};
    if(!row.title || !row.note){$('record-error').textContent='给这一刻起个名字，再写一点想留下的话吧。';return;}
    if(!valid(row)){$('record-error').textContent='请检查日期和时长是否填写正确。';return;}
    load();if(!editing && records.length>=200){$('record-error').textContent='已经记下 200 条啦。先导出备份，再整理一些旧记录吧。';return;}
    const next=[row,...records.filter(r=>r.id!==editing)];
    if(!persist(next)){$('record-error').textContent='浏览器暂时无法保存。请检查网站存储权限，文字会保留在这里。';return;}
    dialog.close();render();toast('这一刻，已经好好留下来了。');
  });
  $('export-records').addEventListener('click',()=>{
    load(); const blob=new Blob([JSON.stringify({format:'our-christmas-journal-v1',kind:mode,exportedAt:new Date().toISOString(),records},null,2)],{type:'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`${game?'gameM':'dailyM'}-${today()}.json`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);toast('备份已导出，请妥善保存。');
  });
  $('import-file').addEventListener('change',async event=>{
    const file=event.target.files?.[0];if(!file)return;
    try {if(file.size>2500000)throw new Error('文件太大，请选择本站导出的备份。');const data=JSON.parse(await file.text());if(data.format!=='our-christmas-journal-v1'||data.kind!==mode||!Array.isArray(data.records)||!data.records.every(valid))throw new Error('备份格式不正确，或与当前页面不匹配。');load();const merged=new Map(records.map(r=>[r.id,r]));for(const row of data.records)if(!merged.has(row.id))merged.set(row.id,row);if(merged.size>200)throw new Error('合并后超过 200 条，请先整理已有记录。');if(!persist([...merged.values()]))throw new Error('浏览器暂时无法保存导入的内容。');render();toast('备份已合并，现有记录保留。');}
    catch(error){toast(error instanceof Error?error.message:'这份备份暂时无法导入。');}finally{event.target.value='';}
  });
  addEventListener('storage',event=>{if(event.key===key){load();render();}});load();render();
})();
