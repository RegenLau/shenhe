<template>
  <div class="cycle-page">
    <header class="page-header">
      <div class="header-main">
        <a-button @click="goBack">
          <template #icon><icon-left /></template>
          返回月结管理
        </a-button>
        <div class="header-title">
          <h1>{{ cycle.display_title || '月结账期详情' }}</h1>
          <p v-if="cycle.cycle_no">
            {{ cycle.cycle_no }} · {{ cycle.period_start }} 至 {{ cycle.period_end }}
          </p>
        </div>
      </div>
      <a-space wrap>
        <a-button type="outline" status="warning" @click="manualSettlementRef?.open()">
          <template #icon><icon-plus /></template>
          人工单独结算
        </a-button>
        <a-button :disabled="!canImport" @click="settlementImportRef?.open()">
          <template #icon><icon-upload /></template>
          导入到账结果
        </a-button>
        <a-button
          type="primary"
          :loading="exporting"
          :disabled="selectedOrderIds.length === 0"
          @click="confirmExport"
        >
          <template #icon><icon-download /></template>
          导出已选 {{ selectedOrderIds.length }} 张
        </a-button>
      </a-space>
    </header>

    <a-result
      v-if="!loading && errorMessage"
      status="error"
      title="月结账期加载失败"
      :subtitle="errorMessage"
    >
      <template #extra>
        <a-button type="primary" @click="loadDetail">重新加载</a-button>
      </template>
    </a-result>

    <a-spin v-else :loading="loading" class="cycle-content">
      <template v-if="cycle.cycle_no">
        <a-alert type="info" show-icon>
          自动月结只生成结算单，不代表已向银行发起打款。请导出月度结算单和医生结算明细，打款后再导入到账结果。可结算积分为 0 的医生不会生成结算记录，也不会出现在导出文件中。
        </a-alert>

        <section class="summary-grid" aria-label="账期统计">
          <article class="metric-card">
            <span>待导出</span>
            <strong>{{ formatPoints(cycle.pending_export_amount_cent) }}</strong>
            <small>{{ formatNumber(cycle.pending_export_count) }} 张结算单</small>
          </article>
          <article class="metric-card">
            <span>延期结算</span>
            <strong>{{ formatPoints(cycle.deferred_amount_cent) }}</strong>
            <small>{{ formatNumber(cycle.deferred_doctor_count) }} 位医生</small>
          </article>
          <article class="metric-card">
            <span>已导出待到账</span>
            <strong>{{ formatPoints(cycle.processing_amount_cent) }}</strong>
            <small>{{ formatNumber(processingCount) }} 张结算单</small>
          </article>
          <article class="metric-card">
            <span>已到账</span>
            <strong>{{ formatPoints(cycle.paid_amount_cent) }}</strong>
            <small>{{ formatNumber(cycle.paid_count) }} 张结算单</small>
          </article>
        </section>

        <a-alert
          v-if="downloadRetry.visible"
          type="warning"
          show-icon
          closable
          @close="downloadRetry.visible = false"
        >
          导出文件已生成，但有文件未成功下载，可直接重试，不会重复生成结算单。
          <template #action>
            <a-space wrap>
              <a-button
                v-if="downloadRetry.statementUrl"
                size="small"
                @click="retryDownload('statement')"
              >
                重下结算单
              </a-button>
              <a-button
                v-if="downloadRetry.detailUrl"
                size="small"
                @click="retryDownload('detail')"
              >
                重下结算明细
              </a-button>
            </a-space>
          </template>
        </a-alert>

        <a-card :bordered="false" class="list-card">
          <div class="list-toolbar">
            <a-tabs v-model:active-key="activeTab" type="rounded" @change="clearSelection">
              <a-tab-pane key="all" :title="`全部结算单 ${orders.length}`" />
              <a-tab-pane
                key="pending_export"
                :title="`待导出 ${statusCount('pending_export')}`"
              />
              <a-tab-pane key="processing" :title="`待到账 ${processingCount}`" />
              <a-tab-pane key="paid" :title="`已到账 ${statusCount('paid')}`" />
              <a-tab-pane key="deferred" :title="`延期 ${deferredDoctors.length}`" />
            </a-tabs>
            <a-input-search
              v-model="keyword"
              allow-clear
              class="keyword-search"
              placeholder="搜索医生或结算单号"
            />
          </div>

          <a-table
            v-if="activeTab !== 'deferred'"
            :data="filteredOrders"
            :pagination="{ pageSize: 10, showTotal: true }"
            :bordered="{ wrapper: true, cell: false }"
            :scroll="{ x: 1510 }"
            row-key="id"
          >
            <template #columns>
              <a-table-column :width="48" fixed="left">
                <template #title>
                  <a-checkbox
                    :model-value="allVisibleSelected"
                    :indeterminate="visibleSelectionIndeterminate"
                    :disabled="visibleExportableOrders.length === 0"
                    aria-label="全选当前可导出结算单"
                    @change="toggleSelectAll"
                  />
                </template>
                <template #cell="{ record }">
                  <a-checkbox
                    v-if="isExportable(record)"
                    :model-value="selectedOrderIds.includes(record.id)"
                    :aria-label="`选择结算单 ${record.settlement_no}`"
                    @change="(checked) => toggleOrder(record.id, checked)"
                  />
                </template>
              </a-table-column>
              <a-table-column title="医生" data-index="doctor_name" :width="170" fixed="left">
                <template #cell="{ record }">
                  <div class="stack-cell">
                    <strong>{{ record.doctor_name || '—' }}</strong>
                    <span>{{ record.doctor_phone_masked || '—' }}</span>
                  </div>
                </template>
              </a-table-column>
              <a-table-column title="结算单号" data-index="settlement_no" :width="190">
                <template #cell="{ record }">
                  <span class="number-text">{{ record.settlement_no || '—' }}</span>
                </template>
              </a-table-column>
              <a-table-column title="类型" data-index="settlement_type" :width="105" align="center">
                <template #cell="{ record }">
                  <a-tag :color="record.settlement_type === 'manual' ? 'purple' : 'blue'">
                    {{ settlementTypeLabel(record.settlement_type) }}
                  </a-tag>
                </template>
              </a-table-column>
              <a-table-column title="本期积分" data-index="current_month_amount_cent" :width="120" align="right">
                <template #cell="{ record }">{{ formatPoints(record.current_month_amount_cent) }}</template>
              </a-table-column>
              <a-table-column title="递延积分" data-index="carryover_amount_cent" :width="120" align="right">
                <template #cell="{ record }">{{ formatPoints(record.carryover_amount_cent) }}</template>
              </a-table-column>
              <a-table-column title="结算总积分" data-index="amount_cent" :width="135" align="right">
                <template #cell="{ record }"><strong>{{ formatPoints(record.amount_cent) }}</strong></template>
              </a-table-column>
              <a-table-column title="明细" data-index="review_count" :width="105" align="right">
                <template #cell="{ record }">{{ formatNumber(record.review_count) }} 条</template>
              </a-table-column>
              <a-table-column title="收款账户" data-index="payment_account" :width="210">
                <template #cell="{ record }">
                  <div class="stack-cell">
                    <strong>{{ record.payment_account?.bank_name || '—' }}</strong>
                    <span>{{ record.payment_account?.bank_card_masked || '—' }}</span>
                  </div>
                </template>
              </a-table-column>
              <a-table-column title="状态" data-index="status" :width="110" align="center">
                <template #cell="{ record }">
                  <sa-dict :value="record.status" dict="monthly_settlement_order_status" />
                </template>
              </a-table-column>
              <a-table-column title="生成时间" data-index="generated_at" :width="165" />
              <a-table-column title="操作" :width="190" fixed="right">
                <template #cell="{ record }">
                  <a-space>
                    <a-link @click="orderDetailRef?.open(record.id)">详情</a-link>
                    <a-link
                      v-if="['exported', 'payment_failed'].includes(record.status)"
                      @click="markPaidRef?.open(record)"
                    >
                      补录到账
                    </a-link>
                  </a-space>
                </template>
              </a-table-column>
            </template>
          </a-table>

          <a-table
            v-else
            :data="filteredDeferredDoctors"
            :pagination="{ pageSize: 10, showTotal: true }"
            :bordered="{ wrapper: true, cell: false }"
            :scroll="{ x: 1290 }"
            row-key="doctor_id"
          >
            <template #columns>
              <a-table-column title="医生" data-index="doctor_name" :width="170" fixed="left">
                <template #cell="{ record }">
                  <div class="stack-cell">
                    <strong>{{ record.doctor_name || '—' }}</strong>
                    <span>{{ record.doctor_phone_masked || '—' }}</span>
                  </div>
                </template>
              </a-table-column>
              <a-table-column title="执业信息" data-index="hospital" :width="220">
                <template #cell="{ record }">
                  <div class="stack-cell">
                    <strong>{{ record.hospital || '—' }}</strong>
                    <span>{{ record.department || '—' }}</span>
                  </div>
                </template>
              </a-table-column>
              <a-table-column title="待结算积分" data-index="accrued_amount_cent" :width="145" align="right">
                <template #cell="{ record }"><strong>{{ formatPoints(record.accrued_amount_cent) }}</strong></template>
              </a-table-column>
              <a-table-column title="明细" data-index="review_count" :width="90" align="right">
                <template #cell="{ record }">{{ formatNumber(record.review_count) }} 条</template>
              </a-table-column>
              <a-table-column title="专业认证" data-index="certification_status" :width="110" align="center">
                <template #cell="{ record }">
                  <sa-dict :value="record.certification_status" dict="doctor_certification_status" />
                </template>
              </a-table-column>
              <a-table-column title="收款信息" data-index="payment_account_status" :width="110" align="center">
                <template #cell="{ record }">
                  <sa-dict :value="record.payment_account_status" dict="payment_account_status" />
                </template>
              </a-table-column>
              <a-table-column title="延期原因" data-index="reason" :width="300">
                <template #cell="{ record }">
                  <span class="reason-text">{{ record.reason || '—' }}</span>
                </template>
              </a-table-column>
              <a-table-column title="操作" :width="205" fixed="right">
                <template #cell="{ record }">
                  <a-space>
                    <a-link @click="paymentAccountRef?.open(record)">收款信息</a-link>
                    <a-tooltip
                      :content="manualActionTip(record)"
                    >
                      <a-link
                        :disabled="!canManuallySettle(record)"
                        @click="canManuallySettle(record) && manualSettlementRef?.open(record)"
                      >
                        {{ Number(record.current_settleable_amount_cent || 0) > 0 ? '单独结算' : '已处理' }}
                      </a-link>
                    </a-tooltip>
                  </a-space>
                </template>
              </a-table-column>
            </template>
          </a-table>
        </a-card>
      </template>
    </a-spin>

    <order-detail ref="orderDetailRef" />
    <settlement-import
      ref="settlementImportRef"
      :cycle-id="cycleId"
      @success="loadDetail"
    />
    <payment-account ref="paymentAccountRef" @success="loadDetail" />
    <manual-settlement
      ref="manualSettlementRef"
      @success="loadDetail"
      @edit-account="openManualPaymentAccount"
    />
    <mark-paid ref="markPaidRef" @success="loadDetail" />
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Message, Modal } from '@arco-design/web-vue'
import tool from '@/utils/tool'
import withdrawalApi from '@/api/product/withdrawal'
import OrderDetail from './view.vue'
import SettlementImport from './settlement-import.vue'
import PaymentAccount from './payment-account.vue'
import ManualSettlement from './manual-settlement.vue'
import MarkPaid from './mark-paid.vue'

