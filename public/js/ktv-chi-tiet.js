// K02 – Chi tiết công việc (KTV): chọn kết quả (khắc phục tại chỗ / biên bản M.04), bảng nhiều dòng "Nội dung sửa chữa", ảnh sau sửa có xem trước,
// kiểm tra nhanh trên form, phóng to ảnh, khóa nút khi đang gửi. Server kiểm tra lại toàn bộ.
(function () {
  function dongKhiBamNen(hop) {
    hop.addEventListener('click', function (e) { if (e.target === hop) hop.close(); });
    hop.querySelectorAll('[data-dong]').forEach(function (n) { n.addEventListener('click', function () { hop.close(); }); });
  }
  var hopAnh = document.getElementById('hop-anh');
  var hinh = document.getElementById('hop-anh-hinh');
  if (hopAnh && hinh) {
    dongKhiBamNen(hopAnh);
    document.querySelectorAll('.anh-bam').forEach(function (nut) {
      nut.addEventListener('click', function () {
        hinh.src = nut.getAttribute('data-anh');
        hinh.alt = nut.querySelector('img') ? nut.querySelector('img').alt : '';
        hopAnh.showModal();
      });
    });
  }

  // Tránh gửi 2 lần. Phải đăng ký SAU các hàm kiểm tra của form đó (kiểm tra không đạt thì không khóa nút).
  function khoaKhiGui(f) {
    f.addEventListener('submit', function (e) {
      if (e.defaultPrevented) return;
      setTimeout(function () { f.querySelectorAll('button[type=submit]').forEach(function (b) { b.disabled = true; }); }, 0);
    });
  }
  var form = document.getElementById('form-ket-qua');
  document.querySelectorAll('form[method=post]').forEach(function (f) { if (f !== form) khoaKhiGui(f); });
  if (!form) return;

  var TRONG = 'Mục này không được để trống';
  var tbody = document.getElementById('than-dong');
  var mau = document.getElementById('mau-dong');
  var nutThem = document.getElementById('nut-them-dong');
  var loiDong = document.getElementById('loi-dong');
  var oAnh = document.getElementById('chon-anh');
  var dsXemTruoc = document.getElementById('xem-truoc');
  var loiAnh = document.getElementById('loi-anh');
  var toiDaAnh = Number(form.getAttribute('data-anh-toi-da'));
  var toiDaDungLuong = Number(form.getAttribute('data-dung-luong'));

  // ---------- Bảng nhiều dòng (ít nhất 1 dòng)
  function dongHienCo() { return Array.prototype.slice.call(tbody.querySelectorAll('tr')); }
  function danhLaiSo() {
    var ds = dongHienCo();
    ds.forEach(function (tr, i) {
      tr.querySelector('.so-stt').textContent = i + 1;
      tr.querySelectorAll('input').forEach(function (o) { o.name = o.name.replace(/^dong\[[^\]]*\]/, 'dong[' + i + ']'); });
      tr.querySelector('.nut-xoa-dong').disabled = ds.length === 1;
    });
  }
  function xoaLoiDong(tr) {
    tr.querySelectorAll('.loi-truong').forEach(function (p) { p.remove(); });
    tr.querySelectorAll('[aria-invalid]').forEach(function (o) { o.removeAttribute('aria-invalid'); });
  }
  function themDong(focus) {
    var tr = mau.content.firstElementChild.cloneNode(true);
    tbody.appendChild(tr);
    danhLaiSo();
    if (focus) tr.querySelector('input').focus();
  }
  nutThem.addEventListener('click', function () { themDong(true); });
  tbody.addEventListener('click', function (e) {
    var nut = e.target.closest('.nut-xoa-dong');
    if (!nut || dongHienCo().length === 1) return;
    nut.closest('tr').remove();
    danhLaiSo();
  });
  tbody.addEventListener('input', function (e) {
    var td = e.target.closest('td');
    if (td) { td.querySelectorAll('.loi-truong').forEach(function (p) { p.remove(); }); }
    e.target.removeAttribute('aria-invalid');
    ganLoiDong('');
  });
  function ganLoiDong(noiDung) {
    loiDong.textContent = noiDung;
    loiDong.hidden = !noiDung;
    document.getElementById('truong-dong').classList.toggle('co-loi', !!noiDung);
  }
  function loiO(o, noiDung) {
    o.setAttribute('aria-invalid', 'true');
    var p = document.createElement('p');
    p.className = 'loi-truong';
    p.textContent = noiDung;
    o.parentNode.appendChild(p);
  }
  danhLaiSo();

  // ---------- Ảnh sau sửa (0–3 tấm, JPG/PNG, ≤ 5 MB), kiểm tra như ảnh của SV
  var chon = []; // { file, url }
  function ganLoiAnh(noiDung) {
    loiAnh.textContent = noiDung || '';
    loiAnh.hidden = !noiDung;
    document.getElementById('truong-anh').classList.toggle('co-loi', !!noiDung);
  }
  function loiTepAnh(file) {
    var duoi = (file.name.split('.').pop() || '').toLowerCase();
    var dung = (file.type === 'image/jpeg' || file.type === 'image/png') && ['jpg', 'jpeg', 'png'].indexOf(duoi) >= 0;
    if (!dung) return 'Ảnh "' + file.name + '" không phải JPG hoặc PNG';
    if (file.size > toiDaDungLuong) return 'Ảnh "' + file.name + '" lớn hơn 5 MB';
    return '';
  }
  function dongBoInput() {
    var dt = new DataTransfer();
    chon.forEach(function (c) { dt.items.add(c.file); });
    oAnh.files = dt.files;
  }
  function veAnh() {
    dsXemTruoc.innerHTML = '';
    chon.forEach(function (c, i) {
      var li = document.createElement('li');
      li.className = 'xem-truoc';
      var img = document.createElement('img');
      img.src = c.url;
      img.alt = 'Ảnh sau sửa ' + (i + 1);
      var xoa = document.createElement('button');
      xoa.type = 'button';
      xoa.className = 'xem-truoc__xoa';
      xoa.setAttribute('aria-label', 'Xóa ảnh ' + (i + 1));
      xoa.textContent = '✕';
      xoa.addEventListener('click', function () {
        URL.revokeObjectURL(c.url);
        chon.splice(i, 1);
        dongBoInput(); veAnh(); ganLoiAnh('');
      });
      li.appendChild(img);
      li.appendChild(xoa);
      dsXemTruoc.appendChild(li);
    });
    if (chon.length < toiDaAnh) {
      var them = document.createElement('li');
      var nut = document.createElement('button');
      nut.type = 'button';
      nut.className = 'o-them-anh';
      nut.setAttribute('aria-label', 'Thêm ảnh sau sửa');
      nut.textContent = '+';
      nut.addEventListener('click', function () { oAnh.click(); });
      them.appendChild(nut);
      dsXemTruoc.appendChild(them);
    }
  }
  oAnh.addEventListener('change', function () {
    var loi = '';
    Array.prototype.slice.call(oAnh.files).forEach(function (f) {
      var l = loiTepAnh(f);
      if (l) loi = loi || l;
      else if (chon.length >= toiDaAnh) loi = loi || 'Chỉ được đính kèm tối đa ' + toiDaAnh + ' ảnh';
      else chon.push({ file: f, url: URL.createObjectURL(f) });
    });
    dongBoInput(); veAnh(); ganLoiAnh(loi);
  });
  veAnh();

  // ---------- Hai nhánh kết quả: "Đã khắc phục tại chỗ" (phần II M.01) / "Không khắc phục tại chỗ" (biên bản M.04)
  var nhanh = form.querySelectorAll('.nhanh-ket-qua');
  function ketQuaChon() {
    var r = form.querySelector('input[name=ket_qua]:checked');
    return r ? r.value : '';
  }
  function hienNhanh() {
    var kq = ketQuaChon();
    nhanh.forEach(function (n) { n.hidden = n.getAttribute('data-nhanh') !== kq; });
  }
  form.querySelectorAll('input[name=ket_qua]').forEach(function (r) { r.addEventListener('change', hienNhanh); });
  hienNhanh();

  // Biện pháp đề nghị: gõ chi tiết thì tự đánh dấu biện pháp đó
  var loiDeXuat = document.getElementById('loi-de-xuat');
  function ganLoiDeXuat(noiDung) {
    loiDeXuat.textContent = noiDung;
    loiDeXuat.hidden = !noiDung;
    document.getElementById('truong-de-xuat').classList.toggle('co-loi', !!noiDung);
  }
  form.querySelectorAll('.bien-phap').forEach(function (d) {
    var o = d.querySelector('input[type=checkbox]');
    d.querySelector('.bien-phap__chi-tiet').addEventListener('input', function (e) {
      if (e.target.value.trim()) o.checked = true;
      ganLoiDeXuat('');
    });
    o.addEventListener('change', function () { ganLoiDeXuat(''); });
  });
  // Ô bắt buộc của biên bản: gõ vào thì xóa lỗi của ô đó
  function loiTextarea(o, noiDung) {
    var p = o.parentNode.querySelector('.loi-truong');
    p.textContent = noiDung;
    p.hidden = !noiDung;
    o.parentNode.classList.toggle('co-loi', !!noiDung);
    if (noiDung) o.setAttribute('aria-invalid', 'true'); else o.removeAttribute('aria-invalid');
  }
  var oTinhTrang = document.getElementById('bb-tinh-trang');
  var oNguyenNhan = document.getElementById('bb-nguyen-nhan');
  [oTinhTrang, oNguyenNhan].forEach(function (o) { o.addEventListener('input', function () { loiTextarea(o, ''); }); });

  function kiemTraBienBan() {
    var dau = null;
    [oTinhTrang, oNguyenNhan].forEach(function (o) {
      var trong = !o.value.trim();
      loiTextarea(o, trong ? TRONG : '');
      if (trong) dau = dau || o;
    });
    var coBienPhap = form.querySelectorAll('.bien-phap input[type=checkbox]:checked').length > 0;
    ganLoiDeXuat(coBienPhap ? '' : 'Chọn ít nhất 1 biện pháp đề nghị');
    if (!coBienPhap) dau = dau || form.querySelector('.bien-phap input[type=checkbox]');
    return dau;
  }

  // ---------- Kiểm tra khi gửi
  form.addEventListener('submit', function (e) {
    if (ketQuaChon() === 'KHONG_KHAC_PHUC') {
      var loiBB = kiemTraBienBan();
      if (loiBB) { e.preventDefault(); loiBB.focus(); }
      return;
    }
    var viTriLoi = null;
    var coDong = false;
    dongHienCo().forEach(function (tr) {
      xoaLoiDong(tr);
      var o = tr.querySelectorAll('input');
      var noiDung = o[0].value.trim();
      var sl = o[1].value.trim();
      var ghiChu = o[2].value.trim();
      if (!noiDung && !sl && !ghiChu) return; // dòng trống được bỏ qua
      if (!noiDung) { loiO(o[0], TRONG); viTriLoi = viTriLoi || o[0]; } else coDong = true;
      if (sl && !/^[1-9]\d*$/.test(sl)) { loiO(o[1], 'Số lượng phải là số nguyên dương'); viTriLoi = viTriLoi || o[1]; }
    });
    if (!coDong && !viTriLoi) {
      ganLoiDong('Cần ít nhất 1 dòng nội dung sửa chữa');
      viTriLoi = tbody.querySelector('input');
    }
    if (viTriLoi) { e.preventDefault(); viTriLoi.focus(); }
  });

  khoaKhiGui(form);

  // Đầu trang báo lỗi từ server: đưa con trỏ tới ô lỗi đầu tiên
  var loiServer = form.querySelector('[aria-invalid]');
  if (loiServer) loiServer.focus();
})();
