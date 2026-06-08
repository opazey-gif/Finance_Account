// ==========================================
// SPREADSHEET IDs (SECURE CONFIGURATION)
// ==========================================
// โปรดเก็บ ID ไว้ในฟังก์ชัน getConfig() เพื่อป้องกันการรั่วไหล
// ใช้ PropertiesService เพื่อจัดเก็บอย่างปลอดภัยจากการแชร์โค้ด

// ✅ NOTE: ระบบสิทธิ์ผู้ใช้งานใหม่ (Role-Based Access Control)
// - ฐานข้อมูลผู้ใช้ย้ายไปที่ User_DB (USER_ID) แล้ว
// - ใช้ฟังก์ชัน: getUserProfile() ดึงข้อมูลสมบูรณ์ของผู้ใช้
// - ใช้ฟังก์ชัน: isAdmin() / isDriver() เช็คสิทธิ์ผู้ใช้
// - ใช้ฟังก์ชัน: getUsersByRole(role) ดึงรายชื่อผู้ใช้ตามบทบาท
// - ฟังก์ชัน logAudit() บันทึก Log พร้อมบทบาท (role)
// - เก่า: getUserRole() ถูกลบออกแล้ว (ข้ามไป User_DB แทน)

function getConfig() {
  var scriptProperties = PropertiesService.getScriptProperties();
  
  // ถ้ายังไม่ได้ตั้งค่า ให้ใช้ค่า default (แต่ควรเปลี่ยนเป็นการตั้งค่าผ่านหน้าสกริปต์)
  return {
    SHEET_ID: scriptProperties.getProperty('SHEET_ID') || '1nONRu5o1AMcyK60O7sda0ez_22mEEwPJI4XvuNJ_9xw',
    USER_ID: scriptProperties.getProperty('USER_ID') || '1lxwrh9gkKpOmHkVtfmPjEX973BcEYOZZOnFDSDDkbKM',
    PM_DB_ID: scriptProperties.getProperty('PM_DB_ID') || '1TZ9a2_LXtwjc38VkVUbbWh7yMgsSuHLPQNhcN7CpzfY',
    EQ_DB_ID: scriptProperties.getProperty('EQ_DB_ID') || '13eQVAxgAuZOmZ-MzMMUjMKvDvi-RUHdbrYPp3ZrZPpU',
    CM_EQ_ID: scriptProperties.getProperty('CM_EQ_ID') || '1BlAvm2HzQd9WF66N_noUJcAPJCyXhJ5zOXOWCcLMqi8',
    INF_DB_ID: scriptProperties.getProperty('INF_DB_ID') || '1ok1-0AP5B91P1CWhWTKq5-iftN2qsljnPFzbaDe28CQ',
    FN_DB_ID: scriptProperties.getProperty('FN_DB_ID') || '1eD_g3MOChXCGF40Bu8ynjXqABskRBqmaPH5xNpTW0sM',
    DR_DB_ID: scriptProperties.getProperty('DR_DB_ID') || '11A7br6lhlQhxZviF8L0wy7cpzEfa26qCvZ9BC4SCVa4',
    AC_DB_ID: scriptProperties.getProperty('AC_DB_ID') || '1rx8aZQ04K4OkGm-uuVazvv5Gurq5UTBF61_G4fifCG8'
  };
}

var CONFIG = getConfig();
var SHEET_ID = CONFIG.SHEET_ID;
var USER_ID = CONFIG.USER_ID;
var PM_DB_ID = CONFIG.PM_DB_ID;
var EQ_DB_ID = CONFIG.EQ_DB_ID;
var CM_EQ_ID = CONFIG.CM_EQ_ID;
var INF_DB_ID = CONFIG.INF_DB_ID;
var FN_DB_ID = CONFIG.FN_DB_ID;
var DR_DB_ID = CONFIG.DR_DB_ID;
var AC_DB_ID = CONFIG.AC_DB_ID;
var SS = getFinanceDatabase(); // Finance Database Spreadsheet Object
var SS_AC = SpreadsheetApp.openById(AC_DB_ID); // Accounting Database (Tabeankum Module)

// ==========================================
// ✅ ระบบจัดการสิทธิ์ผู้ใช้งาน (User Profile & Authorization)
// ==========================================

// ── PAGE ACCESS MAP ─────────────────────────────────────────────
// กำหนดสิทธิ์ขั้นต่ำของแต่ละหน้า  (ถ้าหน้าไม่อยู่ใน map → default admin)
var PAGE_ACCESS = {
  // ── Admin only ──────────────────────────────────────────────────
  'van_admin'                   : ['admin'],
  'van_admin_summary'           : ['admin'],
  'finace_dashboard'            : ['admin'],
  'finace_accounting'           : ['admin'],
  'travel_dashboard'            : ['admin'],
  'durable_add_member'          : ['admin'],
  'durable_add_equipment'       : ['admin'],
  'user_management'             : ['admin'],   // 🛡️ จัดการบัญชีผู้ใช้
  // ── Admin + Assistant ───────────────────────────────────────────
  'durable_user_management'     : ['admin', 'assistant'],
  'accounting_dashboard'        : ['admin', 'assistant'],
  'durable_equipment_management': ['admin', 'assistant'],
  // ── Admin + Driver ──────────────────────────────────────────────
  'van_driver'                  : ['admin', 'driver'],
  // ── All registered ──────────────────────────────────────────────
  'main'                        : ['admin', 'assistant', 'driver', 'user'],
  'pm_dashboard'                : ['admin', 'assistant', 'user'],
  'pm_repair'                   : ['admin', 'assistant', 'driver', 'user'],
  'infirmary_dashboard'         : ['admin', 'assistant', 'user'],
  'infirmary_form'              : ['admin', 'assistant', 'driver', 'user'],
  'durable_dashboard'           : ['admin', 'assistant', 'driver', 'user'],
  'durable_item'                : ['admin', 'assistant', 'user'],
  'durable_claims'              : ['admin', 'assistant', 'driver', 'user'],
  'durable_bulk_claim'          : ['admin', 'assistant', 'user'],
  'claims'                      : ['admin', 'assistant', 'driver', 'user'],
  'form'                        : ['admin', 'assistant', 'driver', 'user']
};

var ALL_REGISTERED_ROLES = ['admin', 'assistant', 'driver', 'user'];

/**
 * requireRole() — Guard หลักของระบบ ตรวจสิทธิ์ฝั่ง Server ทุกครั้ง
 * @param {string|string[]} allowedRoles
 * @param {string} [callerName]
 * @throws {Error} ถ้าไม่มีสิทธิ์
 * @returns {Object} profile ของผู้ใช้ที่ผ่านการตรวจ
 */
function requireRole(allowedRoles, callerName) {
  var profile    = getUserProfile();
  var role       = (profile.role || 'unauthorized').toLowerCase().trim();
  var caller     = callerName || 'unknown';
  var allowed    = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  var allowedLow = allowed.map(function(r) { return r.toLowerCase().trim(); });

  if (allowedLow.indexOf(role) === -1) {
    try {
      logAudit(
        'UNAUTHORIZED_ACCESS',
        '"' + profile.email + '" (role:' + role + ') tried "' + caller +
        '" — requires [' + allowed.join(', ') + ']',
        'WARNING'
      );
    } catch (e) { /* ไม่บล็อก throw ถ้า log ล้มเหลว */ }
    throw new Error(
      '\uD83D\uDD12 ไม่มีสิทธิ์ใช้งาน: "' + caller + '"' +
      ' ต้องการสิทธิ์ [' + allowed.join(', ') + ']' +
      ' (สิทธิ์ของคุณ: ' + role + ')'
    );
  }
  return profile;
}

/**
 * requireAccess() — ตรวจว่าลงทะเบียนแล้ว (ไม่ใช่ unauthorized)
 * @param {string} [callerName]
 * @returns {Object} profile
 */
function requireAccess(callerName) {
  return requireRole(ALL_REGISTERED_ROLES, callerName || 'requireAccess');
}

/** HTML หน้า block สำหรับ doGet (internal) */
function _buildUnauthorizedHtml(profile) {
  var email = (profile && profile.email) ? profile.email : 'ไม่ทราบ';
  return '<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>ไม่มีสิทธิ์เข้าถึง</title>'
    + '<link href="https://fonts.googleapis.com/css2?family=Prompt:wght@400;600;700&display=swap" rel="stylesheet">'
    + '<style>*{font-family:Prompt,sans-serif;margin:0;padding:0;box-sizing:border-box}'
    + 'body{background:#0f172a;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}'
    + '.card{background:#1e293b;border-radius:24px;padding:40px;max-width:480px;width:100%;'
    + 'text-align:center;border:1px solid #334155;box-shadow:0 25px 50px rgba(0,0,0,.5)}'
    + '.icon{font-size:72px;margin-bottom:16px}.title{color:#ef4444;font-size:24px;font-weight:700;margin-bottom:8px}'
    + '.sub{color:#94a3b8;font-size:14px;line-height:1.6;margin-bottom:20px}'
    + '.box{background:#0f172a;border:1px dashed #475569;border-radius:12px;padding:12px 18px;margin-bottom:24px}'
    + '.lbl{color:#64748b;font-size:11px;text-transform:uppercase;font-weight:600;display:block;margin-bottom:4px}'
    + '.val{color:#f97316;font-size:15px;word-break:break-all;font-weight:600}'
    + '.note{color:#64748b;font-size:12px}</style></head><body>'
    + '<div class="card"><div class="icon">🔒</div>'
    + '<div class="title">ไม่มีสิทธิ์เข้าใช้งานระบบ</div>'
    + '<div class="sub">อีเมลของคุณยังไม่ได้รับสิทธิ์เข้าถึงหน้านี้<br>กรุณาติดต่อแอดมินผู้ดูแลระบบ</div>'
    + '<div class="box"><span class="lbl">อีเมลของคุณ</span>'
    + '<strong class="val">' + email + '</strong></div>'
    + '<div class="note">ติดต่อแผนก IT หรือแอดมินเพื่อขอสิทธิ์เข้าใช้งาน</div>'
    + '</div></body></html>';
}

// ================================================================
// ✅ ระบบจัดการสิทธิ์ผู้ใช้งาน v5 (Schema-Matched: User_DB__3_)
// Sheet "User" ใน USER_ID  —  คอลัมน์: Email | Name | Department | Role | Sub-Role
// ไม่มี id / Status / createdAt column (รองรับถ้าเพิ่มทีหลัง)
// ================================================================

var _USER_CACHE_TTL   = 300;
var _USER_SHEET_NAMES = ['User', 'User_DB'];  // ค้นตามลำดับนี้

// ── Default column index ตาม schema จริง (fallback) ─────────────
var _DEFAULT_COL = { email:0, name:1, department:2, role:3, subRole:4,
                     id:-1, status:-1, createdAt:-1 };

/**
 * _openUserSheet() — เปิด Sheet ผู้ใช้, สร้างใหม่ถ้าไม่พบ
 */
function _openUserSheet() {
  var config = getConfig();
  var ss     = SpreadsheetApp.openById(config.USER_ID);
  for (var i = 0; i < _USER_SHEET_NAMES.length; i++) {
    var s = ss.getSheetByName(_USER_SHEET_NAMES[i]);
    if (s) return { ss: ss, sheet: s, sheetName: _USER_SHEET_NAMES[i] };
  }
  // สร้างใหม่ตาม schema จริง
  var ns = ss.insertSheet('User');
  ns.appendRow(['Email','Name','Department','Role','Sub-Role']);
  ns.getRange(1,1,1,5).setFontWeight('bold').setBackground('#f8fafc');
  ns.setFrozenRows(1);
  console.warn('_openUserSheet: สร้าง Sheet "User" ใหม่แล้ว');
  return { ss: ss, sheet: ns, sheetName: 'User' };
}

/**
 * _parseUserHeaders() — Header row → index map (EN/TH, case-insensitive)
 */
function _parseUserHeaders(headers) {
  var idx = JSON.parse(JSON.stringify(_DEFAULT_COL));
  var MAP = {
    id        : ['id'],
    email     : ['email','อีเมล','อีเมล์'],
    name      : ['name','ชื่อ','ชื่อ-นามสกุล','ชื่อนามสกุล'],
    department: ['department','dept','แผนก','ฝ่าย'],
    role      : ['role','บทบาท','สิทธิ์','สิทธิ์การใช้งาน'],
    subRole   : ['sub-role','subrole','sub_role','บทบาทรอง'],
    status    : ['status','สถานะ'],
    createdAt : ['createdat','created_at','วันที่เพิ่ม']
  };
  headers.forEach(function(h, i) {
    var lower = (h||'').toString().toLowerCase().trim().replace(/[\s\-_]/g,'');
    Object.keys(MAP).forEach(function(field) {
      if (idx[field] === -1) {
        var keys = MAP[field].map(function(k){ return k.replace(/[\s\-_]/g,''); });
        if (keys.indexOf(lower) !== -1) idx[field] = i;
      }
    });
  });
  return idx;
}

/**
 * _rowToProfile() — แถวข้อมูล + idx → profile object
 */
function _rowToProfile(row, idx, emailOverride) {
  var email  = emailOverride || (idx.email > -1 ? (row[idx.email]||'') : '').toString().toLowerCase().trim();
  var role   = (idx.role   > -1 ? (row[idx.role]  ||'user') : 'user').toString().toLowerCase().trim();
  var status = idx.status  > -1 ? (row[idx.status]||'active').toString().toLowerCase().trim() : 'active';
  return {
    id        : idx.id         > -1 ? (row[idx.id]        ||email).toString().trim() : email,
    email     : email,
    name      : idx.name       > -1 ? (row[idx.name]      ||'').toString().trim()    : '',
    department: idx.department > -1 ? (row[idx.department]||'').toString().trim()    : '',
    role      : role,
    subRole   : idx.subRole    > -1 ? (row[idx.subRole]   ||'').toString().toLowerCase().trim() : '',
    status    : status
  };
}

function _unauthorizedProfile(email, name) {
  return { id: email||'', email: email||'', name: name||'Guest',
           department:'', role:'unauthorized', subRole:'', status:'inactive' };
}
function _cacheAndReturn(cache, key, profile) {
  try { cache.put(key, JSON.stringify(profile), _USER_CACHE_TTL); } catch(e) {}
  return profile;
}

/**
 * invalidateUserCache() — flush หลัง add/update/delete
 */
function invalidateUserCache(email) {
  try {
    CacheService.getUserCache().remove('up_v5_' + (email||'').toLowerCase());
    var sc = CacheService.getScriptCache();
    ['all','admin','assistant','driver','user'].forEach(function(r) {
      sc.remove('usersByRole_' + r);
    });
  } catch(e) { console.warn('invalidateUserCache: ' + e); }
}

/**
 * ✅ getUserProfile() v5 — ดึงโปรไฟล์พร้อม Cache 5 นาที
 * ใช้ Email เป็น Primary Key (ไม่มี id column)
 * @returns {{ id, email, name, department, role, subRole, status }}
 */
function getUserProfile() {
  try {
    var email = (Session.getActiveUser().getEmail() || '').trim().toLowerCase();
    if (!email) {
      console.error('getUserProfile: ดึง email ไม่ได้');
      return _unauthorizedProfile('');
    }

    var cache    = CacheService.getUserCache();
    var cacheKey = 'up_v5_' + email;
    var cached   = cache.get(cacheKey);
    if (cached) { try { return JSON.parse(cached); } catch(e) {} }

    var ref  = _openUserSheet();
    var data = ref.sheet.getDataRange().getValues();
    if (data.length <= 1) {
      console.warn('getUserProfile: Sheet "' + ref.sheetName + '" ว่างเปล่า');
      return _cacheAndReturn(cache, cacheKey, _unauthorizedProfile(email));
    }

    var idx = _parseUserHeaders(data[0]);

    for (var i = 1; i < data.length; i++) {
      var rowEmail = (idx.email > -1 ? data[i][idx.email] : '').toString().trim().toLowerCase();
      if (rowEmail !== email) continue;

      var profile = _rowToProfile(data[i], idx, email);

      // 🔒 บล็อก inactive (เฉพาะถ้า Sheet มี Status column จริง)
      if (idx.status > -1 && profile.status === 'inactive') {
        console.warn('getUserProfile: ' + email + ' inactive → ปฏิเสธ');
        try { logAudit('INACTIVE_USER_BLOCKED', email, 'WARNING'); } catch(e) {}
        var blocked = _unauthorizedProfile(email, profile.name);
        blocked.status = 'inactive';
        return _cacheAndReturn(cache, cacheKey, blocked);
      }
      return _cacheAndReturn(cache, cacheKey, profile);
    }

    console.warn('getUserProfile: ไม่พบ ' + email + ' ใน "' + ref.sheetName + '"');
    try { logAudit('UNKNOWN_USER', email + ' ไม่พบในฐานข้อมูล', 'WARNING'); } catch(e) {}
    return _cacheAndReturn(cache, cacheKey, _unauthorizedProfile(email));

  } catch (error) {
    console.error('getUserProfile ERROR: ' + error.toString());
    return _unauthorizedProfile('');
  }
}

/**
 * ✅ isAdmin() — ตรวจสิทธิ์ Admin
 */
function isAdmin() {
  return getUserProfile().role === 'admin';
}

/**
 * ✅ isDriver() — admin ก็ใช้งาน driver ได้ด้วย
 */
function isDriver() {
  var r = getUserProfile().role;
  return r === 'driver' || r === 'admin';
}

/**
 * ✅ hasRole(roles) — ตรวจสิทธิ์หลายบทบาทพร้อมกัน
 * @param {string|string[]} roles
 */
function hasRole(roles) {
  var r       = getUserProfile().role;
  var allowed = Array.isArray(roles) ? roles : [roles];
  return allowed.map(function(x){ return x.toLowerCase(); }).indexOf(r) !== -1;
}

/**
 * ✅ getUsersByRole() — ดึงรายชื่อตามบทบาท พร้อม Cache 5 นาที
 */
function getUsersByRole(role) {
  try {
    var sc       = CacheService.getScriptCache();
    var cacheKey = 'usersByRole_' + (role || 'all');
    var cached   = sc.get(cacheKey);
    if (cached) { try { return JSON.parse(cached); } catch(e) {} }

    var ref  = _openUserSheet();
    var data = ref.sheet.getDataRange().getValues();
    if (data.length <= 1) return [];

    var idx    = _parseUserHeaders(data[0]);
    var result = [];
    for (var i = 1; i < data.length; i++) {
      var rowEmail = (idx.email > -1 ? data[i][idx.email] : '').toString().trim();
      if (!rowEmail) continue;
      var p = _rowToProfile(data[i], idx, rowEmail.toLowerCase());
      if (role === 'all' || p.role === (role||'').toLowerCase()) {
        result.push({ email: p.email, name: p.name, department: p.department,
                      role: p.role, subRole: p.subRole });
      }
    }
    try { sc.put(cacheKey, JSON.stringify(result), _USER_CACHE_TTL); } catch(e) {}
    return result;
  } catch (error) {
    console.error('getUsersByRole ERROR: ' + error.toString());
    return [];
  }
}

// ==========================================
// ✅ ฟังก์ชันล้าง Cache ที่สำคัญ
// ==========================================
/**
 * ฟังก์ชันสำหรับล้าง Cache ของ Dashboard ทั้งหมด
 * เรียกใช้ทุกครั้งที่มีการ เขียน/แก้ไข/ลบ ข้อมูลใน Sheets
 */
function clearAllDashboardCache() {
  try {
    var cache = CacheService.getScriptCache();
    var cacheKeys = [
      'dashboard_summary',
      'dashboard_data_v1',
      'inventory_stats',
      // User caches
      'usersByRole_all', 'usersByRole_admin', 'usersByRole_assistant',
      'usersByRole_driver', 'usersByRole_user'
    ];
    cache.removeAll(cacheKeys);
    console.log('🧹 Cache cleared: ' + cacheKeys.join(', '));
  } catch (e) {
    console.error('⚠️ ไม่สามารถล้าง Cache ได้: ' + e.toString());
  }
}

// ================================================================
// ✅ User CRUD  (สำหรับหน้า user_management — Admin only)
// ================================================================

/**
 * getUsers() — ดึงรายชื่อผู้ใช้ทั้งหมด
 */
function getUsers() {
  requireRole(['admin'], 'getUsers');
  var ref  = _openUserSheet();
  var data = ref.sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var idx = _parseUserHeaders(data[0]);
  return data.slice(1)
    .filter(function(row) {
      return idx.email > -1 && (row[idx.email]||'').toString().trim();
    })
    .map(function(row) {
      var email = (row[idx.email]||'').toString().toLowerCase().trim();
      var p     = _rowToProfile(row, idx, email);
      if (idx.createdAt > -1 && row[idx.createdAt]) {
        try { p.createdAt = new Date(row[idx.createdAt]).toISOString(); } catch(e) {}
      }
      return p;
    });
}

/**
 * addUser(payload) — เพิ่มผู้ใช้ใหม่
 * @param {{ name, email, role, status, department, subRole }} payload
 */
function addUser(payload) {
  requireRole(['admin'], 'addUser');
  var ref         = _openUserSheet();
  var data        = ref.sheet.getDataRange().getValues();
  var idx         = _parseUserHeaders(data[0]);
  var targetEmail = (payload.email||'').toLowerCase().trim();
  if (!targetEmail) return { success: false, message: 'กรุณาระบุ Email' };

  // ตรวจซ้ำ
  var dup = data.slice(1).some(function(r) {
    return (r[idx.email > -1 ? idx.email : 0]||'').toString().toLowerCase().trim() === targetEmail;
  });
  if (dup) return { success: false, message: 'อีเมล "' + targetEmail + '" มีอยู่ในระบบแล้ว' };

  // สร้างแถวตาม Header จริง
  var headers = data[0];
  var newRow  = new Array(headers.length).fill('');
  var vals    = {};
  vals[idx.email]      = targetEmail;
  vals[idx.name]       = (payload.name||'').trim();
  vals[idx.department] = (payload.department||'').trim();
  vals[idx.role]       = (payload.role||'user').toLowerCase().trim();
  if (idx.subRole   > -1) vals[idx.subRole]   = (payload.subRole||'').trim();
  if (idx.status    > -1) vals[idx.status]    = payload.status||'active';
  if (idx.createdAt > -1) vals[idx.createdAt] = new Date();

  Object.keys(vals).forEach(function(i) {
    if (parseInt(i) > -1) newRow[parseInt(i)] = vals[i];
  });

  ref.sheet.appendRow(newRow);
  invalidateUserCache(targetEmail);
  try { logAudit('ADD_USER', targetEmail + ' role:' + (payload.role||'user'), 'INFO'); } catch(e) {}
  return { success: true, id: targetEmail };
}

/**
 * updateUser(payload) — แก้ไขข้อมูลผู้ใช้ (ค้นหาด้วย id = original email)
 * @param {{ id, name, email, role, status, department, subRole }} payload
 */
function updateUser(payload) {
  requireRole(['admin'], 'updateUser');
  var lookupEmail = ((payload.id||payload.email)||'').toLowerCase().trim();
  if (!lookupEmail) return { success: false, message: 'กรุณาระบุ Email ที่ต้องการแก้ไข' };

  var ref  = _openUserSheet();
  var data = ref.sheet.getDataRange().getValues();
  var idx  = _parseUserHeaders(data[0]);

  for (var i = 1; i < data.length; i++) {
    var rowEmail = (idx.email > -1 ? data[i][idx.email] : '').toString().toLowerCase().trim();
    if (rowEmail !== lookupEmail) continue;

    var sheetRow = i + 1;
    var updates  = {
      name      : payload.name,
      email     : payload.email ? payload.email.toLowerCase().trim() : undefined,
      department: payload.department,
      role      : payload.role ? payload.role.toLowerCase().trim() : undefined,
      subRole   : payload.subRole,
      status    : payload.status
    };
    Object.keys(updates).forEach(function(field) {
      if (updates[field] === undefined || updates[field] === null) return;
      var ci = idx[field];
      if (ci > -1) ref.sheet.getRange(sheetRow, ci + 1).setValue(updates[field]);
    });

    var updatedEmail = updates.email || rowEmail;
    invalidateUserCache(updatedEmail);
    if (rowEmail !== updatedEmail) invalidateUserCache(rowEmail);
    try { logAudit('UPDATE_USER', updatedEmail, 'INFO'); } catch(e) {}
    return { success: true };
  }
  return { success: false, message: 'ไม่พบผู้ใช้ "' + lookupEmail + '" ในระบบ' };
}

/**
 * deleteUser(id) — ลบผู้ใช้ (id = email)
 */
function deleteUser(id) {
  requireRole(['admin'], 'deleteUser');
  var callerEmail = (Session.getActiveUser().getEmail()||'').toLowerCase().trim();
  var targetEmail = (id||'').toLowerCase().trim();
  if (!targetEmail) return { success: false, message: 'กรุณาระบุ Email ที่ต้องการลบ' };
  if (targetEmail === callerEmail) return { success: false, message: 'ไม่สามารถลบบัญชีของตัวเองได้' };

  var ref  = _openUserSheet();
  var data = ref.sheet.getDataRange().getValues();
  var idx  = _parseUserHeaders(data[0]);

  for (var i = 1; i < data.length; i++) {
    var rowEmail = (idx.email > -1 ? data[i][idx.email] : '').toString().toLowerCase().trim();
    if (rowEmail !== targetEmail) continue;

    // ป้องกันลบ admin คนสุดท้าย
    var userRole = idx.role > -1 ? (data[i][idx.role]||'').toString().toLowerCase().trim() : '';
    if (userRole === 'admin') {
      var adminCount = data.slice(1).filter(function(r) {
        return (r[idx.role > -1 ? idx.role : 3]||'').toString().toLowerCase().trim() === 'admin';
      }).length;
      if (adminCount <= 1) return { success: false, message: 'ไม่สามารถลบแอดมินคนสุดท้ายได้' };
    }

    ref.sheet.deleteRow(i + 1);
    invalidateUserCache(targetEmail);
    try { logAudit('DELETE_USER', targetEmail, 'WARNING'); } catch(e) {}
    return { success: true };
  }
  return { success: false, message: 'ไม่พบผู้ใช้ "' + targetEmail + '" ในระบบ' };
}

