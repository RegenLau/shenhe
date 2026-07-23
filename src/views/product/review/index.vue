<template>
  <div class="review-page">
    <header class="page-header">
      <div>
        <h1>审核记录</h1>
        <p>查看医生逐条提交的问答审核结果</p>
      </div>
    </header>

    <a-alert type="info" show-icon class="review-tip">
      审核记录来自医生已提交的逐条审核结果。当前 V1
      使用模拟问答内容验证流程，不代表真实患者数据。
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
      class="review-table"
      @reset-search="resetSearchForm"
    >
      <template #tableSearch>
        <a-col :xs="24" :sm="8">
          <a-form-item field="keyword" label="关键词">
            <a-input
              v-model="searchForm.keyword"
              placeholder="记录号、任务号、医生、手机号或问题"
              allow-clear
            />
          </a-form-item>
        </a-col>
        <a-col :xs="24" :sm="8">
          <a-form-item field="result" label="审核结论">
            <sa-select
              v-model="searchForm.result"
              dict="review_result"
              placeholder="全部结论"
              allow-clear
            />
          </a-form-item>
        </a-col>
        <a-col :xs="24" :sm="8">
          <a-form-item field="issue_type" label="问题类型">
            <sa-select
              v-model="searchForm.issue_type"
              dict="review_issue_type"
              placeholder="全部类型"
              allow-clear
            />
          </a-form-item>
        </a-col>
      </template>

      <template #question="{ record }">
        <div class="question-cell">
          <strong :title="record.question">{{ record.question || '—' }}</strong>
          <div class="question-meta">
            <span :title="record.drug_name">{{ record.drug_name || '药品待补充' }}</span>
            <span v-if="record.drug_type">· {{ record.drug_type }}</span>
            <span v-if="record.disease_type">· {{ record.disease_type }}</span>
          </div>
        </div>
      </template>

      <template #doctor_name="{ record }">
        <div class="doctor-cell">
          <strong>{{ record.doctor_name || '—' }}</strong>
          <span :title="doctorSubtitle(record)">{{ doctorSubtitle(record) }}</span>
        </div>
      </template>

      <template #task_no="{ record }">
        <span class="number-text">{{ record.task_no || '—' }}</span>
      </template>

      <template #issue_type="{ record }">
        <sa-dict
          v-if="record.issue_type"
          :value="record.issue_type"
          dict="review_issue_type"
          render="span"
        />
        <span v-else class="empty-text">—</span>
      </template>
    </sa-table>

    <review-detail ref="detailRef" />
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import reviewApi from '@/api/product/review'
import ReviewDetail from './view.vue'

const crudRef = ref()
const detailRef = ref()
const tableError = ref('')

const searchForm = ref({
  keyword: '',
  result: '',
  issue_type: ''
})

const maskPhone = (value) =>
  String(value || '').replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2')

const doctorSubtitle = (record) => {
  return [maskPhone(record.doctor_phone), record.department]
    .filter(Boolean)
    .join(' · ') || '—'
}

const loadList = async (params) => {
  try {
    const response = await reviewApi.getPageList(params)
    if (response.code === 200) {
      tableError.value = ''
      return response
    }
    tableError.value = response.message || '审核记录加载失败，请重新加载'
  } catch {
    tableError.value = '审核记录加载失败，请检查网络后重试'
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
  { title: '审核问题', dataIndex: 'question', width: 290, fixed: 'left' },
  { title: '医生', dataIndex: 'doctor_name', width: 170 },
  { title: '任务编号', dataIndex: 'task_no', width: 160 },
  {
    title: '审核结论',
    dataIndex: 'result',
    type: 'dict',
    dict: 'review_result',
    width: 95,
    align: 'center'
  },
  { title: '问题类型', dataIndex: 'issue_type', width: 140 },
  { title: '审核时间', dataIndex: 'review_time', width: 165 }
])

const refresh = () => crudRef.value?.refresh()
const resetSearchForm = () => {
  Object.assign(searchForm.value, {
    keyword: '',
    result: '',
    issue_type: ''
  })
}

onMounted(refresh)
</script>

<style scoped lang="less">
.review-page {
  display: flex;
  min-width: 0;
  max-width: 100%;
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

.review-tip,
.table-error {
  flex: 0 0 auto;
}

.review-table {
  min-width: 0;
  max-width: 100%;
}

.question-cell,
.doctor-cell {
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
}

.question-meta,
.doctor-cell span {
  overflow: hidden;
  color: var(--color-text-3);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.question-meta {
  display: flex;
  min-width: 0;
  gap: 4px;

  span {
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.number-text {
  color: var(--color-text-2);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
}

.empty-text {
  color: var(--color-text-3);
}

@media (max-width: 575px) {
  .page-header {
    padding: 16px;
  }

  .review-table {
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