const route = useRoute()
const router = useRouter()
const cycleId = Number(route.params.batchNo)
const loading = ref(false)
const exporting = ref(false)
const errorMessage = ref('')
const activeTab = ref('all')
const keyword = ref('')
const selectedOrderIds = ref([])
const orderDetailRef = ref()
const settlementImportRef = ref()
const paymentAccountRef = ref()
const manualSettlementRef = ref()
const markPaidRef = ref()
const cycle = reactive({ doctor_settlements: [], deferred_doctors: [] })
const downloadRetry = reactive({ visible: false, statementUrl: '', detailUrl: '' })

const orders = computed(() => cycle.doctor_settlements || [])
const deferredDoctors = computed(() => cycle.deferred_doctors || [])
const processingCount = computed(
  () => Number(cycle.exported_count || 0) + Number(cycle.payment_failed_count || 0)
)
const canImport = computed(() =>
  orders.value.some((item) => ['exported', 'payment_failed'].includes(item.status))
)
const statusCount = (status) => orders.value.filter((item) => item.status === status).length
const formatNumber = (value) => Number(value || 0).toLocaleString('zh-CN')
const formatPoints = (value) => `${formatNumber(Number(value || 0) / 100)} 积分`
const settlementTypeLabel = (value) => {
  if (value === 'manual') return '人工结算'
  if (value === 'legacy') return '历史结算'
  return '系统月结'
}
const isExportable = (record) =>
  ['pending_export', 'payment_failed'].includes(record.status)
