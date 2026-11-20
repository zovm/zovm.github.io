(() => {
  'use strict';
  let ready;
  const request = req => new Promise((resolve,reject) => {req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
  const complete = tx => new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(tx.error||new Error('保存未完成'));});
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const dateOK = v => typeof v==='string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v));
  function clean(r,kind=r?.kind) {
    if(!r || !['daily','game','food'].includes(kind) || typeof r.id!=='string' || !r.id || r.id.length>120 || typeof r.title!=='string' || !r.title.trim() || r.title.length>80 || typeof r.note!=='string' || r.note.length>30000 || !dateOK(r.date)) throw new Error('记录格式不正确');
    const duration=Number(r.duration||0);if(!Number.isFinite(duration)||duration<0||duration>1440)throw new Error('游玩时长不正确');
    return {id:r.id,kind,title:r.title.trim(),gameName:kind==='game'?String(r.gameName||r.title).slice(0,80):'',note:r.note,date:r.date,foodType:['meal','favorite','avoid'].includes(r.foodType)?r.foodType:'meal',foodName:String(r.foodName||'').slice(0,80),person:['我们','曾','敏'].includes(r.person)?r.person:'我们',meal:['早餐','午餐','晚餐','加餐'].includes(r.meal)?r.meal:'午餐',mood:String(r.mood||'晴朗').slice(0,20),duration:Math.round(duration),imageIds:Array.isArray(r.imageIds)?r.imageIds.filter(x=>typeof x==='string'&&x.length<120).slice(0,20):[],updated:typeof r.updated==='string'?r.updated:new Date().toISOString()};
  }
  async function init() {
    if(ready)return ready;
    ready=(async()=>{
      if(!window.indexedDB)throw new Error('当前浏览器无法保存记录');
      const opening=indexedDB.open('zengmin-memories',1);
      opening.onupgradeneeded=()=>{const db=opening.result;const records=db.createObjectStore('records',{keyPath:'id'});records.createIndex('kind','kind');const images=db.createObjectStore('images',{keyPath:'id'});images.createIndex('recordId','recordId');db.createObjectStore('meta',{keyPath:'key'});};
      const db=await request(opening);db.onversionchange=()=>db.close();
      const marker=await request(db.transaction('meta').objectStore('meta').get('local-v1-migrated'));
      if(!marker){
        const legacy=[];
        for(const kind of ['daily','game']){try{const rows=JSON.parse(localStorage.getItem(`our-christmas:${kind}:v1`)||'[]');if(Array.isArray(rows))for(const row of rows){try{legacy.push(clean(row,kind));}catch{}}}catch{}}
        const tx=db.transaction(['records','meta'],'readwrite');const done=complete(tx);
        for(const row of legacy)tx.objectStore('records').put(row);
        tx.objectStore('meta').put({key:'local-v1-migrated',at:new Date().toISOString()});await done;
      }
      return db;
    })();return ready;
  }
  function notify(){try{localStorage.setItem('zengmin:records-changed',String(Date.now()));}catch{}}
  async function list(kind){const db=await init();const rows=await request(db.transaction('records').objectStore('records').index('kind').getAll(kind));return rows.sort((a,b)=>b.date.localeCompare(a.date)||b.updated.localeCompare(a.updated));}
  async function get(id){const db=await init();return request(db.transaction('records').objectStore('records').get(id));}
  async function image(id){const db=await init();return request(db.transaction('images').objectStore('images').get(id));}
  async function save(row,photos=[],removed=[]){const value=clean(row);const db=await init();const tx=db.transaction(['records','images'],'readwrite'),done=complete(tx);tx.objectStore('records').put(value);for(const photo of photos){if(!(photo.blob instanceof Blob)||!['image/jpeg','image/png','image/webp'].includes(photo.blob.type))throw new Error('图片格式不正确');tx.objectStore('images').put({id:photo.id,recordId:value.id,blob:photo.blob});}for(const id of removed)tx.objectStore('images').delete(id);await done;notify();return value;}
  async function remove(id){const db=await init();const ids=await request(db.transaction('images').objectStore('images').index('recordId').getAllKeys(id));const tx=db.transaction(['records','images'],'readwrite'),done=complete(tx);tx.objectStore('records').delete(id);for(const imageId of ids)tx.objectStore('images').delete(imageId);await done;notify();}
  const dataURL=blob=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(blob);});
  async function backup(kind){const rows=await list(kind),photos=[];for(const row of rows)for(const id of row.imageIds){const photo=await image(id);if(photo)photos.push({id,recordId:row.id,data:await dataURL(photo.blob)});}return {format:'zengmin-memories-v2',kind,exportedAt:new Date().toISOString(),records:rows,photos};}
  async function restore(data,kind){
    if(!data || data.kind!==kind || !Array.isArray(data.records) || data.records.length>1000 || !['zengmin-memories-v2','our-christmas-journal-v1'].includes(data.format))throw new Error('请选择当前页面的备份');
    const rows=data.records.map(r=>clean(r,kind)),existing=new Set((await list(kind)).map(r=>r.id)),photos=Array.isArray(data.photos)?data.photos:[];
    const prepared=[];
    for(const row of rows){if(existing.has(row.id))continue;const additions=[];for(const id of row.imageIds){const photo=photos.find(p=>p.id===id&&p.recordId===row.id);if(!photo||typeof photo.data!=='string'||!/^data:image\/(jpeg|png|webp);base64,/.test(photo.data)||photo.data.length>28000000)throw new Error('备份中的图片不完整');const comma=photo.data.indexOf(','),mime=photo.data.slice(5,photo.data.indexOf(';')),raw=atob(photo.data.slice(comma+1));const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));additions.push({id,blob:new Blob([bytes],{type:mime})});}prepared.push({row,additions});}
    const db=await init();const tx=db.transaction(['records','images'],'readwrite'),done=complete(tx);
    for(const {row,additions} of prepared){tx.objectStore('records').put(row);for(const photo of additions)tx.objectStore('images').put({...photo,recordId:row.id});}await done;notify();return prepared.length;
  }
  window.Memories={init,list,get,image,save,remove,backup,restore,uid};
})();
