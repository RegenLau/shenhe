<template>
  <div class="settlement-page">
    <header class="page-header">
      <div>
        <h1>结算管理</h1>
        <p>统一查看月结账期、任务执行结果和独立人工结算记录</p>
      </div>
      <a-button type="primary" status="warning" @click="manualSettlementRef?.open()">
        <template #icon><icon-plus /></template>
        人工单独结算
      </a-button>
    </header>

    <a-alert type="info" show-icon>
      月结账期与对应任务执行结果合并为一行；人工结算单作为独立记录在同表展示，但不计入任何月结账期的医生人数或金额统计。
    </a-alert>

    <a-alert v-if="summaryError" type="error" show-icon>
      {{ summaryError }}
      <template #action>
        <a-button size="small" @click="loadSummary">重新加载</a-button>
      </template>
    </a-alert>

    <a-spin :loading="summaryLoading" class="summary-loading">
      <section class="summary-grid" aria-label="月结统计">
        <article class="metric-card">
          <span>本月已入账</span>
          <strong>{{ summaryLoaded ? formatPoints(summary.current_month_accrued_amount_cent) : '—' }}</strong>
          <small>逐条审核完成即累计</small>
        </article>
        <article class="metric-card">
          <span>月结待导出</span>
          <strong>{{ summaryLoaded ? formatPoints(summary.pending_export_amount_cent) : '—' }}</strong>
          <small>{{ formatNumber(summary.pending_export_count) }} 位医生待导出</small>
        </article>
        <article class="metric-card">
          <span>月结延期</span>
          <strong>{{ summaryLoaded ? formatPoints(summary.deferred_amount_cent) : '—' }}</strong>
          <small>{{ formatNumber(summary.deferred_doctor_count) }} 位医生条件未完成</small>
        </article>
        <article class="metric-card">
          <span>月结待到账</span>
          <strong>{{ summaryLoaded ? formatPoints(summary.processing_amount_cent) : '—' }}</strong>
          <small>{{ formatNumber(summary.processing_count) }} 位医生待到账</small>
        </article>
        <article class="metric-card">
          <span>月结已到账</span>
          <strong>{{ summaryLoaded ? formatPoints(summary.paid_amount_cent) : '—' }}</strong>
          <small>{{ formatNumber(summary.paid_count) }} 位医生已到账</small>
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
      class="cycle-table"
      @reset-search="resetSearchForm"
    >
      <template #tableSearch>
        <a-col :xs="24" :sm="8">
          <a-form-item field="keyword" label="关键词">
            <a-input
              v-model="searchForm.keyword"
              placeholder="账期、结算单号或医生"
              allow-clear
            />
          </a-form-item>
        </a-col>
        <a-col :xs="24" :sm="8">
          <a-form-item field="month" label="账期">
            <a-input
              v-model="searchForm.month"
              placeholder="YYYY-MM"
              allow-clear
              :max-length="7"
            />
          </a-form-item>
        </a-col>
        <a-col :xs="24" :sm="8">
          <a-form-item field="record_type" label="记录类型">
            <a-select
              v-model="searchForm.record_type"
              placeholder="全部记录"
              allow-clear
            >
              <a-option value="monthly_cycle">月结账期</a-option>
              <a-option value="manual_settlement">人工结算</a-option>
            </a-select>
          </a-form-item>
        </a-col>
      </template>

      <template #settlement_month="{ record }">
        <div class="cycle-cell">
          <strong>{{ record.display_title || '—' }}</strong>
          <span>{{ record.record_no || '—' }}</span>
        </div>
      </template>

      <template #record_type="{ record }">
        <a-tag :color="record.record_type === 'manual_settlement' ? 'purple' : 'blue'">
          {{ record.record_type === 'manual_settlement' ? '人工结算' : '月结账期' }}
        </a-tag>
      </template>

      <template #status="{ record }">
        <sa-dict :value="record.status" :dict="record.status_dict" />
      </template>

      <template #doctor_count="{ record }">
        <div v-if="record.record_type === 'manual_settlement'" class="record-doctor">
          <strong>{{ record.doctor_name || '—' }}</strong>
          <span>{{ formatNumber(record.review_count) }} 条明细</span>
        </div>
        <div v-else class="record-doctor">
          <strong>{{ formatNumber(record.doctor_count) }} 位医生</strong>
          <span>{{ formatNumber(record.order_count) }} 位已纳入结算</span>
        </div>
      </template>

      <template #execution_result="{ record }">
        <div class="execution-cell">
          <strong>{{ record.result_message || '—' }}</strong>
          <span v-if="record.record_type === 'manual_settlement'">
            {{ record.manual_reason || '未填写原因' }}
          </span>
          <span v-else-if="record.job_no">
            {{ record.job_no }}
            <template v-if="record.execution_count > 1">
              · 累计执行 {{ formatNumber(record.execution_count) }} 次
            </template>
          </span>
          <span v-else>无任务编号</span>
        </div>
      </template>

      <template #pending_export_amount_cent="{ record }">
        <strong>{{ formatPoints(record.pending_export_amount_cent) }}</strong>
        <small>{{ formatNumber(record.pending_export_count) }} 位</small>
      </template>

      <template #deferred_amount_cent="{ record }">
        <strong class="warning-text">{{ formatPoints(record.deferred_amount_cent) }}</strong>
        <small>{{ formatNumber(record.deferred_doctor_count) }} 位</small>
      </template>

      <template #processing_amount_cent="{ record }">
        <strong>{{ formatPoints(record.processing_amount_cent) }}</strong>
        <small>
          {{ formatNumber(record.exported_count + record.payment_failed_count) }} 位
        </small>
      </template>

      <template #paid_amount_cent="{ record }">
        <strong>{{ formatPoints(record.paid_amount_cent) }}</strong>
        <small>{{ formatNumber(record.paid_count) }} 位</small>
      </template>

      <template #operationCell="{ record }">
        <a-space wrap>
          <template v-if="record.record_type === 'monthly_cycle'">
            <a-link v-if="record.cycle_id" @click="openCycle(record)">账期详情</a-link>
            <span v-else class="disabled-action">无账期详情</span>
          </template>
          <template v-else>
            <a-link @click="orderDetailRef?.open(record.record_id)">详情</a-link>
            <a-link
              v-if="['pending_export', 'payment_failed'].includes(record.status)"
              :disabled="manualExportingId === record.record_id"
              @click="confirmManualExport(record)"
            >
              {{ manualExportingId === record.record_id ? '导出中…' : '导出' }}
            </a-link>
            <a-link
              v-if="['exported', 'payment_failed'].includes(record.status)"
              @click="markPaidRef?.open(manualRecordForAction(record))"
            >
              补录到账
            </a-link>
          </template>
        </a-space>
      </template>
    </sa-table>

    <a-alert
      v-if="manualDownloadRetry.visible"
      type="warning"
      show-icon
      closable
      @close="manualDownloadRetry.visible = false"
    >
      人工结算文件已生成，但有文件未下载成功，可直接重试。
      <template #action>
        <a-space>
          <a-button
            v-if="manualDownloadRetry.statementUrl"
            size="small"
            @click="retryManualDownload('statement')"
          >
            重下待结算名单
          </a-button>
          <a-button
            v-if="manualDownloadRetry.detailUrl"
            size="small"
            @click="retryManualDownload('detail')"
          >
            重下结算明细
          </a-button>
        </a-space>
      </template>
    </a-alert>

    <manual-settlement
      ref="manualSettlementRef"
      @success="refreshSettlement"
      @edit-account="openManualPaymentAccount"
    />
    <payment-account ref="paymentAccountRef" @success="refreshSettlement" />
    <order-detail ref="orderDetailRef" />
    <mark-paid ref="markPaidRef" @success="refreshSettlement" />
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Message, Modal } from '@arco-design/web-vue'
import tool from '@/utils/tool'
import withdrawalApi from '@/api/product/withdrawal'
import ManualSettlement from './manual-settlement.vue'
import PaymentAccount from './payment-account.vue'
import OrderDetail from './view.vue'
import MarkPaid from './mark-paid.vue'

