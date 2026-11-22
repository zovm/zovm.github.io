(() => {
  'use strict';
  let base;
  async function load() {
    if(!base){const response=await fetch('assets/gallery/albums.json?v=20261122-15');if(!response.ok)throw new Error('相册暂时无法读取');base=await response.json();}
    const result=structuredClone(base),map=new Map();
    const index=list=>{for(const row of list){map.set(row.id,row);if(row.children)index(row.children);}};index(result);
    const [folders,records]=await Promise.all([Memories.albums(),Memories.list('gallery')]);
    const pending=[...folders];
    for(let pass=0;pending.length&&pass<=folders.length;pass++){
      let moved=false;
      for(let i=pending.length-1;i>=0;i--){const row=pending[i];if(row.parentId&&!map.has(row.parentId))continue;if(map.has(row.id)){pending.splice(i,1);continue;}
        const item={id:row.id,title:row.title,cover:'',...(row.folder?{children:[]}:{items:[]})};
        const parent=row.parentId?map.get(row.parentId):null;
        if(parent&&!parent.children)throw new Error('相册分类不完整，请检查导入的备份');
        (parent?parent.children:result).push(item);map.set(item.id,item);pending.splice(i,1);moved=true;
      }
      if(!moved)break;
    }
    // Keep orphaned imported albums visible so a partial backup never hides memories.
    for(const row of pending){const item={id:row.id,title:row.title,items:[]};result.push(item);map.set(item.id,item);}
    for(const record of records){
      let album=map.get(record.albumId);
      if(!album){album={id:record.albumId,title:'收藏',items:[]};result.push(album);map.set(album.id,album);}
      if(!album.items)continue;
      for(const id of record.imageIds){const media=await MediaKit.resolve(id);if(!media)continue;album.items.push({id,type:media.type,src:media.src,poster:media.poster,alt:record.title,recordId:record.id,date:record.date});}
    }
    function covers(list){for(const row of list){if(row.children){covers(row.children);row.cover=row.cover||row.children.find(item=>item.cover)?.cover||'';}else if(!row.cover&&row.items.length){const first=row.items[0];row.cover=first.type==='video'?first.poster:first.thumb||first.src;}}}covers(result);
    return result;
  }
  function find(id,list){for(const album of list){if(album.id===id)return album;if(album.children){const found=find(id,album.children);if(found)return found;}}return null;}
  window.GalleryData={load,find};
})();