// ==========================================
// ฟังก์ชันจัดการหน้าเว็บ (Router / ตัวสลับหน้า)
// ==========================================
function doGet(e) {
  var page    = (e && e.parameter && e.parameter.page) ? e.parameter.page : 'main';
  var profile = getUserProfile();
  var role    = (profile.role || 'unauthorized').toLowerCase();
  var allowed = PAGE_ACCESS[page] || ['admin'];

  // 🔐 ตรวจสิทธิ์ก่อน serve HTML — ถ้าไม่ผ่านส่งหน้า block แทน
  if (allowed.indexOf(role) === -1) {
    return HtmlService
      .createHtmlOutput(_buildUnauthorizedHtml(profile))
      .setTitle('ไม่มีสิทธิ์เข้าใช้งาน')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  var fileName = '';
  var title = '';

  // กำหนดไฟล์และชื่อหน้า
  if (page === 'form') {
    fileName = 'claims';
    title = 'ยื่นคำขอเบิกค่าเดินทาง';
  } else if (page === 'pm_dashboard') {
    fileName = 'pm_dashboard';
    title = 'ระบบจัดการงานซ่อมบำรุง (PM)';
  } else if (page === 'travel_dashboard') {
    fileName = 'travel_dashboard';
    title = 'แดชบอร์ดและการอนุมัติ';
  } else if (page === 'pm_repair') {
    fileName = 'pm_repair';
    title = 'แจ้งซ่อมด่วน';
  } else if (page === 'van_admin') {
    fileName = 'van_admin';
    title = 'จ่ายงานรถตู้ (Admin)';
  } else if (page === 'van_admin_summary') {
    fileName = 'van_admin_summary';
    title = 'สรุปการทำงานของ Van Admin';
  } else if (page === 'van_driver') {
    fileName = 'van_driver';
    title = 'ระบบคนขับรถ';
  } else if (page === 'infirmary_form') {
    fileName = 'infirmary_form';
    title = 'บันทึกการเข้าใช้ห้องพยาบาล';
  } else if (page === 'infirmary_dashboard') {
    fileName = 'infirmary_dashboard';
    title = 'แดชบอร์ดห้องพยาบาล';
  } else if (page === 'durable_dashboard') {
    fileName = 'durable_dashboard';
    title = 'Dashboard จัดการวัสดุและครุภัณฑ์';
  } else if (page === 'durable_item') {
    fileName = 'durable_item';
    title = 'กรอกข้อมูลวัสดุคงคลัง';
  } else if (page === 'durable_claims') {
    fileName = 'durable_claims';
    title = 'คำขอเบิกวัสดุ';
  } else if (page === 'finance_dashboard' || page === 'finace_dashboard') {
    fileName = 'finace_dashboard';
    title = 'Finance Dashboard - ระบบจัดการรายรับ-รายจ่าย';
  } else if (page === 'durable_add_member') {
    fileName = 'durable_add_member';
    title = 'ระบบเพิ่มสมาชิก';
  } else if (page === 'durable_user_management') {
    fileName = 'durable_user_management';
    title = 'ระบบจัดการสมาชิก';
  } else if (page === 'durable_add_equipment') {
    fileName = 'durable_add_equipment';
    title = 'เพิ่มครุภัณฑ์';
  } else if (page === 'durable_bulk_claim') {
    fileName = 'durable_bulk_claim';
    title = 'เบิกครุภัณฑ์';
  } else if (page === 'accounting_dashboard') {
    fileName = 'accounting_dashboard';
    title = 'แดชบอร์ดบัญชี';
  } else if (page === 'durable_equipment_management') {
    fileName = 'durable_equipment_management';
    title = 'ระบบจัดการครุภัณฑ์';
  } else if (page === 'user_management') {
    fileName = 'user_management';
    title = 'จัดการบัญชีผู้ใช้';
  } else {
    fileName = 'main';
    title = 'หน้าหลัก - ระบบจัดการ';
  }

  var template = HtmlService.createTemplateFromFile(fileName);
  if (page === 'dashboard') {
    template.initialData = JSON.stringify(getDashboardData());
  } else {
    template.initialData = JSON.stringify(null);
  }

  return template.evaluate()
      .setTitle(title)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function loadHtmlPage(page) {
  // 🔐 ตรวจสิทธิ์ก่อน serve — ถ้าไม่ผ่านจะ throw error กลับ client ทันที
  var allowed = PAGE_ACCESS[page] || ['admin'];
  requireRole(allowed, 'loadHtmlPage:' + page);

  // Whitelist ป้องกัน path traversal
  var whitelist = Object.keys(PAGE_ACCESS);
  if (whitelist.indexOf(page) === -1) {
    throw new Error('ไม่พบหน้าที่ร้องขอ: ' + page);
  }

  // ✅ ใช้ Template เพื่อให้โหลดไฟล์ย่อย (include) ติดมาด้วยได้
  return HtmlService.createTemplateFromFile(page).evaluate().getContent();
}

// ฟังก์ชันสำหรับหา URL ของตัวเอง (ป้องกันลิงก์ตาย)
function getScriptURL() {
  return ScriptApp.getService().getUrl();
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ฟังก์ชันดึง Spreadsheet แบบปลอดภัย
function getSpreadsheet() {
  try {
    return SpreadsheetApp.openById(SHEET_ID);
  } catch (e) {
    console.error("ไม่สามารถเปิด Spreadsheet ได้: " + e.toString());
    return null;
  }
}

// ฟังก์ชันดึง Spreadsheet อันที่ 2 แบบปลอดภัย
function getSecondDatabase() {
  try {
    return SpreadsheetApp.openById(SECOND_DB_ID);
  } catch (e) {
    console.error("ไม่สามารถเปิด Database ที่ 2 ได้: " + e.toString());
    return null;
  }
}

// ตัวอย่างฟังก์ชันดึงข้อมูลจาก DB ตัวที่ 2
function getSomeDataFromDB2() {
  var ss2 = getSecondDatabase(); // เรียกใช้ DB ตัวที่ 2
  
  if (!ss2) return "ไม่สามารถเชื่อมต่อฐานข้อมูลได้";

  var sheet = ss2.getSheetByName('ชื่อTabที่ต้องการ'); // เปลี่ยนชื่อ Tab ตามจริง
  
  if (!sheet) return "ไม่พบ Sheet นี้ในฐานข้อมูลที่ 2";

  var data = sheet.getDataRange().getValues();
  // ... เขียนโค้ดจัดการข้อมูลต่อไปเหมือนเดิม ...
  
  return data;
}

function loadPage(page) {
  // 🔐 รวม logic ไว้ที่ loadHtmlPage — ตรวจสิทธิ์และ whitelist เดียวกัน
  return loadHtmlPage(page);
}

function getVanStatus() {
  // หน้า UI คาดหวัง array ที่มี object ที่มี property "status"
  // อนาคตสามารถเขียนโค้ดดึงข้อมูลจากไฟล์ DB_Clamis_VanJobs.xlsx (ชีต VanJobs) ได้
  return []; 
}

function getPMSchedule() {
  // หน้า UI คาดหวัง array ของงานแจ้งซ่อม/บำรุงรักษา
  return [];
}

function getPendingClaims() {
  // หน้า UI คาดหวัง array ของรายการเบิกจ่าย 
  // อนาคตสามารถเขียนดึงข้อมูลจากชีต Claims ที่มี Status เป็น Pending ได้
  return [];
}

// ==========================================
// ส่วนระบบงานซ่อมบำรุงอาคาร (Preventive Maintenance)
// ==========================================

// ฟังก์ชันดึง Spreadsheet งาน PM แบบปลอดภัย
function getPMDatabase() {
  try {
    return SpreadsheetApp.openById(PM_DB_ID);
  } catch (e) {
    console.error("ไม่สามารถเปิด Database งาน PM ได้: " + e.toString());
    return null;
  }
}

// ฟังก์ชันดึง Spreadsheet ระบบการเงิน (Finance) แบบปลอดภัย
function getFinanceDatabase() {
  try {
    return SpreadsheetApp.openById(FN_DB_ID);
  } catch (e) {
    console.error("ไม่สามารถเปิด Database ระบบการเงิน ได้: " + e.toString());
    return null;
  }
}

// 1. ฟังก์ชันดึง "ประวัติการทำงาน PM" (จากชีต PM_Log)
function getPMSchedule() {
  var ss = getPMDatabase();
  if (!ss) return { error: "ไม่สามารถเชื่อมต่อฐานข้อมูล PM ได้" };

  var sheet = ss.getSheetByName('PM_Log'); // อ่านจากชีต PM_Log
  if (!sheet) return { error: "ไม่พบ Sheet 'PM_Log'" };

  var data = sheet.getDataRange().getValues();
  if (!data || data.length <= 1) return [];

  data.shift(); // ดึงหัวตารางออก
  var schedule = [];

  for (var i = 0; i < data.length; i++) {
    // ข้ามแถวว่าง
    if (!data[i][0] || data[i][0] === "") continue;

    // กำหนด status จากคอลัมน์ P (สถานะงาน): ถ้ามี "Completed" = Completed, ถ้าว่างหรือ "Pending" = Pending
    var statusCol = data[i][15]; // Column P: สถานะงาน
    var status = (statusCol && String(statusCol).toLowerCase().indexOf('completed') !== -1) ? "Completed" : "Pending";
    
    // อีกวิธี check: ถ้า Column N (เวลาที่แล้วเสร็จ) มีค่า = Completed
    var completeDate = data[i][13]; // Column N: เวลาที่แล้วเสร็จ
    if (completeDate && completeDate !== "") {
      status = "Completed";
    }
    
    // ดึงเดือนจากวันที่บันทึก (Column B)
    var recordDate = data[i][1]; // Column B
    var month = "-";
    if (recordDate && recordDate instanceof Date) {
      var monthNum = recordDate.getMonth() + 1;
      var months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
      month = months[monthNum - 1] || "-";
    }

    schedule.push({
      id: data[i][0] || (i + 1),                          // Column A: รหัสอ้างอิง
      month: month,                                        // เดือนจากวันที่บันทึก
      pmDate: formatDateSafe(data[i][1]),                 // Column B: วันที่บันทึก
      topic: (data[i][2] || "-") + " - " + (data[i][3] || "-"), // Column C+D: ระบบ-เครื่องจักร 
      system: data[i][2] || "-",                          // Column C: ระบบ
      machine: data[i][3] || "-",                         // Column D: เครื่องจักร
      subMachine: data[i][4] || "-",                      // Column E: เครื่องจักรย่อย
      responsible: data[i][10] || "-",                    // Column K: ผู้ปฏิบัติงาน (supervisor)
      completeDate: formatDateSafe(data[i][13]),          // Column N: วันที่แล้วเสร็จ
      startTime: data[i][12] || "-",                      // Column M: เวลาที่เริ่มปฏิบัติงาน
      remark: data[i][6] || "",                           // Column G: รายละเอียดการบำรุงรักษา (หมายเหตุ)
      price: data[i][9] || "0",                           // Column J: ราคา
      status: status
    });
  }

  // จัดเรียงตามลำดับความสำคัญ: Completed ก่อน แล้วจาก Pending ล่าสุด
  schedule.sort(function(a, b) {
    // Completed มาก่อน
    if (a.status === "Completed" && b.status === "Pending") return -1;
    if (a.status === "Pending" && b.status === "Completed") return 1;
    
    // ภายในสถานะเดียวกัน จัดตามเดือน (ล่าสุดขึ้นก่อน)
    var dateA = a.pmDate ? new Date(a.pmDate) : new Date(0);
    var dateB = b.pmDate ? new Date(b.pmDate) : new Date(0);
    return dateB - dateA;
  });

  return schedule;
}

// 2. ฟังก์ชันดึง "ประวัติการทำงาน" (จากชีต PM_Log)
function getPMLogs() {
  var ss = getPMDatabase();
  if (!ss) return [];

  var sheet = ss.getSheetByName('PM_Log');
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  if (!data || data.length <= 1) return [];

  data.shift(); // ดึงหัวตารางออก
  var logs = [];

  for (var i = 0; i < data.length; i++) {
    if (!data[i][0]) continue; // ข้ามถ้าไม่มี Log ID

    logs.push({
      logId: data[i][0],
      recordDate: formatDateSafe(data[i][1]),
      systemName: data[i][2] || "-",
      machineName: data[i][3] || "-",
      subMachineName: data[i][4] || "-",
      componentName: data[i][5] || "-",
      actionDetails: data[i][6] || "-",
      hasSpareParts: data[i][7] || "-",
      spareDetails: data[i][8] || "-",
      price: data[i][9] || "-",
      supervisor: data[i][10] || "-",
      cycle: data[i][11] || "-",
      startTime: data[i][12] || "-",
      cause: data[i][13] || "-",
      prevention: data[i][14] || "-",
      workerTypeLPP: data[i][15] || "",
      workerTypeMA: data[i][16] || "",
      workerTypeSpecial: data[i][17] || ""
    });
  }

  // สลับให้ Log ล่าสุดขึ้นก่อน
  return logs.reverse();
}

// ฟังก์ชันสำหรับสร้าง Claim ID อัตโนมัติ
function generateClaimId(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return "TIJ-001";
  
  var lastId = sheet.getRange(lastRow, 1).getValue();
  try {
    var parts = String(lastId).split('-');
    var num = (parts.length > 1) ? parseInt(parts[1]) + 1 : lastRow;
    return "TIJ-" + ("000" + num).slice(-3);
  } catch(e) {
    return "TIJ-" + (lastRow + 1);
  }
}

// ฟังก์ชันแปลงวันที่ให้สวยงาม
function formatDateSafe(dateVal) {
  try {
    // ดักจับค่าว่าง หรือค่าที่เป็น - อยู่แล้ว
    if (!dateVal || String(dateVal).trim() === "" || dateVal === "-") return "-";
    
    const d = (dateVal instanceof Date) ? dateVal : new Date(dateVal);
    
    // เช็คว่าเป็น Invalid Date หรือเด้งไปปี 1970 / 1899 (กรณีระบบแปลงค่า 0 หรือช่องว่างผิดพลาด)
    if (isNaN(d.getTime()) || d.getFullYear() === 1970 || d.getFullYear() === 1899) {
       // ถ้ามันไม่ใช่วันที่จริงๆ ให้คืนค่าข้อความเดิมกลับไป (เผื่อพิมพ์ Text ไว้) ถ้าไม่มีให้คืนค่า "-"
       return String(dateVal).trim() !== "" ? String(dateVal) : "-";
    }
    
    return Utilities.formatDate(d, "Asia/Bangkok", "dd/MM/yyyy");
  } catch (e) { 
    return String(dateVal) || "-"; 
  }
}

// ฟังก์ชันดึงอีเมลผู้ใช้งานปัจจุบัน
function getCurrentUserEmail() {
  return Session.getActiveUser().getEmail();
}

// ✅ เก่า: ใช้ getUserProfile() จาก Connect_Update.js แทน (ยา้ายไปแล้ว)

// ฟังก์ชันบันทึกข้อมูล (มีระบบล็อคป้องกันคนกดพร้อมกัน)
function saveClaim(data) {
  requireAccess('saveClaim'); // 🔐
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); 
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName('Claims');
    var timestamp = new Date();
    var claimId = generateClaimId(sheet);
    
    sheet.appendRow([
      claimId, timestamp, data.email, data.name, data.department, 
      data.travelDate, data.traveltype, data.purpose, data.amount, 'Pending', 
      data.receiptUrl || '', '', '', ''
    ]);
    
    // ✅ ล้าง Cache Dashboard เพื่อให้อัปเดตทันที
    clearAllDashboardCache();
    
    return "ยื่นคำขอสำเร็จ! รหัสคือ: " + claimId;
  } catch (error) {
    return "เกิดข้อผิดพลาด: " + error.toString();
  } finally {
    lock.releaseLock();
  }
}

// =========================================
// ฟังก์ชันอัปโหลดไฟล์โครงการ (Receipt/หลักฐาน)
// =========================================
function uploadReceiptFile(fileName, fileContent) {
  try {
    Logger.log("🔍 เริ่มอัปโหลด: " + fileName);
    
    // ตรวจสอบไฟล์ที่อัปโหลดมา
    if (!fileContent || fileContent === "") {
      throw new Error("ไฟล์ว่าง หรือไม่มีข้อมูล");
    }
    
    Logger.log("📦 ขนาดข้อมูล: " + fileContent.length + " bytes");
    
    // สร้างหรือค้นหา Folder ชื่อ "TIJ_Receipts" ใน Google Drive
    var folders = DriveApp.getFoldersByName("TIJ_Receipts");
    var folder;
    
    if (folders.hasNext()) {
      folder = folders.next();
      Logger.log("✅ พบโฟลเดอร์ TIJ_Receipts อยู่แล้ว");
    } else {
      // ถ้าไม่มี folder ให้สร้างใหม่
      folder = DriveApp.createFolder("TIJ_Receipts");
      Logger.log("✅ สร้างโฟลเดอร์ TIJ_Receipts สำเร็จ");
    }
    
    // fileContent มาจาก readAsDataURL ซึ่งเป็น Base64 string (data:image/jpeg;base64,...)
    // ต้องแยก Base64 part ออกมา
    var base64Data = fileContent;
    if (fileContent.indexOf(',') !== -1) {
      base64Data = fileContent.split(',')[1]; // เอาส่วน Base64 ที่อยู่หลัง comma
      Logger.log("✅ แยก Base64 ออกมาแล้ว");
    }
    
    // ตรวจสอบ Base64 ไม่ว่าง
    if (!base64Data || base64Data === "") {
      throw new Error("Base64 data ว่าง - อาจเป็นปัญหากับการอ่านไฟล์");
    }
    
    // สร้าง Blob จาก Base64 string
    var decodedBytes = Utilities.base64Decode(base64Data);
    Logger.log("✅ ถอดรหัส Base64 สำเร็จ - " + decodedBytes.length + " bytes");
    
    var mimeType = getMimeType(fileName);
    Logger.log("📄 MIME Type: " + mimeType);
    
    var fileBlob = Utilities.newBlob(decodedBytes, mimeType, fileName);
    Logger.log("📝 สร้าง Blob สำเร็จ");
    
    var uploadedFile = folder.createFile(fileBlob);
    Logger.log("✅ สร้างไฟล์ใน Drive สำเร็จ: " + uploadedFile.getName());
    
    // ตั้งค่าให้ใครก็ดูได้ (Shareable Link)
    uploadedFile.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);
    Logger.log("✅ ตั้งค่าแชร์สำเร็จ");
    
    // ส่ง URL กลับไป
    var fileUrl = uploadedFile.getUrl();
    Logger.log("✅ URL: " + fileUrl);
    return fileUrl;
    
  } catch (error) {
    Logger.log("❌ ERROR: " + error.toString());
    throw new Error("อัปโหลดไฟล์ไม่สำเร็จ: " + error.message);
  }
}

// ฟังก์ชันสำหรับหา MIME type จากชื่อไฟล์
function getMimeType(fileName) {
  var ext = fileName.split('.').pop().toLowerCase();
  var mimeTypes = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// ฟังก์ชันดึงประวัติส่วนตัว
function getUserHistory() {
  try {
    const ss = getSpreadsheet();
    const userEmail = Session.getActiveUser().getEmail();
    const sheet = ss.getSheetByName('Claims');
    if (!sheet) return [];

    const data = sheet.getDataRange().getValues();
    data.shift();

    return data
      .filter(row => String(row[2]).toLowerCase() === userEmail.toLowerCase())
      .reverse()
      .map(row => ({
        id: row[0], 
        date: formatDateSafe(row[5]), 
        type: row[6], 
        amount: Number(row[8]) || 0, 
        status: row[9] || 'Pending',
        remark: row[12] || "", // Column M (Approver_Note, index 12)
        receiptUrl: row[10] || "" // Column K (Image, index 10)
      }));
  } catch (e) {
    return [];
  }
}

function getDashboardData(startDate, endDate) {
  const cache = CacheService.getUserCache();
  const userEmail = Session.getActiveUser().getEmail().toLowerCase();
  
  // สร้าง Key สำหรับ Cache (แยกตาม User และวันที่กรอง)
  const cacheKey = `dash_${userEmail}_${startDate || 'no'}_${endDate || 'no'}`;
  const cachedContent = cache.get(cacheKey);
  
  if (cachedContent) return JSON.parse(cachedContent);

  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName('Claims');
    if (!sheet) return { error: "ไม่พบ Sheet ชื่อ Claims" };

    // ดึงข้อมูลครั้งเดียวจบ
    const rawData = sheet.getDataRange().getValues();
    const headers = rawData.shift(); 
    const profile = getUserProfile(); // ✅ ใช้ getUserProfile() แทน getUserRole()
    const role = profile.role;

    // เตรียมตัวแปรสำหรับ Filter
    const start = startDate ? new Date(startDate).getTime() : null;
    const end = endDate ? new Date(endDate).setHours(23, 59, 59) : null;

    // กรองข้อมูลในรอบเดียว (Single Pass Filter)
    let filteredData = rawData.filter(row => {
      // 1. เช็ค Role
      if (role === 'user' && String(row[2]).toLowerCase().trim() !== userEmail) return false;
      
      // 2. เช็ควันที่
      if (start && end) {
        const rowDate = new Date(row[5]).getTime();
        if (rowDate < start || rowDate > end) return false;
      }
      return true;
    });

    if (filteredData.length === 0) {
      const emptyResult = { stats: { totalTrips: 0, totalAmount: 0, pending: 0, approved: 0, rejected: 0, vehicles: {} }, items: [] };
      return emptyResult;
    }

    // คำนวณ Stats (ใช้ลูปเดียวเพื่อความเร็ว)
    const stats = { totalTrips: filteredData.length, totalAmount: 0, pending: 0, approved: 0, rejected: 0, vehicles: {} };
    const standardVehicles = ['รถแท็กซี่', 'รถไฟ', 'รถตู้สำนักงาน', 'รถมอเตอร์ไซค์', 'รถขนส่งสาธารณะ'];

    filteredData.forEach(row => {
      const amount = Number(row[8]) || 0;
      const status = String(row[9]).trim();
      const vRaw = row[6] ? String(row[6]).trim() : 'อื่นๆ';
      const vType = standardVehicles.includes(vRaw) ? vRaw : 'อื่นๆ';

      stats.totalAmount += amount;
      if (status === 'Pending') stats.pending++;
      else if (status === 'Approved') stats.approved++;
      else if (status === 'Rejected') stats.rejected++;

      stats.vehicles[vType] = (stats.vehicles[vType] || 0) + 1;
    });

    // 10 รายการล่าสุด
    const items = filteredData.slice(-10).reverse().map(row => ({
      id: row[0],
      name: row[3],
      date: formatDateSafe(row[5]),
      amount: Number(row[8]) || 0,
      status: row[9] || 'Pending'
    }));

    const finalResult = { stats, items };
    
    // เก็บลง Cache 10 นาที (600 วินาที)
    cache.put(cacheKey, JSON.stringify(finalResult), 600);
    
    return finalResult;
  } catch (e) {
    return { error: e.toString() };
  }
}

// ฟังก์ชันดึงรายการรออนุมัติ (สำหรับ Admin)
function getPendingClaims() {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID); 
    var sheet = ss.getSheetByName('Claims');
    var data = sheet.getDataRange().getValues();
    data.shift(); 
    
    var pending = [];
    for (var i = 0; i < data.length; i++) {
      if (data[i][9] === 'Pending') { 
        pending.push({
          id: data[i][0],
          date: Utilities.formatDate(new Date(data[i][5]), "Asia/Bangkok", "dd/MM/yyyy"),
          name: data[i][3], 
          dept: data[i][4], 
          type: data[i][6], 
          amount: data[i][8] 
        });
      }
    }
    return pending;
  } catch (e) {
    return [];
  }
}

// ฟังก์ชันอัปเดตสถานะ อนุมัติ/ไม่อนุมัติ
// เปลี่ยนบรรทัดวงเล็บรับค่า ให้มีตัวแปร remark เพิ่มเข้ามา
function updateClaimStatus(claimId, newStatus, remark) {
  requireRole(['admin'], 'updateClaimStatus'); // 🔐
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName('Claims');
    var data = sheet.getDataRange().getValues();
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === claimId) {
        sheet.getRange(i + 1, 10).setValue(newStatus); // คอลัมน์ J (Status)
        sheet.getRange(i + 1, 13).setValue(remark || ""); // ⭐ คอลัมน์ M (Approver_Note)
        return "Success";
      }
    }
    return "Not Found";
  } catch (e) {
    return "Error: " + e.toString();
  } finally {
    lock.releaseLock();
  }
}

// --- 3. ฟังก์ชันดึงประวัติการดำเนินการ (สำหรับ Admin/Approver) ---
function getAdminActionHistory() {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID); 
    var sheet = ss.getSheetByName('Claims');
    var data = sheet.getDataRange().getValues();
    data.shift(); // ลบหัวตาราง
    
    var history = [];
    for (var i = 0; i < data.length; i++) {
      // ดึงเฉพาะแถวที่สถานะเป็น Approved หรือ Rejected
      if (data[i][9] === 'Approved' || data[i][9] === 'Rejected') { 
        history.push({
          id: data[i][0],
          date: Utilities.formatDate(new Date(data[i][5]), "Asia/Bangkok", "dd/MM/yyyy"),
          name: data[i][3], 
          dept: data[i][4], 
          type: data[i][6], 
          amount: Number(data[i][8]) || 0,
          status: data[i][9],
          remark: data[i][12] || "" // Column M (Approver_Note, index 12)
        });
      }
    }
    // สลับเอาข้อมูลล่าสุดขึ้นก่อน และดึงมาโชว์แค่ 50 รายการล่าสุด (เพื่อไม่ให้เว็บโหลดช้า)
    return history.reverse().slice(0, 50); 
  } catch (e) {
    return [];
  }
}

// ==========================================
// ส่วนระบบจัดการรถตู้ (Van Management)
// ==========================================

// 1. ฟังก์ชันดึงรายชื่อคนขับรถ (เฉพาะคนที่มี Role = driver) ✅ ย้ายไปใช้ User_DB แล้ว
// ✅ เก่า: ดึงจาก SHEET_ID ชีต 'Users' - ลบไปแล้ว
// ✅ ใหม่: ดึงจาก USER_ID (User_DB) ชีต 'Users' ด้วยฟังก์ชัน getUsersByRole()
function getDriversList() {
  try {
    // ✅ ใช้ฟังก์ชันใหม่ getUsersByRole() จาก Connect_Update.js แทน
    var drivers = getUsersByRole('driver');
    
    if (!drivers || drivers.length === 0) {
      console.warn("ไม่พบคนขับรถในระบบ");
      return [];
    }
    
    return drivers;
  } catch (e) {
    console.error("เกิดข้อผิดพลาดในการดึงคนขับ: " + e.toString());
    return { error: e.toString() };
  }
}

// 2. ฟังก์ชันสร้าง Job ID รถตู้ (เช่น VAN-001)
function generateVanJobId(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return "VAN-001";
  
  var lastId = sheet.getRange(lastRow, 1).getValue();
  try {
    var parts = String(lastId).split('-');
    var num = (parts.length > 1) ? parseInt(parts[1]) + 1 : lastRow;
    return "VAN-" + ("000" + num).slice(-3);
  } catch(e) {
    return "VAN-" + (lastRow + 1);
  }
}

// 3. ฟังก์ชันบันทึกการจ่ายงาน (Admin) - WITH SERVER-SIDE VALIDATION ✅
function saveVanJob(data) {
  try {
    if (!isAdmin()) throw new Error("คุณไม่มีสิทธิ์ใช้งานส่วนนี้ (เฉพาะ Admin เท่านั้น)");
    
    var config = getConfig();
    var ss = SpreadsheetApp.openById(config.SHEET_ID); 
    var sheet = ss.getSheetByName("VanJobs"); 
    if (!sheet) throw new Error("ไม่พบชีต 'VanJobs' ในฐานข้อมูล");
    
    var jobId = "VAN-" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyMMdd") + "-" + Math.floor(Math.random() * 1000);
    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    
    // จองพื้นที่ขนาด 23 คอลัมน์ (Index 0 - 22) เพื่อให้ครบถ้วนตามความกว้างตารางจริง
    var newRow = new Array(23).fill(""); 
    
    newRow[0] = jobId;               // A: Job_ID (Index 0)
    newRow[1] = timestamp;           // B: Timestamp (Index 1)
    newRow[2] = data.customerName;   // C: Customer_Name (Index 2)
    newRow[3] = data.destination;    // D: Destination (Index 3)
    newRow[4] = data.travelDate;     // E: Travel_Date (Index 4)
    newRow[5] = data.time;           // F: Time pick up (Index 5) -> เวลานัดรับเริ่มต้น
    newRow[6] = data.timeFinish;     // G: Time finish (Index 6) -> เวลากลับ/ส่งคืน
    newRow[7] = data.driverEmail;    // H: Driver_Email (Index 7)
    newRow[8] = "Assigned";          // I: Status (Index 8)
    
    newRow[15] = data.pickup;        // P: Pick-up (Index 15)
    newRow[16] = data.tripType;      // Q: Trip_Type (Index 16) -> ประเภทการเดินทาง
    newRow[21] = data.vehicleType;   // V: Vehicle_Type (Index 21) -> ประเภทรถที่ใช้งาน
    newRow[22] = data.licensePlate || ""; // W: License_Plate (Index 22) -> ทะเบียนรถ (เพิ่มใหม่)

    sheet.appendRow(newRow);
    
    // ส่งอีเมลแจ้งเตือนคนขับ
    var subject = "🔔 มอบหมายงานวิ่งรถใหม่ (" + jobId + ")";
    var body = "สวัสดีครับ,\n\n" +
               "คุณได้รับมอบหมายงานใหม่จากระบบ โปรดตรวจสอบรายละเอียด:\n\n" +
               "📌 รหัสงาน: " + jobId + "\n" +
               "👤 ลูกค้า/ผู้เดินทาง: " + data.customerName + "\n" +
               "📅 วันที่ปฏิบัติงาน: " + data.travelDate + "\n" +
               "⏰ เวลานัดรับเริ่มต้น: " + data.time + " น.\n" +
               "⏰ เวลากลับ/ส่งคืน: " + data.timeFinish + " น.\n" +
               "📍 จุดนัดรับ: " + data.pickup + "\n" +
               "📍 ปลายทาง: " + data.destination + "\n" +
               "🗺️ ประเภทการเดินทาง: " + data.tripType + "\n" +
               "🚐 รถที่ใช้: " + data.vehicleType + "\n\n" +
               "มอบหมายพนักงานขับรถ " + data.licensePlate + "\n\n" +
               "โปรดตรวจสอบข้อมูลในหน้าแอปพนักงานขับรถขอบคุณครับ";
               
    try {
      MailApp.sendEmail(data.driverEmail, subject, body);
    } catch (emailErr) {
      console.error("ส่งอีเมลไม่สำเร็จ: " + emailErr);
    }
    
    logAudit("ASSIGN_VAN_JOB", "Admin จ่ายงาน " + jobId + " ให้คนขับ " + data.driverEmail, "INFO");
    return "จ่ายงานรหัส " + jobId + " และส่งอีเมลแจ้งคนขับเรียบร้อยแล้ว!";
  } catch (error) {
    throw new Error(error.toString());
  }
}

// ==========================================
// ส่วนที่ 2: ระบบสำหรับคนขับรถ (Driver)
// ==========================================

// 4. ฟังก์ชันดึงงานที่ตัวเองได้รับมอบหมาย
function getDriverJobs(driverEmail) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName('VanJobs');
    var data = sheet.getDataRange().getValues();
    var jobs = [];

    // เริ่มที่ 1 เพื่อข้ามหัวคอลัมน์
    for (var i = 1; i < data.length; i++) {
      // เช็คว่าเป็นอีเมลคนขับคนนี้ และสถานะยังไม่ Completed
      if (data[i][5] === driverEmail && (data[i][6] === 'Assigned' || data[i][6] === 'Accepted')) {
        jobs.push({
          jobId: data[i][0],
          customer: data[i][2],
          destination: data[i][3],
          travelDate: Utilities.formatDate(new Date(data[i][4]), "Asia/Bangkok", "dd/MM/yyyy"),
          status: data[i][6]
        });
      }
    }
    return jobs;
  } catch(e) {
    return [];
  }
}

// 5. ฟังก์ชันเปลี่ยนสถานะเป็น "รับงานแล้ว" (Accepted) - WITH OWNERSHIP CHECK ✅
function acceptVanJob(jobId) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var config = getConfig();
    var ss = SpreadsheetApp.openById(config.SHEET_ID);
    var sheet = ss.getSheetByName('VanJobs');
    
    if (!sheet) throw new Error("ไม่พบชีตชื่อ 'VanJobs'");

    var data = sheet.getDataRange().getValues();
    var rowToUpdate = -1;

    // หาแถวที่มี jobId ตรงกัน (column A, index 0) เริ่มจาก row 1 ข้าม header
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(jobId).trim()) {
        rowToUpdate = i + 1;
        break;
      }
    }

    if (rowToUpdate === -1) {
      throw new Error("ไม่พบรหัสงาน: " + jobId);
    }

    // ✅ เปลี่ยนสถานะในคอลัมน์ I (index 8, column 9) ให้ตรงกับที่ getDriverVanJobs อ่าน statusIdx = 8
    sheet.getRange(rowToUpdate, 9).setValue('Accepted');

    logAudit("ACCEPT_VAN_JOB", "รับงานสำเร็จ Job ID: " + jobId, "INFO");
    return "✅ รับงานสำเร็จ!";
  } catch (error) {
    logAudit("ACCEPT_VAN_JOB_ERROR", "Error: " + error.toString(), "ERROR");
    throw new Error("รับงานไม่สำเร็จ: " + error.toString());
  } finally {
    lock.releaseLock();
  }
}