const router = useRouter()
const crudRef = ref()
const tableError = ref('')
const summaryError = ref('')
const summaryLoading = ref(false)
const summaryLoaded = ref(false)
const manualExportingId = ref()
const manualSettlementRef = ref()
const paymentAccountRef = ref()
const orderDetailRef = ref()
const markPaidRef = ref()
const manualDownloadRetry = reactive({
  visible: false,
  statementUrl: '',
  detailUrl: ''
})

const searchForm = ref({ keyword: '', month: '', record_type: '' })
const summary = reactive({
  total_cycle_count: 0,
  current_month_accrued_amount_cent: 0,
  pending_export_count: 0,
  pending_export_amount_cent: 0,
  deferred_doctor_count: 0,
  deferred_amount_cent: 0,
  processing_count: 0,
  processing_amount_cent: 0,
  paid_count: 0,
  paid_amount_cent: 0
})

const formatNumber = (value) => Number(value || 0).toLocaleString('zh-CN')
const formatPoints = (value) => `${formatNumber(Number(value || 0) / 100)} 积分`

const loadSummary = async () => {
  summaryLoading.value = true
  summaryError.value = ''
  try {
    const response = await withdrawalApi.getMonthlySummary()
    if (response.code === 200) {
      Object.assign(summary, response.data)
      summaryLoaded.value = true
      return
    }
    summaryLoaded.value = false
    summaryError.value = response.message || '月结统计加载失败，请重新加载'
  } catch {
    summaryLoaded.value = false
    summaryError.value = '月结统计加载失败，请检查网络后重试'
  } finally {
    summaryLoading.value = false
  }
}

