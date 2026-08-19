# 组件选择与使用规范

本项目的组件顺序固定为：

1. 已有 SaiAdmin `Sa*` / `Ma*` 业务组件。
2. Arco Design Vue 基础组件。
3. 当前模块内的业务组件。
4. 只有跨模块稳定复用后，才考虑项目级共享组件。

禁止引入第二套 UI 库，也不要在已有 `Sa*` 封装时重新拼一套功能相同的原生 Arco 组件。

## 选择矩阵

| 场景 | 首选 | 使用原生 Arco Vue 的边界 |
| --- | --- | --- |
| 标准分页 CRUD 列表 | `SaTable` | 纯本地小表、静态展示表、表格内复杂编辑且不需要 CRUD 工具栏时使用 `a-table` |
| 字典下拉、单选、多选 | `SaSelect`、`SaRadio`、`SaCheckbox` | 选项来自页面实时 API、需要远程搜索或临时局部选项时使用对应 Arco 组件 |
| 字典值展示 | `SaDict` 或 `SaTable` 的 `type: 'dict'` 列 | 非字典的临时状态可以使用 `a-tag` |
| 后端状态码切换 | `SaSwitch` | 纯前端布尔开关、值不是后端状态码时使用 `a-switch` |
| 左侧树筛选 | `SaTreeSlider` | 表单中的层级选择使用 `a-tree-select`，普通树交互使用 `a-tree` |
| 用户选择 | `SaUser` | 数据量很小、单字段、无回显要求时可以使用 `a-select` |
| 图片/文件/分片上传 | `SaUploadImage`、`SaUploadFile`、`SaUploadChunk` | 完全本地、无需附件契约的临时上传才使用 `a-upload` |
| 已上传资源选择 | `SaPickImage`、`SaResourceButton`、`SaResource` | 只预览图片时使用 `a-image` |
| 图表 | `SaChart` | 不直接嵌入 `vue-echarts`；确需未注册图表类型时先评估并补充统一注册 |
| 图标 | `SaIcon`、`SaIconPicker` | 固定的单个 Arco 图标可直接使用 `<icon-*>` |
| 富文本、颜色、地区 | `MaWangEditor`、`MaColorPicker`、`MaCityLinkage` | 普通长文本使用 `a-textarea` |
| 表单、容器、布局、反馈 | Arco Vue | 使用 `a-form`、Grid、Card、Modal、Drawer、Spin、Empty、Result 等基础组件 |

`src/views/system/` 中已有页面可作为结构参考，但必须先检查组件 API 和 Mock 覆盖，不能直接认定它是可运行模板。

## 全局组件目录

以下组件已在 `src/components/index.js` 全局注册，页面无需 import。

