<template>
  <a-drawer
    v-model:visible="visible"
    width="min(560px, 100vw)"
    title="补录医生收款信息"
    :mask-closable="false"
    unmount-on-close
    @cancel="reset"
  >
    <a-spin :loading="loading" class="form-loading">
      <a-alert type="warning" show-icon class="account-alert">
        收款信息将用于生成待结算名单。请与医生确认后完整录入；为避免敏感信息泄露，系统不回显完整身份证号和银行卡号。
      </a-alert>

      <a-descriptions v-if="doctorName" :column="1" bordered class="doctor-summary">
        <a-descriptions-item label="医生">{{ doctorName }}</a-descriptions-item>
        <a-descriptions-item label="当前状态">
          <sa-dict :value="account.status || 'missing'" dict="payment_account_status" />
        </a-descriptions-item>
        <a-descriptions-item v-if="account.status === 'complete'" label="当前账户">
          {{ account.bank_name || '—' }} · {{ account.bank_card_masked || '—' }}
        </a-descriptions-item>
      </a-descriptions>

      <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
        <a-form-item field="payee_name" label="收款人姓名" required>
          <a-input v-model="form.payee_name" :max-length="50" placeholder="请输入与银行账户一致的姓名" allow-clear />
        </a-form-item>
        <a-form-item field="id_card_no" label="身份证号" required>
          <a-input-password
            v-model="form.id_card_no"
            :max-length="18"
            placeholder="请完整输入 18 位身份证号"
            allow-clear
          />
        </a-form-item>
        <a-form-item field="bank_name" label="开户行" required>
          <a-input v-model="form.bank_name" :max-length="100" placeholder="例如：中国工商银行北京某支行" allow-clear />
        </a-form-item>
        <a-form-item field="bank_card_no" label="银行卡号" required>
          <a-input-password
            v-model="form.bank_card_no"
            :max-length="23"
            placeholder="请完整输入 16 至 19 位银行卡号"
            allow-clear
          />
        </a-form-item>
        <a-checkbox v-model="form.confirmed" class="confirm-check">
          我已与医生核对收款人、身份证号和银行卡信息
        </a-checkbox>
      </a-form>
    </a-spin>

    <template #footer>
      <a-space>
        <a-button @click="visible = false">取消</a-button>
        <a-button type="primary" :loading="saving" @click="save">保存并确认</a-button>
      </a-space>
    </template>
  </a-drawer>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import withdrawalApi from '@/api/product/withdrawal'

const emit = defineEmits(['success'])
const visible = ref(false)
const loading = ref(false)
const saving = ref(false)
const formRef = ref()
const doctorId = ref()
const doctorName = ref('')
const account = reactive({ status: 'missing' })
const form = reactive({
  payee_name: '',
  id_card_no: '',
  bank_name: '',
  bank_card_no: '',
  confirmed: false
})
const rules = {
  payee_name: [{ required: true, message: '请输入收款人姓名' }],
  id_card_no: [
    { required: true, message: '请输入身份证号' },
    { match: /^\d{17}[\dXx]$/, message: '请输入 18 位有效身份证号' }
  ],
  bank_name: [{ required: true, message: '请输入开户行' }],
  bank_card_no: [
    { required: true, message: '请输入银行卡号' },
    { match: /^(?:\d\s*){16,19}$/, message: '请输入 16 至 19 位银行卡号' }
  ]
}
const reset = () => {
  doctorId.value = undefined
  doctorName.value = ''
  Object.assign(account, { status: 'missing' })
  Object.assign(form, {
    payee_name: '', id_card_no: '', bank_name: '', bank_card_no: '', confirmed: false
  })
  formRef.value?.clearValidate?.()
}
const loadAccount = async () => {
  loading.value = true
  try {
    const response = await withdrawalApi.getPaymentAccount(doctorId.value)
    if (response.code === 200) {
      doctorName.value = response.data.doctor_name
      Object.assign(account, response.data.account)
      form.payee_name = response.data.account.payee_name || doctorName.value
      form.bank_name = response.data.account.bank_name || ''
    }
  } finally {
    loading.value = false
  }
}
const open = async (doctor) => {
  reset()
  doctorId.value = doctor.doctor_id
  doctorName.value = doctor.doctor_name || ''
  visible.value = true
  await loadAccount()
}
const save = async () => {
  const errors = await formRef.value?.validate()
  if (errors) return
  if (!form.confirmed) {
    Message.warning('请先确认已核对全部收款信息')
    return
  }
  saving.value = true
  try {
    const response = await withdrawalApi.savePaymentAccount({
      doctor_id: doctorId.value,
      payee_name: form.payee_name.trim(),
      id_card_no: form.id_card_no.trim(),
      bank_name: form.bank_name.trim(),
      bank_card_no: form.bank_card_no.replaceAll(' ', ''),
      confirmed: true
    })
    if (response.code === 200) {
      Message.success('收款信息已补录，现可进行人工单独结算')
      visible.value = false
      emit('success')
    }
  } catch {
    Message.error('收款信息保存失败，请检查网络后重试')
  } finally {
    saving.value = false
  }
}
defineExpose({ open })
</script>

<style scoped lang="less">
.form-loading { display: block; min-height: 360px; }
.account-alert,
.doctor-summary { margin-bottom: 18px; }
.confirm-check {
  align-items: flex-start;
  line-height: 22px;
}
</style>
