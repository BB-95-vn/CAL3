// ============================================================
// PHẦN 1: CẤU HÌNH & DỮ LIỆU GỐC (GIỮ NGUYÊN LOGIC CỦA BẠN)
// ============================================================
// Tra Âm -> Dương + Can Chi + Tứ Hóa + Tiết khí gần nhất (bỏ trung khí) + Zodiac
const APP_VERSION = "v10-tet-final";

const AM_URL = "data/amlich_normalized.csv";
const SOLAR_URL = "data/solar_terms_4zones_2000_2100_with_utc.csv";

// 12 TIẾT (bỏ trung khí) -> Chi mapping (THEO DANH SÁCH CHUẨN)
const TIET_TO_CHI = {
  minor_cold: "Sửu",
  start_of_spring: "Dần",
  awakening_of_insects: "Mão",
  pure_brightness: "Thìn",
  start_of_summer: "Tỵ",
  grain_in_ear: "Ngọ",
  minor_heat: "Mùi",
  start_of_autumn: "Thân",
  white_dew: "Dậu",
  cold_dew: "Tuất",
  start_of_winter: "Hợi",
  major_snow: "Tý",
};
const TIET_KEYS = new Set(Object.keys(TIET_TO_CHI));

// Tứ hóa theo Can (ảnh bạn gửi)
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

// ---------- Month Can from Year Can + Month Chi (Tiết) ----------
function yearCanFromYearNumber(y){
  const yy = parseInt(y,10);
  if (!yy) return "";
  // 1984 = Giáp (index 0). => index = (year + 6) % 10
  return CAN_10[(yy + 6) % 10];
}

const CAN_10 = ["Giáp","Ất","Bính","Đinh","Mậu","Kỷ","Canh","Tân","Nhâm","Quý"];
const CHI_12_MONTH_ORDER = ["Dần","Mão","Thìn","Tỵ","Ngọ","Mùi","Thân","Dậu","Tuất","Hợi","Tý","Sửu"];

