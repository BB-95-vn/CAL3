// ============================================================
// PHẦN 1: CẤU HÌNH & DỮ LIỆU (Logic Gốc - Giữ nguyên output)
// ============================================================
const APP_VERSION = "v10-tet-final";
const AM_URL = "data/amlich_normalized.csv";
const SOLAR_URL = "data/solar_terms_4zones_2000_2100_with_utc.csv";

// 12 TIẾT (bỏ trung khí) -> Chi mapping (THEO DANH SÁCH CHUẨN)
const TIET_TO_CHI = {
  minor_cold: "Sửu", start_of_spring: "Dần", awakening_of_insects: "Mão",
  pure_brightness: "Thìn", start_of_summer: "Tỵ", grain_in_ear: "Ngọ",
  minor_heat: "Mùi", start_of_autumn: "Thân", white_dew: "Dậu",
  cold_dew: "Tuất", start_of_winter: "Hợi", major_snow: "Tý",
};
const TIET_KEYS = new Set(Object.keys(TIET_TO_CHI));

// Tứ hóa theo Can
const TU_HOA = {
  "Giáp": { loc: "Liêm", quyen: "Phá",   khoa: "Vũ",    ky: "Dương" },
  "Ất":   { loc: "Cơ",   quyen: "Lương", khoa: "Vi",    ky: "Nguyệt" },
  "Bính": { loc: "Đồng", quyen: "Cơ",    khoa: "Xương", ky: "Liêm" },
  "Đinh": { loc: "Nguyệt", quyen: "Đồng", khoa: "Cơ",  ky: "Cự" },
  "Mậu":  { loc: "Tham", quyen: "Nguyệt", khoa: "Bật",  ky: "Cơ" },
  "Kỷ":   { loc: "Vũ",   quyen: "Tham",   khoa: "Lương",ky: "Khúc" },
  "Canh": { loc: "Nhật", quyen: "Vũ",     khoa: "Âm",   ky: "Đồng" },
  "Tân":  { loc: "Cự",   quyen: "Nhật",   khoa: "Khúc", ky: "Xương" },
  "Nhâm": { loc: "Lương",quyen: "Vi",     khoa: "Phủ",  ky: "Vũ" },
  "Quý":  { loc: "Phá",  quyen: "Cự",     khoa: "Âm",   ky: "Tham" },
};

// ---------- Helper Functions (Giữ nguyên) ----------
function yearCanFromYearNumber(y){
  const yy = parseInt(y,10);
  if (!yy) return "";
  return CAN_10[(yy + 6) % 10];
}

const CAN_10 = ["Giáp","Ất","Bính","Đinh","Mậu","Kỷ","Canh","Tân","Nhâm","Quý"];
const CHI_12_MONTH_ORDER = ["Dần","Mão","Thìn","Tỵ","Ngọ","Mùi","Thân","Dậu","Tuất","Hợi","Tý","Sửu"];

const YEARCAN_TO_DAN_CAN = {
  "Giáp":"Bính", "Kỷ":"Bính", "Ất":"Mậu", "Canh":"Mậu",
  "Bính":"Canh","Tân":"Canh", "Đinh":"Nhâm","Nhâm":"Nhâm",
  "Mậu":"Giáp", "Quý":"Giáp",
};

function monthStemFromYearCan(yearCan, monthChi){
  const yc = (yearCan||"").trim();
  const mc = (monthChi||"").trim();
  const danCan = YEARCAN_TO_DAN_CAN[yc];
  if (!danCan) return "";
  const baseIdx = CAN_10.indexOf(danCan);
  const mIdx = CHI_12_MONTH_ORDER.indexOf(mc);
  if (baseIdx < 0 || mIdx < 0) return "";
  return CAN_10[(baseIdx + mIdx) % 10];
}

const el = (id) => document.getElementById(id);
function pad2(n){ return String(n).padStart(2,"0"); }
function normDate(s){ return (s || "").slice(0,10); }

function setStatus(ready, msg){
  const s = el("status");
  if (!s) return;
  s.classList.toggle("ready", !!ready);
  s.innerHTML = `<span>${msg}</span>`;
}

function kv(k, v){
  return `<div class="kv"><div class="k">${k}</div><div class="v">${v}</div></div>`;
}

function tuHoaInline(canLabel){
  const key = (canLabel || "").trim();
  const t = TU_HOA[key];
  if (!t) return "N/A";
  return `Lộc: ${t.loc} • Quyền: ${t.quyen} • Khoa: ${t.khoa} • Kỵ: ${t.ky}`;
}

