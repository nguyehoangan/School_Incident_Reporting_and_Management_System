// Kết nối SQLite dùng chung cho cả ứng dụng.
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DUONG_DAN_CSDL = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'csvc.db');

function moCsdl(duongDan = DUONG_DAN_CSDL) {
  fs.mkdirSync(path.dirname(duongDan), { recursive: true });
  const db = new Database(duongDan);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

let ketNoi = null;
function layCsdl() {
  if (!ketNoi) {
    if (!fs.existsSync(DUONG_DAN_CSDL)) {
      throw new Error(`Chưa có CSDL tại ${DUONG_DAN_CSDL}. Hãy chạy "npm run seed" trước.`);
    }
    ketNoi = moCsdl();
  }
  return ketNoi;
}

module.exports = { DUONG_DAN_CSDL, moCsdl, layCsdl };
