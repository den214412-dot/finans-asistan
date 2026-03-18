import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from "recharts";

// ─────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────
const MONTHS_TR = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
const DAYS_TR = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];
const now = new Date();
const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
const remainingDays = daysInMonth - now.getDate();
const SK = "finans-v3";

const DEFAULT_CATS = [
  { id: "market", label: "Market / Yemek", icon: "🛒", color: "#10B981", keywords: ["market","migros","bim","a101","şok","carrefour","yemek","yiyecek","manav","kasap","fırın","ekmek","süt","meyve","sebze","restoran","lokanta","pizza","burger","döner","kebap","lahmacun","pide","simit","tost","sandwich","mcdonalds","kfc","popeyes"] },
  { id: "ulasim", label: "Ulaşım", icon: "🚌", color: "#3B82F6", keywords: ["uber","taksi","taxi","bolt","bitaksi","metrobüs","metro","otobüs","vapur","marmaray","istanbulkart","benzin","akaryakıt","otopark","köprü","geçiş","hgs","ogs","uçak","bilet","tren"] },
  { id: "eglence", label: "Eğlence", icon: "🎮", color: "#8B5CF6", keywords: ["netflix","spotify","youtube","disney","amazon prime","oyun","steam","playstation","xbox","sinema","tiyatro","konser","film","dizi","cafe","bar","pub","eğlence","parti","müzik","kitap","dergi"] },
  { id: "saglik", label: "Sağlık", icon: "🏥", color: "#F59E0B", keywords: ["eczane","ilaç","doktor","hastane","muayene","diş","göz","sağlık","vitamin","takviye","poliklinik","laboratuvar","kan","test","reçete"] },
  { id: "spor", label: "Spor", icon: "💪", color: "#EC4899", keywords: ["macfit","gym","spor","fitness","pilates","yoga","yüzme","koşu","protein","supplement","spor salonu"] },
  { id: "kredi", label: "Kredi / Taksit", icon: "🏦", color: "#EF4444", keywords: ["kredi","taksit","borç","banka","faiz","ödeme","fatura"] },
  { id: "giyim", label: "Giyim", icon: "👕", color: "#06B6D4", keywords: ["giyim","kıyafet","ayakkabı","çanta","gözlük","aksesuar","trendyol","hepsiburada","zara","h&m","lcw","defacto","koton"] },
  { id: "ev", label: "Ev / Fatura", icon: "🏠", color: "#84CC16", keywords: ["kira","elektrik","su","doğalgaz","internet","telefon","aidat","fatura","ev","temizlik","deterjan"] },
  { id: "kisisel", label: "Kişisel Bakım", icon: "✨", color: "#F472B6", keywords: ["kuaför","berber","cilt","bakım","parfüm","kozmetik","makyaj","krem","şampuan"] },
  { id: "diger", label: "Diğer", icon: "📦", color: "#94A3B8", keywords: [] },
];

const ZIRAAT_RATES = [
  { max: 30000, label: "< 30K₺", akdi: 3.25, gecikme: 3.55 },
  { max: 180000, label: "30-180K₺", akdi: 3.75, gecikme: 4.05 },
  { max: Infinity, label: "> 180K₺", akdi: 4.25, gecikme: 4.55 },
];

const TIPS = [
  "💡 Asgari ödeme yapmak borcu büyütür, mümkünse tam öde!",
  "💡 50/30/20 kuralı: Gelirin %50 ihtiyaç, %30 istek, %20 birikim",
  "💡 Harcama öncesi 24 saat bekle kuralını dene",
  "💡 Küçük harcamalar büyük etki yapar, kahve parasını takip et!",
  "💡 Borç varken birikim yapmak yerine önce borcu kapat",
  "💡 Her maaş gününde biriktireceğin tutarı ayır",
  "💡 Taksitli alışverişten kaçın, peşin al ya da biriktirip al",
  "💡 Market listesi yap, listeye sadık kal",
];

const EXTRA_COLORS = ["#14B8A6","#A855F7","#F97316","#06B6D4","#E11D48","#84CC16","#6366F1"];

// ─────────────────────────────────────────────────────────────────────
// SMART TURKISH PARSER (No AI needed!)
// ─────────────────────────────────────────────────────────────────────
function parseMessage(text, categories, data) {
  const t = text.toLowerCase().trim();

  // ── Query patterns ──
  if (/ne kadar kald[ıi]|kalan (bütçe|para|limit)|bütçe durumu|özet|nasıl gidiy/.test(t)) {
    return { type: "query_remaining" };
  }
  if (/ne kadar harcad[ıi]m|toplam harcama|bu ay(ki)? harcama/.test(t)) {
    return { type: "query_spent" };
  }
  if (/günlük|günde ne kadar/.test(t)) {
    return { type: "query_daily" };
  }
  if (/borç|borç durumu/.test(t) && !/ekle|gir/.test(t)) {
    return { type: "query_debt" };
  }

  // ── Settings patterns ──
  const incomeMatch = t.match(/gelir[im]*\s*[:=]?\s*(\d[\d.,]*)/);
  if (incomeMatch || /gelir.*?(\d[\d.,]*)/.test(t) && /ayarla|güncelle|değiştir/.test(t)) {
    const m = t.match(/(\d[\d.,]*)/);
    if (m) return { type: "set_income", amount: parseNum(m[1]) };
  }

  const savingsMatch = t.match(/birikim.*?(\d[\d.,]*)|(\d[\d.,]*).*?birik/);
  if (savingsMatch && /hedef|ayarla|belirle/.test(t)) {
    const m = t.match(/(\d[\d.,]*)/);
    if (m) return { type: "set_savings", amount: parseNum(m[1]) };
  }

  // ── Expense patterns ──
  const amountPatterns = [
    /(\d[\d.,]*)\s*(?:tl|lira|₺)/i,
    /(?:tl|lira|₺)\s*(\d[\d.,]*)/i,
    /(\d[\d.,]*)\s*(?:verdim|ödedim|harcadım|tuttu|yaptım|aldım)/i,
    /(?:aldım|verdim|ödedim|harcadım).*?(\d[\d.,]*)/i,
  ];

  let amount = null;
  for (const pat of amountPatterns) {
    const m = t.match(pat);
    if (m) { amount = parseNum(m[1]); break; }
  }

  // fallback: any number in text
  if (!amount) {
    const nums = t.match(/\d[\d.,]*/g);
    if (nums) {
      const candidates = nums.map(parseNum).filter(n => n >= 1 && n < 1000000);
      if (candidates.length === 1) amount = candidates[0];
    }
  }

  if (amount && amount > 0) {
    // Detect category
    let catId = "diger";
    let maxScore = 0;
    for (const cat of categories) {
      let score = 0;
      for (const kw of (cat.keywords || [])) {
        if (t.includes(kw)) score += kw.length;
      }
      if (score > maxScore) { maxScore = score; catId = cat.id; }
    }

    // Detect person
    let person = data.people?.[0] || "Ben";
    if (data.people?.length > 1) {
      const p2 = (data.people[1] || "").toLowerCase();
      if (p2 && t.includes(p2)) person = data.people[1];
    }

    // Extract description
    let desc = text.trim();
    desc = desc.replace(/\d[\d.,]*\s*(?:tl|lira|₺)/gi, "").replace(/(?:tl|lira|₺)\s*\d[\d.,]*/gi, "").trim();
    desc = desc.replace(/verdim|ödedim|harcadım|tuttu|aldım|yaptım/gi, "").trim();
    if (desc.length < 2) desc = text.trim();

    return { type: "expense", amount, category: catId, description: desc, person };
  }

  return { type: "unknown" };
}

