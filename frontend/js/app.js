(function(){
  const $=s=>document.querySelector(s);
  const state={user:null,acc:null,all:[],images:[],tickets:[],filter:'ALL',q:''};
  const HOME={user:'home',admin:'st-home',tech:'st-home'};
  try{const a=(window.ACCOUNTS||[]).find(x=>x.id===localStorage.getItem('ts_uid'));if(a){state.acc=a;state.user=a.name;}}catch(e){}

  const views={splash:$('#splash'),login:$('#login'),shell:$('#shell')};
  const pages={};document.querySelectorAll('#shell main>section').forEach(s=>pages[s.id]=s);
  function route(){
    const raw=(location.hash||'#splash').slice(1).split('/');
    let h=raw[0];let arg='';try{arg=decodeURIComponent(raw.slice(1).join('/'));}catch(e){}
    if(!(h in views)&&!(h in pages)) h='splash';
    if(h in pages && !state.user) h='login';
    if(h in pages && state.acc && !(pages[h].dataset.role||'user').split(' ').includes(state.acc.role)) h=HOME[state.acc.role];
    Object.values(views).forEach(v=>v.hidden=true);
    if(h in pages){
      views.shell.hidden=false;
      Object.entries(pages).forEach(([k,p])=>p.hidden=k!==h);
      $('#supportItem').classList.toggle('active',['yeu-cau-xu-ly','phieu-da-gui','huong-dan'].includes(h));
      closeMenus();
      if(h==='phieu-da-gui') renderSent(arg);
      if(window.TS&&TS.onRoute) TS.onRoute(h,arg);
    } else views[h].hidden=false;
    window.scrollTo(0,0);
  }
  window.addEventListener('hashchange',route);

  function fillId(){const a=state.acc;$('#mIdLbl').textContent=a&&a.title!=='Sinh viên'?'Mã cán bộ':'Mã số sinh viên';$('#mId').value=a&&a.mssv||'';}
  function applyRole(){
    const r=state.acc?state.acc.role:'user';
    document.querySelectorAll('.menu[data-role]').forEach(m=>m.hidden=m.dataset.role!==r);
    $('#avSub').textContent=state.acc?state.acc.title+(state.acc.unit?' – '+state.acc.unit:''):'';
  }
  function login(acc){
    state.acc=acc;state.user=acc.name;try{localStorage.setItem('ts_uid',acc.id);}catch(e){}
    loadTickets();applyRole();
    $('#avName').textContent=acc.name;$('#avInit').textContent=acc.name.trim().charAt(0).toUpperCase()||'A';
    $('#mName').value=acc.name;fillId();updSign();
    location.hash='#'+HOME[acc.role];
  }
  $('#loginForm').addEventListener('submit',e=>{
    e.preventDefault();
    const u=$('#lgUser'),p=$('#lgPass');let ok=true;
    [[u,'#lgUserErr'],[p,'#lgPassErr']].forEach(([el,er])=>{const b=!el.value.trim();el.classList.toggle('bad',b);$(er).hidden=!b;if(b)ok=false;});
    if(ok){
      const k=u.value.trim().toLowerCase();
      // TODO backend: thay bằng POST /api/login. Tài khoản do trường cấp, không có đăng ký.
      const acc=(window.ACCOUNTS||[]).find(a=>(a.id===k||a.email.toLowerCase()===k)&&a.pass===p.value);
      if(!acc){$('#lgNote').textContent='Tài khoản hoặc mật khẩu không đúng. Tài khoản do nhà trường cấp.';p.value='';return;}
      p.value='';login(acc);
    }
  });
  $('#ssoBtn').addEventListener('click',()=>login(window.ACCOUNTS.find(a=>a.role==='user'))); // TODO: thay bằng SSO email trường
  $('#forgot').addEventListener('click',e=>{e.preventDefault();$('#lgNote').textContent='Liên hệ Phòng Quản trị (024 3869 2008) để được cấp lại mật khẩu.';});
  $('#logout').addEventListener('click',()=>{state.user=null;state.acc=null;state.all=[];state.tickets=[];$('#myCount').textContent=0;try{localStorage.removeItem('ts_uid');}catch(e){}location.hash='#login';});
  if(state.user){$('#avName').textContent=state.user;$('#avInit').textContent=state.user.charAt(0).toUpperCase();loadTickets();applyRole();fillId();}

  function closeMenus(){document.querySelectorAll('.menu>li.open').forEach(l=>l.classList.remove('open'));$('#avMenu').hidden=true;document.querySelectorAll('.menu').forEach(m=>m.classList.remove('show'));$('#burger').setAttribute('aria-expanded','false');}
  document.querySelectorAll('.menu>li>button').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const li=b.parentElement,o=li.classList.contains('open');document.querySelectorAll('.menu>li.open').forEach(l=>l.classList.remove('open'));if(!o)li.classList.add('open');}));
  $('#burger').addEventListener('click',e=>{e.stopPropagation();const m=document.querySelector('.menu:not([hidden])').classList.toggle('show');$('#burger').setAttribute('aria-expanded',m);});
  $('#avBtn').addEventListener('click',e=>{e.stopPropagation();$('#avMenu').hidden=!$('#avMenu').hidden;});
  document.addEventListener('click',e=>{if(!e.target.closest('.menu')&&!e.target.closest('.avatar'))closeMenus();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenus();});

  const rows=$('#rows');
  const sample=[
    ['Máy chiếu Panasonic phòng 205 – Nhà C1','Bật không lên hình, đèn báo lỗi nhấp nháy đỏ','Cần trước buổi học sáng thứ 5'],
    ['Điều hòa Daikin 18000BTU – phòng 205','Chảy nước, không làm lạnh',''],
  ];
  function addRow(v){
    v=v||['','',''];
    const tr=document.createElement('tr');
    tr.innerHTML='<td class="stt"></td>'+
      '<td><textarea rows="2" placeholder="Tên thiết bị, mã tài sản, vị trí" aria-label="Nội dung cần sửa chữa"></textarea></td>'+
      '<td><textarea rows="2" placeholder="Mô tả hiện tượng hỏng" aria-label="Tình trạng hư hỏng"></textarea></td>'+
      '<td><textarea rows="2" placeholder="" aria-label="Ghi chú"></textarea></td>'+
      '<td class="act"><button type="button" class="icon-btn" aria-label="Xóa dòng"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button></td>';
    const ta=tr.querySelectorAll('textarea');ta.forEach((t,i)=>t.value=v[i]);
    tr.querySelector('.icon-btn').onclick=()=>{if(rows.children.length>1){tr.remove();renum();}else ta.forEach(t=>t.value='');};
    rows.appendChild(tr);renum();
  }
  function renum(){[...rows.children].forEach((tr,i)=>tr.querySelector('.stt').textContent=i+1);}
  $('#addRow').onclick=()=>{addRow();rows.lastElementChild.querySelector('textarea').focus();};

  function fillSample(){
    rows.innerHTML='';sample.forEach(addRow);addRow();
    $('#unitSel').value='Trường CNTT & Truyền thông';$('#unitTxt').value='Trường CNTT & Truyền thông';
    $('#mName').value=state.user||'';$('#mPhone').value='';$('#mRoom').value='Nhà C1 – P.205';$('#mPrio').selectedIndex=1;
    state.images=[];renderThumbs();updSign();
  }
  $('#unitSel').onchange=e=>{if(e.target.value)$('#unitTxt').value=e.target.value;};
  function updSign(){$('#signName').textContent=$('#mName').value.trim()||' ';}
  $('#mName').addEventListener('input',updSign);
  const d=new Date();$('#today').textContent='Ngày '+d.getDate()+' tháng '+(d.getMonth()+1)+' năm '+d.getFullYear();

  const MAX=6,MAXB=5*1024*1024;
  function addFiles(list){
    const err=[];
    [...list].forEach(f=>{
      if(!f.type.startsWith('image/')){err.push('"'+f.name+'" không phải tệp ảnh.');return;}
      if(f.size>MAXB){err.push('"'+f.name+'" lớn hơn 5 MB.');return;}
      if(state.images.length>=MAX){err.push('Chỉ được tải tối đa '+MAX+' ảnh.');return;}
      const r=new FileReader();r.onload=()=>{state.images.push({name:f.name,url:r.result});renderThumbs();};r.readAsDataURL(f);
    });
    const fe=$('#fileErr');fe.hidden=!err.length;fe.textContent=[...new Set(err)].join(' ');
  }
  function renderThumbs(){
    const t=$('#thumbs');t.innerHTML='';
    state.images.forEach((im,i)=>{const f=document.createElement('figure');f.className='thumb';
      f.innerHTML='<img alt=""><figcaption></figcaption><button type="button" aria-label="Xóa ảnh">×</button>';
      f.querySelector('img').src=im.url;f.querySelector('img').alt=im.name;f.querySelector('figcaption').textContent=im.name;
      f.querySelector('button').onclick=()=>{state.images.splice(i,1);renderThumbs();};t.appendChild(f);});
  }
  $('#fileInp').onchange=e=>{addFiles(e.target.files);e.target.value='';};
  const drop=$('#drop');
  ['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('over');}));
  ['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('over');}));
  drop.addEventListener('drop',e=>addFiles(e.dataTransfer.files));

  $('#resetBtn').onclick=()=>{rows.innerHTML='';addRow();addRow();addRow();
    ['#unitTxt','#mPhone','#mRoom'].forEach(s=>$(s).value='');$('#unitSel').value='';$('#mName').value=state.user||'';$('#mPrio').selectedIndex=0;
    state.images=[];renderThumbs();fillId();updSign();$('#formErr').hidden=true;document.querySelectorAll('.bad').forEach(x=>x.classList.remove('bad'));};

  $('#reqForm').addEventListener('submit',e=>{
    e.preventDefault();
    document.querySelectorAll('#reqForm .bad').forEach(x=>x.classList.remove('bad'));
    const msgs=[];
    const need=[['#unitTxt','tên đơn vị'],['#mName','người đề nghị'],['#mPhone','số điện thoại'],['#mRoom','vị trí'],['#mId','mã số sinh viên / cán bộ']];
    need.forEach(([s,n])=>{if(!$(s).value.trim()){$(s).classList.add('bad');msgs.push(n);}});
    if($('#mPhone').value.trim() && !/^[0-9 +().-]{8,15}$/.test($('#mPhone').value.trim())){$('#mPhone').classList.add('bad');msgs.push('số điện thoại hợp lệ');}
    const items=[...rows.children].map(tr=>[...tr.querySelectorAll('textarea')].map(t=>t.value.trim())).filter(v=>v[0]||v[1]);
    let rowBad=false;
    [...rows.children].forEach(tr=>{const t=tr.querySelectorAll('textarea');if(t[0].value.trim()&&!t[1].value.trim()){t[1].classList.add('bad');rowBad=true;}});
    if(!items.length){rows.querySelector('textarea').classList.add('bad');msgs.push('ít nhất một nội dung cần sửa chữa');}
    if(rowBad) msgs.push('tình trạng hư hỏng cho từng nội dung');
    const fe=$('#formErr');
    if(msgs.length){fe.hidden=false;fe.textContent='Vui lòng bổ sung: '+msgs.join(', ')+'.';fe.scrollIntoView({block:'center',behavior:'smooth'});return;}
    fe.hidden=true;
    const code=newCode();
    saveTicket({code,createdAt:new Date().toISOString(),status:'PENDING',unit:$('#unitTxt').value.trim(),name:$('#mName').value.trim(),mssv:$('#mId').value,phone:$('#mPhone').value.trim(),room:$('#mRoom').value.trim(),prio:$('#mPrio').value,prioLv:$('#mPrio').selectedIndex,
      items:items.map(v=>({content:v[0],damage:v[1],note:v[2]})),images:state.images.map(i=>({name:i.name,url:i.url})),pending:true});
    $('#viewSent').href='#phieu-da-gui/'+encodeURIComponent(code);
    $('#dCode').textContent=code;
    const dl=$('#dList');dl.innerHTML='';
    [['Đơn vị',$('#unitTxt').value],['Người đề nghị',$('#mName').value],['Mã số',$('#mId').value||'—'],['Vị trí',$('#mRoom').value],['Số hạng mục',items.length+' thiết bị'],['Ảnh đính kèm',state.images.length+' ảnh'],['Ưu tiên',$('#mPrio').value]].forEach(([k,v])=>{
      const dt=document.createElement('dt');dt.textContent=k;const dd=document.createElement('dd');dd.textContent=v;dl.append(dt,dd);});
    const dt=document.createElement('dt');dt.textContent='Trạng thái';const dd=document.createElement('dd');dd.innerHTML='<span class="status">Chờ tiếp nhận</span>';dl.append(dt,dd);
    $('#reqForm').hidden=true;$('#done').hidden=false;window.scrollTo(0,0);
  });
  $('#newReq').onclick=()=>{$('#resetBtn').click();$('#done').hidden=true;$('#reqForm').hidden=false;window.scrollTo(0,0);};

  /* ================= PHIẾU ĐÃ GỬI ================= */
  // Phiếu được lưu theo từng tài khoản trong localStorage của trình duyệt (chưa có backend).
  const ST={PENDING:['Chờ tiếp nhận','s-pending'],ASSIGNED:['Đã phân công','s-assigned'],IN_PROGRESS:['Đang xử lý','s-progress'],WAIT_APPROVAL:['Chờ phê duyệt','s-wait'],WAIT_ACCEPT:['Chờ nghiệm thu','s-accept'],FULFILLED:['Hoàn thành','s-done']};
  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pad=n=>String(n).padStart(2,'0');
  const fmtDate=iso=>{const x=new Date(iso);return isNaN(x)?'':pad(x.getDate())+'/'+pad(x.getMonth()+1)+'/'+x.getFullYear();};
  const fmtTime=iso=>{const x=new Date(iso);return isNaN(x)?'':pad(x.getHours())+':'+pad(x.getMinutes());};
  const fold=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase();

  function tkKey(){return 'ts_tickets_all';} // kho phiếu dùng chung cho mọi vai trò (sau này: API)
  function loadTickets(){
    let a=[];try{a=JSON.parse(localStorage.getItem(tkKey())||'[]');}catch(e){}
    state.all=Array.isArray(a)?a:[];
    state.tickets=state.all.filter(t=>state.acc&&t.owner===state.acc.id);
    $('#myCount').textContent=state.tickets.length;
  }
  // Nếu hết dung lượng trình duyệt, bỏ ảnh của phiếu cũ nhất rồi lưu lại.
  function persist(){
    try{localStorage.setItem('__t','1');localStorage.removeItem('__t');}catch(e){return;}
    const list=state.all.filter(t=>!t.pending);
    for(;;){
      try{localStorage.setItem(tkKey(),JSON.stringify(list));return;}
      catch(e){
        const old=list.slice().reverse().find(t=>t.images&&t.images.length);
        if(!old) return;
        old.images=[];old.imgLost=true;
      }
    }
  }
  // Thu nhỏ ảnh trước khi lưu để không vượt dung lượng localStorage.
  function shrink(url,max){
    max=max||900;
    return new Promise(res=>{
      const im=new Image();
      im.onload=()=>{
        const k=Math.min(1,max/Math.max(im.width,im.height));
        const c=document.createElement('canvas');c.width=Math.max(1,Math.round(im.width*k));c.height=Math.max(1,Math.round(im.height*k));
        const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.drawImage(im,0,0,c.width,c.height);
        try{res(c.toDataURL('image/jpeg',.72));}catch(e){res(url);}
      };
      im.onerror=()=>res(url);
      im.src=url;
    });
  }
  function newCode(){
    const y=new Date().getFullYear();let c;
    do{c='YC-'+y+'-'+String(Math.floor(1000+Math.random()*9000));}while(state.all.some(t=>t.code===c));
    return c;
  }
  function saveTicket(t){
    t.owner=state.acc.id;t.log=[{at:new Date().toISOString(),by:state.user,text:'Gửi phiếu yêu cầu'}];
    state.all.unshift(t);state.tickets.unshift(t);$('#myCount').textContent=state.tickets.length;
    Promise.all(t.images.map(i=>shrink(i.url).then(u=>({name:i.name,url:u})))).then(imgs=>{t.images=imgs;delete t.pending;persist();});
  }

  function renderSent(arg){
    $('#sentList').hidden=!!arg;$('#sentDetail').hidden=!arg;
    if(arg) renderDetail(arg); else renderList();
  }

  function rowHtml(t){
    const s=ST[t.status]||ST.PENDING;
    const first=((t.items[0]&&t.items[0].content)||'(Chưa có nội dung)').split('\n')[0];
    return '<a class="tk" href="#phieu-da-gui/'+encodeURIComponent(t.code)+'">'+
      '<span class="tk-code">'+esc(t.code)+'</span>'+
      '<span class="tk-main"><b>'+esc(first)+'</b><small>'+esc(t.room)+', '+t.items.length+' thiết bị</small></span>'+
      '<span class="tk-meta"><span class="tk-date">'+fmtDate(t.createdAt)+'</span><span class="prio p'+(t.prioLv+1)+'">'+esc(String(t.prio).split(' (')[0])+'</span></span>'+
      '<span class="status '+s[1]+'">'+s[0]+'</span></a>';
  }
  function renderList(){
    const all=state.tickets,q=fold(state.q).trim();
    const counts={ALL:all.length};Object.keys(ST).forEach(k=>counts[k]=all.filter(t=>t.status===k).length);
    $('#sentTools').hidden=$('#sentChips').hidden=!all.length;
    $('#sentChips').innerHTML=[['ALL','Tất cả']].concat(Object.keys(ST).map(k=>[k,ST[k][0]])).map(c=>
      '<button type="button" class="chip" data-f="'+c[0]+'" aria-pressed="'+(state.filter===c[0])+'">'+c[1]+'<b>'+counts[c[0]]+'</b></button>').join('');
    $('#sentSummary').textContent=all.length?'Có '+all.length+' phiếu đã gửi từ tài khoản này.':'';
    const rows=all.filter(t=>(state.filter==='ALL'||t.status===state.filter)&&
      (!q||fold([t.code,t.room,t.unit,t.name].concat(t.items.map(i=>i.content+' '+i.damage)).join(' ')).includes(q)));
    const box=$('#sentRows'),em=$('#sentEmpty');
    box.innerHTML=rows.map(rowHtml).join('');box.hidden=!rows.length;em.hidden=!!rows.length;
    if(!rows.length) em.innerHTML=all.length
      ?'<b>Không có phiếu phù hợp.</b><p>Thử đổi bộ lọc hoặc từ khóa tìm kiếm.</p><button class="btn-out" type="button" id="clearF">Xóa bộ lọc</button>'
      :'<b>Bạn chưa gửi phiếu nào.</b><p>Phiếu sau khi gửi sẽ xuất hiện ở đây để bạn theo dõi trạng thái.</p><a class="btn-red" href="#yeu-cau-xu-ly">Tạo phiếu yêu cầu</a>';
  }
  $('#sentQ').addEventListener('input',e=>{state.q=e.target.value;renderList();});
  $('#sentChips').addEventListener('click',e=>{const b=e.target.closest('[data-f]');if(b){state.filter=b.dataset.f;renderList();}});
  $('#sentEmpty').addEventListener('click',e=>{if(e.target.id==='clearF'){state.filter='ALL';state.q='';$('#sentQ').value='';renderList();}});
  document.querySelectorAll('[data-filter]').forEach(a=>a.addEventListener('click',()=>{state.filter=a.dataset.filter;state.q='';$('#sentQ').value='';setTimeout(route,0);}));

  function renderDetail(code){
    const box=$('#sentDetail'),t=state.tickets.find(x=>x.code===code);
    if(!t){box.innerHTML='<div class="empty"><b>Không tìm thấy phiếu '+esc(code)+'.</b><p>Phiếu có thể thuộc tài khoản khác hoặc đã được gửi từ một trình duyệt khác.</p><a class="btn-out" href="#phieu-da-gui" data-filter="ALL">Về danh sách phiếu</a></div>';return;}
    const s=ST[t.status]||ST.PENDING,dt=new Date(t.createdAt);
    const rows=t.items.map((it,i)=>'<tr><td class="stt">'+(i+1)+'</td><td class="txt">'+esc(it.content)+'</td><td class="txt">'+esc(it.damage)+'</td><td class="txt">'+esc(it.note)+'</td></tr>').join('');
    box.innerHTML=
      '<div class="dt-top"><a class="back" href="#phieu-da-gui" data-filter="ALL">‹ Danh sách phiếu</a><span class="code">'+esc(t.code)+'</span><span class="status '+s[1]+'">'+s[0]+'</span><button type="button" class="btn-out" id="printBtn">In phiếu</button></div>'+
      '<article class="sheet">'+
        '<div class="doc-head"><div><b>ĐẠI HỌC BÁCH KHOA HÀ NỘI</b><div class="unit-line">ĐƠN VỊ: <span>'+esc(t.unit)+'</span></div></div>'+
        '<div><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><u><b>Độc lập - Tự do - Hạnh phúc</b></u></div></div>'+
        '<h2 class="doc-title">PHIẾU YÊU CẦU SỬA CHỮA TRANG THIẾT BỊ</h2>'+
        '<p class="doc-to">Kính gửi: Phòng Quản trị và Vật tư - Trang thiết bị</p>'+
        '<h3 class="doc-sec">I. PHẦN ĐỀ NGHỊ CỦA ĐƠN VỊ:</h3>'+
        '<div class="doc-line"><span>Đơn vị</span><b>'+esc(t.unit)+'</b><span>đề nghị được sửa chữa nội dung sau:</span></div>'+
        '<dl class="ro-grid">'+
          '<div><dt>Người đề nghị</dt><dd>'+esc(t.name)+'</dd></div>'+'<div><dt>Mã số</dt><dd>'+esc(t.mssv||'—')+'</dd></div>'+
          '<div><dt>Số điện thoại</dt><dd>'+esc(t.phone)+'</dd></div>'+
          '<div><dt>Vị trí (tòa nhà – phòng)</dt><dd>'+esc(t.room)+'</dd></div>'+
          '<div><dt>Mức độ ưu tiên</dt><dd><span class="prio p'+(t.prioLv+1)+'">'+esc(t.prio)+'</span></dd></div>'+
          '<div><dt>Thời gian gửi</dt><dd>'+fmtTime(t.createdAt)+', '+fmtDate(t.createdAt)+'</dd></div>'+
        '</dl>'+
        '<div class="tbl-wrap"><table class="req"><thead><tr><th>STT</th><th>Nội dung cần sửa chữa</th><th>Tình trạng hư hỏng</th><th>Ghi chú</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
        '<h3 class="doc-sec">II. ẢNH HIỆN TRẠNG THIẾT BỊ:</h3>'+
        (t.images&&t.images.length?'<div class="thumbs" id="dtThumbs"></div>':'<p class="muted">'+(t.imgLost?'Ảnh đính kèm không lưu được trong trình duyệt vì vượt dung lượng cho phép.':'Phiếu này không đính kèm ảnh.')+'</p>')+
        '<div class="sign"><div><b>TRƯỞNG ĐƠN VỊ</b><i>(Ký, ghi rõ họ tên)</i></div>'+
        '<div><i>Ngày '+dt.getDate()+' tháng '+(dt.getMonth()+1)+' năm '+dt.getFullYear()+'</i><b>NGƯỜI ĐỀ NGHỊ</b><i>(Ký, ghi rõ họ tên)</i><div class="nm">'+esc(t.name)+'</div></div></div>'+
      '</article>'+(window.TS?TS.timeline(t):'');
    const th=$('#dtThumbs');
    if(th) t.images.forEach((im,i)=>{
      const f=document.createElement('figure');f.className='thumb';
      f.innerHTML='<button type="button" class="open" aria-label="Xem ảnh lớn"><img alt=""></button><figcaption></figcaption>';
      f.querySelector('img').src=im.url;f.querySelector('img').alt=im.name;f.querySelector('figcaption').textContent=im.name;
      f.querySelector('button').onclick=()=>{$('#lbImg').src=im.url;$('#lbImg').alt=im.name;$('#lb').showModal();};
      th.appendChild(f);
    });
    $('#printBtn').onclick=()=>window.print();
    box.querySelectorAll('[data-filter]').forEach(a=>a.addEventListener('click',()=>{state.filter=a.dataset.filter;state.q='';$('#sentQ').value='';setTimeout(route,0);}));
  }
  $('#lbClose').onclick=()=>$('#lb').close();
  $('#lb').addEventListener('click',e=>{if(e.target===$('#lb'))$('#lb').close();});

  window.TS={$,state,esc,fmtDate,fmtTime,ST,persist,load:()=>{loadTickets();return state.all;}};
  fillSample();
  route();
})();
