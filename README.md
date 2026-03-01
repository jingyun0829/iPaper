# 📡 PaperPulse — 搭建指南

每天自动抓取顶刊最新论文 + AI 深度解读。整个系统免费运行。

---

## 架构一览

```
RSS Feeds (Nature/MS/MIS...)
        ↓  每天 8:00 UTC
GitHub Actions → Python 脚本
        ↓
   Supabase (数据库)
        ↓
  React 前端 (Vercel)
        ↓
  Claude API (AI 解读)
```

---

## 第一步：建 Supabase 数据库（5 分钟）

1. 去 [supabase.com](https://supabase.com) 注册，新建 Project
2. 进 **SQL Editor**，粘贴并运行 `scripts/schema.sql` 里的全部内容
3. 去 **Project Settings → API**，记下两个值：
   - `Project URL` → 填入 `.env` 的 `SUPABASE_URL`
   - `anon public` key → 填入 `.env` 的 `VITE_SUPABASE_ANON_KEY`
   - `service_role` key → 填入 `.env` 的 `SUPABASE_KEY`（只给 Python 脚本用，不要放前端！）

---

## 第二步：本地测试抓取脚本（2 分钟）

```bash
# 安装依赖
pip install feedparser supabase python-dotenv

# 复制环境变量文件
cp .env.example .env
# 然后用编辑器把 .env 里的 xxxx 换成你的真实值

# 运行一次
python scripts/fetch_papers.py
```

看到 `✅ Done!` 说明成功了。去 Supabase → Table Editor → papers 确认有数据。

---

## 第三步：上传到 GitHub + 设置自动运行

```bash
# 在 GitHub 新建一个 repo，然后：
git init
git add .
git commit -m "init paper-pulse"
git remote add origin https://github.com/你的用户名/paper-pulse.git
git push -u origin main
```

然后在 GitHub repo 页面：
**Settings → Secrets and variables → Actions → New repository secret**

添加两个 Secret：
- `SUPABASE_URL` = 你的 Supabase URL
- `SUPABASE_KEY` = 你的 service_role key

完成后，`.github/workflows/daily-fetch.yml` 会每天北京时间下午 4 点自动运行。
也可以在 Actions 页面手动点 **Run workflow** 立即触发。

---

## 第四步：部署前端到 Vercel（3 分钟）

```bash
# 安装依赖
npm install

# 本地预览（先确认没问题）
npm run dev
# 浏览器打开 http://localhost:5173

# 部署
npm install -g vercel
vercel
```

Vercel 会问你几个问题，一路回车就行。部署完会给你一个 `paper-pulse-xxx.vercel.app` 链接。

**重要：** 在 Vercel 控制台 → Project → Settings → Environment Variables，添加：
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

然后重新部署一次：`vercel --prod`

---

## 文件结构

```
paper-pulse/
├── src/
│   ├── main.jsx          # React 入口
│   └── App.jsx           # 主应用（前端全部逻辑）
├── scripts/
│   ├── fetch_papers.py   # RSS 抓取脚本
│   └── schema.sql        # 数据库建表 SQL
├── .github/
│   └── workflows/
│       └── daily-fetch.yml  # GitHub Actions 定时任务
├── .env.example          # 环境变量模板
├── package.json
├── vite.config.js
└── index.html
```

---

## 常见问题

**Q: RSS 抓不到摘要怎么办？**  
A: 部分期刊（如 Nature）RSS 只有标题，完整摘要需要 DOI 请求。可以在 `fetch_papers.py` 里加 CrossRef API 请求：
```python
import requests
def fetch_abstract_by_doi(doi):
    r = requests.get(f"https://api.crossref.org/works/{doi}")
    data = r.json()
    return data.get("message", {}).get("abstract", "")
```

**Q: 怎么加新期刊？**  
A: 在 `scripts/fetch_papers.py` 的 `FEEDS` 列表里加一条，找到对应期刊的 RSS URL 即可。

**Q: AI 解读要花多少 API 费用？**  
A: Claude Sonnet 每次解读约 $0.003（不到两分钱），每天看 10 篇约 $0.03。

**Q: 怎么加用户收藏功能？**  
A: Supabase 自带 Auth，参考 `schema.sql` 里的 `saved_papers` 表，前端用 `supabase.auth.signIn()` 接入即可。