function parseNum(s) {
  return Number(s.replace(/\./g, "").replace(",", ".")) || 0;
}

// ─────────────────────────────────────────────────────────────────────
// STORAGE
// ─────────────────────────────────────────────────────────────────────
function load() { try { const r = localStorage.getItem(SK); if (r) return JSON.parse(r); } catch {} return null; }

const INIT = {
  income: 0, savingsGoal: 0, people: ["Deniz", ""],
  budgets: {}, expenses: [], categories: DEFAULT_CATS,
  installments: [], debts: [],
  travelGoal: { target: 0, saved: 0, destination: "", targetDate: "" },
  recurring: [], // {id, name, amount, category, day, person}
};

// ─────────────────────────────────────────────────────────────────────
// COMPONENTS
// ─────────────────────────────────────────────────────────────────────
const C = {
  bg: "#F7F8FC", card: "#FFFFFF", cardBorder: "#EEF0F6",
  text: "#1E293B", textSec: "#64748B", textMuted: "#94A3B8",
  primary: "#059669", primaryLight: "#D1FAE5", primaryBg: "#ECFDF5",
  danger: "#EF4444", dangerLight: "#FEE2E2",
  blue: "#3B82F6", blueLight: "#DBEAFE",
  amber: "#F59E0B", amberLight: "#FEF3C7",
  purple: "#8B5CF6",
  shadow: "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)",
  shadowMd: "0 4px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
};

const Card = ({ children, style, onClick }) => (
  <div onClick={onClick} style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 16, padding: 18, boxShadow: C.shadow, ...style }}>{children}</div>
);

const Ring = ({ pct, color, size = 56, stroke = 5 }) => {
  const r = (size - stroke) / 2, circ = 2 * Math.PI * r, p = Math.min(Math.max(pct, 0), 100);
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#F1F5F9" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={p > 90 ? C.danger : color}
        strokeWidth={stroke} strokeDasharray={circ} strokeDashoffset={circ - (p/100)*circ}
        strokeLinecap="round" style={{ transition: "all 0.8s cubic-bezier(.4,0,.2,1)" }} />
    </svg>
  );
};

const Badge = ({ children, color, bg }) => (
  <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 20, background: bg, color, fontSize: 11.5, fontWeight: 600, gap: 4 }}>{children}</span>
);

const Inp = ({ prefix, style: s, ...rest }) => (
  <div style={{ position: "relative" }}>
    {prefix && <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: C.textMuted, fontSize: 14, fontWeight: 600 }}>{prefix}</span>}
    <input {...rest} style={{ width: "100%", padding: prefix ? "12px 14px 12px 30px" : "12px 14px", background: "#F8FAFC", border: `1.5px solid ${C.cardBorder}`, borderRadius: 12, color: C.text, fontSize: 14, fontFamily: "inherit", outline: "none", transition: "border 0.2s", ...s }} />
  </div>
);

