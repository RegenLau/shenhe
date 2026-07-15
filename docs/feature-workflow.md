# AI 新功能开发流程

本项目的目标是用 AI 快速搭建可交互后台前端，同时保持未来可替换真实后端。完成一个功能必须形成下面的最小闭环：

```text
动态菜单 → Vue 页面 → src/api → Axios → /dev 代理 → Mock HTTP 路由 → fixture / 内存状态
```

只有页面、API 和 Mock 同时可运行，功能才算完成。静态页面、页面内假数据、未接通按钮都不算完成。

## 目录约定

以 `example` 模块为例：

```text
src/views/product/example/
├── index.vue              # 列表或入口页
├── edit.vue               # 新增/编辑
├── view.vue               # 详情
└── components/            # 当前模块私有组件

src/api/product/example.js # 页面唯一的数据访问入口
mock-api/data/example.json # 初始 fixture
mock-api/src/server.js      # 当前阶段的 HTTP Mock 路由
```

- 业务页面放在 `src/views/product/`，不塞进 `system`、`tool` 或框架目录。
- 页面、API 文件和 Mock 路由使用同一个模块名。
- 页面只能 import `src/api`，不能 import `mock-api/data`、fixture 或 Mock server。
- Mock 只模拟接口契约和必要业务行为，不引入数据库、ORM、迁移或生产后端逻辑。
- Mock 内存中的新增、编辑和删除在服务重启后允许恢复为 fixture 初始值。

## 第一步：先定义 API 契约

开始写页面前，先列出用户动作和接口：

| 用户动作 | 方法 | 路径 | 成功数据 |
| --- | --- | --- | --- |
| 查询列表 | `GET` | `/core/product/example/index` | 分页对象 |
| 查看详情 | `GET` | `/core/product/example/read?id=1` | 单条对象 |
| 新建 | `POST` | `/core/product/example/save` | 新对象 |
| 编辑 | `PUT` | `/core/product/example/update?id=1` | 更新后对象 |
| 删除/批量删除 | `DELETE` | `/core/product/example/destroy` | 空对象或删除数量 |
| 修改状态 | `POST` | `/core/product/example/changeStatus` | 更新后状态 |

所有 JSON 响应统一使用：

```json
{
  "code": 200,
  "message": "success",
  "data": {}
}
```

分页响应统一使用：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "data": [],
    "total": 0,
    "current_page": 1,
    "per_page": 10
  }
}
```

约束：

- `code` 是业务状态，成功固定为 `200`；错误提供用户可理解的 `message`。
- 分页请求使用 `page`、`limit`；排序使用 `orderBy`、`orderType=asc|desc`。
- 删除参数使用 `{ ids: [] }`，同时覆盖单条和批量。
- 字段名、枚举值和空值约定要与未来后端保持一致，不能为 Mock 单独发明页面分支。
- 日期时间使用 `YYYY-MM-DD HH:mm:ss`；字典值按 [`components.md`](./components.md) 使用字符串。

## 第二步：建立 API 模块

`src/api/product/example.js`：

```js
import { request } from '@/utils/request.js'

