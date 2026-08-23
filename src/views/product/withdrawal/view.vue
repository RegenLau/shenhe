<template>
  <a-drawer
    v-model:visible="visible"
    width="min(920px, 100vw)"
    title="医生结算单详情"
    :footer="false"
    unmount-on-close
  >
    <a-spin :loading="loading" class="detail-loading">
      <a-result
        v-if="!loading && errorMessage"
        status="error"
        title="结算单详情加载失败"
        :subtitle="errorMessage"
      >
        <template #extra>
          <a-button type="primary" @click="loadDetail">重新加载</a-button>
        </template>
      </a-result>

      <template v-else-if="detail.id">
        <a-alert type="info" show-icon class="detail-tip">
          本结算单的积分来自已完成的逐条审核记录；生成后对应明细已锁定，不会再重复进入后续月结。
        </a-alert>

        <section class="detail-section">
          <h3>结算信息</h3>
          <a-descriptions :column="2" bordered :label-style="{ width: '120px' }">
            <a-descriptions-item label="结算单号">
              <span class="number-text">{{ detail.settlement_no || '—' }}</span>
            </a-descriptions-item>
            <a-descriptions-item label="结算状态">
              <sa-dict
                v-if="detail.status"
                :value="detail.status"
                dict="monthly_settlement_order_status"
              />
            </a-descriptions-item>
            <a-descriptions-item label="结算类型">
              {{ settlementTypeLabel(detail.settlement_type) }}
            </a-descriptions-item>
            <a-descriptions-item label="生成时间">
              {{ detail.generated_at || '—' }}
            </a-descriptions-item>
            <a-descriptions-item label="本期积分">
              {{ formatPoints(detail.current_month_amount_cent) }}
            </a-descriptions-item>
            <a-descriptions-item label="递延积分">
              {{ formatPoints(detail.carryover_amount_cent) }}
            </a-descriptions-item>
            <a-descriptions-item label="结算总积分">
              <strong class="money-text">{{ formatPoints(detail.amount_cent) }}</strong>
            </a-descriptions-item>
            <a-descriptions-item label="审核明细">
              {{ formatNumber(detail.review_count) }} 条
            </a-descriptions-item>
            <a-descriptions-item label="导出时间">
              {{ detail.exported_at || '—' }}
            </a-descriptions-item>
            <a-descriptions-item label="到账时间">
              {{ detail.paid_at || '—' }}
            </a-descriptions-item>
            <a-descriptions-item label="银行流水号" :span="2">
              <span class="long-text">{{ detail.transaction_no || '—' }}</span>
            </a-descriptions-item>
            <a-descriptions-item
              v-if="detail.payment_failed_reason"
              label="失败原因"
              :span="2"
            >
              <span class="danger-text">{{ detail.payment_failed_reason }}</span>
            </a-descriptions-item>
            <a-descriptions-item
              v-if="detail.manual_reason"
              label="人工特批原因"
              :span="2"
            >
              <span class="long-text">{{ detail.manual_reason }}</span>
            </a-descriptions-item>
          </a-descriptions>
        </section>

        <section class="detail-section">
          <h3>医生与收款信息</h3>
          <a-descriptions :column="2" bordered :label-style="{ width: '120px' }">
            <a-descriptions-item label="医生姓名">{{ detail.doctor_name || '—' }}</a-descriptions-item>
            <a-descriptions-item label="手机号">{{ detail.doctor_phone_masked || '—' }}</a-descriptions-item>
            <a-descriptions-item label="医院">{{ detail.hospital || '—' }}</a-descriptions-item>
            <a-descriptions-item label="科室">{{ detail.department || '—' }}</a-descriptions-item>
            <a-descriptions-item label="收款人">{{ detail.payment_account?.payee_name || '—' }}</a-descriptions-item>
            <a-descriptions-item label="身份证号">{{ detail.payment_account?.id_card_masked || '—' }}</a-descriptions-item>
            <a-descriptions-item label="开户行">{{ detail.payment_account?.bank_name || '—' }}</a-descriptions-item>
            <a-descriptions-item label="银行卡号">{{ detail.payment_account?.bank_card_masked || '—' }}</a-descriptions-item>
          </a-descriptions>
        </section>

        <section class="detail-section">
          <div class="section-heading">
            <h3>结算明细</h3>
            <span>{{ formatNumber(lines.length) }} 条 · {{ formatNumber(detail.project_count) }} 个来源项目</span>
          </div>
          <a-table
            v-if="lines.length"
            :data="lines"
            :pagination="{ pageSize: 10, showTotal: true }"
            :bordered="{ wrapper: true, cell: false }"
            :scroll="{ x: 1740 }"
            row-key="review_id"
            size="small"
          >
            <template #columns>
              <a-table-column title="来源月份" data-index="source_month" :width="105" />
              <a-table-column title="基金会" data-index="foundation_name" :width="200" />
              <a-table-column title="所属项目" data-index="project_name" :width="220" />
              <a-table-column title="任务编号" data-index="task_no" :width="180">
                <template #cell="{ record }"><span class="number-text">{{ record.task_no }}</span></template>
              </a-table-column>
              <a-table-column title="审核记录" data-index="review_no" :width="190">
                <template #cell="{ record }"><span class="number-text">{{ record.review_no }}</span></template>
              </a-table-column>
              <a-table-column title="积分" data-index="amount_cent" :width="95" align="right">
                <template #cell="{ record }">{{ formatPoints(record.amount_cent) }}</template>
              </a-table-column>
              <a-table-column title="审核问题" data-index="question" :width="300">
                <template #cell="{ record }"><span class="wrap-text">{{ record.question || '—' }}</span></template>
              </a-table-column>
              <a-table-column title="问题对应答案" data-index="answer" :width="360">
                <template #cell="{ record }"><span class="wrap-text">{{ formatAnswer(record.answer) }}</span></template>
              </a-table-column>
              <a-table-column title="审核意见" data-index="review_comment" :width="280">
                <template #cell="{ record }"><span class="wrap-text">{{ record.review_comment || '—' }}</span></template>
              </a-table-column>
              <a-table-column title="完成时间" data-index="earned_at" :width="165" />
            </template>
          </a-table>
          <a-empty v-else description="暂无结算明细" />
        </section>

        <section class="detail-section">
          <div class="section-heading">
            <h3>操作记录</h3>
            <span>{{ formatNumber(auditLogs.length) }} 条</span>
          </div>
          <a-table
            v-if="auditLogs.length"
            :data="auditLogs"
            :pagination="false"
            :bordered="{ wrapper: true, cell: false }"
            row-key="id"
            size="small"
          >
            <template #columns>
              <a-table-column title="操作" data-index="action" :width="140">
                <template #cell="{ record }">{{ actionLabel(record.action) }}</template>
              </a-table-column>
              <a-table-column title="操作人" data-index="operator" :width="180" />
              <a-table-column title="说明" data-index="remark">
                <template #cell="{ record }">{{ record.remark || '—' }}</template>
              </a-table-column>
              <a-table-column title="操作时间" data-index="create_time" :width="165" />
            </template>
          </a-table>
        </section>
      </template>
    </a-spin>
  </a-drawer>
