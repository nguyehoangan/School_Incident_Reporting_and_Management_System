// Dùng chung cho Q03, Q04, Q05: bộ lọc tự gửi khi đổi ô chọn, hỏi xác nhận trước thao tác không hoàn tác được.
(function () {
  document.querySelectorAll('form[data-bo-loc] [data-tu-gui]').forEach(function (o) {
    o.addEventListener('change', function () { o.form.submit(); });
  });
  document.addEventListener('submit', function (e) {
    var hoi = e.target.getAttribute && e.target.getAttribute('data-xac-nhan');
    if (hoi && !window.confirm(hoi)) e.preventDefault();
  });
})();
