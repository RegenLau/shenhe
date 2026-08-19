<template>
  <div class="workbench-page">
    <header class="page-header">
      <div>
        <h1>工作台</h1>
        <p>查看试点审核任务、医生账号与积分结算进度</p>
      </div>
      <div class="page-actions">
        <span v-if="overview.updated_at" class="updated-at">
          数据更新于 {{ overview.updated_at }}
        </span>
        <a-button :loading="loading" @click="reloadAll">
          <template #icon><icon-refresh /></template>
          刷新
        </a-button>
      </div>
    </header>

    <a-result v-if="!loading && errorMessage" status="error" title="工作台数据加载失败">
      <template #subtitle>{{ errorMessage }}</template>
      <template #extra>
        <a-button type="primary" @click="reloadAll">重新加载</a-button>
      </template>
    </a-result>

    <a-empty
      v-else-if="!loading && !hasBusinessData"
      description="暂无业务数据，任务创建后将在这里展示进度"
      class="empty-state"
    />

    <a-spin v-else :loading="loading" class="workbench-content">
      <a-row :gutter="[{ xs: 16, sm: 24 }, { xs: 16, sm: 24 }]" align="stretch">
        <a-col v-for="metric in metrics" :key="metric.key" :xs="24" :sm="12" :xl="6">
          <a-card
            :bordered="false"
            class="metric-card metric-card--clickable"
            role="button"
            tabindex="0"
            @click="goTo(metric.route)"
            @keydown.enter="goTo(metric.route)"
          >
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
                  <template v-if="metric.suffix" #suffix>
                    <span class="metric-unit">{{ metric.suffix }}</span>
                  </template>
                </a-statistic>
                <div class="metric-chips">
                  <span
                    v-for="chip in metric.chips"
                    :key="chip.label"
                    class="metric-chip"
                  >
                    {{ chip.label }} {{ formatNumber(chip.value) }}
                  </span>
                </div>
              </div>
              <span class="metric-arrow">›</span>
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

            <div class="review-heading">
              <span>审核结果分布</span>
              <span class="review-rate">通过率 {{ reviewApprovalPercent }}%</span>
            </div>
            <div
              class="review-bar"
              :class="{ 'review-bar--empty': !overview.reviews.total }"
              role="img"
              aria-label="审核结果分布"
            >
              <i
                class="review-bar__approved"
                :style="{ width: `${reviewApprovalPercent}%` }"
              ></i>
            </div>
            <div class="review-summary">
              <div>
                <span class="review-dot review-dot--approved"></span>
                <span>审核通过</span>
                <strong>{{ formatNumber(overview.reviews.approved) }}</strong>
              </div>
              <div>
                <span class="review-dot review-dot--rejected"></span>
                <span>审核不通过</span>
                <strong>{{ formatNumber(overview.reviews.rejected) }}</strong>
              </div>
            </div>
          </a-card>
        </a-col>

        <a-col :xs="24" :xl="9">
          <a-card :bordered="false" class="section-card todo-card" title="待处理事项">
            <template #extra>
              <a-tag v-if="overview.todos.length" color="orange">
                {{ overview.todos.length }} 项
              </a-tag>
            </template>

            <a-list v-if="overview.todos.length" :bordered="false" :split="true">
              <a-list-item v-for="todo in overview.todos" :key="todo.id">
                <div
                  class="todo-item todo-item--clickable"
                  role="button"
                  tabindex="0"
                  @click="goTo(todoRoute(todo))"
                  @keydown.enter="goTo(todoRoute(todo))"
                >
                  <span class="todo-dot" :class="`todo-dot--${todo.level}`"></span>
                  <div class="todo-copy">
                    <div class="todo-title">
                      <span class="todo-title-text">
                        {{ todo.title }}
                        <a-tag size="small" :color="todoLevelMeta(todo).color">
                          {{ todoLevelMeta(todo).label }}
                        </a-tag>
                      </span>
                      <strong>{{ formatNumber(todo.count) }}</strong>
                    </div>
                    <p>{{ todo.description }}</p>
                  </div>
                  <span class="todo-arrow">›</span>
                </div>
              </a-list-item>
            </a-list>

            <a-empty v-else description="当前没有待处理事项" />
          </a-card>
        </a-col>

        <a-col :xs="24" :xl="15">
          <a-card :bordered="false" class="section-card" title="最近任务单">
            <template #extra>
              <a-link @click="goTo('/product/task')">查看全部</a-link>
            </template>

            <a-alert v-if="recentTasksError" type="error" show-icon>
              {{ recentTasksError }}
              <template #action>
                <a-button size="small" @click="loadRecentTasks">重新加载</a-button>
              </template>
            </a-alert>

            <a-spin v-else :loading="recentTasksLoading" class="recent-loading">
              <a-empty
                v-if="!recentTasksLoading && !recentTasks.length"
                description="暂无任务单，创建或导入名单后将在这里显示"
              />
              <a-table
                v-else
                :columns="recentTaskColumns"
                :data="recentTasks"
                :pagination="false"
                :scroll="{ x: 640 }"
                row-key="id"
                size="small"
              >
                <template #display_title="{ record }">
                  <div class="task-cell">
                    <strong :title="record.display_title">
                      {{ record.display_title || record.task_no }}
                    </strong>
                    <span>{{ record.doctor_name }} · {{ maskPhone(record.doctor_phone) }}</span>
                  </div>
                </template>
                <template #progress="{ record }">
                  {{ formatNumber(record.completed_count) }} /
                  {{ formatNumber(record.item_count) }} 条
                </template>
                <template #status="{ record }">
                  <sa-dict :value="record.status" dict="task_status" />
                </template>
              </a-table>
            </a-spin>
          </a-card>
        </a-col>

        <a-col :xs="24" :xl="9">
          <a-card :bordered="false" class="section-card" title="积分结算">
            <template #extra>
              <a-link @click="goTo('/product/withdrawal')">结算管理</a-link>
            </template>

            <ul class="settlement-list">
              <li>
                <span>累计积分</span>
                <strong>{{ formatPoints(overview.settlement.accrued_amount_cent) }}</strong>
              </li>
              <li>
                <span>可提现</span>
                <strong class="settlement-highlight">
                  {{ formatPoints(overview.settlement.withdrawable_amount_cent) }}
                </strong>
              </li>
              <li>
                <span>待导出</span>
                <strong>{{ formatPoints(overview.settlement.pending_withdrawal_amount_cent) }}</strong>
              </li>
              <li>
                <span>已导出待结算</span>
                <strong>{{ formatPoints(overview.settlement.exported_amount_cent) }}</strong>
              </li>
              <li>
                <span>已结算</span>
                <strong>{{ formatPoints(overview.settlement.settled_amount_cent) }}</strong>
              </li>
            </ul>
            <p class="settlement-note">
              1 积分 = 1 元；结算批次导出后由基金会人工结算，结果通过批次名单导入回写。
            </p>
          </a-card>
        </a-col>
      </a-row>
    </a-spin>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import workbenchApi from '@/api/product/workbench'