// ฟังก์ชันคืนสถานะงานกลับเป็น Assigned (Admin เท่านั้น)
// ========== Export PDF รายงานรถตู้รายไตรมาส (Admin only) ==========
function exportVanJobsPDF(params) {
  if (!isAdmin()) throw new Error("เฉพาะ Admin เท่านั้นที่สามารถ Export ได้");

  var year      = parseInt(params.year);      // พ.ศ.
  var monthFrom = parseInt(params.monthFrom); // 1-12
  var monthTo   = parseInt(params.monthTo);   // 1-12

  if (monthFrom > monthTo) throw new Error("เดือนแรกต้องไม่มากกว่าเดือนสุดท้าย");

  var MONTH_NAMES = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

  // สร้าง array เดือนและ label
  var months = [];
  for (var m = monthFrom; m <= monthTo; m++) months.push(m);
  var qlabel = monthFrom === monthTo
    ? MONTH_NAMES[monthFrom]
    : MONTH_NAMES[monthFrom] + '–' + MONTH_NAMES[monthTo];
  var yearCE = year - 543; // พ.ศ. → ค.ศ.

  var config = getConfig();
  var ss     = SpreadsheetApp.openById(config.SHEET_ID);
  var sheet  = ss.getSheetByName('VanJobs');
  if (!sheet) throw new Error("ไม่พบชีต 'VanJobs'");

  var rawData = sheet.getDataRange().getValues();
  if (rawData.length <= 1) throw new Error("ไม่มีข้อมูลในระบบ");

  // Column index (0-based) — ตรงกับ getDriverVanJobs
  var COL = { id:0, time:5, timeFinish:6, driver:7, status:8,
              dist:9, toll:10, fuel:11, note:12,
              date:4, customer:2, pickup:15, destination:3,
              startMile:17, endMile:18, parking:19, allowance:20 };

  var rows = [];
  var totals = { dist:0, toll:0, fuel:0, parking:0, allowance:0 };

  for (var i = 1; i < rawData.length; i++) {
    var row = rawData[i];
    if (!row[COL.id]) continue;

    // Parse วันที่
    var travelDate = row[COL.date];
    var d;
    if (travelDate instanceof Date) {
      d = travelDate;
    } else {
      var p = String(travelDate).split('/');
      if (p.length !== 3) continue;
      d = new Date(parseInt(p[2]) - 543, parseInt(p[1]) - 1, parseInt(p[0]));
    }
    if (isNaN(d.getTime())) continue;

    var jobMonth = d.getMonth() + 1;
    var jobYear  = d.getFullYear();
    if (jobYear !== yearCE || months.indexOf(jobMonth) === -1) continue;

    var dist      = parseFloat(row[COL.dist])      || 0;
    var toll      = parseFloat(row[COL.toll])      || 0;
    var fuel      = parseFloat(row[COL.fuel])      || 0;
    var parking   = parseFloat(row[COL.parking])   || 0;
    var allowance = parseFloat(row[COL.allowance]) || 0;
    var status    = String(row[COL.status] || '').trim();

    totals.dist      += dist;
    totals.toll      += toll;
    totals.fuel      += fuel;
    totals.parking   += parking;
    totals.allowance += allowance;

    rows.push({
      id:          String(row[COL.id]).trim(),
      date:        Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy'),
      customer:    String(row[COL.customer]    || '-').trim(),
      destination: String(row[COL.destination] || '-').trim(),
      driver:      String(row[COL.driver]      || '-').trim().split('@')[0],
      time:        String(row[COL.time]        || '-').trim(),
      timeFinish:  String(row[COL.timeFinish]  || '-').trim(),
      status:      status,
      dist: dist, toll: toll, fuel: fuel,
      parking: parking, allowance: allowance,
      note:        String(row[COL.note]        || '').trim()
    });
  }

  if (rows.length === 0) throw new Error("ไม่พบข้อมูลงานในช่วง " + qlabel + " ปี " + year);

  // ====== สร้าง Google Doc → PDF ======
  var docTitle = 'รายงานงานรถตู้ TIJ – ' + qlabel + ' พ.ศ.' + year;
  var doc  = DocumentApp.create(docTitle);
  var body = doc.getBody();

  // A4 Landscape
  body.setPageWidth(841.89); body.setPageHeight(595.28);
  body.setMarginTop(40); body.setMarginBottom(40);
  body.setMarginLeft(40); body.setMarginRight(40);

  // ---- Title ----
  var tp = body.appendParagraph('รายงานสรุปงานวิ่งรถตู้ TIJ');
  tp.setHeading(DocumentApp.ParagraphHeading.HEADING1);
  tp.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  tp.editAsText().setFontSize(18).setBold(true);

  body.appendParagraph('ช่วงเวลา: ' + qlabel + ' ปี พ.ศ. ' + year)
      .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
      .editAsText().setFontSize(12).setForegroundColor('#475569');

  body.appendParagraph('สร้างเมื่อ: ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm น.'))
      .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
      .editAsText().setFontSize(10).setForegroundColor('#94a3b8');

  body.appendParagraph('');

  // ---- ตารางสรุปภาพรวม ----
  var completed = rows.filter(function(r){return r.status==='Completed';}).length;
  var summaryData = [
    ['รายการ', 'จำนวน / มูลค่า'],
    ['จำนวนงานทั้งหมด',     rows.length + ' งาน'],
    ['งานที่เสร็จสิ้น (Completed)', completed + ' งาน'],
    ['งานที่ยังค้างอยู่',   (rows.length - completed) + ' งาน'],
    ['ระยะทางรวม',          totals.dist.toLocaleString() + ' กม.'],
    ['ค่าน้ำมันรวม',        '฿' + totals.fuel.toLocaleString()],
    ['ค่าทางด่วนรวม',       '฿' + totals.toll.toLocaleString()],
    ['ค่าที่จอดรถรวม',      '฿' + totals.parking.toLocaleString()],
    ['เบี้ยเลี้ยงคนขับรวม', '฿' + totals.allowance.toLocaleString()],
    ['ค่าใช้จ่ายรวมทั้งหมด','฿' + (totals.fuel+totals.toll+totals.parking+totals.allowance).toLocaleString()]
  ];
  var sumTable = body.appendTable(summaryData);
  sumTable.setBorderColor('#e2e8f0');
  // Style header row
  var sumH = sumTable.getRow(0);
  for (var c = 0; c < 2; c++) {
    sumH.getCell(c).setBackgroundColor('#1e293b');
    sumH.getCell(c).editAsText().setBold(true).setFontSize(10).setForegroundColor('#ffffff');
  }
  // Style total row
  var lastRow = sumTable.getRow(summaryData.length - 1);
  for (var c = 0; c < 2; c++) {
    lastRow.getCell(c).setBackgroundColor('#fff7ed');
    lastRow.getCell(c).editAsText().setBold(true).setFontSize(10).setForegroundColor('#ea580c');
  }

  body.appendParagraph('');
  body.appendParagraph('รายละเอียดงานทั้งหมด')
      .editAsText().setBold(true).setFontSize(12).setForegroundColor('#1e293b');
  body.appendParagraph('');

  // ---- ตารางรายละเอียด ----
  var headers = ['รหัสงาน','วันที่','ผู้เดินทาง','ปลายทาง','คนขับ','เวลารับ','เวลาส่ง','สถานะ','ระยะทาง','น้ำมัน','ค่าด่วน','ค่าจอด','เบี้ยเลี้ยง'];
  var tableData = [headers];
  rows.forEach(function(r) {
    var statusTH = r.status === 'Completed' ? 'เสร็จแล้ว'
                 : r.status === 'Accepted'  ? 'ตอบรับแล้ว'
                 : r.status === 'Assigned'  ? 'มอบหมาย'
                 : r.status;
    tableData.push([
      r.id, r.date, r.customer, r.destination, r.driver,
      r.time, r.timeFinish, statusTH,
      r.dist + ' กม.',
      '฿' + r.fuel.toLocaleString(),
      '฿' + r.toll.toLocaleString(),
      '฿' + r.parking.toLocaleString(),
      '฿' + r.allowance.toLocaleString()
    ]);
  });

  var detailTable = body.appendTable(tableData);
  detailTable.setBorderColor('#e2e8f0');

  // Header row สีส้ม TIJ
  var hRow = detailTable.getRow(0);
  for (var c = 0; c < headers.length; c++) {
    hRow.getCell(c).setBackgroundColor('#f97316');
    hRow.getCell(c).editAsText().setBold(true).setFontSize(8).setForegroundColor('#ffffff');
  }
  // Data rows สลับสี + highlight Completed
  for (var r = 1; r < tableData.length; r++) {
    var status = rows[r-1].status;
    var bg = status === 'Completed' ? '#f0fdf4'
           : r % 2 === 0           ? '#f8fafc'
           : '#ffffff';
    for (var c = 0; c < headers.length; c++) {
      detailTable.getRow(r).getCell(c).setBackgroundColor(bg);
      detailTable.getRow(r).getCell(c).editAsText().setFontSize(8);
    }
  }

  // Footer
  body.appendParagraph('');
  body.appendParagraph('เอกสารนี้สร้างโดยระบบจัดการรถตู้ TIJ โดยอัตโนมัติ | ' +
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm น.'))
      .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
      .editAsText().setFontSize(9).setForegroundColor('#94a3b8').setItalic(true);

  doc.saveAndClose();

  // แปลง Doc → PDF และบันทึกใน Drive
  var docFile = DriveApp.getFileById(doc.getId());
  var pdfBlob = docFile.getAs(MimeType.PDF);
  pdfBlob.setName(docTitle + '.pdf');
  var pdfFile = DriveApp.createFile(pdfBlob);
  pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  docFile.setTrashed(true); // ลบ Doc ต้นฉบับทิ้ง

  logAudit("EXPORT_VAN_PDF", "Export " + qlabel + "/" + year + " จำนวน " + rows.length + " งาน", "INFO");
  return { url: pdfFile.getUrl(), name: docTitle };
}

function revertVanJob(jobId) {
  if (!isAdmin()) throw new Error("เฉพาะ Admin เท่านั้นที่สามารถคืนสถานะงานได้");
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var config = getConfig();
    var ss = SpreadsheetApp.openById(config.SHEET_ID);
    var sheet = ss.getSheetByName('VanJobs');
    if (!sheet) throw new Error("ไม่พบชีต 'VanJobs'");

    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(jobId).trim()) {
        // ✅ column I (index 8) คือ Status
        sheet.getRange(i + 1, 9).setValue('Assigned');
        logAudit("REVERT_VAN_JOB", "Admin คืนสถานะงาน Job ID: " + jobId + " → Assigned", "INFO");
        return "↩️ คืนสถานะงาน " + jobId + " เป็น 'รอรับงาน' เรียบร้อยแล้ว";
      }
    }
    throw new Error("ไม่พบรหัสงาน: " + jobId);
  } catch (e) {
    logAudit("REVERT_VAN_JOB_ERROR", "Error: " + e.toString(), "ERROR");
    throw e;
  } finally {
    lock.releaseLock();
  }
}

// 6. ฟังก์ชันปิดงานและบันทึกค่าใช้จ่าย - WITH OWNERSHIP & VALIDATION ✅
function closeVanJob(data) {
  try {
    // ✅ อนุญาตทั้ง admin และ driver ปิดงานได้
    if (!isDriver() && !isAdmin()) throw new Error("คุณไม่มีสิทธิ์บันทึกปิดงานวิ่งรถ");
    
    var config = getConfig();
    var ss = SpreadsheetApp.openById(config.SHEET_ID);
    var sheet = ss.getSheetByName("VanJobs");
    if (!sheet) throw new Error("ไม่พบชีต 'VanJobs' ในฐานข้อมูล");
    
    var sheetData = sheet.getDataRange().getValues();
    var idIdx = 0;
    
    // ✅ Column index ตรงกับโครงสร้าง getDriverVanJobs (Index จาก 0)
    var statusIdx = 8;      // Status (Column I)
    var distIdx = 9;        // Distance_KM (Column J)
    var tollIdx = 10;       // Toll_Fee (Column K)
    var fuelIdx = 11;       // Fuel_Fee (Column L)
    var repairIdx = 12;     // Repair_Fee/Note (Column M)
    var startMileIdx = 17;  // miles-start (Column R)
    var currentMileIdx = 18;// miles-current (Column S)
    var parkingIdx = 19;    // parking cost (Column T)
    var payDriverIdx = 20;  // pay for driver (Column U)
    
    for (var i = 1; i < sheetData.length; i++) {
      if (sheetData[i][idIdx] && String(sheetData[i][idIdx]).trim() === String(data.jobId).trim()) {
        
        // เขียนข้อมูลอัปเดตลงคอลัมน์ต่างๆ ให้ตรงช่องแบบสมบูรณ์
        sheet.getRange(i + 1, statusIdx + 1).setValue("Completed");
        sheet.getRange(i + 1, distIdx + 1).setValue(Number(data.distance) || 0);
        sheet.getRange(i + 1, tollIdx + 1).setValue(Number(data.toll) || 0);
        sheet.getRange(i + 1, fuelIdx + 1).setValue(Number(data.fuel) || 0);
        sheet.getRange(i + 1, repairIdx + 1).setValue(data.note || ""); // บันทึก หมายเหตุ / ค่าซ่อมรถ ในคอลัมน์ K
        sheet.getRange(i + 1, startMileIdx + 1).setValue(Number(data.startMile) || 0); 
        sheet.getRange(i + 1, currentMileIdx + 1).setValue(Number(data.endMile) || 0); 
        sheet.getRange(i + 1, parkingIdx + 1).setValue(Number(data.parking) || 0); 
        sheet.getRange(i + 1, payDriverIdx + 1).setValue(Number(data.allowance) || 0); 
        
        logAudit("CLOSE_VAN_JOB", "ปิดงานสำเร็จ Job ID: " + data.jobId + ", ระยะทาง: " + data.distance + " กม.", "INFO");
        return "🎉 บันทึกข้อมูลเลขไมล์และค่าใช้จ่ายของงาน " + data.jobId + " เรียบร้อยแล้ว!";
      }
    }
    throw new Error("ไม่พบข้อมูลงานรถตู้อ้างอิงรหัส " + data.jobId);
  } catch (e) {
    logAudit("CLOSE_VAN_JOB_ERROR", "Error: " + e.toString(), "ERROR");
    throw e;
  }
}

// 7. ฟังก์ชันดึงสถิติ Dashboard ของคนขับรถ
function getDriverStats(driverEmail) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName('VanJobs');
    var data = sheet.getDataRange().getValues();
    
    var stats = { 
      totalJobs: 0, 
      totalKm: 0, 
      totalExpenses: 0 
    };

    // ลูปหาข้อมูลที่เป็นของคนขับคนนี้ และทำงานเสร็จแล้ว (Completed)
    for (var i = 1; i < data.length; i++) {
      if (data[i][5] === driverEmail && data[i][6] === 'Completed') {
        stats.totalJobs += 1;
        stats.totalKm += Number(data[i][7]) || 0; // ระยะทาง
        // รวมค่าทางด่วน (I) + ค่าน้ำมัน (J) + ค่าซ่อม (K)
        stats.totalExpenses += (Number(data[i][8]) || 0) + (Number(data[i][9]) || 0) + (Number(data[i][10]) || 0);
      }
    }
    return stats;
  } catch(e) {
    return { totalJobs: 0, totalKm: 0, totalExpenses: 0 };
  }
}


// ==========================================
// ฟังก์ชันสำหรับดึงไฟล์ HTML ย่อยมาแทรก (Include Component System)
// ==========================================
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ==========================================
// SERVER-SIDE SECURITY & VALIDATION
// ==========================================

/**
 * ✅ ตรวจสอบสิทธิ์ Admin ก่อนรันฟังก์ชัน (ใช้ isAdmin() แทน)
 * @param {string} functionName - ชื่อฟังก์ชันที่ต้องสิทธิ์ Admin
 * @throws {Error} ถ้าผู้ใช้ไม่มีสิทธิ์
 */
function requireAdmin(functionName = 'function') {
  var userEmail = Session.getActiveUser().getEmail();
  
  if (!isAdmin()) { // ✅ ใช้ isAdmin() จาก Connect_Update.js แทน
    console.error(`❌ UNAUTHORIZED: ${userEmail} tried to access ${functionName} (Not Admin)`);
    throw new Error(`คุณไม่มีสิทธิ์ใช้ฟังก์ชันนี้ (${functionName}). เฉพาะ Admin เท่านั้น`);
  }
  
  console.log(`✅ AUTHORIZED: ${userEmail} accessed ${functionName} as Admin`);
}

/**
 * ✅ ตรวจสอบสิทธิ์ Driver ก่อนรันฟังก์ชัน (ใช้ isDriver() แทน)
 * @param {string} functionName - ชื่อฟังก์ชันที่ต้องสิทธิ์ Driver
 * @throws {Error} ถ้าผู้ใช้ไม่ใช่ Driver
 */
function requireDriver(functionName = 'function') {
  var userEmail = Session.getActiveUser().getEmail();
  
  if (!isDriver()) { // ✅ ใช้ isDriver() จาก Connect_Update.js แทน
    console.error(`❌ UNAUTHORIZED: ${userEmail} tried to access ${functionName} (Not Driver)`);
    throw new Error(`คุณไม่มีสิทธิ์ใช้ฟังก์ชันนี้ (${functionName}). เฉพาะ Driver เท่านั้น`);
  }
  
  console.log(`✅ AUTHORIZED: ${userEmail} accessed ${functionName} as Driver`);
}

/**
 * ✅ ตรวจสอบว่าผู้ใช้มีสิทธิ์เข้าถึงข้อมูลของตัวเองหรือเป็น Admin (ใช้ isAdmin() แทน)
 * @param {string} targetEmail - อีเมลของเจ้าของข้อมูล
 * @param {string} operationName - ชื่อการดำเนินการ
 * @throws {Error} ถ้าพยายามเข้าถึงข้อมูลของคนอื่น
 */
function requireOwnershipOrAdmin(targetEmail, operationName = 'access this data') {
  var userEmail = Session.getActiveUser().getEmail();
  
  // Admin สามารถเข้าถึงข้อมูลทุกคนได้
  if (isAdmin()) { // ✅ ใช้ isAdmin() จาก Connect_Update.js แทน
    console.log(`✅ AUTHORIZED: Admin ${userEmail} ${operationName}`);
    return true;
  }
  
  // User ทั่วไปสามารถเข้าถึงข้อมูลของตัวเองได้เท่านั้น
  if (userEmail.toLowerCase() !== targetEmail.toLowerCase()) {
    console.error(`❌ UNAUTHORIZED: ${userEmail} tried to ${operationName} for ${targetEmail}`);
    throw new Error(`คุณสามารถเข้าถึงข้อมูลของตัวเองได้เท่านั้น`);
  }
  
  console.log(`✅ AUTHORIZED: ${userEmail} ${operationName}`);
  return true;
}

/**
 * ✅ บันทึกกิจกรรมทั้งหมดลง Audit Log
 */
function logAudit(action, details, severity) {
  try {
    var config = getConfig();
    var ss = SpreadsheetApp.openById(config.SHEET_ID);
    var sheet = ss.getSheetByName("Audit_Log");
    if (!sheet) return;
    
    var profile = getUserProfile();
    sheet.appendRow([
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss"),
      profile.email,
      profile.role,
      action,
      details,
      severity || "INFO"
    ]);
  } catch(e) {
    console.error("Error logging audit: " + e.toString());
  }
}

/**
 * ✅ ตรวจสอบข้อมูล Input ก่อนบันทึก
 */
function validateInput(data, requiredFields) {
  var errors = [];
  
  requiredFields.forEach(function(field) {
    if (!data[field] || data[field].toString().trim() === '') {
      errors.push(`ฟิลด์ "${field}" ว่างเปล่า`);
    }
  });
  
  if (errors.length > 0) {
    throw new Error('❌ ข้อมูลไม่ครบถ้วน:\n' + errors.join('\n'));
  }
}

// ==========================================
// ฟังก์ชันบันทึกข้อมูลแจ้งซ่อมด่วน (Repair Log)
// ==========================================
function saveRepairLog(data) {
  requireAccess('saveRepairLog'); // 🔐
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // รอคิว max 10 วินาที
    var ss = SpreadsheetApp.openById(PM_DB_ID);
    
    // 2. หา Sheet ที่ชื่อ 'Repair_Log' (ถ้ายังไม่มีให้สร้างใหม่)
    var sheetName = 'Repair_Log'; 
    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      // สร้างหัวตาราง (Header) สวยๆ
      sheet.appendRow(['รหัสแจ้งซ่อม', 'วันที่แจ้ง', 'ระบบ/อุปกรณ์', 'รายละเอียดอาการ', 'ผู้แจ้ง', 'สถานะการซ่อม']);
      sheet.getRange("A1:F1").setFontWeight("bold").setBackground("#f43f5e").setFontColor("white"); // สีชมพูแดง (Rose)
      sheet.setFrozenRows(1); // แช่แข็งแถวบนสุด
    }

    // 3. สร้างรหัสแจ้งซ่อมแบบอัตโนมัติ (เช่น REP-260325-1430)
    var dateObj = new Date();
    var repairId = "REP-" + Utilities.formatDate(dateObj, "GMT+7", "yyMMdd-HHmm");
    var timestamp = Utilities.formatDate(dateObj, "GMT+7", "dd/MM/yyyy HH:mm:ss");

    // 4. บันทึกข้อมูลลงแถวใหม่ (Append Row)
    sheet.appendRow([
      repairId,           // A: รหัส
      timestamp,          // B: วันที่แจ้ง
      data.item,          // C: ระบบ/อุปกรณ์ (ดึงจากหน้าเว็บ)
      data.detail,        // D: รายละเอียดอาการ
      data.reporter,      // E: ผู้แจ้ง
      'รอดำเนินการ'         // F: สถานะเริ่มต้น (Pending)
    ]);

    // ✅ ล้าง Cache Dashboard เพื่อให้อัปเดตทันที
    clearAllDashboardCache();

    return "✅ ส่งข้อมูลแจ้งซ่อมสำเร็จ!\nรหัสอ้างอิงของคุณคือ: " + repairId;
    
  } catch (error) {
    console.error("Error in saveRepairLog: " + error);
    throw new Error("ไม่สามารถบันทึกข้อมูลได้: " + error.message);
  } finally {
    lock.releaseLock(); // ปลดล็อกเสมอ
  }
}

function saveRepairTask(data) {
  return saveRepairLog(data);
}

// ==========================================
// ฟังก์ชันดึงข้อมูล Dropdown 4 ระดับ จาก Sheet5
// ==========================================
function getDropdownData() {
  var ss = SpreadsheetApp.openById(PM_DB_ID); // ตรวจสอบว่าใช้ตัวแปร ID ถูกต้อง (PM_DB_ID)
  var sheet = ss.getSheetByName('PMDB');    // เช็คชื่อ Sheet ให้ตรงกัน
  
  if (!sheet) return {}; // ถ้าไม่เจอชีตให้ส่งค่าว่างกลับไป
  
  var data = sheet.getDataRange().getDisplayValues();
  var result = {};
  
  var currentSystem = "";
  var currentMachine = "";
  var currentSubMachine = "";

  // วนลูปอ่านข้อมูล (ข้ามแถวหัวตาราง ถ้าแถวแรกคือหัวตาราง ให้เปลี่ยน i=0 เป็น i=1)
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    
    // เติมข้อมูลลงมาถ้าช่องว่าง (Fill Down Logic)
    if (row[0].trim() !== "") currentSystem = row[0].trim();
    if (row[1].trim() !== "") currentMachine = row[1].trim();
    if (row[2].trim() !== "") currentSubMachine = row[2].trim();
    var component = row[3] ? row[3].trim() : "";

    if (!currentSystem) continue; // ถ้าไม่มีระบบ ให้ข้ามไป

    // สร้างโครงสร้าง Object แบบลำดับชั้น (JSON)
    if (!result[currentSystem]) result[currentSystem] = {};
    if (!result[currentSystem][currentMachine]) result[currentSystem][currentMachine] = {};
    if (!result[currentSystem][currentMachine][currentSubMachine]) result[currentSystem][currentMachine][currentSubMachine] = [];
    
    // นำระบบประกอบเครื่องจักร (คอลัมน์ 4) ไปใส่ไว้ใน Array ชั้นในสุด
    if (component !== "") {
      result[currentSystem][currentMachine][currentSubMachine].push(component);
    }
  }
  
  return result;
}

// =========================================
// ฟังก์ชันบันทึกข้อมูลจากหน้า PM Repair
// =========================================
function savePMRepairLog(data) {
  requireRole(['admin', 'assistant'], 'savePMRepairLog'); // 🔐
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // รอคิว max 10 วินาที
    
    // ใช้ PM_DB_ID ที่คุณประกาศไว้ด้านบน
    var ss = SpreadsheetApp.openById(PM_DB_ID);
    var sheetName = 'PM_Log'; 
    var sheet = ss.getSheetByName(sheetName);
    
    // 1. ถ้ายังไม่มี Sheet 'PM_Log' ให้สร้างใหม่พร้อมหัวตาราง
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      var headers = [
        'รหัสอ้างอิง', 'วันที่บันทึก', 'ระบบ', 'เครื่องจักร', 
        'เครื่องจักรย่อย', 'ระบบประกอบเครื่องจักร', 'รายละเอียดการบำรุงรักษา', 
        'การเปลี่ยนอะไหล่', 'รายละเอียดอะไหล่', 'ราคา', 'ผู้รับผิดชอบ(คุมงาน)',
        'รอบการบำรุงรักษา', 'เวลาที่เริ่มปฏิบัติงาน', 'เวลาที่แล้วเสร็จ', 'สาเหตุ', 'สถานะงาน',
        'ฝ่ายวิศวกรรม LPP', 'ผู้รับเหมาสัญญาจ้าง (MA)', 'ผู้รับเหมาจ้างพิเศษ (รายครั้ง)'
      ];
      sheet.appendRow(headers);
      sheet.getRange("A1:S1").setFontWeight("bold").setBackground("#3b82f6").setFontColor("white"); // สีฟ้า
      sheet.setFrozenRows(1);
    }

    // 2. สร้างรหัสอ้างอิง และดึงเวลาปัจจุบัน
    var dateObj = new Date();
    var logId = "PML-" + Utilities.formatDate(dateObj, "GMT+7", "yyMMdd-HHmm");
    var timestamp = Utilities.formatDate(dateObj, "GMT+7", "dd/MM/yyyy HH:mm:ss");

    // 3. นำข้อมูลลงตารางแถวใหม่
    sheet.appendRow([
      logId,                       // A
      timestamp,                   // B
      data.sys1 || "",             // C
      data.sys2 || "",             // D
      data.sys3 || "",             // E
      data.sys4 || "",             // F
      data.maintenanceDetails || "", // G
      data.hasSpareParts || "",    // H
      data.spareDetails || "",     // I
      data.price || "",            // J
      data.supervisor || "",       // K
      data.cycle || "",            // L
      data.startTime || "",        // M
      "",                          // N - เวลาที่แล้วเสร็จ (ว่าง เพราะยังไม่เสร็จ)
      data.cause || "",            // O - สาเหตุ
      "Pending",                   // P - สถานะงาน
      data.workerType === 'ฝ่ายวิศวกรรม LPP' ? '✓' : '', // Q
      data.workerType === 'ผู้รับเหมาสัญญาจ้าง (MA)' ? '✓' : '', // R
      data.workerType === 'ผู้รับเหมาจ้างพิเศษ (รายครั้ง)' ? '✓' : '' // S
    ]);

    // ✅ ล้าง Cache Dashboard เพื่อให้อัปเดตทันที
    clearAllDashboardCache();

    return "✅ บันทึกข้อมูล PM สำเร็จ! รหัสอ้างอิง: " + logId;
    
  } catch (error) {
    console.error("Error in savePMRepairLog: " + error);
    return "❌ เกิดข้อผิดพลาด: " + error.toString();
  } finally {
    lock.releaseLock(); // ปลดล็อกเสมอ
  }
}

// =========================================
// ฟังก์ชันอัพเดตสถานะงาน PM
// =========================================
function updateJobStatus(jobId, newStatus) {
  requireRole(['admin', 'assistant'], 'updateJobStatus'); // 🔐
  try {
    var ss = SpreadsheetApp.openById(PM_DB_ID);
    var sheet = ss.getSheetByName('PM_Log');
    
    if (!sheet) {
      throw new Error("ไม่พบ PM_Log Sheet");
    }
    
    // ค้นหาแถวที่มี jobId ตรงกับคอลัมน์ A
    var data = sheet.getDataRange().getValues();
    var rowToUpdate = -1;
    
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] === jobId) {
        rowToUpdate = i + 1;
        break;
      }
    }
    
    if (rowToUpdate === -1) {
      throw new Error("ไม่พบงานที่มี ID: " + jobId);
    }
    
    // อัพเดตคอลัมน์ N (completeDate) และ P (สถานะ) โดยอิงจากสถานะ
    if (newStatus === 'Completed') {
      var dateObj = new Date();
      var completeDate = Utilities.formatDate(dateObj, "GMT+7", "dd/MM/yyyy");
      sheet.getRange(rowToUpdate, 14).setValue(completeDate); // Column N
      sheet.getRange(rowToUpdate, 16).setValue("Completed");  // Column P
    } else if (newStatus === 'Pending') {
      sheet.getRange(rowToUpdate, 14).setValue("");  // Column N
      sheet.getRange(rowToUpdate, 16).setValue("Pending"); // Column P
    }
    
    return "✅ อัพเดตสถานะงาน " + jobId + " เป็น " + newStatus + " เรียบร้อย";
  } catch (error) {
    throw new Error("อัพเดตไม่สำเร็จ: " + error.message);
  }
}

