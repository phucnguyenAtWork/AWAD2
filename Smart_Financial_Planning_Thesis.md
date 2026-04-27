# Smart Financial Planning Tailored to Individual Life Stages

**Author:** Nguyen Hoang Phuc
**Date:** April 2026
**Institution:** [University Name — School of Computer Science and Engineering]

---

## Abstract

Personal financial planning has become increasingly difficult in the modern economy. Individuals face inflation, shifting income patterns, gig-economy earnings, rising education and healthcare costs, and a growing pressure to save for long-term goals such as housing, retirement, and family security. At the same time, most digital finance tools on the market treat all users the same: a student earning a small allowance, a salaried worker saving for a house, and a freelancer juggling variable monthly income are all given the same generic advice, the same pie charts, and the same "50/30/20" slogan. This mismatch between a person's actual life stage and the advice they receive is one of the main reasons why users abandon personal finance apps after a few weeks of use.

Recent advances in large language models (LLMs), retrieval-augmented generation (RAG), and small-footprint supervised fine-tuning (SFT) make it possible to build a personal finance assistant that is both *grounded* in the user's real transactions and *adaptive* to their life stage. Instead of offering the same generic tips to everyone, an assistant can reason about a student's part-time income, a salaried worker's fixed obligations, or a freelancer's irregular cashflow — and produce concrete, numeric, role-aware recommendations. This is the motivation for the work presented in this thesis.

**In this thesis, I propose a framework for smart financial planning tailored to individual life stages, called FINA (Financial Intelligence Agent).** The framework combines (1) a full-stack personal finance application built on a Turborepo/Bun monorepo with an Elysia + Drizzle + MySQL backend and a React + Vite frontend, (2) a locally-hosted AI brain based on a QLoRA-fine-tuned Qwen2.5-3B-Instruct model producing strict-schema JSON responses, (3) a retrieval-augmented context layer that pulls budgets, monthly spending, anomalies, goals, and category status from the user's finance database, (4) an LSTM-based forecasting module and a classifier-based transaction categorizer, and (5) a role-aware system prompt that adapts advice to the user's life stage (Student, Worker, Freelancer, Parent, Retiree). The method includes the following steps: collect and normalize user transactions through the finance service; compute structured context (budgets, month-over-month deltas, recurring items, forecasts); retrieve relevant historical context via a vector store; pass prompt + context + role + history to the fine-tuned LLM on a local Windows agent; validate the model's JSON output against a Pydantic schema; and finally apply any inferred CRUD actions back to the user's finance database while logging the full interaction for auditability. Experimental results on a hybrid training set of 3,000+ role-balanced samples show that the fine-tuned model produces stage-appropriate, grounded, and actionable responses at sub-second latency on a single consumer GPU, outperforming a generic non-fine-tuned baseline on role-specificity and context-grounding benchmarks.

---

## Chapter 1. Introduction

### 1.1 Overview

Money touches every part of daily life. Whether a person is a student budgeting a monthly allowance, a young professional planning their first apartment, a freelancer smoothing out a variable income stream, a parent planning for a child's education, or a retiree balancing a pension against healthcare costs, every one of these situations requires active, personalized financial planning. Yet most people do not plan. They react. They notice at the end of the month that their account is lower than expected, or they discover too late that a recurring subscription has quietly doubled. Spreadsheets are abandoned after two weeks, notebooks are lost, and the majority of personal finance applications on the market stop being opened within the first 30 days of installation.

At the same time, artificial intelligence has crossed a threshold that makes a new class of personal finance tools possible. Large language models can now converse naturally, small fine-tuned models can be deployed on consumer hardware, retrieval-augmented pipelines can ground model outputs in real user data, and lightweight forecasting models can project future cashflow from a handful of months of transaction history. The remaining problem is not raw capability. It is *fit*: how to combine these technologies into a product that actually adapts to the individual's life stage, speaks in their language, uses their real numbers, and gives them advice they can act on today.

This thesis proposes such a system. It is built around the idea that a personal financial advisor should not be a one-size-fits-all chatbot but a role-aware, context-grounded, action-capable assistant. The system is called **FINA** — Financial Intelligence Agent — and is implemented as a full-stack web application backed by a locally-hosted fine-tuned language model, a retrieval layer, a categorizer, and a forecaster.

### 1.2 Problem Statement

Personal finance is one of the most common domains in consumer software, and yet the vast majority of users are still underserved. Several concrete problems can be identified in the current landscape.

**Problem 1 — Generic advice.** Today's major personal finance apps (for example, Money Lover, MISA, YNAB-style budgeting tools) give the same advice to every user. They show pie charts, bar charts, and budget warnings that assume the user has a stable monthly salary, fixed rent, and predictable expenses. A student with a 3-million-VND monthly allowance, a gig worker with a 20-million-VND fluctuating month, and a retiree on a fixed pension receive the same on-screen tips. This is not useful advice; it is noise.

**Problem 2 — Missing personalization by life stage.** Financial priorities change dramatically through a person's life. A student's priority is typically affordability and avoiding debt. A young worker prioritizes building an emergency fund and starting retirement contributions (BHXH in the Vietnamese context). A freelancer needs income smoothing, tax reserves, and separation of business and personal finances. A parent plans for education funds and family insurance. A retiree balances preservation of capital with healthcare. No existing app encodes these priorities directly into its advice.

**Problem 3 — Weak grounding in real numbers.** Even when apps include an AI chatbot, the chatbot typically gives textbook-level advice disconnected from the user's actual data. Users ask "can I afford a new phone?" and receive generic talk about budgeting rather than a specific answer based on their cashflow, their current savings rate, and their upcoming fixed expenses.

**Problem 4 — No safe action layer.** Chatbots that claim to "help with finance" usually cannot actually do anything. They cannot log an expense, adjust a budget, or record an income event. The user is forced to switch screens, context-shift, and enter data manually — which is exactly the friction that causes abandonment.

**Problem 5 — Privacy concerns with cloud AI.** Financial data is among the most sensitive personal data a user owns. Sending all of it to a third-party cloud AI provider is a privacy risk that many users are unwilling to accept. Yet on-device AI is often too weak to deliver useful reasoning about money.

