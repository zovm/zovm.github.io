(() => {
  'use strict';
  const KEY='zengmin:github-session';
  const authorize='https://github.com/settings/personal-access-tokens/new?name=ZengMin+Memories&description=Sync+our+memories+to+zovm.github.io&target_name=zovm&expires_in=90&contents=write';
  let session=null,busy=false,count=0,refreshing=false;
  try {const value=JSON.parse(sessionStorage.getItem(KEY));if(value&&/^(github_pat_|ghp_)[A-Za-z0-9_]+$/.test(value.token)&&typeof value.login==='string')session=value;}catch{}
  const dialog=document.createElement('dialog');dialog.className='sync-dialog';dialog.id='sync-dialog';dialog.setAttribute('aria-labelledby','sync-title');
  dialog.innerHTML=`<header class="sync-heading"><div><span class="sync-eyebrow">曾❤敏</span><h2 id="sync-title">账号与同步</h2></div><button type="button" class="sync-close" aria-label="关闭账号与同步">×</button></header>
    <div class="sync-account" id="sync-account"></div>
    <form id="github-connect-form"><a class="primary-button github-authorize" target="_blank" rel="noopener noreferrer" href="${authorize}">前往 GitHub 登录并授权</a><ol class="sync-steps"><li>选择 Only select repositories，再选择 <b>zovm.github.io</b>。</li><li>将 Contents 设为 <b>Read and write</b>，生成授权。</li><li>复制生成的授权令牌，粘贴到下方。</li></ol><label class="sync-token-label" for="github-token">GitHub 授权令牌</label><div class="sync-connect-row"><input id="github-token" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="github_pat_…" required><button class="primary-button" type="submit">连接</button></div><p class="sync-session-note">授权仅在当前标签页保留。账号密码在 GitHub 官方页面输入。</p></form>
    <section class="sync-pending"><h3 id="sync-pending-title">待同步</h3><ul id="sync-pending-list"></ul></section>
    <p class="sync-public-note">同步后的文字、照片和视频会在网站公开展示。</p>
    <p class="sync-message" id="sync-message" role="status" aria-live="polite"></p>
    <div class="sync-actions"><button class="primary-button" id="publish-memories" type="button">同步到网站</button><button class="quiet-button" id="github-disconnect" type="button">退出连接</button></div>
    <details class="sync-backup"><summary>本地备份</summary><div><button class="quiet-button" id="backup-all" type="button">导出全部</button><label class="quiet-button" for="restore-all">导入备份</label><input id="restore-all" type="file" accept=".json,application/json" hidden></div></details>`;
  document.body.append(dialog);
  const $=id=>document.getElementById(id),buttons=[];
  let actionHub=null,actionPanel=null,actionToggle=null,actionBadge=null,backupBusy=false,backupTimer;
  const quickBackupButtons=[];
  const labels={daily:'dailyM',game:'gameM',food:'foodM',gallery:'照相馆',travel:'旅行'};
  const makeButton=(label,action)=>{const button=document.createElement('button');button.type='button';button.className='quiet-button';button.textContent=label;button.addEventListener('click',action);return button;};
  function addControls(container) {
    const controls=document.createElement('div');controls.className='sync-controls';
    const account=makeButton('连接 GitHub',()=>open()),sync=makeButton('同步',()=>open());
    account.classList.add('sync-account-button');sync.classList.add('sync-publish-button');controls.append(account,sync);container.append(controls);buttons.push({account,sync});
  }
  const toolbar=document.querySelector('.journal-toolbar,.record-top-actions');
  const gallery=document.getElementById('gallery-dialog');
  const travel=document.body.dataset.page==='travel';
  if(toolbar||gallery||travel){
    actionHub=document.createElement('div');actionHub.className='action-hub';actionHub.id='page-actions';
    actionToggle=document.createElement('button');actionToggle.type='button';actionToggle.className='action-toggle';actionToggle.id='action-toggle';actionToggle.setAttribute('aria-expanded','false');actionToggle.setAttribute('aria-controls','action-panel');actionToggle.setAttribute('aria-label','展开操作菜单');
    actionToggle.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16M4 12h16"/></svg>';
    actionBadge=document.createElement('span');actionBadge.className='action-badge';actionBadge.hidden=true;actionBadge.setAttribute('aria-hidden','true');actionToggle.append(actionBadge);
    actionPanel=document.createElement('section');actionPanel.className='action-panel';actionPanel.id='action-panel';actionPanel.hidden=true;actionPanel.setAttribute('aria-label','页面操作');
    let content;
    if(toolbar){content=toolbar;addControls(content);}
    else if(gallery){content=document.createElement('div');content.className='gallery-manage-bar';content.id='gallery-manage-bar';addControls(content);}
    else{
      content=document.createElement('div');content.className='travel-actions';
      const add=document.createElement('a');add.id='travel-add-memory';add.className='primary-button';add.href='record.html?kind=travel&city=360500&new=1';add.textContent='在新余添加回忆';
      const view=document.createElement('a');view.id='travel-open-memories';view.className='quiet-button';view.href='city.html?city=360500';view.textContent='查看新余回忆';
      content.append(add,view);addControls(content);
    }
    actionPanel.append(content);actionHub.append(actionToggle,actionPanel);(gallery||document.body).append(actionHub);
    actionToggle.addEventListener('click',()=>setActions(actionPanel.hidden));
    actionToggle.addEventListener('keydown',event=>{
      if(!['ArrowDown','ArrowUp'].includes(event.key))return;event.preventDefault();setActions(true);
      const items=actionItems();(event.key==='ArrowUp'?items.at(-1):items[0])?.focus();
    });
    actionPanel.addEventListener('click',event=>{const control=event.target.closest('a,button');if(control)setActions(false);});
    actionPanel.addEventListener('change',event=>{if(event.target.type==='file')setActions(false);});
    document.addEventListener('pointerdown',event=>{if(!actionPanel.hidden&&!actionHub.contains(event.target))setActions(false);});
    document.addEventListener('focusin',event=>{if(!actionPanel.hidden&&!actionHub.contains(event.target))setActions(false);});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!actionPanel.hidden){event.preventDefault();event.stopPropagation();setActions(false,true);}},true);
    gallery?.addEventListener('close',()=>setActions(false));
  }
  function actionItems(){return [...actionPanel.querySelectorAll('a[href],button,label[for]')].filter(element=>!element.disabled&&!element.closest('[hidden]'));}
  function setActions(expanded,restoreFocus=false){
    if(!actionPanel)return;actionPanel.hidden=!expanded;actionHub.classList.toggle('is-open',expanded);actionToggle.setAttribute('aria-expanded',String(expanded));actionToggle.setAttribute('aria-label',expanded?'收起操作菜单':count?`展开操作菜单，${count} 项待同步`:'展开操作菜单');
    if(restoreFocus)actionToggle.focus();if(expanded)document.dispatchEvent(new Event('zengmin:actions-open'));
  }
  function addBackupControls(){
    if(!actionPanel)return;
    const actions=document.createElement('div');actions.className='action-backups';
    const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.hidden=true;input.id='quick-restore-all';input.addEventListener('change',importAll);
    const exportButton=makeButton('导出备份',exportAll),importButton=makeButton('导入备份',()=>input.click());
    quickBackupButtons.push(exportButton,importButton);actions.append(exportButton,importButton,input);actionPanel.append(actions);
  }
  if(actionPanel&&!document.getElementById('export-records'))addBackupControls();
  const nav=document.querySelector('#nav-drawer nav');
  if(nav){const button=makeButton('GitHub · 账号与同步',()=>{document.getElementById('nav-drawer').close();open();});button.className='drawer-account';nav.after(button);}
  function message(text,error=false){$('sync-message').textContent=text;$('sync-message').classList.toggle('is-error',error);}
  function state(){
    for(const pair of buttons){pair.account.textContent=session?'GitHub · '+session.login:'连接 GitHub';pair.sync.textContent=busy?'同步中…':count?`同步（${count}）`:'同步';pair.account.disabled=pair.sync.disabled=busy;}
    $('sync-account').textContent=session?'已连接 '+session.login+' · zovm.github.io':'未连接 · 内容先保存在当前设备';
    $('github-connect-form').hidden=!!session;$('github-disconnect').hidden=!session;
    $('github-disconnect').disabled=busy;$('publish-memories').disabled=busy;
    $('publish-memories').textContent=busy?'同步中…':session?(count?'同步到网站':'获取网站最新内容'):'连接后同步';
    $('backup-all').disabled=busy||backupBusy;for(const button of quickBackupButtons)button.disabled=busy||backupBusy;
    if(actionBadge){actionBadge.hidden=!count;actionBadge.textContent=count>99?'99+':String(count);if(actionPanel.hidden)actionToggle.setAttribute('aria-label',count?`展开操作菜单，${count} 项待同步`:'展开操作菜单');}
    document.dispatchEvent(new CustomEvent('zengmin:account-changed',{detail:{connected:!!session,busy}}));
  }
  async function refresh(){
    if(refreshing)return;refreshing=true;
    try {
      const pending=await Memories.pending();count=pending.records.length+pending.albums.length;$('sync-pending-title').textContent=`待同步 · ${count}`;
      $('sync-pending-list').replaceChildren();
      for(const row of [...pending.albums.map(row=>({...row,kind:'gallery',isAlbum:true})),...pending.records].slice(0,30)){
        const li=document.createElement('li'),title=document.createElement('span'),meta=document.createElement('span');
        title.textContent=row.deleted?'删除一条记录':row.title;meta.textContent=labels[row.kind]+(row.isAlbum?' · 新相册':row.date?' · '+row.date:'');li.append(title,meta);$('sync-pending-list').append(li);
      }
      if(!count){const li=document.createElement('li');li.textContent='没有待同步的内容';$('sync-pending-list').append(li);}state();
    }catch{message('本地记录暂时无法读取，请检查浏览器存储权限。',true);}finally{refreshing=false;}
  }
  async function open(){setActions(false);await refresh();if(!dialog.open)dialog.showModal();}
  async function connect(event){
    event.preventDefault();const token=$('github-token').value.trim();
    if(!/^(github_pat_|ghp_)[A-Za-z0-9_]+$/.test(token)){message('请粘贴 GitHub 生成的授权令牌。',true);return;}
    const submit=event.target.querySelector('button[type=submit]');submit.disabled=true;message('正在确认账号和上传权限…');
    try {
      const user=await new SyncClient(token).validate();session={token,login:user.login};
      try{sessionStorage.setItem(KEY,JSON.stringify(session));}catch{}
      $('github-token').value='';message('已连接，可以同步本地回忆。');await refresh();
    }catch(error){message(error.message,true);}finally{submit.disabled=false;state();}
  }
  async function runSync(){
    if(busy)throw new Error('正在同步，请稍候');
    if(!session){await open();$('github-token').focus();throw new Error('请先连接 GitHub。内容已保存在本地。');}
    busy=true;setActions(false);state();if(!dialog.open)dialog.showModal();message('正在读取网站最新内容…');
    try {
      const action=async()=>new SyncClient(session.token).publish({pending:await Memories.pending(),asset:Memories.image,apply:Memories.applyRemote,progress:message});
      const result=navigator.locks?await navigator.locks.request('zengmin-github-sync',{ifAvailable:true},lock=>{if(!lock)throw new Error('另一个标签页正在同步，请稍后重试。');return action();}):await action();
      const conflicts=result.conflicts?.length||0;
      message(result.count?`已同步 ${result.count} 项。网站更新需要片刻。${conflicts?'同时发生的修改已保留，请查看两份记录。':''}`:'已获取网站最新内容。');
      document.dispatchEvent(new CustomEvent('zengmin:synced',{detail:result}));return result;
    }catch(error){
      if(error.status===401){session=null;try{sessionStorage.removeItem(KEY);}catch{}}
      message(error.message||'同步未完成，内容仍保存在本地。',true);throw error;
    }finally{busy=false;await refresh();state();}
  }
  $('github-connect-form').addEventListener('submit',connect);
  $('publish-memories').addEventListener('click',()=>{if(!session){$('github-token').focus();message('先完成上方 GitHub 授权，再粘贴令牌连接。');}else runSync().catch(()=>{});});
  $('github-disconnect').addEventListener('click',()=>{session=null;try{sessionStorage.removeItem(KEY);}catch{}message('已退出连接，本地回忆已保留。');state();});
  dialog.querySelector('.sync-close').addEventListener('click',()=>dialog.close());
  function backupMessage(text,error=false){
    if(dialog.open){message(text,error);return;}
    let toast=$('action-toast');if(!toast){toast=document.createElement('div');toast.id='action-toast';toast.className='action-toast';toast.setAttribute('role','status');(gallery||document.body).append(toast);}
    clearTimeout(backupTimer);toast.textContent=text;toast.classList.add('visible');backupTimer=setTimeout(()=>toast.classList.remove('visible'),error?6500:4000);
  }
  function backupState(value){backupBusy=value;$('backup-all').disabled=value||busy;for(const button of quickBackupButtons)button.disabled=value||busy;}
  async function exportAll(){
    if(backupBusy)return;backupState(true);backupMessage('正在整理本地备份…');
    try{const data=await Memories.backup(),url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='ZengMin-memories-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);backupMessage('已导出全部回忆。');}catch(error){backupMessage(error.message,true);}finally{backupState(false);}
  }
  async function importAll(event){
    const file=event.target.files?.[0];if(!file||backupBusy)return;backupState(true);
    try{if(file.size>220*1024*1024)throw new Error('备份超过 220 MB，请使用分页面备份');const count=await Memories.restore(JSON.parse(await file.text()));backupMessage(`已导入 ${count} 条记录。`);await refresh();}catch(error){backupMessage(error.message,true);}finally{event.target.value='';backupState(false);}
  }
  $('backup-all').addEventListener('click',exportAll);
  $('restore-all').addEventListener('change',importAll);
  document.addEventListener('zengmin:content-changed',refresh);
  document.addEventListener('zengmin:storage-blocked',()=>{setActions(false);if(!dialog.open)dialog.showModal();message('请关闭其他打开此网站的旧标签页，再刷新当前页面。',true);});
  addEventListener('storage',event=>{if(event.key==='zengmin:records-changed')refresh();});
  window.GitHubSync={open,sync:runSync,connected:()=>!!session,busy:()=>busy};
  refresh();
})();
