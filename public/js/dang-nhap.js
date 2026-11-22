// Nút 👁 hiện / ẩn mật khẩu ở màn M01.
(function () {
  var nut = document.getElementById('nutMat');
  var o = document.getElementById('mat_khau');
  if (!nut || !o) return;
  nut.addEventListener('click', function () {
    var hien = o.type === 'password';
    o.type = hien ? 'text' : 'password';
    nut.setAttribute('aria-pressed', String(hien));
    nut.setAttribute('aria-label', hien ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
    o.focus();
  });
})();