const loadList = async (params) => {
  try {
    const response = await withdrawalApi.getSettlementHistory(params)
    if (response.code === 200) {
      tableError.value = ''
      return response
    }
    tableError.value = response.message || '月结账期加载失败，请重新加载'
  } catch {
    tableError.value = '月结账期加载失败，请检查网络后重试'
  }

  return {
    code: 200,
    message: 'fallback',
    data: { data: [], total: 0, current_page: 1, per_page: 10 }
  }
}

const openCycle = (record) => {
  if (!record.cycle_id) return
  router.push({
    name: 'productSettlementBatchDetail',
    params: { batchNo: record.cycle_id }
  })
}

const options = reactive({
  api: loadList,
  pageLayout: 'normal',
  showSort: false,
  operationColumnWidth: 230,
  view: { show: false }
})

const columns = reactive([
  { title: '账期 / 结算记录', dataIndex: 'settlement_month', width: 215, fixed: 'left' },
  { title: '记录类型', dataIndex: 'record_type', width: 105, align: 'center' },
  { title: '状态', dataIndex: 'status', width: 110, align: 'center' },
  { title: '医生', dataIndex: 'doctor_count', width: 170 },
  { title: '执行结果', dataIndex: 'execution_result', width: 310 },
  {
    title: '待导出',
    dataIndex: 'pending_export_amount_cent',
    width: 150,
    align: 'right'
  },
  {
    title: '延期结算',
    dataIndex: 'deferred_amount_cent',
    width: 150,
    align: 'right'
  },
  {
    title: '已导出待到账',
    dataIndex: 'processing_amount_cent',
    width: 160,
    align: 'right'
  },
  { title: '已到账', dataIndex: 'paid_amount_cent', width: 150, align: 'right' },
  { title: '执行 / 生成时间', dataIndex: 'executed_at', width: 175 }
])

