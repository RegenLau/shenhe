<template>
  <a-drawer
    v-model:visible="visible"
    width="min(900px, 100vw)"
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
            医生账号待激活。医生首次使用 {{ maskPhone(detail.doctor_phone) }}
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
            <a-descriptions-item label="所属基金会">
              {{ detail.foundation_name || '—' }}
            </a-descriptions-item>
            <a-descriptions-item label="所属项目">
              {{ detail.project_name || '—' }}
            </a-descriptions-item>
            <a-descriptions-item label="项目标识">
              {{ detail.identifier_name || '—' }}
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
            <a-descriptions-item label="名单创建日期">
              {{ detail.import_date || '—' }}
            </a-descriptions-item>
          </a-descriptions>
        </section>

        <section class="detail-section">
          <h3>积分与时间</h3>
          <a-descriptions :column="1" bordered>
            <a-descriptions-item label="计价版本">
              {{ pricingVersion }}
            </a-descriptions-item>
            <a-descriptions-item v-if="isV5Task" label="计价规则">
              A 级 100 积分 / B 级 200 积分 / C 级 300 积分
            </a-descriptions-item>
            <a-descriptions-item v-if="isV5Task" label="分配规则">
              随机精确组成目标积分，不设 A / B / C 固定比例
            </a-descriptions-item>
            <a-descriptions-item v-if="isV5Task" label="结算周期">
              {{ settlementCycleText }}
            </a-descriptions-item>
            <a-descriptions-item v-else label="单条积分">
              {{ formatPoints(detail.unit_reward_cent) }}
            </a-descriptions-item>
            <a-descriptions-item label="目标积分">
              {{ formatPointValue(taskTargetPoints) }}
            </a-descriptions-item>
            <a-descriptions-item v-if="isV5Task" label="等级题数">
              <div class="level-counts">
                <a-tag color="green">A {{ levelCount('A') }}</a-tag>
                <a-tag color="orange">B {{ levelCount('B') }}</a-tag>
                <a-tag color="red">C {{ levelCount('C') }}</a-tag>
              </div>
            </a-descriptions-item>
            <a-descriptions-item label="任务总积分">
              <strong class="money-text">
                {{ formatPoints(detail.total_reward_cent) }}
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

        <section v-if="isV5Task || taskItems.length" class="detail-section">
          <h3>已匹配题目（{{ formatNumber(taskItems.length) }}）</h3>
          <a-table
            v-if="taskItems.length"
            :data="taskItems"
            :pagination="{ pageSize: 10 }"
            :bordered="{ wrapper: true, cell: false }"
            :scroll="{ x: 1340 }"
            row-key="_rowKey"
          >
            <template #columns>
              <a-table-column title="药品图片" data-index="drug_image_url" :width="88">
                <template #cell="{ record }">
                  <div class="drug-image-cell">
                    <a-image
                      v-if="record.drug_image_url"
                      :src="record.drug_image_url"
                      :alt="`${record.drug_name || '药品'}图片`"
                      width="56"
                      height="56"
                      fit="cover"
                    >
                      <template #error><span>图片不可用</span></template>
                    </a-image>
                    <span v-else>暂无图片</span>
                  </div>
                </template>
              </a-table-column>
              <a-table-column title="药品名称" data-index="drug_name" :width="150">
                <template #cell="{ record }">
                  <span class="table-ellipsis" :title="record.drug_name">
                    {{ record.drug_name || '—' }}
                  </span>
                </template>
              </a-table-column>
              <a-table-column title="规格" data-index="drug_specification" :width="150">
                <template #cell="{ record }">
                  <span class="table-ellipsis" :title="record.drug_specification">
                    {{ record.drug_specification || '—' }}
                  </span>
                </template>
              </a-table-column>
              <a-table-column title="生产厂家" data-index="drug_manufacturer" :width="180">
                <template #cell="{ record }">
                  <span class="table-ellipsis" :title="record.drug_manufacturer">
                    {{ record.drug_manufacturer || '—' }}
                  </span>
                </template>
              </a-table-column>
              <a-table-column title="审核问题" data-index="question_text" :width="300">
                <template #cell="{ record }">
                  <a-tooltip :content="record.question_text" position="top">
                    <span class="question-summary">{{ record.question_text }}</span>
                  </a-tooltip>
                </template>
              </a-table-column>
              <a-table-column title="任务档位" data-index="final_level" :width="100" align="center">
                <template #cell="{ record }">
                  <a-tag :color="levelColor(record.final_level)">
                    {{ record.final_level || '—' }}
                  </a-tag>
                </template>
              </a-table-column>
              <a-table-column title="任务积分" data-index="unit_reward_cent" :width="110" align="right">
                <template #cell="{ record }">
                  {{ formatPoints(record.unit_reward_cent) }}
                </template>
              </a-table-column>
              <a-table-column title="题号" data-index="question_no" :width="130" />
              <a-table-column title="问题类型" data-index="type_name" :width="170" />
            </template>
          </a-table>
          <a-empty v-else description="暂未读取到已匹配题目" />
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
const formatPoints = (value) => `${formatNumber(Number(value || 0) / 100)} 积分`
const formatPointValue = (value) => `${formatNumber(value)} 积分`
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

