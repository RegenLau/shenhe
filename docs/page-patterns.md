# 页面模式

新功能先选择最接近的页面模式，再替换业务字段和 API。不要从空白页随意组合，也不要直接复制一个未接 Mock 的历史系统页。

代码中的 `example`、“数据”等是结构占位符；复制后必须替换为具体业务模块和业务对象名称。

## 标准列表页

适用于绝大多数后台查询和 CRUD 页面。文件通常为 `src/views/product/<module>/index.vue`。

```vue
<template>
  <div class="ma-content-block">
    <a-alert v-if="tableError" type="error" class="m-4">
      {{ tableError }}
      <template #action>
        <a-button size="small" @click="refresh">重新加载</a-button>
      </template>
    </a-alert>

    <sa-table ref="crudRef" :options="options" :columns="columns" :searchForm="searchForm">
      <template #tableSearch>
        <a-col :xs="24" :sm="8">
          <a-form-item field="keyword" label="关键词">
            <a-input v-model="searchForm.keyword" placeholder="请输入名称或编号" allow-clear />
          </a-form-item>
        </a-col>
        <a-col :xs="24" :sm="8">
          <a-form-item field="status" label="状态">
            <sa-select v-model="searchForm.status" dict="data_status" placeholder="请选择状态" />
          </a-form-item>
        </a-col>
        <a-col :xs="24" :sm="8">
          <a-form-item field="create_time" label="创建时间">
            <a-range-picker v-model="searchForm.create_time" style="width: 100%" />
          </a-form-item>
        </a-col>
      </template>

      <template #status="{ record }">
        <sa-dict :value="record.status" dict="data_status" />
      </template>
    </sa-table>

    <edit-form ref="editRef" @success="refresh" />
    <view-form ref="viewRef" />
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import api from '@/api/product/example'
import EditForm from './edit.vue'
import ViewForm from './view.vue'

const crudRef = ref()
const editRef = ref()
const viewRef = ref()
const tableError = ref('')

const searchForm = ref({
  keyword: '',
  status: '',
  create_time: []
})

const deleteRows = async (params) => {
  const response = await api.destroy(params)
  if (response.code === 200) {
    Message.success('数据删除成功')
    crudRef.value?.refresh()
  }
}

const loadList = async (params) => {
  try {
    const response = await api.getPageList(params)
    if (response.code === 200) {
      tableError.value = ''
      return response
    }
    tableError.value = response.message || '列表加载失败，请重新加载'
  } catch {
    tableError.value = '列表加载失败，请检查网络后重试'
  }

  return { code: 200, message: 'fallback', data: { data: [], total: 0 } }
}

const options = reactive({
  api: loadList,
  rowSelection: { showCheckedAll: true },
  view: {
    show: true,
    func: (record) => viewRef.value?.open(record.id)
  },
  add: {
    show: true,
    text: '新建',
    func: () => editRef.value?.open('add')
  },
  edit: {
    show: true,
    func: (record) => editRef.value?.open('edit', record)
  },
  delete: {
    show: true,
    confirmText: '删除后无法恢复，确定删除这条数据吗？',
    func: deleteRows
  }
})

const columns = reactive([
  { title: '编号', dataIndex: 'code', width: 140, fixed: 'left' },
  { title: '名称', dataIndex: 'name', minWidth: 180 },
  { title: '状态', dataIndex: 'status', width: 100 },
  { title: '创建时间', dataIndex: 'create_time', width: 180 }
])

const refresh = () => crudRef.value?.refresh()

onMounted(refresh)
</script>
```

列表页规则：

- 搜索项默认 `xs=24 / sm=8`；超过 3 项时由 `SaTable` 自动切换多行布局。
- 主工具栏顺序为新建、批量操作、导入/导出、其他；同一组只保留一个主按钮。
- 高频筛选放在搜索区，不把所有列都做成列内筛选。
- 操作列只放完成当前任务需要的动作；超过 3 个时将低频动作收进“更多”。
- 请求失败不能显示成“暂无数据”。保留筛选条件，并提供重新加载入口。
- 搜索无结果显示“未找到符合条件的数据”，并提供重置筛选。
- 长文本省略后可通过 Tooltip 或详情查看；页面本身不能横向滚动。
- 当前 `SaTable` 原生覆盖 loading 和默认空态，但没有独立错误态；标准页面使用上面的 API 包装和 Alert。需要区分初始空与搜索空文案时，使用 `crudContent` 插槽或在需求明确后统一增强 `SaTable`，不能把错误伪装成空数据。

## 树 + 列表页

适用于部门、分类或目录筛选。沿用 SaiAdmin 的 `2/12 + 10/12` 桌面结构，小屏自动纵向堆叠。

