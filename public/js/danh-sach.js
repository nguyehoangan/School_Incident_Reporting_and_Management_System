// S01: bấm vào một dòng thì mở S03 (liên kết ở cột Mã vẫn dùng được khi không có JS).
(function () {
  document.querySelectorAll('tr[data-href]').forEach(function (tr) {
    tr.addEventListener('click', function (e) {
      if (e.target.closest('a')) return;
      window.location.href = tr.getAttribute('data-href');
    });
  });
})();
