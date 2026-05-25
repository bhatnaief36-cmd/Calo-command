// ════════════════════════════════════════════════════════════════════
//  CALO COMMAND CENTER — Google Apps Script Backend
//  Version 4.0 | User management via Dynamic_Users sheet
// ════════════════════════════════════════════════════════════════════
//
//  DEPLOYMENT MODES
//  ─────────────────
//  Mode A — GAS Web App (original):
//    Browser calls google.script.run directly. No Vercel needed.
//    Use: Index.html deployed inside this GAS project.
//
//  Mode B — Vercel Frontend (new):
//    Browser → POST /api/gas (Vercel) → doPost() here → Sheets
//    Use: index.html + api/gas.js deployed on Vercel.
//    Set GAS_URL env var in Vercel = this Web App's /exec URL.
//
// ════════════════════════════════════════════════════════════════════

const MASTER_SHEET_URL  = "https://docs.google.com/spreadsheets/d/1JaPq6XnUVRrlF5NzrjjAJzEtWLWGSMjs0PbUnOXoR1M/edit";
const TRAINING_PLAN_URL = "https://docs.google.com/spreadsheets/d/1yPjpmz7DpruUNiF063p8nfnUpRwgfQs8hfEjHjjdRDE/edit";

// ─── USER REGISTRY ────────────────────────────────────────────────
// Only the Global Admin is hardcoded here.
// ALL other users (L2, L3, L4) are managed via the Dynamic_Users
// sheet tab — add them through the admin panel in the app.
// ──────────────────────────────────────────────────────────────────
const USER_REGISTRY = [
  { name:"ADMIN@CALO.APP", pass:"Sallie@2026", role:"TRAINING_ARCHITECT",
    level:1, market:"All", dept:null, title:"Global Administrator" },
];

// ─── SHEET SCHEMA ─────────────────────────────────────────────────
const EXPECTED_HEADERS = [
  "Name","Designation","Country","Joining Date","Image",
  "PreBoarding_Status","Orientation_Status","HR_Status",
  "Quality_Status","OJTTraining_Status","Assessment_Status",
  "Certification_Status","Trainers","Notes","Priority"
];

// ─── DEFAULT TASK SEEDS (auto-filled on new hire) ─────────────────
const DEFAULT_TASKS = {
  PreBoarding_Status:   "Offer Letter Sent|#|0;;Visa/Work Permit|#|0;;Document Collection|#|0;;Pre-Joining Checklist|#|0;;IT Setup Request|#|0",
  Orientation_Status:   "Welcome & Introductions|#|0;;Company Overview|#|0;;Culture & Values Brief|#|0;;Facilities Tour|#|0;;Policy Handbook Sign-off|#|0",
  HR_Status:            "Contract Signing|#|0;;Payroll Registration|#|0;;Benefits Enrollment|#|0;;System Access Setup|#|0;;ID Badge Issuance|#|0;;Emergency Contacts|#|0",
  Quality_Status:       "Brand Standards Training|#|0;;SOP Documentation Review|#|0;;Food Safety Certification|#|0;;Quality Audit Simulation|#|0",
  OJTTraining_Status:   "Shadow Shift — Observation|#|0;;Shadow Shift — Assisted|#|0;;Supervised Solo Shift|#|0;;Independent Shift|#|0;;Line Check Assessment|#|0",
  Assessment_Status:    "Written Knowledge Test|#|0;;Practical Skills Assessment|#|0;;Role Play Scenarios|#|0;;Manager Evaluation|#|0;;Peer Review|#|0",
  Certification_Status: "Final Competency Assessment|#|0;;Certificate of Completion|#|0;;Floor Ready Confirmation|#|0"
};

// ════════════════════════════════════════════════════════════════════
//  ENTRY POINTS
// ════════════════════════════════════════════════════════════════════

// MODE FLAG — set false for Vercel (GAS is API only, no HTML needed here)
//             set true  for GAS Web App mode (requires Index.html in this project)
const SERVE_HTML = false;