```vue
<template>
  <div class="ma-content-block lg:flex justify-between">
    <aside class="lg:w-2/12 w-full p-4">
      <sa-tree-slider
        v-model="defaultKey"
        :data="treeData"
        search-placeholder="搜索分类"
        @click="switchNode"
      />
    </aside>

    <section class="lg:w-10/12 w-full">
      <sa-table ref="crudRef" :options="options" :columns="columns" :searchForm="searchForm" />
    </section>
  </div>
</template>
```

- 切换树节点后把节点 id 写入 `searchForm`，并让列表回到第 1 页。
- 重置搜索时保留当前树节点，除非产品明确要求回到“全部”。
- 树接口失败时在树区域提供重试，不让右侧列表被永久阻塞。
- 小屏先显示当前分类和切换入口，再显示列表；不能让左侧树压缩到不可点击。

## 新增 / 编辑表单

表单独立为 `edit.vue`，由父列表通过 `ref` 打开。下面是简单 Modal 表单骨架；中型表单把宽度改为 `720px`，复杂任务改用 Drawer 或独立页面。

```vue
<template>
  <a-modal
    v-model:visible="visible"
    :width="tool.getDevice() === 'mobile' ? '100%' : '520px'"
    :title="title"
    :mask-closable="false"
    :ok-loading="loading"
    unmount-on-close
    @before-ok="submit"
  >
    <a-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      :auto-label-width="true"
      scroll-to-first-error
    >
      <a-form-item field="name" label="名称">
        <a-input v-model="formData.name" placeholder="请输入名称" allow-clear />
      </a-form-item>
      <a-form-item field="status" label="状态">
        <sa-radio v-model="formData.status" dict="data_status" />
      </a-form-item>
      <a-form-item field="remark" label="备注">
        <a-textarea v-model="formData.remark" placeholder="请输入备注" :max-length="500" show-word-limit />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup>
import { computed, nextTick, reactive, ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import tool from '@/utils/tool'
import api from '@/api/product/example'

const emit = defineEmits(['success'])
const formRef = ref()
const mode = ref('add')
const visible = ref(false)
const loading = ref(false)

const initialFormData = {
  id: undefined,
  name: '',
  status: '1',
  remark: ''
}

const formData = reactive({ ...initialFormData })
const rules = {
  name: [
    { required: true, message: '请输入名称' },
    { maxLength: 50, message: '名称不能超过 50 个字符' }
  ],
  status: [{ required: true, message: '请选择状态' }]
}

const title = computed(() => (mode.value === 'add' ? '新建数据' : '编辑数据'))

const open = async (type = 'add', record = null) => {
  mode.value = type
  Object.assign(formData, initialFormData)
  if (record) {
    Object.keys(initialFormData).forEach((key) => {
      if (record[key] !== undefined && record[key] !== null) {
        formData[key] = record[key]
      }
    })
  }
  visible.value = true
  await nextTick()
  formRef.value?.clearValidate()
}

const submit = async (done) => {
  const errors = await formRef.value?.validate()
  if (errors) {
    done(false)
    return
  }

  loading.value = true
  try {
    const payload = { ...formData }
    const response = mode.value === 'add'
      ? await api.save({ ...payload, id: undefined })
      : await api.update(payload.id, payload)

    if (response.code !== 200) {
      done(false)
      return
    }

    Message.success(mode.value === 'add' ? '数据创建成功' : '数据保存成功')
    emit('success')
    done(true)
  } catch {
    done(false)
  } finally {
    loading.value = false
  }
}

defineExpose({ open })
</script>
```

表单规则：

- 每次打开都恢复初始值并清空旧校验；编辑数据只覆盖已定义字段。
- 必须配置 `field` 和 `rules`，错误显示在字段附近。
- 提交期间显示 loading，失败时保留输入并保持弹层打开。
- 关闭或切换记录时，如果存在未保存修改，需要离开确认。
- 不用固定延时模拟 loading，也不要在成功后继续调用 `done(false)`。
- 详情数据需要额外请求时，显示 Spin；加载失败时不能让用户提交半成品。

## 详情 Drawer

详情默认从右侧 Drawer 打开，桌面宽 `60%`、移动端 `100%`。简单字段使用 `a-descriptions`，长内容使用分组区块。