const YEARCAN_TO_DAN_CAN = {
  "Giáp":"Bính", "Kỷ":"Bính",
  "Ất":"Mậu",    "Canh":"Mậu",
  "Bính":"Canh","Tân":"Canh",
  "Đinh":"Nhâm","Nhâm":"Nhâm",
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

// ---------- DOM helpers ----------
const el = (id) => document.getElementById(id);
function pad2(n){ return String(n).padStart(2,"0"); }
function normDate(s){ return (s || "").slice(0,10); }

function setStatus(ready, msg){
  const s = el("status");
  if (!s) return;
  // Giữ nguyên logic hiển thị nhưng chỉnh màu chút cho hợp nền đỏ
  s.style.color = ready ? "#76ff03" : "#ffeb3b";
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

// ---------- data stores ----------
let solarMap = new Map();      // duong YYYY-MM-DD -> row
let lunarMap = new Map();      // am_key (d-m-y-leap) -> [rows]
let termsByTz = new Map();     // tz -> [terms rows]
let termsUtc = [];             // derived from datetime_utc

function lunarKey(d,m,y,leap){
  return `${d}-${m}-${y}-${leap ? 1 : 0}`;
}

// ---------- CSV load (ĐÃ SỬA: Dùng code thuần thay vì PapaParse để tránh lỗi) ----------
function parseCSV(url){
  return fetch(url).then(res => {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.text();
  }).then(text => {
      const lines = text.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      
      const result = [];
      for(let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if(!line) continue;
          
          // Xử lý CSV đơn giản (split bằng dấu phẩy)
          // Lưu ý: Nếu dữ liệu có dấu phẩy trong nội dung thì cách này sẽ sai, 
          // nhưng data của bạn có vẻ sạch nên OK.
          const values = line.split(',');
          const obj = {};
          headers.forEach((h, index) => {
              obj[h] = values[index] ? values[index].trim() : "";
          });
          result.push(obj);
      }
      return result;
  });
}

// ---------- solar term logic (GIỮ NGUYÊN) ----------
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

// ---------- render (GIỮ NGUYÊN output) ----------
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

  // Giữ nguyên HTML output như cũ
  return [
    `<div class="sectionTitle" style="color:var(--accent); font-weight:bold; margin-bottom:5px;">Kết quả</div>`,
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
    kv("Tiết khí gần nhất đã qua", tietText),
    kv("Zodiac (tháng tiết)", zodiacCanChi),
    kv("Can Chi tháng tiết", canTiet ? (`${canTiet} ${chiTiet}`) : "N/A"), 
    kv("Tứ hóa (Can tiết)", canTiet ? tuHoaInline(canTiet) : "N/A"),
  ].join("");
}

function showOutput(html){
  el("out").innerHTML = html;
  el("outCard").style.display = "block";
  if(window.innerWidth < 600) {
      el("outCard").scrollIntoView({behavior:"smooth", block:"start"});
  }
}

// ---------- Logic xử lý sự kiện (ĐÃ SỬA ID tz -> tz2) ----------

function handleLunarLookup(){
  const d = parseInt(el("amDay").value, 10);
  const m = parseInt(el("amMonth").value, 10);
  const y = parseInt(el("amYear").value, 10);
  const leap = el("amLeap").checked;
  
  // SỬA: ID trong HTML mới là tz2, không phải tz
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
  const d = el("solarDate").value; // YYYY-MM-DD
  const tz = el("tz2").value; // HTML mới dùng tz2
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

// ---------- init ----------
async function init(){
  setStatus(false, "Đang tải dữ liệu…");

  try {
      // Load lunar database
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

      // Load solar terms database
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

      // sort terms
      for (const [tz, arr] of termsByTz.entries()){
        arr.sort((a,b)=> normDate(a.date_local).localeCompare(normDate(b.date_local)));
      }
      termsUtc = termsUtc
        .filter(t => normDate(t.date_local))
        .sort((a,b)=> normDate(a.date_local).localeCompare(normDate(b.date_local)) || (a.term_key||"").localeCompare(b.term_key||""));

      // de-dupe UTC
      const seen = new Set();
      termsUtc = termsUtc.filter(t=>{
        const k = `${normDate(t.date_local)}|${t.term_key||""}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });

      const btn = el("btn");
      if(btn) {
          btn.disabled = false;
          btn.innerText = "TRA CỨU NGAY"; // Đổi text cho hợp không khí
          btn.addEventListener("click", handleLookup);
      }

      // Tabs
      const tabL = el("tabLunar");
      const tabS = el("tabSolar");
      const pL = el("panelLunar");
      const pS = el("panelSolar");
      
      function setMode(mode){
        if (mode === "lunar"){
          tabL.classList.add("active");
          tabS.classList.remove("active");
          pL.style.display = "";
          pS.style.display = "none";
        } else {
          tabS.classList.add("active");
          tabL.classList.remove("active");
          pS.style.display = "";
          pL.style.display = "none";
        }
        el("outCard").style.display = "none";
      }
      
      if(tabL && tabS) {
          tabL.addEventListener("click", ()=> setMode("lunar"));
          tabS.addEventListener("click", ()=> setMode("solar"));
      }

      setStatus(true, `Sẵn sàng tra cứu`);
  } catch (err) {
      console.error(err);
      setStatus(false, "Lỗi tải data! Hãy mở bằng GitHub Pages hoặc Live Server.");
      alert("Không đọc được file data/csv. Bạn vui lòng chạy trên GitHub Pages hoặc dùng Live Server nhé.");
  }
}

init();

// ============================================================
// PHẦN 2: HIỆU ỨNG PHÁO HOA (MỚI THÊM VÀO)
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('fireworks-canvas');
    if (!canvas) return; // Nếu không có banner thì thôi

    const ctx = canvas.getContext('2d');
    const banner = document.getElementById('greeting-banner');
    let w, h, particles = [];

    function resizeCanvas() {
        if(banner) {
            w = canvas.width = banner.offsetWidth;
            h = canvas.height = banner.offsetHeight;
        }
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    function randomColor() {
        // Màu Tết rực rỡ
        return ['#FFD700', '#FFEB3B', '#FF5722', '#F44336', '#FFFDE7', '#00ff00', '#00ffff'][Math.floor(Math.random() * 7)];
    }

    class Particle {
        constructor(x, y) {
            this.x = x; this.y = y;
            this.vx = (Math.random() - 0.5) * 4;
            this.vy = (Math.random() - 0.5) * 4;
            this.alpha = 1; this.color = randomColor();
            this.radius = Math.random() * 2 + 1;
            this.decay = Math.random() * 0.02 + 0.015;
        }
        update() {
            this.x += this.vx; this.y += this.vy; 
            this.vy += 0.05; // Trọng lực
            this.alpha -= this.decay;
        }
        draw(ctx) {
            ctx.save(); ctx.globalAlpha = this.alpha; ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = this.color; ctx.fill(); ctx.restore();
        }
    }

    function createExplosion(x, y) {
        for (let i = 0; i < 20; i++) particles.push(new Particle(x, y));
    }

    function animate() {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].update(); particles[i].draw(ctx);
            if (particles[i].alpha <= 0) particles.splice(i, 1);
        }
        requestAnimationFrame(animate);
    }

    function autoExplode() {
        if(!w || !h) return;
        createExplosion(Math.random() * w, Math.random() * h * 0.8 + (h * 0.1));
        setTimeout(autoExplode, Math.random() * 1200 + 300);
    }

    animate();
    setTimeout(autoExplode, 500);
});