</template>

<script setup>
import { computed, ref } from 'vue'
import withdrawalApi from '@/api/product/withdrawal'

const visible = ref(false)
const loading = ref(false)
const errorMessage = ref('')
const orderId = ref()
const detail = ref({})
const lines = computed(() => detail.value.lines || [])
const auditLogs = computed(() => detail.value.audit_logs || [])
const formatNumber = (value) => Number(value || 0).toLocaleString('zh-CN')
const formatPoints = (value) => `${formatNumber(Number(value || 0) / 100)} 积分`
const settlementTypeLabel = (value) => {
  if (value === 'manual') return '人工特批'
  if (value === 'legacy') return '历史结算'
  return '系统月结'
}
const formatAnswer = (value) => {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.join('、')
  return JSON.stringify(value)
}
const actionLabel = (value) => ({
  order_created: '生成结算单',
  manual_created: '人工创建',
  manual_approved: '人工特批',
  exported: '导出结算文件',
  payment_confirmed: '确认到账',
  payment_failed: '记录打款失败'
}[value] || value || '—')

const loadDetail = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await withdrawalApi.readMonthlyOrder(orderId.value)
    if (response.code === 200) {
      detail.value = response.data
      return
    }
    detail.value = {}
    errorMessage.value = response.message || '请稍后重新加载'
  } catch {
    detail.value = {}
    errorMessage.value = '网络连接异常，请检查后重试'
  } finally {
    loading.value = false
  }
}
const open = async (id) => {
  orderId.value = id
  detail.value = {}
  visible.value = true
  await loadDetail()
}
defineExpose({ open })
</script>

<style scoped lang="less">
.detail-loading {
  display: block;
  width: 100%;
  min-height: 360px;
}
.detail-tip { margin-bottom: 20px; }
.detail-section {
  margin-bottom: 24px;
  h3 {
    margin: 0 0 12px;
    color: var(--color-text-1);
    font-size: 15px;
    line-height: 24px;
  }
}
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  h3 { margin: 0; }
  span {
    color: var(--color-text-3);
    font-size: 12px;
  }
}
.number-text {
  color: var(--color-text-2);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  overflow-wrap: anywhere;
}
.money-text { font-size: 16px; }
.long-text,
.wrap-text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.wrap-text {
  display: block;
  max-height: 92px;
  overflow: auto;
  line-height: 20px;
}
.danger-text { color: rgb(var(--danger-6)); }
@media (max-width: 575px) {
  .section-heading {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
