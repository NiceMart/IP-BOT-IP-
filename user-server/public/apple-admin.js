/* Progressive enhancement for the existing management API and forms. */
(() => {
  const date=document.getElementById('adminDate');
  if(date)date.textContent=new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'});
  const notices=document.createElement('div');notices.className='admin-notifications';notices.setAttribute('aria-live','polite');notices.setAttribute('aria-atomic','false');document.body.append(notices);
  const notify=(message)=>{
    const node=document.createElement('div');node.className='admin-notice';node.setAttribute('role','status');
    const text=document.createElement('span');text.textContent=String(message);
    const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','关闭提示');close.onclick=()=>node.remove();node.append(text,close);notices.append(node);
    // Messages persist long enough to read; errors remain until dismissed.
    if(!/失败|错误|不能|请|无效|未|异常/.test(String(message)))setTimeout(()=>node.remove(),10000);
  };
  window.alert=notify;
  const sidebar=document.querySelector('.admin-sidebar'),toggle=document.querySelector('.admin-sidebar-toggle');
  const toggleSidebar=()=>{const hidden=document.body.classList.toggle('sidebar-hidden');sidebar.inert=hidden;toggle.setAttribute('aria-expanded',String(!hidden));toggle.setAttribute('aria-label',hidden?'显示侧栏':'隐藏侧栏');};
  toggle?.addEventListener('click',toggleSidebar);
  document.addEventListener('keydown',event=>{
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'&&!document.getElementById('adminPage').classList.contains('hidden')){event.preventDefault();switchTab('users');document.getElementById('userSearchInput').focus();}
  });
  document.querySelectorAll('.tab-btn').forEach((button,i)=>{
    button.id='admin-nav-'+i;button.setAttribute('aria-controls',['tab-users','tab-cdkeys','tab-modelMgmt','tab-sysSettings'][i]);
    button.setAttribute('aria-current',i===0?'page':'false');
    button.addEventListener('click',()=>{document.querySelectorAll('.tab-btn').forEach(b=>b.setAttribute('aria-current',b===button?'page':'false'));});
  });
  const state=new WeakMap();let lastTrigger=null;
  document.addEventListener('click',e=>{const b=e.target.closest('button,a');if(b&&!b.closest('.modal'))lastTrigger=b;},true);
  const focusable=modal=>[...modal.querySelectorAll('button,input,select,textarea,a[href],[tabindex="0"]')].filter(el=>!el.disabled&&el.getClientRects().length);
  function prepareModal(modal){
    if(state.has(modal))return;
    const heading=modal.querySelector('h2,h3');
    modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.tabIndex=-1;
    if(heading){heading.id||=modal.id+'-title';modal.setAttribute('aria-labelledby',heading.id);}
    const info={open:false,previous:null};state.set(modal,info);
    const sync=()=>{
      const open=modal.isConnected&&getComputedStyle(modal).display!=='none';
      if(open&&!info.open){info.previous=lastTrigger||document.activeElement;info.open=true;queueMicrotask(()=>{(focusable(modal)[0]||modal).focus();});}
      else if(!open&&info.open){info.open=false;if(info.previous?.isConnected)info.previous.focus();}
    };
    new MutationObserver(sync).observe(modal,{attributes:true,attributeFilter:['style','class']});sync();
    modal.addEventListener('keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();closeModal(modal.id);if(info.previous?.isConnected)info.previous.focus();}
      if(event.key!=='Tab')return;
      const nodes=focusable(modal),first=nodes[0],last=nodes[nodes.length-1];
      if(!nodes.length){event.preventDefault();modal.focus();}
      else if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    });
    modal.addEventListener('click',event=>{if(event.target===modal){closeModal(modal.id);info.previous?.focus();}});
  }
  function enhance(scope=document){
    scope.querySelectorAll('.modal').forEach(prepareModal);
    scope.querySelectorAll('.form-group').forEach((group,index)=>{
      const label=group.querySelector('label'),field=group.querySelector('input:not([type="hidden"]),select,textarea');
      if(!label||!field)return;field.id||='admin-field-'+Math.random().toString(36).slice(2);label.htmlFor=field.id;
    });
    scope.querySelectorAll('button').forEach(button=>{
      const text=button.textContent.trim();
      if(text==='📊'){button.textContent='生成统计';button.setAttribute('aria-label','查看生成统计');}
      if(text==='✕'||text==='×')button.setAttribute('aria-label','关闭对话框');
      if(text==='admin')button.textContent='管理员';
    });
    scope.querySelectorAll('label input[type="checkbox"]').forEach(input=>{
      // Existing visually custom switches keep their native checkbox semantics and focus.
      input.style.display='inline-block';input.style.opacity='1';input.style.width='18px';input.style.height='18px';input.style.position='static';input.style.marginRight='8px';
    });
    scope.querySelectorAll('.badge-admin').forEach(el=>el.textContent==='admin'&&(el.textContent='管理员'));
    scope.querySelectorAll('.badge-user').forEach(el=>el.textContent==='user'&&(el.textContent='普通用户'));
    scope.querySelectorAll('.badge-active').forEach(el=>el.textContent==='active'&&(el.textContent='正常'));
    scope.querySelectorAll('.badge-suspended').forEach(el=>el.textContent==='suspended'&&(el.textContent='已禁用'));
  }
  enhance();
  new MutationObserver(records=>{
    const added=records.flatMap(r=>[...r.addedNodes]).filter(n=>n.nodeType===1);
    for(const node of added){if(node.matches?.('.modal'))prepareModal(node);enhance(node);}
    records.forEach(r=>r.removedNodes.forEach(node=>{const info=state.get(node);if(info?.open&&info.previous?.isConnected)info.previous.focus();}));
  }).observe(document.body,{childList:true,subtree:true});
  // A single operation per button while its network request is pending.
  for(const name of ['adminLogin','loadAll','confirmAdjustQuota','confirmResetPassword','confirmRenameUser','confirmCreateAdmin','createCdkeys','saveSystemConfig','saveModelProviders']){
    const original=window[name];if(typeof original!=='function')continue;
    let pending=false;
    window[name]=async function(...args){
      if(pending)return;
      if(name==='saveSystemConfig'&&configurationLoads>0){notify('正在读取配置，请稍候再保存。');return;}
      pending=true;
      const active=document.activeElement,button=active?.tagName==='BUTTON'?active:(name==='adminLogin'?document.querySelector('.btn-login'):null);
      const text=button?.innerHTML;
      if(button){button.disabled=true;button.setAttribute('aria-busy','true');button.textContent=name==='adminLogin'?'正在登录…':name==='loadAll'?'正在刷新…':'正在保存…';}
      try{return await original.apply(this,args);}finally{pending=false;if(button?.isConnected){button.disabled=false;button.removeAttribute('aria-busy');button.innerHTML=text;}}
    };
  }
  const search=document.getElementById('userSearchInput');
  // Block edits until every in-flight configuration load has completed, so a
  // late response cannot overwrite typing or be saved as if it were a new edit.
  const originalLoadConfig=window.loadSystemConfig;
  let configurationLoads=0;
  window.loadSystemConfig=async function(...args){
    configurationLoads++;
    const fields=[...document.querySelectorAll('[id^="cfg_"]')];
    fields.forEach(field=>field.disabled=true);
    document.querySelectorAll('.tab-content').forEach(tab=>tab.setAttribute('aria-busy','true'));
    try{return await originalLoadConfig.apply(this,args);}finally{
      configurationLoads--;
      if(!configurationLoads){fields.forEach(field=>field.disabled=false);document.querySelectorAll('.tab-content').forEach(tab=>tab.removeAttribute('aria-busy'));}
    }
  };
  search?.setAttribute('aria-label','搜索用户名或手机号');
  search?.setAttribute('type','search');
  document.getElementById('loginError')?.setAttribute('role','alert');
  document.querySelectorAll('table').forEach((table,i)=>{table.setAttribute('aria-label',['用户列表','卡密列表'][i]||'管理数据');table.querySelectorAll('thead th').forEach(th=>th.scope='col');});
  document.querySelectorAll('.table-wrap').forEach(wrap=>{wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label','数据表格，可横向滚动查看全部列');});
  const apiLink=document.getElementById('apiCallRecordLink');if(apiLink)apiLink.rel='noopener noreferrer';
})();
