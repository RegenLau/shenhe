<template>
  <a-drawer
    v-model:visible="visible"
    width="min(680px, 100vw)"
    title="提现申请详情"
    :footer="false"
    unmount-on-close
  >
    <a-spin :loading="loading" class="detail-loading">
      <a-result
        v-if="!loading && errorMessage"
        status="error"
        title="提现申请详情加载失败"
        :subtitle="errorMessage"
      >
        <template #extra>
          <a-button type="primary" @click="loadDetail">重新加载</a-button>
        </template>
      </a-result>

      <template v-else-if="detail.id">
        <a-alert type="info" show-icon class="detail-tip">
          平台只整理申请并导出基金会处理，不进行提现审批或打款。已导出仅表示名单已整理，不代表基金会已完成支付。
        </a-alert>

        <section class="detail-section">
          <h3>申请信息</h3>
          <a-descriptions :column="1" bordered>
            <a-descriptions-item label="申请单号">
              <span class="number-text">{{ detail.withdrawal_no || '—' }}</span>
            </a-descriptions-item>
            <a-descriptions-item label="提现金额">
              <strong class="money-text">{{ formatCurrency(detail.amount_cent) }}</strong>
            </a-descriptions-item>
            <a-descriptions-item label="导出状态">
              <sa-dict
                v-if="detail.status"
                :value="detail.status"
                dict="withdrawal_export_status"
                render="span"
              />
              <span v-else>—</span>
            </a-descriptions-item>
            <a-descriptions-item label="申请时间">
              {{ detail.applied_at || '—' }}
            </a-descriptions-item>
            <a-descriptions-item label="导出时间">
              {{ detail.exported_at || '—' }}
            </a-descriptions-item>
          </a-descriptions>
        </section>

        <section class="detail-section">
          <h3>医生信息</h3>
          <a-descriptions :column="1" bordered>
            <a-descriptions-item label="医生姓名">
              <span class="long-text">{{ detail.payee_name || '—' }}</span>
            </a-descriptions-item>
            <a-descriptions-item label="绑定手机号">
              {{ detail.doctor_phone_masked || '—' }}
            </a-descriptions-item>
          </a-descriptions>
        </section>

        <section class="detail-section">
          <h3>收款信息</h3>
          <a-descriptions :column="1" bordered>
            <a-descriptions-item label="收款人">
              <span class="long-text">{{ detail.payee_name || '—' }}</span>
            </a-descriptions-item>
            <a-descriptions-item label="身份证号">
              {{ detail.id_card_masked || '—' }}
            </a-descriptions-item>
            <a-descriptions-item label="收款银行">
              <span class="long-text">{{ detail.bank_name || '—' }}</span>
            </a-descriptions-item>
            <a-descriptions-item label="银行卡号">
              {{ detail.bank_card_masked || '—' }}
            </a-descriptions-item>
          </a-descriptions>
        </section>

        <section class="detail-section">
          <div class="section-heading">
            <h3>来源任务</h3>
            <span>
              共 {{ formatNumber(sourceTasks.length) }} 个任务 ·
              {{ formatNumber(sourceReviewCount) }} 条审核
            </span>
          </div>

          <a-empty
            v-if="!sourceTasks.length"
            class="task-empty"
            description="暂无可展示的来源任务"
          />
          <a-table
            v-else
            :columns="taskColumns"
            :data="sourceTasks"
            :pagination="false"
            :scroll="{ x: 570 }"
            row-key="task_no"
            size="small"
          >
            <template #task_no="{ record }">
              <span class="number-text">{{ record.task_no || '—' }}</span>
            </template>
            <template #review_count="{ record }">
              {{ formatNumber(record.review_count) }} 条
            </template>
            <template #reward_amount_cent="{ record }">
              {{ formatCurrency(record.reward_amount_cent) }}
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
const withdrawalId = ref()
const detail = ref({})

const taskColumns = [
  {
    title: '任务编号',
    dataIndex: 'task_no',
    slotName: 'task_no',
    width: 170
  },
  {
    title: '审核条数',
    dataIndex: 'review_count',
    slotName: 'review_count',
    width: 100,
    align: 'right'
  },
  {
    title: '本次计酬',
    dataIndex: 'reward_amount_cent',
    slotName: 'reward_amount_cent',
    width: 120,
    align: 'right'
  },
  { title: '完成时间', dataIndex: 'completed_at', width: 165 }
]

const sourceTasks = computed(() => {
  return Array.isArray(detail.value.source_tasks) ? detail.value.source_tasks : []
})
const sourceReviewCount = computed(() => {
  return sourceTasks.value.reduce(
    (total, task) => total + Number(task.review_count || 0),
    0
  )
})

const formatNumber = (value) => Number(value || 0).toLocaleString('zh-CN')
const formatCurrency = (value) => {
  const amount = Number(value || 0) / 100
  return `¥${amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}

const loadDetail = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await withdrawalApi.read(withdrawalId.value)
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
  withdrawalId.value = id
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

.detail-tip {
  margin-bottom: 20px;
}

.detail-section {
  margin-bottom: 24px;

  h3 {
    margin: 0 0 12px;
    color: var(--color-text-1);
    font-size: 15px;
    font-weight: 600;
    line-height: 24px;
  }
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;

  h3 {
    margin: 0;
  }

  span {
    color: var(--color-text-3);
    font-size: 12px;
    line-height: 20px;
    text-align: right;
  }
}

.number-text {
  color: var(--color-text-2);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  overflow-wrap: anywhere;
}

.money-text {
  color: var(--color-text-1);
  font-size: 16px;
  font-weight: 600;
}

.long-text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.task-empty {
  padding: 24px 0;
}

@media (max-width: 575px) {
  .section-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;

    span {
      text-align: left;
    }
  }
}
</style>
