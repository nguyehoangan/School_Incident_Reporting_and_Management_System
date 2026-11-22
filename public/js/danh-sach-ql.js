// Q01: đổi trạng thái / mức độ / ngày thì lọc ngay; đóng hộp chọn nhà khi bấm ra ngoài hoặc Esc.
(function () {
  var form = document.getElementById('form-loc');
  if (!form) return;
  form.querySelectorAll('[data-tu-gui]').forEach(function (o) {
    o.addEventListener('change', function () {
      if (o.type === 'date' && o.value && !/^\d{4}-\d{2}-\d{2}$/.test(o.value)) return;
      form.submit();
    });
  });
  var hop = form.querySelector('.chon-nhieu');
  if (hop) {
    document.addEventListener('click', function (e) { if (hop.open && !hop.contains(e.target)) hop.open = false; });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hop.open = false; });
  }
})();
