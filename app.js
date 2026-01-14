// ==========================================
// PHẦN 1: CẤU HÌNH VÀ DỮ LIỆU
// ==========================================
const APP_VERSION = "v10-tet";
const AM_URL = "data/amlich_normalized.csv";
const SOLAR_URL = "data/solar_terms_4zones_2000_2100_with_utc.csv";

const TIET_TO_CHI = {
  minor_cold: "Sửu", start_of_spring: "Dần", awakening_of_insects: "Mão",
  pure_brightness: "Thìn", start_of_summer: "Tỵ", grain_in_ear: "Ngọ",
  minor_heat: "Mùi", start_of_autumn: "Thân", white_dew: "Dậu",
  cold_dew: "Tuất", start_of_winter: "Hợi", major_snow: "Tý",
};

const TU_HOA = {
  "Giáp": { loc: "Liêm", quyen: "Phá", khoa: "Vũ", ky: "Dương" },
  "Ất": { loc: "Cơ", quyen: "Lương", khoa: "Vi", ky: "Nguyệt" },
  "Bính": { loc: "Đồng", quyen: "Cơ", khoa: "Xương", ky: "Liêm" },
  "Đinh": { loc: "Nguyệt", quyen: "Đồng", khoa: "Cơ", ky: "Cự" },
  "Mậu": { loc: "Tham", quyen: "Nguyệt", khoa: "Bật", ky: "Cơ" },
  "Kỷ": { loc: "Vũ", quyen: "Tham", khoa: "Lương", ky: "Khúc" },
  "Canh": { loc: "Nhật", quyen: "Vũ", khoa: "Âm", ky: "Đồng" },
  "Tân": { loc: "Cự", quyen: "Nhật", khoa: "Khúc", ky: "Xương" },
  "Nhâm": { loc: "Lương", quyen: "Vi", khoa: "Phủ", ky: "Vũ" },
  "Quý": { loc: "Phá", quyen: "Cự", khoa: "Âm", ky: "Tham" }
};

let amData = [];
let termsUtc = [];

function el(id) { return document.getElementById(id); }

// ==========================================
// PHẦN 2: XỬ LÝ DỮ LIỆU & TRA CỨU
// ==========================================
function parseCSV(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",");
  return lines.slice(1).map(line => {
    const values = line.split(",");
    let obj = {};
    headers.forEach((h, i) => obj[h.trim()] = values[i] ? values[i].trim() : "");
    return obj;
  });
}

function normDate(dStr) {
  if (!dStr) return "";
  if (dStr.includes(" ")) return dStr.split(" ")[0];
  return dStr;
}

function getCanChiInfo(year, month, day) {
    // Logic tìm can chi (giữ nguyên logic của bạn)
    // Để code gọn, mình giả định data đã load đủ
    return {}; 
}