function saveINFLog(data) {
  requireAccess('saveINFLog'); // 🔐
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // รอคิว max 10 วินาที
    
    var ss = SpreadsheetApp.openById(INF_DB_ID);
    var sheetName = 'Infirmary_Log'; // 🔐 Bug fix: ลบ var sheetName = 'Infirmary_Form' ที่ซ้ำออก
    var sheet = ss.getSheetByName(sheetName);

    // เช็คว่าเจอ Sheet หรือไม่
    if (!sheet) {
      throw new Error("ไม่พบแผ่นงานชื่อ " + sheetName);
    }

    // 1. สร้างเวลาปัจจุบัน (Timestamp) และแยกวันที่/เวลา
    var now = new Date();
    var timestamp = Utilities.formatDate(now, "GMT+7", "dd/MM/yyyy HH:mm:ss");
    var dateStr = Utilities.formatDate(now, "GMT+7", "dd/MM/yyyy");
    var timeStr = Utilities.formatDate(now, "GMT+7", "HH:mm:ss");

    // 2. นำข้อมูลมาจัดเรียงเข้า Array ให้ตรงกับคอลัมน์ A - L
    // หมายเหตุ: ตรง data.col_A คือชื่อแอตทริบิวต์ 'name' ในหน้า HTML ที่เราตั้งไว้ก่อนหน้านี้
    var rowData = [
      timestamp,          // A: Timestamp (ระบบสร้างให้)
      dateStr,            // B: วันที่ (ระบบสร้างให้)
      timeStr,            // C: เวลา (ระบบสร้างให้)
      data.col_A || "",   // D: ชื่อ-นามสกุล
      data.col_B || "",   // E: เพศ
      data.col_C || "",   // F: หน่วยงาน
      data.col_D || "",   // G: กลุ่มโรค
      data.col_E || "",   // H: ยาที่เบิกจ่าย
      data.col_F || "",   // I: บันทึกเพิ่มเติม/ข้อเสนอแนะ
      data.col_G || "",   // J: ผู้บันทึก
      data.col_H || "",   // K: ชื่อพยาบาลผู้ตรวจรักษา
      data.col_I || ""    // L: ความเห็นแพทย์/พยาบาลเพิ่มเติม
    ];

    // 3. บันทึกข้อมูลลงบรรทัดใหม่ล่างสุดของ Sheet
    sheet.appendRow(rowData);

    // ✅ ล้าง Cache Dashboard เพื่อให้อัปเดตทันที
    clearAllDashboardCache();

    // 4. ส่งข้อความกลับไปแจ้งหน้าเว็บว่าทำงานสำเร็จ
    return "บันทึกข้อมูลการเข้าใช้ห้องพยาบาลสำเร็จเรียบร้อยครับ!";
    
  } catch (error) {
    // กรณีมี Error ให้ส่งข้อความแจ้งเตือนกลับไป
    return "❌ เกิดข้อผิดพลาดในการบันทึก: " + error.toString();
  } finally {
    lock.releaseLock(); // ปลดล็อกเสมอ
  }
}

function getInfirmaryDashboardData() {
  try {
    var ss = SpreadsheetApp.openById(INF_DB_ID);
    var sheet = ss.getSheetByName('Infirmary_Log');
    
    if (!sheet) {
      throw new Error("ไม่พบหน้า Infirmary_Log");
    }

    var data = sheet.getDataRange().getValues();
    var rows = data.slice(1); // ตัดแถวหัวข้อ (Header) ทิ้ง

    var todayStr = Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy");
    var stats = {
      todayCases: 0,
      totalCases: rows.length,
      diseaseCount: {},
      deptCount: {},
      medCount: {}
    };

    // วนลูปอ่านข้อมูลทีละบรรทัดเพื่อนับจำนวน
    rows.forEach(function(row) {
      // นับยอดวันนี้ (เช็คจากคอลัมน์ B)
      var rowDate = row[1];
      if (rowDate) {
        var dateFormatted = (rowDate instanceof Date) ? Utilities.formatDate(rowDate, "GMT+7", "dd/MM/yyyy") : rowDate.toString();
        if (dateFormatted === todayStr) stats.todayCases++;
      }

      var dept = row[5] ? row[5].toString().trim() : "";
      var disease = row[6] ? row[6].toString().trim() : "";
      var meds = row[7] ? row[7].toString().trim() : "";

      // นับกลุ่มโรค
      if (disease) stats.diseaseCount[disease] = (stats.diseaseCount[disease] || 0) + 1;
      // นับหน่วยงาน
      if (dept) stats.deptCount[dept] = (stats.deptCount[dept] || 0) + 1;
      
      // นับยาที่เบิกจ่าย (แยกด้วยการตัดคำด้วยเว้นวรรคหรือลูกน้ำเบื้องต้น)
      if (meds && meds !== "-") {
        var medList = meds.split(/[\n,]/); // แยกยาหลายตัวที่ขึ้นบรรทัดใหม่หรือมีลูกน้ำ
        medList.forEach(function(m) {
          var cleanMed = m.trim();
          if (cleanMed) {
            stats.medCount[cleanMed] = (stats.medCount[cleanMed] || 0) + 1;
          }
        });
      }
    });

    // ฟังก์ชันช่วยจัดเรียงจากมากไปน้อย
    function getTop(obj, limit) {
      var arr = Object.keys(obj).map(function(k) { return { name: k, count: obj[k] }; });
      arr.sort(function(a, b) { return b.count - a.count; }); // เรียงมากไปน้อย
      return limit ? arr.slice(0, limit) : arr;
    }

    // ส่งออกข้อมูลที่จัดเรียงแล้ว
    return {
      status: "success",
      todayCases: stats.todayCases,
      totalCases: stats.totalCases,
      topDiseases: getTop(stats.diseaseCount, 5), // Top 5 โรค
      topDepts: getTop(stats.deptCount, 3),       // Top 3 หน่วยงาน
      topMeds: getTop(stats.medCount, 10)         // Top 10 ยาที่จ่าย
    };

  } catch (error) {
    return { status: "error", message: error.toString() };
  }
}
// ==========================================
// ฟังก์ชันดึงข้อมูลวัสดุจาก Database (พัสดุ)
// ==========================================
function getMaterialData() {
  try {
    // ใช้ EQ_DB_ID ที่คุณประกาศไว้ด้านบนสุดของ Connect.js แล้ว
    var ss = SpreadsheetApp.openById(EQ_DB_ID);
    
    // ระบุชื่อชีตที่เก็บข้อมูลวัสดุ (หากใน Sheet จริงๆ ชื่ออื่น ให้แก้ตรงนี้นะครับ)
    var sheet = ss.getSheetByName('AssetConsume'); 
    
    if (!sheet) return null;
    
    var data = sheet.getDataRange().getValues();
    var materialMap = {}; // สร้าง Object เก็บข้อมูลเพื่อส่งให้หน้าเว็บ
    
    // เริ่มลูปที่ i=1 เพื่อข้ามหัวตาราง (Row 1)
    for (var i = 1; i < data.length; i++) {
      var itemName = data[i][1]; // Column B: ชื่อวัสดุ (Equipment Name)
      
      // ข้ามบรรทัดที่ไม่มีชื่อวัสดุ
      if (!itemName || itemName.toString().trim() === "") continue;
      
      var id = data[i][0] || "-";              // Column A: Equipment ID
      var unit = data[i][2] || "-";            // Column C: Unit
      var price = parseFloat(data[i][4]) || 0; // Column E: Price
      var stock = parseInt(data[i][5]) || 0;   // Column F: Count (จำนวนคงเหลือ)
      
      // นำชื่อวัสดุมาเป็น Key เพื่อให้ฝั่งหน้าเว็บค้นหาได้ง่าย
      materialMap[itemName.toString().trim()] = {
        id: id,
        unit: unit,
        price: price,
        stock: stock
      };
    }
    
    return materialMap;
  } catch (e) {
    console.error("Error in getMaterialData: " + e.toString());
    return null;
  }
}
// ==========================================
// ฟังก์ชันบันทึกข้อมูลการขอเบิกวัสดุ (พร้อมตัดสต็อก)
// ==========================================
function saveClaimData(data) {
  try {
    // ---------------------------------------------------------
    // ส่วนที่ 1: บันทึกข้อมูลลงรายงานของแต่ละแผนก (โค้ดเดิม)
    // ---------------------------------------------------------
    var ss = SpreadsheetApp.openById(CM_EQ_ID);
    var sheet = ss.getSheetByName(data.department);
    
    if (!sheet) {
      throw new Error("ไม่พบชีตสำหรับแผนก: " + data.department + " ในฐานข้อมูล");
    }
    
    var timestamp = Utilities.formatDate(new Date(), "Asia/Bangkok", "dd/MM/yyyy HH:mm:ss");
    var rowData = [
      timestamp, data.item, data.gfmis, data.unit, data.count, data.price, data.total, data.note, data.requester
    ];
    sheet.appendRow(rowData); // บันทึกลงชีตแผนก
    
    // ✅ ล้าง Cache Dashboard เพื่อให้อัปเดตทันที
    clearAllDashboardCache();
    
    // ---------------------------------------------------------
    // ส่วนที่ 2: ตัดสต็อกในฐานข้อมูลพัสดุ (เพิ่มใหม่)
    // ---------------------------------------------------------
    var eqSs = SpreadsheetApp.openById(EQ_DB_ID); // เปิดไฟล์พัสดุ
    var eqSheet = eqSs.getSheetByName('AssetConsume'); // เปิดชีต AssetConsume
    
    if (eqSheet) {
      var eqData = eqSheet.getDataRange().getValues();
      var claimCount = parseInt(data.count) || 0;
      
      // ลูปค้นหาชื่อวัสดุที่ตรงกับที่ถูกเบิกไป
      for (var i = 1; i < eqData.length; i++) {
        var currentItemName = eqData[i][1]; // Column B: Equipment Name
        
        if (currentItemName == data.item) {
          var currentStock = parseInt(eqData[i][5]) || 0; // Column F: Count
          var itemPrice = parseFloat(eqData[i][4]) || 0;  // Column E: Price
          
          // คำนวณสต็อกใหม่
          var newStock = currentStock - claimCount;
          if (newStock < 0) newStock = 0; // ป้องกันตัวเลขติดลบ
          
          // คำนวณมูลค่าคงเหลือใหม่ (จำนวนใหม่ * ราคาต่อหน่วย)
          var newTotalCost = newStock * itemPrice;
          
          // อัปเดตข้อมูลลงในชีต AssetConsume
          // แถวที่ i+1 (เพราะ index เริ่มที่ 0 แต่ แถว Sheet เริ่มที่ 1)
          eqSheet.getRange(i + 1, 6).setValue(newStock);      // คอลัมน์ F (ที่ 6) = จำนวนคงเหลือ
          eqSheet.getRange(i + 1, 7).setValue(newTotalCost);  // คอลัมน์ G (ที่ 7) = มูลค่ารวม
          
          break; // เจอและอัปเดตแล้ว ให้หยุดลูปทันที
        }
      }
    }

    // --------------------------------------------------------- 
    // ส่วนที่ 3: ล้าง Cache ของ Dashboard (เพราะข้อมูลเปลี่ยน)
    // ---------------------------------------------------------
    var cache = CacheService.getScriptCache();
    cache.remove("dashboard_summary"); // ล้าง Cache ทิ้งเพื่อให้คำนวณใหม่ครั้งต่อไป
    console.log("🗑️ ล้าง Cache Dashboard เพราะข้อมูลสต็อกเปลี่ยน");

    return "บันทึกข้อมูลและตัดสต็อกสำเร็จ!";
    
  } catch (e) {
    throw new Error(e.toString());
  }
}

// ==========================================
// SYSTEM-WIDE SUMMARY STATS (Data-Driven UI)
// ==========================================
/**
 * ฟังก์ชันดึงสรุปข้อมูลทั้งระบบ (สำหรับ Dashboard)
 * กวาดข้อมูลจากหลายๆ Sheet แล้วส่งเป็นตัวเลขสรุป (KPI)
 * ใช้ CacheService เพื่อป้องกันการอ่านจากฐานข้อมูลถี่เกินไป
 */
function getSummaryStats() {
  try {
    var cache = CacheService.getScriptCache();
    var cacheKey = 'systemSummaryStats';
    
    // เช็คว่าข้อมูลใน Cache ยังใหม่ไหม
    var cached = cache.get(cacheKey);
    if (cached) {
      console.log("📦 ใช้ข้อมูลจาก Cache (อ่านได้ว่องเร็ว)");
      return JSON.parse(cached);
    }

    var stats = {
      equipment: {
        total: 0,
        lowStock: 0,
        items: []
      },
      repairs: {
        pending: 0,
        completed: 0,
        total: 0
      },
      infirmary: {
        today: 0,
        total: 0,
        topDiseases: []
      },
      claims: {
        pending: 0,
        approved: 0,
        total: 0
      },
      van: {
        available: 0,
        inUse: 0,
        total: 0
      }
    };

    // ========== 1. EQUIPMENT DATA (จาก EQ_DB_ID) ==========
    try {
      var ssEQ = SpreadsheetApp.openById(EQ_DB_ID);
      var sheetEQ = ssEQ.getSheetByName('AssetConsume');
      if (sheetEQ) {
        var dataEQ = sheetEQ.getDataRange().getValues();
        stats.equipment.total = Math.max(0, dataEQ.length - 1);
        
        // นับของที่เหลือน้อย (Column 5 = จำนวนคงเหลือ, สมมติจำนวน <= 5 ถือว่าน้อย)
        dataEQ.slice(1).forEach(function(row) {
          var qty = row[5] ? parseInt(row[5]) : 0;
          if (qty <= 5 && qty > 0) {
            stats.equipment.lowStock++;
            stats.equipment.items.push({
              name: row[1] || 'ไม่ระบุ',
              qty: qty
            });
          }
        });
        stats.equipment.items = stats.equipment.items.slice(0, 5); // Top 5 เท่านั้น
      }
    } catch (eEQ) {
      console.warn("⚠️ ไม่สามารถอ่านข้อมูล Equipment: " + eEQ);
    }

    // ========== 2. REPAIR/PM DATA (จาก PM_DB_ID) ==========
    try {
      var ssPM = SpreadsheetApp.openById(PM_DB_ID);
      var sheetPM = ssPM.getSheetByName('RepairLogs');
      if (sheetPM) {
        var dataPM = sheetPM.getDataRange().getValues();
        stats.repairs.total = Math.max(0, dataPM.length - 1);
        
        // นับสถานะ (Column 4 = สถานะ)
        dataPM.slice(1).forEach(function(row) {
          var status = row[4] ? row[4].toString().toLowerCase() : '';
          if (status.includes('รอดำเนินการ') || status.includes('pending')) {
            stats.repairs.pending++;
          } else if (status.includes('เสร็จ') || status.includes('completed')) {
            stats.repairs.completed++;
          }
        });
      }
    } catch (ePM) {
      console.warn("⚠️ ไม่สามารถอ่านข้อมูล PM: " + ePM);
    }

    // ========== 3. INFIRMARY DATA (จาก INF_DB_ID) ==========
    try {
      var ssINF = SpreadsheetApp.openById(INF_DB_ID);
      var sheetINF = ssINF.getSheetByName('Infirmary');
      if (sheetINF) {
        var dataINF = sheetINF.getDataRange().getValues();
        stats.infirmary.total = Math.max(0, dataINF.length - 1);
        
        // นับวันนี้ (Column 2 = วันที่, สมมติ)
        var today = new Date();
        var todayStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        var diseaseCount = {};
        
        dataINF.slice(1).forEach(function(row) {
          var visitDate = row[2] ? Utilities.formatDate(new Date(row[2]), Session.getScriptTimeZone(), 'yyyy-MM-dd') : '';
          if (visitDate === todayStr) {
            stats.infirmary.today++;
          }
          
          // นับโรค (Column 6 = โรค)
          var disease = row[6] ? row[6].toString().trim() : '-';
          if (disease !== '-') {
            diseaseCount[disease] = (diseaseCount[disease] || 0) + 1;
          }
        });
        
        // เรียงโรค Top 3
        stats.infirmary.topDiseases = Object.keys(diseaseCount)
          .map(function(d) { return { name: d, count: diseaseCount[d] }; })
          .sort(function(a, b) { return b.count - a.count; })
          .slice(0, 3);
      }
    } catch (eINF) {
      console.warn("⚠️ ไม่สามารถอ่านข้อมูล Infirmary: " + eINF);
    }

    // ========== 4. CLAIMS DATA (จาก SHEET_ID) ==========
    try {
      var ssCLAIM = SpreadsheetApp.openById(SHEET_ID);
      var sheetCLAIM = ssCLAIM.getSheetByName('travel_requests');
      if (sheetCLAIM) {
        var dataCLAIM = sheetCLAIM.getDataRange().getValues();
        stats.claims.total = Math.max(0, dataCLAIM.length - 1);
        
        // นับสถานะอนุมัติ (Column 11 = สถานะ, สมมติ)
        dataCLAIM.slice(1).forEach(function(row) {
          var status = row[11] ? row[11].toString().toLowerCase() : '';
          if (status.includes('รอการอนุมัติ') || status.includes('pending')) {
            stats.claims.pending++;
          } else if (status.includes('อนุมัติ') || status.includes('approved')) {
            stats.claims.approved++;
          }
        });
      }
    } catch (eCLAIM) {
      console.warn("⚠️ ไม่สามารถอ่านข้อมูล Claims: " + eCLAIM);
    }

    // ========== 5. VAN DATA (จาก SHEET_ID) ==========
    try {
      var ssVAN = SpreadsheetApp.openById(SHEET_ID);
      var sheetVAN = ssVAN.getSheetByName('van_jobs');
      if (sheetVAN) {
        var dataVAN = sheetVAN.getDataRange().getValues();
        stats.van.total = Math.max(0, dataVAN.length - 1);
        
        // นับสถานะรถ (Column 6 = สถานะ)
        dataVAN.slice(1).forEach(function(row) {
          var status = row[6] ? row[6].toString().toLowerCase() : '';
          if (status.includes('รอรับ') || status.includes('pending')) {
            stats.van.available++;
          } else if (status.includes('ดำเนินการ') || status.includes('in-progress')) {
            stats.van.inUse++;
          }
        });
      }
    } catch (eVAN) {
      console.warn("⚠️ ไม่สามารถอ่านข้อมูล Van: " + eVAN);
    }

    // เก็บลง Cache 15 นาที
    cache.put(cacheKey, JSON.stringify(stats), 900);
    console.log("✅ getSummaryStats() ดำเนินการสำเร็จ");
    
    return stats;
    
  } catch (error) {
    console.error("❌ getSummaryStats() ผิดพลาด: " + error);
    return { error: error.toString() };
  }
}

// 1. ฟังก์ชันดึงข้อมูลพื้นฐานเมื่อเปิดแอป
function getAppData(clientEmail) {
  const user = getUserInfo(clientEmail);
  const configData = getAccountConfig(); 
  const customers = getCustomerData(); 
  const requests = getRequestsData(); 
  
  // ให้ระบบแอบทำความสะอาดถังขยะอัตโนมัติก่อนส่งข้อมูลให้หน้าบ้าน
  autoCleanTrash();
  
  const transSheet = SS.getSheetByName("Transactions");
  let transData = [];
  if (transSheet) {
    transData = transSheet.getDataRange().getValues();
  }
  
  const nextDoc = calculateNextDocNumber();
  
  let cleanTransactions = [];
  if (transData.length > 1) {
    cleanTransactions = transData.slice(1).map(row => {
      return row.map(cell => (cell instanceof Date) ? cell.toISOString() : cell);
    }).sort((a, b) => new Date(b[17] || b[1]) - new Date(a[17] || a[1])); 
  }
  
  const settingsSheet = SS.getSheetByName("Settings");
  let dashLayoutStr = settingsSheet.getRange(2, 6).getValue();
  let rolePermsStr = settingsSheet.getRange(2, 7).getValue();
  
  let globalLayout = { 
    cards: true, cashFlow: true, trend: true, pie: true, recent: true, topExpense: true, topIncome: true,
    theme: { primary: '#3B82F6', secondary: '#F97316' }
  };
  if (dashLayoutStr) { 
    try { 
      let parsed = JSON.parse(dashLayoutStr); 
      globalLayout = { ...globalLayout, ...parsed };
      if(!globalLayout.theme) globalLayout.theme = { primary: '#3B82F6', secondary: '#F97316' };
    } catch(e) {} 
  }
  
  let rolePerms = {
    'Admin': { viewDash: true, createEntry: true, viewList: true, editCat: true, manageTrash: true, manageCustomers: true, manageDash: true, accessSettings: true, developer: true },
    'ฝ่ายบัญชี': { viewDash: true, createEntry: true, viewList: true, editCat: true, manageTrash: true, manageCustomers: true, manageDash: false, accessSettings: true, developer: false },
    'การเงิน': { viewDash: true, createEntry: true, viewList: true, editCat: false, manageTrash: false, manageCustomers: true, manageDash: false, accessSettings: true, developer: false },
    'พนักงานทั่วไป': { viewDash: true, createEntry: true, viewList: false, editCat: false, manageTrash: false, manageCustomers: false, manageDash: false, accessSettings: false, developer: false }
  };
  if (rolePermsStr) { 
    try { 
      let parsed = JSON.parse(rolePermsStr);
      for(let key in parsed) {
         rolePerms[key] = { ...{ viewDash: false, createEntry: false, viewList: false, editCat: false, manageTrash: false, manageCustomers: false, manageDash: false, accessSettings: false, developer: false }, ...parsed[key] };
      }
    } catch(e) {} 
  }
  
  return {
    user: user,
    config: configData.tree,
    rawConfig: configData.raw, 
    customers: customers, 
    requests: requests,
    transactions: cleanTransactions,
    nextDoc: nextDoc,
    globalLayout: globalLayout,
    rolePerms: rolePerms, 
    appUrl: ScriptApp.getService().getUrl(),
    ssUrl: SS.getUrl()
  };
}

// -----------------------------------------------------------
// ลบถังขยะอัตโนมัติ (เกิน 7 วันลบทิ้งทันที)
// -----------------------------------------------------------
function autoCleanTrash() {
  const transSheet = SS.getSheetByName("Transactions");
  if (!transSheet) return;
  const transData = transSheet.getDataRange().getValues();
  const now = new Date().getTime();
  const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
  
  // ลบย้อนจากล่างขึ้นบน เพื่อไม่ให้บรรทัดคลาดเคลื่อน
  for (let i = transData.length - 1; i >= 1; i--) {
    if (transData[i][15] === 'Deleted') {
      let delDateStr = transData[i][17]; // คอลัมน์ R คือเวลาที่ลบ
      if (delDateStr) {
        let delDate = new Date(delDateStr).getTime();
        if (now - delDate > sevenDaysInMs) {
          transSheet.deleteRow(i + 1);
        }
      }
    }
  }

  // เข้าไปทำความสะอาดในแท็บ Trash สำรองด้วย
  const trashSheet = SS.getSheetByName("Trash");
  if(trashSheet){
     const tData = trashSheet.getDataRange().getValues();
     for(let i = tData.length - 1; i >= 1; i--){
        let delDateStr = tData[i][17]; 
        if(delDateStr){
           let delDate = new Date(delDateStr).getTime();
           if(now - delDate > sevenDaysInMs) {
              trashSheet.deleteRow(i + 1);
           }
        }
     }
  }
}

function saveDashboardLayout(layoutObj) {
  SS.getSheetByName("Settings").getRange(2, 6).setValue(JSON.stringify(layoutObj));
  return true;
}

function saveRolePermissions(permsObj) {
  SS.getSheetByName("Settings").getRange(2, 7).setValue(JSON.stringify(permsObj));
  return { success: true, message: "อัปเดตสิทธิ์การใช้งาน (Role Matrix) เรียบร้อยแล้ว" };
}

function saveCategoryConfig(rawConfigArray) {
  const sheet = SS.getSheetByName("Config");
  sheet.clearContents();
  sheet.appendRow(["category", "group", "type", "item"]);
  if (rawConfigArray && rawConfigArray.length > 0) {
    sheet.getRange(2, 1, rawConfigArray.length, 4).setValues(rawConfigArray);
  }
  return { success: true, message: "อัปเดตโครงสร้างหมวดหมู่บัญชีเรียบร้อยแล้ว" };
}

// 2. ฟังก์ชันตรวจสอบสิทธิ์ผู้ใช้
function getUserInfo(clientEmail) {
  let email = Session.getActiveUser().getEmail();
  if (!email || email.trim() === "") {
    if (clientEmail && clientEmail.trim() !== "") { email = clientEmail.trim(); } 
    else { return { email: "REQUIRE_EMAIL", role: "พนักงานทั่วไป" }; }
  }
  
  const sheet = SS.getSheetByName("User_Roles");
  if (!sheet) return { email: email, role: "พนักงานทั่วไป" };

  const data = sheet.getDataRange().getValues();
  let role = "พนักงานทั่วไป"; 
  let found = false;

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === email) {
      role = data[i][1] || "พนักงานทั่วไป";
      sheet.getRange(i + 1, 3).setValue(new Date()); 
      found = true; break;
    }
  }

  if (!found) {
    if (data.length <= 1) role = "Admin";
    sheet.appendRow([email, role, new Date()]);
  }
  return { email: email, role: role };
}

// ระบบ Helpdesk
function getRequestsData() {
  let sheet = SS.getSheetByName("Requests");
  if (!sheet) {
    sheet = SS.insertSheet("Requests");
    sheet.appendRow(["ID", "User", "Message", "Status", "Timestamp"]);
    sheet.getRange(1, 1, 1, 5).setFontWeight("bold").setBackground("#ED7D31").setFontColor("white");
    return [];
  }
  const data = sheet.getDataRange().getValues();
  if(data.length <= 1) return [];
  return data.slice(1).map(row => row.map(cell => (cell instanceof Date) ? cell.toISOString() : cell));
}

function submitFeatureRequest(message, clientEmail) {
  const user = getUserInfo(clientEmail);
  let sheet = SS.getSheetByName("Requests");
  if (!sheet) {
    sheet = SS.insertSheet("Requests");
    sheet.appendRow(["ID", "User", "Message", "Status", "Timestamp"]);
  }
  sheet.appendRow([Utilities.getUuid(), user.email, message, "Pending", new Date()]);
  return { success: true, message: "ส่งข้อเสนอแนะให้ทีมพัฒนารับทราบเรียบร้อยแล้ว" };
}

function updateRequestStatus(id, newStatus) {
  let sheet = SS.getSheetByName("Requests");
  if(!sheet) return false;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.getRange(i + 1, 4).setValue(newStatus);
      return { success: true, message: "อัปเดตสถานะคำร้องเรียบร้อยแล้ว" };
    }
  }
  return { success: false, message: "ไม่พบคำร้องนี้ในระบบ" };
}

// ระบบฐานข้อมูลลูกค้า
function getCustomerData() {
  let sheet = SS.getSheetByName("Customers");
  if (!sheet) {
    sheet = SS.insertSheet("Customers");
    sheet.appendRow(["ID", "Name", "TaxID", "Address", "LastUpdated"]);
    sheet.getRange(1, 1, 1, 5).setFontWeight("bold").setBackground("#5B9BD5").setFontColor("white");
    return [];
  }
  const data = sheet.getDataRange().getValues();
  if(data.length <= 1) return [];
  return data.slice(1).map(row => row.map(cell => (cell instanceof Date) ? cell.toISOString() : cell));
}

function saveCustomerData(customerObj) {
  let sheet = SS.getSheetByName("Customers");
  if (!sheet) {
    sheet = SS.insertSheet("Customers");
    sheet.appendRow(["ID", "Name", "TaxID", "Address", "LastUpdated"]);
  }
  
  const data = sheet.getDataRange().getValues();
  const id = customerObj.id || Utilities.getUuid();
  const now = new Date();
  
  if (customerObj.id) {
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === customerObj.id) {
        sheet.getRange(i + 1, 2).setValue(customerObj.name);
        sheet.getRange(i + 1, 3).setValue(customerObj.taxId);
        sheet.getRange(i + 1, 4).setValue(customerObj.address);
        sheet.getRange(i + 1, 5).setValue(now);
        return { success: true, message: "อัปเดตข้อมูลลูกค้าสำเร็จ" };
      }
    }
  } 
  
  sheet.appendRow([id, customerObj.name, customerObj.taxId || "", customerObj.address || "", now]);
  return { success: true, message: "เพิ่มฐานข้อมูลลูกค้าเรียบร้อยแล้ว" };
}

function deleteCustomerData(id) {
  const sheet = SS.getSheetByName("Customers");
  if (!sheet) return false;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) { sheet.deleteRow(i + 1); return true; }
  }
  return false;
}