function formatAmLabel(d,m,y,leap){
  return `${pad2(d)}/${pad2(m)}/${y}${leap ? " (N)" : ""}`;
}

let solarMap = new Map();
let lunarMap = new Map();
let termsByTz = new Map();
let termsUtc = [];

function lunarKey(d,m,y,leap){
  return `${d}-${m}-${y}-${leap ? 1 : 0}`;
}

// ---------- SỬA LỖI 1: Thay PapaParse bằng Fetch Native ----------
// Hàm này giúp code chạy được mà không cần file thư viện bên ngoài
function parseCSV(url){
  return fetch(url).then(response => {
    if (!response.ok) throw new Error("Không tải được file: " + url);
    return response.text();
  }).then(text => {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const result = [];
    
    for(let i = 1; i < lines.length; i++) {
        // Xử lý dòng trống
        if(!lines[i].trim()) continue;
        
        // Tách dấu phẩy (Cơ bản)
        const currentline = lines[i].split(',');
        let obj = {};
        headers.forEach((h, index) => {
            obj[h] = currentline[index] ? currentline[index].trim() : "";
        });
        result.push(obj);
    }
    return result;
  });
}

// ---------- Logic Solar Terms (Giữ nguyên) ----------
function getTerms(tz){
  if (tz === "UTC") return termsUtc;
  return termsByTz.get(tz) || [];
}

function findNearestPassedTiet(terms, solarDateStr){
  const input = new Date(solarDateStr + "T00:00:00");
  let best = null;
  let bestD = null;
  for (const t of terms){
    const k = (t.term_key || "").toString().trim();
    if (!TIET_KEYS.has(k)) continue;
    const dStr = normDate((t.date_local || "").toString().trim());
    if (!dStr) continue;
    const d = new Date(dStr + "T00:00:00");
    if (d <= input && (!bestD || d > bestD)){
      best = t; bestD = d;
    }
  }
  if (!best){
    const sorted = terms
      .filter(t => TIET_KEYS.has(((t.term_key||"").toString().trim())) && normDate(((t.date_local||"").toString().trim())))
      .slice()
      .sort((a,b)=> normDate(a.date_local).localeCompare(normDate(b.date_local)));
    best = sorted.length ? sorted[sorted.length - 1] : null;
  }
  return best;
}

// ---------- Render Output (Giữ nguyên HTML Output cũ) ----------
function renderBlockForRow(row, tz){
  const solarDate = row.duong;
  const amLabel = formatAmLabel(+row.am_day, +row.am_month, +row.am_year, +row.am_leap === 1);
  const namCC = `${row.nam_can} ${row.nam_chi}`;
  const thangCC = `${row.thang_can} ${row.thang_chi}`;
  const ngayCC = `${row.ngay_can} ${row.ngay_chi}`;
  const tuHoaNam = tuHoaInline(row.nam_can);
  const tuHoaThang = tuHoaInline(row.thang_can);
  const tuHoaNgay = tuHoaInline(row.ngay_can);
  const terms = getTerms(tz);
  const tiet = findNearestPassedTiet(terms, solarDate);

  let tietText = "Không tìm thấy";
  let chiTiet = "N/A";
  let zodiacCanChi = "N/A";
  let canTiet = "";

  if (tiet){
    chiTiet = TIET_TO_CHI[((tiet.term_key||"").toString().trim())] || "N/A";
    let timeStr = "";
    if (tz === "UTC" && tiet.datetime_utc){
      timeStr = tiet.datetime_utc.replace("T"," ").slice(0,16);
    } else if (tiet.datetime_local){
      timeStr = tiet.datetime_local.replace("T"," ").slice(0,16);
    } else {
      timeStr = normDate(tiet.date_local);
    }
    zodiacCanChi = chiTiet;
    let yearCanForTiet = row.nam_can;
    const lunarYearNum = row.am_year || row.am_nam || row.nam_am || row.namam || row.lunar_year;
    const tietYearStr = (tiet?.date_local || tiet?.datetime_local || "").toString().trim().slice(0,4);
    if (chiTiet === "Dần"){
      const ly = parseInt(lunarYearNum,10);
      const ty = parseInt(tietYearStr,10);
      if (ly && ty && ty === ly + 1){
        yearCanForTiet = yearCanFromYearNumber(ly + 1);
      }
    }
    canTiet = monthStemFromYearCan(yearCanForTiet, chiTiet);
    tietText = `${tiet.term_name} — ${timeStr} <span class="pill">${chiTiet}</span>`;
  }

  return [
    `<div class="sectionTitle" style="color:#ffeb3b; font-weight:bold; margin-bottom:10px;">KẾT QUẢ TRA CỨU</div>`,
    kv("Âm lịch", amLabel),
    kv("Dương lịch", `<span class="pill">${solarDate}</span>`),
    `<div class="sep" style="height:1px; background:var(--border); margin:10px 0; opacity:0.5"></div>`,
    kv("Can Chi năm", namCC),
    kv("Tứ hóa (Can năm)", tuHoaNam),
    kv("Can Chi tháng", thangCC),
    kv("Tứ hóa (Can tháng)", tuHoaThang),
    kv("Can Chi ngày", ngayCC),
    kv("Tứ hóa (Can ngày)", tuHoaNgay),
    `<div class="sep" style="height:1px; background:var(--border); margin:10px 0; opacity:0.5"></div>`,
    kv("Tiết khí gần nhất", tietText),
    kv("Zodiac (tháng tiết)", zodiacCanChi),
    kv("Can Chi tháng tiết", canTiet ? (`${canTiet} ${chiTiet}`) : "N/A"), 
    kv("Tứ hóa (Can tiết)", canTiet ? tuHoaInline(canTiet) : "N/A"),
  ].join("");
}

