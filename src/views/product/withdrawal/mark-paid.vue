<template>
  <a-drawer
    v-model:visible="visible"
    width="min(520px, 100vw)"
    title="单笔补录到账"
    :mask-closable="false"
    unmount-on-close
    @cancel="reset"
  >
    <a-alert type="info" show-icon class="paid-alert">
      仅用于已导出结算单的单笔补录。到账金额必须与结算单完全一致，确认后对应积分明细将标记为已结算。
    </a-alert>

    <a-descriptions :column="1" bordered class="paid-summary">
      <a-descriptions-item label="结算单号">
        <span class="number-text">{{ order.settlement_no || '—' }}</span>
      </a-descriptions-item>
      <a-descriptions-item label="医生">{{ order.doctor_name || '—' }}</a-descriptions-item>
      <a-descriptions-item label="到账金额">
        <strong class="amount-text">{{ formatPoints(order.amount_cent) }}</strong>
      </a-descriptions-item>
    </a-descriptions>

    <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
      <a-form-item field="paid_at" label="到账时间" required>
        <a-input
          v-model="form.paid_at"
          placeholder="YYYY-MM-DD HH:mm:ss"
          :max-length="19"
          allow-clear
        />
      </a-form-item>
      <a-form-item field="transaction_no" label="银行流水号" required>
        <a-input
          v-model="form.transaction_no"
          placeholder="请输入可追溯的银行流水号"
          :max-length="80"
          allow-clear
        />
      </a-form-item>
      <a-checkbox v-model="form.confirmed" class="confirm-check">
        我已核对银行到账结果、到账时间和流水号
      </a-checkbox>
    </a-form>

    <template #footer>
      <a-space>
        <a-button @click="visible = false">取消</a-button>
        <a-button type="primary" :loading="submitting" @click="submit">确认已到账</a-button>
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
const submitting = ref(false)
const formRef = ref()
const order = reactive({})
const form = reactive({ paid_at: '', transaction_no: '', confirmed: false })
const rules = {
  paid_at: [
    { required: true, message: '请填写到账时间' },
    { match: /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, message: '格式必须为 YYYY-MM-DD HH:mm:ss' }
  ],
  transaction_no: [{ required: true, message: '请填写银行流水号' }]
}
const pad = (value) => String(value).padStart(2, '0')
const nowText = () => {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}
const formatNumber = (value) => Number(value || 0).toLocaleString('zh-CN')
const formatPoints = (value) => `${formatNumber(Number(value || 0) / 100)} 积分`
const reset = () => {
  Object.keys(order).forEach((key) => delete order[key])
  Object.assign(form, { paid_at: '', transaction_no: '', confirmed: false })
  formRef.value?.clearValidate?.()
}
const open = (record) => {
  reset()
  Object.assign(order, record)
  form.paid_at = nowText()
  visible.value = true
}
const submit = async () => {
  const errors = await formRef.value?.validate()
  if (errors) return
  if (!form.confirmed) {
    Message.warning('请先确认已核对银行到账结果')
    return
  }
  submitting.value = true
  try {
    const response = await withdrawalApi.markMonthlyOrderPaid({
      id: order.id,
      amount_cent: order.amount_cent,
      paid_at: form.paid_at.trim(),
      transaction_no: form.transaction_no.trim()
    })
    if (response.code === 200) {
      Message.success('结算单已更新为已到账')
      visible.value = false
      emit('success')
    }
  } catch {
    Message.error('到账结果保存失败，请检查网络后重试')
  } finally {
    submitting.value = false
  }
}
defineExpose({ open })
</script>

<style scoped lang="less">
.paid-alert,
.paid-summary { margin-bottom: 18px; }
.number-text {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
}
.amount-text { font-size: 18px; }
.confirm-check {
  align-items: flex-start;
  line-height: 22px;
}
</style>