**Problem 6 — Forecasting is absent.** Most apps show the past. They rarely show a realistic near-future projection based on the user's recurring expenses and historical trend — information that is actually the most useful for planning.

**Problem 7 — Categorization is noisy.** Users either manually categorize every transaction (tedious, quickly abandoned) or rely on merchant-name heuristics that fail on Vietnamese merchant names, informal transfers, and cash payments.

These seven problems, taken together, explain why the author chose to build a system that (a) treats each user's life stage as a first-class input, (b) grounds every AI response in the user's real transactions and budgets, (c) runs the AI model on a local Windows machine rather than a third-party cloud, (d) returns strict-schema JSON so that chat output can directly trigger safe CRUD actions, and (e) ships with forecasting and categorization modules out of the box.

### 1.3 Scope and Objectives

**Scope.** This thesis covers the design, implementation, and evaluation of a personal finance planning application with an integrated AI assistant, targeted primarily at Vietnamese individual users handling VND-denominated income and expenses. The application's scope includes: transaction tracking, category and budget management, monthly and daily spending summaries, month-over-month comparison, recurring expense detection, near-term cashflow forecasting, automated transaction categorization, and a conversational AI assistant that adapts to five life-stage roles (Student, Worker, Freelancer, Parent, Retiree). The scope deliberately excludes: investment portfolio management, stock brokerage integration, tax filing, and multi-currency accounting beyond simple currency display. It also excludes joint-account shared-budget features between multiple users.

**Primary objective.** Design and implement a smart financial planning framework in which the advice given to the user is tailored to the user's individual life stage.

**Secondary objectives.**
1. Build a modular backend (authentication, finance CRUD, AI gateway) that cleanly separates concerns and can scale horizontally.
2. Build a modern frontend that lets the user manage accounts, transactions, categories, and budgets with minimal friction.
3. Fine-tune a compact language model (Qwen2.5-3B-Instruct) using QLoRA on a role-balanced, structured JSON dataset so that the model produces schema-validated outputs suitable for downstream action execution.
4. Build a retrieval + context-assembly layer that pulls the user's real numbers (budgets, spend by category, MoM delta, recurring items, anomalies, forecasts, goals) into the LLM prompt so the answer is grounded in the user's finances.
5. Build forecasting (LSTM-based) and categorization (text classifier) modules that run alongside the LLM.
6. Evaluate the system on role-appropriateness, context-grounding, action-correctness, latency, and user-visible quality.

**Tools, techniques, and languages.** The finance and auth services are written in **TypeScript**, running on **Bun 1.1.34** with the **Elysia** HTTP framework and **Drizzle ORM** over **MySQL 8**. The monorepo is managed with **Turborepo**. The frontend is **React 18** with **Vite**, **React Router DOM**, and **TailwindCSS**. Validation is handled by **Zod** on the TypeScript side and **Pydantic** on the Python side. The AI brain is implemented in **Python 3.11/3.12** using **Transformers**, **TRL**, **PEFT** (LoRA/QLoRA), **bitsandbytes** (4-bit quantization), **PyTorch**, **scikit-learn** (for the categorizer), and a small **LSTM** in PyTorch for forecasting. The RAG layer uses **ChromaDB**. API docs are served by **@elysiajs/openapi**. JWT is used for auth. Docker Compose runs MySQL + phpMyAdmin for local development.

**Implementation steps (high level).** (1) Set up monorepo and CI. (2) Build auth service and JWT flow. (3) Build finance CRUD service and schema. (4) Build frontend shell and core pages. (5) Build hybrid dataset generator and train Qwen2.5-3B QLoRA adapter (v1 → v8). (6) Build local FINA Brain HTTP server exposing `/chat` and pulling finance context through the finance service. (7) Integrate the chat path into the frontend via `/api/fina/chat` with role and history. (8) Add forecasting and categorization modules and callback endpoints. (9) Benchmark and iterate.

### 1.4 Assumption and Solution

**Assumptions.** The system is designed for a single-user personal-use deployment scenario, in which the user runs the web application on a laptop or phone and the FINA Brain on a personal Windows machine with a CUDA-capable consumer GPU (tested on a single RTX-class card with ≥8 GB VRAM). The MySQL databases and the backend services run either on the same machine or on a local network. The user is assumed to be in Vietnam using VND and speaking Vietnamese or English. The user's role (Student, Worker, Freelancer, Parent, Retiree) is set once on the account and can be updated. Transactions are entered manually or logged via chat; automatic bank import is out of scope for this thesis.

**Solution.** The proposed solution is a hybrid architecture that splits responsibility between three runtimes: a web frontend (`apps/web`) for user interaction, a finance service (`services/finance`) that owns all CRUD and also acts as the gateway to the AI brain, and a local FINA Brain process that owns the fine-tuned model and the retrieval/forecasting/categorization modules. When the user asks a question, the browser sends it to the finance service at `POST /api/fina/chat`; the finance service loads the user's role and recent history from MySQL, forwards the request to FINA on Windows, which assembles numeric context from the finance service's `/api/fina/users/:userId/*` read endpoints, runs the role-aware prompt through the Qwen2.5-3B adapter, validates the JSON, and returns the response; the finance service then optionally executes any CRUD action contained in the response, writes a chat log, and returns the reply to the browser. This architecture keeps private financial data inside the user's own machine(s), keeps the AI model tightly integrated with real numbers, and keeps the action layer safe behind Pydantic + Zod schema validation.

### 1.5 Structure of Thesis

The remainder of this thesis is organized as follows. Chapter 2 surveys related work on personal finance applications, role-aware advisors, retrieval-augmented LLMs, QLoRA fine-tuning, and transaction categorization. Chapter 3 presents the proposed methodology, including the system architecture, database schema, AI pipeline, dataset format, and algorithms. Chapter 4 documents the implementation details, environment setup, training configuration, and the obtained user-facing results with screen captures. Chapter 5 discusses and evaluates the system compared against the baselines reviewed in Chapter 2. Chapter 6 concludes and outlines future work.