// doGet — handles browser visits and GET-based API calls
function doGet(e) {
  if (e && e.parameter && e.parameter.action) {
    return _jsonOut(_routeAction(e.parameter.action, e.parameter));
  }

  if (!SERVE_HTML) {
    return _jsonOut({
      status: 'ok',
      message: 'Calo Command Center API — POST requests only.',
      hint: 'Set SERVE_HTML = true in Code.gs and add Index.html to this project to use GAS web app mode.'
    });
  }

  try {
    return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle('Calo Command Center')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    return _jsonOut({
      error: 'Index.html not found in this Apps Script project.',
      fix: 'Either (1) add Index.html to this project and set SERVE_HTML=true, or (2) set SERVE_HTML=false and use Vercel to host the frontend.'
    });
  }
}

// doPost — Vercel proxy posts JSON body here → routes to the right function
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const result = _routeAction(body.action, body);
    return _jsonOut(result);
  } catch (err) {
    Logger.log('doPost error: ' + err);
    return _jsonOut({ error: err.toString() });
  }
}

// ─── JSON output helper ───────────────────────────────────────────
function _jsonOut(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── Central action router ────────────────────────────────────────
function _routeAction(action, p) {
  switch (action) {
    // Auth
    case 'checkLogin':
      return checkLogin(p.username, p.password);
    case 'addDynamicUser':
      return addDynamicUser(p.user);

    // User management (admin panel)
    case 'getUsers':
      return getUsers();
    case 'deleteUser':
      return deleteUser(p.username);
    case 'updateUserPassword':
      return updateUserPassword(p.username, p.newPassword);

    // Read
    case 'getPipelineData':
      return getPipelineData();
    case 'getAnalytics':
      return getAnalytics();
    case 'getTemplateList':
      return getTemplateList();
    case 'getTasksFromTemplate':
      return getTasksFromTemplate(p.tab);

    // Write
    case 'saveFullUpdate':
      return saveFullUpdate(p.row, p.colLabel, p.taskStr, p.trainer);
    case 'updateTrainer':
      return updateTrainer(p.row, p.stage, p.name, p.img);
    case 'updateCandidatePhoto':
      return updateCandidatePhoto(p.row, p.imgData);
    case 'updateCandidateField':
      return updateCandidateField(p.row, p.field, p.value);
    case 'addNewEmployee':
      return addNewEmployee(p.emp);
    case 'deleteEmployee':
      return deleteEmployee(p.row);

    default:
      return { error: 'Unknown action: ' + action };
  }
}

// ════════════════════════════════════════════════════════════════════
//  AUTH
// ════════════════════════════════════════════════════════════════════

function checkLogin(username, password) {
  if (!username || !password) return { success: false };

  // 1. Check hardcoded registry first (only Global Admin is here)
  const u = USER_REGISTRY.find(x =>
    x.name === username.toUpperCase().trim() && x.pass === password.trim()
  );
  if (u) return { success:true, name:u.name, role:u.role, level:u.level, market:u.market, dept:u.dept||null, title:u.title };

  // 2. Check Dynamic_Users sheet tab (users added via the admin panel)
  try {
    const ss = SpreadsheetApp.openByUrl(MASTER_SHEET_URL);
    let dynSheet = ss.getSheetByName('Dynamic_Users');
    if (!dynSheet) return { success: false };
    const rows = dynSheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      const [uname, pass, name, level, market, dept, title, active] = rows[i];
      if (String(uname).toUpperCase().trim() === username.toUpperCase().trim()
          && String(pass).trim() === password.trim()
          && String(active).toUpperCase() !== 'FALSE') {
        const lvl = parseInt(level) || 3;
        const roleMap = {1:'TRAINING_ARCHITECT',2:'REGIONAL_SPECIALIST',3:'TRAINING_COORDINATOR',4:'DEPT_TRAINER'};
        return { success:true, name:String(uname).toUpperCase(), role:roleMap[lvl]||'DEPT_TRAINER',
                 level:lvl, market:String(market)||'UAE', dept:dept||null, title:String(title)||'' };
      }
    }
  } catch(e) { /* sheet not found or error — fall through */ }

  return { success: false };
}

