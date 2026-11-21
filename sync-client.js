(() => {
  'use strict';
  const model = typeof module !== 'undefined' && module.exports ? require('./sync-model.js') : SyncModel;
  const REPO = '/repos/zovm/zovm.github.io';
  class SyncClient {
    #token; #fetch;
    constructor(token, transport=globalThis.fetch.bind(globalThis)) {this.#token=token;this.#fetch=transport;}
    async api(path, method='GET', body, raw=false) {
      const headers={Accept:raw?'application/vnd.github.raw+json':'application/vnd.github+json','Authorization':`Bearer ${this.#token}`,'X-GitHub-Api-Version':'2026-03-10'};
      if(body!==undefined)headers['Content-Type']='application/json';
      let response;
      try {response=await this.#fetch('https://api.github.com'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(method==='POST'?120000:45000)});}
      catch {const error=new Error('网络连接中断，内容仍保存在本地，可以再次同步。');error.network=true;throw error;}
      if(!response.ok){
        const error=new Error(response.status===401?'授权已过期或不正确，请重新连接 GitHub。':response.status===403?'当前授权无法写入，请给 zovm.github.io 开启 Contents 读写权限；也可能是请求过于频繁，请稍后再试。':response.status===404?'未找到仓库或授权未包含 zovm.github.io。':response.status===409||response.status===422?'网站有了新的改动，正在重新合并。':'GitHub 暂时未完成请求，内容仍保存在本地。');
        error.status=response.status;throw error;
      }
      return raw?response.text():response.json();
    }
    async validate() {
      const user=await this.api('/user');
      const repo=await this.api(REPO);
      if(!repo.permissions?.push || repo.full_name.toLowerCase()!=='zovm/zovm.github.io')throw new Error('这个账号没有此网站的上传权限，请使用仓库所有者或协作者的授权。');
      // An unreferenced blob checks the token's actual Contents write permission without changing the website.
      await this.api(REPO+'/git/blobs','POST',{content:'zengmin-authorization-check',encoding:'utf-8'});
      return {login:user.login};
    }
    async read() {
      const ref=await this.api(REPO+'/git/ref/heads/main');
      const commit=await this.api(REPO+'/git/commits/'+ref.object.sha);
      let manifest;
      try {const raw=await this.api(REPO+'/contents/content/index.json?ref='+ref.object.sha,'GET',undefined,true);if(raw.length>12000000)throw new Error('网站内容索引过大');manifest=model.manifest(JSON.parse(raw));}
      catch(error){if(error.status===404)manifest=model.empty();else throw error;}
      return {sha:ref.object.sha,tree:commit.tree.sha,manifest};
    }
    async publish({pending,asset,apply,progress=()=>{}}) {
      let head=await this.read();
      if(!pending.records.length&&!pending.albums.length){await apply(head.manifest,[]);return {count:0,conflicts:[],acks:[],sha:head.sha};}
      const media=[],blobs=[],seen=new Set(),known=new Map(head.manifest.media.map(item=>[item.id,item]));
      async function collect(id) {
        if(seen.has(id))return;seen.add(id);
        if(known.has(id)){media.push(known.get(id));return;}
        const item=await asset(id);
        if(!item?.blob)throw new Error('有照片或视频尚未下载，请联网打开这条记录后再同步。');
        const mime=item.blob.type,extension=model.mimeExtensions[mime];
        if(!extension||item.blob.size>model.MAX_FILE)throw new Error('仅支持 JPG、PNG、WebP 和 MP4、WebM、MOV，单个文件请小于 50 MB');
        const info=model.media({id,mime,size:item.blob.size,src:`content/media/${id}.${extension}`,posterId:item.posterId||'',name:item.name||''});
        media.push(info);blobs.push({info,blob:item.blob});if(info.posterId)await collect(info.posterId);
      }
      for(const row of pending.records)if(!row.deleted)for(const id of row.imageIds)await collect(id);
      const entries=[];
      for(const [index,item]of blobs.entries()){
        progress(`正在上传 ${index+1} / ${blobs.length} 个文件`);
        const bytes=new Uint8Array(await item.blob.arrayBuffer());let binary='';
        for(let offset=0;offset<bytes.length;offset+=32768)binary+=String.fromCharCode(...bytes.subarray(offset,offset+32768));
        const blob=await this.api(REPO+'/git/blobs','POST',{content:btoa(binary),encoding:'base64'});
        entries.push({path:item.info.src,mode:'100644',type:'blob',sha:blob.sha});
      }
      for(let attempt=0;attempt<3;attempt++){
        if(attempt)head=await this.read();
        const merged=model.merge(head.manifest,pending,media);
        const unchanged=['records','albums','media'].every(name=>JSON.stringify(merged.manifest[name])===JSON.stringify(head.manifest[name]));
        if(unchanged){await apply(head.manifest,merged.acks);return {count:pending.records.length+pending.albums.length,...merged,sha:head.sha};}
        progress(attempt?'正在合并其他设备的新内容…':'正在把回忆同步到网站…');
        const manifestBlob=await this.api(REPO+'/git/blobs','POST',{content:JSON.stringify(merged.manifest),encoding:'utf-8'});
        const tree=await this.api(REPO+'/git/trees','POST',{base_tree:head.tree,tree:[...entries,{path:'content/index.json',mode:'100644',type:'blob',sha:manifestBlob.sha}]});
        const commit=await this.api(REPO+'/git/commits','POST',{message:'Add our memories from the website',tree:tree.sha,parents:[head.sha]});
        try {
          await this.api(REPO+'/git/refs/heads/main','PATCH',{sha:commit.sha,force:false});
        }catch(error){if(attempt<2&&(error.network||[409,422].includes(error.status)))continue;throw error;}
        await apply(merged.manifest,merged.acks);
        return {count:pending.records.length+pending.albums.length,...merged,sha:commit.sha};
      }
      throw new Error('其他设备正在同步，请稍后重试。内容已保存在本地。');
    }
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=SyncClient;else window.SyncClient=SyncClient;
})();