| 组件 | 用途 | 关键属性或事件 | 数据 / Mock 状态 |
| --- | --- | --- | --- |
| `SaTable` | 搜索、分页、权限、CRUD 工具栏 | `options`、`columns`、`searchForm`；暴露 `refresh` | 每个业务模块必须提供列表 API |
| `SaSelect` | 字典下拉 | `dict`、`modelValue`、`allowClear`、`disabled` | 依赖 `/core/system/dictAll` |
| `SaRadio` | 字典单选 | `dict`、`type`、`direction`、`allowNull` | 依赖 `/core/system/dictAll` |
| `SaCheckbox` | 字典多选 | `dict`、`modelValue` 数组、`direction` | 依赖 `/core/system/dictAll` |
| `SaDict` | 字典文本或标签展示 | `value`、`dict`、`render="tag\|span"`、`options` | 依赖字典，或直接传 `options` |
| `SaSwitch` | 状态码切换 | `checkedValue`、`uncheckedValue`、`loading`、`change` | 页面必须接入对应状态 API |
| `SaTreeSlider` | 可搜索树形侧栏 | `data`、`fieldNames`、`searchPlaceholder`、`click` | 由页面传数据，模块自行提供 API |
| `SaUser` | 用户选择和回显 | `modelValue` 数组、`multiple`、`onlyId`、`success` | 当前 Mock 未实现依赖接口 |
| `SaUploadImage` | 图片上传 | `multiple`、`size`、`limit`、`mode`、`accept` | 当前 Mock 未实现上传接口 |
| `SaUploadFile` | 文件上传 | `multiple`、`size`、`limit`、`mode`、`accept` | Mock 已实现公示文档 PDF 上传；其他文件类型仍需按业务补齐契约 |
| `SaUploadChunk` | 大文件分片上传 | `size`、`limit`、`accept` 等 | 当前 Mock 未实现分片接口 |
| `SaResource` | 通用资源选择内容 | `multiple`、`onlyData`、`returnType` | 当前 Mock 未实现资源接口 |
| `SaResourceButton` | 按钮式资源选择 | `multiple`、`onlyData`、`width` | 当前 Mock 未实现资源接口 |
| `SaPickImage` | 已上传图片选择 | `multiple`、`limit`、`returnType`、`small` | 当前 Mock 未实现资源接口 |
| `SaChart` | ECharts 统一容器 | `options`、`autoresize`、`width`、`height` | 页面传图表配置；无固定 API |
| `SaIcon` | Iconify 图标显示 | `icon`、`size` | 纯前端可用 |
| `SaIconPicker` | 图标选择 | `modelValue`、`preview` | 纯前端可用 |
| `MaWangEditor` | 富文本编辑 | `height`、`mode`、`customField` | 编辑可用；上传图片仍需补 Mock |
| `MaColorPicker` | 颜色选择 | `modelValue`、`type` | 纯前端可用 |
| `MaCityLinkage` | 省市区联动 | `modelValue`、`mode` 等 | 使用本地地区数据 |

`MaCodeEditor` 和 `MaVerifyCode` 存在于 `src/components/`，但没有全局注册。确需使用时必须局部 import；`MaVerifyCode` 当前没有视图使用案例。

## SaTable 标准

### 必要配置

```js
const options = reactive({
  api: api.getPageList,
  rowSelection: { showCheckedAll: true },
  add: { show: true, func: () => editRef.value?.open('add') },
  edit: { show: true, func: (record) => editRef.value?.open('edit', record) },
  delete: { show: true, func: deleteRows }
})

const columns = reactive([
  { title: '名称', dataIndex: 'name', minWidth: 160 },
  { title: '状态', dataIndex: 'status', type: 'dict', dict: 'data_status', width: 100 },
  { title: '创建时间', dataIndex: 'create_time', width: 180 }
])
```

规则：

- `options.api` 必须是调用 `src/api` 的函数，不能直接读取 fixture。
- 列字段名使用 `dataIndex`；不要照搬其他库或远程示例中的 `field`。
- 每行必须有稳定唯一的主键；默认主键为 `id`，其他主键通过 `options.pk` 指定。
- 识别对象的关键列可固定左侧，操作列由 `SaTable` 固定在右侧；操作列宽度按真实操作数量设置。
- 文本左对齐，数字按比较需求右对齐，状态和短操作可居中。
- 长文本用省略和 Tooltip，完整信息进入详情；不能无限拉宽页面。

### 请求参数

`SaTable` 会自动组合以下参数：

```json
{
  "page": 1,
  "limit": 10,
  "orderBy": "create_time",
  "orderType": "desc"
}
```

搜索表单字段会合并进同一请求。搜索、重置和修改每页条数后都应回到第 1 页。

### 分页响应

标准业务列表统一返回：

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

`SaTable` 实际读取 `response.data.data` 和 `response.data.total`。非分页本地数组虽然可以直接放在外层 `data`，但产品列表不得因此省略分页契约。

当前 `SaTable` 已有 Table loading 和 Arco 默认空态，但没有单独的请求错误状态。标准产品页按 [`page-patterns.md`](./page-patterns.md) 包装 `options.api` 并在表格上方显示可重试 Alert；不要把错误响应转换成“暂无数据”后静默处理。需要区分初始空与搜索空的文案时，使用现有 `crudContent` 插槽，或在真实功能需求出现后统一增强组件。

