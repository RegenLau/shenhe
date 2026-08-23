<template>
  <a-drawer
    v-model:visible="visible"
    width="min(580px, 100vw)"
    title="人工单独结算"
    :mask-closable="false"
    unmount-on-close
    @cancel="reset"
  >
    <a-spin :loading="loading" class="manual-loading">
      <a-alert type="warning" show-icon class="manual-alert">
        人工单独结算可跳过专业认证未完成的自动月结阻断，但不能跳过收款信息。系统将结算该医生截至操作时间的全部未结积分，不能手工修改积分数。
      </a-alert>

      <a-form :model="candidateForm" layout="vertical">
        <a-form-item label="选择医生" required class="candidate-field">
          <a-select
            v-model="doctorId"
            :loading="candidatesLoading"
            :filter-option="false"
            :search-delay="300"
            allow-search
            allow-clear
            placeholder="输入医生姓名、医院、科室或手机号搜索"
            @search="loadCandidates"
            @change="handleDoctorChange"
            @popup-visible-change="handleCandidatePopupVisible"
          >
            <a-option
              v-for="candidate in selectableCandidates"
              :key="candidate.doctor_id"
              :value="candidate.doctor_id"
              :label="candidateOptionLabel(candidate)"
            >
              <div class="doctor-option">
                <div class="doctor-option-main">
                  <strong>{{ candidate.doctor_name }}</strong>
                  <span>{{ candidateMeta(candidate) }}</span>
                </div>
                <div class="doctor-option-status">
                  <strong>{{ formatPoints(candidate.amount_cent) }}</strong>
                  <span :class="{ pending: !candidate.payment_complete }">
                    {{ candidate.payment_complete ? '收款已填写' : '收款待补录' }}
                  </span>
                </div>
              </div>
            </a-option>
            <template #empty>
              <a-empty :description="candidatesError || '未找到有可结算积分的医生'" />
            </template>
          </a-select>
        </a-form-item>
      </a-form>

      <a-alert v-if="candidatesError" type="error" show-icon class="manual-alert">
        {{ candidatesError }}
        <template #action>
          <a-button size="small" @click="loadCandidates('')">重试</a-button>
        </template>
      </a-alert>

      <a-result
        v-if="!loading && errorMessage"
        status="error"
        title="结算信息加载失败"
        :subtitle="errorMessage"
      >
        <template #extra><a-button type="primary" @click="loadOverview">重新加载</a-button></template>
      </a-result>

      <a-empty
        v-else-if="!doctorId"
        class="manual-placeholder"
        description="请选择一位有未结积分的医生查看本次结算范围"
      />

      <template v-else-if="overview.doctor_id">
        <a-descriptions :column="1" bordered class="manual-summary">
          <a-descriptions-item label="医生">{{ doctorName }}</a-descriptions-item>
          <a-descriptions-item label="专业认证">
            <sa-dict
              :value="overview.eligibility?.certification_status"
              dict="doctor_certification_status"
            />
          </a-descriptions-item>
          <a-descriptions-item label="收款信息">
            <sa-dict
              :value="overview.eligibility?.payment_account_status"
              dict="payment_account_status"
            />
            <span class="account-text">
              {{ overview.payment_account?.bank_name || '—' }} ·
              {{ overview.payment_account?.bank_card_masked || '—' }}
            </span>
          </a-descriptions-item>
          <a-descriptions-item label="当月已累计">
            {{ formatPoints(overview.current_month_amount_cent) }}
          </a-descriptions-item>
          <a-descriptions-item label="历史递延">
            {{ formatPoints(overview.carryover_amount_cent) }}
          </a-descriptions-item>
          <a-descriptions-item label="本次结算总积分">
            <strong class="amount-text">
              {{ formatPoints(overview.estimated_next_settlement_amount_cent) }}
            </strong>
          </a-descriptions-item>
        </a-descriptions>

        <a-alert
          v-if="!overview.eligibility?.payment_complete"
          type="warning"
          show-icon
          class="manual-alert"
        >
          该医生的收款信息未填写完整，必须先补录并确认后才能结算。
          <template #action>
            <a-button size="small" type="primary" @click="editPaymentAccount">
              补录收款信息
            </a-button>
          </template>
        </a-alert>

        <a-alert
          v-if="Number(overview.estimated_next_settlement_amount_cent || 0) <= 0"
          type="error"
          show-icon
          class="manual-alert"
        >
          该医生当前没有可结算积分，系统不会生成结算记录。
        </a-alert>

        <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
          <a-form-item field="reason" label="单独结算原因" required>
            <a-textarea
              v-model="form.reason"
              :max-length="200"
              show-word-limit
              :auto-size="{ minRows: 4, maxRows: 7 }"
              placeholder="请说明为什么需要在当前时间单独结算，该原因将进入审计记录"
            />
          </a-form-item>
          <a-checkbox v-model="form.confirmed" class="confirm-check">
            我已确认收款账户，并知晓本次将结算截至当前的全部未结积分
          </a-checkbox>
        </a-form>
      </template>
    </a-spin>

    <template #footer>
      <a-space>
        <a-button @click="visible = false">取消</a-button>
        <a-button
          type="primary"
          status="warning"
          :loading="submitting"
          :disabled="!canSubmit"
          @click="submit"
        >
          生成人工结算单
        </a-button>
      </a-space>
    </template>
  </a-drawer>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import withdrawalApi from '@/api/product/withdrawal'

