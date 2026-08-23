<template>
  <div class="batch-page">
    <header class="page-header">
      <div class="header-main">
        <a-button class="back-button" @click="goBack">
          <template #icon><icon-left /></template>
          返回项目管理
        </a-button>
        <div>
          <h1>{{ batch.display_title || '项目详情' }}</h1>
          <p>查看该项目下所有医生的审核完成进度</p>
        </div>
      </div>
      <a-button :loading="downloading" @click="downloadProgress">
        <template #icon><icon-download /></template>
        下载进度数据
      </a-button>
    </header>

    <a-result
      v-if="!loading && errorMessage"
      status="error"
      title="项目详情加载失败"
      :subtitle="errorMessage"
    >
      <template #extra>
        <a-button type="primary" @click="loadDetail">重新加载</a-button>
      </template>
    </a-result>

    <a-spin v-else :loading="loading" class="batch-content">
      <template v-if="batch.batch_no">
        <a-alert type="info" show-icon class="batch-tip">
          进度按医生汇总，下载文件包含该项目的基金会、项目归属、医生和审核进度信息。
        </a-alert>

        <a-row :gutter="[16, 16]" class="summary-grid">
          <a-col :xs="12" :sm="6">
            <a-card :bordered="false">
              <a-statistic title="医生数" :value="batch.doctor_count" suffix="位" />
            </a-card>
          </a-col>
          <a-col :xs="12" :sm="6">
            <a-card :bordered="false">
              <a-statistic title="项目数" :value="batch.task_count" suffix="个" />
            </a-card>
          </a-col>
          <a-col :xs="12" :sm="6">
            <a-card :bordered="false">
              <a-statistic title="已完成题数" :value="batch.completed_count" suffix="题" />
            </a-card>
          </a-col>
          <a-col :xs="12" :sm="6">
            <a-card :bordered="false">
              <a-statistic title="整体进度" :value="batch.progress_percent" suffix="%" />
            </a-card>
          </a-col>
        </a-row>

        <a-card title="医生进度" :bordered="false" class="detail-card">
          <a-table
            v-if="batch.doctors?.length"
            :data="batch.doctors"
            :pagination="{ pageSize: 10 }"
            :bordered="{ wrapper: true, cell: false }"
            :scroll="{ x: 1080 }"
            row-key="id"
          >
            <template #columns>
              <a-table-column title="医生" data-index="doctor_name" :width="150" fixed="left">
                <template #cell="{ record }">
                  <div class="doctor-cell">
                    <strong>{{ record.doctor_name || '—' }}</strong>
                    <span>{{ maskPhone(record.doctor_phone) }}</span>
                  </div>
                </template>
              </a-table-column>
              <a-table-column title="执业信息" data-index="hospital" :width="220">
                <template #cell="{ record }">
                  <div class="practice-cell">
                    <span>{{ record.hospital || '—' }}</span>
                    <span>{{ record.department || '科室待补充' }}</span>
                  </div>
                </template>
              </a-table-column>
              <a-table-column title="项目数" data-index="task_count" :width="90" align="right" />
              <a-table-column title="完成进度" data-index="progress_percent" :width="190">
                <template #cell="{ record }">
                  <div class="progress-cell">
                    <div>
                      {{ formatNumber(record.completed_count) }} / {{ formatNumber(record.item_count) }} 题
                    </div>
                    <a-progress :percent="progressRate(record)" :show-text="false" size="small" />
                  </div>
                </template>
              </a-table-column>
              <a-table-column title="项目状态" data-index="status" :width="105" align="center">
                <template #cell="{ record }">
                  <sa-dict :value="record.status" dict="task_status" />
                </template>
              </a-table-column>
              <a-table-column title="账号状态" data-index="account_status" :width="105" align="center">
                <template #cell="{ record }">
                  <sa-dict :value="record.account_status" dict="doctor_account_status" />
                </template>
              </a-table-column>
              <a-table-column title="项目积分" data-index="total_reward_cent" :width="110" align="right">
                <template #cell="{ record }">{{ formatPoints(record.total_reward_cent) }}</template>
              </a-table-column>
              <a-table-column title="最近项目时间" data-index="create_time" :width="165" />
              <a-table-column title="操作" :width="80" fixed="right" align="center">
                <template #cell="{ record }">
                  <a-link @click="openTask(record)">查看项目</a-link>
                </template>
              </a-table-column>
            </template>
          </a-table>
          <a-empty v-else description="该项目暂无医生进度数据" />
        </a-card>
      </template>
    </a-spin>

    <task-view ref="taskDetailRef" />
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Message } from '@arco-design/web-vue'
import tool from '@/utils/tool'
import taskApi from '@/api/product/task'
import TaskView from './view.vue'

const route = useRoute()
const router = useRouter()
const batchKey = String(route.params.batchKey || '')
const loading = ref(false)
const downloading = ref(false)
const errorMessage = ref('')
const taskDetailRef = ref()
const batch = reactive({ doctors: [] })

const formatNumber = (value) => Number(value || 0).toLocaleString('zh-CN')
const formatPoints = (value) => `${formatNumber(Number(value || 0) / 100)} 积分`
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
const maskPhone = (value) =>
  String(value || '').replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2') || '—'

const loadDetail = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await taskApi.getBatchDetail(batchKey)
    if (response.code === 200) {
      Object.assign(batch, response.data || { doctors: [] })
      return
    }
    errorMessage.value = response.message || '请稍后重新加载'
  } catch {
    errorMessage.value = '网络连接异常，请检查后重试'
  } finally {
    loading.value = false
  }
}

const downloadProgress = async () => {
  downloading.value = true
  try {
    const response = await taskApi.downloadBatchProgress(batchKey)
    if (response?.status !== 200) {
      Message.error('进度数据下载失败，请稍后重试')
      return
    }
    tool.download(response)
    Message.success('项目进度数据已开始下载')
  } catch {
    Message.error('进度数据下载失败，请检查网络后重试')
  } finally {
    downloading.value = false
  }
}

const goBack = () => router.push({ name: 'productTask' })
const openTask = (record) => {
  const taskId = record.task_ids?.[0]
  if (!taskId) {
    Message.error('未找到该医生对应的项目，请重新加载后再试')
    return
  }
  taskDetailRef.value?.open(taskId)
}

onMounted(loadDetail)
</script>

<style scoped lang="less">
.batch-page {
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

.batch-content {
  display: block;
  min-height: 360px;
}

.batch-tip {
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

.doctor-cell,
.practice-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.doctor-cell strong,
.doctor-cell span,
.practice-cell span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doctor-cell span,
.practice-cell span:last-child {
  color: var(--color-text-3);
  font-size: 12px;
}

.progress-cell {
  min-width: 150px;
  color: var(--color-text-1);
  font-size: 13px;
}

.progress-cell :deep(.arco-progress) {
  margin-top: 6px;
}

@media (max-width: 575px) {
  .page-header {
    flex-direction: column;
    padding: 16px;
  }

  .header-main {
    width: 100%;
  }
}
</style>
