/* Giao diện Admin + Thợ sửa. Dùng chung kho phiếu của app.js qua window.TS.
   Luồng: PENDING → (admin phân công) ASSIGNED → (thợ kiểm tra) IN_PROGRESS
   → khắc phục tại chỗ: WAIT_ACCEPT | không tại chỗ: WAIT_APPROVAL → (BGH duyệt) IN_PROGRESS(thực hiện) → WAIT_ACCEPT
   → (nghiệm thu) FULFILLED → (TCKT) thanh toán, lưu hồ sơ. Không đồng ý / không đạt: quay lại IN_PROGRESS. */
(function(){
  const T=window.TS,$=T.$,esc=T.esc,S=T.state,A=window.ACCOUNTS,ST=T.ST;
  const F={f:'ALL',q:''};let cur='';
  const isTech=()=>S.acc.role==='tech';
  const can=k=>S.acc.role==='admin'&&(S.acc.duty||[]).includes(k);
  const money=n=>Number(n||0).toLocaleString('vi-VN')+' đ';
  const nameOf=id=>(A.find(a=>a.id===id)||{}).name||'—';
  const val=id=>(($('#'+id)||{}).value||'').trim();
  const fold=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase();
  const mine=()=>T.load().filter(t=>!isTech()||t.assignee===S.acc.id);
  const needsMe=t=>isTech()?(t.status==='ASSIGNED'||t.status==='IN_PROGRESS'):
    (t.status==='PENDING'&&can('assign'))||(t.status==='WAIT_APPROVAL'&&can('approve'))||(t.status==='WAIT_ACCEPT'&&can('accept'))||(t.status==='FULFILLED'&&!t.paid&&t.plan&&+t.plan.cost>0&&can('pay'));
  const step=(t,st,text)=>{t.status=st;(t.log=t.log||[]).push({at:new Date().toISOString(),by:S.user,text,st:st});T.persist();};

  T.timeline=t=>'<section class="tl"><h3>Tiến trình xử lý</h3><ol>'+(t.log||[]).slice().reverse().map(l=>
    '<li><b>'+esc(l.text)+'</b><small>'+T.fmtTime(l.at)+' '+T.fmtDate(l.at)+' · '+esc(l.by)+'</small></li>').join('')+'</ol></section>';

  const row=t=>{const s=ST[t.status]||ST.PENDING;
    return '<a class="tk" href="#st-tickets/'+encodeURIComponent(t.code)+'"><span class="tk-code">'+esc(t.code)+'</span>'+
    '<span class="tk-main"><b>'+esc(((t.items[0]||{}).content||'').split('\n')[0])+'</b><small>'+esc(t.room)+' · '+esc(t.unit)+' · '+esc(t.name)+(t.assignee?' · Thợ: '+esc(nameOf(t.assignee)):'')+'</small></span>'+
    '<span class="tk-meta"><span class="tk-date">'+T.fmtDate(t.createdAt)+'</span><span class="prio p'+(t.prioLv+1)+'">'+esc(String(t.prio).split(' (')[0])+'</span></span>'+
    '<span class="status '+s[1]+'">'+s[0]+'</span></a>';};
  const sorted=L=>L.slice().sort((a,b)=>b.prioLv-a.prioLv||(a.createdAt<b.createdAt?1:-1));

  function home(){
    const L=mine();
    $('#stTitle').textContent=isTech()?'Việc của tôi':'Tổng quan quản trị';
    $('#stSub').textContent=S.acc.name+' · '+S.acc.title+(S.acc.unit?' – '+S.acc.unit:'');
    $('#stStats').innerHTML=Object.keys(ST).map(k=>'<a class="stat" href="#st-tickets/'+k+'"><b>'+L.filter(t=>t.status===k).length+'</b><span>'+ST[k][0]+'</span></a>').join('');
    const todo=sorted(L.filter(needsMe));
    $('#stTodo').innerHTML=todo.map(row).join('');$('#stTodo').hidden=!todo.length;$('#stTodoEmpty').hidden=!!todo.length;
  }

  function list(){
    const L=mine(),q=fold(F.q);
    $('#stChips').innerHTML=[['ALL','Tất cả']].concat(Object.keys(ST).map(k=>[k,ST[k][0]])).map(c=>
      '<button type="button" class="chip" data-f="'+c[0]+'" aria-pressed="'+(F.f===c[0])+'">'+c[1]+'<b>'+(c[0]==='ALL'?L.length:L.filter(t=>t.status===c[0]).length)+'</b></button>').join('');
    const R=sorted(L.filter(t=>(F.f==='ALL'||t.status===F.f)&&(!q||fold([t.code,t.room,t.unit,t.name].concat(t.items.map(i=>i.content)).join(' ')).includes(q))));
    $('#stRows').innerHTML=R.map(row).join('');$('#stRows').hidden=!R.length;$('#stEmpty').hidden=!!R.length;
    $('#stSummary').textContent=L.length+' phiếu'+(isTech()?' được giao cho bạn':' trong hệ thống');
  }
  $('#stQ').addEventListener('input',e=>{F.q=e.target.value;list();});
  $('#stChips').addEventListener('click',e=>{const b=e.target.closest('[data-f]');if(b){F.f=b.dataset.f;list();}});

  function actions(t){
    let h='';const s=t.status,p=t.plan;
    const note=(ph)=>'<label class="fld"><span>Ghi chú / lý do</span><textarea class="inp" id="fNote" rows="2" placeholder="'+ph+'"></textarea></label>';
    if(s==='PENDING'&&can('assign')){
      h='<h3>Tiếp nhận &amp; phân công thợ</h3><label class="fld"><span>Thợ phụ trách</span><select class="inp" id="fTech">'+
        A.filter(a=>a.role==='tech').map(a=>'<option value="'+a.id+'">'+esc(a.name)+' – '+esc(a.title)+' ('+T.load().filter(x=>x.assignee===a.id&&x.status!=='FULFILLED').length+' việc)</option>').join('')+'</select></label>'+note('Dặn dò thợ (nếu có)')+
        '<button class="btn-red" data-act="assign">Tiếp nhận &amp; phân công</button>';
    }else if(s==='ASSIGNED'&&isTech()&&t.assignee===S.acc.id){
      h='<h3>Bắt đầu xử lý</h3><p class="muted">Liên hệ người đề nghị ('+esc(t.phone)+') trước khi đến.</p><button class="btn-red" data-act="start">Bắt đầu kiểm tra</button>';
    }else if(s==='IN_PROGRESS'&&isTech()&&t.assignee===S.acc.id){
      if(t.planNote) h+='<div class="form-err">Phương án chưa được phê duyệt / nghiệm thu chưa đạt: '+esc(t.planNote)+'</div>';
      if(t.stage==='execute') h+='<h3>Thực hiện kế hoạch đã duyệt</h3>'+note('Công việc đã làm, vật tư đã dùng')+'<button class="btn-red" data-act="fixed">Báo hoàn thành, đề nghị nghiệm thu</button>';
      else h+='<h3>Kết quả kiểm tra</h3><details class="opt"><summary>Khắc phục tại chỗ</summary>'+note('Mô tả công việc đã làm')+'<button class="btn-red" data-act="fixed">Báo đã khắc phục</button></details>'+
        '<details class="opt"><summary>Không khắc phục tại chỗ – đề xuất phương án</summary>'+
        '<label class="fld"><span>Nguyên nhân hư hỏng</span><textarea class="inp" id="pCause" rows="2"></textarea></label>'+
        '<label class="fld"><span>Phương án xử lý, vật tư / dịch vụ</span><textarea class="inp" id="pSol" rows="2"></textarea></label>'+
        '<div class="meta-grid"><label class="fld"><span>Chi phí dự kiến (VNĐ)</span><input class="inp" id="pCost" type="number" min="0" value="0"></label>'+
        '<label class="fld"><span>Số báo giá đã thu thập (tối thiểu 3 nếu có chi phí)</span><input class="inp" id="pQuotes" type="number" min="0" value="0"></label></div>'+
        '<button class="btn-red" data-act="plan">Trình phương án</button></details>';
    }else if(s==='WAIT_APPROVAL'&&can('approve')){
      h='<h3>Phê duyệt phương án</h3>'+note('Bắt buộc nếu không đồng ý')+'<div class="act-row"><button class="btn-red" data-act="approve">Đồng ý</button><button class="btn-out" data-act="reject">Không đồng ý</button></div>';
    }else if(s==='WAIT_ACCEPT'&&can('accept')){
      h='<h3>Nghiệm thu, bàn giao</h3>'+note('Bắt buộc nếu chưa đạt')+'<div class="act-row"><button class="btn-red" data-act="ok">Đạt – nghiệm thu</button><button class="btn-out" data-act="fail">Chưa đạt</button></div>';
    }else if(s==='FULFILLED'&&!t.paid&&p&&+p.cost>0&&can('pay')){
      h='<h3>Thanh toán, lưu hồ sơ</h3><p class="muted">Chi phí '+money(p.cost)+'.</p><button class="btn-red" data-act="pay">Xác nhận đã thanh toán &amp; lưu hồ sơ</button>';
    }
    return h?'<section class="panel">'+h+'<div class="form-err" id="stMsg" hidden></div></section>':'';
  }

  function detail(code){
    cur=code;const t=mine().find(x=>x.code===code),box=$('#stDetail');
    if(!t){box.innerHTML='<div class="empty"><b>Không tìm thấy phiếu '+esc(code)+'.</b><a class="btn-out" href="#st-tickets/ALL">Về danh sách</a></div>';return;}
    const s=ST[t.status]||ST.PENDING,p=t.plan;
    box.innerHTML='<div class="dt-top"><a class="back" href="#st-tickets/ALL">‹ Danh sách phiếu</a><span class="code">'+esc(t.code)+'</span><span class="status '+s[1]+'">'+s[0]+'</span></div>'+
     '<div class="st-grid"><div><article class="sheet"><dl class="ro-grid">'+
     [['Đơn vị',t.unit],['Người đề nghị',t.name+' – '+t.phone],['Mã số SV / cán bộ',t.mssv||'—'],['Vị trí',t.room],['Ưu tiên',t.prio],['Gửi lúc',T.fmtTime(t.createdAt)+', '+T.fmtDate(t.createdAt)],['Thợ phụ trách',t.assignee?nameOf(t.assignee):'Chưa phân công']].map(x=>'<div><dt>'+x[0]+'</dt><dd>'+esc(x[1])+'</dd></div>').join('')+'</dl>'+
     '<div class="tbl-wrap"><table class="req"><thead><tr><th>STT</th><th>Nội dung</th><th>Tình trạng</th><th>Ghi chú</th></tr></thead><tbody>'+
     t.items.map((i,n)=>'<tr><td class="stt">'+(n+1)+'</td><td class="txt">'+esc(i.content)+'</td><td class="txt">'+esc(i.damage)+'</td><td class="txt">'+esc(i.note)+'</td></tr>').join('')+'</tbody></table></div>'+
     (t.images&&t.images.length?'<div class="thumbs">'+t.images.map(i=>'<figure class="thumb"><img alt="'+esc(i.name)+'" src="'+esc(i.url)+'"></figure>').join('')+'</div>':'')+
     (p?'<h3 class="doc-sec">Phương án đề xuất</h3><dl class="ro-grid"><div><dt>Nguyên nhân</dt><dd>'+esc(p.cause)+'</dd></div><div><dt>Phương án</dt><dd>'+esc(p.solution)+'</dd></div><div><dt>Chi phí dự kiến</dt><dd>'+money(p.cost)+' ('+p.quotes+' báo giá)</dd></div></dl>':'')+
     '</article></div><div>'+actions(t)+T.timeline(t)+'</div></div>';
  }

  $('#stDetail').addEventListener('click',e=>{
    const b=e.target.closest('[data-act]');if(!b)return;
    const t=T.load().find(x=>x.code===cur),a=b.dataset.act,msg=m=>{const x=$('#stMsg');x.textContent=m;x.hidden=false;};
    if(!t)return;
    if(a==='assign'){t.assignee=val('fTech');step(t,'ASSIGNED','Tiếp nhận, phân công cho '+nameOf(t.assignee)+(val('fNote')?'. '+val('fNote'):''));}
    else if(a==='start'){t.stage='inspect';step(t,'IN_PROGRESS','Bắt đầu kiểm tra, xác định sự cố');}
    else if(a==='fixed'){if(!val('fNote'))return msg('Vui lòng mô tả công việc đã làm.');t.planNote='';step(t,'WAIT_ACCEPT',(t.stage==='execute'?'Hoàn thành thực hiện kế hoạch: ':'Đã khắc phục tại chỗ: ')+val('fNote'));}
    else if(a==='plan'){
      const c=+val('pCost')||0,q=+val('pQuotes')||0;
      if(!val('pCause')||!val('pSol'))return msg('Vui lòng nhập nguyên nhân và phương án.');
      if(c>0&&q<3)return msg('Chi phí phát sinh cần tối thiểu 03 báo giá.');
      t.plan={cause:val('pCause'),solution:val('pSol'),cost:c,quotes:q};t.planNote='';step(t,'WAIT_APPROVAL','Không khắc phục tại chỗ, trình phương án chờ phê duyệt');}
    else if(a==='approve'){t.stage='execute';t.planOk=true;t.planNote='';step(t,'IN_PROGRESS','Ban Giám hiệu phê duyệt phương án. Thợ thực hiện kế hoạch');}
    else if(a==='reject'){if(!val('fNote'))return msg('Vui lòng nhập lý do không đồng ý.');t.stage='inspect';t.planNote=val('fNote');step(t,'IN_PROGRESS','Không đồng ý phương án: '+val('fNote'));}
    else if(a==='ok'){step(t,'FULFILLED','Nghiệm thu, bàn giao đạt'+(val('fNote')?': '+val('fNote'):''));if(!(t.plan&&+t.plan.cost>0)){t.paid=true;}T.persist();}
    else if(a==='fail'){if(!val('fNote'))return msg('Vui lòng nhập lý do chưa đạt.');t.stage=t.planOk?'execute':'inspect';t.planNote=val('fNote');step(t,'IN_PROGRESS','Nghiệm thu chưa đạt: '+val('fNote'));}
    else if(a==='pay'){t.paid=true;step(t,'FULFILLED','Xác nhận thanh toán, kết thúc, lưu hồ sơ');}
    detail(cur);
  });

  T.onRoute=(h,arg)=>{
    if(h==='st-home')home();
    if(h==='st-tickets'){
      const isF=!arg||arg==='ALL'||arg in ST;
      $('#stList').hidden=!isF;$('#stDetail').hidden=isF;
      if(isF){F.f=arg||'ALL';list();}else detail(arg);
    }
  };
})();
