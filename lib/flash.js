// Thông báo một lần sau khi gửi form (Post/Redirect/Get): ghi vào phiên, đọc xong thì xóa.
function datFlash(req, khoa, loai, noiDung) {
  req.session[khoa] = { loai, noiDung };
}

function layFlash(req, khoa) {
  const f = req.session[khoa] || null;
  delete req.session[khoa];
  return f;
}

module.exports = { datFlash, layFlash };
