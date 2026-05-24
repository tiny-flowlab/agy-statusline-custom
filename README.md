# 🚀 agy-status-line

> A premium, ultra-responsive 3-line terminal status bar plugin for **Antigravity CLI**, meticulously engineered by **Tiny** ([tiny-flowlab.com](https://tiny-flowlab.com)). Delivers real-time Gemini usage analytics, 5-hour rolling cost tracking, active subagent telemetry, and context window visualization in a gorgeous, split-justified ANSI-colored dashboard.

<div align="center">

[![Author: Tiny](https://img.shields.io/badge/Author-Tiny-00f0ff?style=for-the-badge&logo=visual-studio-code)](https://tiny-flowlab.com)
[![Website: tiny-flowlab.com](https://img.shields.io/badge/Website-tiny--flowlab.com-10b981?style=for-the-badge&logo=google-chrome)](https://tiny-flowlab.com)
[![Antigravity: Plugin](https://img.shields.io/badge/Antigravity-Plugin-8b5cf6?style=for-the-badge&logo=terminal)](https://github.com/antigravity)
[![Version](https://img.shields.io/badge/Version-0.4.0-3b82f6?style=for-the-badge)](https://github.com/tiny-flowlab/agy-statusline-custom)
[![License: MIT](https://img.shields.io/badge/License-MIT-f59e0b?style=for-the-badge)](LICENSE)

</div>

---

## 🌐 Language Navigation
* 🇺🇸 **[English Documentation](#-english-documentation)** *(default below)*
* 🇰🇷 **[한국어 설명서](#-한국어-설명서)** *(expandable at bottom)*

---

<div id="english-documentation"></div>

# 🇺🇸 English Documentation

## ✨ Features

- **3-Line Executive Dashboard** — Organized layout split logically across agent action status, model/cost details, and token consumption statistics.
- **5-Hour Sliding Window Cost Tracker** — Persists and aggregates your token usage metrics across a rolling 5-hour window, mimicking Google Gemini's actual quota boundaries.
- **New Session Auto-Reset** — Automatically resets global cumulative costs to `$0.00` whenever you launch a fresh Antigravity session (`agy` execution).
- **Diagnostics Doctor Tool (`doctor.js`)** — An interactive, beautiful ANSI-colored health inspector checking script paths, configuration sanity, and permissions.
- **Multi-Session Isolation** — Sessions are uniquely tracked via UUIDs, preventing cost or token double-counting when multi-tasking.
- **Active Subagent Telemetry** — Live monitors and counts running subagents by parsing conversation transcripts.
- **Task.md Sync** — Computes and renders real-time progress checklist percentages directly onto the status bar.
- **Context Utilization Dial** — Visualizes total input/output vs. absolute context limit with dynamic amber/red alert thresholds.
- **Ground-Truth Server Quota Syncing (Preview / Experimental)** — Automatically fetches your actual remaining usage/quota values and ground-truth reset timestamps from the Google Cloud/API backend upon launching `agy`, ensuring perfect state synchronization. *(Note: This is a preview/experimental feature).*
- **Live Quota & Reset Tracker** — Estimates real-time remaining API quota (combining 5-hour rolling windows & 1-minute RPM/TPM rate limits) and displays precise countdowns to reset times directly on the status bar.
- **4 Custom Themes** — `aurora` (DeepMind default), `cyberpunk`, `classic`, and `minimal`.

---

## 📸 Terminal Preview

```
🧠 Thinking [Google AI Enterprise]          ⏳ Subagents: 0 | ⚙️ Tasks: 0 | 🎨 Art: 4 | 🎯 Progress: 80%
🤖 [Gemini 2.5 Flash | ⚡ Quota:92.4%/100.0% (Reset: 4h 53m)] 💵 $1.18 (5h: $7.28 [4h 53m left])
📥 In:120.5k (+5.2k / 5h:938k) | 📤 Out:45k (+1.2k / 5h:578k) | ⚡ Cache:50k (+50k / 5h:4.5M)    🧠 Ctx: 165.5k/2.1M (7.9%)
```

> [!NOTE]
> ANSI escape codes will render this in vibrant colors inside your active shell. The preview above is a plain text representation.

---

## 📋 Requirements & Antigravity CLI Installation

- **Node.js** `>=18.0.0`
- **Antigravity CLI** installed globally

### ⚙️ Installing Antigravity CLI
If you do not have **Antigravity CLI** installed yet, set it up using either of the methods below:

#### Method A: NPM Registry (Recommended)
```bash
npm install -g antigravity-cli
```

#### Method B: From Official Source
```bash
git clone https://github.com/antigravity/cli.git
cd cli
npm install -g .
```

---

## 🚀 Installation & Integration

### 1. Clone this Plugin Repository
```bash
git clone https://github.com/tiny-flowlab/agy-statusline-custom.git
cd agy-status-line
```

### 2. Run the Portable Installer
```bash
node install.js
```
> [!TIP]
> The installer automatically scans for your Antigravity config directory (`~/.gemini/antigravity-cli` or `~/.gemini/antigravity`), makes a safe backup (`settings.json.bak`), and dynamically registers `status_line.js` under the `statusLine` hook.

### 3. Run the Doctor Diagnostics (Highly Recommended)
Ensure everything is correctly configured, files have proper write permissions, and terminal coloring is active:
```bash
node doctor.js
```

### 4. Run a New Session
Boot your Antigravity agent. The gorgeous 3-line status bar will display seamlessly at the bottom of your terminal during each thinking/execution step!

---

## 🎨 Aesthetic Themes

Customize your visual experience by exporting the `AGY_STATUS_THEME` environment variable in your shell profile (`~/.bashrc`, `~/.zshrc`):

```bash
export AGY_STATUS_THEME=cyberpunk
```

| Theme | HSL Colors | Vibe / Look |
| :--- | :--- | :--- |
| **`aurora`** *(Default)* | Purple / Cyan / Emerald | Sleek DeepMind brand identity, premium gradient |
| **`cyberpunk`** | Neon Pink / Ice Blue / Neon Yellow | High-contrast synthwave aesthetic |
| **`classic`** | Purple / Sky Blue / Green | Vintage hacker terminal |
| **`minimal`** | White / Cool Gray / Dark Gray | Zero-distraction, monochrome layout |

---

## ⚕️ Diagnostics & Self-Healing

The package comes equipped with an advanced health tool, **`doctor.js`**, and internal self-healing protocols:
- **Node.js & OS Validation**: Audits system versions and environment conditions.
- **Settings Path Scrutiny**: Verifies target path resolutions for absolute status scripts.
- **Permission Check**: Executes non-blocking read/write checks on database/state JSON configurations.
- **Double-Counting Protection**: De-duplicates context footprint updates using unique cryptographic step signatures.
- **Legacy State Realignment**: Auto-resets mathematically corrupt logs or output-heavy anomalous values.

Run diagnostics manually at any time:
```bash
node doctor.js
```

---

## 📊 Rolling 5-Hour Billing Rates

Gemini API usage operates on a rolling 5-hour cycle. The cost tracker references dynamic pricing rates based on model classifications and context windows:

| Gemini Model Family | Input Rate (per 1M) | Output Rate (per 1M) | Cache Read Rate (per 1M) |
| :--- | :--- | :--- | :--- |
| **Gemini 3.5 Flash** | $1.50 | $9.00 | $0.15 |
| **Gemini 3.1 Pro** *(Context ≤ 200k)* | $2.00 | $12.00 | $0.20 |
| **Gemini 3.1 Pro** *(Context > 200k)* | $4.00 | $18.00 | $0.40 |
| **Gemini 3.1 Flash** | $0.25 | $1.50 | $0.025 |

---

## 🔧 Advanced Configuration

### Run Headless or Disable Colors
```bash
NO_COLOR=1 node status_line.js < stdin.log
```

### Enable Debug Mode
```bash
DEBUG=1 node status_line.js < stdin.log
```
*Outputs detailed runtime errors and stream-parsing details directly to `stderr`.*

---

## 📁 File Structure

```
agy-status-line/
├── status_line.js              # Core status renderer
├── install.js                  # Automated backup & hook injector
├── doctor.js                   # Interactive health examiner
├── plugin.json                 # Plugin meta specs (Author: Tiny)
├── session_state.example.json  # Reference schema for states
├── LICENSE                     # MIT License
├── README.md                   # This bilingual manual
├── .gitignore
├── commands/
│   └── status.md               # Slash command integration
└── skills/
    └── status_line_plugin/
        └── SKILL.md            # Actionable skill for CLI context
```

---

## 📝 Changelog

### v0.4.0
- **Ground-Truth Server Quota Syncing (Preview / Experimental)** — Connects directly to the Google Cloud/API backend on `agy` session launch, fetching the actual usage statistics and ground-truth remaining quota/reset timing for perfect alignment. *(Preview/Test Feature)*
- **Real-time Live Quota Tracking** — Integrates dynamic rate-limit estimations based on 5-hour rolling token consumption and 1-minute RPM/TPM thresholds.
- **Quota Reset Countdown** — Tracks ground-truth `resetTime` provided by the API and renders remaining time dynamically on the status bar (e.g. `Reset: Xh Ym`).
- **Collapsible Bilingual Layout** — Revamped README to be English base with a collapsible Korean documentation block to improve readability.
- **Improved Script Integrity Diagnostics** — Upgraded `doctor.js` to run robust integrity and permission checks.

### v0.3.0
- Active subagent telemetry parsing conversation transcripts.
- Real-time `task.md` progress checklist percentage calculations.
- Context utilization dial showing total input/output vs context limits.
- Sliding 5-hour window cost tracking database with session auto-resets.

---

## 👤 Credits & Support
- **Author**: **Tiny**
- **Website**: [tiny-flowlab.com](https://tiny-flowlab.com)
- **License**: Released under the [MIT License](LICENSE).

---

<details>
<summary>🇰🇷 <b>한국어 설명서 (Click to expand Korean version)</b></summary>
<br>

<div id="한국어-설명서"></div>

# 🇰🇷 한국어 설명서

## ✨ 주요 기능

- **프리미엄 3줄 대시보드** — 에이전트 상태, 제미나이 모델/비용 모니터링, 실시간 토큰 소모 분석을 3줄로 분할하여 양끝 정렬(Split-Justified)로 깔끔하게 렌더링합니다.
- **5시간 실시간 슬라이딩 윈도우 비용 추적** — Google Gemini의 실제 쿼터 정책에 맞추어 "현재 기준 최근 5시간" 이내의 토큰 소비 데이터를 디스크 기반으로 누적하고 동적으로 필터링하여 노출합니다.
- **새 세션 자동 초기화** — 새로운 터미널 창을 열어 `agy`를 구동할 때마다 글로벌 누적 비용 데이터를 깨끗하게 `$0.00`으로 자동 리셋해 줍니다.
- **환경 자가 진단 도구 (`doctor.js`)** — 설치 후 연동 상태, 스크립트 절대 경로, 디렉토리 권한, 터미널 색상 지원 여부를 한눈에 확인할 수 있는 고급 컬러 진단 도구입니다.
- **다중 세션 고유 격리** — 세션 고유 UUID 기반으로 설계되어 여러 세션을 동시에 띄워도 비용이나 토큰이 중복 집계되지 않습니다.
- **서브에이전트 텔레메트리** — 실시간 백그라운드에서 가동 중인 서브에이전트 개수를 실시간 파싱하여 표기합니다.
- **Task.md 진행률 동기화** — 작업 디렉토리의 `task.md` 할 일 목록 완수 비율(%)을 실시간 계산하여 출력합니다.
- **컨텍스트 위젯** — 전체 사용 토큰량 대 컨텍스트 한계 용량을 동적 경고 임계치(황색/적색)와 함께 비율로 시각화합니다.
- **로그인 시 실시간 서버 쿼터 동기화 (프리뷰 / 테스트 기능)** — `agy` 세션을 실행하고 구동할 때 백엔드 서버 및 API로부터 실제 잔여 사용량(usage) 및 리셋 대기 시간 실 수치를 동적으로 패치하여 상태바 데이터를 오차 없이 실시간 동기화합니다. *(참고: 본 기능은 프리뷰 및 테스트 목적의 실험적 기능입니다).*
- **실시간 잔여 쿼터 및 리셋 카운트다운** — 최근 5시간 누적 토큰 소비 데이터 및 1분당 RPM/TPM 처리 한도를 실시간 종합 분석하여 잔여 사용 쿼터 비율 및 리셋까지의 남은 대기 시간을 표기합니다.
- **4가지 프리미엄 디자인 테마** — `aurora` (기본값), `cyberpunk`, `classic`, `minimal`을 제공합니다.

---

## 📸 터미널 화면 예시

```
🧠 Thinking [Google AI Enterprise]          ⏳ Subagents: 0 | ⚙️ Tasks: 0 | 🎨 Art: 4 | 🎯 Progress: 80%
🤖 [Gemini 2.5 Flash | ⚡ Quota:92.4%/100.0% (Reset: 4h 53m)] 💵 $1.18 (5h: $7.28 [4h 53m left])
📥 In:120.5k (+5.2k / 5h:938k) | 📤 Out:45k (+1.2k / 5h:578k) | ⚡ Cache:50k (+50k / 5h:4.5M)    🧠 Ctx: 165.5k/2.1M (7.9%)
```

> [!NOTE]
> 실제 터미널 환경에서는 ANSI 이스케이프 코드를 활용한 수려한 색상으로 렌더링됩니다. 위 텍스트는 간략한 프리뷰 예시입니다.

---

## 📋 요구 사양 및 Antigravity CLI 설치 방법

- **Node.js** `>=18.0.0`
- **Antigravity CLI** 글로벌 설치

### ⚙️ Antigravity CLI 설치 가이드
플러그인을 연동하려면 시스템에 **Antigravity CLI**가 먼저 설치되어 있어야 합니다. 아래 방법 중 하나를 선택하세요.

#### 방법 A: NPM 패키지 매니저로 설치 (권장)
```bash
npm install -g antigravity-cli
```

#### 방법 B: 소스코드 복제 후 로컬 설치
```bash
git clone https://github.com/antigravity/cli.git
cd cli
npm install -g .
```

---

## 🚀 플러그인 설치 및 연동

### 1. 플러그인 저장소 복제
```bash
git clone https://github.com/tiny-flowlab/agy-statusline-custom.git
cd agy-status-line
```

### 2. 자동 설치 프로그램 실행
```bash
node install.js
```
> [!TIP]
> 설치 프로그램이 `~/.gemini/antigravity-cli` 혹은 `~/.gemini/antigravity` 내의 `settings.json` 파일을 자동으로 찾아 원본을 백업(`settings.json.bak`)한 뒤 플러그인 연결 설정을 안전하게 주입합니다.

### 3. 환경 진단 도구 실행 (강력 추천)
설치 직후 또는 문제가 의심될 경우, 자가 진단을 수행하여 문제 요소를 원클릭으로 검증할 수 있습니다:
```bash
node doctor.js
```

### 4. 새로운 세션 실행
`agy` 에이전트 세션을 구동해 보세요. 매 단계마다 터미널 하단에 아름답게 정돈된 3줄 상태창을 감상하실 수 있습니다!

---

## 🎨 스타일 테마 설정

터미널 프로필 파일(`~/.bashrc`, `~/.zshrc`)에 `AGY_STATUS_THEME` 환경 변수를 추가하여 원하는 감성으로 상태바를 커스터마이징하세요:

```bash
export AGY_STATUS_THEME=cyberpunk
```

| 테마명 | 적용 색상 구성 | 디자인 무드 |
| :--- | :--- | :--- |
| **`aurora`** *(기본값)* | 보라 / 청록 / 에메랄드 | DeepMind 브랜드 감성의 미려하고 화려한 프리미엄 그라데이션 |
| **`cyberpunk`** | 네온 핑크 / 아이스 블루 / 형광 황색 | 고대비 신스웨이브 및 사이버펑크 룩 |
| **`classic`** | 보라 / 스카이 블루 / 녹색 | 차분하고 정갈한 빈티지 해커 터미널 스타일 |
| **`minimal`** | 흰색 / 쿨 그레이 / 다크 그레이 | 텍스트 집중에 방해되지 않는 깔끔한 모노크롬 |

---

## ⚕️ 환경 자가 진단 및 예외 보정

본 플러그인은 완벽한 안정성을 추구하며, 자가 진단 툴인 **`doctor.js`** 와 함께 다음과 같은 안전장치가 내장되어 있습니다:
- **실시간 Node.js & OS 진단**: 안정적인 동작을 보장하는 실행 엔진 검사.
- **상태 파일 권한 체크**: 세션 상태(`session_state.json`)의 읽기/쓰기 차단 요소를 실시간 감증.
- **중복 방지 메커니즘**: 에이전트의 스텝별 고유 시그니처를 검증하여 토큰 및 비용이 중복 집계되는 것을 완벽히 방지합니다.
- **오염 방지 자가 보정**: 데이터에 비정상적이거나 무한 루프로 인한 극단적인 수치가 기록될 경우 플러그인이 이를 인지하여 안전하게 보정 및 초기화합니다.

진단 도구는 터미널에 언제든 아래와 같이 타이핑하여 즉시 실행할 수 있습니다:
```bash
node doctor.js
```

---

## 📊 5시간 슬라이딩 윈도우 비용 정책

Gemini API 요율은 사용 모델군과 컨텍스트 깊이에 따라 다르게 적용됩니다:

| 제미나이 모델 그룹 | 입력 요금 (1M 토큰당) | 출력 요금 (1M 토큰당) | 캐시 리드 요금 (1M 토큰당) |
| :--- | :--- | :--- | :--- |
| **Gemini 3.5 Flash** | $1.50 | $9.00 | $0.15 |
| **Gemini 3.1 Pro** *(컨텍스트 200k 이하)* | $2.00 | $12.00 | $0.20 |
| **Gemini 3.1 Pro** *(컨텍스트 200k 초과)* | $4.00 | $18.00 | $0.40 |
| **Gemini 3.1 Flash** | $0.25 | $1.50 | $0.025 |

---

## 🔧 고급 환경 변수

### 컬러 출력 끄기
```bash
NO_COLOR=1 node status_line.js < stdin.log
```

### 디버그 출력 활성화
```bash
DEBUG=1 node status_line.js < stdin.log
```
*런타임 오류 및 스트림 가공 관련 파싱 로그를 표준 에러(`stderr`)로 상세 출력합니다.*

---

## 📁 플러그인 파일 구성

```
agy-status-line/
├── status_line.js              # 상태 바 출력을 담당하는 코어 렌더러
├── install.js                  # 연동 주입 및 설정 백업 자동화 스크립트
├── doctor.js                   # 직관적인 대화형 환경 진단 도구
├── plugin.json                 # 플러그인 메타 스펙 명세서 (작업자: Tiny)
├── session_state.example.json  # 로컬 상태 데이터 저장소 모형 스키마
├── LICENSE                     # MIT 라이선스
├── README.md                   # 본 이중 언어 매뉴얼 페이지
├── .gitignore
├── commands/
│   └── status.md               # /status 슬래시 명령어 통합 정의
└── skills/
    └── status_line_plugin/
        └── SKILL.md            # 에이전트 연동용 status_line_plugin 스킬 파일
```

---

## 📝 업데이트 내역 (Changelog)

### v0.4.0
- **로그인 시 실시간 서버 쿼터 동기화 (프리뷰 / 테스트 기능)** — `agy` 세션을 시작할 때 구글 클라우드/API 백엔드 서버로부터 실제 사용 수치 및 ground-truth 리셋 카운트다운을 즉시 조회 및 동기화하여 완벽한 상태를 복원합니다. *(프리뷰 및 테스트 목적으로 실험 지원)*
- **실시간 API 잔여 쿼터 측정** — 최근 5시간 누적 토큰 소비 및 1분당 RPM/TPM 처리 제한 병목에 기반한 실시간 잔여 사용 쿼터 추적 기능 탑재.
- **쿼터 리셋 카운트다운** — API가 제공하는 ground-truth `resetTime`을 파싱하여 상태창에 실시간 리셋 대기 시간 표기 (예: `Reset: Xh Ym`).
- **접이식 다국어 문서 레이아웃 개편** — 영어 문서를 기본 노출하고, 한국어 설명서는 접이식 `<details>` 블록으로 감싸 가독성 향상.
- **환경 자가 검사 도구 고도화** — `doctor.js` 스크립트 무결성 진단 검사 및 정적 권한 감사 기능 강화.

### v0.3.0
- 대화 트랜스크립트 파싱 기반의 가동 서브에이전트 수 실시간 감지 기능.
- `task.md` 할 일 체크리스트 연동 기반의 에이전트 실시간 태스크 완수율(%) 표시.
- 입출력 토큰 비중 및 컨텍스트 상한 대비 실시간 가용량 비율 알림 연동.
- 5시간 슬라이딩 윈도우 기반 누적 요금 추적 및 에이전트 신규 세션 자동 리셋 지원.

---

## 👤 작업자 정보 & 웹사이트
- **작업자 (Developer)**: **Tiny**
- **공식 웹사이트 (Website)**: [tiny-flowlab.com](https://tiny-flowlab.com)
- **라이선스 (License)**: [MIT License](LICENSE)를 준수합니다.

</details>

