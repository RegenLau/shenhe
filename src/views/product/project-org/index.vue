<template>
  <div class="project-org-page">
    <header class="page-header">
      <div class="page-heading">
        <h1>项目管理</h1>
        <p>维护基金会、项目和项目标识的层级关系，为业务数据提供归属维度</p>
      </div>
    </header>

    <a-alert type="info" show-icon>
      在左侧选择节点后管理下一级内容：选择"全部基金会"管理基金会，选择基金会管理项目，选择项目或项目标识管理标识。
    </a-alert>

    <div class="org-body lg:flex justify-between">
      <aside class="tree-panel lg:w-2/12 w-full">
        <a-spin :loading="treeLoading" class="w-full">
          <a-result
            v-if="treeError"
            status="error"
            title="层级加载失败"
            class="tree-error"
          >
            <template #subtitle>{{ treeError }}</template>
            <template #extra>
              <a-button type="primary" size="small" @click="loadTree">
                重新加载
              </a-button>
            </template>
          </a-result>

          <sa-tree-slider
            v-else
            v-model="selectedKeys"
            :data="treeData"
            search-placeholder="搜索基金会 / 项目 / 标识"
            @click="handleTreeClick"
          />
        </a-spin>
      </aside>

      <section class="list-panel lg:w-10/12 w-full">
        <a-alert v-if="tableError" type="error" show-icon>
          {{ tableError }}
          <template #action>
            <a-button size="small" @click="refresh">重新加载</a-button>
          </template>
        </a-alert>

        <div class="list-context">
          <span class="context-label">{{ contextLabel }}</span>
          <span class="context-count">
            {{ counts.foundation }} 个基金会 · {{ counts.project }} 个项目 ·
            {{ counts.identifier }} 个项目标识
          </span>
        </div>

        <sa-table
          :key="tableKey"
          ref="crudRef"
          :options="options"
          :columns="columns"
          :search-form="searchForm"
          class="org-table"
          @reset-search="resetSearchForm"
        >
          <template #tableSearch>
            <a-col :xs="24" :sm="12">
              <a-form-item field="keyword" label="关键词">
                <a-input
                  v-model="searchForm.keyword"
                  :placeholder="`搜索${tableTypeLabel}名称、编码或备注`"
                  allow-clear
                />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :sm="12">
              <a-form-item field="status" label="状态">
                <sa-select
                  v-model="searchForm.status"
                  dict="data_status"
                  placeholder="全部状态"
                  allow-clear
                />
              </a-form-item>
            </a-col>
          </template>

          <template #name="{ record }">
            <strong class="name-cell" :title="record.name">
              {{ record.name }}
            </strong>
          </template>

          <template #code="{ record }">
            <span :title="record.code">
              {{ record.code || '—' }}
            </span>
          </template>

          <template #project_count="{ record }">
            {{ record.project_count }}
          </template>

          <template #identifier_count="{ record }">
            {{ record.identifier_count }}
          </template>

          <template #status="{ record }">
            <sa-switch
              v-model="record.status"
              :loading="switchingIds.has(record.id)"
              :disabled="switchingIds.has(record.id)"
              checked-value="1"
              unchecked-value="2"
              @change="changeStatus(record, $event)"
            />
          </template>

          <template #remark="{ record }">
            <span :title="record.remark">
              {{ record.remark || '—' }}
            </span>
          </template>
        </sa-table>
      </section>
    </div>

    <edit-form ref="editRef" @success="handleSaved" />
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import projectOrgApi from '@/api/product/project-org'
import EditForm from './edit.vue'

const typeLabels = {
  foundation: '基金会',
  project: '项目',
  identifier: '项目标识'
}

const selectedKeys = ref(['root'])
const activeKey = ref('root')
const treeData = ref([])
const nodeMetaMap = ref({})
const treeLoading = ref(false)
const treeError = ref('')
const counts = ref({ foundation: 0, project: 0, identifier: 0 })

const crudRef = ref()
const editRef = ref()
const tableError = ref('')
const switchingIds = reactive(new Set())
const searchForm = ref({
  keyword: '',
  status: ''
})

const currentContext = computed(
  () => nodeMetaMap.value[activeKey.value] || { type: 'root' }
)

const tableType = computed(() => {
  if (currentContext.value.type === 'root') return 'foundation'
  if (currentContext.value.type === 'foundation') return 'project'
  return 'identifier'
})

const tableTypeLabel = computed(() => typeLabels[tableType.value])

const tableKey = computed(() => activeKey.value)