// 3. ฟังก์ชันบันทึกหรือแก้ไขรายการรับ-จ่าย
function saveTransaction(formData, clientEmail) {
  const user = getUserInfo(clientEmail);
  const sheet = SS.getSheetByName("Transactions");
  const settingsSheet = SS.getSheetByName("Settings");
  
  let finalBook = formData.bookNo;
  let finalReceipt = formData.receiptNo;
  let currentVersion = 1;
  let transactionId = formData.id || Utilities.getUuid();

  if (!formData.id) {
    const next = calculateNextDocNumber(); 
    if (!formData.isManual) {
      let newSettingsRow = [ next.base.incBook, next.base.incRec, next.base.expBook, next.base.expRec, "'" + next.currentMonth ];
      if (formData.category === 'รายรับ') {
        finalBook = next.income.bookNo; finalReceipt = next.income.receiptNo;
        newSettingsRow[0] = finalBook; newSettingsRow[1] = finalReceipt;
      } else {
        finalBook = next.expense.bookNo; finalReceipt = next.expense.receiptNo;
        newSettingsRow[2] = finalBook; newSettingsRow[3] = finalReceipt;
      }
      settingsSheet.getRange(2, 1, 1, 5).setValues([newSettingsRow]);
    } else {
      let incBook = next.base.incBook; let incRec = next.base.incRec; let expBook = next.base.expBook; let expRec = next.base.expRec;
      if (formData.category === 'รายรับ') {
        incBook = parseInt(formData.bookNo) || incBook; incRec = parseInt(formData.receiptNo) || incRec;
      } else {
        expBook = parseInt(formData.bookNo) || expBook; expRec = parseInt(formData.receiptNo) || expRec;
      }
      settingsSheet.getRange(2, 1, 1, 5).setValues([[incBook, incRec, expBook, expRec, "'" + next.currentMonth]]);
    }
  }

  if (formData.id) {
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === formData.id && data[i][15] === 'Active') {
        sheet.getRange(i + 1, 16).setValue('Modified');
        const oldGroup = data[i][8]; 
        currentVersion = parseInt(data[i][16] || 1);
        if ((oldGroup === '-' || oldGroup === '') && (formData.group !== '-' && formData.group !== '')) {
        } else { currentVersion += 1; }
        break;
      }
    }
  }

  const rowData = [
    transactionId, new Date(formData.transactionDate), finalBook, finalReceipt, formData.payerName, formData.taxId || "",
    formData.address || "", formData.category || "-", formData.group || "-", formData.type || "-", formData.item || "-",
    formData.amount, formData.paymentMethod, formData.description || "", user.email, "Active", currentVersion, new Date() 
  ];
  sheet.appendRow(rowData); return { success: true };
}

// 4. คำนวณเลขที่เอกสาร
function calculateNextDocNumber() {
  const sheet = SS.getSheetByName("Settings");
  const values = sheet.getDataRange().getValues();
  const data = values.length > 1 ? values[1] : [1, 0, 1, 0, ""];
  
  let incBook = parseInt(data[0]); if (isNaN(incBook)) incBook = 1;
  let incRec = parseInt(data[1]); if (isNaN(incRec)) incRec = 0;
  let expBook = parseInt(data[2]); if (isNaN(expBook)) expBook = 1;
  let expRec = parseInt(data[3]); if (isNaN(expRec)) expRec = 0;
  
  let lastMonthRaw = data[4]; let lastMonth = "";
  if (lastMonthRaw instanceof Date) { lastMonth = lastMonthRaw.getFullYear() + "-" + String(lastMonthRaw.getMonth() + 1).padStart(2, '0'); } 
  else if (lastMonthRaw) { lastMonth = String(lastMonthRaw).trim(); }

  const now = new Date(); const currentMonthStr = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, '0');
  if (lastMonth !== currentMonthStr && lastMonth !== "") { incBook += 1; incRec = 0; expBook += 1; expRec = 0; }

  let nextIncRec = incRec + 1; let nextIncBook = incBook;
  if (nextIncRec > 99) { nextIncRec = 1; nextIncBook += 1; } 

  let nextExpRec = expRec + 1; let nextExpBook = expBook;
  if (nextExpRec > 99) { nextExpRec = 1; nextExpBook += 1; }

  return { income: { bookNo: nextIncBook, receiptNo: nextIncRec }, expense: { bookNo: nextExpBook, receiptNo: nextExpRec }, base: { incBook, incRec, expBook, expRec }, currentMonth: currentMonthStr };
}

// 5. โครงสร้างบัญชี
function getAccountConfig() {
  const sheet = SS.getSheetByName("Config");
  if (!sheet) return { tree: {}, raw: [] };
  const data = sheet.getDataRange().getValues();
  const rawArray = data.slice(1).filter(row => row[0]); 
  const config = {};
  for (let i = 1; i < data.length; i++) {
    if (data[i].length < 4) continue;
    const [cat, group, type, item] = data[i];
    if (!cat) continue;
    if (!config[cat]) config[cat] = {}; if (!config[cat][group]) config[cat][group] = {}; if (!config[cat][group][type]) config[cat][group][type] = [];
    if (item && !config[cat][group][type].includes(item)) config[cat][group][type].push(item);
  }
  return { tree: config, raw: rawArray };
}

// 6. ลบรายการลงถังขยะ
function deleteTransaction(id, clientEmail) {
  const user = getUserInfo(clientEmail);
  const sheet = SS.getSheetByName("Transactions");
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      const now = new Date();
      sheet.getRange(i + 1, 16).setValue('Deleted');
      sheet.getRange(i + 1, 18).setValue(now); // เซฟเวลาที่ลบลงไปในช่อง R เพื่อให้ระบบถังขยะนับเวลาได้    
      
      let rowData = data[i].slice(0, 17);
      rowData[15] = 'Deleted'; rowData[17] = now; rowData[18] = user.email; 
      SS.getSheetByName("Trash").appendRow(rowData);
      return true;
    }
  }
  return false;
}

// กู้คืน
function restoreTransaction(id, clientEmail) {
  const sheet = SS.getSheetByName("Transactions");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.getRange(i + 1, 16).setValue('Active');
      return true;
    }
  }
  return false;
}

// ลบถาวร
function deleteTransactionPermanently(id, clientEmail) {
  const sheet = SS.getSheetByName("Transactions");
  const data = sheet.getDataRange().getValues();
  let deleted = false;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) { sheet.deleteRow(i + 1); deleted = true; break; }
  }
  const trashSheet = SS.getSheetByName("Trash");
  if (trashSheet) {
    const trashData = trashSheet.getDataRange().getValues();
    for (let i = trashData.length - 1; i >= 1; i--) {
      if (trashData[i][0] === id) { trashSheet.deleteRow(i + 1); }
    }
  }
  return deleted;
}

function getAllUsers() {
  const sheet = SS.getSheetByName("User_Roles");
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues().slice(1);
  return data.map(row => row.map(cell => (cell instanceof Date) ? cell.toISOString() : cell));
}
function updateUserRole(email, newRole) {
  const sheet = SS.getSheetByName("User_Roles"); const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) { if (data[i][0] === email) { sheet.getRange(i + 1, 2).setValue(newRole); return true; } } return false;
}
function deleteUserRole(email) {
  const sheet = SS.getSheetByName("User_Roles"); const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) { if (data[i][0] === email) { sheet.deleteRow(i + 1); return true; } } return false;
}
function safeSetSharingView(file) {
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e1) { try { file.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW); } catch (e2) {} }
}
function extractIdFromUrl(url) {
  if (!url) return ""; url = url.toString().trim(); if (!url.includes("http")) return url; 
  let docMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/); if (docMatch) return docMatch[1];
  let folderMatch = url.match(/\/folders\/([a-zA-Z0-9-_]+)/); if (folderMatch) return folderMatch[1];
  let idMatch = url.match(/id=([a-zA-Z0-9-_]+)/); if (idMatch) return idMatch[1];
  return url; 
}

// 9. สร้าง PDF
function generatePDF(transactionId, templateName) {
  try {
    const sheet = SS.getSheetByName("Transactions");
    const data = sheet.getDataRange().getValues();
    let t = null;
    for (let i = 1; i < data.length; i++) { if (data[i][0] === transactionId && data[i][15] === 'Active') { t = data[i]; break; } }
    if (!t) throw new Error("ไม่พบข้อมูลรายการที่ใช้งานอยู่");

    const tplSheet = SS.getSheetByName("Template_Configs");
    if (!tplSheet) throw new Error("ไม่พบแผ่นงานชื่อ Template_Configs ในฐานข้อมูล");
    
    const tplData = tplSheet.getDataRange().getValues();
    let folderId = (tplData.length > 0 && tplData[0].length > 2) ? extractIdFromUrl(tplData[0][2]) : ""; 
    let docId = "";
    for (let i = 1; i < tplData.length; i++) { if (tplData[i].length > 1 && tplData[i][0] === templateName) { docId = extractIdFromUrl(tplData[i][1]); break; } }
    if (!docId) throw new Error("ไม่พบ Doc ID หรือ Link สำหรับ " + templateName);

    const dateObj = new Date(t[1]);
    const months = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
    const formattedDate = `${dateObj.getDate()} ${months[dateObj.getMonth()]} ${dateObj.getFullYear() + 543}`;
    const amountStr = parseFloat(t[11]).toLocaleString('th-TH', {minimumFractionDigits: 2});
    const amountText = ThaiBahtText(t[11]);

    let baseFile;
    try { baseFile = DriveApp.getFileById(docId); } catch (e) { throw new Error("ระบบไม่สามารถเข้าถึงไฟล์ Template ได้"); }
    if (!baseFile) throw new Error("ไม่พบไฟล์ Template ต้นฉบับ");

    let tempFile;
    try { tempFile = baseFile.makeCopy(`Receipt_${t[2]}_${t[3]}`); } catch (e) { throw new Error("ไม่สามารถสร้างสำเนาเอกสารจาก Template ได้"); }
    
    const tempDoc = DocumentApp.openById(tempFile.getId());
    const body = tempDoc.getBody();

    body.replaceText("<<Book_No>>", t[2]); body.replaceText("<<Receipt_No>>", t[3]); body.replaceText("<<Date>>", formattedDate);
    body.replaceText("<<Payer_Name>>", t[4]); body.replaceText("<<Tax_ID>>", t[5] || "-");
    
    let addressText = t[6] || "-";
    try {
      let parsed = JSON.parse(addressText); let parts = [];
      if(parsed.line1) parts.push(parsed.line1); if(parsed.subDistrict) parts.push("แขวง/ต." + parsed.subDistrict);
      if(parsed.district) parts.push("เขต/อ." + parsed.district); if(parsed.province) parts.push("จ." + parsed.province);
      if(parsed.zip) parts.push(parsed.zip); addressText = parts.join(" ");
    } catch(e) {}
    
    body.replaceText("<<Address>>", addressText); body.replaceText("<<Description>>", t[13] || t[10] || "-");
    body.replaceText("<<Total_Amount>>", amountStr); body.replaceText("<<Amount_Text>>", amountText);

    body.replaceText("<<No_1>>", "1"); body.replaceText("<<Item_1>>", t[10] || t[13]); body.replaceText("<<Price_1>>", amountStr); body.replaceText("<<Qty_1>>", "1"); body.replaceText("<<Total_1>>", amountStr);
    body.replaceText("<<No_2>>", ""); body.replaceText("<<Item_2>>", ""); body.replaceText("<<Price_2>>", ""); body.replaceText("<<Qty_2>>", ""); body.replaceText("<<Total_2>>", "");
    body.replaceText("<<No_3>>", ""); body.replaceText("<<Item_3>>", ""); body.replaceText("<<Price_3>>", ""); body.replaceText("<<Qty_3>>", ""); body.replaceText("<<Total_3>>", "");
    tempDoc.saveAndClose();

    let targetFolder;
    try { targetFolder = folderId ? DriveApp.getFolderById(folderId) : DriveApp.getRootFolder(); } catch(err) { targetFolder = DriveApp.getRootFolder(); }
    const pdfBlob = tempFile.getAs(MimeType.PDF);
    const pdfFile = targetFolder.createFile(pdfBlob);
    pdfFile.setName(`ใบเสร็จ_${t[4]}_เล่ม${t[2]}_เลขที่${t[3]}.pdf`);
    
    safeSetSharingView(pdfFile); tempFile.setTrashed(true);
    return { success: true, url: pdfFile.getUrl(), fileId: pdfFile.getId() };
  } catch (error) { return { success: false, message: error.toString() }; }
}

function ThaiBahtText(Number) {
    if (Number == null || Number === "") return "ศูนย์บาทถ้วน"; Number = Number.toString().replace(/[, ]/g, ''); if (isNaN(Number)) return "ศูนย์บาทถ้วน";
    Number = parseFloat(Number).toFixed(2);
    let txtNumArr = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า", "สิบ"]; let txtDigitArr = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];
    let BahtText = ""; let numberArray = Number.split("."); let integerPart = numberArray[0]; let fractionalPart = numberArray[1];
    if (integerPart === "0" && fractionalPart === "00") return "ศูนย์บาทถ้วน";
    let processPart = (part) => {
        let result = ""; let len = part.length;
        for (let i = 0; i < len; i++) {
            let n = parseInt(part.charAt(i));
            if (n !== 0) {
                if (i === (len - 1) && n === 1 && len > 1) { result += "เอ็ด"; } 
                else if (i === (len - 2) && n === 2) { result += "ยี่"; } 
                else if (i === (len - 2) && n === 1) { result += ""; } 
                else { result += txtNumArr[n]; } result += txtDigitArr[len - i - 1];
            }
        } return result;
    };
    if (integerPart !== "0") BahtText += processPart(integerPart) + "บาท";
    if (fractionalPart === "00") { BahtText += "ถ้วน"; } else { BahtText += processPart(fractionalPart) + "สตางค์"; }
    return BahtText;
}

function deleteTempFile(fileId) { try { if (fileId) DriveApp.getFileById(fileId).setTrashed(true); } catch (e) {} }

function cleanupOldPDFs() {
  try {
    const tplSheet = SS.getSheetByName("Template_Configs");
    if (!tplSheet) return; const data = tplSheet.getDataRange().getValues();
    if (data.length === 0 || data[0].length < 3) return; const folderId = extractIdFromUrl(data[0][2]); if (!folderId) return;
    let folder; try { folder = DriveApp.getFolderById(folderId); } catch (e) { return; }
    const files = folder.getFilesByType(MimeType.PDF);
    const now = new Date().getTime(); const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000; 
    while (files.hasNext()) { const file = files.next(); if ((now - file.getDateCreated().getTime()) > sevenDaysInMs) { file.setTrashed(true); } }
  } catch (error) {}
}

function getUserRoleData() {
  try {
    // เรียกใช้ config ID ฐานข้อมูลของคุณ (จากฟังก์ชัน getConfig ที่มีอยู่แล้ว)
    var config = getConfig();
    
    // ลองเปิด Spreadsheet จาก EQ_DB_ID ก่อน (ฐานข้อมูล Equipment)
    var ssId = config.EQ_DB_ID || config.SHEET_ID; 
    var ss = SpreadsheetApp.openById(ssId);
    var sheet = ss.getSheetByName("UserRole");
    
    // หากไม่พบชีต ให้ลองหาใน SHEET_ID สำรอง
    if (!sheet && config.SHEET_ID) {
      ss = SpreadsheetApp.openById(config.SHEET_ID);
      sheet = ss.getSheetByName("UserRole");
    }
    
    if (!sheet) {
      throw new Error("ไม่พบแผ่นงานชื่อ 'UserRole' ในระบบฐานข้อมูล");
    }
    
    // ดึงข้อมูลทั้งหมดในชีต (รวมหัวตาราง) คืนค่าออกมาเป็น Array 2 มิติ
    // ใช้ getDisplayValues() เพื่อให้ได้ค่า Text ที่แสดงผลบนเซลล์ตรงๆ ป้องกันปัญหาเรื่อง Format
    var data = sheet.getDataRange().getDisplayValues();
    
    return data;
  } catch (error) {
    Logger.log("Error in getUserRoleData: " + error.toString());
    throw new Error(error.message); // โยน Error กลับไปให้หน้าบ้านแจ้งเตือน
  }
}

function updateUserRoleInSheet(targetEmail, newRole) {
  // 🔐 Admin แก้ได้ทุก role / Assistant แก้ได้เฉพาะ User
  var profile = requireRole(['admin', 'assistant'], 'updateUserRoleInSheet');
  if (profile.role === 'assistant') {
    var forbidden = ['admin', 'assistant'];
    if (forbidden.indexOf(newRole.toLowerCase()) !== -1) {
      throw new Error('🔒 Assistant ไม่มีสิทธิ์กำหนด role เป็น "' + newRole + '"');
    }
  }
  try {
    var config = getConfig();
    var ssId = config.EQ_DB_ID || config.SHEET_ID; 
    var ss = SpreadsheetApp.openById(ssId);
    var sheet = ss.getSheetByName("UserRole");
    
    if (!sheet) throw new Error("ไม่พบแผ่นงานชื่อ 'UserRole'");

    var emails = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues();
    for (var i = 1; i < emails.length; i++) {
      if (emails[i][0] === targetEmail) {
        sheet.getRange(i + 1, 5).setValue(newRole);
        logAudit('UPDATE_ROLE', profile.email + ' เปลี่ยน role ของ ' + targetEmail + ' → ' + newRole, 'INFO');
        return "Success";
      }
    }
    throw new Error("ไม่พบอีเมลผู้ใช้งานรายนี้ในระบบ");
  } catch (error) {
    Logger.log("Error in updateUserRoleInSheet: " + error.toString());
    throw new Error(error.message);
  }
}

function addUserRoleData(formData) {
  requireRole(['admin'], 'addUserRoleData'); // 🔐
  try {
    var config = getConfig();
    var ssId = config.EQ_DB_ID || config.SHEET_ID; 
    var ss = SpreadsheetApp.openById(ssId);
    var sheet = ss.getSheetByName("UserRole");
    
    if (!sheet) throw new Error("ไม่พบแผ่นงานชื่อ 'UserRole'");

    // ตรวจสอบว่ามีอีเมลนี้อยู่ในระบบหรือยัง
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === formData.email) {
        throw new Error("อีเมลนี้มีอยู่ในระบบแล้ว ไม่สามารถเพิ่มซ้ำได้");
      }
    }

    // ลำดับข้อมูลที่จะบันทึกตามหัวคอลัมน์ใน Sheet: G-mail, Name, Department, Tel, Role
    sheet.appendRow([
      formData.email,
      formData.name,
      formData.department,
      "'" + formData.tel,
      formData.role
    ]);
    logAudit('ADD_USER', 'เพิ่มสมาชิก ' + formData.email + ' role:' + formData.role, 'INFO');
    return "Success";
  } catch (error) {
    Logger.log("Error in addUserRoleData: " + error.toString());
    throw new Error(error.message);
  }
}

// =========================================================
// 1. ดึงข้อมูลครุภัณฑ์ทั้งหมดเพื่อส่งไปทำ Validation แบบรวดเร็ว
// =========================================================
function getAllEquipmentMasterData() {
  try {
    var config = getConfig();
    var ssId = config.EQ_DB_ID || config.SHEET_ID; 
    var ss = SpreadsheetApp.openById(ssId);
    
    // รายชื่อแท็บที่เก็บครุภัณฑ์ทั้งหมดของคุณ
    var sheetNames = ["สำนักงาน", "คอมพิวเตอร์", "ยานพาหนะเเละขนส่ง", "ไฟฟ้าเเละวิทยุ", "โฆษณาและเผยแพร่", "วิทยาศาสตร์และการแพทย์", "งานบ้านงานครัว", "กีฬา", "สินทรัพย์ไม่มีตัวตน"];
    
    var masterData = {}; // Object เก็บ { "รหัส": { name: "ชื่อ", status: "สถานะ" } }

    sheetNames.forEach(function(sName) {
      var sheet = ss.getSheetByName(sName);
      if (sheet) {
        var data = sheet.getDataRange().getValues();
        // วนลูปอ่านข้อมูลข้ามหัวตาราง (เริ่มแถว 1)
        for (var i = 1; i < data.length; i++) {
          var eqId = data[i][2]; // สมมติว่ารหัสครุภัณฑ์อยู่คอลัมน์ C (Index 2)
          var eqName = data[i][4] || data[i][3]; // ชื่อรายการ 
          var eqStatus = data[i][15] || data[i][12] || "ปกติ"; // ดึงสถานะ
          
          if (eqId) {
            masterData[eqId.toString().trim()] = {
              name: eqName,
              status: eqStatus
            };
          }
        }
      }
    });

    return masterData;
  } catch (error) {
    Logger.log("Error in getAllEquipmentMasterData: " + error);
    throw new Error(error.message);
  }
}

// =========================================================
// 2. บันทึกข้อมูลการยืม/เบิกครุภัณฑ์ แบบจำนวนมาก (Bulk Insert)
// =========================================================
function saveBulkEquipmentClaim(formData, itemsArray, imageData) {
  requireAccess('saveBulkEquipmentClaim');
  try {
    var config = getConfig();
    var ss = SpreadsheetApp.openById(config.EQ_DB_ID || config.SHEET_ID);
    var rentSheet = ss.getSheetByName('AssetRent');
    if (!rentSheet) {
      rentSheet = ss.insertSheet('AssetRent');
      rentSheet.appendRow([
        'Equipment ID','Equipment Name','Model/Brand','Borrow',
        'Borrower Name','Borrow Date','Return Date','Borrowing Remark',
        'Usage Status','Inspection Date','Inspection Result',
        'Acceptance Date','Acceptance Result','Storage Location',
        'Responsible Person','Note','Asset Image'
      ]);
    }

    // ── อัพโหลดรูปภาพหลักฐานทั้งหมดไป Drive ──
    var imageUrls = [];
    if (imageData && imageData.length > 0) {
      var folder = _getOrCreateFolder('TIJ_Bulk_Claim_Evidence');
      var dateStr = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd_HHmmss');

      imageData.forEach(function(img, idx) {
        try {
          var base64   = img.base64 || (img.dataUrl ? img.dataUrl.split(';base64,')[1] : null);
          var mimeType = img.mimeType || 'image/jpeg';
          var fname    = (dateStr + '_' + (idx + 1) + '_' + (img.name || 'evidence.jpg'));
          if (!base64) return;
          var blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, fname);
          var file = folder.createFile(blob);
          safeSetSharingView(file);
          imageUrls.push(file.getUrl());
        } catch (imgErr) {
          Logger.log('bulk image upload error [' + idx + ']: ' + imgErr);
        }
      });
    }

    var imgUrlStr   = imageUrls.join(', ');  // เก็บ URL รวมในคอลัมน์เดียว
    var claimType   = formData.claimType || 'เบิก';
    var returnDate  = formData.returnDate || '';
    var tel         = formData.tel || '';
    var remarkStr   = (formData.location || '') +
                      (tel ? ' | Tel: ' + tel : '') +
                      (imageUrls.length ? ' | รูป: ' + imageUrls.length + ' ภาพ' : '');

    var rowsToInsert = itemsArray.map(function(item) {
      return [
        "'" + item.id,          // Equipment ID
        item.name,              // Equipment Name
        '',                     // Model/Brand
        claimType,              // Borrow type
        formData.requester,     // Borrower Name
        formData.date,          // Borrow Date
        returnDate,             // Return Date
        remarkStr,              // Remark
        'เบิก/ยืม',            // Usage Status
        '', '',                 // Inspection
        '', '',                 // Acceptance
        formData.location || '',// Storage Location
        formData.department,    // Responsible
        '',                     // Note
        imgUrlStr               // Asset Image (URLs)
      ];
    });

    if (rowsToInsert.length > 0) {
      var lastRow = rentSheet.getLastRow();
      rentSheet.getRange(lastRow + 1, 1, rowsToInsert.length, rowsToInsert[0].length)
               .setValues(rowsToInsert);
    }

    logAudit('BULK_CLAIM',
      formData.requester + ' | ' + formData.department +
      ' | ' + itemsArray.length + ' items | ' + imageUrls.length + ' images',
      'INFO');

    return { success: true, count: rowsToInsert.length, images: imageUrls.length };

  } catch (e) {
    Logger.log('Error saveBulkEquipmentClaim: ' + e);
    throw new Error(e.message);
  }
}

function _getOrCreateFolder(folderName) {
  var folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(folderName);
}

function saveBulkAddEquipment(categoryName, dataArray) {
  try {
    var config = getConfig();
    var ssId = config.EQ_DB_ID || config.SHEET_ID; 
    var ss = SpreadsheetApp.openById(ssId);
    
    // ค้นหา Sheet ตามชื่อหมวดหมู่ที่ส่งมา (เช่น สำนักงาน, คอมพิวเตอร์)
    var sheet = ss.getSheetByName(categoryName);
    if (!sheet) {
      throw new Error("ไม่พบแผ่นงาน (Sheet) ชื่อ: " + categoryName + " ในฐานข้อมูล");
    }
    
    if (dataArray && dataArray.length > 0) {
      // วนลูปเพื่อจัดการเรื่อง "เลข 0 หาย" ก่อนบันทึกลง Sheet
      for (var r = 0; r < dataArray.length; r++) {
        for (var c = 0; c < dataArray[r].length; c++) {
          var val = String(dataArray[r][c] || "").trim();
          
          // ถ้าข้อมูลเป็นตัวเลขและขึ้นต้นด้วย 0 (เช่น S/N 01234 หรือเบอร์โทร 08X) 
          // ให้เติม ' (Apostrophe) นำหน้า เพื่อบังคับให้ Sheet มองเป็นข้อความ
          if (/^0[0-9]+$/.test(val)) {
             dataArray[r][c] = "'" + val;
          }
        }
      }

      var lastRow = sheet.getLastRow();
      var numRows = dataArray.length;
      var numCols = dataArray[0].length;
      
      // บันทึกข้อมูลทีเดียว (Batch Insert) รวดเร็วมากรองรับ 500+ บรรทัด
      sheet.getRange(lastRow + 1, 1, numRows, numCols).setValues(dataArray);
    }

    return "Success";
  } catch (error) {
    Logger.log("Error in saveBulkAddEquipment: " + error);
    throw new Error(error.message);
  }
}