function showOutput(html){
  el("out").innerHTML = html;
  el("outCard").style.display = "block";
  el("outCard").scrollIntoView({behavior:"smooth", block:"start"});
}

// ---------- Logic Xử lý (SỬA LỖI 2: Update ID tz -> tz2) ----------

function handleLunarLookup(){
  const d = parseInt(el("amDay").value, 10);
  const m = parseInt(el("amMonth").value, 10);
  const y = parseInt(el("amYear").value, 10);
  const leap = el("amLeap").checked;
  
  // FIX: Lấy giá trị từ ID "tz2" thay vì "tz"
  const tzEl = el("tz2");
  const tz = tzEl ? tzEl.value : "Asia/Ho_Chi_Minh";

  if (!(d>=1 && d<=30)) return alert("Ngày âm phải 1..30");
  if (!(m>=1 && m<=12)) return alert("Tháng âm phải 1..12");
  if (!y) return alert("Bạn hãy nhập năm âm");

  const key = lunarKey(d,m,y,leap);
  const rows = lunarMap.get(key) || [];
  const amLabel = formatAmLabel(d,m,y,leap);

  if (!rows.length){
    return showOutput(`<div class="sectionTitle">Kết quả</div>` + kv("Âm lịch", amLabel) + kv("Kết quả", "Không tìm thấy ngày dương tương ứng."));
  }

  if (rows.length === 1){
    return showOutput(renderBlockForRow(rows[0], tz));
  }

  const blocks = rows
    .sort((a,b)=> (a.duong||"").localeCompare(b.duong||""))
    .map((r, idx)=> `<div style="margin-top:${idx===0?0:14}px">${renderBlockForRow(r, tz)}</div>`)
    .join("");
  showOutput(`<div class="sectionTitle">Có ${rows.length} kết quả cho ${amLabel}</div>` + blocks);
}

function handleSolarLookup(){
  const d = el("solarDate").value; 
  // FIX: Lấy giá trị từ ID "tz2"
  const tzEl = el("tz2");
  const tz = tzEl ? tzEl.value : "Asia/Ho_Chi_Minh";
  
  if (!d) return alert("Bạn hãy chọn ngày dương");
  const row = solarMap.get(d);
  if (!row){
    return showOutput(`<div class="sectionTitle">Kết quả</div>` + kv("Ngày dương", d) + kv("Kết quả", "Không có trong database."));
  }
  showOutput(renderBlockForRow(row, tz));
}

function handleLookup(){
  const solarPanel = el("panelSolar");
  const isSolarMode = solarPanel && solarPanel.style.display !== "none";
  if (isSolarMode) return handleSolarLookup();
  return handleLunarLookup();
}

