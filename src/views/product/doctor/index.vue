<template>
  <div class="doctor-page">
    <header class="page-header">
      <div>
        <h1>医生管理</h1>
        <p>查看医生账号、执业认证和已分配任务</p>
      </div>
    </header>

    <a-alert type="info" show-icon class="account-tip">
      名单导入或手动分配任务时，系统会按手机号自动创建医生账号。待激活医生使用绑定手机号登录小程序后，即可看到已分配任务；任务全部完成后，对应金额计入累计计酬。
    </a-alert>

    <a-alert v-if="tableError" type="error" show-icon class="table-error">
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
      class="doctor-table"
      @reset-search="resetSearchForm"
    >
      <template #tableSearch>
        <a-col :xs="24" :sm="8">
          <a-form-item field="keyword" label="医生">
            <a-input
              v-model="searchForm.keyword"
              placeholder="姓名、手机号或执业机构"
              allow-clear
            />
          </a-form-item>
        </a-col>
        <a-col :xs="24" :sm="8">
          <a-form-item field="account_status" label="账号状态">
            <sa-select
              v-model="searchForm.account_status"
              dict="doctor_account_status"
              placeholder="全部状态"
              allow-clear
            />
          </a-form-item>
        </a-col>
        <a-col :xs="24" :sm="8">
          <a-form-item field="certification_status" label="认证状态">
            <sa-select
              v-model="searchForm.certification_status"
              dict="doctor_certification_status"
              placeholder="全部状态"
              allow-clear
            />
          </a-form-item>
        </a-col>
      </template>

      <template #name="{ record }">
        <div class="doctor-cell">
          <div class="doctor-name-line">
            <strong>{{ record.name }}</strong>
            <a-tag
              size="small"
              :color="record.account_status === 'active' ? 'green' : 'orange'"
            >
              {{ record.account_status === 'active' ? '已激活' : '待激活' }}
            </a-tag>
          </div>
          <span>{{ maskPhone(record.phone) }}</span>
        </div>
      </template>

      <template #practice="{ record }">
        <div class="practice-cell">
          <strong :title="record.hospital">
            {{ normalizePractice(record.hospital, '执业信息待补充') }}
          </strong>
          <span :title="practiceSubtitle(record)">
            {{ practiceSubtitle(record) }}
          </span>
        </div>
      </template>

      <template #task_progress="{ record }">
        <div v-if="record.assigned_item_count" class="progress-cell">
          <div>
            <span>{{ formatNumber(record.task_count) }} 个任务</span>
            <span class="progress-total">
              · {{ formatNumber(record.completed_item_count) }} /
              {{ formatNumber(record.assigned_item_count) }} 条
            </span>
          </div>
          <a-progress
            :percent="getProgress(record)"
            :show-text="false"
            size="small"
          />
        </div>
        <span v-else class="empty-text">暂无任务</span>
      </template>

      <template #accrued_reward_cent="{ record }">
        <span class="money-text">{{ formatCurrency(record.accrued_reward_cent) }}</span>
      </template>

    </sa-table>

    <doctor-detail ref="detailRef" />
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import doctorApi from '@/api/product/doctor'
import DoctorDetail from './view.vue'

const crudRef = ref()
const detailRef = ref()
const tableError = ref('')

const searchForm = ref({
  keyword: '',
  account_status: '',
  certification_status: ''
})

const formatNumber = (value) => Number(value || 0).toLocaleString('zh-CN')
const formatCurrency = (value) => `¥${formatNumber(Number(value || 0) / 100)}`
const maskPhone = (value) =>
  String(value || '').replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2')

const normalizePractice = (value, fallback = '—') => {
  return value && value !== '待补充' ? value : fallback
}

const practiceSubtitle = (record) => {
  const values = [record.department, record.title].filter(
    (value) => value && value !== '待补充'
  )
  return values.join(' · ') || '医院、科室及职称待补充'
}

const getProgress = (record) => {
  if (!record.assigned_item_count) return 0
  return Math.min(
    Number(record.completed_item_count || 0) /
      Number(record.assigned_item_count),
    1
  )
}

const loadList = async (params) => {
  try {
    const response = await doctorApi.getPageList(params)
    if (response.code === 200) {
      tableError.value = ''
      return response
    }
    tableError.value = response.message || '医生列表加载失败，请重新加载'
  } catch {
    tableError.value = '医生列表加载失败，请检查网络后重试'
  }

  return {
    code: 200,
    message: 'fallback',
    data: { data: [], total: 0, current_page: 1, per_page: 10 }
  }
}

const options = reactive({
  api: loadList,
  pageLayout: 'normal',
  showSort: false,
  operationColumnWidth: 80,
  view: {
    show: true,
    text: '详情',
    func: (record) => detailRef.value?.open(record.id)
  }
})

const columns = reactive([
  { title: '医生', dataIndex: 'name', width: 150, fixed: 'left' },
  { title: '任务进度', dataIndex: 'task_progress', width: 210 },
  { title: '执业信息', dataIndex: 'practice', width: 210 },
  {
    title: '认证状态',
    dataIndex: 'certification_status',
    type: 'dict',
    dict: 'doctor_certification_status',
    width: 95,
    align: 'center'
  },
  {
    title: '累计计酬',
    dataIndex: 'accrued_reward_cent',
    width: 110,
    align: 'right'
  }
])

const refresh = () => crudRef.value?.refresh()
const resetSearchForm = () => {
  Object.assign(searchForm.value, {
    keyword: '',
    account_status: '',
    certification_status: ''
  })
}

onMounted(refresh)
</script>

<style scoped lang="less">
.doctor-page {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
}

.page-header {
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
    font-size: 14px;
    line-height: 20px;
  }
}

.account-tip,
.table-error {
  flex: 0 0 auto;
}

.doctor-table {
  min-width: 0;
}

.doctor-cell,
.practice-cell {
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

.doctor-name-line {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;

  strong {
    min-width: 0;
  }
}

.progress-cell {
  min-width: 170px;
  color: var(--color-text-1);
  font-size: 13px;

  :deep(.arco-progress) {
    margin-top: 6px;
  }
}

.progress-total,
.empty-text {
  color: var(--color-text-3);
}

.money-text {
  color: var(--color-text-1);
  font-weight: 500;
}

@media (max-width: 575px) {
  .page-header {
    padding: 16px;
  }

  .doctor-table {
    :deep(.arco-card-body > div:first-child > .arco-row) {
      flex-direction: column;
      gap: 12px;
    }

    :deep(.arco-card-body > div:first-child > .arco-row > .arco-col) {
      width: 100%;
      flex: 0 0 100% !important;
      text-align: left !important;
    }

    :deep(.arco-pagination-options),
    :deep(.arco-pagination-jumper) {
      display: none;
    }

    :deep(.arco-pagination) {
      max-width: 100%;
      overflow-x: auto;
    }
  }
}
</style>
