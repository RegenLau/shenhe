# 希息健康后台 V1 开发交接

> 更新时间：2026-07-23
> 线上仓库：[RegenLau/shenhe](https://github.com/RegenLau/shenhe)
> 当前开发分支：`main`
> 业务功能基线：`53b4793`（交接文档提交前）

## 1. 项目定位

这是基于 SaiAdmin Vue 5.x 搭建的“希息健康审核业务运营后台”V1 原型。

当前目标是验证以下后台链路：

```text
创建或导入任务
  → 按手机号创建/匹配医生账号
  → 查看任务及审核进度
  → 查看逐条审核证据
  → 查看医生提现申请
  → 导出基金会线下处理名单
```

项目包含 Vue 前端和独立 Mock API，不包含数据库、生产后端或真实微信小程序。页面始终通过 HTTP API 获取数据，后续应在保持 API 契约的前提下替换 Mock。

最新会议口径优先于旧 HTML 原型。本交接文档已经固化最新范围；旧原型中的区域、志愿者、数字人、内容库、平台确认打款等功能不要直接搬回 V1。

## 2. 新电脑快速恢复

### 2.1 安装工具

必需：

- Git
- Node.js 20 或更高版本，优先使用 Node.js 20 LTS
- 可访问 GitHub 的网络

可选：

- GitHub CLI `gh`，可用于私有仓库登录、克隆和 PR 工作流
- VS Code、Codex 或其他开发工具

项目使用 `yarn.lock`，应固定使用 Yarn Classic 1.22.22。不要直接运行 `npm install` 生成另一套 `package-lock.json`。

### 2.2 Windows 软链接

`AGENTS.md` 在 Git 中是指向 `CLAUDE.md` 的软链接。Windows 建议先开启“开发者模式”，并在克隆前执行：

```powershell
git config --global core.symlinks true
```

如果无法启用软链接，开始开发前必须手动阅读 `CLAUDE.md`；永远只编辑 `CLAUDE.md`，不要单独修改 `AGENTS.md`。

### 2.3 克隆仓库

`RegenLau/shenhe` 是私有仓库，新电脑必须先用有权限的 GitHub 账号完成认证。已经安装 GitHub CLI 时：

```powershell
gh auth login
gh auth status
gh repo clone RegenLau/shenhe
cd shenhe
```

没有 GitHub CLI 时，也可以让 Git for Windows 凭据管理器在执行下列命令时打开浏览器登录：

```powershell
git clone https://github.com/RegenLau/shenhe.git
cd shenhe
```

认证和克隆完成后：

```powershell
git switch main
git pull --ff-only origin main
```

不要把 GitHub Token 写进仓库、交接文档或命令历史。

克隆只会自动生成 `origin`。需要对照 SaiAdmin 基础仓库时，可选执行：

```powershell
git remote add upstream https://github.com/RegenLau/saiadmin-base.git
git remote -v
```

不要向 `upstream` 推送本项目业务代码。

### 2.4 安装依赖

没有全局 Yarn 时：

```powershell
npm exec --yes --package yarn@1.22.22 -- yarn install --frozen-lockfile
```

已经安装 Yarn 1.x 时：

```powershell
yarn install --frozen-lockfile
```

### 2.5 启动项目

同时启动前端和 Mock：

```powershell
npm run dev:all
```

也可以分别打开两个终端：

```powershell
npm run dev:mock
```

```powershell
npm run dev
```

默认地址：

| 服务 | 地址 |
| --- | --- |
| 前端 | [http://localhost:8888](http://localhost:8888) |
| Mock API | [http://127.0.0.1:3010](http://127.0.0.1:3010) |
| 健康检查 | [http://127.0.0.1:3010/health](http://127.0.0.1:3010/health) |

如果 `8888` 被占用，Vite 可能自动使用下一个端口，以终端输出为准。本次原开发会话曾临时使用 `8900`，但仓库默认仍是 `8888`。

不要混用 `localhost` 和 `127.0.0.1` 访问前端：浏览器会把它们当作不同站点，本地登录状态不会共享。

### 2.6 演示登录

仅限 Mock 环境：

| 字段 | 值 |
| --- | --- |
| 用户名 | `admin` |
| 密码 | `123456` |
| 验证码 | `1234` |

## 3. 当前完成情况

### 3.1 后台 V1 已完成

| 模块 | 已实现能力 |
| --- | --- |
| 工作台 | 医生账号、任务总量、已审核数量、审核结果、累计计酬、可提现金额及提现待办 |
| 任务管理 | 手动创建任务；CSV 名单校验预览；按手机号创建或复用医生账号；整批创建任务；列表、筛选、详情、进度和计酬 |
| 医生管理 | 医生资料、账号激活状态、只读认证状态、任务概况、最近任务和累计计酬 |
| 审核记录 | 模拟问题、AI 回答、通过/不通过、问题类型、原因、医生、任务和审核时间；后台只读 |
| 提现管理 | 提现统计、查询、脱敏详情、计酬来源、敏感导出确认、基金会 CSV 导出和导出状态回写 |

关键边界：

- 医生认证状态当前只展示，不是任务门槛，后台没有认证审批流程。
- 审核记录只做证据查看，后台不复核、不改判。
- 提现模块只整理基金会名单，不审批、不打款、不登记付款结果。
- “已导出”只代表名单已整理，不能表达成“已付款”。
- 手机号、身份证和银行卡在页面中脱敏；完整模拟数据只进入确认后的导出文件。

### 3.2 初始 Mock 验收基线

Mock 服务重启后的初始数据：

| 指标 | 基线 |
| --- | --- |
| 医生账号 | 120 人：已激活 40、待激活 80 |
| 任务 | 8 个任务单，共 1,000 条审核任务 |
| 已完成审核 | 355 条：通过 302、不通过 53 |
| 整体完成率 | `355 / 1000 = 36%`（页面四舍五入） |
| 单条计酬 | `5000` 分，即 ¥50 |
| 已完成任务累计计酬 | ¥15,000 |
| 已申请提现 | ¥12,500 |
| 可提现 | ¥2,500 |
| 待导出提现 | 8 笔，共 ¥5,000 |
| 已导出提现 | 3 笔，共 ¥7,500 |

当前计酬逻辑是“整个任务完成后计入累计计酬”，不是每提交一条立即入账。开发医生端前要再次确认该规则。

## 4. 技术架构

```text
Vue 页面
  → src/api/product
  → src/utils/request.js
  → 开发环境 /dev
  → Vite 代理
  → mock-api/src/server.js
  → mock-api/data/*.json + 进程内存状态
```

统一 JSON 响应：

```json
{
  "code": 200,
  "message": "success",
  "data": {}
}
```

技术基线：

- Vue 3
- JavaScript + `<script setup>`
- Vite 5
- Arco Design Vue 2.57.x
- SaiAdmin 5.x
- Axios
- Express Mock API

不要引入第二套 UI 库，不要把页面改成 TypeScript，不要让页面直接读取 fixture。

## 5. 关键目录和文件

```text
CLAUDE.md                         项目硬规则，开始开发前必须阅读
docs/README.md                    设计与开发规范入口
docs/HANDOFF.md                   本交接文档
docs/design-system.md             视觉、响应式、状态和无障碍
docs/components.md                SaiAdmin/Arco 组件选型和 Mock 依赖
docs/page-patterns.md             列表、表单、详情、工作台页面模式
docs/feature-workflow.md          页面/API/Mock/菜单完整开发流程

src/views/product/
  workbench/index.vue             工作台
  task/                           任务列表、创建、导入和详情
  doctor/                         医生列表和详情
  review/                         审核记录列表和详情
  withdrawal/                     提现列表和详情

src/api/product/                  各业务模块唯一的数据访问入口
mock-api/src/server.js            Mock 路由、校验和内存业务行为
mock-api/data/bootstrap.json      登录启动信息、动态菜单和字典
mock-api/data/workbench.json      工作台初始统计
mock-api/data/tasks.json          任务初始数据
mock-api/data/doctors.json        医生初始数据
mock-api/data/reviews.json        审核内容模板和生成规则
mock-api/data/withdrawals.json    提现初始数据
```

模块对应关系：

| 模块 | 页面 | API | Fixture / Mock |
| --- | --- | --- | --- |
| 工作台 | `src/views/product/workbench` | `src/api/product/workbench.js` | `workbench.json` + `server.js` |
| 任务 | `src/views/product/task` | `src/api/product/task.js` | `tasks.json`、`doctors.json` + `server.js` |
| 医生 | `src/views/product/doctor` | `src/api/product/doctor.js` | `doctors.json`、`tasks.json` + `server.js` |
| 审核 | `src/views/product/review` | `src/api/product/review.js` | `reviews.json`、`tasks.json` + `server.js` |
| 提现 | `src/views/product/withdrawal` | `src/api/product/withdrawal.js` | `withdrawals.json` + `server.js` |

动态业务菜单不直接写进框架路由。菜单和字典由 `mock-api/data/bootstrap.json` 中的 `/core/system/user` 启动数据返回。

工作台不在上述业务菜单数组中：`user.dashboard = "workbench"` 会经过 `src/views/dashboard/index.vue` 和 `dashboard/components/work-panel.vue` 加载 `product/workbench/index.vue`。

## 6. 环境配置

仓库当前直接跟踪三份环境文件：

| 文件 | 用途 |
| --- | --- |
| `.env` | 项目标题、前端端口 `8888`、代理开关、基础路径 |
| `.env.development` | Mock 地址 `127.0.0.1:3010`、代理前缀 `/dev` |
| `.env.production` | 生产后端配置，目前为空 |

生产环境尚未配置。`npm run build` 只证明前端可构建，不代表已有可用的线上后端。接入真实后端时，应优先保持现有 API 路径和字段，通过环境配置切换地址，不在 Vue 页面中增加 Mock 专用分支。

## 7. 开发规则

开始改业务页面前，按顺序阅读：

1. `CLAUDE.md`
2. `docs/README.md`
3. `docs/design-system.md`
4. `docs/components.md`
5. `docs/page-patterns.md`
6. `docs/feature-workflow.md`

新增功能必须形成完整链路：

```text
动态菜单 → Vue 页面 → src/api → Axios → /dev 代理 → Mock 路由 → Fixture / 内存状态
```

主要规则：

- 业务页面放在 `src/views/product/`。
- 页面只能调用 `src/api`，不能直接读取 `mock-api/data`。
- 页面、API 和 Mock 使用一致的模块名、字段名和枚举。
- 所有金额接口字段使用 `*_cent`，单位是分；页面展示时再除以 100。
- 工作台 `tasks.total/pending/in_progress/completed` 的单位是审核条目“条”，不是任务单记录数。
- 先复用 SaiAdmin `Sa*` / `Ma*` 组件，再使用 Arco Design Vue。
- 每个异步区域处理加载、正常、空、错误/重试和长内容状态。
- `SaTable` 请求失败时要显示错误和重试，不能伪装成正常空列表。
- Blob 下载保留 Axios response，并通过现有 `tool.download(response)` 处理。
- 页面本身不能横向滚动；表格可以在自己的容器内滚动。
- 桌面端至少检查 1440px、1024px，移动端检查 375px。
- 只编辑 `CLAUDE.md`，`AGENTS.md` 只是软链接镜像。
- 不顺手重构框架目录，不提交 `dist/`、`stats.html`、截图、下载 CSV 或日志。

## 8. Mock 数据特性

Mock 没有数据库。以下操作只改变当前 Node 进程内存：

- 手动创建任务
- 名单导入并创建账号/任务
- 提现名单导出及状态回写
- 工作台对应统计联动

重启 Mock 后，上述状态恢复到 `mock-api/data/*.json` 的初始值。这是当前原型的设计，不是数据丢失 Bug。

模拟身份证和银行卡均为无效测试号码，不是真实个人数据。后续仍禁止提交真实患者信息、真实身份证、真实银行卡、访问令牌或生产密钥。

补充说明：

- `doctors.json` 只显式保存代表性记录，Mock 启动时会确定性补足到 120 人。
- 审核记录由任务的 `completed_count`、医生信息和 `reviews.json` 模拟问答池确定性生成，不是医生端真实提交。
- 如果修改了 `server.js` 却仍命中旧路由或旧数据，先确认并重启 `3010` 上的 Mock 进程。

## 9. 明确未实现

后台 V1 的五个模块已经完成，不要继续从旧原型中虚构后台菜单。整个产品仍缺少：

- 医生端微信小程序或移动端 H5。
- 手机号登录、微信授权、首次激活和资料补全。
- 医生本人任务列表、任务详情和开始/继续审核。
- 医生逐条提交审核、暂停继续、进度保存和真实任务完成。
- 医生审核历史、钱包和提交提现。
- 真实待审内容库存及任务与具体内容的关系。
- 真实短信、订阅消息和通知。
- 真实数据库、生产鉴权、数据加密、审计日志和细粒度权限。
- 身份证/银行卡四要素校验及合规存储。
- 基金会后台、自动支付或付款结果回传。
- 企业/区域、志愿者/代表端、数字人和科普。
- 医生认证审批。
- 精细的科室—疾病—药品匹配。
- Excel `.xlsx` 名单导入；当前只支持 CSV。

继承自 SaiAdmin 的 `src/views/system/` 等页面可用于参考，但对应 Mock 并未全部实现，不属于当前业务验收范围。

## 10. 下一阶段建议

不要再扩展后台业务模块。下一阶段应单独开发医生端，建议顺序：

1. 手机号登录、首次激活与任务中心。
2. 任务详情、逐条审核和暂停继续。
3. 任务完成与审核历史。
4. 钱包和提现申请。
5. 后台与医生端全链路联调，再冻结真实后端 API 契约。

开始前必须让产品负责人确认：

- 做原生微信小程序、uni-app/Taro，还是先做 H5；是否建立独立目录或仓库。
- 手机号一键登录还是短信验证码；名单外手机号能否注册。
- 首次登录是否立即激活；医院、科室、职称何时补全。
- 姓名冲突、手机号变更、重复账号和更换微信如何处理。
- 计酬是固定 ¥50/条吗；逐条入账还是整任务完成后入账。
- 审核不通过是否必须选择问题类型并填写原因；提交后能否修改。
- 是否允许跳过、返回上一条；退出后从哪里继续。
- 提现是全额还是部分；最低金额、频率和撤回规则。
- 医生端如何展示“已提交、基金会处理中、已导出”，避免误解为已付款。
- V1 是否完全不做通知，只让医生主动登录查看。

V1 继续使用模拟常见用药问答，不接触真实患者数据。

## 11. 验证与交付

代码检查：

```powershell
npm run mock:check
npm run build
```

启动 Mock 后检查：

```powershell
Invoke-RestMethod http://127.0.0.1:3010/health
```

完整功能至少验证：

- 登录后能加载动态菜单。
- 工作台统计与任务、审核、提现数据一致。
- 任务搜索、详情、创建、CSV 预览和确认导入可用。
- 新手机号创建待激活医生，已有手机号复用原账号。
- 医生、审核和提现列表/详情正常，敏感字段保持脱敏。
- 提现导出前有敏感信息确认。
- 导出后待导出变为 0、记录变为已导出、工作台待办同步消失。
- 桌面端和 375px 无页面级横向滚动。
- 浏览器控制台无新增错误。

当前构建可能出现以下非阻塞提示：

- Browserslist 数据较旧。
- `vue-demi` 空 chunk。
- 部分继承依赖包体积超过 1500 kB。

构建会生成 `dist/` 和 `stats.html`，二者已经被 `.gitignore` 忽略，不要提交。

## 12. 常见问题

### `yarn` 无法识别

使用：

```powershell
npm exec --yes --package yarn@1.22.22 -- yarn install --frozen-lockfile
```

安装完成后可继续使用 `npm run dev:all`、`npm run build`。

### 后台地址打不开

1. 确认 `npm run dev:all` 仍在运行。
2. 查看终端打印的实际前端端口。
3. 访问 Mock 健康检查。
4. 如果只启动了前端，另开终端执行 `npm run dev:mock`。

### 页面跳回登录或接口加载失败

- 确认 Mock 的 `3010` 端口正常。
- 坚持使用同一个前端主机名，不要在 `localhost` 和 `127.0.0.1` 间切换。
- 必要时清理该站点的本地存储后重新登录。

### 新菜单或字典没有出现

菜单和字典来自启动接口。修改 `bootstrap.json` 后退出并重新登录；必要时清理本地登录状态。

### 提现测试后没有待导出记录

导出会在内存中将 8 笔记录改为“已导出”。重启 Mock 即恢复初始数据。

### 出现 `Mock route not found`

当前只保证 `src/views/product/` 下的希息健康业务模块。SaiAdmin 继承页面并非都已实现 Mock。

### 端口被占用

检查监听端口：

```powershell
Get-NetTCPConnection -State Listen |
  Where-Object { $_.LocalPort -in 8888, 3010 } |
  Select-Object LocalAddress, LocalPort, OwningProcess
```

需要临时改前端端口时，可分别启动：

```powershell
npm run dev:mock
npm run dev -- --port 8900
```

### `gh` 无法识别

GitHub CLI 不是运行项目的必需项。使用 Git for Windows 自带的凭据管理器也可以正常 `git pull` / `git push`。需要 `gh` 工作流时再安装 GitHub CLI。

## 13. 每次继续开发前

```powershell
git switch main
git pull --ff-only origin main
git status
node --version
npm run mock:check
```

非平凡功能建议从最新 `main` 新建分支：

```powershell
git switch -c feature/<功能名>
```

提交前：

```powershell
npm run mock:check
npm run build
git diff --check
git status
```

不要把本机旧 HTML、会议原始逐字稿、QA 截图、临时 CSV 和 `.playwright-mcp` 目录当作项目源码提交。原始会议材料未纳入仓库，本文件中的产品边界是接续开发时的仓库内依据。

## 14. 给新开发会话的启动提示

可以把下面这段直接交给新的 AI 开发会话：

```text
先阅读 CLAUDE.md、docs/HANDOFF.md 和 docs/README.md，并检查 git status。
当前项目是希息健康后台 V1：Vue 3 + JavaScript + SaiAdmin + Arco Design Vue，
页面必须通过 src/api → Axios → /dev → Mock API 获取数据。
后台五个业务模块已经完成，不要从旧 HTML 原型恢复延期功能。
先复述当前分支、已有模块、开发边界和验证方式，再开始本次需求。
```
