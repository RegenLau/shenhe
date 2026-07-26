<template>
  <a-drawer
    v-model:visible="visible"
    width="min(620px, 100vw)"
    title="任务详情"
    :footer="false"
    unmount-on-close
  >
    <a-spin :loading="loading" class="detail-loading">
      <a-result
        v-if="!loading && errorMessage"
        status="error"
        title="任务详情加载失败"
        :subtitle="errorMessage"
      >
        <template #extra>
          <a-button type="primary" @click="loadDetail">重新加载</a-button>
        </template>
      </a-result>

      <template v-else-if="detail.id">
        <a-alert
          :type="accountAlertType"
          show-icon
          class="account-alert"
        >
          <template v-if="accountActive">
            医生账号已激活，当前任务已显示在该医生的小程序任务列表中。
          </template>
          <template v-else-if="accountDisabled">
            医生账号已禁用，当前无法登录小程序；该历史任务和计酬记录仍会保留。
          </template>
          <template v-else>
            医生账号已按手机号自动创建。医生首次使用 {{ maskPhone(detail.doctor_phone) }}
            登录小程序后，即可查看该任务。
          </template>
        </a-alert>

        <section class="detail-section">
          <h3>任务进度</h3>
          <div class="progress-summary">
            <div>
              <strong>{{ progressPercent }}%</strong>
              <span>
                已完成 {{ formatNumber(detail.completed_count) }} /
                {{ formatNumber(detail.item_count) }} 条
              </span>
            </div>
            <sa-dict :value="detail.status" dict="task_status" />
          </div>
          <a-progress :percent="progressRate" :show-text="false" />
        </section>

        <section class="detail-section">
          <h3>任务信息</h3>
          <a-descriptions :column="1" bordered>
            <a-descriptions-item label="任务名称">
              {{ detail.display_title || '—' }}
            </a-descriptions-item>
            <a-descriptions-item label="任务编号">
              {{ detail.task_no }}
            </a-descriptions-item>
            <a-descriptions-item label="医生">
              {{ detail.doctor_name }}
            </a-descriptions-item>
            <a-descriptions-item label="绑定手机号">
              {{ maskPhone(detail.doctor_phone) }}
            </a-descriptions-item>
            <a-descriptions-item label="执业信息">
              {{ practiceInfo }}
            </a-descriptions-item>
            <a-descriptions-item label="账号状态">
              <sa-dict
                :value="detail.account_status"
                dict="doctor_account_status"
                render="span"
              />
            </a-descriptions-item>
            <a-descriptions-item label="创建方式">
              <sa-dict :value="detail.source_type" dict="task_source" render="span" />
            </a-descriptions-item>
            <a-descriptions-item label="导入批次">
              {{ detail.import_batch_no || '—' }}
            </a-descriptions-item>
          </a-descriptions>
        </section>

        <section class="detail-section">
          <h3>计酬与时间</h3>
          <a-descriptions :column="1" bordered>
            <a-descriptions-item label="单条计酬">
              {{ formatCurrency(detail.unit_reward_cent) }}（医生端显示
              {{ formatNumber(Number(detail.unit_reward_cent || 0) / 100) }} 积分）
            </a-descriptions-item>
            <a-descriptions-item label="任务总计酬">
              <strong class="money-text">
                {{ formatCurrency(detail.total_reward_cent) }}
              </strong>
            </a-descriptions-item>
            <a-descriptions-item label="创建时间">
              {{ detail.create_time }}
            </a-descriptions-item>
            <a-descriptions-item label="开始时间">
              {{ detail.start_time || '—' }}
            </a-descriptions-item>
            <a-descriptions-item label="完成时间">
              {{ detail.complete_time || '—' }}
            </a-descriptions-item>
          </a-descriptions>
        </section>
      </template>
    </a-spin>
  </a-drawer>
</template>

<script setup>
import { computed, ref } from 'vue'
import taskApi from '@/api/product/task'

const visible = ref(false)
const loading = ref(false)
const errorMessage = ref('')
const taskId = ref()
const detail = ref({})

const formatNumber = (value) => Number(value || 0).toLocaleString('zh-CN')
const formatCurrency = (value) => `¥${formatNumber(Number(value || 0) / 100)}`
const maskPhone = (value) =>
  String(value || '').replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2') || '—'

const accountActive = computed(() => {
  return ['active', 'bound'].includes(detail.value.account_status)
})
const accountDisabled = computed(
  () => detail.value.account_status === 'disabled'
)
const accountAlertType = computed(() => {
  if (accountActive.value) return 'success'
  if (accountDisabled.value) return 'error'
  return 'warning'
})

const progressRate = computed(() => {
  if (!detail.value.item_count) return 0
  return Math.min(
    Number(detail.value.completed_count || 0) / Number(detail.value.item_count),
    1
  )
})

const progressPercent = computed(() => Math.round(progressRate.value * 100))

const practiceInfo = computed(() => {
  const values = [detail.value.hospital, detail.value.department].filter(
    (value) => value && value !== '待补充',
  )
  return values.join(' · ') || '待补充'
})

const loadDetail = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await taskApi.read(taskId.value)
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
  taskId.value = id
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

.account-alert {
  margin-bottom: 20px;
}

.detail-section {
  margin-bottom: 24px;

  h3 {
    margin: 0 0 12px;
    color: var(--color-text-1);
    font-size: 15px;
    font-weight: 600;
  }
}

.progress-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;

  div {
    display: flex;
    align-items: baseline;
    gap: 10px;
  }

  strong {
    color: var(--color-text-1);
    font-size: 24px;
  }

  span {
    color: var(--color-text-3);
    font-size: 12px;
  }
}

.money-text {
  color: rgb(var(--primary-6));
}
</style>
