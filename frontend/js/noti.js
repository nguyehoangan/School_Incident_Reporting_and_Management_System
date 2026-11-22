/* Chuông thông báo cho sinh viên. Nguồn: nhật ký xử lý (t.log) của phiếu do tài khoản này gửi.
   Khi có backend: thay items() bằng GET /api/notifications. */
(function(){
  const T=window.TS,$=T.$,S=T.state,esc=T.esc,ST=T.ST;
  const DAYS=['Chủ Nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'];
  let tab='new';
  const rk=()=>'ts_read_'+(S.acc?S.acc.id:'');
  const readSet=()=>{try{return new Set(JSON.parse(localStorage.getItem(rk())||'[]'));}catch(e){return new Set();}};
  const saveRead=s=>{try{localStorage.setItem(rk(),JSON.stringify([...s]));}catch(e){}};

  function items(){
    if(!S.acc||S.acc.role!=='user') return [];
    const out=[];
    S.tickets.forEach(t=>(t.log||[]).forEach(l=>{
      if(l.by===S.user) return;
      out.push({id:t.code+'|'+l.at,code:t.code,at:l.at,
        title:'Phiếu '+t.code+' – '+(ST[l.st]?ST[l.st][0]:'Cập nhật'),body:l.text,by:l.by});
    }));
    return out.sort((a,b)=>a.at<b.at?1:-1).slice(0,100);
  }

  function render(){
    const all=items(),rd=readSet(),un=all.filter(i=>!rd.has(i.id)),n=un.length;
    $('#bellN').hidden=!n;$('#bellN').textContent=n>99?'99+':n;$('#notiCnt').textContent=n;
    if($('#notiPop').hidden) return;
    document.querySelectorAll('#notiTabs [data-t]').forEach(b=>b.classList.toggle('on',b.dataset.t===tab));
    const L=tab==='new'?un:all;
    $('#notiList').innerHTML=L.length?L.map(i=>{
      const d=new Date(i.at);
      return '<a class="ni'+(rd.has(i.id)?'':' unread')+'" href="#phieu-da-gui/'+encodeURIComponent(i.code)+'" data-id="'+esc(i.id)+'">'+
        '<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg></span>'+
        '<span class="nb"><b>'+esc(i.title)+'</b><em>'+esc(i.body)+'</em>'+
        '<small>'+T.fmtTime(i.at)+' • '+DAYS[d.getDay()]+' '+T.fmtDate(i.at)+' · '+esc(i.by)+'</small></span></a>';
    }).join(''):'<p class="noti-empty">'+(tab==='new'?'Không có thông báo mới.':'Chưa có thông báo nào.')+'</p>';
  }

  const pop=$('#notiPop'),btn=$('#bellBtn');
  const close=()=>{pop.hidden=true;btn.setAttribute('aria-expanded','false');};
  btn.addEventListener('click',e=>{e.stopPropagation();pop.hidden=!pop.hidden;btn.setAttribute('aria-expanded',!pop.hidden);if(!pop.hidden){T.load();render();}});
  $('#notiClose').addEventListener('click',close);
  document.addEventListener('click',e=>{if(!e.target.closest('#noti'))close();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
  $('#notiTabs').addEventListener('click',e=>{const b=e.target.closest('[data-t]');if(b){tab=b.dataset.t;render();}});
  $('#notiMark').addEventListener('click',()=>{const s=readSet();items().forEach(i=>s.add(i.id));saveRead(s);render();});
  $('#notiList').addEventListener('click',e=>{
    const a=e.target.closest('[data-id]');if(!a)return;
    const s=readSet();s.add(a.dataset.id);saveRead(s);close();render();
  });
  window.addEventListener('hashchange',()=>{close();render();});
  window.addEventListener('storage',e=>{if(e.key==='ts_tickets_all'){T.load();render();}});
  render();
})();