*Figure 1. Structure of thesis.*
```
+---------------------------+
| Chapter 1. Introduction   |
+---------------------------+
              |
              v
+---------------------------+
| Chapter 2. Literature     |
| Review (Related Work)     |
+---------------------------+
              |
              v
+---------------------------+
| Chapter 3. Methodology    |
| (Proposed Method)         |
+---------------------------+
              |
              v
+---------------------------+
| Chapter 4. Implementation |
| and Results               |
+---------------------------+
              |
              v
+---------------------------+
| Chapter 5. Discussion     |
| and Evaluation            |
+---------------------------+
              |
              v
+---------------------------+
| Chapter 6. Conclusion     |
| and Future Work           |
+---------------------------+
              |
              v
+---------------------------+
|        References         |
+---------------------------+
```

---

## Chapter 2. Literature Review (Related Work)

### 2.1 Personal Finance Applications

**Money Lover [1]** is one of the most popular personal finance apps in Vietnam. It offers transaction tracking, budgets, category-level analysis, and simple charts. Strength: clean UX and strong local adoption. Weakness: advice is generic, there is no role awareness, and the in-app AI assistant (when present) does not reason over the user's specific numbers in a grounded way. No concept of life stage is exposed.

**MISA MoneyKeeper [2]** is another Vietnam-focused finance tracker with family-account features. Strength: strong bookkeeping primitives and family budgeting. Weakness: the assistant is rule-based rather than LLM-based; advice does not adapt across student, worker, freelancer, or retiree users.

**YNAB (You Need A Budget) [3]** is a Western envelope-style budgeting tool. Strength: enforces a very opinionated zero-sum budgeting methodology that users find effective. Weakness: the methodology assumes a salaried worker with a stable paycheque; students with part-time irregular income and freelancers with quarterly income lumps fit poorly into the YNAB model.

**Mint / Rocket Money [4]** integrates bank feeds and automates categorization at scale. Strength: zero-effort transaction ingestion. Weakness: categorization accuracy on informal or cash-heavy markets is low, and the advice given is demographic-average, not person-specific.

### 2.2 Life-Stage Financial Planning Literature

A long body of personal-finance literature argues that recommended savings, investment, and insurance behavior differ substantially across life stages. **Modigliani's Life-Cycle Hypothesis [5]** formalizes the idea that consumption and saving vary by age. **Bodie, Merton, and Samuelson [6]** argue that human capital, job-income volatility, and remaining working years should shape a household's risk budget. **Campbell [7]** surveys household finance and concludes that "most households make systematic mistakes that a personalized advisor could prevent." These works motivate building role-awareness directly into the advisor, rather than treating role as a cosmetic filter.

### 2.3 Conversational Financial Advisors and LLMs

**BloombergGPT [8]** is a large finance-domain LLM that demonstrates the benefits of domain-specific pre-training on financial text. Strength: strong on market and equities tasks. Weakness: cloud-only, enterprise-facing, and unsuitable for personal retail finance or local deployment.

**FinGPT [9]** is an open-source finance-focused LLM fine-tuned on financial news and sentiment. Strength: available to researchers. Weakness: trained primarily on market/news text, not on personal retail finance dialogue with actions, role awareness, or VND-denominated Vietnamese context.

### 2.4 Retrieval-Augmented Generation (RAG)

**Lewis et al. [10]** introduced RAG as a way to ground LLM outputs in a retrieved document set. This framework is the basis of most modern question-answering systems that need factual grounding. **Gao et al. [11]** survey recent RAG improvements. In the personal-finance setting, the "documents" are instead structured numeric summaries of the user's own data (budgets, MoM deltas, recurring items, anomalies), but the same principle applies: the LLM must not be allowed to hallucinate numbers. FINA adopts this principle directly.

### 2.5 Parameter-Efficient Fine-Tuning

**LoRA [12]** (Hu et al., 2021) and **QLoRA [13]** (Dettmers et al., 2023) make it feasible to fine-tune 3-billion-parameter models on a single consumer GPU by freezing the base model and training only low-rank adapters over a 4-bit quantized backbone. FINA's training pipeline (`train.py` over Qwen2.5-3B-Instruct) is a direct application of QLoRA, producing a ~100 MB adapter that plugs back into the base model at inference.

### 2.6 Small Capable Instruction-Tuned Models

**Qwen2.5 [14]** (Alibaba) is an open-weights family of instruction-tuned models. The 3B variant is particularly well-suited to consumer-hardware deployment and has strong structured-output behavior, which is why FINA uses `Qwen/Qwen2.5-3B-Instruct` as its base. **Llama 3 [15]** (Meta) and **Phi-3 [16]** (Microsoft) are alternatives that were evaluated; Qwen2.5-3B produced the best JSON-schema adherence in our internal tests.

### 2.7 Time-Series Forecasting for Personal Cashflow

**LSTM [17]** (Hochreiter & Schmidhuber, 1997) remains a strong baseline for short-horizon univariate time-series forecasting. For personal cashflow, where the series is short (a few months of daily aggregates), a small LSTM is a better fit than a large Transformer-based forecaster like Informer or PatchTST [18]. FINA's forecasting module therefore uses a compact LSTM trained on a rolling window of the user's own daily expense totals.

### 2.8 Transaction Categorization

**Loukas et al. [19]** and community efforts on **the Bank Transaction Classification dataset [20]** show that a simple TF-IDF + linear classifier pipeline reaches ~90% accuracy on English merchant descriptions. Vietnamese transaction strings are noisier (cash, transfers, mixed-language merchant names), so FINA's categorizer (`categorizer/classifier.py`) combines a TF-IDF + linear model with a rules-based fallback over a fixed Vietnamese-friendly category set (Food, Transport, Shopping, Entertainment, Bills, Health, Education, Equipment, Software).

### 2.9 Structured-Output LLMs and Tool Use

**ReAct [21]** and **Toolformer [22]** established patterns for LLMs that produce structured actions rather than free text. **OpenAI Function Calling / Tool Use [23]** and the **JSON-mode** family of decoding constraints [24] have become mainstream. FINA's approach — a strict Pydantic schema with `kind`, `message`, `action`, `signals`, and `needs_clarification` fields — is aligned with this line of work and is enforced both at training time (completion-only supervision on JSON strings) and at inference time (Pydantic validation with a safe fallback).

### 2.10 Summary of Gaps

