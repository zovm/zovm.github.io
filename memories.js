(() => {
  'use strict';
  const model = SyncModel;
  let ready, publicLoad;
  const request = req => new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
  const complete = tx => new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(tx.error || new Error('保存未完成'));});
  const uid = model.uid;
  function notify() {
    try { localStorage.setItem('zengmin:records-changed',uid()); } catch {}
    document.dispatchEvent(new Event('zengmin:content-changed'));
  }
  async function init() {
    if (ready) return ready;
    ready = (async()=>{
      if (!window.indexedDB) throw new Error('当前浏览器无法保存记录');
      const opening = indexedDB.open('zengmin-memories',2);
      opening.onupgradeneeded = ()=>{
        const db = opening.result;
        if (!db.objectStoreNames.contains('records')) { const store=db.createObjectStore('records',{keyPath:'id'});store.createIndex('kind','kind'); }
        if (!db.objectStoreNames.contains('images')) { const store=db.createObjectStore('images',{keyPath:'id'});store.createIndex('recordId','recordId'); }
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta',{keyPath:'key'});
        if (!db.objectStoreNames.contains('albums')) db.createObjectStore('albums',{keyPath:'id'});
      };
      opening.onblocked = ()=>document.dispatchEvent(new CustomEvent('zengmin:storage-blocked'));
      const db = await request(opening);db.onversionchange=()=>db.close();
      const tx = db.transaction(['records','meta'],'readwrite'), done = complete(tx);
      const records=tx.objectStore('records'),meta=tx.objectStore('meta');
      const [marker,rows]=await Promise.all([request(meta.get('local-v1-migrated')),request(records.getAll())]);
      for (const row of rows) if (!row._rev) { const value=model.record(row);records.put({...value,_rev:value.rev,_base:'',_dirty:true}); }
      if (!marker) {
        for (const kind of ['daily','game']) {
          try {
            const old=JSON.parse(localStorage.getItem(`our-christmas:${kind}:v1`) || '[]');
            if (Array.isArray(old)) for (const row of old) { try {const value=model.record({...row,kind,note:row.note || '',imageIds:[]});if(!rows.some(r=>r.id===value.id))records.put({...value,_rev:value.rev,_base:'',_dirty:true});}catch{} }
          } catch {}
        }
        meta.put({key:'local-v1-migrated',at:new Date().toISOString()});
      }
      await done;return db;
    })().catch(error=>{ready=null;throw error;});
    return ready;
  }
  async function all(store) { const db=await init();return request(db.transaction(store).objectStore(store).getAll()); }
  async function applyRemote(input, acks=[]) {
    const data=model.manifest(input),db=await init();
    const tx=db.transaction(['records','albums','images','meta'],'readwrite'),done=complete(tx);
    const [records,albums,stamp]=await Promise.all([request(tx.objectStore('records').getAll()),request(tx.objectStore('albums').getAll()),request(tx.objectStore('meta').get('remote-updated'))]);
    if (!acks.length && stamp && Date.parse(stamp.value)>Date.parse(data.updated)) { await done;return; }
    for (const store of ['records','albums']) {
      const locals=new Map((store==='records'?records:albums).map(row=>[row.id,row]));
      const remote=new Map(data[store].map(row=>[row.id,row]));
      for (const ack of acks.filter(item=>item.store===store)) {
        const local=locals.get(ack.id), published=remote.get(ack.targetId);
        if (!local || !published) continue;
        const changed=local._rev!==ack.rev;
        if (ack.id!==ack.targetId) {
          locals.delete(ack.id);tx.objectStore(store).delete(ack.id);
          locals.set(ack.targetId,changed?{...local,id:ack.targetId,_base:published.rev}:{...published,_rev:published.rev,_base:published.rev,_dirty:false});
        } else if (changed) locals.set(ack.id,{...local,_base:published.rev});
        else locals.set(ack.id,{...published,_rev:published.rev,_base:published.rev,_dirty:false});
      }
      for (const row of data[store]) {
        const local=locals.get(row.id);
        if (!local?._dirty || local._rev===row.rev) locals.set(row.id,{...row,_rev:row.rev,_base:row.rev,_dirty:false});
      }
      for (const row of locals.values()) tx.objectStore(store).put(row);
    }
    for (const item of data.media) {
      const store=tx.objectStore('images'),req=store.get(item.id);
      req.onsuccess=()=>store.put({...req.result,...item});
    }
    tx.objectStore('meta').put({key:'remote-updated',value:data.updated});await done;notify();
  }
  async function refresh(force=false) {
    if (publicLoad && !force) return publicLoad;
    publicLoad=(async()=>{
      try {
        const response=await fetch('content/index.json',{cache:'no-store',signal:AbortSignal.timeout(12000)});
        if(!response.ok)throw new Error('网站内容暂时无法读取');
        const data=await response.json();await applyRemote(data);return true;
      } catch { return false; }
    })();return publicLoad;
  }
  async function list(kind, filter={}) {
    await init();refresh();
    return (await all('records')).filter(row=>!row.deleted&&row.kind===kind&&(!filter.cityId||row.cityId===filter.cityId)&&(!filter.albumId||row.albumId===filter.albumId)).sort((a,b)=>b.date.localeCompare(a.date)||b.updated.localeCompare(a.updated));
  }
  async function get(id) {const db=await init();let row=await request(db.transaction('records').objectStore('records').get(id));if(!row){await refresh();row=await request(db.transaction('records').objectStore('records').get(id));}else refresh();return row?.deleted?null:row;}
  async function image(id) {const db=await init();return request(db.transaction('images').objectStore('images').get(id));}
  async function save(row,photos=[]) {
    const value=model.record({...row,rev:uid(),updated:new Date().toISOString()}),db=await init();
    for(const photo of photos) if(!model.validId(photo.id)||!(photo.blob instanceof Blob)||!model.mimeExtensions[photo.blob.type]||photo.blob.size>model.MAX_FILE)throw new Error('照片或视频格式不正确，单个文件请小于 50 MB');
    const tx=db.transaction(['records','images'],'readwrite'),done=complete(tx),store=tx.objectStore('records');
    const previous=await request(store.get(value.id));
    if(previous && row._rev && row._rev!==previous._rev){value.id=uid();value.title=value.title.slice(0,70)+'（另一份）';}
    store.put({...value,_rev:value.rev,_base:value.id===row.id?previous?._base||'':'',_dirty:true});
    for(const photo of photos)tx.objectStore('images').put({id:photo.id,recordId:value.id,blob:photo.blob,mime:photo.blob.type,size:photo.blob.size,posterId:photo.posterId||'',name:photo.name||''});
    await done;notify();return value;
  }
  async function remove(id,expectedRev) {
    const db=await init(),tx=db.transaction('records','readwrite'),done=complete(tx),store=tx.objectStore('records'),row=await request(store.get(id));
    if(row&&expectedRev&&row._rev!==expectedRev){await done;throw new Error('这条记录已更新，请刷新后再删除');}
    if(row){const rev=uid();store.put({id:row.id,kind:row.kind,deleted:true,rev,updated:new Date().toISOString(),_rev:rev,_base:row._base||'',_dirty:true});}
    await done;notify();
  }
  async function albums() {await init();refresh();return all('albums');}
  async function addAlbum(title,parentId='',folder=false) {
    const row=model.album({id:uid(),title,parentId,folder,rev:uid(),updated:new Date().toISOString()}),db=await init();
    const tx=db.transaction('albums','readwrite'),done=complete(tx);tx.objectStore('albums').put({...row,_rev:row.rev,_base:'',_dirty:true});await done;notify();return row;
  }
  async function pending() {
    const [records,albums]=await Promise.all([all('records'),all('albums')]);
    return {records:records.filter(row=>row._dirty),albums:albums.filter(row=>row._dirty)};
  }
  const dataURL=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});
  async function blobFor(item) {
    if(item.blob)return item.blob;
    const response=await fetch(item.src);if(!response.ok)throw new Error('照片或视频暂时无法下载，请稍后再导出');return response.blob();
  }
  async function backup(kind) {
    await refresh();const records=kind?await list(kind):(await all('records')).filter(row=>!row.deleted),photos=[],seen=new Set();
    async function add(id,recordId) {if(seen.has(id))return;seen.add(id);const item=await image(id);if(!item)throw new Error('照片或视频不完整');const blob=await blobFor(item);photos.push({id,recordId,data:await dataURL(blob),posterId:item.posterId||'',name:item.name||''});if(item.posterId)await add(item.posterId,recordId);}
    for(const row of records)for(const id of row.imageIds)await add(id,row.id);
    return {format:'zengmin-memories-v3',kind:kind||'all',exportedAt:new Date().toISOString(),records:records.map(model.record),albums:kind?[]:(await albums()).map(model.album),photos};
  }
  async function restore(data,kind) {
    if(!data||data.kind!==(kind||'all')||!Array.isArray(data.records)||data.records.length>1000||!['zengmin-memories-v3','zengmin-memories-v2','our-christmas-journal-v1'].includes(data.format))throw new Error('请选择当前页面的备份');
    const existing=new Set((await all('records')).map(row=>row.id)),rawPhotos=Array.isArray(data.photos)?data.photos:[],prepared=[];
    for(const raw of data.records) {
      const row=model.record({...raw,kind:kind||raw.kind});if(existing.has(row.id))continue;
      const additions=[],seen=new Set();
      function add(id){if(seen.has(id))return;seen.add(id);const photo=rawPhotos.find(p=>p.id===id);if(!photo||!model.validId(id)||typeof photo.data!=='string'||photo.data.length>71000000)throw new Error('备份中的照片或视频不完整');const match=/^data:([\w/+.-]+);base64,([A-Za-z0-9+/=]*)$/.exec(photo.data);if(!match||!model.mimeExtensions[match[1]])throw new Error('备份中的文件格式不支持');const bytes=Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0));if(bytes.length>model.MAX_FILE)throw new Error('备份中的单个文件超过 50 MB');additions.push({id,blob:new Blob([bytes],{type:match[1]}),posterId:photo.posterId||'',name:photo.name||''});if(photo.posterId)add(photo.posterId);}
      row.imageIds.forEach(add);prepared.push({row,additions});
    }
    const folderRows=kind?[]:(data.albums||[]).map(model.album),db=await init(),tx=db.transaction(['records','images','albums'],'readwrite'),done=complete(tx);
    for(const {row,additions}of prepared){const rev=uid();tx.objectStore('records').put({...row,rev,_rev:rev,_base:'',_dirty:true});for(const photo of additions)tx.objectStore('images').put({...photo,recordId:row.id,mime:photo.blob.type,size:photo.blob.size});}
    for(const row of folderRows){const req=tx.objectStore('albums').get(row.id);req.onsuccess=()=>{if(!req.result){const rev=uid();tx.objectStore('albums').put({...row,rev,_rev:rev,_base:'',_dirty:true});}};}
    await done;notify();return prepared.length;
  }
  window.Memories={init,list,get,image,save,remove,albums,addAlbum,pending,applyRemote,refresh,backup,restore,uid,notify,dataURL};
})();