const emit = defineEmits(['success', 'edit-account'])
const visible = ref(false)
const loading = ref(false)
const submitting = ref(false)
const errorMessage = ref('')
const candidatesLoading = ref(false)
const candidatesError = ref('')
const candidates = ref([])
const selectedDoctor = ref()
const doctorId = ref()
const doctorName = ref('')
const formRef = ref()
const overview = reactive({})
const candidateForm = reactive({})
const form = reactive({ reason: '', confirmed: false })
const rules = {
  reason: [{ required: true, message: '请填写人工单独结算原因' }]
}
const canSubmit = computed(() =>
  Boolean(doctorId.value) &&
  Number(overview.estimated_next_settlement_amount_cent || 0) > 0 &&
  overview.eligibility?.payment_complete
)
const selectableCandidates = computed(() => {
  if (
    !selectedDoctor.value ||
    candidates.value.some(
      (item) => item.doctor_id === selectedDoctor.value.doctor_id
    )
  ) {
    return candidates.value
  }
  return [selectedDoctor.value, ...candidates.value]
})
const formatNumber = (value) => Number(value || 0).toLocaleString('zh-CN')
const formatPoints = (value) => `${formatNumber(Number(value || 0) / 100)} 积分`
const candidateMeta = (candidate) =>
  [candidate.hospital, candidate.department, candidate.doctor_phone_masked]
    .filter(Boolean)
    .join(' · ') || '执业信息待完善'
const candidateOptionLabel = (candidate) =>
  `${candidate.doctor_name} · ${formatPoints(candidate.amount_cent)}`