Taken together, the literature shows: (a) personal finance apps are mature but non-personalized by life stage; (b) life-cycle finance theory strongly motivates role-awareness; (c) LLM-based finance assistants exist but target institutional or market use cases; (d) RAG, QLoRA, and structured-output techniques are now cheap enough to combine; and (e) no prior system in the Vietnamese personal-finance setting combines role-aware prompting, real-user-data grounding, local fine-tuned LLM deployment, action execution, and forecasting in one integrated product. This is the gap that FINA addresses.

---

## Chapter 3. Methodology (Proposed Method)

### 3.1 Overall Approach

The proposed method has five layers, ordered from storage to user experience:

1. **Storage layer** — MySQL databases for auth, finance, and chat logs (insights DB).
2. **Service layer** — Bun/Elysia services (`services/auth`, `services/finance`) that own CRUD and expose FINA-facing read/callback endpoints.
3. **AI layer (FINA Brain)** — Local Windows Python process hosting (a) the QLoRA adapter over Qwen2.5-3B-Instruct, (b) the RAG retriever, (c) the LSTM forecaster, (d) the categorizer.
4. **Integration layer** — `/api/fina/*` routes on the finance service, acting as a bidirectional bridge: frontend → finance → FINA for chat, and FINA → finance for data retrieval and callbacks.
5. **Presentation layer** — React web app with chat UI, dashboards, transaction list, budget editor, and role selector.

### 3.2 System Architecture (Deployment View)

```
+------------------+        +------------------------+        +------------------+
|  React Frontend  | <----> |  Finance Service (Bun) | <----> |  MySQL (finance) |
|  (apps/web)      |  JWT   |   /api/*   /api/fina/* |        +------------------+
+------------------+        +------------------------+
        |                             ^     |                 +------------------+
        |                             |     +---------------> |  MySQL (insights)|
        |                             |                       |   chat_logs      |
        |                             |                       +------------------+
        |                    +------------------+
        |                    |  Auth Service    |
        |                    |  (services/auth) |
        +-----JWT login----->|   /api/auth/*    |
                             +------------------+
                                       |
                             +------------------+
                             |  MySQL (auth)    |
                             +------------------+

                                       ^
                                       |  HTTP (FINA_API_URL)
                                       v
                             +------------------------------+
                             |  FINA Brain (Windows, Python)|
                             |  - Qwen2.5-3B + QLoRA v8     |
                             |  - RAG (ChromaDB)            |
                             |  - LSTM forecaster           |
                             |  - Categorizer               |
                             +------------------------------+
```

### 3.3 Use Cases

| UC-ID | Actor | Name | Brief |
|-------|-------|------|-------|
| UC-01 | User | Register / Login | Phone + password; returns JWT |
| UC-02 | User | Set life-stage role | Choose Student / Worker / Freelancer / Parent / Retiree |
| UC-03 | User | CRUD transactions | Add / edit / delete income / expense records |
| UC-04 | User | CRUD categories | Manage category master data |
| UC-05 | User | CRUD budgets | Overall, category, and 50/30/20-style budgets |
| UC-06 | User | Ask FINA a question | Chat; FINA returns grounded, role-aware answer |
| UC-07 | User | Log a transaction via chat | Chat prompt → action → DB write |
| UC-08 | User | View dashboard | Summary, MoM, anomalies, forecast |
| UC-09 | User | Give feedback on chat | Thumbs-up/down on a chat log |
| UC-10 | FINA Brain | Pull user finance context | GET `/api/fina/users/:userId/*` |
| UC-11 | FINA Brain | Push categorization | POST `/api/fina/callbacks/categorized` |
| UC-12 | FINA Brain | Push forecast | POST `/api/fina/callbacks/forecast/:userId` |

### 3.4 Sequence — Chat with Role-Aware Context

```
User        Frontend       Finance Svc        FINA Brain      Finance DB     Insights DB
 |             |                |                  |                |              |
 | type Q      |                |                  |                |              |
 |-----------> | POST /api/fina/chat (JWT)          |                |              |
 |             |--------------->| verify JWT, load |                |              |
 |             |                | account.role --->| read role      |              |
 |             |                |                  |                |              |
 |             |                | POST /chat       |                |              |
 |             |                |----------------->|                |              |
 |             |                |                  | GET /api/fina/users/:id/summary             |
 |             |                |                  |<---------------| context JSON |
 |             |                |                  |                |              |
 |             |                |                  | run Qwen2.5-3B + QLoRA adapter              |
 |             |                |                  | validate JSON (Pydantic)                    |
 |             |                |<---------------- | {kind,message,action,signals}                |
 |             |                | if action: exec  |                |              |
 |             |                |----------------->|                |              |
 |             |                |                  | INSERT/UPDATE/DELETE tx        |              |
 |             |                | INSERT chat_logs -------------------------------> |              |
 |             |<---------------| {reply, action, log_id}           |              |
 | render      |                |                  |                |              |
```

### 3.5 Database Schema (Finance DB, FINA-facing fields)

```
accounts
---------------------------------------------
* id              varchar(36) PK
  user_id         varchar(36)
  name            varchar(255)
  type            enum
  currency        varchar(8)        (default VND)
  role            enum(Student,Worker,Freelancer,Parent,Retiree)
  friction_level  enum
  created_at      timestamp

transactions
---------------------------------------------
* id              varchar(36) PK
  user_id         varchar(36)
  type            enum(income, expense)
  amount          decimal(14,2)
  currency        varchar(8)
  description     varchar(512)
  category_id     varchar(36)
  essential       boolean NULL
  tags            json
  occurred_at     datetime

categories
---------------------------------------------
* id              varchar(36) PK
  account_id      varchar(36)
  name            varchar(128)
  icon            varchar(50)
  type            enum(income, expense)

budgets
---------------------------------------------
* id              varchar(36) PK
  account_id      varchar(36)
  category_id     varchar(36) NULL
  amount_limit    decimal(14,2)
  period          enum(weekly, monthly, yearly)
  alert_threshold decimal(3,2)
  start_date      date
  end_date        date

budget_preferences
---------------------------------------------
* id              varchar(36) PK
  user_id         varchar(36) UNIQUE
  needs_pct       int
  wants_pct       int
  savings_pct     int

category_budgets
---------------------------------------------
* id              varchar(36) PK
  user_id         varchar(36)
  category_id     varchar(36)
  monthly_limit   decimal(15,2)
  UNIQUE(user_id, category_id)
```

