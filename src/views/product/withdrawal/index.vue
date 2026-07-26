<template>
  <div class="withdrawal-page">
    <header class="page-header">
      <div>
        <h1>提现管理</h1>
        <p>查看医生提现申请，并整理基金会线下处理名单</p>
      </div>
    </header>

    <a-alert type="info" show-icon class="settlement-tip">
      平台仅负责记录提现申请并导出待处理名单，不进行审批或打款。名单导出后由基金会线下审核支付；基金会完成打款后，可在申请详情中登记“已打款”。医生端金额以积分展示，1 积分 = 1 元。
    </a-alert>

    <a-alert v-if="summaryError" type="error" show-icon class="summary-error">
      {{ summaryError }}
      <template #action>
        <a-button size="small" @click="loadSummary">重新加载</a-button>
      </template>
    </a-alert>

    <a-spin :loading="summaryLoading" class="summary-loading">
      <section class="summary-grid" aria-label="提现统计">
        <article class="metric-card">
          <span>待导出笔数</span>
          <strong>{{ summaryLoaded ? formatNumber(summary.pending_count) : '—' }}</strong>
          <small>等待整理并交付基金会</small>
        </article>
        <article class="metric-card">
          <span>待导出金额</span>
          <strong>
            {{ summaryLoaded ? formatCurrency(summary.pending_amount_cent) : '—' }}
          </strong>
          <small>当前待处理申请合计</small>
        </article>
        <article class="metric-card">
          <span>已导出待打款</span>
          <strong>
            {{ summaryLoaded ? formatCurrency(summary.exported_amount_cent) : '—' }}
          </strong>
          <small>
            {{ summaryLoaded ? `共 ${formatNumber(summary.exported_count)} 笔，等待基金会打款` : '—' }}
          </small>
        </article>
        <article class="metric-card">
          <span>已打款金额</span>
          <strong>
            {{ summaryLoaded ? formatCurrency(summary.paid_amount_cent) : '—' }}
          </strong>
          <small>
            {{ summaryLoaded ? `共 ${formatNumber(summary.paid_count)} 笔，基金会已完成支付` : '—' }}
          </small>
        </article>
      </section>
    </a-spin>

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
      class="withdrawal-table"
      @reset-search="resetSearchForm"
    >
      <template #tableSearch>
        <a-col :xs="24" :sm="12">
          <a-form-item field="keyword" label="申请或医生">
            <a-input
              v-model="searchForm.keyword"
              placeholder="申请单号、医生姓名或手机号"
              allow-clear
            />
          </a-form-item>
        </a-col>
        <a-col :xs="24" :sm="12">
          <a-form-item field="status" label="导出状态">
            <sa-select
              v-model="searchForm.status"
              dict="withdrawal_export_status"
              placeholder="全部状态"
              allow-clear
            />
          </a-form-item>
        </a-col>
      </template>

      <template #tableAfterButtons>
        <a-button
          :loading="exporting"
          :disabled="!summaryLoaded || summary.pending_count === 0"
          @click="confirmExport"
        >
          <template #icon><icon-download /></template>
          导出待处理名单
        </a-button>
      </template>

      <template #withdrawal_no="{ record }">
        <span class="number-text">{{ record.withdrawal_no || '—' }}</span>
      </template>

      <template #payee_name="{ record }">
        <div class="doctor-cell">
          <strong :title="record.payee_name">{{ record.payee_name || '—' }}</strong>
          <span>{{ record.doctor_phone_masked || '—' }}</span>
        </div>
      </template>

      <template #amount_cent="{ record }">
        <span class="money-text">{{ formatCurrency(record.amount_cent) }}</span>
      </template>

      <template #bank_info="{ record }">
        <div class="bank-cell">
          <strong :title="record.bank_name">{{ record.bank_name || '—' }}</strong>
          <span :title="record.bank_card_masked">
            {{ record.bank_card_masked || '—' }}
          </span>
        </div>
      </template>
    </sa-table>

    <withdrawal-detail ref="detailRef" @updated="handleDetailUpdated" />
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import tool from '@/utils/tool'
import withdrawalApi from '@/api/product/withdrawal'
import WithdrawalDetail from './view.vue'

const crudRef = ref()
const detailRef = ref()
const tableError = ref('')
const summaryError = ref('')
const summaryLoading = ref(false)
const summaryLoaded = ref(false)
const exporting = ref(false)

const searchForm = ref({
  keyword: '',
  status: ''
})

const summary = reactive({
  pending_count: 0,
  pending_amount_cent: 0,
  exported_count: 0,
  exported_amount_cent: 0,
  paid_count: 0,
  paid_amount_cent: 0
})