export default {
  getPageList(params = {}) {
    return request({
      url: '/core/product/example/index',
      method: 'get',
      params
    })
  },

  read(id) {
    return request({
      url: '/core/product/example/read',
      method: 'get',
      params: { id }
    })
  },

  save(data = {}) {
    return request({
      url: '/core/product/example/save',
      method: 'post',
      data
    })
  },

  update(id, data = {}) {
    return request({
      url: '/core/product/example/update',
      method: 'put',
      params: { id },
      data
    })
  },

  destroy(data = {}) {
    return request({
      url: '/core/product/example/destroy',
      method: 'delete',
      data
    })
  },

  changeStatus(data = {}) {
    return request({
      url: '/core/product/example/changeStatus',
      method: 'post',
      data
    })
  }
}
```

页面不拼 URL、不直接调用 Axios、不判断是否处于 Mock 环境。未来接真实后端时只调整环境地址或保持同一契约。

## 第三步：建立 fixture 与 Mock 行为

`mock-api/data/example.json` 只保存初始数据：

```json
[
  {
    "id": 1,
    "code": "EX-001",
    "name": "示例数据",
    "status": "1",
    "remark": "用于验证正常和长文本状态",
    "create_time": "2026-07-15 09:30:00"
  }
]
```

在 `mock-api/src/server.js` 中加载 fixture，并复制为可变内存数据：

```js
const examplePath = fileURLToPath(new URL('../data/example.json', import.meta.url))
const exampleFixture = JSON.parse(readFileSync(examplePath, 'utf8'))
let exampleRows = exampleFixture.map((item) => ({ ...item }))
```

产品接口必须鉴权。在产品路由前注册：

```js
app.use('/core/product', requireAuth)
```

标准列表路由：

```js
app.get('/core/product/example/index', (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1)
  const limit = Math.max(Number(req.query.limit) || 10, 1)
  const keyword = String(req.query.keyword || '').trim().toLowerCase()
  const status = String(req.query.status || '')

  const filtered = exampleRows.filter((item) => {
    const matchKeyword = !keyword || [item.code, item.name]
      .some((value) => String(value).toLowerCase().includes(keyword))
    const matchStatus = !status || String(item.status) === status
    return matchKeyword && matchStatus
  })

  const start = (page - 1) * limit
  res.json(success({
    data: filtered.slice(start, start + limit),
    total: filtered.length,
    current_page: page,
    per_page: limit
  }))
})
```

CRUD 行为至少做到：

- `read`：id 存在时返回对象，不存在时返回 `failure(404, '数据不存在')`。
- `save`：校验必填字段，生成唯一 id 和创建时间，写入内存数组。
- `update`：只更新存在的对象；返回更新后的完整对象。
- `destroy`：接收 `{ ids: [] }`，过滤内存数组，返回实际删除数量。
- `changeStatus`：校验状态枚举，返回更新后的 id 和 status。
- 校验失败使用清楚消息，例如“名称不能为空”，不能只返回“参数错误”。

Mock 行为要支持真实交互，但不需要实现持久化、复杂权限模型或与当前原型无关的业务引擎。

## 第四步：注册动态菜单

新增产品页通常不直接改框架路由。当前路由由 `/core/system/user` 返回的 `userInfo.routers` 动态注册，组件路径会解析到 `src/views/<component>.vue`。

在 `mock-api/data/bootstrap.json` 的 `userInfo.routers` 中加入：

```json
{
  "name": "productExample",
  "path": "/product/example",
  "component": "product/example/index",
  "meta": {
    "title": "示例管理",
    "icon": "icon-apps",
    "type": "M"
  }
}
```

规则：

- `name` 在全项目唯一，使用稳定英文标识。
- `component` 不带 `src/views/` 前缀和 `.vue` 后缀。
- 菜单标题与页面标题使用同一业务名称。
- 按钮权限需要时同步更新 `codes` 和 `options.*.auth`；当前原型的 `codes: ['*']` 仅代表全权限演示。
- 修改 bootstrap 后重新登录或清理本地登录状态，确保重新拉取路由和字典。

## 第五步：按页面模式实现

从 [`page-patterns.md`](./page-patterns.md) 选择页面骨架，从 [`components.md`](./components.md) 选择组件。

实现时逐项确认：

- 页面所有数据都经 `src/api` 发起 HTTP 请求。
- 使用 `SaTable` 时 Mock 返回 `data.data` 和 `data.total`。
- 使用字典组件时，对应字典 key 和字符串 value 已在 `dictAll` 中存在。
- 使用用户选择、资源、上传、导入或导出前，已补齐组件依赖的 Mock 端点。
- 新增/编辑成功后刷新列表；失败时保留输入。
- 状态切换失败时回滚界面值，不能显示成已成功。
- 删除说明对象和后果；批量删除说明数量。
- 所有异步区域都有加载、空、错误和重试设计。

## Mock 场景清单

每个功能至少准备能验证下面状态的数据和行为：

| 场景 | 准备方式 |
| --- | --- |
| 正常列表 | 至少 2 条不同状态数据 |
| 搜索无结果 | 使用必然不匹配的关键词，接口返回空分页而非错误 |
| 长内容 | 准备超长名称、备注或多标签数据，检查省略和详情 |
| 表单校验 | 空必填、错误格式、超过长度 |
| 业务失败 | Mock 对无效 id、重复值或非法状态返回具体错误 |
| 接口失败 | 临时触发错误响应，页面保留状态并提供恢复入口 |
| 空数据 | fixture 为空或筛选后为空，文案与搜索无结果有区别 |
| 权限 | 移除对应 code，确认按钮隐藏或整页显示 403 |

不要为了展示错误态在页面里写 `if (isMock)`；所有状态都通过正常的 API 结果和页面状态机产生。

## 完成定义

一个 AI 新增功能只有满足全部条件才算完成：

### 功能链路

- 菜单可见并能进入正确页面，刷新后路由仍有效。
- 浏览器网络面板能看到页面请求 `/dev/core/...`，而不是读取本地 fixture。
- 列表、搜索、重置、分页、查看、新建、编辑、删除等需求内操作真实可用。
- 页面、API、Mock 的字段名、枚举和错误契约一致。
- 当前未实现的按钮不伪装成可用状态。

### 用户体验

- 正常、加载、初始空、搜索无结果、错误、权限和长内容均已检查。
- 破坏性操作有确认；提交期间不能重复点击；失败后可恢复。
- 在 `1440px`、`1024px` 和 `375px` 宽度检查布局。
- 浅色、深色和更换主题色后仍可读、可操作。
- 键盘可以完成主流程，焦点可见；图标按钮有 Tooltip 和可识别名称。

### 工程验证

```bash
yarn mock:check
yarn build
curl http://127.0.0.1:3010/health
```

- `yarn mock:check` 当前主要验证 Mock server 语法，不能替代实际接口和浏览器流程检查。
- 前后端联调改动使用 `yarn dev:all`，确认 Vite `/dev` 代理确实到达 `127.0.0.1:3010`。
- 没有全局 Yarn 时使用 README 中的 npm fallback。

## 禁止项

- 页面直接 import fixture、JSON 或 `mock-api` 文件。
- 在 Vue 页面中根据环境写两套数据分支。
- 只做静态表格或 Modal 外观，不实现点击后的 API 行为。
- 为原型引入数据库、ORM 或生产后端框架。
- 直接修改框架路由、布局或全局组件来绕过动态菜单和模块边界。
- 复制 React 或 TypeScript 示例到当前 JavaScript 项目。
- 未验证 Mock 端点时宣称上传、用户选择、导入导出等能力已完成。