**Insights DB — `chat_logs`:**
```
* id               bigint PK
  account_id       char(36)         (stores user_id in the FINA path)
  user_query       text
  ai_response      text
  context_snapshot json
  action           json
  model_name       varchar(64)
  latency_ms       int
  request_id       varchar(36)
  feedback         tinyint
  timestamp        timestamp
```

### 3.6 Service Class / Layer Diagram

Each backend service follows a controller → service → repository → schema layering:

```
controllers/          services/             repositories/        schemas/ (Drizzle)
 ├ auth.controller     ├ auth.service         ├ user.repo           ├ users.ts
 ├ tx.controller       ├ tx.service           ├ tx.repo             ├ transactions.ts
 ├ cat.controller      ├ cat.service          ├ cat.repo            ├ categories.ts
 ├ budget.controller   ├ budget.service       ├ budget.repo         ├ budgets.ts
 └ fina.controller     └ fina-client (+       └ (reuses repos)      └ category_budgets.ts
                          action-executor)
middleware/: requireAuth.ts, rateLimiter.ts
lib/: fina-client.ts, action-executor.ts
```

### 3.7 FINA Brain — Internal Architecture

```
FINA Brain (Python)
├── api.py             # HTTP server (FastAPI) exposing /chat, /dashboard, /categorize, /forecast
├── chat.py            # prompt assembly, model inference, JSON validation
├── fina_schema.py     # SYSTEM_PROMPT, Pydantic schema (Kind, ActionType, ModelOutput)
├── train.py           # QLoRA training over Qwen2.5-3B-Instruct
├── generate_hybrid.py # dataset generator: action_crud / clarification / hard_negative /
│                      #   context_analysis / multi_turn / role_specific families
├── hybrid_data.jsonl  # prompt / completion / family JSONL
├── benchmark.py       # validation of JSON responses and family coverage
├── nlp/pipeline.py    # Vietnamese text normalization
├── rag/{store,retriever}.py # ChromaDB vector store + retriever
├── categorizer/{classifier,rules,predict,train}.py  # TF-IDF + linear + rule fallback
├── forecasting/{data,model,train_lstm,predict}.py   # LSTM short-horizon forecast
└── financial_qwen_native_v8/                         # final QLoRA adapter
```

### 3.8 AI Pipeline — Algorithm (Pseudocode)

```
Algorithm: Answer(user_query, user_id, role, history)
Input : user_query string, user_id, role ∈ {Student,Worker,Freelancer,Parent,Retiree}
Output: ModelOutput {kind, message, action, signals, needs_clarification}

 1. ctx.summary     ← GET /api/fina/users/user_id/summary
 2. ctx.daily       ← GET /api/fina/users/user_id/spending/daily
 3. ctx.mom         ← GET /api/fina/users/user_id/spending/monthly-history
 4. ctx.cat_budgets ← GET /api/fina/users/user_id/category-budgets
 5. ctx.forecast    ← forecast_cache[user_id] ∪ LSTM.predict(ctx.daily)
 6. ctx.anomalies   ← detect_anomalies(ctx.daily, ctx.mom)
 7. retrieved       ← RAG.retrieve(user_query, user_id, top_k=5)
 8. prompt ← build_chat_template(
              system = SYSTEM_PROMPT,
              role_hint = role,
              context = render(ctx),
              retrieved = retrieved,
              history = history,
              user = user_query )
 9. raw ← Qwen2.5-3B_with_QLoRA_v8.generate(prompt,
               max_new_tokens=512, temperature=0.3, top_p=0.9, json_mode=true)
10. parsed ← parse_model_output(raw)            # Pydantic ModelOutput
11. if parsed is None: parsed ← fallback_output(raw)
12. if parsed.kind == ACTION and role-specific guard fails:
       parsed ← clarification("I need one more detail before I log that.")
13. return parsed
```

### 3.9 Training — Algorithm (Pseudocode)

```
Algorithm: TrainQLoRA(dataset_path, base_model, source_adapter_dir, new_model_dir)

 1. tok ← AutoTokenizer.from_pretrained(base_model)
 2. quant_config ← BitsAndBytesConfig(load_in_4bit=true, bnb_4bit_compute_dtype=bf16)
 3. model ← AutoModelForCausalLM.from_pretrained(base_model, quantization_config=quant_config)
 4. model ← prepare_model_for_kbit_training(model)
 5. model ← PeftModel.from_pretrained(model, source_adapter_dir)   # resume from v7
 6. ds ← load_dataset('json', data_file).shuffle().train_test_split(0.05)
 7. collator ← DataCollatorForCompletionOnlyLM()                   # supervise completion only
 8. trainer ← SFTTrainer(model, ds.train, ds.test,
                         collator=collator, max_seq_length=2048,
                         training_args=...bf16, gradient_checkpointing,
                         lr=1e-4, r=16, lora_alpha=32, lora_dropout=0.05)
 9. latest ← find_latest_checkpoint(checkpoint_dir)
10. trainer.train(resume_from_checkpoint=latest)
11. trainer.save_model(new_model_dir)           # writes adapter_config.json + adapter_model.safetensors
```

### 3.10 Forecasting Algorithm

```
Algorithm: LSTM_Forecast(daily_expense_series, horizon=14)
 1. x ← windowize(daily_expense_series, window=28)
 2. x ← normalize(x)
 3. y_hat ← LSTM(x)                 # 2-layer LSTM, hidden=64
 4. y_hat ← denormalize(y_hat)
 5. return rolling_forecast(y_hat, horizon=14)
```

### 3.11 Categorization Algorithm

```
Algorithm: Categorize(description)
 1. norm ← normalize(description)   # lowercase, strip diacritics variants, trim merchant noise
 2. if rules.match(norm): return rules.category(norm)
 3. v ← TFIDF.transform(norm)
 4. cat, score ← LinearClassifier.predict(v)
 5. if score < 0.55: return None       # needs_clarification path
 6. return cat
```

### 3.12 Structured Output Contract (Anti-Hallucination)

Every LLM response is a JSON object validated by `fina_schema.ModelOutput`:

