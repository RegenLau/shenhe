<template>
  <a-drawer
    v-model:visible="visible"
    width="min(560px, 100vw)"
    title="编辑医生收款信息"
    :mask-closable="false"
    unmount-on-close
    @cancel="reset"
  >
    <a-spin :loading="loading" class="form-loading">
      <a-result
        v-if="!loading && loadError"
        status="error"
        title="收款信息加载失败"
        :subtitle="loadError"
      >
        <template #extra>
          <a-button type="primary" @click="loadAccount">重新加载</a-button>
        </template>
      </a-result>

      <template v-else>
        <a-alert type="warning" show-icon class="account-alert">
          收款信息将用于生成待结算名单。身份证号和银行卡号仅显示脱敏信息；保持原值可直接保存，需要更换时请完整输入新号码。
        </a-alert>

        <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
          <a-form-item field="payee_name" label="收款人姓名" required>
            <a-input v-model="form.payee_name" :max-length="50" placeholder="请输入与银行账户一致的姓名" allow-clear />
          </a-form-item>
          <a-form-item
            field="id_card_no"
            label="身份证号"
            :required="!account.id_card_masked"
          >
            <a-input
              v-model="form.id_card_no"
              :max-length="18"
              placeholder="请完整输入 18 位身份证号"
              allow-clear
            />
          </a-form-item>
          <a-form-item field="bank_name" label="开户行" required>
            <a-input v-model="form.bank_name" :max-length="100" placeholder="例如：中国工商银行北京某支行" allow-clear />
          </a-form-item>
          <a-form-item field="bank_location" label="开户地" required>
            <a-input v-model="form.bank_location" :max-length="100" placeholder="例如：浙江省杭州市" allow-clear />
          </a-form-item>
          <a-form-item
            field="bank_card_no"
            label="银行卡号"
            :required="!account.bank_card_masked"
          >
            <a-input
              v-model="form.bank_card_no"
              :max-length="23"
              placeholder="请完整输入 16 至 19 位银行卡号"
              allow-clear
            />
          </a-form-item>
          <a-checkbox v-model="form.confirmed" class="confirm-check">
            我已与医生核对全部收款信息
          </a-checkbox>
        </a-form>
      </template>
    </a-spin>

    <template #footer>
      <a-space>
        <a-button @click="visible = false">取消</a-button>
        <a-button
          type="primary"
          :loading="saving"
          :disabled="loading || Boolean(loadError)"
          @click="save"
        >
          保存并确认
        </a-button>
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
const loadError = ref('')
const formRef = ref()
const doctorId = ref()
const doctorName = ref('')
const account = reactive({ status: 'missing' })
const form = reactive({
  payee_name: '',
  id_card_no: '',
  bank_name: '',
  bank_location: '',
  bank_card_no: '',
  confirmed: false
})
const keepsOriginalValue = (value, maskedValue) => {
  const normalized = String(value || '').trim()
  return Boolean(maskedValue) && (!normalized || normalized === maskedValue)
}
const rules = {
  payee_name: [{ required: true, message: '请输入收款人姓名' }],
  id_card_no: [
    {
      validator: (value, callback) => {
        const normalized = String(value || '').trim()
        if (keepsOriginalValue(normalized, account.id_card_masked)) {
          callback()
          return
        }
        if (!/^\d{17}[\dXx]$/.test(normalized)) {
          callback('请输入 18 位有效身份证号')
          return
        }
        callback()
      }
    }
  ],
  bank_name: [{ required: true, message: '请输入开户行' }],
  bank_location: [{ required: true, message: '请输入开户地' }],
  bank_card_no: [
    {
      validator: (value, callback) => {
        const normalized = String(value || '').trim()
        if (keepsOriginalValue(normalized, account.bank_card_masked)) {
          callback()
          return
        }
        if (!/^(?:\d\s*){16,19}$/.test(normalized)) {
          callback('请输入 16 至 19 位银行卡号')
          return
        }
        callback()
      }
    }
  ]
}
const reset = () => {
  doctorId.value = undefined
  doctorName.value = ''
  loadError.value = ''
  Object.assign(account, {
    status: 'missing',
    payee_name: '',
    id_card_masked: '',
    bank_name: '',
    bank_location: '',
    bank_card_masked: ''
  })
  Object.assign(form, {
    payee_name: '', id_card_no: '', bank_name: '', bank_location: '', bank_card_no: '', confirmed: false
  })
  formRef.value?.clearValidate?.()
}
const loadAccount = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const response = await withdrawalApi.getPaymentAccount(doctorId.value)
    if (response.code === 200) {
      doctorName.value = response.data.doctor_name
      Object.assign(account, response.data.account)
      form.payee_name = response.data.account.payee_name || doctorName.value
      form.id_card_no = response.data.account.id_card_masked || ''
      form.bank_name = response.data.account.bank_name || ''
      form.bank_location = response.data.account.bank_location || ''
      form.bank_card_no = response.data.account.bank_card_masked || ''
      return
    }
    loadError.value = response.message || '请稍后重试'
  } catch {
    loadError.value = '请检查网络连接后重试'
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
      id_card_no: keepsOriginalValue(form.id_card_no, account.id_card_masked)
        ? ''
        : form.id_card_no.trim(),
      bank_name: form.bank_name.trim(),
      bank_location: form.bank_location.trim(),
      bank_card_no: keepsOriginalValue(form.bank_card_no, account.bank_card_masked)
        ? ''
        : form.bank_card_no.replaceAll(' ', ''),
      confirmed: true
    })
    if (response.code === 200) {
      Message.success('医生收款信息已保存')
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
.account-alert { margin-bottom: 18px; }
.confirm-check {
  align-items: flex-start;
  line-height: 22px;
}
</style>