const contextLabel = computed(() => {
  const context = currentContext.value
  if (context.type === 'root') return '基金会列表'
  if (context.type === 'foundation') return `${context.label} · 项目列表`
  if (context.type === 'project') return `${context.label} · 项目标识列表`
  const projectName =
    nodeMetaMap.value[`project-${context.project_id}`]?.label || ''
  return `${projectName} · 项目标识列表`
})

const loadTree = async () => {
  treeLoading.value = true
  treeError.value = ''
  try {
    const response = await projectOrgApi.tree()
    if (response.code === 200) {
      const map = {}
      const walk = (nodes) => {
        nodes.forEach((node) => {
          map[node.value] = node
          if (node.children?.length) walk(node.children)
        })
      }
      walk(response.data.tree)

      const previousKey = activeKey.value
      const previousMeta = nodeMetaMap.value[previousKey]
      if (!map[previousKey]) {
        let fallbackKey = 'root'
        if (
          previousMeta?.type === 'identifier' &&
          map[`project-${previousMeta.project_id}`]
        ) {
          fallbackKey = `project-${previousMeta.project_id}`
        } else if (
          previousMeta?.type === 'project' &&
          map[`foundation-${previousMeta.foundation_id}`]
        ) {
          fallbackKey = `foundation-${previousMeta.foundation_id}`
        }
        activeKey.value = fallbackKey
        selectedKeys.value = [fallbackKey]
      }

      treeData.value = response.data.tree
      nodeMetaMap.value = map
      counts.value = response.data.counts
      return
    }
    treeError.value = response.message || '项目层级加载失败，请重新加载'
  } catch {
    treeError.value = '项目层级加载失败，请检查网络后重试'
  } finally {
    treeLoading.value = false
  }
}

const columns = computed(() => {
  const currentColumns = [
    {
      title: `${tableTypeLabel.value}名称`,
      dataIndex: 'name',
      minWidth: 200,
      fixed: 'left'
    },
    { title: '编码', dataIndex: 'code', width: 140 }
  ]

  if (tableType.value === 'foundation') {
    currentColumns.push({
      title: '项目数',
      dataIndex: 'project_count',
      width: 100,
      align: 'right'
    })
  }

  if (tableType.value === 'project') {
    currentColumns.push(
      { title: '所属基金会', dataIndex: 'foundation_name', width: 180 },
      {
        title: '标识数',
        dataIndex: 'identifier_count',
        width: 100,
        align: 'right'
      }
    )
  }

  if (tableType.value === 'identifier') {
    currentColumns.push({
      title: '所属项目',
      dataIndex: 'project_name',
      width: 180
    })
  }

  currentColumns.push(
    { title: '状态', dataIndex: 'status', width: 110, align: 'center' },
    { title: '备注', dataIndex: 'remark', minWidth: 180 },
    { title: '更新时间', dataIndex: 'update_time', width: 180 }
  )

  return currentColumns
})

const loadList = async (params) => {
  const context = currentContext.value
  const query = { ...params, type: tableType.value }

  if (tableType.value === 'project') {
    query.foundation_id = context.id
  }
  if (tableType.value === 'identifier') {
    query.project_id = context.project_id || context.id
  }

  try {
    const response = await projectOrgApi.getPageList(query)
    if (response.code === 200) {
      tableError.value = ''
      return response
    }
    tableError.value =
      response.message || `${tableTypeLabel.value}列表加载失败，请重新加载`
  } catch {
    tableError.value = `${tableTypeLabel.value}列表加载失败，请检查网络后重试`
  }

  return {
    code: 200,
    message: 'fallback',
    data: { data: [], total: 0, current_page: 1, per_page: 10 }
  }
}

const deleteConfirmText = computed(() => {
  if (tableType.value === 'foundation') {
    return '删除后无法恢复，且基金会下存在项目时无法删除，确定删除选中的基金会吗？'
  }
  if (tableType.value === 'project') {
    return '删除后无法恢复，且项目下存在项目标识时无法删除，确定删除选中的项目吗？'
  }
  return '删除后无法恢复，确定删除选中的项目标识吗？'
})

const deleteRows = async (params) => {
  const response = await projectOrgApi.destroy({
    ...params,
    type: tableType.value
  })
  if (response.code === 200) {
    Message.success(`${tableTypeLabel.value}删除成功`)
    handleSaved()
  }
}