const canManuallySettle = (record) =>
  Number(record.current_settleable_amount_cent || 0) > 0 &&
  record.current_payment_complete
const manualActionTip = (record) => {
  if (Number(record.current_settleable_amount_cent || 0) <= 0) {
    return '该医生当前已无未结积分，历史延期快照保留不变'
  }
  return record.current_payment_complete
    ? '单独结算将结算截至当前的全部未结积分'
    : '请先补齐收款信息'
}

const filterByKeyword = (record) => {
  const value = keyword.value.trim().toLowerCase()
  if (!value) return true
  return [record.doctor_name, record.settlement_no, record.doctor_phone_masked].some(
    (item) => String(item || '').toLowerCase().includes(value)
  )
}
const filteredOrders = computed(() =>
  orders.value.filter((item) => {
    if (!filterByKeyword(item)) return false
    if (activeTab.value === 'pending_export') return item.status === 'pending_export'
    if (activeTab.value === 'processing') {
      return ['exported', 'payment_failed'].includes(item.status)
    }
    if (activeTab.value === 'paid') return item.status === 'paid'
    return true
  })
)
const filteredDeferredDoctors = computed(() =>
  deferredDoctors.value.filter((item) => {
    const value = keyword.value.trim().toLowerCase()
    if (!value) return true
    return [item.doctor_name, item.doctor_phone_masked, item.hospital].some(
      (field) => String(field || '').toLowerCase().includes(value)
    )
  })
)
const visibleExportableOrders = computed(() => filteredOrders.value.filter(isExportable))
const visibleSelectedCount = computed(() =>
  visibleExportableOrders.value.filter((item) => selectedOrderIds.value.includes(item.id)).length
)
const allVisibleSelected = computed(
  () =>
    visibleExportableOrders.value.length > 0 &&
    visibleSelectedCount.value === visibleExportableOrders.value.length
)
const visibleSelectionIndeterminate = computed(
  () =>
    visibleSelectedCount.value > 0 &&
    visibleSelectedCount.value < visibleExportableOrders.value.length
)

