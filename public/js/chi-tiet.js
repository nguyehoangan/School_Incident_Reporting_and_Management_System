// S03: phóng to ảnh và hộp xác nhận hủy yêu cầu.
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

  var nutHuy = document.getElementById('nut-huy');
  var hopHuy = document.getElementById('hop-huy');
  if (nutHuy && hopHuy) {
    dongKhiBamNen(hopHuy);
    nutHuy.addEventListener('click', function () { hopHuy.showModal(); });
  }
})();
