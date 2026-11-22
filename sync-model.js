/* Shared validation and merge rules. Credentials never belong in content/. */
(() => {
  'use strict';
  const FORMAT = 'zengmin-content-v1';
  const MAX_FILE = 50 * 1024 * 1024;
  const mimeExtensions = Object.assign(Object.create(null),{'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','video/webm':'webm','video/quicktime':'mov'});
  const cities = Object.assign(Object.create(null),{'360500':'新余','360100':'南昌','430100':'长沙','361100':'上饶','330800':'衢州','330600':'绍兴','320100':'南京'});
  const kinds = ['daily','game','food','travel','gallery'];
  const foodCategories = Object.assign(Object.create(null),{tea:'奶茶',food:'食物',drink:'饮料'});
  // Keep food metadata in ordinary note lines so older clients and backups retain it.
  function foodDetails(row) {
    let note=String(row?.note||'').replace(/\r\n/g,'\n'),category='',brand='';
    const header=/^类别：(奶茶|食物|饮料)(?:\n|$)/.exec(note);
    if(header){category=Object.keys(foodCategories).find(key=>foodCategories[key]===header[1]);note=note.slice(header[0].length);}
    const value=/^品牌：([^\n]{1,80})(?:\n|$)/.exec(note);if(value){brand=value[1];note=note.slice(value[0].length);}if(header||value)note=note.replace(/^\n/,'');
    return {category,brand,note};
  }
  function foodNote(category,brand,note) {
    const content=String(note||'').trim(),value=String(brand||'').trim().replace(/[\r\n]+/g,' ').slice(0,80);
    const header=[foodCategories[category]?`类别：${foodCategories[category]}`:'',value?'品牌：'+value:''].filter(Boolean).join('\n');
    return header+(header&&content?'\n\n':'')+content;
  }
  const uid = () => globalThis.crypto.randomUUID();
  const text = (value, max) => String(value || '').slice(0, max);
  const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,120}$/.test(value);
  const validRev = value => validId(value);
  function dateOK(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T00:00:00Z');
    return Number.isFinite(+date) && date.toISOString().slice(0,10) === value;
  }
  function record(row) {
    if (!row || !validId(row.id) || !kinds.includes(row.kind)) throw new Error('记录格式不正确');
    if (row.deleted === true) {
      if (!validRev(row.rev)) throw new Error('记录版本不正确');
      return {id:row.id,kind:row.kind,deleted:true,rev:row.rev,updated:text(row.updated,40)};
    }
    if (typeof row.title !== 'string' || !row.title.trim() || row.title.length > 80 || typeof row.note !== 'string' || row.note.length > 30000 || !dateOK(row.date)) throw new Error('请检查标题、正文和日期');
    const duration = Number(row.duration || 0);
    if (!Number.isFinite(duration) || duration < 0 || duration > 1440) throw new Error('游玩时长不正确');
    if (row.kind === 'travel' && !cities[row.cityId]) throw new Error('请选择旅行城市');
    if (row.kind === 'gallery' && !validId(row.albumId)) throw new Error('请选择相册');
    const imageIds = Array.isArray(row.imageIds) ? row.imageIds : [];
    if (imageIds.length > 20 || imageIds.some(id => !validId(id)) || new Set(imageIds).size !== imageIds.length) throw new Error('每条记录最多添加 20 个照片或视频');
    return {id:row.id,kind:row.kind,title:row.title.trim(),note:row.note,date:row.date,
      gameName:row.kind === 'game' ? text(row.gameName || row.title,80) : '',
      foodType:['meal','favorite','avoid'].includes(row.foodType) ? row.foodType : 'meal',foodName:text(row.foodName,80),
      person:['我们','曾','敏'].includes(row.person) ? row.person : '我们',meal:['早餐','午餐','晚餐','加餐'].includes(row.meal) ? row.meal : '午餐',
      mood:text(row.mood || '晴朗',20),duration:Math.round(duration),cityId:row.kind === 'travel' ? row.cityId : '',
      albumId:row.kind === 'gallery' ? row.albumId : '',imageIds:[...imageIds],
      updated:typeof row.updated === 'string' ? row.updated.slice(0,40) : new Date().toISOString(),rev:validRev(row.rev) ? row.rev : uid()};
  }
  function album(row) {
    if (!row || !validId(row.id) || !validRev(row.rev) || typeof row.title !== 'string' || !row.title.trim() || row.title.length > 60 || (row.parentId && !validId(row.parentId)) || row.parentId === row.id) throw new Error('相册格式不正确');
    return {id:row.id,title:row.title.trim(),parentId:row.parentId || '',folder:row.folder===true,rev:row.rev,updated:text(row.updated,40)};
  }
  function media(row) {
    if (!row || !validId(row.id) || !mimeExtensions[row.mime] || !Number.isFinite(row.size) || row.size < 0 || row.size > MAX_FILE || row.src !== `content/media/${row.id}.${mimeExtensions[row.mime]}` || (row.posterId && !validId(row.posterId))) throw new Error('照片或视频格式不正确');
    return {id:row.id,mime:row.mime,size:row.size,src:row.src,posterId:row.posterId || '',name:text(row.name,180)};
  }
  const empty = () => ({format:FORMAT,updated:'1970-01-01T00:00:00.000Z',records:[],albums:[],media:[]});
  function manifest(input) {
    if (!input || input.format !== FORMAT || !Array.isArray(input.records) || !Array.isArray(input.albums) || !Array.isArray(input.media) || input.records.length > 10000 || input.albums.length > 1000 || input.media.length > 100000 || !Number.isFinite(Date.parse(input.updated))) throw new Error('网站内容格式不正确');
    if(input.records.some(row=>!validRev(row.rev)))throw new Error('网站记录版本不正确');
    const result = {format:FORMAT,updated:input.updated,records:input.records.map(record),albums:input.albums.map(album),media:input.media.map(media)};
    for (const name of ['records','albums','media']) if (new Set(result[name].map(row=>row.id)).size !== result[name].length) throw new Error('网站内容存在重复编号');
    const assets = new Map(result.media.map(row=>[row.id,row]));
    for (const row of result.records) if (!row.deleted && row.imageIds.some(id=>!assets.has(id))) throw new Error('记录中的照片或视频不完整');
    for (const row of result.media) if (row.posterId && (!assets.has(row.posterId) || !assets.get(row.posterId).mime.startsWith('image/'))) throw new Error('视频封面不完整');
    const folders = new Map(result.albums.map(row=>[row.id,row]));
    for (const row of result.albums) {
      const seen = new Set([row.id]); let parent = row.parentId;
      while (folders.has(parent)) { if (seen.has(parent)) throw new Error('相册路径不正确'); seen.add(parent); parent = folders.get(parent).parentId; }
    }
    return result;
  }
  function merge(remoteInput, pending, assets = []) {
    const result = manifest(remoteInput), acks = [], conflicts = [], folderIds = new Map();
    const assetMap = new Map(result.media.map(row=>[row.id,row]));
    for (const value of assets) {
      const item = media(value), existing = assetMap.get(item.id);
      if (existing && JSON.stringify(existing) !== JSON.stringify(item)) throw new Error('媒体编号发生冲突，请重新添加该文件');
      assetMap.set(item.id,item);
    }
    for (const store of ['albums','records']) {
      const rows = new Map(result[store].map(row=>[row.id,row]));
      const changes=[...(pending[store] || [])];
      if(store==='albums'){
        const folders=new Map(changes.map(row=>[row.id,row]));
        function depth(row,seen=new Set()){if(!folders.has(row.parentId)||seen.has(row.id))return 0;seen.add(row.id);return 1+depth(folders.get(row.parentId),seen);}
        changes.sort((a,b)=>depth(a)-depth(b));
      }
      for (const local of changes) {
        let value = store === 'records' ? record({...local,rev:local._rev}) : album({...local,rev:local._rev});
        if (value.parentId && folderIds.has(value.parentId)) value.parentId = folderIds.get(value.parentId);
        if (value.albumId && folderIds.has(value.albumId)) value.albumId = folderIds.get(value.albumId);
        const other = rows.get(value.id);
        if (other?.rev === local._rev) { acks.push({store,id:local.id,rev:local._rev,targetId:other.id}); continue; }
        if (other && other.rev !== local._base) {
          conflicts.push({store,id:value.id,deleted:!!value.deleted});
          if (value.deleted) { acks.push({store,id:local.id,rev:local._rev,targetId:other.id}); continue; }
          const originalId = value.id;
          value.id = `${value.id.slice(0,72)}-copy-${local._rev.slice(0,32)}`;
          value.title = `${value.title.slice(0,70)}（另一份）`;
          if (store === 'albums') folderIds.set(originalId,value.id);
        }
        rows.set(value.id,value);
        acks.push({store,id:local.id,rev:local._rev,targetId:value.id});
      }
      result[store] = [...rows.values()];
    }
    result.media = [...assetMap.values()];
    result.updated = new Date(Math.max(Date.now(),Date.parse(result.updated)+1)).toISOString();
    return {manifest:manifest(result),acks,conflicts};
  }
  const api = {FORMAT,MAX_FILE,mimeExtensions,cities,kinds,foodCategories,foodDetails,foodNote,uid,validId,dateOK,record,album,media,empty,manifest,merge};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.SyncModel = api;
})();