const clearOverview = () => {
  errorMessage.value = ''
  Object.keys(overview).forEach((key) => delete overview[key])
}
const reset = () => {
  candidateRequestId += 1
  doctorId.value = undefined
  doctorName.value = ''
  selectedDoctor.value = undefined
  candidates.value = []
  candidatesError.value = ''
  candidatesLoading.value = false
  clearOverview()
  Object.assign(form, { reason: '', confirmed: false })
  formRef.value?.clearValidate?.()
}
let candidateRequestId = 0
const normalizeCandidate = (doctor = {}) => ({
  ...doctor,
  doctor_id: Number(doctor.doctor_id),
  amount_cent: Number(doctor.amount_cent ?? doctor.accrued_amount_cent ?? 0),
  doctor_name: doctor.doctor_name || ''
})
const loadCandidates = async (keyword = '') => {
  const requestId = ++candidateRequestId
  candidatesLoading.value = true
  candidatesError.value = ''
  try {
    const response = await withdrawalApi.getManualCandidates({
      keyword: String(keyword || '').trim(),
      page: 1,
      limit: 20
    })
    if (requestId !== candidateRequestId) return
    if (response.code !== 200) {
      candidatesError.value = response.message || '医生列表加载失败'
      return
    }
    candidates.value = (response.data?.data || []).map(normalizeCandidate)
  } catch {
    if (requestId === candidateRequestId) {
      candidatesError.value = '医生列表加载失败，请稍后重试'
    }
  } finally {
    if (requestId === candidateRequestId) candidatesLoading.value = false
  }
}
const loadOverview = async () => {
  if (!doctorId.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await withdrawalApi.getDoctorMonthlyOverview(doctorId.value)
    if (response.code === 200) {
      Object.assign(overview, response.data)
      return
    }
    errorMessage.value = response.message || '请稍后重新加载'
  } catch {
    errorMessage.value = '网络连接异常，请检查后重试'
  } finally {
    loading.value = false
  }
}
const handleDoctorChange = async (value) => {
  clearOverview()
  Object.assign(form, { reason: '', confirmed: false })
  formRef.value?.clearValidate?.()
  if (!value) {
    doctorName.value = ''
    selectedDoctor.value = undefined
    return
  }
  const candidate = selectableCandidates.value.find(
    (item) => String(item.doctor_id) === String(value)
  )
  selectedDoctor.value = candidate
  doctorId.value = Number(value)
  doctorName.value = candidate?.doctor_name || ''
  await loadOverview()
}
const handleCandidatePopupVisible = (popupVisible) => {
  if (popupVisible && !candidatesLoading.value) loadCandidates('')
}
const open = async (doctor) => {
  reset()
  visible.value = true
  if (!doctor?.doctor_id) {
    await loadCandidates('')
    return
  }
  const candidate = normalizeCandidate(doctor)
  candidates.value = [candidate]
  selectedDoctor.value = candidate
  doctorId.value = candidate.doctor_id
  doctorName.value = candidate.doctor_name
  await loadOverview()
}
const editPaymentAccount = () => {
  visible.value = false
  emit('edit-account', {
    doctor_id: doctorId.value,
    doctor_name: doctorName.value
  })
}
const submit = async () => {
  const errors = await formRef.value?.validate()
  if (errors) return
  if (!form.confirmed) {
    Message.warning('请先确认收款账户和本次特批范围')
    return
  }
  submitting.value = true
  try {
    const response = await withdrawalApi.createManualOrder({
      doctor_id: doctorId.value,
      reason: form.reason.trim()
    })
    if (response.code === 200) {
      Message.success('人工结算单已生成，当前全部未结积分已锁定')
      visible.value = false
      emit('success')
    }
  } catch {
    Message.error('人工单独结算失败，请检查网络后重试')
  } finally {
    submitting.value = false
  }
}
defineExpose({ open })
</script>

<style scoped lang="less">
.manual-loading { display: block; min-height: 360px; }
.manual-alert,
.manual-summary { margin-bottom: 18px; }
.candidate-field { margin-bottom: 18px; }
.manual-placeholder { padding: 36px 0 48px; }
.doctor-option {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 4px 0;
}
.doctor-option-main,
.doctor-option-status {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}
.doctor-option-main {
  strong,
  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  span {
    color: var(--color-text-3);
    font-size: 12px;
  }
}
.doctor-option-status {
  flex: none;
  align-items: flex-end;
  strong { color: rgb(var(--primary-6)); }
  span {
    color: rgb(var(--success-6));
    font-size: 12px;
    &.pending { color: rgb(var(--warning-6)); }
  }
}
.account-text {
  display: block;
  margin-top: 6px;
  color: var(--color-text-3);
  font-size: 12px;
}
.amount-text {
  color: rgb(var(--warning-6));
  font-size: 18px;
}
.confirm-check {
  align-items: flex-start;
  line-height: 22px;
}
</style>
