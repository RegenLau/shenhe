<template>
  <div class="certification-page">
    <header class="page-header">
      <div>
        <h1>医生认证</h1>
        <p>查看医生提交的执业认证资料并完成人工复审</p>
      </div>
    </header>

    <a-alert type="info" show-icon>
      认证结果用于标识医生资质状态，不影响医生查看和执行已经分配的审核项目。
    </a-alert>

    <a-alert v-if="tableError" type="error" show-icon>
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
      class="certification-table"
      @reset-search="resetSearchForm"
    >
      <template #tableSearch>
        <a-col :xs="24" :sm="8">
          <a-form-item field="keyword" label="关键词">
            <a-input
              v-model="searchForm.keyword"
              placeholder="姓名、手机号或医院"
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

      <template #doctor="{ record }">
        <div class="doctor-cell">
          <strong :title="record.name">{{ record.name || '—' }}</strong>
          <span>{{ maskPhone(record.phone) }}</span>
        </div>
      </template>

      <template #hospital="{ record }">
        <span class="ellipsis-text" :title="practiceValue(record.hospital)">
          {{ practiceValue(record.hospital) }}
        </span>
      </template>

      <template #department_title="{ record }">
        <span class="ellipsis-text" :title="practiceSubtitle(record)">
          {{ practiceSubtitle(record) }}
        </span>
      </template>

      <template #certificate_type="{ record }">
        <span class="ellipsis-text" :title="record.certificate_type || '—'">
          {{ record.certificate_type || '—' }}
        </span>
      </template>

      <template #submit_time="{ record }">
        {{ record.certification_submit_time || '—' }}
      </template>
    </sa-table>

    <certification-detail ref="detailRef" @success="refresh" />
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import certificationApi from '@/api/product/doctor-certification'
import CertificationDetail from './view.vue'

const crudRef = ref()
const detailRef = ref()
const tableError = ref('')
const searchForm = ref({
  keyword: '',
  account_status: '',
  certification_status: ''
})

const maskPhone = (value) =>
  String(value || '').replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2') || '—'

const practiceValue = (value) => {
  return value && value !== '待补充' ? value : '待补充'
}

const practiceSubtitle = (record) => {
  const values = [record.department, record.title].filter(
    (value) => value && value !== '待补充'
  )
  return values.join(' · ') || '科室及职称待补充'
}

const loadList = async (params) => {
  try {
    const response = await certificationApi.getPageList(params)
    if (response.code === 200) {
      tableError.value = ''
      return response
    }
    tableError.value = response.message || '医生认证列表加载失败，请重新加载'
  } catch {
    tableError.value = '医生认证列表加载失败，请检查网络后重试'
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
  { title: '医生', dataIndex: 'doctor', width: 150, fixed: 'left' },
  { title: '医院名称', dataIndex: 'hospital', width: 220 },
  { title: '科室 & 职称', dataIndex: 'department_title', width: 160 },
  { title: '证件类型', dataIndex: 'certificate_type', width: 140 },
  {
    title: '账号状态',
    dataIndex: 'account_status',
    type: 'dict',
    dict: 'doctor_account_status',
    width: 100,
    align: 'center'
  },
  {
    title: '认证状态',
    dataIndex: 'certification_status',
    type: 'dict',
    dict: 'doctor_certification_status',
    width: 100,
    align: 'center'
  },
  { title: '提交时间', dataIndex: 'submit_time', width: 180 }
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
.certification-page {
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

.certification-table {
  min-width: 0;
}

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

.ellipsis-text {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 575px) {
  .page-header {
    padding: 16px;
  }

  .certification-table {
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