const Btn = ({ children, variant = "primary", style: s, ...rest }) => {
  const styles = {
    primary: { background: `linear-gradient(135deg, ${C.primary}, #047857)`, color: "#fff", border: "none" },
    danger: { background: C.dangerLight, color: C.danger, border: `1px solid #FECACA` },
    ghost: { background: "transparent", color: C.textSec, border: `1.5px solid ${C.cardBorder}` },
    blue: { background: C.blueLight, color: C.blue, border: `1px solid #BFDBFE` },
  };
  return <button {...rest} style={{ padding: "11px 20px", borderRadius: 12, fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s", ...styles[variant], ...s }}>{children}</button>;
};

const Bubble = ({ msg }) => {
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 10, animation: "fadeUp 0.25s ease" }}>
      {!isUser && <div style={{ width: 32, height: 32, borderRadius: 12, background: `linear-gradient(135deg, ${C.primary}, #047857)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, marginRight: 8, flexShrink: 0, marginTop: 2, color: "#fff", fontWeight: 700 }}>₺</div>}
      <div style={{
        maxWidth: "82%", padding: "12px 16px",
        borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
        background: isUser ? `linear-gradient(135deg, ${C.primary}, #047857)` : C.card,
        color: isUser ? "#fff" : C.text, fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap",
        border: isUser ? "none" : `1px solid ${C.cardBorder}`,
        boxShadow: isUser ? "0 2px 8px rgba(5,150,105,0.25)" : C.shadow,
      }}>
        {msg.text}
        {msg.meta && <div style={{ marginTop: 8, padding: "8px 12px", background: isUser ? "rgba(255,255,255,0.15)" : "#F8FAFC", borderRadius: 10, fontSize: 12, color: isUser ? "rgba(255,255,255,0.9)" : C.textSec, lineHeight: 1.5 }}>{msg.meta}</div>}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [data, setData] = useState(() => load() || INIT);
  const [tab, setTab] = useState("chat");
  const [chat, setChat] = useState([
    { role: "bot", text: `Merhaba! 👋 Ben akıllı finans asistanınım.\n\nBana doğal Türkçe yaz, her şeyi anlarım:\n\n💸 "Markete 450 lira verdim"\n☕ "Kahve aldım 45 TL"\n🚕 "Uber 85 lira"\n❓ "Ne kadar kaldı?"\n📊 "Bu ay ne kadar harcadım?"\n\n✨ Kategoriyi otomatik algılarım, sana kalan bütçeni söylerim!` }
  ]);
  const [msg, setMsg] = useState("");
  const [setup, setSetup] = useState(() => { const s = load(); return !s || !s.income; });
  const [sForm, setSForm] = useState({ income: "", savings: "", p1: "Deniz", p2: "" });
  const [debtForm, setDebtForm] = useState({ name: "", balance: "", rate: "3.25", bank: "Ziraat" });
  const [instForm, setInstForm] = useState({ name: "", total: "", count: "", cat: "kredi" });
  const [catForm, setCatForm] = useState({ label: "", icon: "📌" });
  const [travelForm, setTravelForm] = useState({ dest: "", target: "", date: "", addAmt: "" });
  const [recurForm, setRecurForm] = useState({ name: "", amount: "", cat: "ev", day: "1" });
  const [showExport, setShowExport] = useState(false);
  const chatEnd = useRef(null);
  const inpRef = useRef(null);

  useEffect(() => { try { localStorage.setItem(SK, JSON.stringify(data)); } catch {} }, [data]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [chat]);

  const cats = data.categories || DEFAULT_CATS;

  // ── Computations ──
  const mExp = useMemo(() => data.expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }), [data.expenses]);

  const totalSpent = mExp.reduce((s, e) => s + e.amount, 0);
  const instMonthly = (data.installments || []).filter(i => i.paid < i.count).reduce((s, i) => s + i.monthly, 0);
  const recurMonthly = (data.recurring || []).reduce((s, r) => s + r.amount, 0);
  const fixedCosts = instMonthly + recurMonthly;
  const spendableIncome = data.income - data.savingsGoal - fixedCosts;
  const remaining = spendableIncome - totalSpent;
  const dailyBudget = remainingDays > 0 ? Math.floor(Math.max(remaining, 0) / remainingDays) : 0;
  const totalDebt = (data.debts || []).reduce((s, d) => s + d.balance, 0);
  const usagePct = spendableIncome > 0 ? Math.round((totalSpent / spendableIncome) * 100) : 0;

  const catSpend = useMemo(() => {
    const cs = {}; cats.forEach(c => { cs[c.id] = 0; });
    mExp.forEach(e => { cs[e.category] = (cs[e.category] || 0) + e.amount; });
    return cs;
  }, [mExp, cats]);

  const tip = useMemo(() => TIPS[Math.floor(Math.random() * TIPS.length)], [tab]);

  // ── Person-based spending ──
  const personSpend = useMemo(() => {
    const ps = {};
    data.people.filter(Boolean).forEach(p => { ps[p] = 0; });
    mExp.forEach(e => { ps[e.person] = (ps[e.person] || 0) + e.amount; });
    return ps;
  }, [mExp, data.people]);

  // ── Streak: days under daily avg ──
  const streak = useMemo(() => {
    let s = 0;
    const today = now.getDate();
    for (let d = today; d >= 1; d--) {
      const dayExp = mExp.filter(e => new Date(e.date).getDate() === d).reduce((s, e) => s + e.amount, 0);
      if (dayExp <= (spendableIncome / daysInMonth) * 1.2 && dayExp >= 0) s++;
      else break;
    }
    return s;
  }, [mExp, spendableIncome]);

  // ── Chat handler ──
  const send = useCallback(() => {
    if (!msg.trim()) return;
    const txt = msg.trim();
    setMsg("");
    setChat(p => [...p, { role: "user", text: txt }]);

    const result = parseMessage(txt, cats, data);

    switch (result.type) {
      case "query_remaining": {
        const emoji = remaining < 0 ? "🔴" : remaining < dailyBudget * 5 ? "🟡" : "🟢";
        setChat(p => [...p, { role: "bot", text: `${emoji} Bu ay kalan bütçen: ${remaining.toLocaleString("tr-TR")}₺\n\n📅 Ayın sonuna ${remainingDays} gün var\n💰 Günlük harcama limitin: ~${dailyBudget.toLocaleString("tr-TR")}₺\n📊 Toplam harcaman: ${totalSpent.toLocaleString("tr-TR")}₺`,
          meta: remaining < 0 ? "⚠️ Bütçeni aştın! Gereksiz harcamalardan kaçın." : remaining < dailyBudget * 3 ? "⚡ Dikkatli harcamalısın, bütçe azalıyor." : "✨ Bütçen iyi durumda, böyle devam!" }]);
        break;
      }
      case "query_spent": {
        const top3 = Object.entries(catSpend).sort((a,b) => b[1] - a[1]).slice(0, 3);
        const topStr = top3.map(([id, v]) => { const c = cats.find(x => x.id === id); return `${c?.icon} ${c?.label}: ${v.toLocaleString("tr-TR")}₺`; }).join("\n");
        setChat(p => [...p, { role: "bot", text: `📊 Bu ay toplam: ${totalSpent.toLocaleString("tr-TR")}₺\n\nEn çok harcadığın kategoriler:\n${topStr}\n\n${mExp.length} işlem yapıldı.` }]);
        break;
      }
      case "query_daily": {
        setChat(p => [...p, { role: "bot", text: `📅 Günlük harcama limitin: ~${dailyBudget.toLocaleString("tr-TR")}₺\n\nBu ${remainingDays} gün boyunca günde bu kadar harcayabilirsin.\n${streak > 2 ? `🔥 ${streak} gündür bütçe dahilinde harcıyorsun, harika!` : ""}` }]);
        break;
      }
      case "query_debt": {
        if (totalDebt <= 0) {
          setChat(p => [...p, { role: "bot", text: "🎉 Harika! Hiç borcun yok!" }]);
        } else {
          const lines = (data.debts || []).map(d => `🔴 ${d.name}: ${d.balance.toLocaleString("tr-TR")}₺ (%${d.interestRate}/ay)`);
          setChat(p => [...p, { role: "bot", text: `💳 Toplam borç: ${totalDebt.toLocaleString("tr-TR")}₺\n\n${lines.join("\n")}\n\n${tip}` }]);
        }
        break;
      }
      case "set_income": {
        setData(p => ({ ...p, income: result.amount }));
        setChat(p => [...p, { role: "bot", text: `✅ Aylık gelir ${result.amount.toLocaleString("tr-TR")}₺ olarak ayarlandı!` }]);
        break;
      }
      case "set_savings": {
        setData(p => ({ ...p, savingsGoal: result.amount }));
        setChat(p => [...p, { role: "bot", text: `✅ Birikim hedefi ${result.amount.toLocaleString("tr-TR")}₺ olarak ayarlandı!` }]);
        break;
      }
      case "expense": {
        const cat = cats.find(c => c.id === result.category) || cats[cats.length - 1];
        const ne = { id: Date.now(), amount: result.amount, category: result.category, description: result.description, person: result.person, date: new Date().toISOString() };
        setData(p => ({ ...p, expenses: [...p.expenses, ne] }));

        const newCatSpend = (catSpend[result.category] || 0) + result.amount;
        const newRemaining = remaining - result.amount;
        const catBudget = data.budgets[result.category];
        const newDaily = remainingDays > 0 ? Math.floor(Math.max(newRemaining, 0) / remainingDays) : 0;

        let meta = `✅ ${result.amount.toLocaleString("tr-TR")}₺ → ${cat.icon} ${cat.label}`;
        if (result.person !== data.people[0]) meta += ` (${result.person})`;
        if (catBudget) meta += `\n📊 ${cat.label}: ${newCatSpend.toLocaleString("tr-TR")} / ${catBudget.toLocaleString("tr-TR")}₺`;
        meta += `\n💰 Kalan: ${newRemaining.toLocaleString("tr-TR")}₺ | Günlük: ~${newDaily.toLocaleString("tr-TR")}₺`;

        let warning = "";
        if (newRemaining < 0) warning = "🚨 Bütçeni aştın! Geri kalan günlerde çok dikkatli ol.";
        else if (catBudget && newCatSpend > catBudget * 0.9) warning = `⚠️ ${cat.label} bütçesinin %${Math.round((newCatSpend/catBudget)*100)}'ine ulaştın!`;
        else if (newRemaining < dailyBudget * 3) warning = "⚡ Bütçe azalıyor, dikkat!";

        setChat(p => [...p, { role: "bot", text: warning || "👍 Kaydedildi!", meta }]);
        break;
      }
      default: {
        setChat(p => [...p, { role: "bot", text: `🤔 Tam anlayamadım. Şu şekilde deneyin:\n\n• "Markete 450 lira verdim"\n• "Kahve 45 TL"\n• "Ne kadar kaldı?"\n• "Bu ay ne kadar harcadım?"\n\nYa da hızlı butonları kullanabilirsin 👇` }]);
      }
    }
  }, [msg, cats, data, remaining, dailyBudget, totalSpent, catSpend, mExp, streak, totalDebt, tip, spendableIncome]);

  // ── Export/Import ──
  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `finans-yedek-${now.toISOString().slice(0,10)}.json`; a.click();
  };
  const importData = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { try { setData(JSON.parse(ev.target.result)); } catch { alert("Geçersiz dosya!"); } };
    reader.readAsText(file);
  };

  // ── Pie data ──
  const pieData = cats.map(c => ({ name: c.label, value: catSpend[c.id] || 0, color: c.color, icon: c.icon })).filter(d => d.value > 0);

  // ─── Setup ──────────────────────────────────────────────────
  if (setup) {
    return (
      <div style={{ minHeight: "100vh", background: `linear-gradient(135deg, ${C.primaryBg}, #F0F9FF)`, fontFamily: "'Nunito', sans-serif", color: C.text, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
        <Card style={{ maxWidth: 420, width: "100%", margin: 16, padding: 28, boxShadow: C.shadowMd }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ fontSize: 56, marginBottom: 4 }}>🌟</div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, background: `linear-gradient(135deg, ${C.primary}, ${C.blue})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Finans Asistanı</h1>
            <p style={{ color: C.textSec, fontSize: 14, margin: "6px 0 0" }}>Ortak bütçenizi 2 dakikada kurun</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Inp value={sForm.p1} onChange={e => setSForm(p=>({...p,p1:e.target.value}))} placeholder="Senin adın" />
            <Inp value={sForm.p2} onChange={e => setSForm(p=>({...p,p2:e.target.value}))} placeholder="Partnerinin adı (opsiyonel)" />
            <Inp value={sForm.income} onChange={e => setSForm(p=>({...p,income:e.target.value}))} placeholder="Aylık toplam gelir" prefix="₺" type="number" />
            <Inp value={sForm.savings} onChange={e => setSForm(p=>({...p,savings:e.target.value}))} placeholder="Aylık birikim hedefi" prefix="₺" type="number" />
            <Btn onClick={() => {
              setData(p => ({ ...p, income: Number(sForm.income)||0, savingsGoal: Number(sForm.savings)||0, people: [sForm.p1||"Ben", sForm.p2].filter(Boolean) }));
              setSetup(false);
            }} style={{ width: "100%", padding: 14, fontSize: 15, marginTop: 4 }}>Başlayalım! 🚀</Btn>
          </div>
        </Card>
      </div>
    );
  }

  // ─── MAIN ───────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Nunito', sans-serif", color: C.text }}>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}
        @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-3px)}75%{transform:translateX(3px)}}
        input:focus{outline:none;border-color:${C.primary}!important;box-shadow:0 0 0 3px ${C.primaryLight}}
        select:focus{outline:none;border-color:${C.primary}!important}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#E2E8F0;border-radius:2px}
        *{box-sizing:border-box}
        button:hover{opacity:0.92;transform:translateY(-1px)}
        button:active{transform:translateY(0)}
      `}</style>

      {/* ── Header ── */}
      <div style={{ padding: "12px 16px", background: "#fff", borderBottom: `1px solid ${C.cardBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 12, background: `linear-gradient(135deg, ${C.primary}, #047857)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 18, fontWeight: 800 }}>₺</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>Finans Asistanı</div>
            <div style={{ fontSize: 10.5, color: C.textMuted }}>{MONTHS_TR[now.getMonth()]} {now.getFullYear()} • {data.people.filter(Boolean).join(" & ")}{streak > 2 ? ` • 🔥${streak}` : ""}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {totalDebt > 0 && <Badge color={C.danger} bg={C.dangerLight}>💳 {(totalDebt/1000).toFixed(0)}K₺</Badge>}
          <Badge color={C.primary} bg={C.primaryLight}>💰 {remaining.toLocaleString("tr-TR")}₺</Badge>
          <button onClick={() => setSetup(true)} style={{ background: "#F1F5F9", border: "none", borderRadius: 10, padding: "7px 10px", cursor: "pointer", fontSize: 13 }}>⚙️</button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", gap: 4, padding: "10px 12px", overflowX: "auto", background: "#fff", borderBottom: `1px solid ${C.cardBorder}` }}>
        {[
          { id: "chat", l: "💬 Asistan", c: C.primary },
          { id: "dash", l: "📊 Dashboard", c: C.blue },
          { id: "debt", l: "💳 Borç", c: C.danger },
          { id: "travel", l: "✈️ Seyahat", c: C.purple },
          { id: "hist", l: "📋 Geçmiş", c: C.amber },
          { id: "settings", l: "⚙️ Ayarlar", c: C.textSec },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "8px 16px", borderRadius: 20, border: "none",
            background: tab === t.id ? `${t.c}12` : "transparent",
            color: tab === t.id ? t.c : C.textMuted,
            fontSize: 13, fontWeight: tab === t.id ? 700 : 600,
            cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
            transition: "all 0.2s",
          }}>{t.l}</button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* CHAT TAB */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {tab === "chat" && (
        <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 108px)", maxWidth: 660, margin: "0 auto" }}>
          {/* Quick stats */}
          <div style={{ display: "flex", gap: 8, padding: "10px 14px", overflowX: "auto" }}>
            {[
              { l: "Kalan", v: `${remaining.toLocaleString("tr-TR")}₺`, c: remaining < 0 ? C.danger : C.primary, bg: remaining < 0 ? C.dangerLight : C.primaryLight },
              { l: "Günlük", v: `${dailyBudget.toLocaleString("tr-TR")}₺`, c: C.blue, bg: C.blueLight },
              { l: `%${usagePct}`, v: "kullanıldı", c: usagePct > 85 ? C.danger : C.amber, bg: usagePct > 85 ? C.dangerLight : C.amberLight },
            ].map((s, i) => (
              <div key={i} style={{ background: s.bg, borderRadius: 14, padding: "8px 16px", minWidth: 90, flexShrink: 0 }}>
                <div style={{ fontSize: 10, color: s.c, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.l}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: s.c, fontFamily: "'JetBrains Mono', monospace" }}>{s.v}</div>
              </div>
            ))}
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
            {chat.map((m, i) => <Bubble key={i} msg={m} />)}
            <div ref={chatEnd} />
          </div>

          {/* Input area */}
          <div style={{ padding: "10px 14px", background: "#fff", borderTop: `1px solid ${C.cardBorder}` }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input ref={inpRef} value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
                placeholder='"Dondurma aldım 70 lira" veya "Ne kadar kaldı?"'
                style={{ flex: 1, padding: "13px 16px", background: "#F8FAFC", border: `1.5px solid ${C.cardBorder}`, borderRadius: 16, color: C.text, fontSize: 14, fontFamily: "inherit", outline: "none" }} />
              <button onClick={send} disabled={!msg.trim()}
                style={{ width: 48, height: 48, borderRadius: 16, background: msg.trim() ? `linear-gradient(135deg, ${C.primary}, #047857)` : "#F1F5F9", border: "none", color: msg.trim() ? "#fff" : C.textMuted, fontSize: 20, cursor: msg.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: msg.trim() ? `0 2px 8px rgba(5,150,105,0.3)` : "none" }}>↑</button>
            </div>
            <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap" }}>
              {["🛒 Markete gittim","☕ Kahve 45 TL","💰 Ne kadar kaldı?","📊 Bu ay harcamam?","🚕 Uber aldım"].map(q => (
                <button key={q} onClick={() => { setMsg(q); inpRef.current?.focus(); }}
                  style={{ padding: "6px 12px", borderRadius: 20, background: "#F1F5F9", border: `1px solid ${C.cardBorder}`, color: C.textSec, fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>{q}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* DASHBOARD */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {tab === "dash" && (
        <div style={{ padding: 16, maxWidth: 780, margin: "0 auto", animation: "fadeUp 0.3s" }}>
          {/* Tip */}
          <div style={{ background: C.amberLight, border: "1px solid #FDE68A", borderRadius: 14, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "#92400E" }}>{tip}</div>

          {/* Stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 16 }}>
            {[
              { l: "Gelir", v: data.income, c: C.primary, bg: C.primaryLight, ic: "📈" },
              { l: "Sabit Gider", v: fixedCosts, c: C.amber, bg: C.amberLight, ic: "🔄" },
              { l: "Harcanan", v: totalSpent, c: "#E11D48", bg: "#FFE4E6", ic: "💸" },
              { l: "Kalan", v: remaining, c: remaining < 0 ? C.danger : C.primary, bg: remaining < 0 ? C.dangerLight : C.primaryLight, ic: "💰" },
            ].map((s, i) => (
              <Card key={i} style={{ position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: -4, right: -2, fontSize: 36, opacity: 0.08 }}>{s.ic}</div>
                <div style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>{s.l}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.c, fontFamily: "'JetBrains Mono', monospace" }}>{s.v.toLocaleString("tr-TR")}<span style={{ fontSize: 13, fontWeight: 500 }}>₺</span></div>
              </Card>
            ))}
          </div>

          {/* Budget gauge */}
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 700 }}>Bütçe Kullanımı</span>
                <span style={{ fontSize: 12, color: C.textMuted, marginLeft: 8 }}>%{usagePct}</span>
              </div>
              <Badge color={C.blue} bg={C.blueLight}>📅 {remainingDays} gün kaldı</Badge>
            </div>
            <div style={{ width: "100%", height: 12, background: "#F1F5F9", borderRadius: 6, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 6, width: `${Math.min(usagePct, 100)}%`, background: usagePct > 85 ? `linear-gradient(90deg, ${C.danger}, #DC2626)` : `linear-gradient(90deg, ${C.primary}, #047857)`, transition: "width 0.6s" }} />
            </div>
            {streak > 2 && <div style={{ marginTop: 8, fontSize: 12, color: C.primary, fontWeight: 600 }}>🔥 {streak} gündür bütçe dahilinde harcıyorsun!</div>}
          </Card>

          {/* Category rings */}
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Kategori Harcamaları</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 10 }}>
              {cats.filter(c => (catSpend[c.id] || 0) > 0 || data.budgets[c.id]).map(cat => {
                const spent = catSpend[cat.id] || 0;
                const budget = data.budgets[cat.id] || spendableIncome / cats.length;
                const pct = Math.round((spent / Math.max(budget, 1)) * 100);
                return (
                  <div key={cat.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: 6 }}>
                    <div style={{ position: "relative" }}>
                      <Ring pct={pct} color={cat.color} size={54} />
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{cat.icon}</div>
                    </div>
                    <div style={{ fontSize: 10.5, color: C.textSec, textAlign: "center", fontWeight: 600 }}>{cat.label.split("/")[0]}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: cat.color, fontFamily: "'JetBrains Mono'" }}>{spent > 999 ? `${(spent/1000).toFixed(1)}K` : spent}₺</div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Pie + person spend */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            {pieData.length > 0 && (
              <Card style={{ flex: "1 1 240px" }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Dağılım</div>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={42} outerRadius={70} dataKey="value" stroke="#fff" strokeWidth={2}>
                    {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie><Tooltip formatter={v => `${v.toLocaleString("tr-TR")}₺`} contentStyle={{ background: "#fff", border: `1px solid ${C.cardBorder}`, borderRadius: 10, fontSize: 12 }} /></PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                  {pieData.map(d => <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: C.textSec }}><div style={{ width: 8, height: 8, borderRadius: 3, background: d.color }} />{d.icon} {d.name.split("/")[0]}</div>)}
                </div>
              </Card>
            )}
            <Card style={{ flex: "1 1 200px" }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Kişi Bazlı</div>
              {Object.entries(personSpend).map(([name, amount]) => (
                <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.cardBorder}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: name === data.people[0] ? C.primaryLight : C.blueLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{name[0]}</div>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{name}</span>
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 700, fontFamily: "'JetBrains Mono'", color: C.text }}>{amount.toLocaleString("tr-TR")}₺</span>
                </div>
              ))}
            </Card>
          </div>

          {/* Add category */}
          <Card>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>➕ Yeni Kategori Ekle</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={catForm.icon} onChange={e => setCatForm(p=>({...p,icon:e.target.value}))} maxLength={2}
                style={{ width: 48, padding: 10, background: "#F8FAFC", border: `1.5px solid ${C.cardBorder}`, borderRadius: 10, fontSize: 18, textAlign: "center", fontFamily: "inherit" }} />
              <Inp value={catForm.label} onChange={e => setCatForm(p=>({...p,label:e.target.value}))} placeholder="Kategori adı (ör: Netflix, Abonelik)" style={{ flex: 1 }} />
              <Btn onClick={() => {
                if (!catForm.label.trim()) return;
                const id = catForm.label.toLowerCase().replace(/[^a-z0-9ğüşıöç]/g,"_");
                setData(p => ({ ...p, categories: [...(p.categories||DEFAULT_CATS), { id, label: catForm.label.trim(), icon: catForm.icon||"📌", color: EXTRA_COLORS[(p.categories||[]).length % EXTRA_COLORS.length], keywords: [catForm.label.toLowerCase()] }] }));
                setCatForm({ label: "", icon: "📌" });
              }} style={{ whiteSpace: "nowrap" }}>Ekle</Btn>
            </div>
          </Card>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* DEBT TAB */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {tab === "debt" && (
        <div style={{ padding: 16, maxWidth: 680, margin: "0 auto", animation: "fadeUp 0.3s" }}>
          {/* Ziraat rates */}
          <Card style={{ marginBottom: 16, background: "#FFF7ED", borderColor: "#FED7AA" }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: "#C2410C" }}>🏦 Ziraat Bankası 2026 Faiz Oranları</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {ZIRAAT_RATES.map((r, i) => (
                <div key={i} style={{ background: "#fff", borderRadius: 12, padding: 12, textAlign: "center", border: "1px solid #FED7AA" }}>
                  <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, marginBottom: 4 }}>{r.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: C.danger, fontFamily: "'JetBrains Mono'" }}>%{r.akdi}</div>
                  <div style={{ fontSize: 10, color: C.textMuted }}>akdi / ay</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Summary */}
          {totalDebt > 0 && (
            <Card style={{ marginBottom: 16, background: C.dangerLight, borderColor: "#FECACA" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.danger, textTransform: "uppercase" }}>Toplam Borç</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: C.danger, fontFamily: "'JetBrains Mono'" }}>{totalDebt.toLocaleString("tr-TR")}₺</div>
                </div>
                <div style={{ fontSize: 48, opacity: 0.2 }}>💳</div>
              </div>
              <div style={{ fontSize: 12, color: "#991B1B", marginTop: 6 }}>⚡ Önce borcu kapat, sonra biriktir. Faiz her ay bakiyeni büyütüyor!</div>
            </Card>
          )}

          {/* Add debt */}
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>➕ Borç Ekle</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <Inp value={debtForm.name} onChange={e => setDebtForm(p=>({...p,name:e.target.value}))} placeholder="Borç adı (ör: Ziraat KK)" style={{ flex: 1 }} />
                <Inp value={debtForm.bank} onChange={e => setDebtForm(p=>({...p,bank:e.target.value}))} placeholder="Banka" style={{ width: 110 }} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Inp value={debtForm.balance} onChange={e => setDebtForm(p=>({...p,balance:e.target.value}))} placeholder="Toplam borç" prefix="₺" type="number" style={{ flex: 1 }} />
                <Inp value={debtForm.rate} onChange={e => setDebtForm(p=>({...p,rate:e.target.value}))} placeholder="Aylık faiz %" type="number" style={{ width: 110 }} />
              </div>
              <Btn onClick={() => {
                if (!debtForm.balance) return;
                setData(p => ({ ...p, debts: [...(p.debts||[]), { id: Date.now(), name: debtForm.name||"Borç", balance: Number(debtForm.balance), bank: debtForm.bank||"Banka", interestRate: Number(debtForm.rate)||3.25 }] }));
                setDebtForm({ name: "", balance: "", rate: "3.25", bank: "Ziraat" });
              }} style={{ width: "100%" }}>Borç Ekle</Btn>
            </div>
          </Card>

          {/* Debt list */}
          {(data.debts || []).map(d => {
            const mi = d.balance * (d.interestRate / 100);
            const m6 = d.balance * Math.pow(1 + d.interestRate / 100, 6);
            return (
              <Card key={d.id} style={{ marginBottom: 10, borderColor: "#FECACA" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>💳 {d.name}</div>
                    <div style={{ fontSize: 12, color: C.textMuted }}>{d.bank} • Aylık %{d.interestRate}</div>
                  </div>
                  <button onClick={() => setData(p => ({ ...p, debts: p.debts.filter(x => x.id !== d.id) }))} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 16 }}>✕</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
                  <div style={{ background: C.dangerLight, borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
                    <div style={{ fontSize: 9.5, color: C.danger, fontWeight: 600 }}>Bakiye</div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: C.danger, fontFamily: "'JetBrains Mono'" }}>{d.balance > 999 ? `${(d.balance/1000).toFixed(1)}K` : d.balance}₺</div>
                  </div>
                  <div style={{ background: C.amberLight, borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
                    <div style={{ fontSize: 9.5, color: "#B45309", fontWeight: 600 }}>Aylık Faiz</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#B45309", fontFamily: "'JetBrains Mono'" }}>+{Math.round(mi).toLocaleString("tr-TR")}₺</div>
                  </div>
                  <div style={{ background: "#FEE2E2", borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
                    <div style={{ fontSize: 9.5, color: "#991B1B", fontWeight: 600 }}>6 Ay Sonra</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#991B1B", fontFamily: "'JetBrains Mono'" }}>{Math.round(m6).toLocaleString("tr-TR")}₺</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {[1000, 2500, 5000].map(a => (
                    <Btn key={a} variant="ghost" onClick={() => setData(p => ({ ...p, debts: p.debts.map(x => x.id === d.id ? { ...x, balance: Math.max(0, x.balance - a) } : x) }))}
                      style={{ flex: 1, padding: "8px 4px", fontSize: 12, color: C.primary, borderColor: C.primaryLight }}>-{a.toLocaleString("tr-TR")}₺</Btn>
                  ))}
                </div>
              </Card>
            );
          })}

          {/* Installments */}
          <div style={{ fontSize: 15, fontWeight: 700, margin: "20px 0 12px" }}>🔄 Taksitler</div>
          <Card style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>➕ Taksit Ekle</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Inp value={instForm.name} onChange={e => setInstForm(p=>({...p,name:e.target.value}))} placeholder="Taksit adı (ör: MacFit üyelik)" />
              <div style={{ display: "flex", gap: 8 }}>
                <Inp value={instForm.total} onChange={e => setInstForm(p=>({...p,total:e.target.value}))} placeholder="Toplam tutar" prefix="₺" type="number" style={{ flex: 1 }} />
                <Inp value={instForm.count} onChange={e => setInstForm(p=>({...p,count:e.target.value}))} placeholder="Taksit" type="number" style={{ width: 90 }} />
              </div>
              <select value={instForm.cat} onChange={e => setInstForm(p=>({...p,cat:e.target.value}))}
                style={{ padding: "11px 14px", background: "#F8FAFC", border: `1.5px solid ${C.cardBorder}`, borderRadius: 12, color: C.text, fontSize: 13.5, fontFamily: "inherit" }}>
                {cats.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
              </select>
              <Btn onClick={() => {
                if (!instForm.total || !instForm.count) return;
                const total = Number(instForm.total), count = Number(instForm.count);
                setData(p => ({ ...p, installments: [...(p.installments||[]), { id: Date.now(), name: instForm.name||"Taksit", total, count, monthly: Math.ceil(total/count), paid: 0, startDate: new Date().toISOString(), category: instForm.cat }] }));
                setInstForm({ name: "", total: "", count: "", cat: "kredi" });
              }} style={{ width: "100%" }}>Taksit Ekle</Btn>
            </div>
          </Card>
          {(data.installments || []).map(inst => {
            const pct = Math.round((inst.paid / inst.count) * 100);
            const cat = cats.find(c => c.id === inst.category);
            const done = inst.paid >= inst.count;
            return (
              <Card key={inst.id} style={{ marginBottom: 8, opacity: done ? 0.6 : 1, borderColor: done ? "#BBF7D0" : C.cardBorder }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{cat?.icon} {inst.name}</span>
                    <span style={{ fontSize: 12, color: C.textMuted, marginLeft: 8 }}>{inst.paid}/{inst.count} taksit</span>
                    {done && <Badge color={C.primary} bg={C.primaryLight} style={{ marginLeft: 6 }}>✅ Bitti!</Badge>}
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {!done && <Btn variant="ghost" onClick={() => setData(p => ({ ...p, installments: p.installments.map(x => x.id === inst.id ? { ...x, paid: Math.min(x.paid+1,x.count) } : x) }))} style={{ padding: "5px 10px", fontSize: 11 }}>Ödendi ✓</Btn>}
                    <button onClick={() => setData(p => ({ ...p, installments: p.installments.filter(x => x.id !== inst.id) }))} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer" }}>✕</button>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.textSec, marginBottom: 4 }}>
                  <span>Aylık: {inst.monthly.toLocaleString("tr-TR")}₺</span>
                  <span>Kalan: {((inst.count-inst.paid)*inst.monthly).toLocaleString("tr-TR")}₺</span>
                </div>
                <div style={{ width: "100%", height: 6, background: "#F1F5F9", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: done ? C.primary : C.blue, borderRadius: 3, transition: "width 0.5s" }} />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* TRAVEL TAB */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {tab === "travel" && (
        <div style={{ padding: 16, maxWidth: 560, margin: "0 auto", animation: "fadeUp 0.3s" }}>
          <div style={{ textAlign: "center", margin: "16px 0 24px" }}>
            <div style={{ fontSize: 60, marginBottom: 4 }}>✈️</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: C.text }}>Seyahat Birikimleri</h2>
            <p style={{ color: C.textSec, fontSize: 13, marginTop: 4 }}>Yurt dışı gezi hayalini gerçekleştir!</p>
          </div>

          <Card style={{ marginBottom: 18, textAlign: "center", background: "linear-gradient(135deg, #EFF6FF, #F5F3FF)", borderColor: "#BFDBFE" }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, color: C.purple }}>{data.travelGoal?.destination || "🌍 Hedef belirle!"}</div>
            <div style={{ position: "relative", display: "inline-block" }}>
              <Ring pct={data.travelGoal?.target ? Math.round(((data.travelGoal?.saved||0) / data.travelGoal.target) * 100) : 0} color={C.purple} size={130} stroke={10} />
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.purple, fontFamily: "'JetBrains Mono'" }}>{((data.travelGoal?.saved||0)/1000).toFixed(1)}K</div>
                <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>/ {((data.travelGoal?.target||0)/1000).toFixed(0)}K ₺</div>
              </div>
            </div>
            {data.travelGoal?.targetDate && (() => {
              const [y,m] = data.travelGoal.targetDate.split("-").map(Number);
              const monthsLeft = Math.max(1, (y - now.getFullYear()) * 12 + m - now.getMonth() - 1);
              const monthlyNeeded = Math.ceil(((data.travelGoal?.target||0) - (data.travelGoal?.saved||0)) / monthsLeft);
              return <div style={{ marginTop: 14, fontSize: 13, color: C.textSec }}>
                📅 {MONTHS_TR[m-1]} {y} • {monthsLeft} ay kaldı • Aylık <b style={{ color: C.purple }}>{monthlyNeeded.toLocaleString("tr-TR")}₺</b> biriktir
              </div>;
            })()}
          </Card>

          <Card style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>🎯 Hedef Ayarla</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Inp value={travelForm.dest} onChange={e => setTravelForm(p=>({...p,dest:e.target.value}))} placeholder="Nereye? (ör: Yunanistan, İrlanda, Almanya)" />
              <div style={{ display: "flex", gap: 8 }}>
                <Inp value={travelForm.target} onChange={e => setTravelForm(p=>({...p,target:e.target.value}))} placeholder="Hedef tutar" prefix="₺" type="number" style={{ flex: 1 }} />
                <input value={travelForm.date} onChange={e => setTravelForm(p=>({...p,date:e.target.value}))} type="month"
                  style={{ padding: "11px 14px", background: "#F8FAFC", border: `1.5px solid ${C.cardBorder}`, borderRadius: 12, color: C.text, fontSize: 13, fontFamily: "inherit", flex: 1 }} />
              </div>
              <Btn onClick={() => {
                setData(p => ({ ...p, travelGoal: { ...p.travelGoal, destination: travelForm.dest||p.travelGoal?.destination, target: Number(travelForm.target)||p.travelGoal?.target||0, targetDate: travelForm.date||p.travelGoal?.targetDate, saved: p.travelGoal?.saved||0 } }));
              }} style={{ width: "100%" }}>Kaydet</Btn>
            </div>
          </Card>

          <Card>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>💰 Birikim Ekle</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <Inp value={travelForm.addAmt} onChange={e => setTravelForm(p=>({...p,addAmt:e.target.value}))} placeholder="Tutar" prefix="₺" type="number" style={{ flex: 1 }} />
              <Btn onClick={() => {
                if (!travelForm.addAmt) return;
                setData(p => ({ ...p, travelGoal: { ...p.travelGoal, saved: (p.travelGoal?.saved||0) + Number(travelForm.addAmt) } }));
                setTravelForm(p => ({ ...p, addAmt: "" }));
              }}>Ekle</Btn>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {[500, 1000, 2500, 5000].map(a => (
                <Btn key={a} variant="ghost" onClick={() => setData(p => ({ ...p, travelGoal: { ...p.travelGoal, saved: (p.travelGoal?.saved||0)+a } }))}
                  style={{ flex: 1, padding: "8px 4px", fontSize: 12, color: C.purple, borderColor: "#E9D5FF" }}>+{a > 999 ? `${a/1000}K` : a}₺</Btn>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* HISTORY TAB */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {tab === "hist" && (
        <div style={{ padding: 16, maxWidth: 620, margin: "0 auto", animation: "fadeUp 0.3s" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>Bu Ayki İşlemler</span>
            <Badge color={C.textSec} bg="#F1F5F9">{mExp.length} işlem • {totalSpent.toLocaleString("tr-TR")}₺</Badge>
          </div>
          {mExp.length === 0 ? (
            <Card style={{ textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>📝</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.textSec }}>Henüz harcama yok</div>
              <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>Asistan sekmesinden ekle!</div>
            </Card>
          ) : (
            [...mExp].reverse().map(exp => {
              const cat = cats.find(c => c.id === exp.category) || cats[cats.length-1];
              const d = new Date(exp.date);
              return (
                <div key={exp.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", marginBottom: 6, background: "#fff", border: `1px solid ${C.cardBorder}`, borderRadius: 14, boxShadow: C.shadow }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: `${cat.color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{cat.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{exp.description}</div>
                    <div style={{ fontSize: 11, color: C.textMuted }}>{cat.label} • {exp.person} • {d.getDate()} {MONTHS_TR[d.getMonth()]}</div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: C.danger, fontFamily: "'JetBrains Mono'" }}>-{exp.amount.toLocaleString("tr-TR")}₺</div>
                  <button onClick={() => setData(p => ({ ...p, expenses: p.expenses.filter(e => e.id !== exp.id) }))}
                    style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 14, padding: 4 }}>✕</button>
                </div>
              );
            })
          )}
          {mExp.length > 0 && (
            <Btn variant="danger" onClick={() => { if (confirm("Bu ayki tüm harcamalar silinecek?")) setData(p => ({ ...p, expenses: p.expenses.filter(e => { const d=new Date(e.date); return d.getMonth()!==now.getMonth()||d.getFullYear()!==now.getFullYear(); }) })); }}
              style={{ width: "100%", marginTop: 14 }}>🗑 Tüm Harcamaları Sil</Btn>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* SETTINGS TAB */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {tab === "settings" && (
        <div style={{ padding: 16, maxWidth: 500, margin: "0 auto", animation: "fadeUp 0.3s" }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>⚙️ Ayarlar</div>

          {/* Recurring expenses */}
          <Card style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>🔁 Tekrarlanan Giderler</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 10 }}>Her ay otomatik bütçeden düşülür (kira, fatura, abonelik vb.)</div>
            {(data.recurring || []).map(r => {
              const cat = cats.find(c => c.id === r.category);
              return (
                <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.cardBorder}` }}>
                  <span style={{ fontSize: 13 }}>{cat?.icon} {r.name} <span style={{ color: C.textMuted }}>· Her ay {r.day}.</span></span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 700, fontFamily: "'JetBrains Mono'", fontSize: 13 }}>{r.amount.toLocaleString("tr-TR")}₺</span>
                    <button onClick={() => setData(p => ({ ...p, recurring: p.recurring.filter(x => x.id !== r.id) }))} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer" }}>✕</button>
                  </div>
                </div>
              );
            })}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <Inp value={recurForm.name} onChange={e => setRecurForm(p=>({...p,name:e.target.value}))} placeholder="Gider adı (ör: Kira)" style={{ flex: 1 }} />
                <Inp value={recurForm.amount} onChange={e => setRecurForm(p=>({...p,amount:e.target.value}))} placeholder="Tutar" prefix="₺" type="number" style={{ width: 100 }} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <select value={recurForm.cat} onChange={e => setRecurForm(p=>({...p,cat:e.target.value}))}
                  style={{ flex: 1, padding: "10px 14px", background: "#F8FAFC", border: `1.5px solid ${C.cardBorder}`, borderRadius: 12, color: C.text, fontSize: 13, fontFamily: "inherit" }}>
                  {cats.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                </select>
                <Inp value={recurForm.day} onChange={e => setRecurForm(p=>({...p,day:e.target.value}))} placeholder="Gün" type="number" style={{ width: 70 }} />
              </div>
              <Btn onClick={() => {
                if (!recurForm.name || !recurForm.amount) return;
                setData(p => ({ ...p, recurring: [...(p.recurring||[]), { id: Date.now(), name: recurForm.name, amount: Number(recurForm.amount), category: recurForm.cat, day: Number(recurForm.day)||1 }] }));
                setRecurForm({ name: "", amount: "", cat: "ev", day: "1" });
              }} style={{ width: "100%" }}>Ekle</Btn>
            </div>
          </Card>

          {/* Budget per category */}
          <Card style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>📊 Kategori Bütçeleri</div>
            {cats.map(cat => (
              <div key={cat.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 13, width: 110, flexShrink: 0 }}>{cat.icon} {cat.label.split("/")[0]}</span>
                <Inp value={data.budgets[cat.id] || ""} onChange={e => setData(p => ({ ...p, budgets: { ...p.budgets, [cat.id]: Number(e.target.value)||0 } }))}
                  placeholder="Limit" prefix="₺" type="number" style={{ flex: 1, padding: "8px 12px 8px 26px", fontSize: 13 }} />
              </div>
            ))}
          </Card>

          {/* Export/Import */}
          <Card style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>💾 Veri Yedekleme</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 10 }}>Verilerini JSON dosyası olarak yedekle veya başka cihazdan yükle</div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn onClick={exportData} variant="blue" style={{ flex: 1 }}>📥 Dışa Aktar</Btn>
              <label style={{ flex: 1 }}>
                <Btn variant="ghost" style={{ width: "100%", cursor: "pointer" }} as="span">📤 İçe Aktar</Btn>
                <input type="file" accept=".json" onChange={importData} style={{ display: "none" }} />
              </label>
            </div>
          </Card>

          {/* Reset */}
          <Card style={{ borderColor: "#FECACA" }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: C.danger }}>🗑 Sıfırla</div>
            <Btn variant="danger" onClick={() => { if (confirm("TÜM veriler silinecek. Emin misin?")) { localStorage.removeItem(SK); setData(INIT); setSetup(true); } }} style={{ width: "100%" }}>Her Şeyi Sıfırla</Btn>
          </Card>
        </div>
      )}
    </div>
  );
}
