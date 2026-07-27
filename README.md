# 希息药事后台 V1

基于 SaiAdmin Vue 5.x 的希息药事审核业务运营后台原型。页面始终通过 `src/api` 发起真实 HTTP 请求；开发环境由独立的 `mock-api` 提供数据，不包含数据库和生产后端逻辑。

换电脑或交接开发时，先阅读完整的[开发交接文档](./docs/HANDOFF.md)。

## 架构

```text
Vue 页面 → src/api → Axios → Vite /dev 代理 → Mock API
                                               ↓ 后续替换
                                            真实后端
```

```text
src/views/product/    产品业务页面
src/api/product/      产品 API 模块
mock-api/src/         Mock HTTP 服务
mock-api/data/        JSON 示例数据
```

## 环境要求

- Node.js 20+
- Yarn 1.x

如果本机没有全局 Yarn，可使用：

```bash
npm exec --yes --package yarn@1.22.22 -- yarn install --frozen-lockfile
npm run dev:all
```

## 启动

安装全部工作区依赖：

```bash
yarn install
```

同时启动 Mock API 和前端：

```bash
yarn dev:all
```

- 前端：http://localhost:8888
- Mock API：http://127.0.0.1:3010
- 健康检查：http://127.0.0.1:3010/health

也可以分别运行：

```bash
yarn dev:mock
yarn dev
```

## 演示登录

- 用户名：`admin`
- 密码：`123456`
- 验证码：`1234`

## 设计与开发规范

本项目已经把 Arco Design、SaiAdmin 组件和 AI 原型开发约束落为本地执行文档。官网用于查 API，本地文档决定本项目实际怎么做：

- [规范入口与优先级](./docs/README.md)
- [设计基础：颜色、字号、间距、状态、响应式和无障碍](./docs/design-system.md)
- [组件指南：20 个全局组件、真实 Props 和 Mock 依赖](./docs/components.md)
- [页面模式：列表、表单、详情、仪表盘和通用状态骨架](./docs/page-patterns.md)
- [AI 新功能流程：页面、API、Mock、动态菜单和验收](./docs/feature-workflow.md)

新功能推荐按下面顺序完成：

```text
选择页面模式 → 选择现有组件 → 定义 API 契约 → 实现 Mock → 注册动态菜单 → 验证完整状态
```

基础 UI 只使用 Arco Design Vue；有对应 `Sa*` / `Ma*` 组件时优先复用。项目保持 Vue 3 + JavaScript，不复制 React API，也不引入第二套 UI 组件库。

## API 约定

所有页面只能调用 `src/api` 中的函数，Mock 和未来真实后端使用同一接口：

```json
{
  "code": 200,
  "message": "success",
  "data": {}
}
```

开发环境通过 `.env.development` 将 `/dev` 请求代理到 `http://127.0.0.1:3010`。接入真实后端时，只修改环境地址，不在页面中增加 Mock 分支。

### 当前 Mock 覆盖

当前 Mock 已覆盖登录、用户启动信息、动态菜单和字典，以及希息药事工作台、任务管理、医生管理、审核记录、提现管理的 V1 HTTP 链路。继承的系统管理页面仍有大量接口未实现，因此可以参考其页面结构，但不代表它们当前都能运行。

用户选择、资源选择、图片/文件上传、分片上传、表格导入导出等组件需要额外 Mock 端点。使用前先查看 [组件指南中的 Mock 缺口](./docs/components.md#当前-mock-缺口)，并按 [AI 新功能开发流程](./docs/feature-workflow.md) 补齐真实 HTTP 行为。

## 验证

```bash
yarn mock:check
yarn build
```

没有全局 Yarn 时，验证命令可对应改为 `npm run mock:check` 和 `npm run build`。

当前基础仓库：[RegenLau/saiadmin-base](https://github.com/RegenLau/saiadmin-base)。原项目采用 MIT License。