const pricingVersion = computed(
  () => detail.value.pricing_version || '历史固定计价'
)

const settlementCycleText = computed(() =>
  detail.value.settlement_cycle === 'monthly_next_month'
    ? '按月统计，次月结算'
    : detail.value.settlement_cycle || '—'
)

const taskLevelSummary = computed(
  () =>
    detail.value.level_summary ||
    detail.value.pricing_summary?.level_summary ||
    { A: 0, B: 0, C: 0 }
)

const isV5Task = computed(
  () =>
    String(detail.value.pricing_version || '')
      .toUpperCase()
      .startsWith('V5') || Boolean(detail.value.level_summary)
)

const taskTargetPoints = computed(() => {
  if (detail.value.target_points != null) {
    return Number(detail.value.target_points || 0)
  }
  return Number(detail.value.total_reward_cent || 0) / 100
})

const levelCount = (level) =>
  formatNumber(
    taskLevelSummary.value?.[level] ??
      taskLevelSummary.value?.[level.toLowerCase()] ??
      taskLevelSummary.value?.[`${level.toLowerCase()}_count`] ??
      0
  )

const levelColor = (level) => {
  if (level === 'A') return 'green'
  if (level === 'B') return 'orange'
  if (level === 'C') return 'red'
  return 'gray'
}

const taskItems = computed(() => {
  const rows = Array.isArray(detail.value.task_items)
    ? detail.value.task_items
    : []

  return rows.map((item, index) => {
    const snapshot =
      item.question_snapshot || item.snapshot || item.question || {}
    const snapshotIsObject =
      snapshot && typeof snapshot === 'object' ? snapshot : {}

    return {
      _rowKey: item.id || item.question_id || `${index + 1}`,
      drug_image_url:
        item.drug_image_url ||
        item.drug_image ||
        item.image_url ||
        snapshotIsObject.drug_image_url ||
        snapshotIsObject.drug_image ||
        snapshotIsObject.image_url ||
        '',
      drug_name:
        item.drug_name || snapshotIsObject.drug_name || '—',
      drug_specification:
        item.drug_specification ||
        item.specification ||
        snapshotIsObject.drug_specification ||
        snapshotIsObject.specification ||
        '—',
      drug_manufacturer:
        item.drug_manufacturer ||
        snapshotIsObject.drug_manufacturer ||
        '—',
      question_no:
        item.question_no || snapshotIsObject.question_no || `第 ${index + 1} 题`,
      type_name:
        item.type_name ||
        item.question_type_name ||
        snapshotIsObject.type_name ||
        snapshotIsObject.question_type_name ||
        '—',
      final_level:
        item.final_level ||
        item.level ||
        snapshotIsObject.final_level ||
        snapshotIsObject.level ||
        '',
      unit_reward_cent:
        item.unit_reward_cent ??
        snapshotIsObject.unit_reward_cent ??
        snapshotIsObject.price_cent ??
        0,
      question_text:
        item.question_text ||
        item.question_summary ||
        snapshotIsObject.question_text ||
        snapshotIsObject.question_summary ||
        snapshotIsObject.question ||
        snapshotIsObject.content ||
        (typeof item.question === 'string' ? item.question : '') ||
        '—'
    }
  })
})

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

.level-counts {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.question-summary {
  display: block;
  overflow: hidden;
  color: var(--color-text-2);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.drug-image-cell {
  display: flex;
  width: 56px;
  height: 56px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  color: var(--color-text-3);
  font-size: 12px;
  line-height: 18px;
  text-align: center;
  background: var(--color-fill-1);
  border: 1px solid var(--color-border-1);
  border-radius: var(--border-radius-medium);
}

.table-ellipsis {
  display: block;
  overflow: hidden;
  color: var(--color-text-1);
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
