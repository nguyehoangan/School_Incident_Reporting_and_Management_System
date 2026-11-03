(function(){
  const $=s=>document.querySelector(s);
  const state={user:null,images:[],submitted:0};
  try{const u=sessionStorage.getItem('ts_user'); if(u) state.user=u;}catch(e){}

  const views={splash:$('#splash'),login:$('#login'),shell:$('#shell')};
  const pages={home:$('#home'),'yeu-cau-xu-ly':$('#yeu-cau-xu-ly')};
  function route(){
    let h=(location.hash||'#splash').slice(1);
    if(!(h in views)&&!(h in pages)) h='splash';
    if(h in pages && !state.user) h='login';
    Object.values(views).forEach(v=>v.hidden=true);
    if(h in pages){
      views.shell.hidden=false;
      Object.entries(pages).forEach(([k,p])=>p.hidden=k!==h);
      $('#supportItem').classList.toggle('active',h==='yeu-cau-xu-ly');
      closeMenus();
    } else views[h].hidden=false;
    window.scrollTo(0,0);
  }
  window.addEventListener('hashchange',route);

  function login(name){
    state.user=name;try{sessionStorage.setItem('ts_user',name);}catch(e){}
    $('#avName').textContent=name;$('#avInit').textContent=name.trim().charAt(0).toUpperCase()||'A';
    location.hash='#home';
  }
  $('#loginForm').addEventListener('submit',e=>{
    e.preventDefault();
    const u=$('#lgUser'),p=$('#lgPass');let ok=true;
    [[u,'#lgUserErr'],[p,'#lgPassErr']].forEach(([el,er])=>{const b=!el.value.trim();el.classList.toggle('bad',b);$(er).hidden=!b;if(b)ok=false;});
    if(ok){p.value='';login(u.value.trim());}
  });
  $('#ssoBtn').addEventListener('click',()=>login('Nguyễn Văn A'));
  $('#forgot').addEventListener('click',e=>{e.preventDefault();$('#lgNote').textContent='Liên hệ Phòng Quản trị (024 3869 2008) để được cấp lại mật khẩu.';});
  $('#logout').addEventListener('click',()=>{state.user=null;try{sessionStorage.removeItem('ts_user');}catch(e){}location.hash='#login';});
  if(state.user){$('#avName').textContent=state.user;$('#avInit').textContent=state.user.charAt(0).toUpperCase();}

  function closeMenus(){document.querySelectorAll('.menu>li.open').forEach(l=>l.classList.remove('open'));$('#avMenu').hidden=true;$('#menu').classList.remove('show');$('#burger').setAttribute('aria-expanded','false');}
  document.querySelectorAll('.menu>li>button').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const li=b.parentElement,o=li.classList.contains('open');document.querySelectorAll('.menu>li.open').forEach(l=>l.classList.remove('open'));if(!o)li.classList.add('open');}));
  $('#burger').addEventListener('click',e=>{e.stopPropagation();const m=$('#menu').classList.toggle('show');$('#burger').setAttribute('aria-expanded',m);});
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
    state.images=[];renderThumbs();updSign();$('#formErr').hidden=true;document.querySelectorAll('.bad').forEach(x=>x.classList.remove('bad'));};

  $('#reqForm').addEventListener('submit',e=>{
    e.preventDefault();
    document.querySelectorAll('#reqForm .bad').forEach(x=>x.classList.remove('bad'));
    const msgs=[];
    const need=[['#unitTxt','tên đơn vị'],['#mName','người đề nghị'],['#mPhone','số điện thoại'],['#mRoom','vị trí']];
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
    state.submitted++;$('#myCount').textContent=state.submitted;
    const code='YC-'+d.getFullYear()+'-'+String(Math.floor(1000+Math.random()*9000));
    $('#dCode').textContent=code;
    const dl=$('#dList');dl.innerHTML='';
    [['Đơn vị',$('#unitTxt').value],['Người đề nghị',$('#mName').value],['Vị trí',$('#mRoom').value],['Số hạng mục',items.length+' thiết bị'],['Ảnh đính kèm',state.images.length+' ảnh'],['Ưu tiên',$('#mPrio').value]].forEach(([k,v])=>{
      const dt=document.createElement('dt');dt.textContent=k;const dd=document.createElement('dd');dd.textContent=v;dl.append(dt,dd);});
    const dt=document.createElement('dt');dt.textContent='Trạng thái';const dd=document.createElement('dd');dd.innerHTML='<span class="status">Chờ tiếp nhận</span>';dl.append(dt,dd);
    $('#reqForm').hidden=true;$('#done').hidden=false;window.scrollTo(0,0);
  });
  $('#newReq').onclick=()=>{$('#resetBtn').click();$('#done').hidden=true;$('#reqForm').hidden=false;window.scrollTo(0,0);};

  fillSample();
  route();
})();