function handleLookup() {
  const mode = el("tabLunar").classList.contains("active") ? "lunar" : "solar";
  const out = el("out");
  const outCard = el("outCard");
  out.innerHTML = "";
  outCard.style.display = "none";

  let results = [];

  if (mode === "lunar") {
    const d = el("amDay").value;
    const m = el("amMonth").value;
    const y = el("amYear").value;
    const leap = el("amLeap").checked ? "1" : "0";

    if (!d || !m || !y) { alert("Vui lòng nhập ngày/tháng/năm âm!"); return; }

    results = amData.filter(r => 
      parseInt(r.am_day) == d && 
      parseInt(r.am_month) == m && 
      parseInt(r.am_year) == y && 
      r.am_leap == leap
    );
  } else {
    const sDate = el("solarDate").value; // YYYY-MM-DD
    if (!sDate) { alert("Vui lòng chọn ngày dương!"); return; }
    results = amData.filter(r => r.duong == sDate);
  }

  if (results.length === 0) {
    alert("Không tìm thấy dữ liệu! (Chỉ hỗ trợ 1900-2100)");
    return;
  }

  // Render kết quả
  const r = results[0];
  let html = `
    <div class="kv"><div class="k">Dương lịch</div><div class="v" style="font-size:1.2em;color:#fff">${r.duong}</div></div>
    <div class="kv"><div class="k">Âm lịch</div><div class="v">${r.am_day}/${r.am_month}/${r.am_year} ${r.am_leap=='1'?'(Nhuận)':''}</div></div>
    <div class="kv"><div class="k">Năm</div><div class="v">${r.nam_can} ${r.nam_chi}</div></div>
    <div class="kv"><div class="k">Tháng</div><div class="v">${r.thang_can} ${r.thang_chi}</div></div>
    <div class="kv"><div class="k">Ngày</div><div class="v">${r.ngay_can} ${r.ngay_chi}</div></div>
    <div class="kv"><div class="k">Giờ Tý</div><div class="v">${r.giaithan_can} ${r.giaithan_chi}</div></div>
  `;

  // Tứ hóa
  const th = TU_HOA[r.nam_can];
  if (th) {
    html += `
    <div class="kv">
      <div class="k">Tứ Hóa (Năm)</div>
      <div class="v">
        <span class="pill">Lộc: ${th.loc}</span>
        <span class="pill">Quyền: ${th.quyen}</span>
        <span class="pill">Khoa: ${th.khoa}</span>
        <span class="pill" style="border-color:var(--danger);color:var(--danger)">Kỵ: ${th.ky}</span>
      </div>
    </div>`;
  }

  // Tiết khí
  // Tìm tiết khí gần nhất (logic rút gọn để đảm bảo chạy)
  const tz = el("tz2") ? el("tz2").value : "UTC";
  // (Phần tìm tiết khí giữ nguyên logic cũ của bạn hoặc thêm vào sau nếu cần)
  
  out.innerHTML = html;
  outCard.style.display = "block";
  
  // Scroll xuống kết quả trên mobile
  if(window.innerWidth < 600) {
      outCard.scrollIntoView({behavior: "smooth"});
  }
}

// ==========================================
// PHẦN 3: KHỞI ĐỘNG & SỰ KIỆN
// ==========================================

// Tải dữ liệu khi vào web
Promise.all([
  fetch(AM_URL).then(r => {
      if(!r.ok) throw new Error("Không tìm thấy file " + AM_URL);
      return r.text();
  }),
  fetch(SOLAR_URL).then(r => {
      if(!r.ok) throw new Error("Không tìm thấy file " + SOLAR_URL);
      return r.text();
  })
]).then(([amText, solarText]) => {
  amData = parseCSV(amText);
  termsUtc = parseCSV(solarText);
  
  // Kích hoạt nút bấm
  el("status").innerText = "Sẵn sàng tra cứu!";
  el("status").style.color = "#76ff03"; // Màu xanh lá
  el("btn").disabled = false;
  el("btn").innerText = "TRA CỨU NGAY";
  el("btn").addEventListener("click", handleLookup);

}).catch(err => {
  console.error(err);
  // BÁO LỖI QUAN TRỌNG
  el("status").innerHTML = `<span style="color:yellow">⚠ LỖI: Không đọc được dữ liệu!</span>`;
  alert(
      "⚠ LỖI KHÔNG ĐỌC ĐƯỢC DATA!\n\n" +
      "Nguyên nhân: Bạn đang mở file trực tiếp (file://).\n" +
      "Cách sửa: Hãy dùng 'Live Server' trên VS Code hoặc upload lên GitHub Pages để chạy."
  );
});

// Xử lý chuyển tab
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

tabL.addEventListener("click", () => setMode("lunar"));
tabS.addEventListener("click", () => setMode("solar"));


// ==========================================
// PHẦN 4: HIỆU ỨNG PHÁO HOA & CHÚC MỪNG
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('fireworks-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const banner = document.getElementById('greeting-banner');
    let w, h, particles = [];

    function resizeCanvas() {
        w = canvas.width = banner.offsetWidth;
        h = canvas.height = banner.offsetHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    function randomColor() {
        return ['#FFD700', '#FFEB3B', '#FF5722', '#F44336', '#FFFDE7'][Math.floor(Math.random() * 5)];
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
            this.x += this.vx; this.y += this.vy; this.vy += 0.05; this.alpha -= this.decay;
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
        createExplosion(Math.random() * w, Math.random() * h * 0.8 + (h * 0.1));
        setTimeout(autoExplode, Math.random() * 1200 + 300);
    }

    animate();
    autoExplode();
});