const openCreate = () => {
  const context = currentContext.value
  if (tableType.value === 'foundation') {
    editRef.value?.open('add', 'foundation')
    return
  }

  if (tableType.value === 'project') {
    editRef.value?.open('add', 'project', {
      foundation: { id: context.id, name: context.label }
    })
    return
  }

  const projectId = context.project_id || context.id
  const projectName =
    context.type === 'project'
      ? context.label
      : nodeMetaMap.value[`project-${context.project_id}`]?.label || ''
  editRef.value?.open('add', 'identifier', {
    project: { id: projectId, name: projectName }
  })
}

const options = reactive({
  api: loadList,
  pageLayout: 'normal',
  showSort: false,
  pageSize: 10,
  rowSelection: { showCheckedAll: true },
  operationColumnWidth: 150,
  add: {
    show: true,
    text: computed(() => `新建${tableTypeLabel.value}`),
    func: openCreate
  },
  edit: {
    show: true,
    func: (record) =>
      editRef.value?.open('edit', tableType.value, null, record)
  },
  delete: {
    show: true,
    confirmText: computed(() => deleteConfirmText.value),
    func: deleteRows
  }
})

const refresh = () => crudRef.value?.refresh()

const resetSearchForm = () => {
  Object.assign(searchForm.value, {
    keyword: '',
    status: ''
  })
}

const handleTreeClick = async (keys) => {
  const key = Array.isArray(keys) ? keys[0] : keys
  const normalizedKey =
    typeof key === 'string' || typeof key === 'number' ? String(key) : ''

  if (!normalizedKey || normalizedKey === activeKey.value) {
    selectedKeys.value = [activeKey.value]
    return
  }

  activeKey.value = normalizedKey
  selectedKeys.value = [normalizedKey]
  tableError.value = ''
  resetSearchForm()
  await nextTick()
  refresh()
}

const handleSaved = async () => {
  await loadTree()
  refresh()
}

const changeStatus = async (record, status) => {
  const previousStatus = status === '1' ? '2' : '1'
  switchingIds.add(record.id)

  try {
    const response = await projectOrgApi.changeStatus({
      type: tableType.value,
      id: record.id,
      status
    })

    if (response.code !== 200) {
      record.status = previousStatus
      return
    }

    record.status = response.data.status
    Message.success(
      `${tableTypeLabel.value}已${status === '1' ? '启用' : '停用'}`
    )
  } catch {
    record.status = previousStatus
  } finally {
    switchingIds.delete(record.id)
  }
}

onMounted(async () => {
  await loadTree()
  refresh()
})
</script>

<style scoped lang="less">
.project-org-page {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
}

.page-header {
  padding: 20px 24px;
  background: var(--color-bg-2);
  border: 1px solid var(--color-border-1);
  border-radius: var(--border-radius-medium);

  h1 {
    margin: 0;
    color: var(--color-text-1);
    font-size: 20px;
    font-weight: 600;
    line-height: 28px;
  }

  p {
    margin: 4px 0 0;
    color: var(--color-text-3);
    font-size: 14px;
    line-height: 20px;
  }
}

.org-body {
  align-items: flex-start;
}

.tree-panel {
  padding: 12px;
  background: var(--color-bg-2);
  border: 1px solid var(--color-border-1);
  border-radius: var(--border-radius-medium);
}

.list-panel {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
}

.list-context {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: baseline;
  padding: 0 4px;
}

.context-label {
  color: var(--color-text-1);
  font-size: 15px;
  font-weight: 600;
}

.context-count {
  color: var(--color-text-3);
  font-size: 13px;
}

.org-table {
  min-width: 0;
}

.name-cell {
  color: var(--color-text-1);
  font-weight: 500;
}

.tree-error {
  padding: 12px 0;

  :deep(.arco-resultSubtitle) {
    font-size: 13px;
  }
}

@media (max-width: 1023px) {
  .tree-panel {
    margin-bottom: 12px;
  }
}

@media (max-width: 575px) {
  .page-header {
    padding: 16px;
  }

  .tree-panel {
    padding: 8px;
  }

  .org-table {
    :deep(.arco-card-body > div:first-child > .arco-row) {
      flex-direction: column;
      gap: 12px;
    }

    :deep(.arco-card-body > div:first-child > .arco-row > .arco-col) {
      width: 100%;
      flex: 0 0 100% !important;
      text-align: left !important;
    }

    :deep(.arco-pagination-options),
    :deep(.arco-pagination-jumper) {
      display: none;
    }

    :deep(.arco-pagination) {
      max-width: 100%;
      overflow-x: auto;
    }
  }
}
</style>
