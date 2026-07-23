# 项目设计与开发规范

本目录是 AI 和人工开发 SaiAdmin 后台功能时的本地执行标准。官网用于查 API 和理解设计背景，真正约束本项目的规则必须写在这里。

换电脑、移交项目或开启新的开发会话时，先阅读 [`HANDOFF.md`](./HANDOFF.md)。

## 适用范围

- 首先约束 `src/views/product/`、`src/api/product/` 和对应 Mock 模块。
- 修改已有页面时，新改动也必须遵守本规范；不要求为了新增一个功能顺带重构所有继承页面。
- `src/views/system/` 可用于理解 SaiAdmin 写法，但不代表它已经符合本规范，也不代表对应接口已被 Mock 实现。

## 规范分层

| 层级 | 负责内容 | 本项目落点 |
| --- | --- | --- |
| Arco Design | 视觉基础、交互原则、Vue 基础组件 | [`design-system.md`](./design-system.md) |
| SaiAdmin | 后台布局、主题、权限、`Sa*` / `Ma*` 业务组件 | [`components.md`](./components.md) |
| 本项目 | 页面模式、业务文案、API/Mock 契约、验收流程 | [`page-patterns.md`](./page-patterns.md)、[`feature-workflow.md`](./feature-workflow.md) |

发生冲突时，按以下顺序处理：

1. 当前明确的产品需求和验收标准。
2. 根目录 `CLAUDE.md` 中的项目硬规则。
3. 本目录中的设计基础、组件选择、页面模式和功能流程。
4. 当前仓库中最近、最接近的本地实现。
5. Arco Design Vue 官方文档。
6. 外部文章、代码片段或 AI skill。

不能为了照搬旧页面而违反本地规范；也不能为了照搬官网示例而绕过 SaiAdmin 已有封装。

## 开始一个新功能

按顺序完成下面的工作：

1. 阅读 [`design-system.md`](./design-system.md)，确定布局、层级、状态和响应式规则。
2. 阅读 [`components.md`](./components.md)，优先复用已有 `Sa*` / `Ma*` 组件，并确认所需 Mock 是否已存在。
3. 从 [`page-patterns.md`](./page-patterns.md) 选择列表、表单、详情或仪表盘模式。
4. 按 [`feature-workflow.md`](./feature-workflow.md) 同步建立页面、API、Mock 数据、Mock 路由和动态菜单。
5. 验收正常、加载、空、错误、权限、长内容和移动端状态。

## 技术基线

- Vue 3 + JavaScript；新页面使用 `<script setup>`，不新增 TypeScript 写法。
- UI 基线为 `@arco-design/web-vue`。当前 `package.json` 声明 `^2.57.0`，当前锁定安装版本为 `2.57.0`。
- 只参考 Arco Design Vue 的组件名称、属性和示例，不复制 React API。
- 使用远程 AI skill 时，只能采用其中的 `arco-design-vue` 内容；如果它与本仓库 JavaScript、SaiAdmin 封装或已安装版本冲突，以本仓库为准。
- 不引入 Element Plus、Ant Design Vue 等第二套 UI 组件库。

依赖升级后，先以本地 `node_modules/@arco-design/web-vue` 类型和运行结果校验，再更新本目录中的版本说明和示例。

## 官方参考

这些链接用于追溯原则和查询 API，不替代本地规则：

- [Arco Design 设计原则](https://arco.design/docs/spec/philosophy)
- [Arco Design 样式指南](https://arco.design/docs/spec/style-guideline)
- [Arco Design Vue 快速上手](https://arco.design/vue/docs/start)
- [Arco Design Vue 组件文档](https://arco.design/vue/component/overview)
- [Arco Design Vue 官方仓库](https://github.com/arco-design/arco-design-vue)
- [Arco Design AI skill 的 Vue 目录](https://github.com/arco-design/arco-design-skill/tree/main/skills/arco-design-vue)

## 维护方式

- 出现新的稳定页面模式或重复业务组件时，先更新对应文档，再推广到后续页面。
- 文档中的组件属性必须由本地源码或当前 Vue 官方文档验证，不能记录想当然的 API。
- 规范变更需要说明受影响页面；没有明确需求时，不批量改造框架层和历史页面。
