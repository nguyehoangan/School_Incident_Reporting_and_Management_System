// Q02: mở / đóng hộp thoại (Từ chối, Đổi KTV, Nghiệm thu, Làm lại), phóng to ảnh, khóa nút khi đang gửi.
(function () {
  function ganDong(hop) {
    hop.addEventListener('click', function (e) { if (e.target === hop) hop.close(); });
    hop.querySelectorAll('[data-dong]').forEach(function (n) { n.addEventListener('click', function () { hop.close(); }); });
  }
  document.querySelectorAll('dialog.hop-thoai').forEach(ganDong);

  document.querySelectorAll('[data-mo]').forEach(function (nut) {
    nut.addEventListener('click', function () {
      var hop = document.getElementById(nut.getAttribute('data-mo'));
      if (!hop) return;
      hop.showModal();
      var o = hop.querySelector('textarea, input:not([type=hidden]):not([disabled])');
      if (o) o.focus();
    });
  });

  // Server báo lỗi dữ liệu ở một hộp thoại -> mở lại hộp đó, con trỏ tới ô lỗi đầu tiên
  var moSan = document.querySelector('dialog[data-mo-san]');
  if (moSan) {
    moSan.showModal();
    var oLoi = moSan.querySelector('.co-loi textarea, .co-loi input:not([disabled])');
    if (oLoi) oLoi.focus();
  } else {
    var loiDau = document.querySelector('#xu-ly .co-loi input, #xu-ly .co-loi select, #xu-ly .co-loi textarea');
    if (loiDau) loiDau.focus();
  }

  // Tránh gửi 2 lần
  document.querySelectorAll('form[method=post]').forEach(function (f) {
    f.addEventListener('submit', function () {
      setTimeout(function () { f.querySelectorAll('button[type=submit]').forEach(function (b) { b.disabled = true; }); }, 0);
    });
  });

  var hopAnh = document.getElementById('hop-anh');
  var hinh = document.getElementById('hop-anh-hinh');
  if (hopAnh && hinh) {
    document.querySelectorAll('.anh-bam').forEach(function (nut) {
      nut.addEventListener('click', function () {
        hinh.src = nut.getAttribute('data-anh');
        hinh.alt = nut.querySelector('img') ? nut.querySelector('img').alt : '';
        hopAnh.showModal();
      });
    });
  }
})();
