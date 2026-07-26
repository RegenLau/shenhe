<template>
  <a-modal
    v-model:visible="visible"
    width="min(600px, calc(100vw - 24px))"
    title="创建任务"
    ok-text="创建并分配任务"
    :mask-closable="false"
    :ok-loading="loading"
    unmount-on-close
    @before-ok="submit"
  >
    <a-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      :auto-label-width="true"
      scroll-to-first-error
    >
      <a-form-item field="doctor_name" label="医生姓名">
        <a-input
          v-model="formData.doctor_name"
          placeholder="请输入医生姓名"
          :max-length="20"
          allow-clear
        />
      </a-form-item>

      <a-form-item field="doctor_phone" label="绑定手机号">
        <a-input
          v-model="formData.doctor_phone"
          placeholder="请输入医生登录小程序使用的手机号"
          :max-length="11"
          allow-clear
        />
      </a-form-item>

      <a-alert
        v-if="accountHint"
        :type="accountHint.type"
        show-icon
        class="account-hint"
      >
        {{ accountHint.text }}
      </a-alert>

      <a-form-item field="item_count" label="任务数量">
        <a-input-number
          v-model="formData.item_count"
          :min="1"
          :max="1000"
          placeholder="请输入分配的审核条数"
          style="width: 100%"
        >
          <template #suffix>条</template>
        </a-input-number>
      </a-form-item>

      <a-form-item label="任务说明">
        <span class="readonly-text">按任务数量创建医生审核任务</span>
      </a-form-item>

      <a-form-item label="单条计酬">
        <span class="readonly-text">¥50 / 条（医生端显示 50 积分）</span>
      </a-form-item>

      <a-form-item label="预计总计酬">
        <strong class="total-reward">{{ totalReward }}</strong>
      </a-form-item>
    </a-form>

    <a-alert type="info" show-icon>
      任务创建后立即绑定到该手机号。医生首次使用该手机号登录小程序后，即可看到已分配任务。
    </a-alert>
  </a-modal>
</template>

<script setup>
import { computed, nextTick, reactive, ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import taskApi from '@/api/product/task'

const emit = defineEmits(['success'])

const formRef = ref()
const visible = ref(false)
const loading = ref(false)
const doctorAccounts = ref([])

const initialFormData = {
  doctor_name: '',
  doctor_phone: '',
  item_count: 10
}

const formData = reactive({ ...initialFormData })

const rules = {
  doctor_name: [{ required: true, message: '请输入医生姓名' }],
  doctor_phone: [
    { required: true, message: '请输入绑定手机号' },
    { match: /^1\d{10}$/, message: '请输入正确的 11 位手机号' }
  ],
  item_count: [
    { required: true, message: '请输入任务数量' },
    { type: 'number', min: 1, message: '任务数量必须大于 0' }
  ]
}

const matchedAccount = computed(() => {
  if (!/^1\d{10}$/.test(formData.doctor_phone)) return null
  return doctorAccounts.value.find((item) => item.phone === formData.doctor_phone) || null
})

const hasNameConflict = computed(() => {
  if (!matchedAccount.value || !formData.doctor_name.trim()) return false
  return matchedAccount.value.name !== formData.doctor_name.trim()
})

const accountDisabled = computed(
  () => matchedAccount.value?.account_status === 'disabled'
)

const accountHint = computed(() => {
  if (!/^1\d{10}$/.test(formData.doctor_phone)) return null

  if (hasNameConflict.value) {
    return {
      type: 'error',
      text: `该手机号已属于“${matchedAccount.value.name}”，请核对姓名后再创建任务。`
    }
  }

  if (accountDisabled.value) {
    return {
      type: 'error',
      text: '该医生账号已禁用，不能分配新任务。请先到医生管理中开启账号。'
    }
  }

  if (matchedAccount.value) {
    return {
      type: 'success',
      text: `已匹配现有账号“${matchedAccount.value.name}”，任务将直接分配到该账号。`
    }
  }

  return {
    type: 'info',
    text: '未找到现有账号。提交后将自动创建待激活账号并分配任务。'
  }
})

const totalReward = computed(() => {
  return `¥${Number(formData.item_count || 0) * 50}`
})

const loadDoctorAccounts = async () => {
  try {
    const response = await taskApi.getDoctorOptions()
    doctorAccounts.value = response.code === 200 ? response.data : []
  } catch {
    doctorAccounts.value = []
    Message.error('医生账号加载失败，请稍后重新打开')
  }
}

const open = async () => {
  Object.assign(formData, initialFormData)
  visible.value = true
  await nextTick()
  formRef.value?.clearValidate()
  await loadDoctorAccounts()
}

const submit = async (done) => {
  const errors = await formRef.value?.validate()
  if (errors || hasNameConflict.value || accountDisabled.value) {
    done(false)
    return
  }

  loading.value = true
  try {
    const response = await taskApi.save({
      doctor_name: formData.doctor_name.trim(),
      doctor_phone: formData.doctor_phone,
      item_count: formData.item_count
    })

    if (response.code === 200) {
      Message.success('任务已创建，医生登录小程序后即可查看')
      emit('success')
      done(true)
      return
    }
  } catch {
    Message.error('任务创建失败，请检查网络后重试')
  } finally {
    loading.value = false
  }

  done(false)
}

defineExpose({ open })
</script>

<style scoped lang="less">
.account-hint {
  margin: -4px 0 20px;
}

.readonly-text {
  color: var(--color-text-2);
}

.total-reward {
  color: rgb(var(--primary-6));
  font-size: 18px;
}
</style>
