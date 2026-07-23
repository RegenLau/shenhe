<template>
  <div class="workbench-page">
    <header class="page-header">
      <div>
        <h1>工作台</h1>
        <p>查看试点审核任务、医生账号与结算进度</p>
      </div>
      <div class="page-actions">
        <span v-if="overview.updated_at" class="updated-at">
          数据更新于 {{ overview.updated_at }}
        </span>
        <a-button :loading="loading" @click="loadOverview">
          <template #icon><icon-refresh /></template>
          刷新
        </a-button>
      </div>
    </header>

    <a-result v-if="!loading && errorMessage" status="error" title="工作台数据加载失败">
      <template #subtitle>{{ errorMessage }}</template>
      <template #extra>
        <a-button type="primary" @click="loadOverview">重新加载</a-button>
      </template>
    </a-result>

    <a-empty
      v-else-if="!loading && !hasBusinessData"
      description="暂无业务数据，任务创建后将在这里展示进度"
      class="empty-state"
    />

    <a-spin v-else :loading="loading" class="workbench-content">
      <a-row :gutter="[24, 24]">
        <a-col v-for="metric in metrics" :key="metric.key" :xs="24" :sm="12" :xl="6">
          <a-card :bordered="false" class="metric-card">
            <div class="metric-content">
              <div class="metric-icon" :class="`metric-icon--${metric.tone}`">
                <sa-icon :icon="metric.icon" :size="24" />
              </div>
              <div class="metric-main">
                <a-statistic
                  :title="metric.title"
                  :value="metric.value"
                  :precision="0"
                  show-group-separator
                >
                  <template v-if="metric.prefix" #prefix>{{ metric.prefix }}</template>
                  <template v-if="metric.suffix" #suffix>
                    <span class="metric-unit">{{ metric.suffix }}</span>
                  </template>
                </a-statistic>
                <p class="metric-helper">{{ metric.helper }}</p>
              </div>
            </div>
          </a-card>
        </a-col>

        <a-col :xs="24" :xl="15">
          <a-card :bordered="false" class="section-card" title="任务进度">
            <template #extra>
              <span class="scope-label">{{ overview.scope || '累计' }}</span>
            </template>

            <div class="progress-heading">
              <div>
                <span class="progress-label">整体完成率</span>
                <strong>{{ taskCompletionPercent }}%</strong>
              </div>
              <span>已审核 {{ formatNumber(overview.reviews.total) }} / {{ formatNumber(overview.tasks.total) }} 条</span>
            </div>
            <a-progress :percent="taskCompletionRate" :show-text="false" />

            <div class="status-grid">
              <div class="status-cell">
                <span class="status-dot status-dot--pending"></span>
                <div>
                  <span>待开始</span>
                  <strong>{{ formatNumber(overview.tasks.pending) }}</strong>
                </div>
              </div>
              <div class="status-cell">
                <span class="status-dot status-dot--processing"></span>
                <div>
                  <span>进行中</span>
                  <strong>{{ formatNumber(overview.tasks.in_progress) }}</strong>
                </div>
              </div>
              <div class="status-cell">
                <span class="status-dot status-dot--completed"></span>
                <div>
                  <span>已完成</span>
                  <strong>{{ formatNumber(overview.tasks.completed) }}</strong>
                </div>
              </div>
            </div>

            <a-divider />

            <div class="review-summary">
              <div>
                <span>审核通过</span>
                <strong>{{ formatNumber(overview.reviews.approved) }}</strong>
              </div>
              <div>
                <span>审核不通过</span>
                <strong>{{ formatNumber(overview.reviews.rejected) }}</strong>
              </div>
              <div>
                <span>审核通过率</span>
                <strong>{{ reviewApprovalPercent }}%</strong>
              </div>
            </div>
          </a-card>
        </a-col>

        <a-col :xs="24" :xl="9">
          <a-card :bordered="false" class="section-card todo-card" title="待处理事项">
            <template #extra>
              <a-tag v-if="overview.todos.length" color="orangered">
                {{ overview.todos.length }} 项
              </a-tag>
            </template>

            <a-list v-if="overview.todos.length" :bordered="false" :split="true">
              <a-list-item v-for="todo in overview.todos" :key="todo.id">
                <div class="todo-item">
                  <span class="todo-dot" :class="`todo-dot--${todo.level}`"></span>
                  <div class="todo-copy">
                    <div class="todo-title">
                      <span>{{ todo.title }}</span>
                      <strong>{{ formatNumber(todo.count) }}</strong>
                    </div>
                    <p>{{ todo.description }}</p>
                  </div>
                </div>
              </a-list-item>
            </a-list>

            <a-empty v-else description="当前没有待处理事项" />
          </a-card>
        </a-col>
      </a-row>
    </a-spin>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import workbenchApi from '@/api/product/workbench'

