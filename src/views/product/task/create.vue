<template>
  <a-modal
    v-model:visible="visible"
    :width="tool.getDevice() === 'mobile' ? '100%' : '520px'"
    title="创建任务"
    ok-text="创建并分配任务"
    :mask-closable="false"
    :ok-loading="loading"
    unmount-on-close
    @before-ok="submit"
  >
    <a-alert v-if="optionsError" type="error" show-icon class="options-error">
      {{ optionsError }}
      <template #action>
        <a-button size="small" :loading="optionsLoading" @click="loadDoctorAccounts">
          重试
        </a-button>
      </template>
    </a-alert>

    <a-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      :auto-label-width="true"
      scroll-to-first-error
    >
      <a-form-item field="doctor_id" label="选择医生">
        <a-select
          v-model="formData.doctor_id"
          :options="doctorOptions"
          :loading="optionsLoading"
          :filter-option="filterDoctorOption"
          placeholder="按姓名、手机号、医院或科室搜索"
          allow-search
          allow-clear
        >
          <template #empty>
            <div class="select-empty">
              {{
                optionsError
                  ? '医生列表加载失败，请使用上方「重试」重新加载'
                  : '暂无匹配医生，请先到「医生管理」新增医生账号'
              }}
            </div>
          </template>
        </a-select>
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
          :precision="0"
          placeholder="请输入分配的审核条数"
          style="width: 100%"
        >
          <template #suffix>条</template>
        </a-input-number>
      </a-form-item>

      <a-form-item label="任务说明">
        <span class="readonly-text">按任务数量创建医生审核任务</span>
      </a-form-item>

      <a-form-item label="单条积分">
        <span class="readonly-text">50 积分 / 条</span>
      </a-form-item>

      <a-form-item label="预计总积分">
        <strong class="total-reward">{{ totalReward }}</strong>
      </a-form-item>
    </a-form>

    <a-alert type="info" show-icon>
      任务创建后立即分配给所选医生，待激活医生登录小程序后即可查看。列表中未找到医生时，请先到「医生管理」新增医生账号。
    </a-alert>
  </a-modal>
</template>

<script setup>
import { computed, nextTick, reactive, ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import tool from '@/utils/tool'
import taskApi from '@/api/product/task'

const emit = defineEmits(['success'])

const formRef = ref()
const visible = ref(false)
const loading = ref(false)
const optionsLoading = ref(false)
const optionsError = ref('')
const doctorAccounts = ref([])

const initialFormData = {
  doctor_id: undefined,
  item_count: 10
}

const formData = reactive({ ...initialFormData })

const rules = {
  doctor_id: [{ required: true, message: '请选择要分配任务的医生' }],
  item_count: [
    { required: true, message: '请输入任务数量' },
    {
      validator: (value, callback) => {
        if (!Number.isInteger(value) || value < 1 || value > 1000) {
          callback('任务数量须为 1 至 1000 的整数')
          return
        }
        callback()
      }
    }
  ]
}

const maskPhone = (value) =>
  String(value || '').replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2') || '—'

const doctorOptionLabel = (doctor) => {
  const parts = [doctor.name, maskPhone(doctor.phone)]
  if (doctor.hospital && doctor.hospital !== '待补充') {
    parts.push(doctor.hospital)
  }
  if (doctor.department && doctor.department !== '待补充') {
    parts.push(doctor.department)
  }
  const label = parts.join(' · ')
  return doctor.account_status === 'disabled' ? `${label}（已禁用）` : label
}

const doctorOptions = computed(() =>
  doctorAccounts.value.map((doctor) => ({
    value: doctor.id,
    label: doctorOptionLabel(doctor),
    disabled: doctor.account_status === 'disabled'
  }))
)

const filterDoctorOption = (inputValue, option) => {
  const keyword = String(inputValue || '').trim().toLowerCase()
  if (!keyword) return true

  const doctor = doctorAccounts.value.find((item) => item.id === option.value)
  if (!doctor) return false

  return [doctor.name, doctor.phone, doctor.hospital, doctor.department]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(keyword))
}

const selectedDoctor = computed(
  () =>
    doctorAccounts.value.find((item) => item.id === formData.doctor_id) || null
)

const accountHint = computed(() => {
  if (!selectedDoctor.value) return null

  if (selectedDoctor.value.account_status === 'disabled') {
    return {
      type: 'error',
      text: `“${selectedDoctor.value.name}”账号已禁用，无法分配新任务，请先到医生管理开启账号或重新选择医生。`
    }
  }

  if (selectedDoctor.value.account_status === 'active') {
    return {
      type: 'success',
      text: `“${selectedDoctor.value.name}”账号已激活，任务创建后立即出现在其小程序任务列表中。`
    }
  }

  return {
    type: 'info',
    text: `“${selectedDoctor.value.name}”账号待激活，医生首次使用 ${maskPhone(
      selectedDoctor.value.phone
    )} 登录小程序后即可查看任务。`
  }
})

const totalReward = computed(() => {
  return `${Number(formData.item_count || 0) * 50} 积分`
})

const loadDoctorAccounts = async () => {
  if (optionsLoading.value) return

  optionsLoading.value = true
  optionsError.value = ''
  try {
    const response = await taskApi.getDoctorOptions()
    if (response.code === 200) {
      doctorAccounts.value = response.data || []
      optionsError.value = ''
    } else {
      optionsError.value = response.message || '医生列表加载失败，请重试'
    }
  } catch {
    optionsError.value = '医生列表加载失败，请检查网络后重试'
  } finally {
    optionsLoading.value = false
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
  if (errors) {
    done(false)
    return
  }

  if (selectedDoctor.value?.account_status === 'disabled') {
    Message.error('该医生账号已禁用，请重新选择医生')
    done(false)
    return
  }

  loading.value = true
  try {
    const response = await taskApi.save({
      doctor_id: formData.doctor_id,
      item_count: formData.item_count
    })

    if (response.code === 200) {
      Message.success('任务已创建并分配给所选医生')
      emit('success')
      done(true)
      return
    }

    if (response.code === 404) {
      formData.doctor_id = undefined
      loadDoctorAccounts()
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
.options-error {
  margin-bottom: 16px;
}

.account-hint {
  margin: -4px 0 16px;
}

.select-empty {
  padding: 12px 16px;
  color: var(--color-text-3);
  font-size: 12px;
  text-align: center;
}

.readonly-text {
  color: var(--color-text-2);
}

.total-reward {
  color: rgb(var(--primary-6));
  font-size: 16px;
}
</style>
