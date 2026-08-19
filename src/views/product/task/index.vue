<template>
  <div class="task-page">
    <header class="page-header">
      <div>
        <h1>任务管理</h1>
        <p>按导入批次查看任务汇总，进入批次后查看每位医生的审核进度</p>
      </div>
    </header>

    <a-alert type="info" show-icon class="assignment-tip">
      任务管理首页默认展示名单导入批次。点击“批次详情”查看该批次所有医生的进度，并可下载进度数据；如需查看手工创建任务，可在“创建方式”中切换。
    </a-alert>

    <a-alert v-if="tableError" type="error" show-icon class="table-error">
      {{ tableError }}
      <template #action>
        <a-button size="small" @click="refresh">重新加载</a-button>
      </template>
    </a-alert>

    <sa-table
      v-show="!tableError"
      ref="crudRef"
      :options="options"
      :columns="columns"
      :search-form="searchForm"
      class="task-table"
      @reset-search="resetSearchForm"
    >
      <template #tableSearch>
        <a-col :xs="24" :sm="12">
          <a-form-item field="keyword" label="批次或项目">
            <a-input
              v-model="searchForm.keyword"
              placeholder="批次编号、基金会、项目或项目标识"
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
        <a-button type="primary" @click="createRef?.open()">
          <template #icon><icon-plus /></template>
          创建任务
        </a-button>
        <a-button @click="importRef?.open()">
          <template #icon><icon-upload /></template>
          导入名单并创建
        </a-button>
      </template>

      <template #batch_no="{ record }">
        <div class="batch-cell">
          <strong>{{ record.batch_no || '—' }}</strong>
          <span>{{ record.display_title || '—' }}</span>
        </div>
      </template>

      <template #identifier_name="{ record }">
        <div class="org-cell">
          <span class="org-primary">
            {{ record.foundation_name || '—' }} · {{ record.identifier_name || '—' }}
          </span>
          <span class="org-path">
            项目：{{ record.project_name || '—' }}
          </span>
        </div>
      </template>

      <template #progress="{ record }">
        <div class="progress-cell">
          <div>
            <span>{{ formatNumber(record.completed_count) }}</span>
            <span class="progress-total"> / {{ formatNumber(record.item_count) }} 题</span>
          </div>
          <a-progress
            :percent="Number(record.progress_percent || 0)"
            :show-text="false"
            size="small"
          />
        </div>
      </template>

      <template #doctor_count="{ record }">
        <span>{{ formatNumber(record.doctor_count) }} 位</span>
      </template>

      <template #task_count="{ record }">
        <span>{{ formatNumber(record.task_count) }} 个</span>
      </template>

      <template #total_reward_cent="{ record }">
        <span class="money-text">{{ formatPoints(record.total_reward_cent) }}</span>
      </template>

      <template #operationAfterExtend="{ record }">
        <a-link @click="downloadProgress(record)">
          {{ exportingBatchKey === record.batch_key ? '导出中…' : '导出进度' }}
        </a-link>
      </template>
    </sa-table>

    <create-task ref="createRef" @success="refresh" />
    <import-task ref="importRef" @success="refresh" />
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Message } from '@arco-design/web-vue'
import tool from '@/utils/tool'
import taskApi from '@/api/product/task'
import CreateTask from './create.vue'
import ImportTask from './import.vue'

const crudRef = ref()
const createRef = ref()
const importRef = ref()
const tableError = ref('')
const exportingBatchKey = ref('')
const router = useRouter()

const searchForm = ref({
  keyword: '',
  source_type: 'import'
})

const formatNumber = (value) => Number(value || 0).toLocaleString('zh-CN')
const formatPoints = (value) => `${formatNumber(Number(value || 0) / 100)} 积分`

const loadList = async (params) => {
  try {
    const response = await taskApi.getBatchList(params)
    if (response.code === 200) {
      tableError.value = ''
      return response
    }
    tableError.value = response.message || '任务批次加载失败，请重新加载'
  } catch {
    tableError.value = '任务批次加载失败，请检查网络后重试'
  }

  return {
    code: 200,
    message: 'fallback',
    data: { data: [], total: 0, current_page: 1, per_page: 10 }
  }
}

const openBatch = (record) => {
  router.push({
    name: 'productTaskBatchDetail',
    params: { batchKey: record.batch_key || record.id || '' }
  })
}

const downloadProgress = async (record) => {
  const batchKey = record.batch_key || record.id || ''
  if (!batchKey || exportingBatchKey.value) return

  exportingBatchKey.value = batchKey
  try {
    const response = await taskApi.downloadBatchProgress(batchKey)
    if (response?.status !== 200) {
      Message.error('进度数据下载失败，请稍后重试')
      return
    }
    tool.download(response)
    Message.success('批次进度数据已开始下载')
  } catch {
    Message.error('进度数据下载失败，请检查网络后重试')
  } finally {
    exportingBatchKey.value = ''
  }
}

const options = reactive({
  api: loadList,
  pageLayout: 'normal',
  showSort: false,
  operationColumnWidth: 190,
  view: {
    show: true,
    text: '批次详情',
    func: openBatch
  }
})

const columns = reactive([
  { title: '批次编号', dataIndex: 'batch_no', width: 190, fixed: 'left' },
  { title: '项目归属', dataIndex: 'identifier_name', width: 220 },
  { title: '医生数', dataIndex: 'doctor_count', width: 90, align: 'right' },
  { title: '任务数', dataIndex: 'task_count', width: 90, align: 'right' },
  { title: '完成进度', dataIndex: 'progress', width: 180 },
  {
    title: '批次状态',
    dataIndex: 'status',
    type: 'dict',
    dict: 'task_status',
    width: 100,
    align: 'center'
  },
  { title: '任务题数', dataIndex: 'item_count', width: 100, align: 'right' },
  { title: '任务积分', dataIndex: 'total_reward_cent', width: 110, align: 'right' },
  {
    title: '批次来源',
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
    source_type: 'import'
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

.batch-cell,
.org-cell {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;

  span,
  strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.batch-cell {
  strong {
    color: var(--color-text-1);
    font-weight: 600;
  }

  span {
    color: var(--color-text-3);
    font-size: 12px;
  }
}

.org-primary {
  color: var(--color-text-1);
  font-weight: 500;
}

.org-path {
  color: var(--color-text-3);
  font-size: 12px;
}

.progress-cell {
  min-width: 150px;
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
