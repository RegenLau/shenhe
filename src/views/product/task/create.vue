<template>
  <a-modal
    v-model:visible="visible"
    :width="tool.getDevice() === 'mobile' ? '100%' : '520px'"
    title="创建项目"
    ok-text="创建并分配项目"
    :mask-closable="false"
    :ok-loading="loading"
    unmount-on-close
    @before-ok="submit"
  >
    <a-alert v-if="optionsError" type="error" show-icon class="options-error">
      {{ optionsError }}
      <template #action>
        <a-button size="small" :loading="optionsLoading" @click="loadOptionsData">
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
      <a-form-item field="foundation_id" label="所属基金会">
        <a-select
          v-model="formData.foundation_id"
          :options="foundationOptions"
          :loading="optionsLoading"
          placeholder="请选择基金会"
          allow-search
          allow-clear
          @change="handleFoundationChange"
        >
          <template #empty>
            <div class="select-empty">
              {{
                optionsError
                  ? '基金会列表加载失败，请使用上方「重试」重新加载'
                  : '暂无可选基金会，请先到「组织管理」创建'
              }}
            </div>
          </template>
        </a-select>
      </a-form-item>

      <a-form-item field="project_id" label="所属项目">
        <a-select
          v-model="formData.project_id"
          :options="projectOptions"
          :disabled="!formData.foundation_id"
          :placeholder="formData.foundation_id ? '请选择项目' : '请先选择基金会'"
          allow-search
          allow-clear
          @change="handleProjectChange"
        >
          <template #empty>
            <div class="select-empty">
              {{
                formData.foundation_id
                  ? '该基金会下暂无项目，请先到「组织管理」创建'
                  : '请先选择基金会'
              }}
            </div>
          </template>
        </a-select>
      </a-form-item>

      <a-form-item field="identifier_id" label="项目标识">
        <a-select
          v-model="formData.identifier_id"
          :options="identifierOptions"
          :disabled="!formData.project_id"
          :placeholder="formData.project_id ? '请选择项目标识' : '请先选择项目'"
          allow-search
          allow-clear
        >
          <template #empty>
            <div class="select-empty">
              {{
                formData.project_id
                  ? '该项目下暂无项目标识，请先到「组织管理」创建'
                  : '请先选择项目'
              }}
            </div>
          </template>
        </a-select>
      </a-form-item>

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

      <a-form-item field="target_points" label="目标积分">
        <a-input-number
          v-model="formData.target_points"
          :min="100"
          :step="100"
          :precision="0"
          placeholder="请输入要分配的项目积分"
          style="width: 100%"
        >
          <template #suffix>积分</template>
        </a-input-number>
      </a-form-item>

      <a-form-item label="项目说明">
        <span class="readonly-text">
          系统将从题库中随机匹配 100 / 200 / 300 积分题目，精确组成目标积分
        </span>
      </a-form-item>

      <a-form-item label="本次目标">
        <strong class="total-reward">{{ formattedTargetPoints }}</strong>
      </a-form-item>
    </a-form>

    <a-alert type="info" show-icon>
      提交时会按题库实时库存完成精确匹配；库存不能组成目标积分时不会创建项目。项目创建后立即分配给所选医生。
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
const orgOptions = ref([])

const initialFormData = {
  foundation_id: undefined,
  project_id: undefined,
  identifier_id: undefined,
  doctor_id: undefined,
  target_points: 10000
}

const formData = reactive({ ...initialFormData })

const rules = {
  foundation_id: [{ required: true, message: '请选择所属基金会' }],
  project_id: [{ required: true, message: '请选择所属项目' }],
  identifier_id: [{ required: true, message: '请选择项目标识' }],
  doctor_id: [{ required: true, message: '请选择要分配项目的医生' }],
  target_points: [
    { required: true, message: '请输入目标积分' },
    {
      validator: (value, callback) => {
        if (
          !Number.isInteger(value) ||
          value < 100 ||
          value % 100 !== 0
        ) {
          callback('目标积分须为不小于 100 的整数，且为 100 的整数倍')
          return
        }
        callback()
      }
    }
  ]
}

const maskPhone = (value) =>
  String(value || '').replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2') || '—'

const reviewEligibilityError = (doctor) => {
  if (!doctor) return ''
  if (doctor.training_exam_status !== 'passed') return '尚未通过审核培训与考试'
  if (!['A', 'B', 'C'].includes(doctor.max_review_level)) return '审核档位资格未配置'
  return ''
}

const doctorOptionLabel = (doctor) => {
  const parts = [doctor.name, maskPhone(doctor.phone)]
  if (doctor.hospital && doctor.hospital !== '待补充') {
    parts.push(doctor.hospital)
  }
  if (doctor.department && doctor.department !== '待补充') {
    parts.push(doctor.department)
  }
  const label = parts.join(' · ')
  if (doctor.account_status === 'disabled') return `${label}（已禁用）`
  const eligibilityError = reviewEligibilityError(doctor)
  return eligibilityError ? `${label}（${eligibilityError}）` : label
}