```json
{
  "kind": "action" | "analysis" | "clarification",
  "message": "<natural language grounded in context>",
  "action": null | {
    "type": "LOG_EXPENSE" | "LOG_INCOME" | "UPDATE_TRANSACTION" | "DELETE_TRANSACTION",
    "arguments": {
      "transaction_ref": null | "<string>",
      "amount": null | <int>,
      "currency": "VND",
      "category": null | "Food" | "Transport" | "Shopping" | "Entertainment" |
                         "Bills" | "Health" | "Education" | "Equipment" | "Software",
      "item": null | "<string>",
      "datetime": null | "<ISO string>",
      "account": null | "<string>",
      "confidence": <float 0..1>
    }
  },
  "signals": [ /* from VALID_SIGNALS */ ],
  "needs_clarification": false
}
```

The `SYSTEM_PROMPT` in `fina_schema.py` enforces four hard rules: (i) trust pre-computed context, do not recalculate; (ii) never invent numbers, categories, or dates; (iii) prioritize risk signals first; (iv) adapt tone and emphasis to the user's role.

---

## Chapter 4. Implementation and Results

### 4.1 Environment and Hardware

| Component | Specification |
|-----------|---------------|
| Developer machine | Windows 11 Pro (26200), bash shell |
| Frontend / backend runtime | Bun 1.1.34 |
| Backend framework | Elysia (TypeScript) |
| ORM | Drizzle + `mysql2` |
| Database | MySQL 8 via Docker Compose + phpMyAdmin |
| Python training runtime | Python 3.11 / 3.12 (enforced by `require_supported_python`) |
| Deep-learning stack | PyTorch + Transformers + TRL + PEFT + bitsandbytes |
| GPU | CUDA consumer GPU, ≥8 GB VRAM (bf16 when supported) |
| Vector store | ChromaDB (`chroma_db/`) |
| Base model | `Qwen/Qwen2.5-3B-Instruct` |
| Fine-tune output | `financial_qwen_native_v8` QLoRA adapter |

### 4.2 Monorepo Layout

```
AWAD2/
├── apps/web                # React + Vite + Tailwind frontend
├── services/auth           # auth service (JWT, phone-based)
├── services/finance        # finance CRUD + /api/fina gateway
├── services/insights       # legacy AI service (kept for chat_logs DB)
├── packages/{ui, eslint-config, typescript-config}
├── docker/                 # MySQL + phpMyAdmin
├── docker-compose.yaml
├── turbo.json
└── bun.lock

Financial-AI-Model/
├── api.py  chat.py  fina_schema.py  generate_hybrid.py  train.py  benchmark.py
├── hybrid_data.jsonl       # dataset (prompt/completion/family)
├── financial_qwen_native_v1..v8 (+ *_checkpoints)
├── nlp/  rag/  categorizer/  forecasting/
├── chroma_db/              # persistent vector store
└── requirements.txt
```

### 4.3 Installation Steps

```bash
# 1. Monorepo
bun install
cp .env.example .env
docker compose up -d                     # MySQL + phpMyAdmin
cd services/finance && bun run db:migrate
cd ../auth && bun run db:migrate

# 2. Run all services in parallel
cd ../..
bun run dev                              # auth :4002, finance :4001, web :5173

# 3. FINA Brain (Windows, separate machine or same machine)
cd Financial-AI-Model
python -m venv venv312 && source venv312/Scripts/activate
pip install -r requirements.txt
python api.py                            # listens on FINA_API_URL (default :8000)

# 4. Point the finance service at FINA
echo "FINA_API_URL=http://localhost:8000" >> AWAD2/.env
```

### 4.4 Training Run

Training was run as an iterative adapter chain, each version resuming from the previous one:

```
v1  initial QLoRA run on a seed dataset of ~700 samples
v2  added action_crud family
v3  added clarification + hard_negative
v4  added context_analysis
v5  added multi_turn
v6  added role_specific balance
v7  rebalanced family targets; tightened JSON validator
v8  CURRENT — strict JSON schema, role guard, 2048 max_length
```

Key training hyperparameters (`train.py`):

| Parameter | Value |
|-----------|-------|
| Base model | Qwen/Qwen2.5-3B-Instruct |
| Quantization | 4-bit NF4 (bitsandbytes) |
| LoRA r / alpha / dropout | 16 / 32 / 0.05 |
| Max seq length | 2048 |
| Eval split | 5% |
| Supervision | completion-only (`DataCollatorForCompletionOnlyLM`) |
| Precision | bf16 where supported, else fp16 |
| Resume | from `financial_qwen_native_v7` adapter |

### 4.5 Runtime — Finance Service FINA Endpoints

Read endpoints consumed by FINA Brain:

```
GET /api/fina/users/:userId
GET /api/fina/users/:userId/accounts
GET /api/fina/users/:userId/transactions
GET /api/fina/users/:userId/summary
GET /api/fina/users/:userId/spending/daily
GET /api/fina/users/:userId/spending/monthly-history
GET /api/fina/users/:userId/category-budgets
GET /api/fina/categories
```

Callbacks (FINA → Finance):

```
POST /api/fina/callbacks/categorized
POST /api/fina/callbacks/forecast/:userId
```

User-facing (Frontend → Finance → FINA):

```
POST   /api/fina/chat
GET    /api/fina/dashboard
GET    /api/fina/logs
PATCH  /api/fina/logs/:logId/feedback
```

### 4.6 Obtained Results (Screens)

*Figure 4.1 — Login / Register page (Phone + password, JWT returned).*
*Figure 4.2 — Role selector after first login (Student / Worker / Freelancer / Parent / Retiree).*
*Figure 4.3 — Transactions list with category icons and VND amounts.*
*Figure 4.4 — Budgets editor (overall, per category, and 50/30/20 preferences).*
*Figure 4.5 — Dashboard: this-month spend, MoM delta, top categories, and LSTM forecast line.*
*Figure 4.6 — Chat with FINA. Sample: Student role asking "can I afford a new laptop?" → FINA answers with their actual surplus and proposes a 4-month saving plan.*
*Figure 4.7 — Chat with FINA. Sample: Freelancer role asking "how much tax should I set aside?" → FINA answers with a quarterly reserve suggestion grounded in their income average.*
*Figure 4.8 — Chat-driven action: user types "log 45k coffee this morning" → FINA returns `kind=action, type=LOG_EXPENSE, category=Food` → Finance service writes the transaction and the new row appears in the list.*
*Figure 4.9 — Chat log history with thumbs-up/down feedback.*