// ─── Add a new user (called from L1 and L3 admin panels) ─────────
function addDynamicUser(user) {
  try {
    const ss = SpreadsheetApp.openByUrl(MASTER_SHEET_URL);
    let dynSheet = ss.getSheetByName('Dynamic_Users');
    if (!dynSheet) {
      dynSheet = ss.insertSheet('Dynamic_Users');
      dynSheet.appendRow(['Username','Password','Name','Level','Market','Dept','Title','Active']);
      dynSheet.getRange(1,1,1,8).setFontWeight('bold');
    }
    dynSheet.appendRow([
      String(user.username).trim(),
      user.pass,
      user.name,
      user.level,
      user.market,
      user.dept || '',
      user.title || '',
      'TRUE'
    ]);
    return { success: true };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

// ─── Get all users from Dynamic_Users sheet ───────────────────────
function getUsers() {
  try {
    const ss = SpreadsheetApp.openByUrl(MASTER_SHEET_URL);
    const dynSheet = ss.getSheetByName('Dynamic_Users');
    if (!dynSheet) return [];
    const rows = dynSheet.getDataRange().getValues();
    if (rows.length < 2) return [];
    const users = [];
    for (let i = 1; i < rows.length; i++) {
      const [uname, pass, name, level, market, dept, title, active] = rows[i];
      if (!uname) continue;
      users.push({
        username: String(uname).trim(),
        pass:     String(pass).trim(),
        name:     String(name).trim(),
        level:    parseInt(level) || 4,
        market:   String(market).trim(),
        dept:     String(dept || '').trim(),
        title:    String(title || '').trim(),
        active:   String(active).toUpperCase() !== 'FALSE'
      });
    }
    return users;
  } catch(e) {
    Logger.log('getUsers error: ' + e);
    return [];
  }
}

// ─── Delete a user by username ────────────────────────────────────
function deleteUser(username) {
  if (!username) return { success: false, message: 'No username provided' };
  try {
    const ss = SpreadsheetApp.openByUrl(MASTER_SHEET_URL);
    const dynSheet = ss.getSheetByName('Dynamic_Users');
    if (!dynSheet) return { success: false, message: 'Dynamic_Users sheet not found' };
    const rows = dynSheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]).toUpperCase().trim() === String(username).toUpperCase().trim()) {
        dynSheet.deleteRow(i + 1);
        SpreadsheetApp.flush();
        return { success: true };
      }
    }
    return { success: false, message: 'User not found' };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

// ─── Reset a user's password ──────────────────────────────────────
function updateUserPassword(username, newPassword) {
  if (!username || !newPassword) return { success: false, message: 'Missing username or password' };
  try {
    const ss = SpreadsheetApp.openByUrl(MASTER_SHEET_URL);
    const dynSheet = ss.getSheetByName('Dynamic_Users');
    if (!dynSheet) return { success: false, message: 'Dynamic_Users sheet not found' };
    const rows = dynSheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]).toUpperCase().trim() === String(username).toUpperCase().trim()) {
        dynSheet.getRange(i + 1, 2).setValue(newPassword);
        SpreadsheetApp.flush();
        return { success: true };
      }
    }
    return { success: false, message: 'User not found' };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

// ════════════════════════════════════════════════════════════════════
//  INTERNAL HELPERS
// ════════════════════════════════════════════════════════════════════

function _sheet() {
  return SpreadsheetApp.openByUrl(MASTER_SHEET_URL).getSheets()[0];
}

function _parseStatus(raw) {
  const str = String(raw || '');
  if (!str.trim()) return { items:[], done:0, total:0 };
  const items = str.split(';;').filter(x => x.trim()).map(x => {
    const p = x.split('|');
    return { name:p[0]||'', link:p[1]||'#', done:p[2]==='1' };
  });
  return { items, done:items.filter(x=>x.done).length, total:items.length };
}

function _parseTrainers(raw) {
  const obj = {
    pre:{name:'',img:''}, ori:{name:'',img:''}, hr:{name:'',img:''},
    qual:{name:'',img:''}, ojt:{name:'',img:''}, assess:{name:'',img:''}, cert:{name:'',img:''}
  };
  String(raw||'').split(';;').filter(x=>x).forEach(c => {
    const p = c.split('|');
    if (p[0] && obj.hasOwnProperty(p[0])) obj[p[0]] = { name:p[1]||'', img:p[2]||'' };
  });
  return obj;
}

function _col(head, name) {
  return head.findIndex(h => h.toString().trim() === name);
}

// ════════════════════════════════════════════════════════════════════
//  READ — PIPELINE DATA
// ════════════════════════════════════════════════════════════════════

