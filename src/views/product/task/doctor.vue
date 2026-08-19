<template>
  <div class="doctor-detail-page">
    <header class="page-header">
      <div class="header-main">
        <a-button class="back-button" @click="goBack">
          <template #icon><icon-left /></template>
          返回批次详情
        </a-button>
        <div>
          <h1>{{ doctor.doctor_name || '医生详情' }}</h1>
          <p>查看该医生在本批次中分配的任务和审核情况</p>
        </div>
      </div>
    </header>

    <a-result
      v-if="!loading && errorMessage"
      status="error"
      title="医生详情加载失败"
      :subtitle="errorMessage"
    >
      <template #extra>
        <a-button type="primary" @click="loadDetail">重新加载</a-button>
      </template>
    </a-result>

    <a-spin v-else :loading="loading" class="doctor-content">
      <template v-if="doctor.doctor_name">
        <a-alert type="info" show-icon class="doctor-tip">
          审核情况按已完成题目统计；“已审核”包含通过和未通过的审核结果。
        </a-alert>

        <a-row :gutter="[16, 16]" class="summary-grid">
          <a-col :xs="12" :sm="6">
            <a-card :bordered="false">
              <a-statistic title="任务数" :value="summary.task_count" suffix="个" />
            </a-card>
          </a-col>
          <a-col :xs="12" :sm="6">
            <a-card :bordered="false">
              <a-statistic title="分配题数" :value="summary.item_count" suffix="题" />
            </a-card>
          </a-col>
          <a-col :xs="12" :sm="6">
            <a-card :bordered="false">
              <a-statistic title="已完成题数" :value="summary.completed_count" suffix="题" />
            </a-card>
          </a-col>
          <a-col :xs="12" :sm="6">
            <a-card :bordered="false">
              <a-statistic title="已审核题数" :value="summary.reviewed_count" suffix="题" />
            </a-card>
          </a-col>
        </a-row>

        <a-card title="医生信息" :bordered="false" class="detail-card">
          <a-descriptions :column="2" bordered>
            <a-descriptions-item label="医生">{{ doctor.doctor_name || '—' }}</a-descriptions-item>
            <a-descriptions-item label="手机号">{{ maskPhone(doctor.doctor_phone) }}</a-descriptions-item>
            <a-descriptions-item label="医院">{{ doctor.hospital || '—' }}</a-descriptions-item>
            <a-descriptions-item label="科室">{{ doctor.department || '—' }}</a-descriptions-item>
            <a-descriptions-item label="账号状态">
              <sa-dict :value="doctor.account_status" dict="doctor_account_status" render="span" />
            </a-descriptions-item>
            <a-descriptions-item label="项目归属">
              {{ doctor.identifier_name || '—' }} · {{ doctor.foundation_name || '—' }}
            </a-descriptions-item>
          </a-descriptions>
        </a-card>

        <a-card title="分配任务与审核情况" :bordered="false" class="detail-card">
          <a-table
            v-if="doctor.tasks?.length"
            :data="doctor.tasks"
            :pagination="{ pageSize: 10 }"
            :bordered="{ wrapper: true, cell: false }"
            :scroll="{ x: 1080 }"
            row-key="id"
          >
            <template #columns>
              <a-table-column title="任务编号" data-index="task_no" :width="170" fixed="left" />
              <a-table-column title="完成进度" data-index="progress_percent" :width="190">
                <template #cell="{ record }">
                  <div class="progress-cell">
                    <div>
                      {{ formatNumber(record.completed_count) }} /
                      {{ formatNumber(record.item_count) }} 题
                    </div>
                    <a-progress :percent="progressRate(record)" :show-text="false" size="small" />
                  </div>
                </template>
              </a-table-column>
              <a-table-column title="审核情况" data-index="review_count" :width="220">
                <template #cell="{ record }">
                  <div class="review-cell">
                    <span>
                      已审核 {{ formatNumber(record.review_count) }} /
                      {{ formatNumber(record.completed_count) }} 题
                    </span>
                    <span class="review-summary">
                      通过 {{ formatNumber(record.approved_count) }} ·
                      未通过 {{ formatNumber(record.rejected_count) }}
                    </span>
                  </div>
                </template>
              </a-table-column>
              <a-table-column title="任务状态" data-index="status" :width="105" align="center">
                <template #cell="{ record }">
                  <sa-dict :value="record.status" dict="task_status" />
                </template>
              </a-table-column>
              <a-table-column title="审核状态" data-index="review_status" :width="105" align="center">
                <template #cell="{ record }">
                  <a-tag v-if="record.review_status === 'approved'" color="green">已通过</a-tag>
                  <a-tag v-else-if="record.review_status === 'rejected'" color="red">有未通过</a-tag>
                  <a-tag v-else-if="record.review_status === 'in_progress'" color="orange">审核中</a-tag>
                  <a-tag v-else color="gray">待审核</a-tag>
                </template>
              </a-table-column>
              <a-table-column title="最近任务时间" data-index="create_time" :width="165" />
              <a-table-column title="操作" :width="100" fixed="right" align="center">
                <template #cell="{ record }">
                  <a-link @click="openTaskDetail(record)">查看任务</a-link>
                </template>
              </a-table-column>
            </template>
          </a-table>
          <a-empty v-else description="该医生暂无分配任务" />
        </a-card>
      </template>
    </a-spin>

    <task-view ref="taskDetailRef" />
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import taskApi from '@/api/product/task'
import TaskView from './view.vue'

