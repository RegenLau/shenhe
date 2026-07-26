<template>
  <div class="doctor-page">
    <header class="page-header">
      <div>
        <h1>医生管理</h1>
        <p>查看医生账号、执业信息、认证状态与累计计酬</p>
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
        <span class="money-text">{{ formatCurrency(record.accrued_reward_cent) }}</span>
      </template>

      <template #operationAfterExtend="{ record }">
        <a-popconfirm
          :content="accountStatusConfirmText(record)"
          position="bottom"
          @ok="changeAccountStatus(record)"
        >
          <a-link
            :status="isDoctorDisabled(record) ? 'success' : 'danger'"
            :disabled="updatingIds.has(record.id)"
          >
            {{
              updatingIds.has(record.id)
                ? '处理中'
                : isDoctorDisabled(record)
                  ? '开启'
                  : '禁用'
            }}
          </a-link>
        </a-popconfirm>
      </template>
    </sa-table>

    <doctor-detail ref="detailRef" />
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import tool from '@/utils/tool'
import doctorApi from '@/api/product/doctor'
import DoctorDetail from './view.vue'

const crudRef = ref()
const detailRef = ref()
const tableError = ref('')
const exporting = ref(false)
const updatingIds = reactive(new Set())

const searchForm = ref({
  keyword: '',
  account_status: '',
  certification_status: ''
})

const formatNumber = (value) => Number(value || 0).toLocaleString('zh-CN')
const formatCurrency = (value) => `¥${formatNumber(Number(value || 0) / 100)}`
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
  operationColumnWidth: 150,
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
    title: '累计计酬',
    dataIndex: 'accrued_reward_cent',
    width: 110,
    align: 'right'
  }
])

const refresh = () => crudRef.value?.refresh()
const isDoctorDisabled = (record) => record.account_status === 'disabled'

const accountStatusConfirmText = (record) => {
  if (isDoctorDisabled(record)) {
    return record.activation_time
      ? '开启后医生可重新登录小程序并接收新任务，确认开启吗？'
      : '开启后账号恢复为待激活状态，并可重新接收任务，确认开启吗？'
  }

  return '禁用后医生将无法登录小程序或接收新任务，历史任务和计酬仍会保留。确认禁用吗？'
}

const changeAccountStatus = async (record) => {
  const action = isDoctorDisabled(record) ? 'enable' : 'disable'
  updatingIds.add(record.id)

  try {
    const response = await doctorApi.changeAccountStatus({
      id: record.id,
      action
    })
    if (response.code !== 200) return

    record.account_status = response.data.account_status
    Message.success(response.message)
    await refresh()
  } catch {
    Message.error('医生账号状态更新失败，请稍后重试')
  } finally {
    updatingIds.delete(record.id)
  }
}

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
