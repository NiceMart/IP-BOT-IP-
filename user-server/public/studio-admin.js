/* Small accessibility improvements, kept separate from API and management logic. */
(() => {
  document.getElementById('adminDate').textContent = new Date().toLocaleDateString('zh-CN', {year:'numeric',month:'long',day:'numeric'});
  const search = document.getElementById('userSearchInput');
  search?.addEventListener('keydown', event => { if (event.key === 'Enter') searchUsers(); });
  document.querySelectorAll('.modal').forEach(modal => {
    modal.setAttribute('role','dialog'); modal.setAttribute('aria-modal','true');
    const heading = modal.querySelector('h2,h3');
    if (heading) { heading.id ||= modal.id+'-title'; modal.setAttribute('aria-labelledby',heading.id); }
    let previousFocus;
    new MutationObserver(() => {
      if (getComputedStyle(modal).display !== 'none') { previousFocus=document.activeElement; (modal.querySelector('input:not([type=hidden]),select,button')||modal).focus(); }
      else if(previousFocus?.isConnected) {previousFocus.focus();previousFocus=null;}
    }).observe(modal,{attributes:true,attributeFilter:['style','class']});
    modal.addEventListener('keydown', event => {
      if(event.key==='Escape'){closeModal(modal.id);return;}
      if(event.key!=='Tab')return;
      const nodes=[...modal.querySelectorAll('button,input,select,textarea,a[href]')].filter(el=>!el.disabled&&el.getClientRects().length);
      const first=nodes[0],last=nodes[nodes.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    });
  });
})();
