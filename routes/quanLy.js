// Trang của Quản lý (đợt 1: chỉ tiêu đề).
const express = require('express');
const { chiVaiTro } = require('../middleware/auth');

const router = express.Router();
router.use(chiVaiTro('QUAN_LY'));

router.get('/yeu-cau', (req, res) => res.render('trang-tam', { tieuDe: 'Danh sách yêu cầu', maMan: 'Q01' }));
router.get('/phan-cong', (req, res) => res.render('trang-tam', { tieuDe: 'Bảng phân công', maMan: 'Q03' }));
router.get('/co-so-vat-chat', (req, res) => res.render('trang-tam', { tieuDe: 'Danh mục cơ sở vật chất', maMan: 'Q04' }));
router.get('/ky-thuat-vien', (req, res) => res.render('trang-tam', { tieuDe: 'Quản lý kỹ thuật viên', maMan: 'Q05' }));
router.get('/so-tiep-nhan', (req, res) => res.render('trang-tam', { tieuDe: 'Sổ tiếp nhận thông báo sự cố (M.02)', maMan: 'Q06' }));

module.exports = router;