import taskApi from '@/api/product/task'

const router = useRouter()

const loading = ref(true)
const errorMessage = ref('')
const recentTasks = ref([])
const recentTasksLoading = ref(true)
const recentTasksError = ref('')

const overview = reactive({
  scope: '',
  updated_at: '',
  doctors: {
    total: 0,
    active: 0,
    pending_activation: 0,
    disabled: 0
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
    exported_amount_cent: 0,
    settled_amount_cent: 0
  },
  todos: []
})

const recentTaskColumns = [
  { title: '任务', dataIndex: 'display_title', slotName: 'display_title', width: 260 },
  { title: '进度', dataIndex: 'progress', slotName: 'progress', width: 110 },
  { title: '状态', dataIndex: 'status', slotName: 'status', width: 90, align: 'center' },
  { title: '创建时间', dataIndex: 'create_time', width: 160 }
]

const formatNumber = (value) => Number(value || 0).toLocaleString('zh-CN')
const centToYuan = (value) => Number(value || 0) / 100
const formatPoints = (value) => `${formatNumber(centToYuan(value))} 积分`
const maskPhone = (value) =>
  String(value || '').replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2') || '—'

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
    route: '/product/doctor',
    chips: [
      { label: '已激活', value: overview.doctors.active },
      { label: '待激活', value: overview.doctors.pending_activation },
      { label: '已禁用', value: overview.doctors.disabled }
    ]
  },
  {
    key: 'tasks',
    title: '审核任务',
    value: overview.tasks.total,
    suffix: '条',
    icon: 'icon-file',
    tone: 'warning',
    route: '/product/task',
    chips: [
      { label: '进行中', value: overview.tasks.in_progress },
      { label: '待开始', value: overview.tasks.pending }
    ]
  },
  {
    key: 'reviews',
    title: '已完成审核',
    value: overview.reviews.total,
    suffix: '条',
    icon: 'icon-check-circle',
    tone: 'success',
    route: '/product/review',
    chips: [
      { label: '通过', value: overview.reviews.approved },
      { label: '不通过', value: overview.reviews.rejected }
    ]
  },
  {
    key: 'settlement',
    title: '累计积分',
    value: centToYuan(overview.settlement.accrued_amount_cent),
    suffix: '积分',
    icon: 'icon-gift',
    tone: 'finance',
    route: '/product/withdrawal',
    chips: [
      {
        label: '可提现',
        value: centToYuan(overview.settlement.withdrawable_amount_cent)
      }
    ]
  }
])

const todoLevelMeta = (todo) => {
  const meta = {
    urgent: { label: '紧急', color: 'red' },
    warning: { label: '待处理', color: 'orange' },
    info: { label: '提示', color: 'arcoblue' }
  }
  return meta[todo.level] || meta.info
}

