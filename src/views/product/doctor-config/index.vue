<template>
  <div class="doctor-config-page">
    <header class="page-header">
      <div class="page-heading">
        <h1>医生端配置</h1>
        <p>维护医生首次登录小程序时可选择的医院、科室和职务</p>
      </div>
    </header>

    <a-alert type="info" show-icon>
      小程序只展示已启用的选项。停用配置不会影响医生已经保存的历史资料。
    </a-alert>

    <a-tabs
      v-model:active-key="activeType"
      type="line"
      class="config-tabs"
      @change="handleTabChange"
    >
      <a-tab-pane
        v-for="item in configTypes"
        :key="item.key"
        :title="item.label"
      />
    </a-tabs>

    <a-alert v-if="tableError" type="error" show-icon>
      {{ tableError }}
      <template #action>
        <a-button size="small" @click="refresh">重新加载</a-button>
      </template>
    </a-alert>

    <sa-table
      :key="activeType"
      ref="crudRef"
      :options="options"
      :columns="columns"
      :search-form="searchForm"
      class="config-table"
      @reset-search="resetSearchForm"
    >
      <template #tableSearch>
        <a-col :xs="24" :sm="12">
          <a-form-item field="keyword" label="关键词">
            <a-input
              v-model="searchForm.keyword"
              :placeholder="`搜索${activeTypeLabel}名称或备注`"
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

    <edit-form ref="editRef" @success="refresh" />
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import doctorConfigApi from '@/api/product/doctor-config'
import EditForm from './edit.vue'

const configTypes = [
  { key: 'hospital', label: '医院' },
  { key: 'department', label: '科室' },
  { key: 'position', label: '职务' }
]

const activeType = ref('hospital')
const crudRef = ref()
const editRef = ref()
const tableError = ref('')
const switchingIds = reactive(new Set())
const searchForm = ref({
  keyword: '',
  status: ''
})

const activeTypeLabel = computed(
  () =>
    configTypes.find((item) => item.key === activeType.value)?.label || '配置'
)

const columns = computed(() => {
  const currentColumns = [
    {
      title: `${activeTypeLabel.value}名称`,
      dataIndex: 'name',
      minWidth: 180,
      fixed: 'left'
    }
  ]

  if (activeType.value === 'hospital') {
    currentColumns.push(
      { title: '所在地区', dataIndex: 'region', width: 150 },
      { title: '医院等级', dataIndex: 'level', width: 120 }
    )
  }

  currentColumns.push(
    { title: '显示顺序', dataIndex: 'sort', width: 100, align: 'right' },
    { title: '状态', dataIndex: 'status', width: 120, align: 'center' },
    { title: '备注', dataIndex: 'remark', minWidth: 180 },
    { title: '更新时间', dataIndex: 'update_time', width: 180 }
  )

  return currentColumns
})

const loadList = async (params) => {
  try {
    const response = await doctorConfigApi.getPageList({
      ...params,
      type: activeType.value
    })
    if (response.code === 200) {
      tableError.value = ''
      return response
    }
    tableError.value =
      response.message || `${activeTypeLabel.value}列表加载失败，请重新加载`
  } catch {
    tableError.value = `${activeTypeLabel.value}列表加载失败，请检查网络后重试`
  }

  return {
    code: 200,
    message: 'fallback',
    data: { data: [], total: 0, current_page: 1, per_page: 10 }
  }
}

const deleteRows = async (params) => {
  const response = await doctorConfigApi.destroy(params)
  if (response.code === 200) {
    Message.success(`${activeTypeLabel.value}删除成功`)
    refresh()
  }
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
    text: '新增配置',
    func: () => editRef.value?.open('add', activeType.value)
  },
  edit: {
    show: true,
    func: (record) => editRef.value?.open('edit', activeType.value, record)
  },
  delete: {
    show: true,
    confirmText: '删除后小程序将不再提供该选项，确定删除吗？',
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

const handleTabChange = async () => {
  tableError.value = ''
  resetSearchForm()
  await nextTick()
  refresh()
}

const changeStatus = async (record, status) => {
  const previousStatus = status === '1' ? '2' : '1'
  switchingIds.add(record.id)

  try {
    const response = await doctorConfigApi.changeStatus({
      id: record.id,
      status
    })

    if (response.code !== 200) {
      record.status = previousStatus
      return
    }

    record.status = response.data.status
    Message.success(
      `${activeTypeLabel.value}已${status === '1' ? '启用' : '停用'}`
    )
  } catch {
    record.status = previousStatus
  } finally {
    switchingIds.delete(record.id)
  }
}

onMounted(refresh)
</script>

<style scoped lang="less">
.doctor-config-page {
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

.config-tabs {
  padding: 0 24px;
  background: var(--color-bg-2);
  border: 1px solid var(--color-border-1);
  border-radius: var(--border-radius-medium);

  :deep(.arco-tabs-nav) {
    margin-bottom: 0;
  }

  :deep(.arco-tabs-content) {
    display: none;
  }
}

.config-table {
  min-width: 0;
}

.name-cell {
  color: var(--color-text-1);
  font-weight: 500;
}

@media (max-width: 575px) {
  .page-header {
    padding: 16px;
  }

  .config-tabs {
    padding-right: 16px;
    padding-left: 16px;
  }

  .config-table {
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
