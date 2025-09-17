let VERBS = [];
let filtered = [];
let page = 1;
let perPage = 50;

const $ = (q) => document.querySelector(q);

function normalize(s) {
  return (s || "").toString().toLowerCase().normalize("NFKD").replace(/\p{Diacritic}/gu, "");
}
function matchesQuery(v, q) {
  if (!q) return true;
  const n = normalize(q);
  return [v.base, v.past, v.part, v.id].some(field => normalize(field).includes(n));
}
function sanitizeVerb(v) {
  if (!v || !v.base || !v.past || !v.part) return null;
  const type = (v.type === "regular" || v.type === "irregular") ? v.type : "regular";
  return {
    base: String(v.base).trim(),
    past: String(v.past).trim(),
    part: String(v.part).trim(),
    id: (v.id ?? "").toString().trim(),
    type
  };
}

function applyFilters() {
  const q = $("#searchInput").value.trim();
  const typeSel = $("#typeFilter").value; 
  filtered = VERBS.filter(v => (typeSel === "all" ? true : v.type === typeSel) && matchesQuery(v, q));

  const sort = $("#sortSelect").value; 
  filtered.sort((a,b) => {

    const rk = (t) => (t === "regular" ? 0 : 1);
    const byType = rk(a.type) - rk(b.type);
    if (sort === "type" && byType !== 0) return byType;
    if (byType !== 0) return byType;
    return a.base.localeCompare(b.base);
  });

  page = 1;
  render();
}

function paginate(list, page, perPage) {
  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const start = (page - 1) * perPage;
  const end = start + perPage;
  return { slice: list.slice(start, end), total, pages };
}

function render() {
  const { slice, total, pages } = paginate(filtered, page, perPage);
  const tbody = $("#verbTbody");
  tbody.innerHTML = "";

  slice.forEach(v => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td data-copy="${v.base}">${v.base}</td>
      <td data-copy="${v.past}">${v.past}</td>
      <td data-copy="${v.part}">${v.part}</td>
      <td><span class="badge ${v.type}">${v.type.charAt(0).toUpperCase() + v.type.slice(1)}</span></td>
      <td>${(v.id || "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}</td>
    `;
    tr.addEventListener("click", (e) => {
      const cell = e.target.closest("[data-copy]");
      if (!cell) return;
      navigator.clipboard.writeText(cell.getAttribute("data-copy")).catch(()=>{});
      cell.classList.add("highlight");
      setTimeout(()=> cell.classList.remove("highlight"), 400);
    });
    tbody.appendChild(tr);
  });

  $("#statsText").textContent = `${total} hasil • menampilkan ${slice.length} item`;
  $("#pageInfo").textContent = `Hal ${page}/${pages}`;
  $("#prevPage").disabled = page <= 1;
  $("#nextPage").disabled = page >= pages;
}

document.addEventListener("DOMContentLoaded", () => {
  $("#searchInput").addEventListener("input", (() => { let t; return () => { clearTimeout(t); t=setTimeout(applyFilters, 100); }; })());
  $("#clearBtn").addEventListener("click", () => { $("#searchInput").value=""; applyFilters(); });
  $("#typeFilter").addEventListener("change", applyFilters);
  $("#sortSelect").addEventListener("change", applyFilters);
  $("#prevPage").addEventListener("click", () => { page=Math.max(1, page-1); render(); });
  $("#nextPage").addEventListener("click", () => { const pages=Math.max(1, Math.ceil(filtered.length/perPage)); page=Math.min(pages, page+1); render(); });
  $("#perPage").addEventListener("change", () => { perPage = parseInt($("#perPage").value,10)||50; page=1; render(); });
  fetch("data/verbs.json")
    .then(r => r.json())
    .then(arr => {
      VERBS = (arr || []).map(sanitizeVerb).filter(Boolean);
      VERBS.sort((a,b) => {
        const rk = (t) => (t === "regular" ? 0 : 1);
        const byType = rk(a.type) - rk(b.type);
        if (byType !== 0) return byType;
        return a.base.localeCompare(b.base);
      });
      applyFilters();
    })
    .catch(err => {
      console.error("Gagal load data/verbs.json:", err);
      VERBS = [];
      applyFilters();
    });
});

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.usage-card').forEach(el=>{
    const io = new IntersectionObserver(es=>{
      es.forEach(e=>{
        if(e.isIntersecting){ e.target.classList.add('reveal'); io.unobserve(e.target);}
      });
    },{threshold:.12});
    io.observe(el);
  });
});

document.addEventListener('DOMContentLoaded', ()=>{
  const track = document.querySelector('.carousel-track');
  const items = document.querySelectorAll('.carousel-item');
  const pagers = document.querySelectorAll('#videoPagers .pager');
  const bars = document.querySelectorAll('#videoPagers .bar');

  const TOTAL = items.length;
  const DURATION = 7000;
  let idx = 0;
  let timer = null;

  bars.forEach(b => b.style.setProperty('--dur', `${DURATION}ms`));

  function setActive(i){
    idx = (i + TOTAL) % TOTAL;
    track.style.transform = `translateX(-${idx * 100}%)`;

    bars.forEach(b=>{
      b.classList.remove('running');
      void b.offsetWidth;
    });
    bars[idx].classList.add('running');

    pagers.forEach((p,j)=> p.classList.toggle('active', j===idx));

    if (timer) clearTimeout(timer);
    timer = setTimeout(()=> setActive(idx+1), DURATION);
  }

  pagers.forEach(p=>{
    p.addEventListener('click', ()=>{
      const i = Number(p.dataset.index || 0);
      setActive(i);
    });
  });

  setActive(0);
});