// =========================================================
// สรุปข้อมูลสำหรับแสดงผลบน Dashboard (Dashboard Summary)
// =========================================================
function getDashboardSummary(timeRange) {
  try {
    var config = getConfig();
    var ssDR = SpreadsheetApp.openById(config.DR_DB_ID); // ตารางรายการครุภัณฑ์
    var ssEQ = SpreadsheetApp.openById(config.EQ_DB_ID); // Equipment_DB (สต็อกวัสดุ)

    var today = new Date();
    var cutoffDate = new Date(0);
    if (timeRange === 'week')         { cutoffDate = new Date(today.getTime() - 7*24*60*60*1000); }
    else if (timeRange === 'month')   { cutoffDate = new Date(today); cutoffDate.setMonth(cutoffDate.getMonth()-1); }
    else if (timeRange === '3months') { cutoffDate = new Date(today); cutoffDate.setMonth(cutoffDate.getMonth()-3); }
    else if (timeRange === '6months') { cutoffDate = new Date(today); cutoffDate.setMonth(cutoffDate.getMonth()-6); }
    else if (timeRange === 'year')    { cutoffDate = new Date(today); cutoffDate.setFullYear(cutoffDate.getFullYear()-1); }
    var isAllTime = (!timeRange || timeRange === 'all');

    var totalItems_Eq = 0, totalItems_Mat = 0;
    var totalQty_Eq   = 0, totalQty_Mat   = 0;
    var totalValue_Eq = 0, totalValue_Mat  = 0;
    var totalNetValue_Eq = 0, totalNetValue_Mat = 0;
    var lowStockCount = 0;
    var valueByCategory = {};
    var statusCount = { all:{}, eq:{}, mat:{} };

    // ── Helpers ──────────────────────────────────────────────────────────
    function parseDate(val) {
      if (!val) return null;
      if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
      if (typeof val === 'number') return new Date(Math.round((val - 25569) * 86400 * 1000));
      var s = String(val).trim();
      var p = s.split('/');
      if (p.length === 3) return new Date(parseInt(p[2]), parseInt(p[1])-1, parseInt(p[0]));
      var d = new Date(s);
      return isNaN(d.getTime()) ? null : d;
    }

    // ค้นหา index ของ column จาก header (คืน -1 ถ้าไม่เจอ)
    function findCol(headers, keyword, exact) {
      for (var i = 0; i < headers.length; i++) {
        var h = String(headers[i]).trim();
        if (exact ? h === keyword : h.indexOf(keyword) !== -1) return i;
      }
      return -1;
    }

    function addStatus(obj, status, qty) {
      if (!obj[status]) obj[status] = 0;
      obj[status] += qty;
    }

    function calcNet(val, date, lifeYrs) {
      if (!val || !date || lifeYrs <= 0) return val || 0;
      var days = Math.floor((today - date) / (1000*3600*24));
      if (days <= 0) return val;
      var depr = (val / lifeYrs / 365) * days;
      return depr >= val - 1 ? 1 : (val - depr);
    }

    // ── Sheet ที่ข้ามไป (สรุป/Pivot) ──────────────────────────────────────
    var SKIP = { 'รายการรวมเเยกประเภท':1, 'รายการรวมแยกประเภท':1, 'ตาราง Pivot 1':1 };

    // ====================================================================
    // 1.  DR_DB_ID — ตารางรายการครุภัณฑ์
    //     sheet ปกติ  = ครุภัณฑ์ (Eq)
    //     sheet (ว)   = วัสดุ (Mat)
    // ====================================================================
    var drSheets = ssDR.getSheets();
    drSheets.forEach(function(sheet) {
      var sheetName = sheet.getName();
      if (SKIP[sheetName] || sheet.getLastRow() <= 1) return;

      var isMat   = sheetName.indexOf('(ว)') !== -1;
      var catName = sheetName.replace(' (ว)', '').replace('(ว)', '').trim();
      var data    = sheet.getDataRange().getValues();
      var headers = data[0];

      // ค้นหา column index จากชื่อ header (รองรับ structure ต่างกันในแต่ละ sheet)
      var qtyIdx  = findCol(headers, 'จำนวน',        false); if (qtyIdx  === -1) qtyIdx  = 0;
      var valIdx  = findCol(headers, 'มูลค่า',        false);
      var dateIdx = findCol(headers, 'วันที่รับเข้า', false);
      var statIdx = findCol(headers, 'สถานะ',         true);   // exact match
      var nameIdx = findCol(headers, 'รายการ',        false);  if (nameIdx === -1) nameIdx = 3;
      var lifeIdx = findCol(headers, 'อายุค่าเสื่อม', false);

      if (valIdx === -1) return; // ไม่มี column มูลค่า ข้ามไป

      for (var r = 1; r < data.length; r++) {
        var row = data[r];
        // ข้ามแถวว่าง
        if (!row[nameIdx] && !row[2]) continue;

        var qty     = parseFloat(row[qtyIdx]) || 1;
        var val     = parseFloat(row[valIdx]) || 0;
        var rowDate = dateIdx !== -1 ? parseDate(row[dateIdx]) : null;
        var status  = (statIdx !== -1 && row[statIdx]) ? String(row[statIdx]).trim() : 'ปกติ';
        if (!status || status === '') status = 'ปกติ';
        var lifeYrs = (lifeIdx !== -1 && row[lifeIdx]) ? (parseFloat(row[lifeIdx]) || (isMat ? 3 : 5)) : (isMat ? 3 : 5);

        if (!isAllTime && (!rowDate || rowDate < cutoffDate)) continue;

        // ครุภัณฑ์คิดค่าเสื่อม, วัสดุไม่คิด
        var netVal = isMat ? val : calcNet(val, rowDate, lifeYrs);

        if (!valueByCategory[catName]) valueByCategory[catName] = { eq:0, mat:0 };

        if (isMat) {
          totalItems_Mat++;
          totalQty_Mat      += qty;
          totalValue_Mat    += val;
          totalNetValue_Mat += netVal;
          valueByCategory[catName].mat += netVal;
          if (qty <= 5) lowStockCount++;
          addStatus(statusCount.all, status, qty);
          addStatus(statusCount.mat, status, qty);
        } else {
          totalItems_Eq++;
          totalQty_Eq      += qty;
          totalValue_Eq    += val;
          totalNetValue_Eq += netVal;
          valueByCategory[catName].eq += netVal;
          addStatus(statusCount.all, status, qty);
          addStatus(statusCount.eq,  status, qty);
        }
      }
    });

    // ====================================================================
    // 2.  EQ_DB_ID — Equipment_DB
    //     AssetConsume = วัสดุสำนักงานที่เบิกเข้าระบบ
    //     AssetGoods   = ครุภัณฑ์ที่บันทึกผ่านระบบ
    // cols AssetConsume: [0]ID [1]Name [2]Unit [3]Year [4]Price [5]Count [6]TotalCost [7]DateBuy
    // cols AssetGoods:   [0]ID [1]Name [2]Model [3]Year [4]Price [5]DateReceived [6]ExpireDate [7]Status
    // ====================================================================
    var eqSheetMap = {
      'AssetConsume': { isMat: true,  cat: 'วัสดุสำนักงาน',
                        qtyIdx:5, valIdx:6, priceIdx:4, dateIdx:7, statIdx:-1, lifeYrs:3 },
      'AssetGoods'  : { isMat: false, cat: 'ครุภัณฑ์ (ระบบ)',
                        qtyIdx:0, valIdx:4, priceIdx:4, dateIdx:5, statIdx:7,  lifeYrs:5 }
    };

    for (var sName in eqSheetMap) {
      var cfg   = eqSheetMap[sName];
      var sheet = ssEQ.getSheetByName(sName);
      if (!sheet || sheet.getLastRow() <= 1) continue;

      var data = sheet.getDataRange().getValues();
      for (var r = 1; r < data.length; r++) {
        var row = data[r];
        if (!row[1]) continue; // ไม่มีชื่อ ข้ามแถว

        var qty     = parseFloat(row[cfg.qtyIdx]) || 0;
        var val     = parseFloat(row[cfg.valIdx])  || (parseFloat(row[cfg.priceIdx]) * qty) || 0;
        var rowDate = parseDate(row[cfg.dateIdx]);
        var status  = (cfg.statIdx !== -1 && row[cfg.statIdx]) ? String(row[cfg.statIdx]).trim() : 'ปกติ';

        if (!isAllTime && (!rowDate || rowDate < cutoffDate)) continue;

        var netVal = cfg.isMat ? val : calcNet(val, rowDate, cfg.lifeYrs);

        if (!valueByCategory[cfg.cat]) valueByCategory[cfg.cat] = { eq:0, mat:0 };

        if (cfg.isMat) {
          totalItems_Mat++;
          totalQty_Mat      += qty;
          totalValue_Mat    += val;
          totalNetValue_Mat += netVal;
          valueByCategory[cfg.cat].mat += netVal;
          if (qty <= 5) lowStockCount++;
          addStatus(statusCount.all, status, qty);
          addStatus(statusCount.mat, status, qty);
        } else {
          totalItems_Eq++;
          totalQty_Eq      += qty;
          totalValue_Eq    += val;
          totalNetValue_Eq += netVal;
          valueByCategory[cfg.cat].eq += netVal;
          addStatus(statusCount.all, status, qty);
          addStatus(statusCount.eq,  status, qty);
        }
      }
    }

    // ====================================================================
    // 3.  สร้างข้อมูล Chart
    // ====================================================================
    var chart1Labels=[], chart1DataEq=[], chart1DataMat=[];
    for (var cat in valueByCategory) {
      chart1Labels.push(cat);
      chart1DataEq.push(Math.round(valueByCategory[cat].eq));
      chart1DataMat.push(Math.round(valueByCategory[cat].mat));
    }

    function prepStatus(obj) {
      var labels=[], data=[], colors=[];
      for (var s in obj) {
        if (obj[s] > 0) {
          labels.push(s); data.push(obj[s]);
          if (s === 'ปกติ' || s === 'ว่างพร้อมใช้')       colors.push('#10b981');
          else if (s.indexOf('ซ่อม') !== -1)                colors.push('#ef4444');
          else if (s.indexOf('จำหน่าย') !== -1)             colors.push('#64748b');
          else                                               colors.push('#f59e0b');
        }
      }
      if (!labels.length) { labels=['ไม่มีข้อมูล']; data=[100]; colors=['#e2e8f0']; }
      return { labels:labels, data:data, colors:colors };
    }

    return {
      totalItems:        totalItems_Eq + totalItems_Mat,
      totalItems_Eq:     totalItems_Eq,
      totalItems_Mat:    totalItems_Mat,
      totalQty:          totalQty_Eq + totalQty_Mat,
      totalQty_Eq:       totalQty_Eq,
      totalQty_Mat:      totalQty_Mat,
      totalValue:        totalValue_Eq + totalValue_Mat,
      totalValue_Eq:     totalValue_Eq,
      totalValue_Mat:    totalValue_Mat,
      totalNetValue:     totalNetValue_Eq + totalNetValue_Mat,
      totalNetValue_Eq:  totalNetValue_Eq,
      totalNetValue_Mat: totalNetValue_Mat,
      lowStockCount:     lowStockCount,
      expenseByDept:     { labels: chart1Labels, dataEq: chart1DataEq, dataMat: chart1DataMat },
      equipmentStatus: {
        all: prepStatus(statusCount.all),
        eq:  prepStatus(statusCount.eq),
        mat: prepStatus(statusCount.mat)
      }
    };

  } catch (error) {
    Logger.log('Error in getDashboardSummary: ' + error.message);
    throw new Error(error.message);
  }
}

function clearDashboardCache() {
  CacheService.getScriptCache().remove("dashboard_summary");
}

// ================================================================
// 🚀 ฟังก์ชันดึงข้อมูลสรุปงานรถตู้ทั้งหมด สำหรับหน้า Admin Summary
// ================================================================
function getAdminVanSummary() {
  try {
    if (!isAdmin()) throw new Error("บัญชีของคุณยังไม่ได้สิทธิ์ Admin (โปรดตรวจสอบสิทธิ์ของคุณ)");
    
    var config = getConfig();
    var ss = SpreadsheetApp.openById(config.SHEET_ID); 
    var sheet = ss.getSheetByName("VanJobs");
    if (!sheet) throw new Error("ไม่พบแท็บชีตที่ชื่อ 'VanJobs' ในไฟล์ Database");
    
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return []; 
    
    var result = [];
    
    // ตั้งค่าตามตาราง VanJobs.csv ล่าสุด (ตรงกับ getDriverVanJobs)
    var idIdx = 0;         // Job_ID
    var nameIdx = 2;       // Customer_Name
    var destIdx = 3;       // Destination
    var dateIdx = 4;       // Travel_Date
    var timePickIdx = 5;   // Time pick up (Column F)
    var timeFinishIdx = 6; // Time finish (Column G)
    var driverIdx = 7;     // Driver_Email (Column H)
    var statusIdx = 8;     // Status (Column I)
    var distIdx = 9;       // Distance_KM (Column J)
    var tollIdx = 10;      // Toll_Fee (Column K)
    var fuelIdx = 11;      // Fuel_Fee (Column L)
    var repairIdx = 12;    // Repair_Fee (Column M)
    var pickupIdx = 15;    // Pick-up (Column P)
    var noteAdminIdx = 16; // Note From Admin (Column Q)
    var startMileIdx = 17; // miles-start (Column R)
    var currentMileIdx = 18;// miles-current (Column S)
    var parkingIdx = 19;   // parking cost (Column T)
    var payDriverIdx = 20; // pay for driver (Column U)
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[idIdx] || String(row[idIdx]).trim() === '') continue; 
      
      var travelDate = row[dateIdx];
      var dateStr = '-';
      if (travelDate instanceof Date) {
        dateStr = Utilities.formatDate(travelDate, Session.getScriptTimeZone(), "dd/MM/yyyy");
      } else if (travelDate) {
        dateStr = String(travelDate).trim();
      }

      var distance = parseFloat(row[distIdx]);
      var fuel = parseFloat(row[fuelIdx]);
      var toll = parseFloat(row[tollIdx]);
      
      result.push({
        id: String(row[idIdx]).trim(),
        date: dateStr,
        customer: String(row[nameIdx] || '-').trim(),
        driver: String(row[driverIdx] || '-').trim(),
        destination: String(row[destIdx] || '-').trim(),
        status: String(row[statusIdx] || 'Pending').trim(),
        distance: isNaN(distance) ? 0 : distance,
        fuel: isNaN(fuel) ? 0 : fuel,
        toll: isNaN(toll) ? 0 : toll,
        startMile: isNaN(parseFloat(row[startMileIdx])) ? 0 : parseFloat(row[startMileIdx]),
        endMile: isNaN(parseFloat(row[currentMileIdx])) ? 0 : parseFloat(row[currentMileIdx]),
        parking: isNaN(parseFloat(row[parkingIdx])) ? 0 : parseFloat(row[parkingIdx]),
        allowance: isNaN(parseFloat(row[payDriverIdx])) ? 0 : parseFloat(row[payDriverIdx]),
        note: String(row[repairIdx] || '').trim(),
        timePick: String(row[timePickIdx] || '-').trim(),     // เวลารับ
        timeFinish: String(row[timeFinishIdx] || '-').trim(), // เวลาสิ้นสุด
        pickup: String(row[pickupIdx] || '-').trim(),
        vehicleType: String(row[noteAdminIdx] || '-').trim()
      });
    }
    return result.reverse(); 
  } catch (e) {
    console.error("Error getAdminVanSummary: ", e);
    throw new Error(e.message || e.toString());
  }
}

function getDriverVanJobs() {
  try {
    var profile = getUserProfile();
    var driverEmail = profile.email;
    var isAdminUser = profile.role === 'admin';
    
    var config = getConfig();
    var ss = SpreadsheetApp.openById(config.SHEET_ID); 
    var sheet = ss.getSheetByName("VanJobs");
    if (!sheet) throw new Error("ไม่พบแท็บชีตที่ชื่อ 'VanJobs'");
    
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];
    
    var result = [];
    
    // แมป Index ตามคอลัมน์จริงของไฟล์ VanJobs.csv ล่าสุด
    var idIdx = 0;         // Job_ID
    var nameIdx = 2;       // Customer_Name
    var destIdx = 3;       // Destination
    var dateIdx = 4;       // Travel_Date
    var timePickIdx = 5;   // Time pick up (Column F)
    var timeFinishIdx = 6; // Time finish (Column G)
    var driverIdx = 7;     // Driver_Email (Column H)
    var statusIdx = 8;     // Status (Column I)
    var distIdx = 9;       // Distance_KM (Column J)
    var tollIdx = 10;      // Toll_Fee (Column K)
    var fuelIdx = 11;      // Fuel_Fee (Column L)
    var repairIdx = 12;    // Repair_Fee (Column M)
    var pickupIdx = 15;    // Pick-up (Column P)
    var noteAdminIdx = 16; // Note From Admin (Column Q)
    var startMileIdx = 17; // miles-start (Column R)
    var currentMileIdx = 18;// miles-current (Column S)
    var parkingIdx = 19;   // parking cost (Column T)
    var payDriverIdx = 20; // pay for driver (Column U)
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[idIdx] || String(row[idIdx]).trim() === '') continue; 
      
      var rowDriver = String(row[driverIdx] || '').toLowerCase().trim();
      
      // Admin ดึงได้หมด, คนขับปกติเห็นเฉพาะของตนเอง
      if (!isAdminUser && rowDriver !== driverEmail.toLowerCase().trim()) {
        continue;
      }
      
      var travelDate = row[dateIdx];
      var dateStr = '-';
      if (travelDate instanceof Date) {
        dateStr = Utilities.formatDate(travelDate, Session.getScriptTimeZone(), "dd/MM/yyyy");
      } else if (travelDate) {
        dateStr = String(travelDate).trim();
      }
      
      result.push({
        id: String(row[idIdx]).trim(),
        date: dateStr,
        customer: String(row[nameIdx] || '-').trim(),
        driver: String(row[driverIdx] || '-').trim(),
        destination: String(row[destIdx] || '-').trim(),
        status: String(row[statusIdx] || 'Pending').trim(),
        distance: isNaN(parseFloat(row[distIdx])) ? 0 : parseFloat(row[distIdx]),
        toll: isNaN(parseFloat(row[tollIdx])) ? 0 : parseFloat(row[tollIdx]),
        fuel: isNaN(parseFloat(row[fuelIdx])) ? 0 : parseFloat(row[fuelIdx]),
        startMile: isNaN(parseFloat(row[startMileIdx])) ? 0 : parseFloat(row[startMileIdx]),
        endMile: isNaN(parseFloat(row[currentMileIdx])) ? 0 : parseFloat(row[currentMileIdx]),
        parking: isNaN(parseFloat(row[parkingIdx])) ? 0 : parseFloat(row[parkingIdx]),
        allowance: isNaN(parseFloat(row[payDriverIdx])) ? 0 : parseFloat(row[payDriverIdx]),
        note: String(row[repairIdx] || '').trim(),
        timePick: String(row[timePickIdx] || '-').trim(),     // เวลาเริ่ม
        timeFinish: String(row[timeFinishIdx] || '-').trim(), // เวลาสิ้นสุด
        pickup: String(row[pickupIdx] || '-').trim(),
        vehicleType: String(row[noteAdminIdx] || '-').trim()
      });
    }
    return result.reverse();
  } catch (e) {
    console.error("Error getDriverVanJobs: ", e);
    return [];
  }
}

function deleteVanJob(jobId) {
  try {
    if (!isAdmin()) throw new Error("คุณไม่มีสิทธิ์ทำรายการนี้ (เฉพาะ Admin)");
    
    var config = getConfig();
    var ss = SpreadsheetApp.openById(config.SHEET_ID);
    var sheet = ss.getSheetByName("VanJobs");
    if (!sheet) throw new Error("ไม่พบชีต 'VanJobs'");
    
    var data = sheet.getDataRange().getValues();
    var idIdx = 0;
    var statusIdx = 8; // ✅ แก้ไขให้ชี้เป้าตรงกับคอลัมน์ Status (Column I หรือ Index 8)
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][idIdx] && String(data[i][idIdx]).trim() === String(jobId).trim()) {
        
        // เช็คสถานะตรงกับคอลัมน์ I เพื่อความปลอดภัย
        if (String(data[i][statusIdx]).trim() !== 'Assigned') {
          throw new Error("ไม่อนุญาตให้ลบ! เนื่องจากคนขับยอมรับงาน หรือปฏิบัติงานไปแล้ว (สถานะปัจจุบัน: " + String(data[i][statusIdx]) + ")");
        }
        
        sheet.deleteRow(i + 1);
        logAudit("DELETE_VAN_JOB", "Admin ลบงาน Job ID: " + jobId, "WARNING");
        return "ลบรายการงาน " + jobId + " ออกจากระบบเรียบร้อยแล้ว";
      }
    }
    throw new Error("ไม่พบรหัสงาน: " + jobId);
  } catch (e) {
    logAudit("DELETE_VAN_JOB_ERROR", "Error: " + e.toString(), "ERROR");
    throw new Error(e.toString());
  }
}

// ==========================================
// ██████████████████████████████████████████
// ██  FINANCE MODULE (finace.js Merged)   ██
// ██  Finance Core - Backend System        ██
// ██  Version: Enterprise V8.5            ██
// ██████████████████████████████████████████
// ==========================================
// หมายเหตุ: SS (Finance Spreadsheet) ถูกกำหนดไว้แล้วด้านบน
//           ผ่าน getFinanceDatabase() และ FN_DB_ID ใน getConfig()
// ==========================================

// ==========================================
// Finance 1. Core Functions (โหลดข้อมูลเริ่มต้น)
// ==========================================
function getAppData(clientEmail) {
  let appUrl = "";
  try { appUrl = ScriptApp.getService().getUrl(); } catch(e) {}

  const user = getUserInfo(clientEmail);
  if (user.email === "REQUIRE_EMAIL") return { user: user, appUrl: appUrl };

  const configData = getAccountConfig(); 
  const customers = getCustomerData(); 
  const requests = getRequestsData(); 
  const loans = getLoanData(); 
  
  autoCleanTrash(); 
  
  const transSheet = SS.getSheetByName("Transactions");
  let transData = [];
  if (transSheet) { transData = transSheet.getDataRange().getValues(); }
  
  const nextDoc = calculateNextDocNumber();
  const nextLoanDoc = calculateNextLoanNumber(); 
  
  let cleanTransactions = [];
  if (transData.length > 1) {
    cleanTransactions = transData.slice(1).map(row => {
      return row.map(cell => (cell instanceof Date) ? cell.toISOString() : cell);
    }).sort((a, b) => new Date(b[17] || b[1]) - new Date(a[17] || a[1])); 
  }
  
  const settingsSheet = SS.getSheetByName("Settings");
  let dashLayoutStr = settingsSheet.getRange(2, 6).getValue();
  let rolePermsStr = settingsSheet.getRange(2, 7).getValue();
  let loanConfigStr = settingsSheet.getRange(2, 10).getValue(); 
  
  let globalLayout = { cards: true, cashFlow: true, trend: true, pie: true, recent: true, topExpense: true, topIncome: true };
  if (dashLayoutStr) { try { let parsed = JSON.parse(dashLayoutStr); globalLayout = { ...globalLayout, ...parsed }; } catch(e) {} }
  
  let rolePerms = {
    'Admin': { viewDash: true, createEntry: true, viewList: true, editCat: true, manageTrash: true, manageCustomers: true, manageDash: true, accessSettings: true, developer: true, viewLoan: true },
    'ฝ่ายบัญชี': { viewDash: true, createEntry: true, viewList: true, editCat: true, manageTrash: true, manageCustomers: true, manageDash: false, accessSettings: true, developer: false, viewLoan: true },
    'การเงิน': { viewDash: true, createEntry: true, viewList: true, editCat: false, manageTrash: false, manageCustomers: true, manageDash: false, accessSettings: true, developer: false, viewLoan: true },
    'พนักงานทั่วไป': { viewDash: true, createEntry: false, viewList: false, editCat: false, manageTrash: false, manageCustomers: false, manageDash: false, accessSettings: false, developer: false, viewLoan: false }
  };
  if (rolePermsStr) { 
    try { 
      let parsed = JSON.parse(rolePermsStr);
      for(let key in parsed) { rolePerms[key] = { ...rolePerms['พนักงานทั่วไป'], ...parsed[key] }; }
    } catch(e) {} 
  }

  let loanConfig = {
    reminderDays: [5, 2], 
    loanCategories: ["กู้ยืมเงิน", "ค่าใช้จ่ายประชุม", "ค่าเดินทาง", "ค่าเลี้ยงรับรอง"] 
  };
  if (loanConfigStr) { 
    try { 
      let parsed = JSON.parse(loanConfigStr); 
      loanConfig.reminderDays = parsed.reminderDays || loanConfig.reminderDays;
      loanConfig.loanCategories = parsed.loanCategories || parsed.advanceTypes || loanConfig.loanCategories;
    } catch(e) {} 
  }
  
  return {
    user: user, config: configData.tree, rawConfig: configData.raw, 
    customers: customers, requests: requests, transactions: cleanTransactions, loans: loans,
    nextDoc: nextDoc, nextLoanDoc: nextLoanDoc.contractNo,
    globalLayout: globalLayout, rolePerms: rolePerms, loanConfig: loanConfig,
    appUrl: appUrl, ssUrl: SS.getUrl()
  };
}

// ==========================================
// Finance 2. ระบบจัดการการกู้ยืม (Loan Management)
// ==========================================
function getLoanData() {
  let sheet = SS.getSheetByName("Loans");
  if (!sheet) {
    sheet = SS.insertSheet("Loans");
    sheet.appendRow(["ID", "ContractNo", "BorrowerName", "BorrowerEmail", "Amount", "Category", "Note", "BorrowDate", "DueDate", "Status", "AttachmentURL", "CreatedBy", "Timestamp"]);
    sheet.getRange(1, 1, 1, 13).setFontWeight("bold").setBackground("#ED7D31").setFontColor("white");
    return [];
  }
  const data = sheet.getDataRange().getValues();
  if(data.length <= 1) return [];
  return data.slice(1).map(row => row.map(cell => (cell instanceof Date) ? cell.toISOString() : cell)).reverse();
}

function calculateNextLoanNumber() {
  const sheet = SS.getSheetByName("Settings");
  let runningNo = sheet.getRange("H2").getValue();
  let currentYearConfig = sheet.getRange("I2").getValue();
  const now = new Date(); const thaiYear = now.getFullYear() + 543;
  if (!runningNo || isNaN(runningNo)) runningNo = 0;
  if (!currentYearConfig || currentYearConfig != thaiYear) { runningNo = 0; }
  const nextRunning = runningNo + 1;
  const contractNo = String(nextRunning).padStart(3, '0') + "/" + thaiYear;
  return { contractNo: contractNo, running: nextRunning, year: thaiYear };
}

function uploadAttachment(base64Data, filename) {
  if (!base64Data) return "";
  const folderName = "Finance_Attachments";
  let folders = DriveApp.getFoldersByName(folderName);
  let folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
  folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); 
  
  const splitBase = base64Data.split(',');
  const type = splitBase[0].split(';')[0].replace('data:', '');
  const byteCharacters = Utilities.base64Decode(splitBase[1]);
  const blob = Utilities.newBlob(byteCharacters, type, filename);
  
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); 
  return "https://drive.google.com/uc?export=view&id=" + file.getId();
}

function saveLoan(formData, clientEmail) {
  const user = getUserInfo(clientEmail);
  let sheet = SS.getSheetByName("Loans");
  if (!sheet) {
    sheet = SS.insertSheet("Loans");
    sheet.appendRow(["ID", "ContractNo", "BorrowerName", "BorrowerEmail", "Amount", "Category", "Note", "BorrowDate", "DueDate", "Status", "AttachmentURL", "CreatedBy", "Timestamp"]);
  }
  const settingsSheet = SS.getSheetByName("Settings");
  const now = new Date();
  
  let attachmentsData = [];
  if (formData.oldAttachmentsStr) {
     try { attachmentsData = JSON.parse(formData.oldAttachmentsStr); } catch(e){}
  }

  if (formData.attachments && formData.attachments.length > 0) {
    try {
      for(let i=0; i<formData.attachments.length; i++) {
         let url = uploadAttachment(formData.attachments[i].fileBase64, formData.attachments[i].fileName);
         if(url) { attachmentsData.push({ name: formData.attachments[i].fileName, url: url }); }
      }
    } catch(e) { 
      return { success: false, message: "อัปโหลดไฟล์ไม่สำเร็จ: " + e.toString() }; 
    }
  }
  
  let finalAttachmentsStr = JSON.stringify(attachmentsData);

  if (formData.id) {
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === formData.id) {
        sheet.getRange(i + 1, 3).setValue(formData.borrowerName);
        sheet.getRange(i + 1, 4).setValue(formData.borrowerEmail);
        sheet.getRange(i + 1, 5).setValue(formData.amount);
        sheet.getRange(i + 1, 6).setValue(formData.category);
        sheet.getRange(i + 1, 7).setValue(formData.note);
        sheet.getRange(i + 1, 8).setValue(new Date(formData.borrowDate));
        sheet.getRange(i + 1, 9).setValue(new Date(formData.dueDate));
        sheet.getRange(i + 1, 10).setValue(formData.status);
        sheet.getRange(i + 1, 11).setValue(finalAttachmentsStr);
        sheet.getRange(i + 1, 13).setValue(now);
        return { success: true, message: "อัปเดตข้อมูลสำเร็จ" };
      }
    }
    return { success: false, message: "ไม่พบข้อมูลที่ต้องการอัปเดต" };
  } else {
    const nextDoc = calculateNextLoanNumber();
    const id = Utilities.getUuid();
    
    let finalContractNo = nextDoc.contractNo;
    let runningToSave = nextDoc.running;
    let yearToSave = nextDoc.year;

    if (formData.isManual) {
      finalContractNo = String(formData.runningNo).padStart(3, '0') + "/" + formData.year;
      runningToSave = parseInt(formData.runningNo) || nextDoc.running;
      yearToSave = parseInt(formData.year) || nextDoc.year;
    }
    
    sheet.appendRow([ id, finalContractNo, formData.borrowerName, formData.borrowerEmail, formData.amount, formData.category, formData.note, new Date(formData.borrowDate), new Date(formData.dueDate), "Active", finalAttachmentsStr, user.email, now ]);
    
    settingsSheet.getRange("H1").setValue("LoanRunning"); settingsSheet.getRange("I1").setValue("LoanYear");
    settingsSheet.getRange("H2").setValue(runningToSave); settingsSheet.getRange("I2").setValue(yearToSave);
    
    return { success: true, message: "สร้างเอกสารเงินกู้ยืมเรียบร้อยแล้ว" };
  }
}

function deleteLoan(id) {
  const sheet = SS.getSheetByName("Loans");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) { if (data[i][0] === id) { sheet.deleteRow(i + 1); return { success: true, message: "ลบเอกสารสำเร็จ" }; } }
  return { success: false, message: "ไม่พบข้อมูลในฐานข้อมูล" };
}

function saveLoanConfig(configObj) {
  const sheet = SS.getSheetByName("Settings");
  sheet.getRange("J1").setValue("LoanConfig");
  sheet.getRange("J2").setValue(JSON.stringify(configObj));
  return { success: true, message: "บันทึกการตั้งค่าระบบกู้ยืมสำเร็จ" };
}

// ==========================================
// Finance 3. ระบบส่งอีเมลแจ้งเตือน (Email Reminders)
// ==========================================
function sendManualReminders(loanIds) {
  const sheet = SS.getSheetByName("Loans");
  if (!sheet) return { success: false, message: "ไม่มีฐานข้อมูล" };
  const data = sheet.getDataRange().getValues();
  
  let count = 0;
  for(let i=1; i<data.length; i++) {
    if(loanIds.includes(data[i][0]) && data[i][9] === "Active") { 
      let contractNo = data[i][1]; let name = data[i][2];
      let email = data[i][3]; let amount = data[i][4]; let dueDateRaw = data[i][8];
      
      if(email && dueDateRaw) {
        sendReminderEmail(email, name, contractNo, amount, dueDateRaw, "แจ้งเตือนการเคลียร์ยอด");
        count++;
      }
    }
  }
  return { success: true, message: `ส่งอีเมลแจ้งเตือนสำเร็จจำนวน ${count} รายการ` };
}

function checkAndSendLoanReminders() {
  const sheet = SS.getSheetByName("Loans"); if (!sheet) return;
  const data = sheet.getDataRange().getValues(); if (data.length <= 1) return;
  
  const settingsStr = SS.getSheetByName("Settings").getRange("J2").getValue();
  let reminderDays = [5, 2]; 
  try { if (settingsStr) reminderDays = JSON.parse(settingsStr).reminderDays.map(n => parseInt(n)); } catch(e){}

  const today = new Date(); today.setHours(0, 0, 0, 0);

  for (let i = 1; i < data.length; i++) {
    let status = data[i][9]; 
    if (status === "Active") {
      let contractNo = data[i][1]; let borrowerName = data[i][2];
      let email = data[i][3]; let amount = data[i][4]; let dueDateRaw = data[i][8];
      
      if (!email || !dueDateRaw) continue;
      
      let dueDate = new Date(dueDateRaw); dueDate.setHours(0, 0, 0, 0);
      let timeDiff = dueDate.getTime() - today.getTime(); 
      let daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));
      
      if (reminderDays.includes(daysLeft) || daysLeft < 0) { 
        let timeMsg = daysLeft < 0 ? `เลยกำหนดชำระมาแล้ว ${Math.abs(daysLeft)} วัน` : `เหลือเวลาอีก ${daysLeft} วัน`;
        sendReminderEmail(email, borrowerName, contractNo, amount, dueDateRaw, timeMsg); 
      }
    }
  }
}

