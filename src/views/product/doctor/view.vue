<template>
  <a-drawer
    v-model:visible="visible"
    width="min(680px, 100vw)"
    title="医生详情"
    :footer="false"
    unmount-on-close
  >
    <a-spin :loading="loading" class="detail-loading">
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

      <template v-else-if="detail.id">
        <a-alert :type="accountAlertType" show-icon class="account-alert">
          <template v-if="accountActive">
            医生已使用绑定手机号登录小程序，账号已激活。最近登录时间为
            {{ detail.last_login_time || '—' }}。
          </template>
          <template v-else-if="accountDisabled">
            账号已禁用，医生当前无法登录小程序；历史任务和计酬记录仍会保留。
          </template>
          <template v-else>
            账号待激活。医生首次使用 {{ maskPhone(detail.phone) }}
            登录小程序后，即可查看已分配任务。
          </template>
        </a-alert>

        <section class="detail-section">
          <h3>任务概况</h3>
          <a-row :gutter="[12, 12]">
            <a-col :xs="12" :sm="6">
              <div class="metric-card">
                <span>任务数</span>
                <strong>{{ formatNumber(detail.task_count) }}</strong>
              </div>
            </a-col>
            <a-col :xs="12" :sm="6">
              <div class="metric-card">
                <span>分配数量</span>
                <strong>{{ formatNumber(detail.assigned_item_count) }}</strong>
              </div>
            </a-col>
            <a-col :xs="12" :sm="6">
              <div class="metric-card">
                <span>已完成</span>
                <strong>{{ formatNumber(detail.completed_item_count) }}</strong>
              </div>
            </a-col>
            <a-col :xs="12" :sm="6">
              <div class="metric-card">
                <span>累计积分</span>
                <strong>{{ formatPoints(detail.accrued_reward_cent) }}</strong>
              </div>
            </a-col>
          </a-row>
        </section>

        <section class="detail-section">
          <h3>账号信息</h3>
          <a-descriptions :column="1" bordered>
            <a-descriptions-item label="医生姓名">
              {{ detail.name || '—' }}
            </a-descriptions-item>
            <a-descriptions-item label="性别">
              <sa-dict
                v-if="detail.gender"
                :value="detail.gender"
                dict="doctor_gender"
                render="span"
              />
              <span v-else>—</span>
            </a-descriptions-item>
            <a-descriptions-item label="绑定手机号">
              {{ maskPhone(detail.phone) }}
            </a-descriptions-item>
            <a-descriptions-item label="账号状态">
              <sa-dict
                :value="detail.account_status"
                dict="doctor_account_status"
                render="span"
              />
            </a-descriptions-item>
            <a-descriptions-item label="账号来源">
              <sa-dict
                :value="detail.account_source"
                dict="doctor_account_source"
                render="span"
              />
            </a-descriptions-item>
            <a-descriptions-item label="创建时间">
              {{ detail.create_time || '—' }}
            </a-descriptions-item>
            <a-descriptions-item label="激活时间">
              {{ detail.activation_time || '—' }}
            </a-descriptions-item>
            <a-descriptions-item label="最近登录">
              {{ detail.last_login_time || '—' }}
            </a-descriptions-item>
          </a-descriptions>

          <div class="account-action-bar">
            <a-button
              v-if="accountDisabled"
              type="primary"
              :loading="statusUpdating"
              @click="confirmChangeAccountStatus"
            >
              开启账号
            </a-button>
            <a-button
              v-else
              status="danger"
              :loading="statusUpdating"
              @click="confirmChangeAccountStatus"
            >
              禁用账号
            </a-button>
          </div>
        </section>

        <section class="detail-section">
          <h3>执业与认证</h3>
          <a-descriptions :column="1" bordered>
            <a-descriptions-item label="执业机构">
              {{ practiceValue(detail.hospital) }}
            </a-descriptions-item>
            <a-descriptions-item label="科室">
              {{ practiceValue(detail.department) }}
            </a-descriptions-item>
            <a-descriptions-item label="职称">
              {{ practiceValue(detail.title) }}
            </a-descriptions-item>
            <a-descriptions-item label="认证状态">
              <sa-dict
                :value="detail.certification_status"
                dict="doctor_certification_status"
                render="span"
              />
            </a-descriptions-item>
          </a-descriptions>
        </section>

        <section class="detail-section">
          <h3>最近任务</h3>
          <a-empty
            v-if="!detail.recent_tasks?.length"
            class="task-empty"
            description="暂无已分配任务；通过任务管理创建或导入后将在这里显示"
          />
          <a-table
            v-else
            :columns="taskColumns"
            :data="detail.recent_tasks || []"
            :pagination="false"
            :scroll="{ x: 560 }"
            row-key="id"
            size="small"
          >
            <template #status="{ record }">
              <sa-dict :value="record.status" dict="task_status" />
            </template>
            <template #progress="{ record }">
              {{ formatNumber(record.completed_count) }} /
              {{ formatNumber(record.item_count) }} 条
            </template>
            <template #reward="{ record }">
              {{ formatPoints(record.total_reward_cent) }}
            </template>
          </a-table>
        </section>
      </template>
    </a-spin>
  </a-drawer>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import doctorApi from '@/api/product/doctor'