function getPipelineData() {
  try {
    const sheet = _sheet();
    const data  = sheet.getDataRange().getValues();
    const head  = data[0].map(h => h.toString().trim());
    const C = {
      name:   _col(head,'Name'),
      role:   _col(head,'Designation'),
      date:   _col(head,'Joining Date'),
      country:_col(head,'Country'),
      img:    _col(head,'Image'),
      pre:    _col(head,'PreBoarding_Status'),
      ori:    _col(head,'Orientation_Status'),
      hr:     _col(head,'HR_Status'),
      qual:   _col(head,'Quality_Status'),
      ojt:    _col(head,'OJTTraining_Status'),
      assess: _col(head,'Assessment_Status'),
      cert:   _col(head,'Certification_Status'),
      trn:    _col(head,'Trainers'),
      notes:  _col(head,'Notes'),
      pri:    _col(head,'Priority'),
      jdept:  _col(head,'JoiningDept'),
    };

    return data.slice(1).map((r, i) => {
      const jd = r[C.date] instanceof Date ? r[C.date] : (r[C.date] ? new Date(r[C.date]) : null);
      return {
        row:        i + 2,
        name:       String(r[C.name]    || '').trim(),
        role:       String(r[C.role]    || ''),
        country:    String(r[C.country] || ''),
        image:      String(r[C.img]     || ''),
        notes:      String(r[C.notes]   || ''),
        priority:   String(r[C.pri]     || 'normal'),
        joiningDept:String(C.jdept > -1 ? (r[C.jdept] || '') : ''),
        dateString: jd ? Utilities.formatDate(jd, 'GMT+3', 'dd/MM/yyyy') : 'N/A',
        month:      jd ? jd.getMonth()    : null,
        year:       jd ? jd.getFullYear() : null,
        pre:        _parseStatus(r[C.pre]),
        ori:        _parseStatus(r[C.ori]),
        hr:         _parseStatus(r[C.hr]),
        qual:       _parseStatus(r[C.qual]),
        ojt:        _parseStatus(r[C.ojt]),
        assess:     _parseStatus(r[C.assess]),
        cert:       _parseStatus(r[C.cert]),
        trainers:   _parseTrainers(r[C.trn]),
      };
    }).filter(e => e.name);

  } catch (err) {
    Logger.log('getPipelineData: ' + err);
    return [];
  }
}

// ════════════════════════════════════════════════════════════════════
//  READ — ANALYTICS SUMMARY
// ════════════════════════════════════════════════════════════════════

function getAnalytics() {
  const data = getPipelineData();
  const keys = ['pre','ori','hr','qual','ojt','assess','cert'];
  const markets = {};

  data.forEach(e => {
    if (!markets[e.country]) markets[e.country] = { total:0, certified:0, inProgress:0, pending:0 };
    const m = markets[e.country];
    m.total++;
    const cert      = e.cert.total > 0 && e.cert.done === e.cert.total;
    const hasStarted = keys.some(k => e[k].done > 0);
    if (cert)        m.certified++;
    else if (hasStarted) m.inProgress++;
    else             m.pending++;
  });

  const avg = data.length > 0 ? Math.round(
    data.reduce((acc, e) => {
      const t = keys.reduce((s,k) => s + e[k].total, 0);
      const d = keys.reduce((s,k) => s + e[k].done,  0);
      return acc + (t > 0 ? d/t : 0);
    }, 0) / data.length * 100
  ) : 0;

  return {
    total:         data.length,
    certified:     data.filter(e => e.cert.total > 0 && e.cert.done === e.cert.total).length,
    inProgress:    data.filter(e => keys.some(k => e[k].done > 0) && !(e.cert.total > 0 && e.cert.done === e.cert.total)).length,
    pending:       data.filter(e => keys.every(k => e[k].done === 0)).length,
    avgCompletion: avg,
    markets,
  };
}

// ════════════════════════════════════════════════════════════════════
//  WRITE OPERATIONS
// ════════════════════════════════════════════════════════════════════