const formatNumber = (value) => Number(value || 0).toLocaleString('zh-CN')
const formatCurrency = (value) => {
  const amount = Number(value || 0) / 100
  return `¥${amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}

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
    summaryError.value = response.message || '提现统计加载失败，请重新加载'
  } catch {
    summaryLoaded.value = false
    summaryError.value = '提现统计加载失败，请检查网络后重试'
  } finally {
    summaryLoading.value = false
  }
}

const loadList = async (params) => {
  try {
    const response = await withdrawalApi.getPageList(params)
    if (response.code === 200) {
      tableError.value = ''
      return response
    }
    tableError.value = response.message || '提现申请加载失败，请重新加载'
  } catch {
    tableError.value = '提现申请加载失败，请检查网络后重试'
  }

  return {
    code: 200,
    message: 'fallback',
    data: { data: [], total: 0, current_page: 1, per_page: 10 }
  }
}

const exportPending = async () => {
  exporting.value = true
  try {
    const response = await withdrawalApi.exportPending()
    if (response?.status !== 200) {
      Message.error('待处理名单导出失败，请稍后重试')
      return
    }

    tool.download(response)
    Message.success('待处理名单已导出，请交基金会线下审核支付；导出不代表已付款')
    refresh()
    await loadSummary()
  } catch {
    Message.error('待处理名单导出失败，请检查网络后重试')
  } finally {
    exporting.value = false
  }
}

const confirmExport = () => {
  Modal.confirm({
    title: '确认导出基金会名单',
    content:
      '导出文件包含医生身份证号、银行卡号等敏感信息，仅限交付基金会线下审核支付，请妥善保管。',
    width: 'min(420px, calc(100vw - 32px))',
    okText: '确认导出',
    onOk: exportPending
  })
}

const options = reactive({
  api: loadList,
  pageLayout: 'normal',
  showSort: false,
  operationColumnWidth: 80,
  view: {
    show: true,
    text: '详情',
    func: (record) => detailRef.value?.open(record.id)
  }
})

const columns = reactive([
  { title: '申请单号', dataIndex: 'withdrawal_no', width: 170, fixed: 'left' },
  { title: '申请医生', dataIndex: 'payee_name', width: 170 },
  { title: '提现金额', dataIndex: 'amount_cent', width: 120, align: 'right' },
  { title: '收款账户', dataIndex: 'bank_info', width: 200 },
  {
    title: '导出状态',
    dataIndex: 'status',
    type: 'dict',
    dict: 'withdrawal_export_status',
    width: 100,
    align: 'center'
  },
  { title: '申请时间', dataIndex: 'applied_at', width: 165 }
])

const refresh = () => crudRef.value?.refresh()
const handleDetailUpdated = () => {
  refresh()
  loadSummary()
}
const resetSearchForm = () => {
  Object.assign(searchForm.value, {
    keyword: '',
    status: ''
  })
}

onMounted(() => {
  loadSummary()
  refresh()
})
</script>

<style scoped lang="less">
.withdrawal-page {
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
    font-size: 14px;
    line-height: 20px;
  }
}

.settlement-tip,
.summary-error,
.table-error {
  flex: 0 0 auto;
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

@media (max-width: 1023px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
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

  > span {
    color: var(--color-text-3);
    font-size: 13px;
    line-height: 20px;
  }

  strong {
    overflow: hidden;
    color: var(--color-text-1);
    font-size: 24px;
    font-weight: 600;
    line-height: 32px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    overflow: hidden;
    color: var(--color-text-3);
    font-size: 12px;
    line-height: 20px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.withdrawal-table {
  min-width: 0;
  max-width: 100%;
}

.doctor-cell,
.bank-cell {
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
    font-size: 14px;
    font-weight: 500;
  }

  span {
    color: var(--color-text-3);
    font-size: 12px;
  }
}

.number-text {
  color: var(--color-text-2);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
}

.money-text {
  color: var(--color-text-1);
  font-weight: 500;
}

@media (max-width: 575px) {
  .page-header {
    padding: 16px;
  }

  .summary-grid {
    grid-template-columns: 1fr;
  }

  .metric-card {
    min-height: 96px;
    padding: 12px 16px;
  }

  .withdrawal-table {
    :deep(.arco-card-body > div:first-child > .arco-row) {
      flex-direction: column;
      gap: 12px;
    }

    :deep(.arco-card-body > div:first-child > .arco-row > .arco-col) {
      width: 100%;
      flex: 0 0 100% !important;
      text-align: left !important;
    }

    :deep(.arco-card-body > div:first-child > .arco-row > .arco-col:last-child) {
      padding-left: 56px;
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