const manualRecordForAction = (record) => ({
  id: record.record_id,
  settlement_no: record.record_no,
  doctor_name: record.doctor_name,
  amount_cent: record.total_amount_cent,
  status: record.status
})
const downloadManualFile = async (url, type) => {
  const response = await withdrawalApi.downloadMonthlyExport(url)
  if (response?.status !== 200) throw new Error(`${type}_download_failed`)
  tool.download(response)
}
const exportManualRecord = async (record) => {
  manualExportingId.value = record.record_id
  manualDownloadRetry.visible = false
  try {
    const response = await withdrawalApi.createManualExport(record.record_id)
    if (response.code !== 200) return
    manualDownloadRetry.statementUrl = response.data.statement_url
    manualDownloadRetry.detailUrl = response.data.detail_url
    const results = await Promise.allSettled([
      downloadManualFile(response.data.statement_url, 'statement'),
      downloadManualFile(response.data.detail_url, 'detail')
    ])
    if (results[0].status === 'fulfilled') manualDownloadRetry.statementUrl = ''
    if (results[1].status === 'fulfilled') manualDownloadRetry.detailUrl = ''
    manualDownloadRetry.visible = Boolean(
      manualDownloadRetry.statementUrl || manualDownloadRetry.detailUrl
    )
    if (manualDownloadRetry.visible) {
      Message.warning('文件已生成，部分下载失败，请直接重试')
    } else {
      Message.success('1 份待结算名单和 1 份结算明细已下载')
    }
    refreshSettlement()
  } catch {
    Message.error('人工结算文件导出失败，请检查网络后重试')
  } finally {
    manualExportingId.value = undefined
  }
}
const confirmManualExport = (record) => {
  Modal.confirm({
    title: `确认导出 ${record.doctor_name || ''} 的人工结算文件`,
    content:
      '系统只生成 1 份待结算名单和 1 份结算明细。文件包含身份证号、银行卡号及审核问答等敏感信息，请妥善保管。',
    width: 'min(440px, calc(100vw - 32px))',
    okText: '确认导出',
    onOk: () => exportManualRecord(record)
  })
}
const retryManualDownload = async (type) => {
  const key = type === 'statement' ? 'statementUrl' : 'detailUrl'
  if (!manualDownloadRetry[key]) return
  try {
    await downloadManualFile(manualDownloadRetry[key], type)
    manualDownloadRetry[key] = ''
    manualDownloadRetry.visible = Boolean(
      manualDownloadRetry.statementUrl || manualDownloadRetry.detailUrl
    )
    Message.success(type === 'statement' ? '待结算名单已下载' : '结算明细已下载')
  } catch {
    Message.error('文件下载失败，请稍后重试')
  }
}
const refresh = () => crudRef.value?.refresh()
const refreshSettlement = () => {
  loadSummary()
  refresh()
}
const openManualPaymentAccount = (doctor) => paymentAccountRef.value?.open(doctor)
const resetSearchForm = () => {
  Object.assign(searchForm.value, { keyword: '', month: '', record_type: '' })
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
  gap: 16px;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
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
  grid-template-columns: repeat(5, minmax(0, 1fr));
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
    font-size: 22px;
    line-height: 32px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.cycle-table { min-width: 0; }
.record-doctor,
.execution-cell {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
  strong,
  span {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  strong {
    color: var(--color-text-1);
    line-height: 20px;
  }
  span {
    color: var(--color-text-3);
    font-size: 12px;
    line-height: 18px;
  }
}

.cycle-cell {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;

  strong { color: var(--color-text-1); }
  span {
    color: var(--color-text-3);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
  }
}

:deep(.arco-table-td) {
  small {
    display: block;
    margin-top: 4px;
    color: var(--color-text-3);
    font-size: 12px;
  }
}

.warning-text { color: rgb(var(--warning-6)); }
.disabled-action {
  color: var(--color-text-4);
  font-size: 13px;
}

@media (max-width: 1199px) {
  .summary-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (max-width: 767px) {
  .page-header { flex-direction: column; }
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
