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
      使用审核题库模拟数据验证流程，不代表真实患者数据。
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
              placeholder="药品、规格、厂家、问题、医生或编号"
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
          <a-form-item field="issue_type" label="不通过类型">
            <sa-select
              v-model="searchForm.issue_type"
              dict="review_issue_type"
              placeholder="全部不通过类型"
              allow-clear
            />
          </a-form-item>
        </a-col>
      </template>

      <template #drug_image_url="{ record }">
        <div class="drug-image-cell">
          <a-image
            v-if="drugImageUrl(record)"
            :src="drugImageUrl(record)"
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

      <template #drug_name="{ record }">
        <div class="drug-text-cell">
          <strong :title="record.drug_name">{{ record.drug_name || '—' }}</strong>
          <span v-if="record.drug_type" :title="record.drug_type">
            {{ record.drug_type }}
          </span>
        </div>
      </template>

      <template #drug_specification="{ record }">
        <span class="specification-cell" :title="drugSpecification(record)">
          {{ drugSpecification(record) }}
        </span>
      </template>

      <template #drug_manufacturer="{ record }">
        <span class="specification-cell" :title="record.drug_manufacturer || '—'">
          {{ record.drug_manufacturer || '—' }}
        </span>
      </template>

      <template #question="{ record }">
        <div class="question-cell">
          <strong :title="record.question">{{ record.question || '—' }}</strong>
          <span>{{ record.question_no || '题目编号未记录' }}</span>
        </div>
      </template>

      <template #final_level="{ record }">
        <sa-dict
          v-if="['A', 'B', 'C'].includes(String(record.final_level).toUpperCase())"
          :value="String(record.final_level).toUpperCase()"
          dict="question_level"
        />
        <span v-else class="empty-text">—</span>
      </template>

      <template #unit_reward_cent="{ record }">
        <strong class="reward-cell">{{ formatReward(record.unit_reward_cent) }}</strong>
      </template>

      <template #type_info="{ record }">
        <div class="type-cell">
          <strong :title="record.type_name">{{ record.type_name || '题型未记录' }}</strong>
          <span :title="questionTypeSubtitle(record)">
            {{ questionTypeSubtitle(record) }}
          </span>
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
  return [maskPhone(record.doctor_phone), record.doctor_department || record.department]
    .filter(Boolean)
    .join(' · ') || '—'
}

const drugImageUrl = (record = {}) =>
  record.drug_image_url || record.drug_image || record.image_url || ''

const drugSpecification = (record = {}) =>
  record.drug_specification || record.specification || '—'

const questionTypeSubtitle = (record = {}) =>
  [record.disease_type, record.question_department].filter(Boolean).join(' · ') ||
  '未记录疾病分类或科室归属'

const formatReward = (value) => {
  const number = Number(value)
  if (value === undefined || value === null || !Number.isFinite(number)) return '—'
  return `${(number / 100).toLocaleString('zh-CN')} 积分 / 条`
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
  { title: '药品图片', dataIndex: 'drug_image_url', width: 88, fixed: 'left' },
  { title: '药品名称', dataIndex: 'drug_name', width: 160 },
  { title: '规格', dataIndex: 'drug_specification', width: 150 },
  { title: '生产厂家', dataIndex: 'drug_manufacturer', width: 190 },
  { title: '审核问题', dataIndex: 'question', width: 320 },
  { title: '任务档位', dataIndex: 'final_level', width: 105, align: 'center' },
  { title: '任务积分', dataIndex: 'unit_reward_cent', width: 120, align: 'right' },
  { title: '问题类型', dataIndex: 'type_info', width: 210 },
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
  { title: '不通过类型', dataIndex: 'issue_type', width: 140 },
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

.drug-text-cell,
.question-cell,
.type-cell,
.doctor-cell {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;

  strong,
  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    color: var(--color-text-1);
    font-size: 14px;
    font-weight: 500;
  }

  span {
    color: var(--color-text-3);
    font-size: 12px;
  }
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

  :deep(.arco-image) {
    display: block;
  }
}

.specification-cell {
  display: block;
  overflow: hidden;
  color: var(--color-text-2);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reward-cell {
  color: rgb(var(--primary-6));
  font-size: 14px;
  white-space: nowrap;
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