function sendReminderEmail(email, name, contractNo, amount, dueDate, timeMsg) {
  const formattedAmount = parseFloat(amount).toLocaleString('th-TH', {minimumFractionDigits: 2});
  const formattedDate = new Date(dueDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
  
  const subject = `[แจ้งเตือน] รายการขอรับเงิน/กู้ยืม (เลขที่ ${contractNo})`;
  const body = `เรียน คุณ ${name},\n\nระบบขอแจ้งเตือนการครบกำหนดเคลียร์เอกสาร/ชำระเงินคืน โดยมีรายละเอียดดังนี้:\n\n- เลขที่เอกสาร: ${contractNo}\n- ยอดเงิน: ${formattedAmount} บาท\n- วันที่ครบกำหนด (Due Date): ${formattedDate}\n- สถานะ: ${timeMsg}\n\nกรุณาดำเนินการเคลียร์เอกสารหรือชำระเงินคืนภายในวันที่กำหนด หากท่านดำเนินการเรียบร้อยแล้วโปรดแจ้งฝ่ายบัญชี/การเงิน เพื่อทำการอัปเดตสถานะในระบบต่อไป\n\nขอขอบคุณ,\nฝ่ายการเงินและบัญชี`;
  try { MailApp.sendEmail({ to: email, subject: subject, body: body }); } catch(e) {}
}

// ==========================================
// Finance 4. ฟังก์ชันการตั้งค่าระบบและ Role
// ==========================================
function saveDashboardLayout(layoutObj) { SS.getSheetByName("Settings").getRange(2, 6).setValue(JSON.stringify(layoutObj)); return true; }
function saveRolePermissions(permsObj) { SS.getSheetByName("Settings").getRange(2, 7).setValue(JSON.stringify(permsObj)); return { success: true, message: "อัปเดตสิทธิ์การใช้งาน (Role Matrix) เรียบร้อยแล้ว" }; }
function saveCategoryConfig(rawConfigArray) {
  const sheet = SS.getSheetByName("Config"); sheet.clearContents(); sheet.appendRow(["category", "group", "type", "item"]);
  if (rawConfigArray && rawConfigArray.length > 0) { sheet.getRange(2, 1, rawConfigArray.length, 4).setValues(rawConfigArray); }
  return { success: true, message: "อัปเดตโครงสร้างหมวดหมู่บัญชีเรียบร้อยแล้ว" };
}

function getAccountConfig() {
  const sheet = SS.getSheetByName("Config");
  if (!sheet) return { tree: {}, raw: [] };
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { tree: {}, raw: [] };
  const rawArray = data.slice(1).filter(row => row[0]); 
  const config = {};
  for (let i = 1; i < data.length; i++) {
    if (data[i].length < 4) continue;
    const [cat, group, type, item] = data[i];
    if (!cat) continue;
    if (!config[cat]) config[cat] = {}; if (!config[cat][group]) config[cat][group] = {}; if (!config[cat][group][type]) config[cat][group][type] = [];
    if (item && !config[cat][group][type].includes(item)) { config[cat][group][type].push(item); }
  }
  return { tree: config, raw: rawArray };
}

function getUserInfo(clientEmail) {
  let email = Session.getActiveUser().getEmail();
  if (!email || email.trim() === "") {
    if (clientEmail && clientEmail.trim() !== "") { email = clientEmail.trim(); } else { return { email: "REQUIRE_EMAIL", role: "พนักงานทั่วไป" }; }
  }
  const sheet = SS.getSheetByName("User_Roles");
  if (!sheet) return { email: email, role: "พนักงานทั่วไป" };
  const data = sheet.getDataRange().getValues();
  let role = "พนักงานทั่วไป"; let found = false;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === email) { role = data[i][1] || "พนักงานทั่วไป"; sheet.getRange(i + 1, 3).setValue(new Date()); found = true; break; }
  }
  if (!found) { if (data.length <= 1) role = "Admin"; sheet.appendRow([email, role, new Date()]); }
  return { email: email, role: role };
}
function getAllUsers() { const sheet = SS.getSheetByName("User_Roles"); if (!sheet) return []; const data = sheet.getDataRange().getValues().slice(1); return data.map(row => row.map(cell => (cell instanceof Date) ? cell.toISOString() : cell)); }
function updateUserRole(email, newRole) { const sheet = SS.getSheetByName("User_Roles"); const data = sheet.getDataRange().getValues(); for (let i = 1; i < data.length; i++) { if (data[i][0] === email) { sheet.getRange(i + 1, 2).setValue(newRole); return true; } } return false; }
function deleteUserRole(email) { const sheet = SS.getSheetByName("User_Roles"); const data = sheet.getDataRange().getValues(); for (let i = 1; i < data.length; i++) { if (data[i][0] === email) { sheet.deleteRow(i + 1); return true; } } return false; }

// ==========================================
// Finance 5. ระบบคำร้อง และ ลูกค้า
// ==========================================
function getRequestsData() {
  let sheet = SS.getSheetByName("Requests");
  if (!sheet) { sheet = SS.insertSheet("Requests"); sheet.appendRow(["ID", "User", "Message", "Status", "Timestamp"]); return []; }
  const data = sheet.getDataRange().getValues(); if(data.length <= 1) return [];
  return data.slice(1).map(row => row.map(cell => (cell instanceof Date) ? cell.toISOString() : cell));
}
function submitFeatureRequest(message, clientEmail) {
  const user = getUserInfo(clientEmail); let sheet = SS.getSheetByName("Requests");
  if (!sheet) { sheet = SS.insertSheet("Requests"); sheet.appendRow(["ID", "User", "Message", "Status", "Timestamp"]); }
  sheet.appendRow([Utilities.getUuid(), user.email, message, "Pending", new Date()]); return { success: true, message: "ส่งข้อเสนอแนะสำเร็จ" };
}
function updateRequestStatus(id, newStatus) {
  let sheet = SS.getSheetByName("Requests"); if(!sheet) return false; const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) { if (data[i][0] === id) { sheet.getRange(i + 1, 4).setValue(newStatus); return { success: true, message: "อัปเดตสถานะเรียบร้อย" }; } } return { success: false, message: "ไม่พบคำร้องนี้" };
}

function getCustomerData() {
  let sheet = SS.getSheetByName("Customers");
  if (!sheet) { sheet = SS.insertSheet("Customers"); sheet.appendRow(["ID", "Name", "TaxID", "Address", "LastUpdated"]); return []; }
  const data = sheet.getDataRange().getValues(); if(data.length <= 1) return [];
  return data.slice(1).map(row => row.map(cell => (cell instanceof Date) ? cell.toISOString() : cell));
}
function saveCustomerData(customerObj) {
  let sheet = SS.getSheetByName("Customers");
  if (!sheet) { sheet = SS.insertSheet("Customers"); sheet.appendRow(["ID", "Name", "TaxID", "Address", "LastUpdated"]); }
  const data = sheet.getDataRange().getValues(); const id = customerObj.id || Utilities.getUuid(); const now = new Date();
  if (customerObj.id) {
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === customerObj.id) {
        sheet.getRange(i + 1, 2).setValue(customerObj.name); sheet.getRange(i + 1, 3).setValue(customerObj.taxId);
        sheet.getRange(i + 1, 4).setValue(customerObj.address); sheet.getRange(i + 1, 5).setValue(now); return { success: true, message: "อัปเดตข้อมูลลูกค้าสำเร็จ" };
      }
    }
  } 
  sheet.appendRow([id, customerObj.name, customerObj.taxId || "", customerObj.address || "", now]); return { success: true, message: "เพิ่มฐานข้อมูลลูกค้าเรียบร้อยแล้ว" };
}
function deleteCustomerData(id) {
  const sheet = SS.getSheetByName("Customers"); if (!sheet) return false; const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) { if (data[i][0] === id) { sheet.deleteRow(i + 1); return true; } } return false;
}

// ==========================================
// Finance 6. การบันทึก Transactions ทั่วไป
// ==========================================
function saveTransaction(formData, clientEmail) {
  const user = getUserInfo(clientEmail); const sheet = SS.getSheetByName("Transactions"); const settingsSheet = SS.getSheetByName("Settings");
  let finalBook = formData.bookNo; let finalReceipt = formData.receiptNo; let currentVersion = 1; let transactionId = formData.id || Utilities.getUuid();
  if (!formData.id) {
    const next = calculateNextDocNumber(); 
    if (!formData.isManual) {
      let newSettingsRow = [ next.base.incBook, next.base.incRec, next.base.expBook, next.base.expRec, "'" + next.currentMonth ];
      if (formData.category === 'รายรับ') { finalBook = next.income.bookNo; finalReceipt = next.income.receiptNo; newSettingsRow[0] = finalBook; newSettingsRow[1] = finalReceipt; } 
      else { finalBook = next.expense.bookNo; finalReceipt = next.expense.receiptNo; newSettingsRow[2] = finalBook; newSettingsRow[3] = finalReceipt; }
      settingsSheet.getRange(2, 1, 1, 5).setValues([newSettingsRow]);
    } else {
      let incBook = next.base.incBook; let incRec = next.base.incRec; let expBook = next.base.expBook; let expRec = next.base.expRec;
      if (formData.category === 'รายรับ') { incBook = parseInt(formData.bookNo) || incBook; incRec = parseInt(formData.receiptNo) || incRec; } 
      else { expBook = parseInt(formData.bookNo) || expBook; expRec = parseInt(formData.receiptNo) || expRec; }
      settingsSheet.getRange(2, 1, 1, 5).setValues([[incBook, incRec, expBook, expRec, "'" + next.currentMonth]]);
    }
  }
  if (formData.id) {
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === formData.id && data[i][15] === 'Active') {
        sheet.getRange(i + 1, 16).setValue('Modified');
        const oldGroup = data[i][8]; currentVersion = parseInt(data[i][16] || 1);
        if ((oldGroup === '-' || oldGroup === '') && (formData.group !== '-' && formData.group !== '')) {} else { currentVersion += 1; }
        break;
      }
    }
  }
  const rowData = [ transactionId, new Date(formData.transactionDate), finalBook, finalReceipt, formData.payerName, formData.taxId || "", formData.address || "", formData.category || "-", formData.group || "-", formData.type || "-", formData.item || "-", formData.amount, formData.paymentMethod, formData.description || "", user.email, "Active", currentVersion, new Date() ];
  sheet.appendRow(rowData); return { success: true };
}

function calculateNextDocNumber() {
  const sheet = SS.getSheetByName("Settings"); const values = sheet.getDataRange().getValues(); const data = values.length > 1 ? values[1] : [1, 0, 1, 0, ""];
  let incBook = parseInt(data[0]); if (isNaN(incBook)) incBook = 1; let incRec = parseInt(data[1]); if (isNaN(incRec)) incRec = 0;
  let expBook = parseInt(data[2]); if (isNaN(expBook)) expBook = 1; let expRec = parseInt(data[3]); if (isNaN(expRec)) expRec = 0;
  let lastMonthRaw = data[4]; let lastMonth = "";
  if (lastMonthRaw instanceof Date) { lastMonth = lastMonthRaw.getFullYear() + "-" + String(lastMonthRaw.getMonth() + 1).padStart(2, '0'); } else if (lastMonthRaw) { lastMonth = String(lastMonthRaw).trim(); }
  const now = new Date(); const currentMonthStr = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, '0');
  if (lastMonth !== currentMonthStr && lastMonth !== "") { incBook += 1; incRec = 0; expBook += 1; expRec = 0; }
  let nextIncRec = incRec + 1; let nextIncBook = incBook; if (nextIncRec > 99) { nextIncRec = 1; nextIncBook += 1; } 
  let nextExpRec = expRec + 1; let nextExpBook = expBook; if (nextExpRec > 99) { nextExpRec = 1; nextExpBook += 1; }
  return { income: { bookNo: nextIncBook, receiptNo: nextIncRec }, expense: { bookNo: nextExpBook, receiptNo: nextExpRec }, base: { incBook, incRec, expBook, expRec }, currentMonth: currentMonthStr };
}

function deleteTransaction(id, clientEmail) {
  const user = getUserInfo(clientEmail); const sheet = SS.getSheetByName("Transactions"); const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      const now = new Date(); sheet.getRange(i + 1, 16).setValue('Deleted'); sheet.getRange(i + 1, 18).setValue(now);       
      let rowData = data[i].slice(0, 17); rowData[15] = 'Deleted'; rowData[17] = now; rowData[18] = user.email; 
      SS.getSheetByName("Trash").appendRow(rowData); return true;
    }
  } return false;
}
function restoreTransaction(id, clientEmail) {
  const sheet = SS.getSheetByName("Transactions"); const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) { if (data[i][0] === id) { sheet.getRange(i + 1, 16).setValue('Active'); return true; } } return false;
}
function deleteTransactionPermanently(id, clientEmail) {
  const sheet = SS.getSheetByName("Transactions"); const data = sheet.getDataRange().getValues(); let deleted = false;
  for (let i = 1; i < data.length; i++) { if (data[i][0] === id) { sheet.deleteRow(i + 1); deleted = true; break; } }
  const trashSheet = SS.getSheetByName("Trash");
  if (trashSheet) { const trashData = trashSheet.getDataRange().getValues(); for (let i = trashData.length - 1; i >= 1; i--) { if (trashData[i][0] === id) { trashSheet.deleteRow(i + 1); } } }
  return deleted;
}
function autoCleanTrash() {
  const transSheet = SS.getSheetByName("Transactions"); if (!transSheet) return;
  const transData = transSheet.getDataRange().getValues(); const now = new Date().getTime(); const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
  for (let i = transData.length - 1; i >= 1; i--) {
    if (transData[i][15] === 'Deleted') { let delDateStr = transData[i][17]; if (delDateStr) { let delDate = new Date(delDateStr).getTime(); if (now - delDate > sevenDaysInMs) { transSheet.deleteRow(i + 1); } } }
  }
  const trashSheet = SS.getSheetByName("Trash");
  if(trashSheet){ const tData = trashSheet.getDataRange().getValues(); for(let i = tData.length - 1; i >= 1; i--){ let delDateStr = tData[i][17]; if(delDateStr){ let delDate = new Date(delDateStr).getTime(); if(now - delDate > sevenDaysInMs) { trashSheet.deleteRow(i + 1); } } } }
}

// ==========================================
// Finance 7. Utility (PDF & Thai Baht Text)
// ==========================================
function extractIdFromUrl(url) {
  if (!url) return ""; url = url.toString().trim(); if (!url.includes("http")) return url; 
  let docMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/); if (docMatch) return docMatch[1];
  let folderMatch = url.match(/\/folders\/([a-zA-Z0-9-_]+)/); if (folderMatch) return folderMatch[1];
  let idMatch = url.match(/id=([a-zA-Z0-9-_]+)/); if (idMatch) return idMatch[1]; return url; 
}
function safeSetSharingView(file) { try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e1) { try { file.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW); } catch (e2) {} } }
function deleteTempFile(fileId) { try { if (fileId) DriveApp.getFileById(fileId).setTrashed(true); } catch (e) {} }

function generatePDF(transactionId, templateName) {
  try {
    const sheet = SS.getSheetByName("Transactions"); const data = sheet.getDataRange().getValues(); let t = null;
    for (let i = 1; i < data.length; i++) { if (data[i][0] === transactionId && data[i][15] === 'Active') { t = data[i]; break; } }
    if (!t) throw new Error("ไม่พบข้อมูลรายการที่ใช้งานอยู่");

    const tplSheet = SS.getSheetByName("Template_Configs"); if (!tplSheet) throw new Error("ไม่พบแผ่นงานชื่อ Template_Configs ในฐานข้อมูล");
    const tplData = tplSheet.getDataRange().getValues(); 
    
    let folderId = (tplData.length > 0 && tplData[0].length > 2) ? extractIdFromUrl(tplData[0][2]) : ""; 
    let docId = "";
    
    for (let i = 1; i < tplData.length; i++) { if (tplData[i].length > 1 && tplData[i][0] === templateName) { docId = extractIdFromUrl(tplData[i][1]); break; } }
    if (!docId) throw new Error("ไม่พบ Doc ID หรือ Link สำหรับ " + templateName);

    const dateObj = new Date(t[1]); const months = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
    const formattedDate = `${dateObj.getDate()} ${months[dateObj.getMonth()]} ${dateObj.getFullYear() + 543}`;
    const amountStr = parseFloat(t[11]).toLocaleString('th-TH', {minimumFractionDigits: 2}); const amountText = ThaiBahtText(t[11]);

    let baseFile; try { baseFile = DriveApp.getFileById(docId); } catch (e) { throw new Error("ระบบไม่สามารถเข้าถึงไฟล์ Template ได้"); }
    let tempFile; try { tempFile = baseFile.makeCopy(`Receipt_${t[2]}_${t[3]}`); } catch (e) { throw new Error("ไม่สามารถสร้างสำเนาเอกสารจาก Template ได้"); }
    
    const tempDoc = DocumentApp.openById(tempFile.getId()); const body = tempDoc.getBody();
    body.replaceText("<<Book_No>>", t[2]); body.replaceText("<<Receipt_No>>", t[3]); body.replaceText("<<Date>>", formattedDate);
    body.replaceText("<<Payer_Name>>", t[4]); body.replaceText("<<Tax_ID>>", t[5] || "-");
    
    let addressText = t[6] || "-";
    try {
      let parsed = JSON.parse(addressText); let parts = [];
      if(parsed.line1) parts.push(parsed.line1); if(parsed.subDistrict) parts.push("แขวง/ต." + parsed.subDistrict);
      if(parsed.district) parts.push("เขต/อ." + parsed.district); if(parsed.province) parts.push("จ." + parsed.province);
      if(parsed.zip) parts.push(parsed.zip); addressText = parts.join(" ");
    } catch(e) {}
    
    body.replaceText("<<Address>>", addressText); body.replaceText("<<Description>>", t[13] || t[10] || "-");
    body.replaceText("<<Total_Amount>>", amountStr); body.replaceText("<<Amount_Text>>", amountText);

    body.replaceText("<<No_1>>", "1"); body.replaceText("<<Item_1>>", t[10] || t[13]); body.replaceText("<<Price_1>>", amountStr); body.replaceText("<<Qty_1>>", "1"); body.replaceText("<<Total_1>>", amountStr);
    body.replaceText("<<No_2>>", ""); body.replaceText("<<Item_2>>", ""); body.replaceText("<<Price_2>>", ""); body.replaceText("<<Qty_2>>", ""); body.replaceText("<<Total_2>>", "");
    body.replaceText("<<No_3>>", ""); body.replaceText("<<Item_3>>", ""); body.replaceText("<<Price_3>>", ""); body.replaceText("<<Qty_3>>", ""); body.replaceText("<<Total_3>>", "");
    tempDoc.saveAndClose();

    let targetFolder; try { targetFolder = folderId ? DriveApp.getFolderById(folderId) : DriveApp.getRootFolder(); } catch(err) { targetFolder = DriveApp.getRootFolder(); }
    const pdfBlob = tempFile.getAs(MimeType.PDF); const pdfFile = targetFolder.createFile(pdfBlob); pdfFile.setName(`ใบเสร็จ_${t[4]}_เล่ม${t[2]}_เลขที่${t[3]}.pdf`);
    
    safeSetSharingView(pdfFile); tempFile.setTrashed(true); return { success: true, url: pdfFile.getUrl(), fileId: pdfFile.getId() };
  } catch (error) { return { success: false, message: error.toString() }; }
}

function ThaiBahtText(Number) {
    if (Number == null || Number === "") return "ศูนย์บาทถ้วน"; Number = Number.toString().replace(/[, ]/g, ''); if (isNaN(Number)) return "ศูนย์บาทถ้วน";
    Number = parseFloat(Number).toFixed(2); let txtNumArr = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า", "สิบ"]; let txtDigitArr = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];
    let BahtText = ""; let numberArray = Number.split("."); let integerPart = numberArray[0]; let fractionalPart = numberArray[1];
    if (integerPart === "0" && fractionalPart === "00") return "ศูนย์บาทถ้วน";
    let processPart = (part) => {
        let result = ""; let len = part.length;
        for (let i = 0; i < len; i++) {
            let n = parseInt(part.charAt(i));
            if (n !== 0) { if (i === (len - 1) && n === 1 && len > 1) { result += "เอ็ด"; } else if (i === (len - 2) && n === 2) { result += "ยี่"; } else if (i === (len - 2) && n === 1) { result += ""; } else { result += txtNumArr[n]; } result += txtDigitArr[len - i - 1]; }
        } return result;
    };
    if (integerPart !== "0") BahtText += processPart(integerPart) + "บาท";
    if (fractionalPart === "00") { BahtText += "ถ้วน"; } else { BahtText += processPart(fractionalPart) + "สตางค์"; } return BahtText;
}
// ==========================================
// ✅ โมดูลทะเบียนคุมบัญชี (Tabeankum Module)
// Merged from tabeankum.js
// SS_AC = SpreadsheetApp.openById(AC_DB_ID) 
// ==========================================

/**
 * ==========================================================
 * OFFICE FINANCE ENTERPRISE - BACKEND 
 * (Universal Document Tracking & Cleaned Debts)
 * ==========================================================
 */



// ==========================================
// 1. AUTHENTICATION & RBAC
// ==========================================
function checkEmailAuth(email, config) {
  const orgDomain = config.org_domain || "@office.go.th"; 
  let role = "User";
  let name = email ? email.split('@')[0] : "Guest";
  
  let rolePermsMap = { "Admin": { view: true, add: true, edit: true, del: true }, "User": { view: true, add: true, edit: false, del: false } };
  try { if (config.role_permissions) rolePermsMap = { ...rolePermsMap, ...JSON.parse(config.role_permissions) }; } catch(e) {}

  if (email === "") return { email: "", role: "Guest", name: "Guest", permissions: {view:false, add:false, edit:false, del:false} };
  if (email.endsWith(orgDomain)) role = "Admin";

  let userSheet = SS_AC.getSheetByName('db_users');
  if(!userSheet) {
    userSheet = SS_AC.insertSheet('db_users');
    userSheet.appendRow(['อีเมล', 'ชื่อ', 'สิทธิ์', 'สถานะ']);
  }
  
  const data = userSheet.getDataRange().getValues();
  let found = false;

  for(let i=1; i<data.length; i++) {
    if(data[i][0] && data[i][0].toString().toLowerCase() === email.toLowerCase()) {
      found = true;
      if(data[i][3] === 'Active') {
        role = data[i][2] || "User";
        name = data[i][1] || name;
      } else {
        role = "Banned";
      }
      break;
    }
  }

  if(!found) userSheet.appendRow([email, name, role, 'Active']);

  let finalPerms = rolePermsMap[role] || { view: false, add: false, edit: false, del: false };
  if(role === 'Admin') finalPerms = { view: true, add: true, edit: true, del: true };

  return { email: email, role: role, name: name, permissions: finalPerms };
}

function getUserAuth() { return checkEmailAuth(Session.getActiveUser().getEmail() || "", getConfigs()); }

function manualAuthCheck(manualEmail) {
  const configs = getConfigs();
  const auth = checkEmailAuth(manualEmail, configs);
  if(auth.role === "Banned" || auth.role === "Guest") return JSON.stringify({ auth: auth, error: "บัญชีของคุณถูกระงับหรือไม่มีสิทธิ์ใช้งาน" });
  return JSON.stringify(getInitialAppLoadData(configs, auth));
}

// ==========================================
// 2. DATA LOADERS
// ==========================================
function getInitialAppLoad() {
  const configs = getConfigs();
  const auth = checkEmailAuth(Session.getActiveUser().getEmail() || "", configs);
  if(auth.role === "Banned" || auth.role === "Guest") return JSON.stringify({ auth: auth, error: "บัญชีของคุณยังไม่มีสิทธิ์เข้าใช้งาน" });
  return JSON.stringify(getInitialAppLoadData(configs, auth));
}

function getInitialAppLoadData(configs, auth) {
  cleanOldTrash();
  const getSheetSafe = (name) => {
    const sheet = SS_AC.getSheetByName(name);
    if (!sheet) return [];
    const values = sheet.getDataRange().getValues();
    const formulas = sheet.getDataRange().getFormulas();
    
    return values.map((row, rIdx) => row.map((cell, cIdx) => {
      if (formulas[rIdx][cIdx] !== "" && ["#N/A", "#REF!", "#DIV/0!", "#VALUE!", "#NAME?", "Error"].includes(cell)) return ""; 
      if (cell instanceof Date) {
        let y = cell.getFullYear(); let m = String(cell.getMonth() + 1).padStart(2, '0'); let d = String(cell.getDate()).padStart(2, '0');
        return isNaN(y) ? "" : `${y}-${m}-${d}`;
      }
      if (cell instanceof Error || (typeof cell === 'number' && !isFinite(cell)) || cell === undefined || cell === null) return "";
      return cell === "" ? "" : cell;
    }));
  };

  return {
    auth: auth, configs: configs,
    tables: {
      ledger: getSheetSafe(configs.ledger_sheet || 'db_ledger'),
      loans: getSheetSafe(configs.loan_sheet || 'ทะเบียนคุมใบยืม'),
      ext: getSheetSafe('ทะเบียนคุมเงินนอก'),
      income: getSheetSafe('รายได้อื่น'),
      trash: getSheetSafe('db_trash'),
      users: getSheetSafe('db_users')
    },
    stats: {
      ledgerCount: Math.max(0, getSheetSafe(configs.ledger_sheet || 'db_ledger').length - 1),
      loanCount: Math.max(0, getSheetSafe(configs.loan_sheet || 'ทะเบียนคุมใบยืม').length - 1),
      extCount: Math.max(0, getSheetSafe('ทะเบียนคุมเงินนอก').length - 1)
    }
  };
}

function getNextSequences() {
  const config = getConfigs();
  const getNextSeq = (sheetName) => {
    const sheet = SS_AC.getSheetByName(sheetName);
    if (sheet && sheet.getLastRow() > 1) {
      const lastRowData = sheet.getRange(sheet.getLastRow(), 1).getValue();
      if(typeof lastRowData === 'string' && lastRowData.includes('/')) {
         let numPart = parseInt(lastRowData.split('/')[0]);
         if(!isNaN(numPart)) return numPart + 1;
      } else if (!isNaN(lastRowData) && lastRowData !== "") return Number(lastRowData) + 1;
      return sheet.getLastRow();
    }
    return 1;
  };
  return { ledger: getNextSeq(config.ledger_sheet || 'db_ledger'), loan: getNextSeq(config.loan_sheet || 'ทะเบียนคุมใบยืม'), ext: getNextSeq('ทะเบียนคุมเงินนอก'), income: getNextSeq('รายได้อื่น') };
}

// ==========================================
// 3. CONFIGURATIONS
// ==========================================
function getConfigs() {
  let sheet = SS_AC.getSheetByName('SystemConfig');
  if (!sheet) {
    sheet = SS_AC.insertSheet('SystemConfig');
    sheet.getRange(1,1,15,2).setValues([
      ['Key','Value'],['current_year','2569'],['ledger_sheet','db_ledger'],['loan_sheet','ทะเบียนคุมใบยืม'],
      ['vat_rate','7'],['wht_rate','1'],['alert_1','5'],['alert_2','3'],['alert_3','1'],
      ['org_domain','@office.go.th'], ['role_permissions','{"User":{"view":true,"add":true,"edit":false,"del":false}}'],
      ['dash_prefs','{"pie":true,"bar":true,"line":true,"doughnut":true}'], ['notif_emails',''], ['notif_time','08:00'],
      ['notif_docs','true']
    ]);
  }
  const data = sheet.getDataRange().getValues();
  const configs = {};
  for (let i = 1; i < data.length; i++) configs[data[i][0]] = data[i][1];

  let ddSheet = SS_AC.getSheetByName('db_dropdowns');
  if (!ddSheet) {
    ddSheet = SS_AC.insertSheet('db_dropdowns');
    ddSheet.appendRow(['สำนัก', 'แหล่งเงิน', 'ประเภทชำระเงิน', 'ประเภทภาษี']);
  }
  const ddData = ddSheet.getDataRange().getValues();
  configs.departments = []; configs.fund_types = []; configs.pay_methods = []; configs.tax_types = [];
  for(let i=1; i<ddData.length; i++) {
    if(ddData[i][0]) configs.departments.push(ddData[i][0].toString().trim());
    if(ddData[i][1]) configs.fund_types.push(ddData[i][1].toString().trim());
    if(ddData[i][2]) configs.pay_methods.push(ddData[i][2].toString().trim());
    if(ddData[i][3]) configs.tax_types.push(ddData[i][3].toString().trim());
  }
  return configs;
}

function saveConfigs(newConfigs) {
  const configSheet = SS_AC.getSheetByName('SystemConfig');
  const oldData = configSheet.getDataRange().getValues();
  let oldRolePerms = '{"User":{"view":true,"add":true,"edit":false,"del":false}}';
  let oldDomain = '@office.go.th';
  let oldDash = '{"pie":true,"bar":true,"line":true,"doughnut":true}';
  oldData.forEach(r => {
    if(r[0] === 'role_permissions') oldRolePerms = r[1];
    if(r[0] === 'org_domain') oldDomain = r[1];
    if(r[0] === 'dash_prefs') oldDash = r[1];
  });

  configSheet.clear();
  configSheet.appendRow(['Key', 'Value']);
  
  ['current_year', 'ledger_sheet', 'loan_sheet', 'vat_rate', 'wht_rate', 'alert_1', 'alert_2', 'alert_3', 'notif_emails', 'notif_time', 'notif_docs'].forEach(key => {
    configSheet.appendRow([key, newConfigs[key] !== undefined ? newConfigs[key] : ""]);
  });
  configSheet.appendRow(['org_domain', newConfigs.org_domain !== undefined ? newConfigs.org_domain : oldDomain]);
  configSheet.appendRow(['role_permissions', newConfigs.role_permissions !== undefined ? newConfigs.role_permissions : oldRolePerms]);
  configSheet.appendRow(['dash_prefs', newConfigs.dash_prefs !== undefined ? newConfigs.dash_prefs : oldDash]);

  if(newConfigs.notif_time !== undefined) setupDailyTrigger(newConfigs.notif_time);

  if(newConfigs.departments !== undefined) {
    const ddSheet = SS_AC.getSheetByName('db_dropdowns');
    ddSheet.clear();
    ddSheet.appendRow(['สำนัก', 'แหล่งเงิน', 'ประเภทชำระเงิน', 'ประเภทภาษี']);
    const maxRows = Math.max(newConfigs.departments.length, newConfigs.fund_types.length, newConfigs.pay_methods.length, newConfigs.tax_types.length);
    let outData = [];
    for(let i=0; i<maxRows; i++) outData.push([newConfigs.departments[i]||"", newConfigs.fund_types[i]||"", newConfigs.pay_methods[i]||"", newConfigs.tax_types[i]||""]);
    if(outData.length > 0) ddSheet.getRange(2, 1, outData.length, 4).setValues(outData);
  }
  
  return getInitialAppLoad();
}

