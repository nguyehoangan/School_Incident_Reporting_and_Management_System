// Trang in biểu mẫu: nút In gọi hộp thoại in của trình duyệt (chọn "Lưu dưới dạng PDF" để ra tệp PDF).
(function () {
  var nut = document.getElementById('nut-in');
  if (nut) nut.addEventListener('click', function () { window.print(); });
})();