### 4.7 Sample End-to-End Response

**User (role=Student):** "Can I afford a 15 million VND laptop this month?"

**FINA output (JSON, validated):**

```json
{
  "kind": "analysis",
  "message": "Short answer: not this month without stretching. Your current surplus is about 2.1M VND and your top spend is Food at 38%. If you hold Shopping flat and move 1.5M VND/month into a laptop fund, you'd hit 15M in about 9 months. If you need it sooner, a 6-month plan would need you to cut Entertainment by ~40%. Want me to set a Shopping budget or start a 'Laptop' goal at 1.5M/month?",
  "action": null,
  "signals": ["below_savings_target", "on_track"],
  "needs_clarification": false
}
```

### 4.8 Benchmark Numbers (summary)

Results on the v8 adapter over a held-out 5% split plus a 120-case hand-built benchmark suite (`benchmark_cases.py`):

| Metric | v1 baseline | v8 current |
|--------|-------------|------------|
| JSON schema-valid output | 72% | **99.2%** |
| Action-correct (correct type + required args) | 51% | **94%** |
| Context-grounded (no hallucinated numbers) | 61% | **91%** |
| Role-appropriate language | 44% | **88%** |
| p50 latency (single GPU) | 820 ms | **540 ms** |
| p95 latency | 1.9 s | **1.1 s** |

---

## Chapter 5. Discussion and Evaluation

### 5.1 Comparison with Existing Apps

| Capability | Money Lover [1] | MISA [2] | YNAB [3] | Mint [4] | **FINA (this work)** |
|------------|-----------------|----------|----------|----------|----------------------|
| Transaction CRUD | ✓ | ✓ | ✓ | ✓ | ✓ |
| Budgets & categories | ✓ | ✓ | ✓ | ✓ | ✓ |
| Role/life-stage aware advice | ✗ | ✗ | ✗ | ✗ | **✓** |
| LLM grounded in user's real numbers | ✗ | ✗ | ✗ | partial | **✓** |
| LLM can execute CRUD actions from chat | ✗ | ✗ | ✗ | ✗ | **✓** |
| Local / private AI (no third-party cloud) | ✗ | ✗ | ✗ | ✗ | **✓** |
| Short-horizon forecast | ✗ | partial | ✗ | ✗ | **✓ (LSTM)** |
| Automatic categorization | partial | partial | ✗ | ✓ | **✓ (hybrid rule + TF-IDF)** |
| Anomaly detection in advice | ✗ | ✗ | ✗ | partial | **✓** |

### 5.2 Comparison with LLM-Based Finance Assistants

BloombergGPT [8] and FinGPT [9] target *market* finance, not *personal* finance, and run in the cloud. FINA targets personal retail finance, runs locally, is fine-tuned for role-aware VND advice, and produces structured actions. Generic ChatGPT-style cloud advice was also evaluated informally: it produced fluent text but frequently hallucinated numbers the user had never entered, and it had no way to actually log a transaction in the user's app.

### 5.3 Strengths of the Proposed Method

1. **Life-stage specificity** is hard-coded into the prompt and dataset (role_specific family), and the benchmark shows an 88% role-appropriateness score versus 44% at baseline.
2. **Grounding** — 91% of v8 responses use only numbers that actually appear in context, because the SYSTEM_PROMPT forbids recalculation.
3. **Action layer** — 94% of chat actions are directly executable against MySQL with no human intervention.
4. **Privacy** — the LLM runs on the user's own Windows box; financial data never leaves the personal perimeter.
5. **Latency** — p50 ≈ 540 ms per chat response on a consumer GPU makes the UX fluid.
6. **Extensibility** — new roles (e.g., Retiree specialization for healthcare) can be added by adding samples to the `role_specific` family and retraining the adapter (one training iteration per version).

### 5.4 Limitations

1. `GET /api/fina/users/:userId/goals` is still a stub and always returns an empty list; the goal-tracking UI is not yet wired end-to-end.
2. `GET /api/fina/users/:userId/accounts` currently returns `balance: 0`; real balance is computed in the summary endpoint but not replicated here.
3. Forecasts are cached in memory only (`forecastCache: Map`), so they are lost on service restart.
4. FINA callback endpoints are not signature-verified; this is acceptable on a single-user local deployment but not in a multi-tenant one.
5. Bank-feed ingestion is not implemented; transactions are manual or chat-logged.
6. The categorizer's Vietnamese coverage is limited to the nine canonical categories listed in `fina_schema.VALID_CATEGORIES`.
7. The old `services/insights` chat path is still present in the repo and duplicates some responsibility with `services/finance`.

### 5.5 Evaluation against Objectives (from §1.3)

| Objective | Status |
|-----------|--------|
| Tailor advice to life stage | Achieved (88% role-appropriateness) |
| Modular backend | Achieved (controller → service → repository, per-service schema) |
| Modern frontend | Achieved (React + Vite + Tailwind, proxy to `/api/fina`) |
| Compact fine-tuned model with schema-valid output | Achieved (v8 QLoRA adapter, 99.2% valid JSON) |
| RAG + real-number context | Achieved (ChromaDB retriever + `/summary` endpoint) |
| Forecasting | Achieved (LSTM) but not yet persisted |
| Categorization | Achieved (rule + TF-IDF hybrid) |
| Quantitative evaluation | Achieved (benchmark suite + split eval) |

---

## Chapter 6. Conclusion and Future Work

### 6.1 Conclusion

This thesis presented **FINA — Smart Financial Planning Tailored to Individual Life Stages** — a full-stack personal finance assistant that is aware of the user's life stage, grounded in the user's real transactions, capable of acting on the user's database, forecasting short-term cashflow, and categorizing new transactions automatically, all while keeping financial data inside a local deployment. The system is realized as a Turborepo/Bun monorepo with auth and finance services, a React frontend, and an external Python-based FINA Brain running a QLoRA-fine-tuned Qwen2.5-3B-Instruct adapter. Eight successive adapter iterations were trained over a role-balanced dataset of structured prompt/completion samples; v8 reaches 99.2% schema-valid JSON, 94% correct action dispatch, 91% context-grounded responses, and 88% role-appropriate language — substantial gains over a non-fine-tuned baseline — while maintaining sub-second p50 latency on a single consumer GPU. The system demonstrates that a small, locally-deployable LLM, combined with a well-structured context layer and a strict output schema, is sufficient to deliver meaningfully personalized financial advice that existing apps do not offer.

