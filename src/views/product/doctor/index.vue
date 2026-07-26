<template>
  <div class="doctor-page">
    <header class="page-header">
      <div>
        <h1>医生管理</h1>
        <p>查看医生账号、执业信息、认证状态与累计计酬</p>
      </div>
    </header>

    <a-alert type="info" show-icon class="account-tip">
      医生账号可在本页手动新增，或由名单导入按手机号自动创建。待激活医生使用绑定手机号登录小程序后，即可看到已分配任务；任务全部完成后，对应积分计入累计积分。
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

      <template #tableAfterButtons>
        <a-button type="primary" @click="editRef?.open()">
          <template #icon><icon-plus /></template>
          新增医生
        </a-button>
        <a-button :loading="exporting" @click="confirmExportPending">
          <template #icon><icon-download /></template>
          导出未激活名单
        </a-button>
      </template>

      <template #name="{ record }">
        <strong class="name-cell" :title="record.name">
          {{ record.name || '—' }}
        </strong>
      </template>

      <template #phone="{ record }">
        <span>{{ maskPhone(record.phone) }}</span>
      </template>

      <template #hospital="{ record }">
        <span class="ellipsis-text" :title="normalizePractice(record.hospital)">
          {{ normalizePractice(record.hospital) }}
        </span>
      </template>

      <template #department_title="{ record }">
        <span class="ellipsis-text" :title="practiceSubtitle(record)">
          {{ practiceSubtitle(record) }}
        </span>
      </template>

      <template #accrued_reward_cent="{ record }">
        <span class="money-text">{{ formatPoints(record.accrued_reward_cent) }}</span>
      </template>

    </sa-table>

    <doctor-detail ref="detailRef" @updated="refresh" />
    <doctor-edit ref="editRef" @success="refresh" />
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import tool from '@/utils/tool'
import doctorApi from '@/api/product/doctor'
import DoctorDetail from './view.vue'
import DoctorEdit from './edit.vue'

const crudRef = ref()
const detailRef = ref()
const editRef = ref()
const tableError = ref('')
const exporting = ref(false)

const searchForm = ref({
  keyword: '',
  account_status: '',
  certification_status: ''
})

const formatNumber = (value) => Number(value || 0).toLocaleString('zh-CN')
const formatPoints = (value) => `${formatNumber(Number(value || 0) / 100)} 积分`
const maskPhone = (value) =>
  String(value || '').replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2') || '—'

const normalizePractice = (value, fallback = '待补充') => {
  return value && value !== '待补充' ? value : fallback
}

const practiceSubtitle = (record) => {
  const values = [record.department, record.title].filter(
    (value) => value && value !== '待补充'
  )
  return values.join(' · ') || '科室及职称待补充'
}

const exportPendingActivation = async () => {
  exporting.value = true
  try {
    const response = await doctorApi.exportPendingActivation()
    if (response?.status !== 200) {
      Message.error('未激活名单导出失败，请稍后重试')
      return
    }

    tool.download(response)
    Message.success('未激活名单已导出，请交由药企代表跟进邀请医生注册')
  } catch {
    Message.error('未激活名单导出失败，请检查网络后重试')
  } finally {
    exporting.value = false
  }
}

const confirmExportPending = () => {
  Modal.confirm({
    title: '确认导出未激活名单',
    content:
      '导出文件包含医生姓名与完整手机号，仅限交付药企代表用于邀请医生注册小程序，请妥善保管。',
    width: 'min(420px, calc(100vw - 32px))',
    okText: '确认导出',
    onOk: exportPendingActivation
  })
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
  { title: '姓名', dataIndex: 'name', width: 110, fixed: 'left' },
  { title: '手机号', dataIndex: 'phone', width: 130 },
  { title: '医院名称', dataIndex: 'hospital', width: 220 },
  { title: '科室 & 职称', dataIndex: 'department_title', width: 160 },
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
  {
    title: '累计积分',
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

.name-cell {
  color: var(--color-text-1);
  font-weight: 500;
}

.ellipsis-text {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
