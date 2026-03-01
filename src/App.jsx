import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── Supabase client (reads from .env) ────────────────────────────────────────
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = ["全部", "OM/IS", "Marketing", "CS/AI", "Economics"];

const JOURNAL_COLORS = {
  "Management Science": "#60a5fa",
  "MIS Quarterly": "#34d399",
  "Information Systems Research": "#a78bfa",
  "Production and Operations Management": "#fb923c",
  "Marketing Science": "#f472b6",
  "Journal of Marketing Research": "#facc15",
  "SSRN (OM/IS)": "#94a3b8",
  "arXiv (cs.IR)": "#38bdf8",
  "arXiv (econ.GN)": "#4ade80",
};

function jColor(journal) {
  return JOURNAL_COLORS[journal] || "#94a3b8";
}

function tagBg(tag) {
  const palette = ["#60a5fa1a","#34d3991a","#a78bfa1a","#f472b61a","#facc151a","#fb923c1a"];
  let h = 0; for (let c of tag) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return palette[h % palette.length];
}

// ─── UI primitives ────────────────────────────────────────────────────────────

function Spinner({ color = "#60a5fa", size = 18 }) {
  return <div style={{ width: size, height: size, borderRadius: "50%", border: `2px solid ${color}33`, borderTopColor: color, animation: "spin 0.7s linear infinite", flexShrink: 0 }} />;
}

function Card({ children, accent, style = {} }) {
  return (
    <div style={{ padding: "16px 18px", borderRadius: "10px", background: accent ? `${accent}08` : "rgba(255,255,255,0.03)", border: `1px solid ${accent ? accent + "25" : "rgba(255,255,255,0.07)"}`, position: "relative", overflow: "hidden", ...style }}>
      {accent && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "3px", background: accent }} />}
      <div style={{ paddingLeft: accent ? "6px" : 0 }}>{children}</div>
    </div>
  );
}

function Badge({ label, value, color }) {
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: "2px", padding: "5px 11px", borderRadius: "7px", background: `${color}12`, border: `1px solid ${color}25` }}>
      <span style={{ fontSize: "8px", color: `${color}80`, fontFamily: "monospace", letterSpacing: "1.5px", textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontSize: "11px", color, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function StructuredText({ text, accent = "#60a5fa" }) {
  if (!text) return null;
  return (
    <div>
      {text.split("\n").map((line, i) => {
        const t = line.trim();
        if (!t) return <div key={i} style={{ height: "6px" }} />;
        if (t.startsWith("### ")) return <p key={i} style={{ fontSize: "11px", fontWeight: 700, color: accent, margin: "14px 0 5px", letterSpacing: "0.5px", fontFamily: "monospace" }}>{t.slice(4)}</p>;
        if (t.startsWith("**") && t.endsWith("**")) return <p key={i} style={{ fontSize: "13px", fontWeight: 700, color: "rgba(255,255,255,0.88)", margin: "10px 0 3px" }}>{t.slice(2, -2)}</p>;
        const html = t.replace(/\*\*(.+?)\*\*/g, '<strong style="color:rgba(255,255,255,0.85)">$1</strong>');
        if (t.startsWith("- ") || t.startsWith("• ")) return (
          <div key={i} style={{ display: "flex", gap: "8px", margin: "3px 0" }}>
            <span style={{ color: accent, flexShrink: 0, marginTop: "2px" }}>›</span>
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.62)", margin: 0, lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: html.slice(2) }} />
          </div>
        );
        if (t.match(/^\d\. /)) return (
          <div key={i} style={{ display: "flex", gap: "8px", margin: "5px 0" }}>
            <span style={{ color: accent, fontSize: "11px", fontWeight: 700, fontFamily: "monospace", minWidth: "16px", marginTop: "3px" }}>{t[0]}.</span>
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.68)", margin: 0, lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: html.slice(3) }} />
          </div>
        );
        return <p key={i} style={{ fontSize: "12px", color: "rgba(255,255,255,0.58)", margin: "3px 0", lineHeight: 1.75 }} dangerouslySetInnerHTML={{ __html: html }} />;
      })}
    </div>
  );
}