```vue
<template>
  <a-drawer
    v-model:visible="visible"
    :width="tool.getDevice() === 'mobile' ? '100%' : '60%'"
    title="查看详情"
    :footer="false"
    unmount-on-close
  >
    <a-spin :loading="loading" class="w-full">
      <a-result v-if="error" status="error" title="详情加载失败">
        <template #subtitle>请检查网络后重新加载</template>
        <template #extra>
          <a-button type="primary" @click="load">重新加载</a-button>
        </template>
      </a-result>

      <a-descriptions v-else :column="1" bordered>
        <a-descriptions-item label="编号">{{ data.code || '—' }}</a-descriptions-item>
        <a-descriptions-item label="名称">{{ data.name || '—' }}</a-descriptions-item>
        <a-descriptions-item label="状态">
          <sa-dict :value="data.status" dict="data_status" render="span" />
        </a-descriptions-item>
        <a-descriptions-item label="备注">{{ data.remark || '—' }}</a-descriptions-item>
      </a-descriptions>
    </a-spin>
  </a-drawer>
</template>

<script setup>
import { reactive, ref } from 'vue'
import tool from '@/utils/tool'
import api from '@/api/product/example'

const visible = ref(false)
const loading = ref(false)
const error = ref(false)
const currentId = ref()
const data = reactive({})

const load = async () => {
  loading.value = true
  error.value = false
  try {
    const response = await api.read(currentId.value)
    if (response.code === 200) {
      Object.assign(data, response.data)
    } else {
      error.value = true
    }
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

const open = async (id) => {
  currentId.value = id
  Object.keys(data).forEach((key) => delete data[key])
  visible.value = true
  await load()
}

defineExpose({ open })
</script>
```

- Drawer 内的二级详情需要明确返回入口，不能继续叠 Modal。
- 空值统一为 `—`；长文本允许换行，必要时拆成独立区块。
- 只读信息不使用 disabled 表单控件。
- 详情加载、错误和重试必须局限在 Drawer 内，不影响后面的列表。

## 仪表盘

仪表盘不是卡片堆砌。一个完整模块至少要说明指标定义、时间范围、单位和数据更新时间。

推荐结构：

1. 页面说明与全局时间筛选。
2. 2 至 4 个核心指标卡。
3. 趋势图或结构图，标题中说明口径和周期。
4. 异常、待办或近期明细，用于引导下一步行动。

```vue
<template>
  <a-row :gutter="[24, 24]">
    <a-col v-for="metric in metrics" :key="metric.key" :xs="24" :sm="12" :xl="6">
      <a-card :bordered="false">
        <a-statistic :title="metric.title" :value="metric.value" :suffix="metric.unit" />
        <div class="mt-2 text-xs" style="color: var(--color-text-3)">
          {{ metric.period }} · 更新于 {{ updatedAt }}
        </div>
      </a-card>
    </a-col>

    <a-col :xs="24" :xl="16">
      <a-card title="近 30 天趋势" :bordered="false">
        <sa-chart :options="trendOptions" height="320px" />
      </a-card>
    </a-col>

    <a-col :xs="24" :xl="8">
      <a-card title="待处理事项" :bordered="false">
        <!-- 使用列表、Empty 或 Error 状态 -->
      </a-card>
    </a-col>
  </a-row>
</template>
```

- `SaChart` 使用 `:options`，不是 `:option`。
- 卡片与图表分别处理 loading、empty、error，避免一个接口失败让整页空白。
- 图表 Tooltip、图例和单位保持一致，不能只靠颜色区分系列。
- 当前 `src/views/dashboard/components/work-panel.vue` 只有占位提示，不能作为产品仪表盘模板。

## 通用状态片段

### 区块错误与重试

```vue
<a-result status="error" title="数据加载失败">
  <template #subtitle>网络异常或服务暂时不可用</template>
  <template #extra>
    <a-button type="primary" @click="reload">重新加载</a-button>
  </template>
</a-result>
```

### 初始空与搜索无结果

```vue
<div class="text-center">
  <a-empty :description="hasFilters ? '未找到符合条件的数据' : '暂无数据'" />
  <a-space>
    <a-button v-if="hasFilters" @click="resetFilters">清空筛选</a-button>
    <a-button v-else type="primary" @click="create">新建数据</a-button>
  </a-space>
</div>
```

### 无权限

```vue
<a-result status="403" title="没有访问权限">
  <template #subtitle>如需使用此功能，请联系管理员开通权限</template>
  <template #extra>
    <a-button @click="$router.back()">返回上一页</a-button>
  </template>
</a-result>
```

## 页面模式选择

| 任务 | 容器 |
| --- | --- |
| 搜索、分页、批量操作 | `SaTable` 列表页 |
| 少量字段快速新建/编辑 | `520px` Modal |
| 中型单一任务 | `720px` Modal |
| 详情或不中断列表上下文的复杂编辑 | 右侧 Drawer |
| 多区块、步骤、关联内容或需要宽空间 | 独立页面 |
| 高频轻量删除确认 | Popconfirm |

如果一个弹层需要继续跳转、再开弹层或出现横向滚动，说明页面模式选择错误，应升级为 Drawer 或独立页面。