const emit = defineEmits(['updated'])

const visible = ref(false)
const loading = ref(false)
const errorMessage = ref('')
const doctorId = ref()
const detail = ref({})
const statusUpdating = ref(false)

const taskColumns = [
  { title: '任务编号', dataIndex: 'task_no', width: 160 },
  { title: '状态', dataIndex: 'status', slotName: 'status', width: 90 },
  { title: '完成进度', dataIndex: 'progress', slotName: 'progress', width: 120 },
  { title: '任务总积分', dataIndex: 'reward', slotName: 'reward', width: 110 }
]

const accountActive = computed(() => detail.value.account_status === 'active')
const accountDisabled = computed(() => detail.value.account_status === 'disabled')
const accountAlertType = computed(() => {
  if (accountActive.value) return 'success'
  if (accountDisabled.value) return 'error'
  return 'warning'
})
const formatNumber = (value) => Number(value || 0).toLocaleString('zh-CN')
const formatPoints = (value) => `${formatNumber(Number(value || 0) / 100)} 积分`
const maskPhone = (value) =>
  String(value || '').replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2') || '—'
const practiceValue = (value) => {
  return value && value !== '待补充' ? value : '待补充'
}

const accountStatusConfirm = computed(() => {
  if (accountDisabled.value) {
    return {
      title: '确认开启账号',
      content: detail.value.activation_time
        ? '开启后医生可重新登录小程序并接收新任务，确认开启吗？'
        : '开启后账号恢复为待激活状态，并可重新接收任务，确认开启吗？',
      okText: '确认开启'
    }
  }

  return {
    title: '确认禁用账号',
    content:
      '禁用后医生将无法登录小程序或接收新任务，历史任务和积分记录仍会保留。确认禁用吗？',
    okText: '确认禁用'
  }
})

const changeAccountStatus = async () => {
  const action = accountDisabled.value ? 'enable' : 'disable'
  statusUpdating.value = true

  try {
    const response = await doctorApi.changeAccountStatus({
      id: detail.value.id,
      action
    })
    if (response.code === 200) {
      Message.success(response.message)
      emit('updated')
      await loadDetail()
      return
    }
  } catch {
    Message.error('医生账号状态更新失败，请稍后重试')
  } finally {
    statusUpdating.value = false
  }
}

const confirmChangeAccountStatus = () => {
  const { title, content, okText } = accountStatusConfirm.value
  Modal.confirm({
    title,
    content,
    width: 'min(420px, calc(100vw - 32px))',
    okText,
    okButtonProps: accountDisabled.value ? undefined : { status: 'danger' },
    onOk: changeAccountStatus
  })
}

const loadDetail = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await doctorApi.read(doctorId.value)
    if (response.code === 200) {
      detail.value = response.data
      return
    }

    detail.value = {}
    errorMessage.value = response.message || '请稍后重新加载'
  } catch {
    detail.value = {}
    errorMessage.value = '网络连接异常，请检查后重试'
  } finally {
    loading.value = false
  }
}

const open = async (id) => {
  doctorId.value = id
  detail.value = {}
  visible.value = true
  await loadDetail()
}

defineExpose({ open })
</script>

<style scoped lang="less">
.detail-loading {
  display: block;
  width: 100%;
  min-height: 360px;
}

.account-alert {
  margin-bottom: 20px;
}

.account-action-bar {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

.detail-section {
  margin-bottom: 24px;

  h3 {
    margin: 0 0 12px;
    color: var(--color-text-1);
    font-size: 15px;
    font-weight: 600;
  }
}

.metric-card {
  display: flex;
  min-height: 84px;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  background: var(--color-fill-1);
  border: 1px solid var(--color-border-1);
  border-radius: var(--border-radius-medium);

  span {
    color: var(--color-text-3);
    font-size: 12px;
  }

  strong {
    overflow: hidden;
    color: var(--color-text-1);
    font-size: 20px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.task-empty {
  padding: 24px 0;
}

@media (max-width: 575px) {
  .metric-card {
    min-height: 76px;
  }
}
</style>
