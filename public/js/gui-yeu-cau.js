// S02 – Gửi yêu cầu mới: chọn Nhà → Phòng → Thiết bị, kiểm tra ngay trên form, ảnh xem trước,
// cảnh báo trùng, khóa nút khi đang gửi, cửa sổ nổi sau khi gửi. Server kiểm tra lại toàn bộ.
(function () {
  var TRONG = 'Mục này không được để trống';
  var KHAC = 'KHAC';
  var du = JSON.parse(document.getElementById('du-lieu-danh-muc').textContent);
  var dm = du.danhMuc;
  var gh = du.gioiHan;

  var form = document.getElementById('form-yc');
  var oNha = document.getElementById('nha_id');
  var oPhong = document.getElementById('phong_id');
  var oTB = document.getElementById('thiet_bi_id');
  var oLoai = document.getElementById('loai_thiet_bi_id');
  var oMoTa = document.getElementById('mo_ta');
  var oChonAnh = document.getElementById('chon-anh');
  var nutChonAnh = document.getElementById('nut-chon-anh');
  var dsXemTruoc = document.getElementById('xem-truoc');
  var nutGui = document.getElementById('nut-gui');
  var loiChung = document.getElementById('loi-chung');
  var hopTrung = document.getElementById('hop-trung');
  var hopOk = document.getElementById('hop-thanh-cong');

  var anh = []; // { file, url, loi }
  var dangGui = false;

  // ---------- tiện ích
  function tao(ten, thuocTinh, chu) {
    var e = document.createElement(ten);
    Object.keys(thuocTinh || {}).forEach(function (k) { e.setAttribute(k, thuocTinh[k]); });
    if (chu != null) e.textContent = chu;
    return e;
  }
  function napOption(o, dsOpt, chonId) {
    o.innerHTML = '';
    dsOpt.forEach(function (x) { o.appendChild(tao('option', { value: x[0] }, x[1])); });
    o.value = chonId == null ? '' : String(chonId);
  }
  function truongCua(ten) { return form.querySelector('[data-truong="' + ten + '"]'); }
  function hienLoi(ten, noiDung) {
    var t = truongCua(ten);
    var p = document.getElementById('loi-' + ten);
    if (!t || !p) return;
    p.textContent = noiDung || '';
    p.hidden = !noiDung;
    t.classList.toggle('co-loi', !!noiDung);
    t.querySelectorAll('select, textarea, input[type=radio]').forEach(function (c) {
      if (noiDung) c.setAttribute('aria-invalid', 'true'); else c.removeAttribute('aria-invalid');
    });
  }
  function xoaLoi(ten) { hienLoi(ten, ''); }
  function hienLoiChung(noiDung) {
    loiChung.textContent = noiDung || '';
    loiChung.hidden = !noiDung;
  }

  // ---------- Nhà → Phòng → Thiết bị → Loại
  function napNha() {
    napOption(oNha, [['', '-- Chọn nhà --']].concat(dm.nha.map(function (n) { return [n.id, n.ten + ' (' + n.ma + ')']; })));
  }
  function napPhong() {
    var nhaId = Number(oNha.value);
    var nha = dm.nha.filter(function (n) { return n.id === nhaId; })[0];
    var ds = nha ? dm.phong.filter(function (p) { return p.nhaId === nhaId; }) : [];
    napOption(oPhong, [['', nha ? '-- Chọn phòng --' : '-- Chọn nhà trước --']].concat(ds.map(function (p) { return [p.id, nha.ma + '-' + p.ma]; })));
    oPhong.disabled = !nha;
  }
  function napThietBi() {
    var phongId = Number(oPhong.value);
    var ds = phongId ? dm.thietBi.filter(function (t) { return t.phongId === phongId; }) : [];
    var opt = [['', phongId ? '-- Chọn thiết bị --' : '-- Chọn phòng trước --']];
    if (phongId) {
      ds.forEach(function (t) { opt.push([t.id, t.ten + ' – ' + t.ma]); });
      opt.push([KHAC, 'Không có trong danh sách']);
    }
    napOption(oTB, opt);
    oTB.disabled = !phongId;
  }
  function napLoai() {
    var tbId = oTB.value;
    var tb = dm.thietBi.filter(function (t) { return String(t.id) === tbId; })[0];
    if (tb) { // thiết bị cụ thể: tự điền và khóa
      napOption(oLoai, dm.loai.map(function (l) { return [l.id, l.ten]; }), tb.loaiId);
      oLoai.disabled = true;
      xoaLoi('loai_thiet_bi_id');
    } else if (tbId === KHAC) { // bắt chọn tay
      napOption(oLoai, [['', '-- Chọn loại thiết bị --']].concat(dm.loai.map(function (l) { return [l.id, l.ten]; })));
      oLoai.disabled = false;
    } else {
      napOption(oLoai, [['', '']]);
      oLoai.disabled = true;
      xoaLoi('loai_thiet_bi_id');
    }
  }

  oNha.addEventListener('change', function () {
    xoaLoi('nha_id'); xoaLoi('phong_id'); xoaLoi('thiet_bi_id'); xoaLoi('loai_thiet_bi_id');
    napPhong(); napThietBi(); napLoai(); // đổi nhà thì xóa lựa chọn phòng (và thiết bị)
  });
  oPhong.addEventListener('change', function () {
    xoaLoi('phong_id'); xoaLoi('thiet_bi_id'); xoaLoi('loai_thiet_bi_id');
    napThietBi(); napLoai();
  });
  oTB.addEventListener('change', function () { xoaLoi('thiet_bi_id'); xoaLoi('loai_thiet_bi_id'); napLoai(); });
  oLoai.addEventListener('change', function () { xoaLoi('loai_thiet_bi_id'); });
  form.querySelectorAll('input[name=muc_do]').forEach(function (r) { r.addEventListener('change', function () { xoaLoi('muc_do'); }); });
  oMoTa.addEventListener('input', function () {
    document.getElementById('so-ky-tu').textContent = oMoTa.value.length;
    xoaLoi('mo_ta');
  });

  // ---------- Ảnh (1–3 tấm, JPG/PNG, ≤ 5 MB)
  function loiAnh(file) {
    var duoi = (file.name.split('.').pop() || '').toLowerCase();
    var dungLoai = (file.type === 'image/jpeg' || file.type === 'image/png') && ['jpg', 'jpeg', 'png'].indexOf(duoi) >= 0;
    if (!dungLoai) return 'Ảnh "' + file.name + '" không phải JPG hoặc PNG';
    if (file.size > gh.dungLuongToiDa) return 'Ảnh "' + file.name + '" lớn hơn 5 MB';
    return '';
  }
  function veXemTruoc() {
    dsXemTruoc.innerHTML = '';
    anh.forEach(function (a, i) {
      var li = tao('li', { class: 'xem-truoc' + (a.loi ? ' xem-truoc--loi' : '') });
      li.appendChild(tao('img', { src: a.url, alt: 'Xem trước ' + a.file.name }));
      var xoa = tao('button', { type: 'button', class: 'xem-truoc__xoa', 'aria-label': 'Xóa ảnh ' + a.file.name }, '✕');
      xoa.addEventListener('click', function () {
        URL.revokeObjectURL(a.url);
        anh.splice(i, 1);
        xoaLoi('anh');
        veXemTruoc();
      });
      li.appendChild(xoa);
      li.appendChild(tao('span', { class: 'xem-truoc__ten' }, a.file.name));
      if (a.loi) li.appendChild(tao('span', { class: 'xem-truoc__loi' }, a.loi.indexOf('lớn hơn') >= 0 ? 'Lớn hơn 5 MB' : 'Sai định dạng'));
      dsXemTruoc.appendChild(li);
    });
    nutChonAnh.disabled = anh.length >= gh.anhToiDa;
  }
  nutChonAnh.addEventListener('click', function () { oChonAnh.click(); });
  oChonAnh.addEventListener('change', function () {
    var vuot = false;
    Array.prototype.forEach.call(oChonAnh.files, function (f) {
      if (anh.length >= gh.anhToiDa) { vuot = true; return; }
      anh.push({ file: f, url: URL.createObjectURL(f), loi: loiAnh(f) });
    });
    oChonAnh.value = ''; // cho phép chọn lại cùng một tệp
    veXemTruoc();
    var loiDau = anh.filter(function (a) { return a.loi; })[0];
    if (vuot) hienLoi('anh', 'Chỉ được đính kèm tối đa ' + gh.anhToiDa + ' ảnh');
    else if (loiDau) hienLoi('anh', loiDau.loi + '. Hãy xóa ảnh này và chọn ảnh khác.');
    else xoaLoi('anh');
  });

  // ---------- Kiểm tra trước khi gửi
  function kiemTra() {
    var loi = {};
    if (!oNha.value) loi.nha_id = TRONG;
    if (!oPhong.value) loi.phong_id = TRONG;
    if (!oTB.value) loi.thiet_bi_id = TRONG;
    if (oTB.value === KHAC && !oLoai.value) loi.loai_thiet_bi_id = TRONG;
    if (!form.querySelector('input[name=muc_do]:checked')) loi.muc_do = TRONG;
    var moTa = oMoTa.value.trim();
    if (!moTa) loi.mo_ta = TRONG;
    else if (moTa.length < gh.moTaMin) loi.mo_ta = 'Mô tả cần từ ' + gh.moTaMin + ' đến ' + gh.moTaMax + ' ký tự (hiện có ' + moTa.length + ')';
    var anhLoi = anh.filter(function (a) { return a.loi; })[0];
    if (!anh.length) loi.anh = TRONG;
    else if (anhLoi) loi.anh = anhLoi.loi + '. Hãy xóa ảnh này và chọn ảnh khác.';
    return loi;
  }
  var THU_TU = ['nha_id', 'phong_id', 'thiet_bi_id', 'loai_thiet_bi_id', 'muc_do', 'mo_ta', 'anh'];
  function hienTatCaLoi(loi) {
    THU_TU.forEach(function (t) { hienLoi(t, loi[t] || ''); });
    var dau = THU_TU.filter(function (t) { return loi[t]; })[0];
    if (!dau) return;
    var t = truongCua(dau);
    var diem = dau === 'anh' ? document.getElementById('nut-chon-anh')
      : dau === 'muc_do' ? t.querySelector('input[type=radio]')
      : t.querySelector('select, textarea');
    t.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (diem && !diem.disabled) diem.focus({ preventScroll: true }); // con trỏ nhảy đến lỗi đầu tiên
  }

  // ---------- Gửi
  function khoaNut(khoa) {
    dangGui = khoa;
    nutGui.disabled = khoa;
    nutGui.textContent = khoa ? 'Đang gửi…' : 'Gửi yêu cầu';
  }
  function duLieuGui() {
    var fd = new FormData();
    fd.append('nha_id', oNha.value);
    fd.append('phong_id', oPhong.value);
    fd.append('thiet_bi_id', oTB.value);
    fd.append('loai_thiet_bi_id', oLoai.value);
    fd.append('muc_do', form.querySelector('input[name=muc_do]:checked').value);
    fd.append('mo_ta', oMoTa.value.trim());
    anh.forEach(function (a) { fd.append('anh', a.file, a.file.name); });
    return fd;
  }
  function guiLenServer() {
    fetch('/sinh-vien/yeu-cau', { method: 'POST', body: duLieuGui(), headers: { Accept: 'application/json' }, credentials: 'same-origin' })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, trangThai: r.status, json: j }; }); })
      .then(function (kq) {
        if (kq.ok) return hienThanhCong(kq.json);
        if (kq.json && kq.json.loi) { hienTatCaLoi(kq.json.loi); khoaNut(false); return; }
        throw new Error('loi');
      })
      .catch(function () {
        hienLoiChung('Không gửi được yêu cầu. Vui lòng thử lại.');
        khoaNut(false);
      });
  }
  function hienThanhCong(kq) {
    document.getElementById('hop-thanh-cong-noi-dung').textContent =
      'Yêu cầu ' + kq.ma + ' đã được gửi! Bạn có thể theo dõi trạng thái ở mục Yêu cầu của tôi.';
    document.getElementById('nut-xem-yeu-cau').setAttribute('href', kq.duongDan);
    canLamTrong = true;
    hopOk.showModal();
  }
  var canLamTrong = false;
  function lamTrongForm() { // đóng cửa sổ thì form được làm trống (chỉ một lần cho mỗi lần gửi thành công)
    if (!canLamTrong) return;
    canLamTrong = false;
    anh.forEach(function (a) { URL.revokeObjectURL(a.url); });
    anh = [];
    form.reset();
    napPhong(); napThietBi(); napLoai(); veXemTruoc();
    document.getElementById('so-ky-tu').textContent = '0';
    THU_TU.forEach(xoaLoi);
    hienLoiChung('');
    khoaNut(false);
    window.scrollTo({ top: 0 });
  }
  hopOk.addEventListener('close', lamTrongForm);
  function dongThanhCong() { hopOk.close(); lamTrongForm(); }
  document.getElementById('nut-dong-thanh-cong').addEventListener('click', dongThanhCong);
  hopOk.addEventListener('click', function (e) { if (e.target === hopOk) dongThanhCong(); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (dangGui) return;
    hienLoiChung('');
    var loi = kiemTra();
    if (Object.keys(loi).length) { hienTatCaLoi(loi); return; }
    THU_TU.forEach(xoaLoi);
    khoaNut(true); // khóa nút ngay khi bấm, tránh gửi 2 lần

    var q = new URLSearchParams({ thiet_bi_id: oTB.value === KHAC ? '' : oTB.value, phong_id: oPhong.value, loai_thiet_bi_id: oLoai.value });
    fetch('/sinh-vien/gui-yeu-cau/kiem-tra-trung?' + q.toString(), { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : { trung: null }; })
      .catch(function () { return { trung: null }; }) // lỗi kiểm tra trùng không được chặn việc gửi (BR-09)
      .then(function (kq) {
        if (!kq.trung) return guiLenServer();
        document.getElementById('hop-trung-noi-dung').textContent =
          'Thiết bị này đã được báo hỏng (' + kq.trung.ma + ', ' + kq.trung.trangThai + '). Bạn vẫn muốn gửi?';
        hopTrung.showModal();
      });
  });
  document.getElementById('nut-van-gui').addEventListener('click', function () { hopTrung.close('van-gui'); });
  document.getElementById('nut-huy-trung').addEventListener('click', function () { hopTrung.close('huy'); khoaNut(false); });
  hopTrung.addEventListener('close', function () {
    if (hopTrung.returnValue === 'van-gui') guiLenServer();
    else khoaNut(false); // Hủy / Esc: mở khóa để SV sửa hoặc gửi lại
    hopTrung.returnValue = '';
  });

  napNha(); napPhong(); napThietBi(); napLoai(); veXemTruoc();
})();