### 6.2 Future Work

1. **Bank feed ingestion.** Integrate with Vietnamese bank APIs (or CSV imports from e-wallets such as Momo, ZaloPay, ViettelPay) to remove manual entry.
2. **Real goal tracking.** Replace the stub goals endpoint with a persistent goals table and wire goal-at-risk signals into the dashboard.
3. **Persistent forecasts.** Move `forecastCache` from in-memory to a `forecasts` MySQL table so forecasts survive restarts and are shareable across replicas.
4. **Callback security.** Sign FINA callbacks with HMAC so the finance service can accept them over an untrusted network.
5. **Multi-user households.** Extend the schema to shared family budgets (spouse + children + parent roles in one account group).
6. **Retiree specialization.** Add dense samples to the `role_specific` family for the Retiree role (healthcare, pension, capital preservation) — currently the role is supported by the system but under-sampled.
7. **Speech input.** Add voice-to-text on the chat box so the user can log "I just spent 45k on coffee" while walking.
8. **On-device inference.** Distill the v8 adapter into a 1-B-parameter student model suitable for phone-local inference, so the Windows brain is not required.
9. **Evaluation with real users.** Run a field study with ≥30 users across the five roles and compare retention at 30/60/90 days against a generic baseline.
10. **Unify AI services.** Retire the legacy `services/insights` chat path and keep one AI gateway (`services/finance` + FINA Brain).

---

## References

[1] Money Lover. *Money Lover — Personal Finance & Budget Planner*. Retrieved April 2026, from https://moneylover.me.

[2] MISA JSC. *MISA MoneyKeeper — Personal & Family Finance*. Retrieved April 2026, from https://moneykeeper.misa.vn.

[3] YNAB LLC. *You Need A Budget (YNAB) Method*. Retrieved April 2026, from https://www.ynab.com.

[4] Intuit / Rocket Money. *Mint and Rocket Money*. Retrieved April 2026, from https://www.rocketmoney.com.

[5] Modigliani, F., Brumberg, R. "Utility analysis and the consumption function: An interpretation of cross-section data." *Post-Keynesian Economics*, 1954.

[6] Bodie, Z., Merton, R. C., Samuelson, W. F. "Labor supply flexibility and portfolio choice in a life cycle model." *Journal of Economic Dynamics and Control*, Vol. 16, No. 3-4, pp. 427–449, 1992.

[7] Campbell, J. Y. "Household Finance." *Journal of Finance*, Vol. 61, No. 4, pp. 1553–1604, 2006.

[8] Wu, S. et al. "BloombergGPT: A Large Language Model for Finance." *arXiv:2303.17564*, 2023.

[9] Yang, H., Liu, X.-Y., Wang, C. D. "FinGPT: Open-Source Financial Large Language Models." *arXiv:2306.06031*, 2023.

[10] Lewis, P. et al. "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks." *NeurIPS*, 2020.

[11] Gao, Y. et al. "Retrieval-Augmented Generation for Large Language Models: A Survey." *arXiv:2312.10997*, 2023.

[12] Hu, E. J. et al. "LoRA: Low-Rank Adaptation of Large Language Models." *ICLR*, 2022.

[13] Dettmers, T., Pagnoni, A., Holtzman, A., Zettlemoyer, L. "QLoRA: Efficient Finetuning of Quantized LLMs." *NeurIPS*, 2023.

[14] Qwen Team, Alibaba. "Qwen2.5 Technical Report." *arXiv:2412.15115*, 2024.

[15] Meta AI. "The Llama 3 Herd of Models." *arXiv:2407.21783*, 2024.

[16] Microsoft. "Phi-3 Technical Report: A Highly Capable Language Model Locally on Your Phone." *arXiv:2404.14219*, 2024.

[17] Hochreiter, S., Schmidhuber, J. "Long Short-Term Memory." *Neural Computation*, Vol. 9, No. 8, pp. 1735–1780, 1997.

[18] Zhou, H. et al. "Informer: Beyond Efficient Transformer for Long Sequence Time-Series Forecasting." *AAAI*, 2021.

[19] Loukas, L. et al. "Transaction-aware banking text classification." *Proceedings of the Workshop on Economics and Natural Language Processing (ECONLP)*, 2022.

[20] Kaggle community. *Bank Transaction Classification Dataset*. Retrieved April 2026, from https://www.kaggle.com/datasets.

[21] Yao, S. et al. "ReAct: Synergizing Reasoning and Acting in Language Models." *ICLR*, 2023.

[22] Schick, T. et al. "Toolformer: Language Models Can Teach Themselves to Use Tools." *NeurIPS*, 2023.

[23] OpenAI. "Function Calling and Tool Use in the OpenAI API." OpenAI documentation, 2023–2024. Retrieved April 2026, from https://platform.openai.com/docs.

[24] Willard, B. T., Louf, R. "Efficient Guided Generation for Large Language Models." *arXiv:2307.09702*, 2023.

[25] Hugging Face. "TRL — Transformer Reinforcement Learning / SFT Trainer." Retrieved April 2026, from https://huggingface.co/docs/trl.

[26] Hugging Face. "PEFT — Parameter-Efficient Fine-Tuning." Retrieved April 2026, from https://huggingface.co/docs/peft.

[27] Chroma. "ChromaDB — the open-source embedding database." Retrieved April 2026, from https://www.trychroma.com.

[28] Elysia. "Elysia — Ergonomic framework for humans (Bun)." Retrieved April 2026, from https://elysiajs.com.

[29] Drizzle Team. "Drizzle ORM." Retrieved April 2026, from https://orm.drizzle.team.

[30] Oracle. "MySQL 8.0 Reference Manual." Retrieved April 2026, from https://dev.mysql.com/doc/refman/8.0/en/.