const route = useRoute()
const router = useRouter()
const batchKey = String(route.params.batchKey || '')
const doctorKey = String(route.params.doctorKey || '')
const loading = ref(false)
const errorMessage = ref('')
const taskDetailRef = ref()
const doctor = reactive({ tasks: [] })
const summary = reactive({
  task_count: 0,
  item_count: 0,
  completed_count: 0,
  reviewed_count: 0
})

const formatNumber = (value) => Number(value || 0).toLocaleString('zh-CN')
const maskPhone = (value) =>
  String(value || '').replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2') || '—'
const progressRate = (record = {}) => {
  const itemCount = Number(record.item_count)
  if (Number.isFinite(itemCount) && itemCount > 0) {
    return Math.min(
      Math.max(Number(record.completed_count || 0) / itemCount, 0),
      1
    )
  }
  return Math.min(Math.max(Number(record.progress_percent || 0) / 100, 0), 1)
}

const loadDetail = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await taskApi.getBatchDoctorDetail(batchKey, doctorKey)
    if (response.code === 200) {
      Object.assign(doctor, response.data?.doctor || {}, {
        tasks: response.data?.tasks || []
      })
      Object.assign(summary, response.data?.summary || {})
      return
    }
    errorMessage.value = response.message || '请稍后重新加载'
  } catch {
    errorMessage.value = '网络连接异常，请检查后重试'
  } finally {
    loading.value = false
  }
}

const goBack = () => {
  router.push({
    name: 'productTaskBatchDetail',
    params: { batchKey }
  })
}

const openTaskDetail = (record) => {
  if (record?.id) taskDetailRef.value?.open(record.id)
}

onMounted(loadDetail)
</script>

<style scoped lang="less">
.doctor-detail-page {
  display: flex;
  min-width: 0;
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

.back-button {
  flex: 0 0 auto;
}

h1 {
  margin: 0;
  color: var(--color-text-1);
  font-size: 20px;
  font-weight: 600;
  line-height: 28px;
}

.page-header p {
  margin: 4px 0 0;
  color: var(--color-text-3);
  font-size: 14px;
  line-height: 20px;
}

.doctor-content {
  display: block;
  min-height: 360px;
}

.doctor-tip {
  margin-bottom: 16px;
}

.summary-grid {
  margin-bottom: 16px;
}

.summary-grid :deep(.arco-card) {
  height: 100%;
}

.detail-card {
  margin-bottom: 16px;
}

.progress-cell,
.review-cell {
  display: flex;
  min-width: 150px;
  flex-direction: column;
  gap: 4px;
  color: var(--color-text-1);
  font-size: 13px;
}

.progress-cell :deep(.arco-progress) {
  margin-top: 2px;
}

.review-summary {
  color: var(--color-text-3);
  font-size: 12px;
}

@media (max-width: 575px) {
  .page-header {
    padding: 16px;
  }

  .header-main {
    width: 100%;
  }
}
</style>