const clearSelection = () => { selectedOrderIds.value = [] }
const toggleOrder = (id, checked) => {
  const selected = new Set(selectedOrderIds.value)
  if (checked) selected.add(id)
  else selected.delete(id)
  selectedOrderIds.value = [...selected]
}
const toggleSelectAll = (checked) => {
  const selected = new Set(selectedOrderIds.value)
  visibleExportableOrders.value.forEach((item) =>
    checked ? selected.add(item.id) : selected.delete(item.id)
  )
  selectedOrderIds.value = [...selected]
}

const loadDetail = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await withdrawalApi.readCycle(cycleId)
    if (response.code === 200) {
      Object.assign(cycle, { doctor_settlements: [], deferred_doctors: [] }, response.data)
      selectedOrderIds.value = selectedOrderIds.value.filter((id) =>
        orders.value.some((item) => item.id === id && isExportable(item))
      )
      return
    }
    errorMessage.value = response.message || '请稍后重新加载'
  } catch {
    errorMessage.value = '网络连接异常，请检查后重试'
  } finally {
    loading.value = false
  }
}

const downloadFile = async (url, type) => {
  const response = await withdrawalApi.downloadMonthlyExport(url)
  if (response?.status !== 200) throw new Error(`${type}_download_failed`)
  tool.download(response)
}
const exportSelected = async () => {
  exporting.value = true
  downloadRetry.visible = false
  try {
    const response = await withdrawalApi.createMonthlyExport({
      cycle_id: cycleId,
      order_ids: selectedOrderIds.value
    })
    if (response.code !== 200) return
    const data = response.data
    downloadRetry.statementUrl = data.statement_url
    downloadRetry.detailUrl = data.detail_url
    const results = await Promise.allSettled([
      downloadFile(data.statement_url, 'statement'),
      downloadFile(data.detail_url, 'detail')
    ])
    if (results[0].status === 'fulfilled') downloadRetry.statementUrl = ''
    if (results[1].status === 'fulfilled') downloadRetry.detailUrl = ''
    downloadRetry.visible = Boolean(downloadRetry.statementUrl || downloadRetry.detailUrl)
    if (downloadRetry.visible) {
      Message.warning('结算文件已生成，部分下载失败，请直接重试')
    } else {
      Message.success('月度结算单和医生结算明细已分别下载')
    }
    selectedOrderIds.value = []
    await loadDetail()
  } catch {
    Message.error('结算文件导出失败，请检查网络后重试')
  } finally {
    exporting.value = false
  }
}
const retryDownload = async (type) => {
  const key = type === 'statement' ? 'statementUrl' : 'detailUrl'
  if (!downloadRetry[key]) return
  try {
    await downloadFile(downloadRetry[key], type)
    downloadRetry[key] = ''
    downloadRetry.visible = Boolean(downloadRetry.statementUrl || downloadRetry.detailUrl)
    Message.success(type === 'statement' ? '月度结算单已下载' : '医生结算明细已下载')
  } catch {
    Message.error('文件下载失败，请稍后重试')
  }
}
const confirmExport = () => {
  Modal.confirm({
    title: `确认导出 ${selectedOrderIds.value.length} 张医生结算单`,
    content:
      '系统将分别生成月度结算单和对应医生结算明细。文件包含身份证号、银行卡号及审核问答等敏感信息，仅限结算使用，请妥善保管。',
    width: 'min(440px, calc(100vw - 32px))',
    okText: '确认导出',
    onOk: exportSelected
  })
}
const openManualPaymentAccount = (doctor) => paymentAccountRef.value?.open(doctor)
const goBack = () => router.push({ name: 'productWithdrawal' })
onMounted(loadDetail)
</script>