// ---------- INIT ----------
async function init(){
  setStatus(false, "Đang tải dữ liệu…");
  try {
      // 1. Load Lunar Data
      const amRows = await parseCSV(AM_URL);
      for (const r of amRows){
        const dStr = normDate(r.duong);
        if (!dStr) continue;
        r.duong = dStr;
        solarMap.set(dStr, r);
        const key = lunarKey(parseInt(r.am_day,10), parseInt(r.am_month,10), parseInt(r.am_year,10), parseInt(r.am_leap,10)===1);
        if (!lunarMap.has(key)) lunarMap.set(key, []);
        lunarMap.get(key).push(r);
      }

      // 2. Load Solar Terms Data
      const termRows = await parseCSV(SOLAR_URL);
      for (const t of termRows){
        if (t.term_key) t.term_key = String(t.term_key).trim();
        if (t.date_local) t.date_local = String(t.date_local).trim();
        if (t.datetime_local) t.datetime_local = String(t.datetime_local).trim();
        if (t.datetime_utc) t.datetime_utc = String(t.datetime_utc).trim();
        const tz = t.timezone;
        if (tz){
          if (!termsByTz.has(tz)) termsByTz.set(tz, []);
          termsByTz.get(tz).push(t);
        }
        const utcDate = (t.datetime_utc || "").slice(0,10);
        if (utcDate){
          termsUtc.push({ ...t, timezone: "UTC", date_local: utcDate });
        }
      }

      // Sort Terms
      for (const [tz, arr] of termsByTz.entries()){
        arr.sort((a,b)=> normDate(a.date_local).localeCompare(normDate(b.date_local)));
      }
      termsUtc = termsUtc
        .filter(t => normDate(t.date_local))
        .sort((a,b)=> normDate(a.date_local).localeCompare(normDate(b.date_local)) || (a.term_key||"").localeCompare(b.term_key||""));
      
      const seen = new Set();
      termsUtc = termsUtc.filter(t=>{
        const k = `${normDate(t.date_local)}|${t.term_key||""}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });

      // UI Ready
      el("btn").disabled = false;
      el("btn").innerText = "TRA CỨU NGAY"; 
      el("btn").addEventListener("click", handleLookup);

      // Tabs Logic
      const tabL = el("tabLunar");
      const tabS = el("tabSolar");
      const pL = el("panelLunar");
      const pS = el("panelSolar");
      function setMode(mode){
        if (mode === "lunar"){
          tabL.classList.add("active"); tabS.classList.remove("active");
          pL.style.display = ""; pS.style.display = "none";
        } else {
          tabS.classList.add("active"); tabL.classList.remove("active");
          pS.style.display = ""; pL.style.display = "none";
        }
        el("outCard").style.display = "none";
      }
      tabL.addEventListener("click", ()=> setMode("lunar"));
      tabS.addEventListener("click", ()=> setMode("solar"));

      setStatus(true, `Sẵn sàng (${APP_VERSION})`);

  } catch (err) {
      console.error(err);
      setStatus(false, "Lỗi tải dữ liệu. Hãy chạy trên GitHub Pages!");
      alert("Lỗi: Không đọc được file CSV. Bạn đang mở file trực tiếp? Hãy upload lên GitHub Pages để chạy nhé.");
  }
}

init();

// ============================================================
// PHẦN 2: HIỆU ỨNG PHÁO HOA (Mới thêm vào)
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('fireworks-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const banner = document.getElementById('greeting-banner');
    let w, h, particles = [];

    function resizeCanvas() {
        if(banner) { w = canvas.width = banner.offsetWidth; h = canvas.height = banner.offsetHeight; }
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    function randomColor() { return ['#FFD700', '#FFEB3B', '#FF5722', '#F44336', '#FFFDE7', '#00ff00', '#00ffff'][Math.floor(Math.random() * 7)]; }

    class Particle {
        constructor(x, y) {
            this.x = x; this.y = y;
            this.vx = (Math.random() - 0.5) * 4;
            this.vy = (Math.random() - 0.5) * 4;
            this.alpha = 1; this.color = randomColor();
            this.radius = Math.random() * 2 + 1;
            this.decay = Math.random() * 0.02 + 0.015;
        }
        update() { this.x += this.vx; this.y += this.vy; this.vy += 0.05; this.alpha -= this.decay; }
        draw(ctx) { ctx.save(); ctx.globalAlpha = this.alpha; ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fillStyle = this.color; ctx.fill(); ctx.restore(); }
    }
    function createExplosion(x, y) { for (let i = 0; i < 20; i++) particles.push(new Particle(x, y)); }
    function animate() {
        ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'; ctx.fillRect(0, 0, w, h); ctx.globalCompositeOperation = 'lighter';
        for (let i = particles.length - 1; i >= 0; i--) { particles[i].update(); particles[i].draw(ctx); if (particles[i].alpha <= 0) particles.splice(i, 1); }
        requestAnimationFrame(animate);
    }
    function autoExplode() { if(!w) return; createExplosion(Math.random() * w, Math.random() * h * 0.8 + (h * 0.1)); setTimeout(autoExplode, Math.random() * 1200 + 300); }
    
    animate(); setTimeout(autoExplode, 500);
});
