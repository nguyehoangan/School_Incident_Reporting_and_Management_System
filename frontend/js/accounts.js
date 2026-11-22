/* Tài khoản do trường cấp (DEMO). Khi có backend: bỏ file này, dùng POST /api/login trả về {id,name,role,title,unit,duty}.
   role: 'user' (sinh viên / giáo viên không liên quan) | 'admin' (P.QT&VT, BGH, P.TCKT...) | 'tech' (thợ sửa)
   duty (chỉ admin): assign = tiếp nhận & phân công, accept = nghiệm thu, approve = phê duyệt, pay = thanh toán & lưu hồ sơ */
window.ACCOUNTS=[
 {id:'sv01',email:'sv01@sis.hust.edu.vn',pass:'123456',name:'Nguyễn Văn A',mssv:'20230001',role:'user',title:'Sinh viên',unit:'Trường CNTT & Truyền thông'},
 {id:'gv01',email:'gv01@hust.edu.vn',pass:'123456',name:'TS. Phạm Văn D',mssv:'GV0001',role:'user',title:'Giảng viên',unit:'Trường Điện – Điện tử'},
 {id:'qtvt01',email:'qtvt01@hust.edu.vn',pass:'123456',name:'Trần Thị B',role:'admin',duty:['assign','accept'],title:'Cán bộ P.QT&VT'},
 {id:'bgh01',email:'bgh01@hust.edu.vn',pass:'123456',name:'PGS. Hoàng Văn E',role:'admin',duty:['approve'],title:'Ban Giám hiệu'},
 {id:'tckt01',email:'tckt01@hust.edu.vn',pass:'123456',name:'Vũ Thị F',role:'admin',duty:['pay'],title:'Phòng TCKT'},
 {id:'tho01',email:'tho01@hust.edu.vn',pass:'123456',name:'Lê Văn C',role:'tech',title:'Thợ điện lạnh'},
 {id:'tho02',email:'tho02@hust.edu.vn',pass:'123456',name:'Đỗ Minh G',role:'tech',title:'Thợ điện – mạng'}
];