const loading = ref(true)
const errorMessage = ref('')

const overview = reactive({
  scope: '',
  updated_at: '',
  doctors: {
    total: 0,
    active: 0,
    pending_activation: 0
  },
  tasks: {
    total: 0,
    pending: 0,
    in_progress: 0,
    completed: 0
  },
  reviews: {
    total: 0,
    approved: 0,
    rejected: 0
  },
  settlement: {
    accrued_amount_cent: 0,
    withdrawable_amount_cent: 0,
    pending_withdrawal_amount_cent: 0,
    pending_export_amount_cent: 0,
    exported_amount_cent: 0
  },
  todos: []
})

const formatNumber = (value) => Number(value || 0).toLocaleString('zh-CN')
const centToYuan = (value) => Number(value || 0) / 100
const formatCurrency = (value) => `¥${formatNumber(centToYuan(value))}`

const taskCompletionRate = computed(() => {
  if (!overview.tasks.total) return 0
  return Math.min(overview.reviews.total / overview.tasks.total, 1)
})

const taskCompletionPercent = computed(() => Math.round(taskCompletionRate.value * 100))

const reviewApprovalPercent = computed(() => {
  if (!overview.reviews.total) return 0
  return Math.round((overview.reviews.approved / overview.reviews.total) * 100)
})

const hasBusinessData = computed(() => {
  return overview.doctors.total > 0 || overview.tasks.total > 0 || overview.reviews.total > 0
})

const metrics = computed(() => [
  {
    key: 'doctors',
    title: '医生账号',
    value: overview.doctors.total,
    suffix: '人',
    icon: 'icon-user-group',
    tone: 'primary',
    helper: `已激活 ${formatNumber(overview.doctors.active)} · 待激活 ${formatNumber(overview.doctors.pending_activation)}`
  },
  {
    key: 'tasks',
    title: '审核任务',
    value: overview.tasks.total,
    suffix: '条',
    icon: 'icon-file',
    tone: 'warning',
    helper: `进行中 ${formatNumber(overview.tasks.in_progress)} · 待开始 ${formatNumber(overview.tasks.pending)}`
  },
  {
    key: 'reviews',
    title: '已完成审核',
    value: overview.reviews.total,
    suffix: '条',
    icon: 'icon-check-circle',
    tone: 'success',
    helper: `通过 ${formatNumber(overview.reviews.approved)} · 不通过 ${formatNumber(overview.reviews.rejected)}`
  },
  {
    key: 'settlement',
    title: '累计计酬',
    value: centToYuan(overview.settlement.accrued_amount_cent),
    prefix: '¥',
    icon: 'icon-gift',
    tone: 'finance',
    helper: `可提现 ${formatCurrency(overview.settlement.withdrawable_amount_cent)}`
  }
])

const loadOverview = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await workbenchApi.getOverview()
    if (!response || response.code !== 200 || !response.data) {
      throw new Error(response?.message || '服务暂时不可用，请稍后重试')
    }

    Object.assign(overview, response.data)
  } catch (error) {
    errorMessage.value = error?.message || '请检查网络连接后重新加载'
  } finally {
    loading.value = false
  }
}

onMounted(loadOverview)
</script>

