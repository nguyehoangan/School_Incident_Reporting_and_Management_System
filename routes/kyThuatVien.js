// Trang của Kỹ thuật viên (đợt 1: chỉ tiêu đề).
const express = require('express');
const { chiVaiTro } = require('../middleware/auth');

const router = express.Router();
router.use(chiVaiTro('KY_THUAT_VIEN'));

router.get('/viec', (req, res) => res.render('trang-tam', { tieuDe: 'Việc được giao', maMan: 'K01' }));

module.exports = router;