function saveFullUpdate(row, colLabel, taskStr, trainer) {
  try {
    const sheet = _sheet();
    const head  = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];

    const cIdx = head.findIndex(h => h === colLabel) + 1;
    if (cIdx > 0) sheet.getRange(row, cIdx).setValue(taskStr);

    const tIdx = head.findIndex(h => h === 'Trainers') + 1;
    if (tIdx > 0 && trainer && trainer.name) {
      const existing = String(sheet.getRange(row, tIdx).getValue() || '');
      const map = {};
      existing.split(';;').filter(x=>x).forEach(c => { const p=c.split('|'); map[p[0]]=c; });
      const key = colLabel.replace('_Status','').toLowerCase()
        .replace('preboarding','pre').replace('orientation','ori')
        .replace('ojttraining','ojt').replace('assessment','assess')
        .replace('certification','cert').replace('quality','qual');
      map[key] = `${key}|${trainer.name}|${trainer.img||''}`;
      sheet.getRange(row, tIdx).setValue(Object.values(map).join(';;'));
    }
    SpreadsheetApp.flush();
    return 'OK';
  } catch (err) { Logger.log(err); return 'ERROR: ' + err; }
}

function updateTrainer(row, stage, name, img) {
  try {
    const sheet = _sheet();
    const head  = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
    const tIdx  = head.findIndex(h => h === 'Trainers') + 1;
    if (tIdx < 1) return 'ERROR: Trainers column not found';
    const existing = String(sheet.getRange(row, tIdx).getValue() || '');
    const map = {};
    existing.split(';;').filter(x=>x).forEach(c => { const p=c.split('|'); if(p[0]) map[p[0]]=c; });
    map[stage] = `${stage}|${name}|${img||''}`;
    sheet.getRange(row, tIdx).setValue(Object.values(map).join(';;'));
    SpreadsheetApp.flush();
    return 'OK';
  } catch (err) { Logger.log(err); return 'ERROR: ' + err; }
}

function updateCandidatePhoto(row, imgData) {
  try {
    const sheet = _sheet();
    const head  = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
    const idx   = head.findIndex(h => h === 'Image') + 1;
    if (idx > 0) sheet.getRange(row, idx).setValue(imgData);
    SpreadsheetApp.flush();
    return 'OK';
  } catch (err) { return 'ERROR'; }
}

function updateCandidateField(row, field, value) {
  try {
    const sheet = _sheet();
    const head  = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
    const idx   = head.findIndex(h => h === field) + 1;
    if (idx > 0) { sheet.getRange(row, idx).setValue(value); SpreadsheetApp.flush(); }
    return 'OK';
  } catch (err) { return 'ERROR'; }
}

function addNewEmployee(emp) {
  try {
    const sheet = _sheet();
    const head  = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(h=>h.toString().trim());
    const row   = new Array(head.length).fill('');
    const set   = (n,v) => { const i=head.indexOf(n); if(i>-1) row[i]=v; };

    set('Name',        emp.name.toUpperCase().trim());
    set('Designation', emp.role || '');
    set('Country',     emp.country || '');
    set('Image',       emp.image || '');
    set('Notes',       emp.notes || '');
    set('Priority',    emp.priority || 'normal');
    if (emp.date) set('Joining Date', new Date(emp.date));

    Object.entries(DEFAULT_TASKS).forEach(([col, tasks]) => set(col, tasks));

    sheet.appendRow(row);
    SpreadsheetApp.flush();
    return 'OK';
  } catch (err) { Logger.log(err); return 'ERROR: ' + err; }
}

function deleteEmployee(row) {
  try {
    _sheet().deleteRow(Number(row));
    SpreadsheetApp.flush();
    return 'OK';
  } catch (err) { return 'ERROR'; }
}

// ════════════════════════════════════════════════════════════════════
//  TRAINING TEMPLATES
// ════════════════════════════════════════════════════════════════════

function getTemplateList() {
  try {
    return SpreadsheetApp.openByUrl(TRAINING_PLAN_URL)
      .getSheets().map(s => s.getName())
      .filter(n => !['Read Me','Draft'].includes(n));
  } catch (err) { Logger.log(err); return []; }
}

function getTasksFromTemplate(tab) {
  try {
    const sheet = SpreadsheetApp.openByUrl(TRAINING_PLAN_URL).getSheetByName(tab);
    if (!sheet) return [];
    const vals = sheet.getDataRange().getValues();
    const rich = sheet.getDataRange().getRichTextValues();
    let tasks = []; let d = 1;

    for (let r = 0; r < vals.length; r++) {
      if (String(vals[r][0]).toUpperCase().includes('WEEK')) {
        for (let c = 1; c <= 7; c++) {
          let day = [];
          for (let s = r+1; s < vals.length; s++) {
            if (String(vals[s][0]).toUpperCase().includes('WEEK')) break;
            if (vals[s][c]) day.push({ name:'Day '+d+': '+vals[s][c], link:rich[s][c].getLinkUrl()||'#', done:false });
          }
          if (day.length) { tasks = tasks.concat(day); d++; }
        }
      }
    }
    return tasks;
  } catch (err) { Logger.log(err); return []; }
}