// ─── AI Panel ─────────────────────────────────────────────────────────────────
function AIPanel({ paper }) {
  const [phase, setPhase] = useState("idle");
  const [partA, setPartA] = useState(null);
  const [partBC, setPartBC] = useState(null);
  const [loadMsg, setLoadMsg] = useState("");
  const [tab, setTab] = useState("a");
  const timerRef = useRef(null);

  useEffect(() => {
    setPhase("idle"); setPartA(null); setPartBC(null); setTab("a");
    return () => clearInterval(timerRef.current);
  }, [paper?.id]);

  function cycling(msgs) {
    let i = 0; setLoadMsg(msgs[0]);
    timerRef.current = setInterval(() => { i = (i + 1) % msgs.length; setLoadMsg(msgs[i]); }, 1000);
  }

  async function callClaude(prompt, maxTokens = 900) {
    const res = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    return data.content[0].text;
  }

  async function runPartA() {
    setPhase("loading_a");
    cycling(["解析 Research Question...", "识别核心方法论...", "提取关键发现...", "结构化输出..."]);
    try {
      const text = await callClaude(`你是顶尖商学院教授，请分析以下论文摘要，严格按格式用中文输出。

论文：《${paper.title}》
期刊：${paper.journal}
摘要：${paper.abstract || "（摘要暂无）"}

### Part A：一分钟核心速读

**Research Question**
一句话精确描述本文试图回答的核心科学问题。

**Methodology**
研究方法（如：Game Theory / Field Experiment / ML / Econometrics），并说明为什么这个方法适合这个RQ。

**Key Finding（最反直觉的结论）**
提炼最值得关注的1-2个结论，重点突出"反常识"或"与现有文献矛盾"之处。

**Practical Implication**
这个发现对从业者（平台/零售商/政策制定者）意味着什么？一句话说清楚。`);
      clearInterval(timerRef.current);
      setPartA(text); setPhase("part_a");
    } catch {
      clearInterval(timerRef.current);
      setPartA("解析失败，请重试。"); setPhase("part_a");
    }
  }

  async function runPartBC() {
    setPhase("loading_bc"); setTab("b");
    cycling(["拆解核心机制...", "识别关键Trade-off...", "生成场景迁移方向...", "构建方法论拓展...", "引入新调节变量...", "整合研究图谱..."]);
    try {
      const text = await callClaude(`你是在 Management Science / MIS / Marketing Science 发表过多篇文章的资深学者。请基于以下论文，输出结构化分析，中文，内容具体可执行。

论文：《${paper.title}》
摘要：${paper.abstract || "（摘要暂无）"}

### Part B：理论与机制拆解

**核心冲突 / Trade-off**
本文的核心张力是什么？两种力量相互对抗产生了什么有趣的均衡？

**关键变量引入**
本文引入了哪些之前文献忽略的关键变量？这些变量如何改变了结论方向？

**理论贡献定位**
本文在哪条理论脉络上做了延伸？（如延伸了 Bertrand Competition / Principal-Agent / Prospect Theory）

---

### Part C：站在巨人肩膀上

**方向 1：场景迁移 (Contextual Shift)**
将本文模型/结论迁移到新兴场景（Agentic AI / LLM-mediated markets / AI-to-AI negotiation），核心结论会如何反转或强化？给出一个具体可写的RQ。

**方向 2：方法论拓展 (Methodological Extension)**
如果原文是理论模型，建议如何设计实证验证？如果原文是实证，建议如何构建理论框架？给出具体实验设计思路。

**方向 3：引入新调节变量 (New Moderator)**
引入1-2个原文未考虑但高度相关的调节变量。说明：引入后原文核心结论在哪个区间会反转？这构成 independent paper 的空间吗？

**综合评分**
- 创新性（1-5星）：
- 执行难度（1-5星，越难越高）：
- 发表潜力（1-5星）：`, 1500);
      clearInterval(timerRef.current);
      setPartBC(text); setPhase("done");
    } catch {
      clearInterval(timerRef.current);
      setPartBC("生成失败，请重试。"); setPhase("done");
    }
  }

  function extractPartB(text) {
    const s = text.indexOf("Part B"); const e = text.indexOf("Part C");
    if (s === -1) return text;
    return e > s ? text.slice(s, e) : text.slice(s);
  }

  function extractDir(text, dir) {
    const s = text.indexOf(`**${dir}`); if (s === -1) return "";
    const nexts = ["**方向 1","**方向 2","**方向 3","**综合评分"].map(d => d !== `**${dir}` ? text.indexOf(d, s+5) : -1).filter(n => n > s);
    return text.slice(s, nexts.length ? Math.min(...nexts) : text.length);
  }

  function extractScore(text) {
    const i = text.indexOf("综合评分"); return i === -1 ? null : text.slice(i);
  }

  if (!paper) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "14px" }}>
      <div style={{ fontSize: "48px", opacity: 0.25 }}>📄</div>
      <p style={{ color: "rgba(255,255,255,0.18)", fontFamily: "monospace", fontSize: "11px", letterSpacing: "2.5px" }}>SELECT A PAPER TO BEGIN</p>
    </div>
  );

  const jc = jColor(paper.journal);
  const isLoading = phase === "loading_a" || phase === "loading_bc";

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Paper header */}
      <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
          <Badge label="JOURNAL" value={paper.journal} color={jc} />
          <Badge label="DATE" value={paper.pub_date || "—"} color="#64748b" />
          {paper.doi && <Badge label="DOI" value={paper.doi.slice(0, 20) + "…"} color="#475569" />}
        </div>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#fff", margin: "0 0 7px", lineHeight: 1.5, fontFamily: "'Crimson Pro', Georgia, serif" }}>{paper.title}</h2>
        <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", margin: "0 0 12px", fontStyle: "italic" }}>{paper.authors}</p>
        <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
          {(paper.tags || []).map(t => (
            <span key={t} style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "20px", background: tagBg(t), color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.07)" }}>{t}</span>
          ))}
          {paper.url && (
            <a href={paper.url} target="_blank" rel="noreferrer" style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "20px", background: `${jc}15`, color: jc, border: `1px solid ${jc}30`, textDecoration: "none" }}>
              → 原文链接
            </a>
          )}
        </div>
      </div>

      {/* Abstract */}
      <div style={{ padding: "14px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
        <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)", fontFamily: "monospace", letterSpacing: "2px", margin: "0 0 7px" }}>ABSTRACT</p>
        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.42)", lineHeight: 1.8, margin: 0 }}>
          {paper.abstract || "摘要暂无，点击原文链接查看。"}
        </p>
      </div>

      {/* AI content */}
      <div style={{ flex: 1, overflow: "auto", padding: "18px 24px" }}>
        {phase === "idle" && (
          <button onClick={runPartA} style={{ width: "100%", padding: "14px", borderRadius: "10px", background: "linear-gradient(135deg,rgba(96,165,250,0.18),rgba(52,211,153,0.1))", border: "1px solid rgba(96,165,250,0.3)", color: "#60a5fa", fontSize: "13px", fontWeight: 700, letterSpacing: "1px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", fontFamily: "monospace" }}>
            ⚡ 启动 AI 深度解读
          </button>
        )}

        {isLoading && (
          <Card accent={phase === "loading_bc" ? "#a78bfa" : "#60a5fa"}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <Spinner color={phase === "loading_bc" ? "#a78bfa" : "#60a5fa"} />
              <span style={{ color: phase === "loading_bc" ? "#a78bfa" : "#60a5fa", fontSize: "12px", fontFamily: "monospace" }}>{loadMsg}</span>
            </div>
          </Card>
        )}

        {(phase === "part_a" || phase === "loading_bc" || phase === "done") && (
          <>
            <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
              {[["a", "A — 核心速读", "#60a5fa"], ["b", "B+C — 机制 & 研究方向", "#a78bfa"]].map(([t, label, color]) => {
                const avail = t === "a" || phase === "done" || phase === "loading_bc";
                return (
                  <button key={t} disabled={!avail} onClick={() => setTab(t)} style={{ padding: "7px 14px", borderRadius: "7px", fontSize: "11px", fontWeight: 600, fontFamily: "monospace", cursor: avail ? "pointer" : "not-allowed", background: tab === t ? `${color}22` : "rgba(255,255,255,0.04)", color: tab === t ? color : "rgba(255,255,255,0.3)", border: `1px solid ${tab === t ? color + "44" : "rgba(255,255,255,0.08)"}`, opacity: avail ? 1 : 0.4, transition: "all 0.15s" }}>{label}</button>
                );
              })}
            </div>

            {tab === "a" && partA && (
              <>
                <Card accent="#60a5fa" style={{ marginBottom: "14px" }}>
                  <StructuredText text={partA} accent="#60a5fa" />
                </Card>
                {phase === "part_a" && (
                  <button onClick={runPartBC} style={{ width: "100%", padding: "13px", borderRadius: "10px", background: "linear-gradient(135deg,rgba(167,139,250,0.18),rgba(244,114,182,0.1))", border: "1px solid rgba(167,139,250,0.35)", color: "#a78bfa", fontSize: "13px", fontWeight: 700, letterSpacing: "1px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", fontFamily: "monospace" }}>
                    🔭 生成机制拆解 + 研究方向
                  </button>
                )}
              </>
            )}

            {tab === "b" && (
              <>
                {phase === "loading_bc" && (
                  <Card accent="#a78bfa"><div style={{ display: "flex", alignItems: "center", gap: "12px" }}><Spinner color="#a78bfa" /><span style={{ color: "#a78bfa", fontSize: "12px", fontFamily: "monospace" }}>{loadMsg}</span></div></Card>
                )}
                {partBC && (
                  <>
                    <p style={{ fontSize: "9px", fontWeight: 800, color: "#a78bfa", letterSpacing: "2.5px", textTransform: "uppercase", fontFamily: "monospace", margin: "0 0 10px" }}>⚙️ Part B — 理论机制拆解</p>
                    <Card accent="#a78bfa" style={{ marginBottom: "16px" }}><StructuredText text={extractPartB(partBC)} accent="#a78bfa" /></Card>

                    <p style={{ fontSize: "9px", fontWeight: 800, color: "#f472b6", letterSpacing: "2.5px", textTransform: "uppercase", fontFamily: "monospace", margin: "0 0 10px" }}>🔭 Part C — 站在巨人肩膀上</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "12px" }}>
                      {[["方向 1", "🌐 场景迁移", "#38bdf8"], ["方向 2", "🔬 方法论拓展", "#34d399"], ["方向 3", "🎛️ 新调节变量", "#fb923c"]].map(([dir, label, color]) => (
                        <Card key={dir} accent={color}>
                          <p style={{ fontSize: "10px", fontWeight: 700, color, fontFamily: "monospace", letterSpacing: "1px", margin: "0 0 8px" }}>{label}</p>
                          <StructuredText text={extractDir(partBC, dir)} accent={color} />
                        </Card>
                      ))}
                    </div>
                    {extractScore(partBC) && (
                      <Card style={{ background: "rgba(250,204,21,0.04)", border: "1px solid rgba(250,204,21,0.15)" }}>
                        <p style={{ fontSize: "10px", fontWeight: 700, color: "#facc15", fontFamily: "monospace", letterSpacing: "1px", margin: "0 0 8px" }}>📊 综合评分</p>
                        <StructuredText text={extractScore(partBC)} accent="#facc15" />
                      </Card>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
      `}</style>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selPaper, setSelPaper] = useState(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("全部");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 30;

  useEffect(() => {
    fetchPapers();
  }, [search, category, page]);

  async function fetchPapers() {
    setLoading(true);
    try {
      let query = supabase
        .from("papers")
        .select("id,title,authors,journal,category,abstract,doi,url,pub_date,tags")
        .order("pub_date", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (category !== "全部") {
        query = query.eq("category", category);
      }

      if (search.trim()) {
        // Use full-text search if available, else ilike
        query = query.or(`title.ilike.%${search}%,abstract.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setPapers(data || []);
    } catch (e) {
      console.error("Fetch error:", e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ height: "100vh", background: "#080c12", color: "#fff", fontFamily: "'DM Sans',system-ui,sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Crimson+Pro:ital,wght@0,400;0,600;1,400&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        button { border: none; background: none; cursor: pointer; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>

      {/* Header */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", height: "50px", flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(8,12,18,0.97)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "28px", height: "28px", borderRadius: "7px", background: "linear-gradient(135deg,#3b82f6,#06b6d4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px" }}>📡</div>
          <span style={{ fontSize: "14px", fontWeight: 800, letterSpacing: "-0.5px" }}>PaperPulse</span>
          <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)", fontFamily: "monospace", letterSpacing: "1.5px" }}>RESEARCH INTELLIGENCE</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 7px #22c55e", animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>LIVE · {papers.length} PAPERS</span>
        </div>
      </header>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Sidebar */}
        <div style={{ width: "270px", flexShrink: 0, borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column" }}>
          {/* Filters */}
          <div style={{ padding: "12px", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
            <input
              value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
              placeholder="搜索标题/摘要..."
              style={{ width: "100%", padding: "8px 10px", borderRadius: "7px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)", color: "#fff", fontSize: "12px", outline: "none", marginBottom: "8px" }}
            />
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => { setCategory(c); setPage(0); }} style={{ padding: "3px 9px", borderRadius: "5px", fontSize: "10px", fontWeight: 600, fontFamily: "monospace", background: category === c ? "rgba(96,165,250,0.18)" : "rgba(255,255,255,0.03)", color: category === c ? "#60a5fa" : "rgba(255,255,255,0.3)", border: `1px solid ${category === c ? "rgba(96,165,250,0.35)" : "rgba(255,255,255,0.07)"}`, transition: "all 0.15s" }}>{c}</button>
              ))}
            </div>
          </div>

          {/* Paper list */}
          <div style={{ flex: 1, overflow: "auto", padding: "8px" }}>
            {loading && (
              <div style={{ display: "flex", justifyContent: "center", padding: "30px" }}>
                <Spinner />
              </div>
            )}
            {!loading && papers.length === 0 && (
              <p style={{ textAlign: "center", color: "rgba(255,255,255,0.15)", fontSize: "11px", marginTop: "30px", fontFamily: "monospace" }}>NO PAPERS FOUND</p>
            )}
            {!loading && papers.map(p => {
              const sel = selPaper?.id === p.id;
              const c = jColor(p.journal);
              return (
                <div key={p.id} onClick={() => setSelPaper(p)} style={{ padding: "11px 12px", borderRadius: "9px", cursor: "pointer", marginBottom: "5px", background: sel ? `${c}10` : "rgba(255,255,255,0.02)", border: `1px solid ${sel ? c + "30" : "rgba(255,255,255,0.05)"}`, position: "relative", transition: "all 0.15s" }}>
                  {sel && <div style={{ position: "absolute", left: 0, top: "8px", bottom: "8px", width: "2px", background: c, borderRadius: "0 2px 2px 0" }} />}
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontSize: "9px", fontWeight: 700, color: c, fontFamily: "monospace" }}>{p.journal}</span>
                    <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.18)", fontFamily: "monospace" }}>{p.pub_date?.slice(5) || ""}</span>
                  </div>
                  <p style={{ fontSize: "11px", color: sel ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.6)", lineHeight: 1.5, marginBottom: "4px", fontFamily: "'Crimson Pro',serif", fontWeight: 600 }}>
                    {p.title.length > 90 ? p.title.slice(0, 90) + "…" : p.title}
                  </p>
                  <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>{(p.authors || "").split(",").slice(0, 2).join(",")}</p>
                </div>
              );
            })}

            {/* Pagination */}
            {!loading && papers.length > 0 && (
              <div style={{ display: "flex", gap: "6px", justifyContent: "center", padding: "10px 0" }}>
                <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} style={{ padding: "4px 10px", borderRadius: "5px", fontSize: "10px", background: "rgba(255,255,255,0.05)", color: page === 0 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "monospace" }}>← prev</button>
                <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", fontFamily: "monospace", alignSelf: "center" }}>p.{page + 1}</span>
                <button onClick={() => setPage(page + 1)} disabled={papers.length < PAGE_SIZE} style={{ padding: "4px 10px", borderRadius: "5px", fontSize: "10px", background: "rgba(255,255,255,0.05)", color: papers.length < PAGE_SIZE ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "monospace" }}>next →</button>
              </div>
            )}
          </div>
        </div>

        {/* Main panel */}
        <div style={{ flex: 1, overflow: "auto", minWidth: 0 }}>
          <AIPanel paper={selPaper} />
        </div>
      </div>
    </div>
  );
}