单删和批删的参数统一为：

```json
{ "ids": [1, 2] }
```

成功后调用 `crudRef.value?.refresh()`；失败时保留当前筛选和分页，提供可恢复反馈。

### 何时使用 a-table

只有下面情况直接使用 `a-table`：

- 卡片内的少量静态数据。
- 表单中的本地明细编辑表。
- 不需要搜索、分页、权限、导入导出和 CRUD 工具栏的嵌入表。

## 字典组件标准

字典由登录初始化时的 `/core/system/dictAll` 加载。新增字典先更新 Mock fixture 和未来后端契约，再在页面引用同一个 key。

```json
{
  "data_status": [
    { "label": "启用", "value": "1", "color": "green" },
    { "label": "停用", "value": "2", "color": "gray" }
  ]
}
```

- 新字典的 `value` 统一使用字符串。`SaSelect` 和 `SaRadio` 会把绑定值转成字符串，数字与字符串混用会导致选中态或回显异常。
- 现有 `bootstrap.json` 中的数字字典值属于待兼容数据；相关功能被正式使用时一并统一，不在无关改动中批量处理。
- `SaSelect` 虽声明 `fieldNames`，当前实现没有把它传给 `a-select`，不得依赖该属性完成字段映射。
- 页面中出现的新字典 key 必须在 Mock 中真实存在，不能只写组件标签。
- 临时且只在一个页面使用的选项可以直接用 Arco `a-select`，不必污染全局字典。

## 当前 Mock 缺口

当前 Mock 只覆盖登录、用户启动信息、全量字典、仪表盘统计、登录趋势、个人中心最近登录/操作日志、公告和清缓存。下列组件一旦启用会请求尚未实现的接口，必须先按 [`feature-workflow.md`](./feature-workflow.md) 补齐 Mock：

| 能力 | 缺失接口 |
| --- | --- |
| 用户选择 | `GET /core/dept/index?tree=true`、`GET /core/system/getUserList`、`POST /core/system/getUserInfoByIds` |
| 图片上传 | `POST /core/system/uploadImage` |
| 文件上传 | `POST /core/system/uploadFile` |
| 分片上传 | `POST /core/system/chunkUpload` |
| 资源列表 | `GET /core/system/getResourceList` |
| 网络图片保存 | `POST /core/system/saveNetworkImage` |
| 表格导入/导出 | 对应页面在 `options.import.url`、`templateUrl`、`options.export.url` 中声明的模块接口 |

“组件已经存在”不等于“当前 Mock 已支持”。未补接口时，不得把该交互标记为已完成。

## Arco Vue 基础组件边界

没有 SaiAdmin 封装时，直接使用 Arco Vue：

- 输入：`a-form`、`a-form-item`、`a-input`、`a-textarea`、`a-input-number`、`a-date-picker`、`a-range-picker`。
- 布局：`a-row`、`a-col`、`a-grid`、`a-space`、`a-divider`。
- 容器：`a-card`、`a-tabs`、`a-descriptions`、`a-modal`、`a-drawer`。
- 反馈：`a-spin`、`a-skeleton`、`a-empty`、`a-alert`、`a-result`、`Message`、`Notification`、`a-popconfirm`。

组件属性、事件和插槽只查 [Arco Design Vue 文档](https://arco.design/vue/component/overview) 或本地 2.57.0 源码，不使用 React 文档推断 Vue API。

## 已知使用护栏

- `SaChart` 的属性名是 `options`，正确写法为 `<sa-chart :options="chartOptions" />`，不是 `:option`。
- `MaCodeEditor` 必须局部 import。
- `SaSwitch` 只负责值映射和交互，页面仍要实现 API、loading、失败回滚和具体结果文案。
- 上传、资源选择、导入和导出需要真实 HTTP Mock；不能用页面内假数据绕过。
- 业务组件优先放在 `src/views/product/<module>/components/`。只有在多个模块稳定复用且语义一致时，才迁移到项目共享组件目录。