const doctorOptions = computed(() =>
  doctorAccounts.value.map((doctor) => ({
    value: doctor.id,
    label: doctorOptionLabel(doctor),
    disabled:
      doctor.account_status === 'disabled' || Boolean(reviewEligibilityError(doctor))
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

const orgOptionLabel = (item) =>
  item.status === '2' ? `${item.name}（已停用）` : item.name

const foundationOptions = computed(() =>
  orgOptions.value.map((foundation) => ({
    value: foundation.id,
    label: orgOptionLabel(foundation),
    disabled: foundation.status === '2'
  }))
)

const selectedFoundation = computed(
  () =>
    orgOptions.value.find((item) => item.id === formData.foundation_id) || null
)

const projectOptions = computed(() =>
  (selectedFoundation.value?.projects || []).map((project) => ({
    value: project.id,
    label: orgOptionLabel(project),
    disabled: project.status === '2'
  }))
)

const selectedProject = computed(
  () =>
    selectedFoundation.value?.projects.find(
      (item) => item.id === formData.project_id
    ) || null
)

const identifierOptions = computed(() =>
  (selectedProject.value?.identifiers || []).map((identifier) => ({
    value: identifier.id,
    label: orgOptionLabel(identifier),
    disabled: identifier.status === '2'
  }))
)

const handleFoundationChange = () => {
  formData.project_id = undefined
  formData.identifier_id = undefined
}

const handleProjectChange = () => {
  formData.identifier_id = undefined
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
      text: `“${selectedDoctor.value.name}”账号已禁用，无法分配新项目，请先到医生管理开启账号或重新选择医生。`
    }
  }

  const eligibilityError = reviewEligibilityError(selectedDoctor.value)
  if (eligibilityError) {
    return {
      type: 'error',
      text: `“${selectedDoctor.value.name}”${eligibilityError}，无法分配审核项目。`
    }
  }

  if (selectedDoctor.value.account_status === 'active') {
    return {
      type: 'success',
      text: `“${selectedDoctor.value.name}”账号已激活，项目创建后立即出现在其小程序项目列表中。`
    }
  }

  return {
    type: 'info',
    text: `“${selectedDoctor.value.name}”账号待激活，医生首次使用 ${maskPhone(
      selectedDoctor.value.phone
    )} 登录小程序后即可查看项目。`
  }
})

const formattedTargetPoints = computed(
  () => `${Number(formData.target_points || 0).toLocaleString('zh-CN')} 积分`
)

const loadOptionsData = async () => {
  if (optionsLoading.value) return

  optionsLoading.value = true
  optionsError.value = ''
  const [doctorResult, orgResult] = await Promise.allSettled([
    taskApi.getDoctorOptions(),
    taskApi.getOrgOptions()
  ])
  const doctorResponse = doctorResult.status === 'fulfilled' ? doctorResult.value : null
  const orgResponse = orgResult.status === 'fulfilled' ? orgResult.value : null

  if (doctorResponse?.code === 200) {
    doctorAccounts.value = doctorResponse.data || []
  }
  if (orgResponse?.code === 200) {
    orgOptions.value = orgResponse.data || []
  }

  if (!doctorResponse || doctorResponse.code !== 200) {
    optionsError.value =
      doctorResponse?.message || '医生列表加载失败，请检查网络后重试'
  } else if (!orgResponse || orgResponse.code !== 200) {
    optionsError.value =
      orgResponse?.message || '基金会与项目信息加载失败，请检查网络后重试'
  }

  optionsLoading.value = false
}

const open = async () => {
  Object.assign(formData, initialFormData)
  visible.value = true
  await nextTick()
  formRef.value?.clearValidate()
  await loadOptionsData()
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

  const eligibilityError = reviewEligibilityError(selectedDoctor.value)
  if (eligibilityError) {
    Message.error(eligibilityError)
    done(false)
    return
  }

  loading.value = true
  try {
    const response = await taskApi.save({
      foundation_id: formData.foundation_id,
      project_id: formData.project_id,
      identifier_id: formData.identifier_id,
      doctor_id: formData.doctor_id,
      target_points: formData.target_points
    })

    if (response.code === 200) {
      const matchedCount = Number(response.data?.item_count || 0)
      Message.success(
        matchedCount
          ? `项目已创建，系统已匹配 ${matchedCount} 道题目`
          : '项目已创建并分配给所选医生'
      )
      emit('success')
      done(true)
      return
    }

    if (response.code === 404) {
      formData.doctor_id = undefined
      formData.foundation_id = undefined
      formData.project_id = undefined
      formData.identifier_id = undefined
      loadOptionsData()
    }
  } catch {
    Message.error('项目创建失败，请检查网络后重试')
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
