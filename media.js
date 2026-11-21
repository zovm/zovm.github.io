(() => {
  'use strict';
  const urls=new Map();
  const fallback='assets/video-placeholder.svg';
  function urlFor(item){if(!item)return '';if(!item.blob)return item.src||'';if(!urls.has(item.id))urls.set(item.id,URL.createObjectURL(item.blob));return urls.get(item.id);}
  async function resolve(id,additions=[]) {
    const item=additions.find(row=>row.id===id)||await Memories.image(id);if(!item)return null;
    const mime=item.mime||item.blob?.type||'image/jpeg';
    const poster=item.posterId?(additions.find(row=>row.id===item.posterId)||await Memories.image(item.posterId)):null;
    return {...item,mime,type:mime.startsWith('video/')?'video':'image',src:urlFor(item),poster:poster?urlFor(poster):fallback};
  }
  async function videoPoster(file) {
    const video=document.createElement('video'),url=URL.createObjectURL(file);video.muted=true;video.playsInline=true;video.preload='auto';
    try {
      await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(new Error('poster timeout')),10000);
        const finish=()=>{clearTimeout(timer);resolve();};
        video.onerror=()=>{clearTimeout(timer);reject(new Error('video unavailable'));};
        video.onloadeddata=()=>{if(Number.isFinite(video.duration)&&video.duration>.3){video.onseeked=finish;video.currentTime=Math.min(.25,video.duration/2);}else finish();};
        video.src=url;
      });
      if(!video.videoWidth)return null;
      const canvas=document.createElement('canvas'),ratio=Math.min(1,900/video.videoWidth);canvas.width=Math.round(video.videoWidth*ratio);canvas.height=Math.round(video.videoHeight*ratio);canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
      return await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.8));
    }catch{return null;}finally{video.pause();video.removeAttribute('src');video.load();URL.revokeObjectURL(url);}
  }
  async function prepare(file) {
    let mime=file.type;
    if(!mime){const ext=file.name.split('.').pop().toLowerCase();mime=({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',mp4:'video/mp4',webm:'video/webm',mov:'video/quicktime'})[ext];}
    if(!SyncModel.mimeExtensions[mime])throw new Error('请选择 JPG、PNG、WebP 图片或 MP4、WebM、MOV 视频');
    if(file.size>SyncModel.MAX_FILE)throw new Error('单个照片或视频请小于 50 MB');
    if(!file.size)throw new Error('不能添加空文件');
    const id=Memories.uid(),assets=[];let blob;
    if(mime.startsWith('video/')){
      blob=file.type===mime?file:new Blob([file],{type:mime});
      const poster=await videoPoster(blob);let posterId='';
      if(poster){posterId=Memories.uid();assets.push({id:posterId,blob:poster,name:'视频封面'});}
      assets.unshift({id,blob,name:file.name,posterId});
    }else{
      const url=URL.createObjectURL(file),image=new Image();image.src=url;
      try{
        await image.decode();
        if(!image.naturalWidth||image.naturalWidth*image.naturalHeight>80000000)throw new Error('图片尺寸过大，请先缩小再添加');
        const ratio=Math.min(1,2048/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
        blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.9));if(!blob)throw new Error('图片读取失败');
      }finally{URL.revokeObjectURL(url);}
      assets.push({id,blob,name:file.name});
    }
    return {id,assets};
  }
  addEventListener('pagehide',()=>{for(const url of urls.values())URL.revokeObjectURL(url);urls.clear();});
  window.MediaKit={prepare,resolve,fallback};
})();
