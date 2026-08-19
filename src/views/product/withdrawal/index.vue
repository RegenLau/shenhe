<template>
  <div class="settlement-page">
    <header class="page-header">
      <div>
        <h1>结算管理</h1>
        <p>按任务批次查看结算进度，进入批次后处理每位医生的审核结算</p>
      </div>
    </header>

    <a-alert type="info" show-icon>
      结算与任务管理使用同一批次编号。点击“批次详情”查看该任务批次下的医生审核情况、结算积分及收款信息。
    </a-alert>

    <a-alert v-if="summaryError" type="error" show-icon>
      {{ summaryError }}
      <template #action>
        <a-button size="small" @click="loadSummary">重新加载</a-button>
      </template>
    </a-alert>

    <a-spin :loading="summaryLoading" class="summary-loading">
      <section class="summary-grid" aria-label="任务批次结算统计">
        <article class="metric-card">
          <span>任务批次</span>
          <strong>{{ summaryLoaded ? formatNumber(summary.total_batch_count) : '—' }}</strong>
          <small>当前有结算记录的任务批次</small>
        </article>
        <article class="metric-card">
          <span>待导出批次</span>
          <strong>{{ summaryLoaded ? formatNumber(summary.pending_batch_count) : '—' }}</strong>
          <small>等待导出并交付基金会</small>
        </article>
        <article class="metric-card">
          <span>结算中批次</span>
          <strong>{{ summaryLoaded ? formatNumber(summary.processing_batch_count) : '—' }}</strong>
          <small>已导出或部分完成</small>
        </article>
        <article class="metric-card">
          <span>结算总积分</span>
          <strong>{{ summaryLoaded ? formatPoints(summary.total_amount_cent) : '—' }}</strong>
          <small>全部批次累计</small>
        </article>
      </section>
    </a-spin>

    <a-alert v-if="tableError" type="error" show-icon>
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
      class="batch-table"
      @reset-search="resetSearchForm"
    >
      <template #tableSearch>
        <a-col :xs="24" :sm="12">
          <a-form-item field="keyword" label="任务批次">
            <a-input
              v-model="searchForm.keyword"
              placeholder="任务批次编号或医生姓名"
              allow-clear
            />
          </a-form-item>
        </a-col>
        <a-col :xs="24" :sm="12">
          <a-form-item field="status" label="批次状态">
            <sa-select
              v-model="searchForm.status"
              dict="settlement_batch_status"
              placeholder="全部状态"
              allow-clear
            />
          </a-form-item>
        </a-col>
      </template>

      <template #batch_no="{ record }">
        <div class="batch-cell">
          <strong>{{ record.batch_no || '—' }}</strong>
          <span :title="record.display_title">{{ record.display_title || '—' }}</span>
        </div>
      </template>

      <template #doctor_count="{ record }">
        {{ formatNumber(record.doctor_count) }} 位
      </template>

      <template #pending_doctor_count="{ record }">
        {{ formatNumber(record.pending_doctor_count) }} 位
      </template>

      <template #pending_amount_cent="{ record }">
        <strong class="points-text">{{ formatPoints(record.pending_amount_cent) }}</strong>
      </template>
    </sa-table>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import withdrawalApi from '@/api/product/withdrawal'

const router = useRouter()
const crudRef = ref()
const tableError = ref('')
const summaryError = ref('')
const summaryLoading = ref(false)
const summaryLoaded = ref(false)

const searchForm = ref({ keyword: '', status: '' })
const summary = reactive({
  total_batch_count: 0,
  pending_batch_count: 0,
  processing_batch_count: 0,
  settled_batch_count: 0,
  total_amount_cent: 0
})

const formatNumber = (value) => Number(value || 0).toLocaleString('zh-CN')
const formatPoints = (value) => `${formatNumber(Number(value || 0) / 100)} 积分`

const loadSummary = async () => {
  summaryLoading.value = true
  summaryError.value = ''
  try {
    const response = await withdrawalApi.getSummary()
    if (response.code === 200) {
      Object.assign(summary, response.data)
      summaryLoaded.value = true
      return
    }
    summaryLoaded.value = false
    summaryError.value = response.message || '结算统计加载失败，请重新加载'
  } catch {
    summaryLoaded.value = false
    summaryError.value = '结算统计加载失败，请检查网络后重试'
  } finally {
    summaryLoading.value = false
  }
}

const loadList = async (params) => {
  try {
    const response = await withdrawalApi.getBatchList(params)
    if (response.code === 200) {
      tableError.value = ''
      return response
    }
    tableError.value = response.message || '结算批次加载失败，请重新加载'
  } catch {
    tableError.value = '结算批次加载失败，请检查网络后重试'
  }

  return {
    code: 200,
    message: 'fallback',
    data: { data: [], total: 0, current_page: 1, per_page: 10 }
  }
}

const openBatch = (record) => {
  router.push({
    name: 'productSettlementBatchDetail',
    params: { batchNo: record.batch_no }
  })
}

const options = reactive({
  api: loadList,
  pageLayout: 'normal',
  showSort: false,
  operationColumnWidth: 110,
  view: { show: true, text: '批次详情', func: openBatch }
})

const columns = reactive([
  { title: '任务批次编号', dataIndex: 'batch_no', width: 210, fixed: 'left' },
  {
    title: '批次状态',
    dataIndex: 'status',
    type: 'dict',
    dict: 'settlement_batch_status',
    width: 110,
    align: 'center'
  },
  { title: '医生数', dataIndex: 'doctor_count', width: 90, align: 'right' },
  {
    title: '待结算医生数',
    dataIndex: 'pending_doctor_count',
    width: 130,
    align: 'right'
  },
  { title: '待结算积分', dataIndex: 'pending_amount_cent', width: 130, align: 'right' },
  { title: '批次创建时间', dataIndex: 'created_at', width: 165 }
])

const refresh = () => crudRef.value?.refresh()
const resetSearchForm = () => {
  Object.assign(searchForm.value, { keyword: '', status: '' })
}

onMounted(() => {
  loadSummary()
  refresh()
})
</script>

<style scoped lang="less">
.settlement-page {
  display: flex;
  min-width: 0;
  max-width: 100%;
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
    line-height: 20px;
  }
}

.summary-loading {
  display: block;
  width: 100%;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.metric-card {
  display: flex;
  min-width: 0;
  min-height: 112px;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  padding: 16px 20px;
  background: var(--color-bg-2);
  border: 1px solid var(--color-border-1);
  border-radius: var(--border-radius-medium);

  > span,
  small {
    color: var(--color-text-3);
    line-height: 20px;
  }

  > span { font-size: 13px; }
  small { font-size: 12px; }

  strong {
    overflow: hidden;
    color: var(--color-text-1);
    font-size: 24px;
    line-height: 32px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.batch-table { min-width: 0; }

.batch-cell {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;

  strong,
  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    color: var(--color-text-1);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
  }

  span {
    color: var(--color-text-3);
    font-size: 12px;
  }
}

.points-text {
  color: var(--color-text-1);
  font-weight: 500;
}

@media (max-width: 1023px) {
  .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 575px) {
  .page-header { padding: 16px; }
  .summary-grid { grid-template-columns: 1fr; }
  .metric-card {
    min-height: 96px;
    padding: 12px 16px;
  }
}
</style>