// ════════════════════════════════════════════════════════════════════
//  ONE-TIME SETUP HELPER
//  Run from Script Editor → ensureSheetHeaders()
// ════════════════════════════════════════════════════════════════════

function ensureSheetHeaders() {
  const sheet   = _sheet();
  const current = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(h=>h.toString().trim());
  EXPECTED_HEADERS.forEach(h => {
    if (!current.includes(h)) {
      sheet.getRange(1, current.length + 1).setValue(h);
      current.push(h);
    }
  });
  SpreadsheetApp.flush();
  Logger.log('✓ Headers ready: ' + current.join(', '));
  return 'OK — ' + current.join(', ');
}

// ════════════════════════════════════════════════════════════════════
//  SAMPLE DATA LOADER
//  Run ONCE from Script Editor → loadSampleData()
//  Inserts 10 realistic employees across all 8 Mountain Peaks
//  with different stage completion levels so the dashboard is live
// ════════════════════════════════════════════════════════════════════

function loadSampleData() {

  ensureSheetHeaders();

  const sheet = _sheet();
  const head  = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(h=>h.toString().trim());
  const set   = (row, col, val) => { const i = head.indexOf(col); if(i>-1) row[i]=val; };
  const blank = () => new Array(head.length).fill('');

  const tasks = (list, doneCnt) =>
    list.map((name, i) => `${name}|#|${i < doneCnt ? '1' : '0'}`).join(';;');

  const T = {
    pre:    ['Offer Letter Sent','Visa/Work Permit','Document Collection','Pre-Joining Checklist','IT Setup Request'],
    ori:    ['Welcome & Introductions','Company Overview','Culture & Values Brief','Facilities Tour','Policy Handbook Sign-off'],
    hr:     ['Contract Signing','Payroll Registration','Benefits Enrollment','System Access Setup','ID Badge Issuance','Emergency Contacts'],
    qual:   ['Brand Standards Training','SOP Documentation Review','Food Safety Certification','Quality Audit Simulation'],
    ojt:    ['Shadow Shift — Observation','Shadow Shift — Assisted','Supervised Solo Shift','Independent Shift','Line Check Assessment'],
    assess: ['Written Knowledge Test','Practical Skills Assessment','Role Play Scenarios','Manager Evaluation','Peer Review'],
    cert:   ['Final Competency Assessment','Certificate of Completion','Floor Ready Confirmation'],
  };

  const trainer = (key, name) => `${key}|${name}|`;

  const SAMPLES = [
    {
      name:'AHMED AL RASHIDI', role:'Kitchen Supervisor', country:'UAE',
      date:'2025-04-01', priority:'normal', notes:'Strong candidate from previous outlet',
      image:'https://randomuser.me/api/portraits/men/11.jpg',
      pre:5, ori:5, hr:6, qual:4, ojt:5, assess:5, cert:3,
      trainer: [trainer('pre','Sara K'),trainer('hr','Mona T'),trainer('cert','James R')].join(';;')
    },
    {
      name:'FATIMA AL ZAABI', role:'Delivery Operations Lead', country:'UAE',
      date:'2025-04-05', priority:'high', notes:'Fast tracker — needs quality sign-off',
      image:'https://randomuser.me/api/portraits/women/12.jpg',
      pre:5, ori:5, hr:6, qual:3, ojt:4, assess:2, cert:0,
      trainer: [trainer('pre','Sara K'),trainer('ojt','Khalid M')].join(';;')
    },
    {
      name:'MOHAMMED AL SAEEDI', role:'Fleet Coordinator', country:'Qatar',
      date:'2025-04-08', priority:'normal', notes:'',
      image:'https://randomuser.me/api/portraits/men/22.jpg',
      pre:5, ori:5, hr:6, qual:4, ojt:5, assess:5, cert:3,
      trainer: [trainer('hr','Layla A'),trainer('cert','Omar S')].join(';;')
    },
    {
      name:'SARAH JOHNSON', role:'Customer Experience Manager', country:'UK',
      date:'2025-04-10', priority:'normal', notes:'Relocated from London HQ',
      image:'https://randomuser.me/api/portraits/women/33.jpg',
      pre:5, ori:4, hr:5, qual:2, ojt:1, assess:0, cert:0,
      trainer: [trainer('pre','Tom W'),trainer('ori','Alice B')].join(';;')
    },
    {
      name:'KHALID AL MUTAIRI', role:'Packing Supervisor', country:'Kuwait',
      date:'2025-04-12', priority:'urgent', notes:'Urgently needed for Ramadan peak ops',
      image:'https://randomuser.me/api/portraits/men/44.jpg',
      pre:5, ori:5, hr:6, qual:4, ojt:3, assess:0, cert:0,
      trainer: [trainer('ojt','Nadia R')].join(';;')
    },
    {
      name:'NOUR AL BALUSHI', role:'Quality Analyst', country:'Oman',
      date:'2025-04-15', priority:'normal', notes:'',
      image:'https://randomuser.me/api/portraits/women/55.jpg',
      pre:5, ori:5, hr:4, qual:0, ojt:0, assess:0, cert:0,
      trainer: [trainer('pre','Ahmed Z')].join(';;')
    },
    {
      name:'TARIQ AL DOSARI', role:'Cold Chain Specialist', country:'Bahrain',
      date:'2025-04-18', priority:'high', notes:'Specialized cold chain certification needed',
      image:'https://randomuser.me/api/portraits/men/66.jpg',
      pre:5, ori:5, hr:6, qual:4, ojt:5, assess:4, cert:1,
      trainer: [trainer('assess','Hana P'),trainer('cert','Samir L')].join(';;')
    },
    {
      name:'REEM AL GHAMDI', role:'Training Coordinator', country:'Riyadh',
      date:'2025-04-20', priority:'normal', notes:'Internal transfer from Jeddah branch',
      image:'https://randomuser.me/api/portraits/women/77.jpg',
      pre:5, ori:3, hr:2, qual:0, ojt:0, assess:0, cert:0,
      trainer: [trainer('ori','Faisal H')].join(';;')
    },
    {
      name:'HASSAN AL MALKI', role:'Logistics Officer', country:'Jeddah',
      date:'2025-04-22', priority:'normal', notes:'',
      image:'https://randomuser.me/api/portraits/men/88.jpg',
      pre:5, ori:5, hr:6, qual:4, ojt:5, assess:5, cert:2,
      trainer: [trainer('hr','Dina M'),trainer('ojt','Ziad K')].join(';;')
    },
    {
      name:'LINA HASSAN', role:'Ops Analyst', country:'Qatar',
      date:'2025-04-25', priority:'normal', notes:'First week — just started',
      image:'https://randomuser.me/api/portraits/women/99.jpg',
      pre:2, ori:0, hr:0, qual:0, ojt:0, assess:0, cert:0,
      trainer: ''
    },
  ];

  let added = 0;
  SAMPLES.forEach(emp => {
    const row = blank();
    set(row, 'Name',                 emp.name.toUpperCase());
    set(row, 'Designation',          emp.role);
    set(row, 'Country',              emp.country);
    set(row, 'Joining Date',         new Date(emp.date));
    set(row, 'Image',                emp.image);
    set(row, 'Notes',                emp.notes);
    set(row, 'Priority',             emp.priority);
    set(row, 'PreBoarding_Status',   tasks(T.pre,    emp.pre));
    set(row, 'Orientation_Status',   tasks(T.ori,    emp.ori));
    set(row, 'HR_Status',            tasks(T.hr,     emp.hr));
    set(row, 'Quality_Status',       tasks(T.qual,   emp.qual));
    set(row, 'OJTTraining_Status',   tasks(T.ojt,    emp.ojt));
    set(row, 'Assessment_Status',    tasks(T.assess, emp.assess));
    set(row, 'Certification_Status', tasks(T.cert,   emp.cert));
    if (emp.trainer && typeof emp.trainer === 'string') set(row, 'Trainers', emp.trainer);
    sheet.appendRow(row);
    added++;
  });

  SpreadsheetApp.flush();
  Logger.log(`✓ Loaded ${added} sample employees`);
  return `✓ Done — ${added} sample employees added. Refresh your app to see them.`;
}
