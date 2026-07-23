<template>
  <div class="task-page">
    <header class="page-header">
      <div>
        <h1>任务管理</h1>
        <p>统一创建、分配和查看医生审核任务</p>
      </div>
    </header>

    <a-alert type="info" show-icon class="assignment-tip">
      名单导入是批量分配任务的一种方式。导入后，系统会按手机号创建或匹配医生账号，并立即生成对应任务。
    </a-alert>

    <a-alert v-if="tableError" type="error" show-icon class="table-error">
      {{ tableError }}
      <template #action>
        <a-button size="small" @click="refresh">重新加载</a-button>
      </template>
    </a-alert>

    <sa-table
      ref="crudRef"
      :options="options"
      :columns="columns"
      :search-form="searchForm"
      class="task-table"
      @reset-search="resetSearchForm"
    >
      <template #tableSearch>
        <a-col :xs="24" :sm="8">
          <a-form-item field="keyword" label="任务或医生">
            <a-input
              v-model="searchForm.keyword"
              placeholder="任务编号、姓名或手机号"
              allow-clear
            />
          </a-form-item>
        </a-col>
        <a-col :xs="24" :sm="8">
          <a-form-item field="status" label="任务状态">
            <sa-select
              v-model="searchForm.status"
              dict="task_status"
              placeholder="全部状态"
              allow-clear
            />
          </a-form-item>
        </a-col>
        <a-col :xs="24" :sm="8">
          <a-form-item field="source_type" label="创建方式">
            <sa-select
              v-model="searchForm.source_type"
              dict="task_source"
              placeholder="全部方式"
              allow-clear
            />
          </a-form-item>
        </a-col>
      </template>

      <template #tableAfterButtons>
        <a-button @click="importRef?.open()">
          <template #icon><icon-upload /></template>
          导入名单并创建
        </a-button>
      </template>

      <template #doctor_name="{ record }">
        <div class="doctor-cell">
          <div class="doctor-name">
            <span>{{ record.doctor_name }}</span>
            <a-tag
              size="small"
              :color="record.account_status === 'active' ? 'green' : 'orange'"
            >
              {{ record.account_status === 'active' ? '已激活' : '待激活' }}
            </a-tag>
          </div>
          <span>
            {{ maskPhone(record.doctor_phone) }} · {{ record.department || '执业信息待补充' }}
          </span>
        </div>
      </template>

      <template #progress="{ record }">
        <div class="progress-cell">
          <div>
            <span>{{ formatNumber(record.completed_count) }}</span>
            <span class="progress-total"> / {{ formatNumber(record.item_count) }} 条</span>
          </div>
          <a-progress
            :percent="getProgress(record)"
            :show-text="false"
            size="small"
          />
        </div>
      </template>

      <template #item_count="{ record }">
        <span>{{ formatNumber(record.item_count) }} 条</span>
      </template>

      <template #total_reward_cent="{ record }">
        <span class="money-text">{{ formatCurrency(record.total_reward_cent) }}</span>
      </template>
    </sa-table>

    <create-task ref="createRef" @success="refresh" />
    <import-task ref="importRef" @success="refresh" />
    <task-detail ref="detailRef" />
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import taskApi from '@/api/product/task'
import CreateTask from './create.vue'
import ImportTask from './import.vue'
import TaskDetail from './view.vue'

const crudRef = ref()
const createRef = ref()
const importRef = ref()
const detailRef = ref()
const tableError = ref('')

const searchForm = ref({
  keyword: '',
  status: '',
  source_type: ''
})

const formatNumber = (value) => Number(value || 0).toLocaleString('zh-CN')
const formatCurrency = (value) => `¥${formatNumber(Number(value || 0) / 100)}`
const maskPhone = (value) => String(value || '').replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2')

const getProgress = (record) => {
  if (!record.item_count) return 0
  return Math.min(Number(record.completed_count || 0) / Number(record.item_count), 1)
}

const loadList = async (params) => {
  try {
    const response = await taskApi.getPageList(params)
    if (response.code === 200) {
      tableError.value = ''
      return response
    }
    tableError.value = response.message || '任务列表加载失败，请重新加载'
  } catch {
    tableError.value = '任务列表加载失败，请检查网络后重试'
  }

  return {
    code: 200,
    message: 'fallback',
    data: { data: [], total: 0, current_page: 1, per_page: 10 }
  }
}

const options = reactive({
  api: loadList,
  pageLayout: 'normal',
  showSort: false,
  operationColumnWidth: 90,
  view: {
    show: true,
    text: '详情',
    func: (record) => detailRef.value?.open(record.id)
  },
  add: {
    show: true,
    text: '创建任务',
    func: () => createRef.value?.open()
  }
})

const columns = reactive([
  { title: '任务编号', dataIndex: 'task_no', width: 160, fixed: 'left' },
  { title: '医生', dataIndex: 'doctor_name', width: 180 },
  {
    title: '任务状态',
    dataIndex: 'status',
    type: 'dict',
    dict: 'task_status',
    width: 95,
    align: 'center'
  },
  { title: '完成进度', dataIndex: 'progress', width: 160 },
  { title: '任务数量', dataIndex: 'item_count', width: 90, align: 'right' },
  { title: '任务计酬', dataIndex: 'total_reward_cent', width: 110, align: 'right' },
  {
    title: '创建方式',
    dataIndex: 'source_type',
    type: 'dict',
    dict: 'task_source',
    width: 105,
    align: 'center'
  },
  { title: '创建时间', dataIndex: 'create_time', width: 165 }
])

const refresh = () => crudRef.value?.refresh()
const resetSearchForm = () => {
  Object.assign(searchForm.value, {
    keyword: '',
    status: '',
    source_type: ''
  })
}

onMounted(refresh)
</script>

<style scoped lang="less">
.task-page {
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

.assignment-tip,
.table-error {
  flex: 0 0 auto;
}

.task-table {
  min-width: 0;
}

.doctor-cell {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;

  > span {
    overflow: hidden;
    color: var(--color-text-3);
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.doctor-name {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text-1);
  font-weight: 500;
}

.progress-cell {
  min-width: 130px;
  color: var(--color-text-1);
  font-size: 13px;

  :deep(.arco-progress) {
    margin-top: 6px;
  }
}

.progress-total {
  color: var(--color-text-3);
}

.money-text {
  color: var(--color-text-1);
  font-weight: 500;
}

@media (max-width: 575px) {
  .page-header {
    padding: 16px;
  }
}
</style>