<style scoped lang="less">
.cycle-page {
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
}
.header-main {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: 12px;
}
.header-title {
  min-width: 0;
  h1 {
    margin: 0;
    color: var(--color-text-1);
    font-size: 20px;
    line-height: 28px;
  }
  p {
    margin: 4px 0 0;
    color: var(--color-text-3);
    font-size: 13px;
    line-height: 20px;
  }
}
.cycle-content {
  display: block;
  width: 100%;
  min-height: 420px;
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;
}
.metric-card {
  display: flex;
  min-width: 0;
  min-height: 104px;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  padding: 16px 20px;
  background: var(--color-bg-2);
  border: 1px solid var(--color-border-1);
  border-radius: var(--border-radius-medium);
  span,
  small { color: var(--color-text-3); }
  strong {
    overflow: hidden;
    color: var(--color-text-1);
    font-size: 21px;
    line-height: 30px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
.list-card { margin-top: 16px; }
.list-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}
.keyword-search { width: min(280px, 100%); }
.stack-cell {
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
.reason-text {
  color: var(--color-text-2);
  font-size: 13px;
  line-height: 20px;
}
@media (max-width: 991px) {
  .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 767px) {
  .page-header,
  .header-main,
  .list-toolbar { flex-direction: column; }
  .page-header { padding: 16px; }
  .keyword-search { width: 100%; }
}
@media (max-width: 575px) {
  .summary-grid { grid-template-columns: 1fr; }
}
</style>
