# 希息药事后台 V1 开发交接

> 更新时间：2026-08-05
> 线上仓库：[RegenLau/shenhe](https://github.com/RegenLau/shenhe)
> 当前开发分支：`main`
> 业务功能基线：`53b4793`（交接文档提交前）

## 1. 项目定位

这是基于 SaiAdmin Vue 5.x 搭建的“希息药事审核业务运营后台”V1 原型。

当前目标是验证以下后台链路：

```text
维护审核题库（V5.0 的 36 类题型与 A/B/C 定价）
  → 创建任务或导入任务（按目标积分精确匹配题目）
  → 查看任务及审核进度
  → 查看逐条审核证据
  → 查看医生提现申请
  → 导出基金会线下处理名单
  → 导入基金会已结算名单并回写结算状态
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
| 医生管理 | 关键词、账号状态和认证状态筛选；姓名、手机号、医院、科室与职称、账号状态、认证状态、累计积分、详情、禁用和开启账号；新增医生（姓名/手机号/性别必填，执业信息选填自医生端配置）；未激活名单敏感导出（交药企代表跟进注册） |
| 医生认证 | 医生筛选、认证列表、认证详情、脱敏身份证号、证件照片（医师资格证/医师执业证书任选其一，带水印说明）、人工核对确认、认证通过和认证驳回 |
| 审核题库 | 以药品为主对象，通过 AI 数智人药师药品库检索选择药品，自动带回图片、名称、规格和生产厂家；科室归属复用医生端配置中的启用科室，再管理该药品的 V5.0 36 类问题、A/B/C 档位与动态升级规则；题库状态、风险标签与操作审计 |
| 任务管理 | 手动创建任务（下拉选择已有医生，禁用医生不可选）；XLSX/CSV 名单校验预览；导入时按手机号创建或复用医生账号；按每行目标积分随机、无固定等级比例地精确匹配题目；整批校验后创建任务并冻结题目快照；禁用账号拦截；列表、筛选、详情、进度和积分 |
| 审核记录 | 列表前八列与审核题库统一：药品图片、名称、规格、生产厂家、审核问题、任务档位、任务积分、问题类型；之后展示医生、任务、通过/不通过、不通过类型和审核时间；后台只读 |
| 提现管理 | 提现统计（待导出/已导出待结算/已结算）、查询、脱敏详情、计酬来源、敏感导出确认、基金会 CSV 导出、已结算名单校验导入和结算状态回写 |
| 医生端配置 | 在“系统设置”中维护小程序首次登录可选的医院、科室和职称；支持查询、新增、编辑、启停和删除 |

关键边界：

- 医生认证支持人工复审、通过和驳回；认证材料口径为「身份证号 + 证件照片任选其一（医师资格证 / 医师执业证书）」，附件加水印仅用于复审。通过前需确认已核对证件姓名、脱敏身份证号与证件照片。认证状态不作为医生执行已分配审核任务的门槛。
- 医生端注册两步：第 1 步基本信息必填（姓名、性别、所在医院、科室、职称），第 2 步专业认证选填可后补；手机号来自微信授权，不再单独填写。医生数据含 `gender`（male/female，字典 `doctor_gender`）。
- 已禁用医生保留已分配任务和计酬，但不能登录小程序；任务创建页会明确提示禁用状态，手动创建和名单导入也会阻止继续分配新任务。后台重新开启后，有过登录记录的账号恢复为已激活，否则恢复为待激活。
- 审核记录只做证据查看，后台不复核、不改判。
- 提现结算状态机为 `pending 待导出 → exported 已导出 → settled 已结算`。平台不审批、不实际打款；基金会线下完成结算后，由运营把导出名单中的「结算状态」改为「已结算」并导回系统。
- “已导出”只代表名单已整理，不能表达成“已结算”；只有系统当前为「已导出」的申请可通过名单更新为「已结算」，仍为「待导出」或已经「已结算」的记录会跳过且不更新。
- 审核问题类型字典为医生端口径：内容不准确 / 表述不规范 / 信息不完整 / 存在安全风险 / 其他。
- 积分口径：计价与结算字段使用 `*_cent`（分），任务分配目标 `target_points` 及导入模板的「任务积分」使用业务积分（1 积分 = 1 元），进入精确匹配时再统一换算为分。任务按最终等级计价，A/B/C 分别为 100/200/300 积分/条。后台页面不出现 ¥；仅基金会提现导出 CSV 保留「金额(元)」列。
- 手机号、身份证和银行卡在页面中脱敏；完整模拟数据只进入确认后的导出文件。

### 3.2 V5.0 题库与定价第一版

- 题库以药品为主对象：每道题必须从 AI 数智人药师药品库检索选择药品，不在题库表单中手填药品信息；图片、名称、规格和生产厂家均由药品库按 `drug_id` 回填。列表按“药品图片 → 名称 → 规格 → 生产厂家 → 问题”的顺序展示；统一药品检索可按名称、规格或厂家查找，不再单设厂家筛选。同一药品可关联多道 A/B/C 任务题。
- 题目的科室归属只能从“医生端配置”的启用科室中选择，列表支持按科室精确筛选；已有题目的历史/已停用科室值未修改时可继续保存，避免配置变化阻断其他内容维护。
- 题库固化 36 类标准：A 级 15 类、B 级 12 类、C 级 9 类，单条基准积分分别为 100、200、300。
- 服务端根据五类风险动态升级：特殊人群/重大基础病与高风险用药、过量/不良反应/禁忌/相互作用的严重度、医嘱与说明书冲突、换算与复杂操作/儿童精确剂量、AI 越界做诊断或药物调整建议。最终等级与单价由服务端计算。
- 任务按「任务积分」目标精确匹配当前可用题目，随机选题且不设 A/B/C 固定比例。题目不是一次性库存：同一条题可由多个不同医生审核，但同一任务内不重复，且不重复分配给同一医生。任务项冻结药品、题目内容、最终档位、升级原因和单价，防止后续题库修改影响历史结算。
- 最新名单模板字段为「医生姓名 / 手机号 / 任务积分 / 创建日期」，同时支持 `.xlsx` 和 `.csv`；预览和确认都会重新校验医生可用题目与精确积分。
- 题目 AI 回答按单一文本维护，风险标签选择器与规则说明采用上下布局；题库保留轻量操作审计，不引入题目版本系统。医生记录增加培训考试状态和可审核档位；名单模板未提供这两列，因此当前原型导入账号按已通过/C 档资格记录。
- 风险标签和题目操作记录在后台只显示中文名称；英文编码仅作为内部规则计算与接口兼容字段，不直接展示给运营人员。
- 本版不增加抽检、二次复审或申诉流程；医生端真实逐条提交、真实结果审计来源与持久化数据库仍未实现。

### 3.3 初始 Mock 验收基线

Mock 服务重启后的初始数据：

| 指标 | 基线 |
| --- | --- |
| 医生账号 | 120 人：已激活 40、待激活 79、已禁用 1 |
| V5.0 模拟任务 | 8 个任务单，共 1,000 条审核题库任务；A/B/C 为 436/331/233 条 |
| V5.0 题库 | 100 个模拟药品规格 SKU，每个 SKU 关联 36 类标准问题（A 15 / B 12 / C 9），共 3,600 条 |
| 已完成审核 | 355 条：通过 302、不通过 53 |
| 整体完成率 | `355 / 1000 = 36%`（页面四舍五入） |
| 任务单条积分 | A/B/C 分别为 100/200/300 积分 |
| 已完成任务累计积分 | 53,800 积分 |
| 已申请提现 | 45,800 积分 |
| 可提现 | 8,000 积分 |
| 待导出提现 | 8 笔，共 18,800 积分 |
| 已导出提现（待结算） | 2 笔，共 16,400 积分 |
| 已结算提现 | 1 笔，共 10,600 积分 |
| 认证待复审 | 以工作台待办为准（按认证记录动态统计） |
| 医生端配置 | 医院 7 条（启用 6）、科室 7 条（启用 6）、职称 6 条（启用 5） |

Mock 计酬逻辑是“整个任务完成后计入累计计酬”，不是每提交一条立即入账。开发真实医生端前仍要确认入账时点。

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
  doctor/                         医生列表和详情
  doctor-certification/           医生认证列表、详情和人工复审
  question-bank/                  审核题库列表、详情和编辑
  task/                           任务列表、创建、导入和详情
  review/                         审核记录列表和详情
  withdrawal/                     提现列表和详情
  doctor-config/                  医生端医院、科室和职称配置

src/api/product/                  各业务模块唯一的数据访问入口
mock-api/src/server.js            Mock 路由、校验和内存业务行为
mock-api/data/bootstrap.json      登录启动信息、动态菜单和字典
mock-api/data/workbench.json      工作台初始统计
mock-api/data/tasks.json          任务初始数据
mock-api/data/question-bank.json  V5.0 题型、定价和风险升级规则
mock-api/data/doctors.json        医生初始数据
mock-api/data/doctor-certifications.json 医生认证初始数据
mock-api/data/reviews.json        审核结论模板和生成规则
mock-api/data/withdrawals.json    提现初始数据
mock-api/data/doctor-config.json  医院、科室和职称初始配置
```

模块对应关系：

| 模块 | 页面 | API | Fixture / Mock |
| --- | --- | --- | --- |
| 工作台 | `src/views/product/workbench` | `src/api/product/workbench.js` | `workbench.json` + `server.js` |
| 医生 | `src/views/product/doctor` | `src/api/product/doctor.js` | `doctors.json`、`tasks.json` + `server.js` |
| 医生认证 | `src/views/product/doctor-certification` | `src/api/product/doctor-certification.js` | `doctor-certifications.json`、`doctors.json` + `server.js` |
| 审核题库 | `src/views/product/question-bank` | `src/api/product/question-bank.js` | `question-bank.json`、`question-bank.js` + `server.js` |
| 任务 | `src/views/product/task` | `src/api/product/task.js` | `tasks.json`、`doctors.json`、`question-bank.json` + `server.js` |
| 审核 | `src/views/product/review` | `src/api/product/review.js` | `reviews.json`、`tasks.json`、`question-bank.json` + `server.js` |
| 提现 | `src/views/product/withdrawal` | `src/api/product/withdrawal.js` | `withdrawals.json` + `server.js` |
| 医生端配置 | `src/views/product/doctor-config` | `src/api/product/doctor-config.js` | `doctor-config.json` + `server.js` |

动态业务菜单不直接写进框架路由。菜单和字典由 `mock-api/data/bootstrap.json` 中的 `/core/system/user` 启动数据返回。当前顺序为：医生管理 → 医生认证 → 审核题库 → 任务管理 → 审核记录 → 提现管理 → 系统设置。

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

- 医生账号禁用和开启
- 题库题目新增、编辑和状态变更
- 手动创建任务
- 名单导入、创建账号/任务并分配题目
- 提现名单导出、已结算名单导入及状态回写
- 工作台对应统计联动

重启 Mock 后，上述状态恢复到 `mock-api/data/*.json` 的初始值。这是当前原型的设计，不是数据丢失 Bug。

模拟身份证和银行卡均为无效测试号码，不是真实个人数据。后续仍禁止提交真实患者信息、真实身份证、真实银行卡、访问令牌或生产密钥。

补充说明：

- `doctors.json` 只显式保存代表性记录，Mock 启动时会确定性补足到 120 人。`doctor-certifications.json` 保存代表性认证记录，其余已提交记录会按医生状态确定性补足；认证详情中的执业证附件为明确标注的原型示意图，不是真实证件。
- `question-bank.json` 定义模拟药品规格、36 类题型和五类风险规则，Mock 启动时确定性扩展为题目库，并通过药品检索 API 模拟“AI 数智人药师药品库”对接；它不是经专业审定的生产医药内容。
- 初始模拟任务会确定性匹配审核题库并生成 1,000 条任务明细，任务的 A/B/C 数量、总积分和题目快照均从题库计算，不保留固定 50 积分数据。同一道题允许分给不同医生，但同一医生不会重复分配。
- 审核记录由任务明细的前 `completed_count` 条、医生信息和 `reviews.json` 的结论模板确定性生成，不是医生端真实提交。每条记录的药品、问题、答案、题型、档位和积分均冻结自对应题库行；医生科室使用 `doctor_department`，题目科室使用 `question_department`。
- 初始提现记录按来源任务中连续的已完成题目明细重算金额，确保每笔提现等于所覆盖题目的 A/B/C 积分之和。
- 如果修改了 `server.js` 却仍命中旧路由或旧数据，先确认并重启 `3010` 上的 Mock 进程。

## 9. 明确未实现

后台 V1 已按最新功能导图补齐医生认证模块；附图之外仍不从旧原型恢复延期菜单。整个产品仍缺少：

- 医生端微信小程序或移动端 H5。
- 手机号登录、微信授权、首次激活、认证资料提交/重新提交和资料补全。
- 医生本人任务列表、任务详情和开始/继续审核。
- 医生逐条提交审核、暂停继续、进度保存和真实任务完成。
- 医生审核历史、钱包和提交提现。
- 经专业审定的生产题库内容及其实际导入链路；当前仅有 Mock 题目库与任务快照关系。
- 真实 AI 数智人药师药品库的网络对接与鉴权；当前 Mock 只提供同类的检索选择契约。
- 真实短信、订阅消息和通知。
- 真实数据库、生产鉴权、数据加密、持久化审计日志和细粒度权限。
- 身份证/银行卡四要素校验及合规存储。
- 基金会后台、自动支付或自动结算结果回传。
- 企业/区域、志愿者/代表端、数字人和科普。
- 精细的科室—疾病—药品匹配。

继承自 SaiAdmin 的 `src/views/system/` 等页面可用于参考，但对应 Mock 并未全部实现，不属于当前业务验收范围。

## 10. 下一阶段建议

完成本轮 V5.0 题库与任务匹配后，下一阶段应单独开发医生端，建议顺序：

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
- V5.0 的逐条计价已按最终 A/B/C 等级确定；医生端需进一步确认逐条入账还是整任务完成后入账。
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
- 题库药品检索选择（名称/规格/厂家）、科室筛选、题目查询、详情、编辑和状态变更可用；药品信息不可手填，科室归属只能选择启用配置项，风险标签选择与规则说明上下排列，AI 回答只保留单一文本域，风险标签与操作记录无英文展示。
- 任务搜索、详情、按目标积分创建、XLSX/CSV 预览和确认导入可用；题目最终积分之和与任务目标一致，且任务项快照完整。
- 手动创建任务从下拉选择已有医生（未找到时先到医生管理新增）；名单导入时新手机号创建待激活医生、已有正常手机号复用原账号；任务列表和详情正确显示禁用状态，已禁用医生无法被分配任务或通过名单导入。
- 医生、审核和提现列表/详情正常，敏感字段保持脱敏；医生账号可禁用和重新开启。
- 医生认证筛选、详情、脱敏证件信息和示意附件可见；通过前必须确认材料核对，驳回原因必填。
- 提现导出前有敏感信息确认，导出文件包含「结算状态」列且初始值为「已导出」。
- 导出后待导出变为 0、记录变为已导出、工作台待办同步消失。
- 将导出名单中的「结算状态」改为「已结算」后可以预览并导回系统；只有已导出记录更新为已结算，待导出和已结算记录均跳过。
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

当前只保证 `src/views/product/` 下的希息药事业务模块。SaiAdmin 继承页面并非都已实现 Mock。

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
当前项目是希息药事后台 V1：Vue 3 + JavaScript + SaiAdmin + Arco Design Vue，
页面必须通过 src/api → Axios → /dev → Mock API 获取数据。
后台已有医生、医生认证、审核题库、任务、审核记录、提现与医生端配置模块，不要从旧 HTML 原型恢复延期功能。
先复述当前分支、已有模块、开发边界和验证方式，再开始本次需求。
```