const todoRoute = (todo) => {
  if (todo.id === 'certification_pending') return '/product/doctor-certification'
  return '/product/withdrawal'
}

const goTo = (path) => {
  if (!path) return
  router.push(path)
}

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

const loadRecentTasks = async () => {
  recentTasksLoading.value = true
  recentTasksError.value = ''

  try {
    const response = await taskApi.getPageList({ page: 1, limit: 5 })
    if (response.code === 200) {
      recentTasks.value = response.data.data || []
      return
    }
    recentTasksError.value = response.message || '最近任务加载失败，请重新加载'
  } catch {
    recentTasksError.value = '最近任务加载失败，请检查网络后重试'
  } finally {
    recentTasksLoading.value = false
  }
}

const reloadAll = () => {
  loadOverview()
  loadRecentTasks()
}

onMounted(reloadAll)
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
  padding: 48px 24px;
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

.metric-card--clickable {
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;

  &:hover {
    border-color: rgb(var(--primary-4));

    .metric-arrow {
      color: rgb(var(--primary-6));
      transform: translateX(2px);
    }
  }
}

.metric-card :deep(.arco-card-body) {
  display: flex;
  height: 100%;
  align-items: center;
  padding: 16px;
}

.metric-content {
  display: flex;
  width: 100%;
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
  flex: 1;
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

.metric-chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.metric-chip {
  padding: 0 8px;
  color: var(--color-text-3);
  font-size: 12px;
  line-height: 20px;
  white-space: nowrap;
  background: var(--color-fill-1);
  border-radius: 99px;
}

.metric-arrow {
  flex: 0 0 auto;
  color: var(--color-text-4);
  font-size: 18px;
  transition: color 0.15s, transform 0.15s;
}

.section-card :deep(.arco-card-header) {
  height: auto;
  min-height: 56px;
  padding: 16px 24px;
}

.section-card :deep(.arco-card-body) {
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: 24px;
}

.section-card {
  display: flex;
  flex-direction: column;
}

.todo-card :deep(.arco-list-wrapper),
.recent-loading,
.settlement-list {
  flex: 1;
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
    margin-top: 4px;
    color: var(--color-text-1);
    font-size: 20px;
    line-height: 28px;
  }
}

.status-dot,
.todo-dot,
.review-dot {
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

.review-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--color-text-2);
  font-size: 14px;
}

.review-rate {
  color: var(--color-text-3);
  font-size: 12px;
}

.review-bar {
  height: 8px;
  margin-top: 12px;
  overflow: hidden;
  background: rgb(var(--red-3));
  border-radius: var(--border-radius-small);
}

.review-bar--empty {
  background: var(--color-fill-2);
}

.review-bar__approved {
  display: block;
  height: 100%;
  background: rgb(var(--green-6));
  border-radius: var(--border-radius-small) 0 0 var(--border-radius-small);
}

.review-summary {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
  margin-top: 12px;

  div {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  span:not(.review-dot) {
    color: var(--color-text-3);
    font-size: 12px;
  }

  strong {
    color: var(--color-text-1);
    font-size: 16px;
  }
}

.review-dot--approved {
  background: rgb(var(--green-6));
}

.review-dot--rejected {
  background: rgb(var(--red-6));
}

.todo-card :deep(.arco-list-wrapper) {
  border: none;
}

.todo-card :deep(.arco-list-item) {
  padding: 8px 0;
}

.todo-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  padding: 8px;
  border-radius: var(--border-radius-medium);
}

.todo-item--clickable {
  cursor: pointer;
  transition: background-color 0.15s;

  &:hover {
    background: var(--color-fill-1);

    .todo-arrow {
      color: rgb(var(--primary-6));
    }
  }
}

.todo-dot {
  margin-top: 8px;
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
  flex: 1;

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

  .todo-title-text {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  strong {
    color: var(--color-text-1);
    font-size: 16px;
  }
}

.todo-arrow {
  flex: 0 0 auto;
  align-self: center;
  color: var(--color-text-4);
  font-size: 16px;
}

.recent-loading {
  display: block;
  width: 100%;
  min-height: 160px;
}

.task-cell {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;

  strong {
    overflow: hidden;
    color: var(--color-text-1);
    font-size: 14px;
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    overflow: hidden;
    color: var(--color-text-3);
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.settlement-list {
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid var(--color-border-1);

    &:last-child {
      border-bottom: none;
    }

    span {
      color: var(--color-text-3);
      font-size: 12px;
    }

    strong {
      color: var(--color-text-1);
      font-size: 14px;
      font-weight: 500;
    }
  }
}

.settlement-highlight {
  color: rgb(var(--primary-6)) !important;
  font-size: 16px !important;
  font-weight: 600 !important;
}

.settlement-note {
  margin: auto 0 0;
  padding-top: 12px;
  color: var(--color-text-3);
  font-size: 12px;
  line-height: 20px;
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
}
</style>