function saveUsersAndRoleConfig(usersData, rolePermsStr, domainStr) {
  let userSheet = SS_AC.getSheetByName('db_users');
  userSheet.clear();
  userSheet.appendRow(['อีเมล', 'ชื่อ', 'สิทธิ์', 'สถานะ']);
  usersData.forEach(u => userSheet.appendRow([u.email, u.name, u.role, u.status]) );
  
  let configSheet = SS_AC.getSheetByName('SystemConfig');
  let data = configSheet.getDataRange().getValues();
  let foundPerm = false; let foundDomain = false;
  
  for(let i=0; i<data.length; i++) {
    if(data[i][0] === 'role_permissions') { configSheet.getRange(i+1, 2).setValue(rolePermsStr); foundPerm = true; }
    if(data[i][0] === 'org_domain') { configSheet.getRange(i+1, 2).setValue(domainStr); foundDomain = true; }
  }
  
  if(!foundPerm) configSheet.appendRow(['role_permissions', rolePermsStr]);
  if(!foundDomain) configSheet.appendRow(['org_domain', domainStr]);
  
  return getInitialAppLoad();
}

function autoLearnDropdowns(master, details) {
  let ddSheet = SS_AC.getSheetByName('db_dropdowns');
  if (!ddSheet) return;
  
  let data = ddSheet.getDataRange().getValues();
  let depts = [], funds = [], methods = [], taxes = [];
  
  for(let i=1; i<data.length; i++) {
    if(data[i][0]) depts.push(data[i][0].toString().trim());
    if(data[i][1]) funds.push(data[i][1].toString().trim());
    if(data[i][2]) methods.push(data[i][2].toString().trim());
    if(data[i][3]) taxes.push(data[i][3].toString().trim());
  }
  
  let updated = false;
  let newDepts = new Set(); let newFunds = new Set(); let newMethods = new Set(); let newTaxes = new Set();
  
  if(master.dept) newDepts.add(master.dept.trim());
  if(master.fund) newFunds.add(master.fund.trim());
  if(master.method) newMethods.add(master.method.trim());
  if(details && details.length > 0) details.forEach(d => { 
    if(d.fund) newFunds.add(String(d.fund).trim()); 
    if(d.tax) newTaxes.add(String(d.tax).trim()); 
    });
  
  newDepts.forEach(v => { if(v && !depts.includes(v)) { depts.push(v); updated = true; } });
  newFunds.forEach(v => { if(v && !funds.includes(v)) { funds.push(v); updated = true; } });
  newMethods.forEach(v => { if(v && !methods.includes(v)) { methods.push(v); updated = true; } });
  newTaxes.forEach(v => { if(v && !taxes.includes(v)) { taxes.push(v); updated = true; } });
  
  if(updated) {
    ddSheet.clear();
    ddSheet.appendRow(['สำนัก', 'แหล่งเงิน', 'ประเภทชำระเงิน', 'ประเภทภาษี']);
    const maxRows = Math.max(depts.length, funds.length, methods.length, taxes.length);
    let outData = [];
    for(let i=0; i<maxRows; i++) outData.push([depts[i]||"", funds[i]||"", methods[i]||"", taxes[i]||""]);
    if(outData.length > 0) ddSheet.getRange(2, 1, outData.length, 4).setValues(outData);
  }
}

// ==========================================
// 4. CRUD OPERATIONS
// ==========================================
function saveFormData(type, master, details) {
  const config = getConfigs();
  autoLearnDropdowns(master, details); 
  
  if (type === 'ledger') {
    let sheet = SS_AC.getSheetByName(config.ledger_sheet || 'db_ledger');
    details.forEach((d, i) => sheet.appendRow([Number(master.seqNo) + i, master.docNo, master.recvDate, master.payDate, master.method, d.name, master.contract, master.retDate, d.desc, d.amt, d.tax, d.net, d.gf, d.fund, master.dept, master.project, "ยังไม่ครบ"]));
  } else if (type === 'loan') {
    let sheet = SS_AC.getSheetByName(config.loan_sheet || 'ทะเบียนคุมใบยืม');
    sheet.appendRow([master.loanNo, master.docNo, master.method, master.borrower, master.desc, master.amount, "", "", master.amount, master.date1, master.gf1, master.date2, master.gf2, "", "", "", "", master.dept, master.fund, master.project, master.category, master.email, "ค้างชำระ", "ยังไม่ครบ"]);
  } else if (type === 'ext') {
    let sheet = SS_AC.getSheetByName('ทะเบียนคุมเงินนอก');
    details.forEach((d, i) => sheet.appendRow([Number(master.seqNo) + i, master.docNo, master.payDate, master.method, master.payee, master.contract, master.receipt, "", d.desc, d.amt, d.gf, "ยังไม่ครบ"]));
  } else if (type === 'income') {
    let sheet = SS_AC.getSheetByName('รายได้อื่น');
    // ถอด master.docNo ออกจากรายได้อื่น ใส่ "" แทนเพื่อรักษาโครงสร้างตาราง
    details.forEach((d, i) => sheet.appendRow([master.seqNo, "", master.date, master.type, master.name, d.desc, d.amt, d.gf, "ยังไม่ครบ"])); 
  }
  return getInitialAppLoad();
}

function updateGroupedData(sheetName, originalIndices, newRowsData) {
  const sheet = SS_AC.getSheetByName(sheetName);
  const config = getConfigs();
  
  if (!sheet || originalIndices.length === 0) return getInitialAppLoad();

  // ดึงข้อมูลแถวเดิมตัวแรกมาเป็นฐานสำรองข้อมูลหลัก
  const firstOldIdx = originalIndices[0];
  const oldRowValues = sheet.getRange(firstOldIdx + 1, 1, 1, sheet.getLastColumn()).getValues()[0];

  if (newRowsData.length > 0) {
    let master = { dept: newRowsData[0][14]||newRowsData[0][17]||"", method: newRowsData[0][4]||newRowsData[0][2]||"" };
    let details = newRowsData.map(r => ({ fund: r[13]||r[18]||"", tax: r[10]||"" }));
    autoLearnDropdowns(master, details); 
  }
  
  // ลบแถวเก่าออก
  originalIndices.sort((a, b) => b - a).forEach(idx => { sheet.deleteRow(idx + 1); });
  
  if (newRowsData && newRowsData.length > 0) {
    newRowsData.forEach(row => {
      let mergedRow = oldRowValues.map((oldVal, i) => {
        if (i >= row.length || row[i] === undefined || row[i] === null) {
          return oldVal;
        }
        // ยอมรับทุกอย่างตามที่หน้าจอแก้ไขส่งมา (รวมถึง ชื่อ, ประเภทเงิน, ยอดภาษี และยอดสุทธิแบบ Manual)
        return row[i];
      });

      if (sheetName === (config.loan_sheet || 'ทะเบียนคุมใบยืม') && mergedRow.length >= 22) {
        mergedRow[8] = (parseFloat(mergedRow[5])||0) - (parseFloat(mergedRow[6])||0) - (parseFloat(mergedRow[7])||0);
        mergedRow[22] = mergedRow[15] !== "" ? "ล้างหนี้แล้ว" : "ค้างชำระ";
      }
      sheet.appendRow(mergedRow);
    });

    const lr = sheet.getLastRow(); 
    const lc = sheet.getLastColumn();
    if (lr > 1) {
      sheet.getRange(2, 1, lr - 1, lc).sort({column: 1, ascending: true});
    }
  }
  return getInitialAppLoad();
}

function deleteGroupedData(sheetName, originalIndices) {
  const sheet = SS_AC.getSheetByName(sheetName);
  let trashSheet = SS_AC.getSheetByName('db_trash');
  if(!trashSheet) { trashSheet = SS_AC.insertSheet('db_trash'); trashSheet.appendRow(['เวลาลบ', 'ชื่อตารางต้นทาง', 'ข้อมูล (JSON)']); }
  
  originalIndices.sort((a, b) => b - a).forEach(idx => {
    const actualRow = idx + 1;
    const rowData = sheet.getRange(actualRow, 1, 1, sheet.getLastColumn()).getValues()[0];
    const safeData = rowData.map(cell => {
      if(cell instanceof Date) {
          let y = cell.getFullYear(); let m = String(cell.getMonth() + 1).padStart(2, '0'); let d = String(cell.getDate()).padStart(2, '0');
          return isNaN(y) ? "" : `${y}-${m}-${d}`;
      }
      return cell;
    });
    trashSheet.appendRow([new Date(), sheetName, JSON.stringify(safeData)]);
    sheet.deleteRow(actualRow);
  });
  return getInitialAppLoad();
}

function restoreFromTrash(trashIndex) {
  const trashSheet = SS_AC.getSheetByName('db_trash');
  const actualRow = trashIndex + 1;
  const trashData = trashSheet.getRange(actualRow, 1, 1, 3).getValues()[0];
  const targetSheet = SS_AC.getSheetByName(trashData[1]);
  if(targetSheet) {
    targetSheet.appendRow(JSON.parse(trashData[2]));
    const lr = targetSheet.getLastRow(); const lc = targetSheet.getLastColumn();
    if(lr > 1) targetSheet.getRange(2, 1, lr - 1, lc).sort({column: 1, ascending: true});
  }
  trashSheet.deleteRow(actualRow);
  return getInitialAppLoad();
}

function permanentDeleteTrash(trashIndex) {
  SS_AC.getSheetByName('db_trash').deleteRow(trashIndex + 1);
  return getInitialAppLoad();
}

function cleanOldTrash() {
  const trashSheet = SS_AC.getSheetByName('db_trash');
  if(!trashSheet || trashSheet.getLastRow() <= 1) return;
  const data = trashSheet.getDataRange().getValues();
  const now = new Date().getTime();
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
  for(let i = data.length - 1; i >= 1; i--) {
    let d = new Date(data[i][0]).getTime();
    if(!isNaN(d) && (now - d > SEVEN_DAYS)) trashSheet.deleteRow(i + 1);
  }
}

// ==========================================
// 5. PDF ATTACHMENTS MANAGER
// ==========================================
function getUploadFolder() {
  const folderName = "Finance_ERP_Attachments";
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(folderName);
}

function getAttachmentsSheet() {
  let sheet = SS_AC.getSheetByName('db_attachments');
  if (!sheet) { sheet = SS_AC.insertSheet('db_attachments'); sheet.appendRow(['RecordKey', 'FilesJSON']); }
  return sheet;
}

function fetchAttachments(recordKey) {
  const sheet = getAttachmentsSheet();
  const data = sheet.getDataRange().getValues();
  for(let i=1; i<data.length; i++) {
    if(data[i][0] === recordKey) return JSON.stringify(JSON.parse(data[i][1] || "[]"));
  }
  return "[]";
}

function uploadAccountingAttachment(base64Data, filename, recordKey) {
  const folder = getUploadFolder();
  const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), MimeType.PDF, filename);
  const file = folder.createFile(blob);
  const newFileObj = { id: file.getId(), name: file.getName(), url: file.getUrl() };
  
  const sheet = getAttachmentsSheet();
  const data = sheet.getDataRange().getValues();
  let found = false;
  
  for(let i=1; i<data.length; i++) {
    if(data[i][0] === recordKey) {
      let existingFiles = JSON.parse(data[i][1] || "[]");
      existingFiles.push(newFileObj);
      sheet.getRange(i+1, 2).setValue(JSON.stringify(existingFiles));
      found = true; break;
    }
  }
  if(!found) sheet.appendRow([recordKey, JSON.stringify([newFileObj])]);
  return fetchAttachments(recordKey); 
}

function deleteAttachment(fileId, recordKey) {
  try { DriveApp.getFileById(fileId).setTrashed(true); } catch(e){} 
  const sheet = getAttachmentsSheet();
  const data = sheet.getDataRange().getValues();
  for(let i=1; i<data.length; i++) {
    if(data[i][0] === recordKey) {
      let files = JSON.parse(data[i][1] || "[]");
      files = files.filter(f => f.id !== fileId);
      sheet.getRange(i+1, 2).setValue(JSON.stringify(files));
      break;
    }
  }
  return fetchAttachments(recordKey);
}

function reorderAttachments(recordKey, newFilesArray) {
  const sheet = getAttachmentsSheet();
  const data = sheet.getDataRange().getValues();
  for(let i=1; i<data.length; i++) {
    if(data[i][0] === recordKey) {
      sheet.getRange(i+1, 2).setValue(JSON.stringify(newFilesArray));
      break;
    }
  }
  return fetchAttachments(recordKey);
}

function getPdfFileBase64(fileId) {
  return Utilities.base64Encode(DriveApp.getFileById(fileId).getBlob().getBytes());
}

// ==========================================
// 6. AUTOMATED EMAIL NOTIFICATIONS (CRON)
// ==========================================
function setupDailyTrigger(timeStr) {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'executeAutomatedNotifications') ScriptApp.deleteTrigger(triggers[i]);
  }
  if(!timeStr) return; 
  let hour = parseInt(timeStr.split(':')[0]);
  if(isNaN(hour)) hour = 8;
  ScriptApp.newTrigger('executeAutomatedNotifications').timeBased().everyDays(1).atHour(hour).create();
}

function testSendNotification() {
  executeAutomatedNotifications();
  return "ส่งอีเมลทดสอบเรียบร้อยแล้ว";
}

function executeAutomatedNotifications() {
  const configs = getConfigs();
  const emails = configs.notif_emails;
  if(!emails) return; 
  
  let htmlBody = `<div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
    <div style="background-color: #ED7D31; padding: 20px; text-align: center; color: white;">
      <h2 style="margin:0;">⚠️ สรุปรายการบัญชี ที่ต้องติดตาม</h2>
      <p style="margin:5px 0 0 0; font-size: 14px;">ประจำวันที่ ${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy")}</p>
    </div>
    <div style="padding: 20px;">`;
  
  let hasContent = false;

  const loanSheet = SS_AC.getSheetByName(configs.loan_sheet || 'ทะเบียนคุมใบยืม');
  if(loanSheet) {
    const loanData = loanSheet.getDataRange().getValues();
    let overdueLoans = [];
    for(let i=1; i<loanData.length; i++) {
      if(loanData[i][22] === 'ค้างชำระ') {
        let dateStr = loanData[i][11] instanceof Date ? Utilities.formatDate(loanData[i][11], Session.getScriptTimeZone(), "dd/MM/yyyy") : loanData[i][11];
        overdueLoans.push(`<li><b>บย.${loanData[i][0]}</b> - ${loanData[i][3]} (ครบกำหนด: ${dateStr})</li>`);
      }
    }
    if(overdueLoans.length > 0) {
      htmlBody += `<h3 style="color: #5B9BD5; border-bottom: 1px solid #eee; padding-bottom: 5px;">🔴 ทะเบียนคุมใบยืม (ค้างชำระ)</h3><ul>${overdueLoans.join('')}</ul>`;
      hasContent = true;
    }
  }

  if(configs.notif_docs === 'true' || configs.notif_docs === true) {
    const checkDocs = (sheetName, prefix) => {
        const sheet = SS_AC.getSheetByName(sheetName);
        if(!sheet) return;
        const data = sheet.getDataRange().getValues();
        if(data.length <= 1) return;
        
        let docStatIdx = data[0].findIndex(h => String(h).includes('สถานะ') && String(h).includes('เอกสาร'));
        if(docStatIdx === -1) return;

        let missingDocs = [];
        for(let i=1; i<data.length; i++) {
            if(data[i][docStatIdx] === 'ยังไม่ครบ') {
                let name = data[i][5] || data[i][4] || "ไม่ระบุชื่อ";
                missingDocs.push(`<li><b>${prefix}.${data[i][1] || data[i][0]}</b> - ${name}</li>`);
            }
        }
        if(missingDocs.length > 0) {
            htmlBody += `<h3 style="color: #f59e0b; border-bottom: 1px solid #eee; padding-bottom: 5px;">🟡 ${sheetName} (เอกสารยังไม่ครบ)</h3><ul>${missingDocs.join('')}</ul>`;
            hasContent = true;
        }
    };

    // แทนที่ของเดิมด้วยโค้ดชุดนี้ที่ท้ายไฟล์ codegs.txt
        let docSheetsSetting = configs.notif_docs || "db_ledger, ทะเบียนคุมเงินนอก, ทะเบียนคุมใบยืม";
        let docSheetsArray = docSheetsSetting.split(',').map(s => s.trim());

        docSheetsArray.forEach(sheetName => {
          if (sheetName) {
            // ตรวจสอบตัวย่ออัตโนมัติ ถ้าเป็นใบยืมใช้ 'บย' นอกนั้นใช้ 'บค'
            let prefix = sheetName.includes('ใบยืม') ? 'บย' : 'บค';
            checkDocs(sheetName, prefix);
          }
        });
  }

  htmlBody += `</div><div style="background-color: #f8fafc; padding: 15px; text-align: center; font-size: 12px; color: #888;">ส่งจากระบบ Finance ERP แบบอัตโนมัติ</div></div>`;

  if(hasContent) MailApp.sendEmail({ to: emails, subject: "🔔 แจ้งเตือน: สรุปรายการบัญชีที่ต้องติดตาม", htmlBody: htmlBody });
}

/**
 * getAllEquipmentData()
 * ดึงข้อมูลทั้ง 4 section สำหรับ durable_equipment_management.html
 * @returns {Object} { consumable:[], durable:[], borrow:[], return:[] }
 */
function getAllEquipmentData() {
  requireAccess('getAllEquipmentData'); // 🔐 ทุก role เข้าได้
  try {
    var config = getConfig();
    var ss = SpreadsheetApp.openById(config.EQ_DB_ID || config.SHEET_ID);

    // ── CONSUMABLE (วัสดุสำนักงาน) — Sheet: AssetConsume ──
    var consumable = [];
    var csSheet = ss.getSheetByName('AssetConsume');
    if (csSheet) {
      var csData = csSheet.getDataRange().getValues();
      // headers: Equipment ID, Equipment Name, Unit, Buy(year), Price,
      //          Count, TotalCost, DateBuy, ExpireDate, Note, Image
      for (var i = 1; i < csData.length; i++) {
        var r = csData[i];
        if (!r[0] && !r[1]) continue;
        consumable.push({
          id:      r[0] ? r[0].toString().trim() : '',
          name:    r[1] || '',
          unit:    r[2] || '',
          year:    r[3] ? r[3].toString() : '',
          price:   parseFloat(r[4]) || 0,
          count:   parseFloat(r[5]) || 0,
          total:   parseFloat(r[6]) || 0,
          dateBuy: r[7] ? formatDateSafe(r[7]) : '',
          expire:  r[8] ? formatDateSafe(r[8]) : '-',
          note:    r[9] || '',
          status:  'ปกติ',          // AssetConsume ไม่มีคอลัมน์ status แยก
          images:  r[10] ? [r[10]] : []  // URL รูปจาก Drive
        });
      }
    }

    // ── DURABLE (ครุภัณฑ์) — Sheets หลายแท็บ ──
    var durable = [];
    var durableSheets = ['สำนักงาน','คอมพิวเตอร์','ยานพาหนะเเละขนส่ง',
                         'ไฟฟ้าเเละวิทยุ','โฆษณาและเผยแพร่','งานบ้านงานครัว'];
    durableSheets.forEach(function(sName) {
      var sh = ss.getSheetByName(sName);
      if (!sh) return;
      var rows = sh.getDataRange().getValues();
      // headers: จำนวน, ลำดับ, รหัสครุภัณฑ์, รายการ, รุ่น/แบบ, ขนาด,
      //          สี, s/n, วันที่รับเข้า, มูลค่า, ผู้ถือครอง, สถานที่ตั้ง, ..., สถานะ
      for (var i = 1; i < rows.length; i++) {
        var r = rows[i];
        if (!r[2]) continue;
        durable.push({
          id:       r[2] ? r[2].toString().trim() : '',
          name:     r[3] || '',
          model:    r[4] || '-',
          size:     r[5] || '-',
          color:    r[6] || '-',
          sn:       r[7] || '-',
          dateIn:   r[8] ? formatDateSafe(r[8]) : '',
          value:    parseFloat(r[9]) || 0,
          owner:    r[10] || '',
          location: r[14] || r[11] || '',  // ใช้คอลัมน์ล่าสุด (68) ก่อน
          status:   r[15] || 'ปกติ',
          images:   []
        });
      }
    });

    // ── BORROW (เบิก/ยืม) — Sheet: AssetRent ──
    var borrow = [];
    var rentSheet = ss.getSheetByName('AssetRent');
    if (rentSheet) {
      var rentData = rentSheet.getDataRange().getValues();
      // headers: Equipment ID, Equipment Name, Model/Brand, Borrow,
      //          Borrower Name, Borrow Date, Return Date, Remark,
      //          Usage Status, ..., Image
      for (var i = 1; i < rentData.length; i++) {
        var r = rentData[i];
        if (!r[0]) continue;
        borrow.push({
          id:         r[0] ? r[0].toString().trim() : '',
          name:       r[1] || '',
          model:      r[2] || '-',
          borrow:     r[3] || 'เบิก',
          borrower:   r[4] || '',
          borrowDate: r[5] ? formatDateSafe(r[5]) : '',
          returnDate: r[6] ? formatDateSafe(r[6]) : '-',
          remark:     r[7] || '',
          status:     r[8] || 'เบิก/ยืม',
          location:   r[12] || '',
          responsible: r[13] || '',
          images:     r[16] ? [r[16]] : []
        });
      }
    }

    // ── RETURN (คืน) — Sheet: AssetReturn ──
    var returned = [];
    var retSheet = ss.getSheetByName('AssetReturn');
    if (retSheet) {
      var retData = retSheet.getDataRange().getValues();
      // headers: Equipment ID, Equipment Name, Model/Brand, Return Status,
      //          Returner Name, Return Date, Return Remark, ...
      for (var i = 1; i < retData.length; i++) {
        var r = retData[i];
        if (!r[0]) continue;
        returned.push({
          id:           r[0] ? r[0].toString().trim() : '',
          name:         r[1] || '',
          model:        r[2] || '-',
          returnStatus: r[3] || 'คืนแล้ว',
          returner:     r[4] || '',
          returnDate:   r[5] ? formatDateSafe(r[5]) : '',
          remark:       r[6] || '',
          status:       r[3] || 'คืนแล้ว',
          location:     r[12] || '',
          responsible:  r[13] || '',
          images:       r[15] ? [r[15]] : []
        });
      }
    }

    return {
      consumable: consumable,
      durable:    durable,
      borrow:     borrow,
      return:     returned
    };

  } catch (e) {
    Logger.log('Error getAllEquipmentData: ' + e);
    throw new Error(e.message);
  }
}


/**
 * saveEquipmentItem(section, obj, editIndex)
 * เพิ่ม/แก้ไข 1 รายการ พร้อมอัพโหลดรูปไป Drive
 * @param {string} section  'consumable' | 'durable' | 'borrow' | 'return'
 * @param {Object} obj      ข้อมูลรายการ (มี images[] เป็น array ของ { name, base64, mimeType })
 * @param {number} editIndex -1 = เพิ่มใหม่, >= 0 = แก้ไขแถวนั้น (0-based นับจาก data row)
 */
function saveEquipmentItem(section, obj, editIndex) {
  requireRole(['admin', 'assistant'], 'saveEquipmentItem'); // 🔐
  try {
    var config = getConfig();
    var ss = SpreadsheetApp.openById(config.EQ_DB_ID || config.SHEET_ID);

    // Map section → sheet name
    var sheetMap = {
      consumable: 'AssetConsume',
      durable:    'สำนักงาน',   // default; ในอนาคตอาจส่ง sheetName มาด้วย
      borrow:     'AssetRent',
      return:     'AssetReturn'
    };
    var sheetName = sheetMap[section];
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error('ไม่พบ Sheet: ' + sheetName);

    // ── อัพโหลดรูปภาพไป Drive แล้วคืน URL กลับมา ──
    var imageUrl = '';
    if (obj.images && obj.images.length > 0) {
      var imgFolder = _getOrCreateFolder('TIJ_Equipment_Images');
      var imgData   = obj.images[0]; // บันทึกแค่รูปแรกลงใน sheet (ที่เหลือเก็บใน Drive folder)

      // รับทั้งแบบ { base64, name, mimeType } และแบบ dataUrl string
      var base64, mime, fname;
      if (typeof imgData === 'string' && imgData.startsWith('http')) {
        imageUrl = imgData; // เป็น URL อยู่แล้ว ไม่ต้อง upload ซ้ำ
      } else if (imgData.base64) {
        base64   = imgData.base64;
        mime     = imgData.mimeType || 'image/jpeg';
        fname    = imgData.name || (section + '_' + Date.now() + '.jpg');
        var blob = Utilities.newBlob(Utilities.base64Decode(base64), mime, fname);
        var file = imgFolder.createFile(blob);
        safeSetSharingView(file);
        imageUrl = file.getUrl();
      } else if (imgData.dataUrl) {
        var parts = imgData.dataUrl.split(';base64,');
        mime     = parts[0].replace('data:', '');
        base64   = parts[1];
        fname    = imgData.name || (section + '_' + Date.now() + '.jpg');
        var blob = Utilities.newBlob(Utilities.base64Decode(base64), mime, fname);
        var file = imgFolder.createFile(blob);
        safeSetSharingView(file);
        imageUrl = file.getUrl();
      }

      // อัพโหลดรูปที่เหลือเก็บใน Drive แต่ไม่เก็บ URL ใน sheet
      for (var k = 1; k < obj.images.length; k++) {
        try {
          var d = obj.images[k];
          var b64 = d.base64 || (d.dataUrl ? d.dataUrl.split(';base64,')[1] : null);
          var mt  = d.mimeType || 'image/jpeg';
          var fn  = d.name || (section + '_extra_' + k + '_' + Date.now() + '.jpg');
          if (b64) {
            imgFolder.createFile(Utilities.newBlob(Utilities.base64Decode(b64), mt, fn));
          }
        } catch(e2) { Logger.log('extra image upload error: ' + e2); }
      }
    }

    // ── Build row array ตาม section ──
    var row;
    if (section === 'consumable') {
      row = [
        "'" + (obj.id || ''),
        obj.name || '',
        obj.unit || '',
        obj.year || '',
        parseFloat(obj.price) || 0,
        parseFloat(obj.count) || 0,
        (parseFloat(obj.price) || 0) * (parseFloat(obj.count) || 0),
        obj.dateBuy || '',
        obj.expire  || '',
        obj.note    || '',
        imageUrl
      ];
    } else if (section === 'durable') {
      row = [
        '',                        // จำนวน (auto)
        '',                        // ลำดับ
        "'" + (obj.id || ''),
        obj.name  || '',
        obj.model || '',
        obj.size  || '',
        obj.color || '',
        obj.sn    || '',
        obj.dateIn|| '',
        parseFloat(obj.value) || 0,
        obj.owner || '',
        obj.location || '',
        '', '', '',                // location 66, 67, 68 (ว่าง)
        obj.status || 'ปกติ'
      ];
    } else if (section === 'borrow') {
      row = [
        "'" + (obj.id || ''),
        obj.name     || '',
        obj.model    || '',
        obj.borrow   || 'เบิก',
        obj.borrower || '',
        obj.borrowDate || '',
        obj.returnDate || '',
        obj.remark   || '',
        obj.status   || 'เบิก/ยืม',
        '', '', '',                // inspection fields
        obj.location    || '',
        obj.responsible || '',
        obj.note        || '',
        '', imageUrl
      ];
    } else {
      // return
      row = [
        "'" + (obj.id || ''),
        obj.name         || '',
        obj.model        || '',
        obj.returnStatus || 'คืนแล้ว',
        obj.returner     || '',
        obj.returnDate   || '',
        obj.remark       || '',
        obj.status       || 'คืนแล้ว',
        '', '', '',
        obj.location     || '',
        obj.responsible  || '',
        obj.note         || '',
        '', imageUrl
      ];
    }

    if (editIndex >= 0) {
      // แก้ไข: แถว editIndex (0-based data row) → sheet row = editIndex + 2
      var sheetRow = editIndex + 2;
      sheet.getRange(sheetRow, 1, 1, row.length).setValues([row]);
    } else {
      // เพิ่มใหม่ท้ายชีต
      sheet.appendRow(row);
    }

    logAudit('SAVE_EQUIPMENT', section + ' | ' + (obj.id || obj.name), 'INFO');
    return { success: true, imageUrl: imageUrl };

  } catch (e) {
    Logger.log('Error saveEquipmentItem: ' + e);
    throw new Error(e.message);
  }
}

function debugDashboardSheets() {
  var config = getConfig();
  var ss = SpreadsheetApp.openById(config.EQ_DB_ID || config.SHEET_ID);
  var sheets = ss.getSheets();

  var validCategories = [
    "สำนักงาน", "ยานพาหนะและขนส่ง", "ยานพาหนะเเละขนส่ง", "ไฟฟ้าและวิทยุ", "ไฟฟ้าเเละวิทยุ",
    "โฆษณาและเผยแพร่", "โฆษณาเเละเผยแพร่", "วิทยาศาสตร์และการแพทย์", "วิทยาศาสตร์เเละการแพทย์",
    "การแพทย์และวิทยาศาสตร์", "คอมพิวเตอร์", "งานบ้านงานครัว", "กีฬา", "สินทรัพย์ไม่มีตัวตน"
  ];

  Logger.log("=== รายชื่อ Sheets ใน EQ_DB_ID ===");
  sheets.forEach(function(sheet) {
    var name = sheet.getName();
    var base = name.replace(" (ว)", "").replace("(ว)", "").trim();
    var matched = validCategories.indexOf(base) !== -1;

    Logger.log((matched ? "✅ MATCH" : "❌ NO MATCH") + " | Sheet: [" + name + "] → base: [" + base + "]");

    // ถ้า match ให้ดู header ด้วย
    if (matched) {
      var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      Logger.log("   Headers: " + JSON.stringify(headers));
    }
  });
}
