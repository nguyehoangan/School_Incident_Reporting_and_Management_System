// Trang của Sinh viên (đợt 1: chỉ tiêu đề; nội dung làm ở đợt 2).
const express = require('express');
const { chiVaiTro } = require('../middleware/auth');

const router = express.Router();
router.use(chiVaiTro('SINH_VIEN'));

router.get('/yeu-cau', (req, res) => res.render('trang-tam', { tieuDe: 'Yêu cầu của tôi', maMan: 'S01' }));
router.get('/gui-yeu-cau', (req, res) => res.render('trang-tam', { tieuDe: 'Gửi yêu cầu mới', maMan: 'S02' }));

module.exports = router;