<style scoped lang="less">
.workbench-page {
  min-width: 0;
  padding: 24px;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 24px;

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

.page-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.updated-at,
.scope-label {
  color: var(--color-text-3);
  font-size: 12px;
  line-height: 20px;
}

.workbench-content {
  display: block;
  width: 100%;
  min-height: 480px;
}

.empty-state {
  padding: 96px 24px;
  background: var(--color-bg-2);
  border-radius: var(--border-radius-medium);
}

.metric-card,
.section-card {
  height: 100%;
  background: var(--color-bg-2);
  border: 1px solid var(--color-border-1);
  border-radius: var(--border-radius-medium);
}

.metric-card :deep(.arco-card-body) {
  padding: 20px;
}

.metric-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.metric-icon {
  display: flex;
  flex: 0 0 48px;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: var(--border-radius-medium);
}

.metric-icon--primary {
  color: rgb(var(--primary-6));
  background: rgb(var(--primary-1));
}

.metric-icon--warning {
  color: rgb(var(--orange-6));
  background: rgb(var(--orange-1));
}

.metric-icon--success {
  color: rgb(var(--green-6));
  background: rgb(var(--green-1));
}

.metric-icon--finance {
  color: rgb(var(--purple-6));
  background: rgb(var(--purple-1));
}

.metric-main {
  min-width: 0;
}

.metric-main :deep(.arco-statistic-title) {
  margin-bottom: 4px;
  color: var(--color-text-2);
  font-size: 14px;
}

.metric-main :deep(.arco-statistic-value) {
  color: var(--color-text-1);
  font-size: 24px;
  font-weight: 600;
  line-height: 32px;
}

.metric-unit {
  margin-left: 4px;
  color: var(--color-text-3);
  font-size: 12px;
  font-weight: 400;
}

.metric-helper {
  overflow: hidden;
  margin: 4px 0 0;
  color: var(--color-text-3);
  font-size: 12px;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.section-card :deep(.arco-card-header) {
  height: auto;
  min-height: 56px;
  padding: 16px 20px;
}

.section-card :deep(.arco-card-body) {
  padding: 20px;
}

.progress-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
  color: var(--color-text-3);
  font-size: 12px;

  div {
    display: flex;
    align-items: baseline;
    gap: 12px;
  }

  strong {
    color: var(--color-text-1);
    font-size: 24px;
    line-height: 32px;
  }
}

.progress-label {
  color: var(--color-text-2);
  font-size: 14px;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 24px;
}

.status-cell {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 16px;
  background: var(--color-fill-1);
  border-radius: var(--border-radius-medium);

  div {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  span:not(.status-dot) {
    color: var(--color-text-3);
    font-size: 12px;
  }

  strong {
    margin-top: 2px;
    color: var(--color-text-1);
    font-size: 20px;
    line-height: 28px;
  }
}

.status-dot,
.todo-dot {
  display: inline-block;
  flex: 0 0 auto;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-dot--pending {
  background: rgb(var(--gray-5));
}

.status-dot--processing {
  background: rgb(var(--orange-6));
}

.status-dot--completed {
  background: rgb(var(--green-6));
}

.review-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;

  div {
    display: flex;
    flex-direction: column;
  }

  span {
    color: var(--color-text-3);
    font-size: 12px;
  }

  strong {
    margin-top: 4px;
    color: var(--color-text-1);
    font-size: 18px;
    line-height: 28px;
  }
}

.todo-card :deep(.arco-list-wrapper) {
  border: none;
}

.todo-card :deep(.arco-list-item) {
  padding: 14px 0;
}

.todo-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
}

.todo-dot {
  margin-top: 7px;
}

.todo-dot--urgent {
  background: rgb(var(--red-6));
}

.todo-dot--warning {
  background: rgb(var(--orange-6));
}

.todo-dot--info {
  background: rgb(var(--primary-6));
}

.todo-copy {
  min-width: 0;
  width: 100%;

  p {
    margin: 4px 0 0;
    color: var(--color-text-3);
    font-size: 12px;
    line-height: 20px;
  }
}

.todo-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  color: var(--color-text-1);
  font-size: 14px;

  strong {
    color: var(--color-text-1);
    font-size: 16px;
  }
}

@media (max-width: 575px) {
  .workbench-page {
    padding: 16px;
  }

  .page-header,
  .page-actions,
  .progress-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .page-header,
  .page-actions {
    gap: 12px;
  }

  .status-grid {
    grid-template-columns: 1fr;
  }

  .review-summary {
    gap: 8px;
  }
}
</style>
