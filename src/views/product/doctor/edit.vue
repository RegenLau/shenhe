<template>
  <a-modal
    v-model:visible="visible"
    :width="tool.getDevice() === 'mobile' ? '100%' : '520px'"
    title="新增医生"
    :mask-closable="false"
    :ok-loading="loading"
    ok-text="创建账号"
    unmount-on-close
    @before-ok="submit"
  >
    <a-alert type="info" class="create-tip">
      创建后账号为「待激活」，医生使用该手机号登录小程序即可激活；执业信息可留空，由医生注册时自行完善。
    </a-alert>

    <a-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      :auto-label-width="true"
      scroll-to-first-error
    >
      <a-form-item field="name" label="医生姓名">
        <a-input
          v-model="formData.name"
          placeholder="请输入医生姓名"
          :max-length="30"
          allow-clear
        />
      </a-form-item>

      <a-form-item field="phone" label="手机号">
        <a-input
          v-model="formData.phone"
          placeholder="医生登录小程序的手机号"
          :max-length="11"
          allow-clear
        />
      </a-form-item>

      <a-form-item field="gender" label="性别">
        <sa-radio v-model="formData.gender" dict="doctor_gender" />
      </a-form-item>

      <a-form-item field="hospital" label="医院名称">
        <a-select
          v-model="formData.hospital"
          :options="configOptions.hospital"
          :loading="optionsLoading"
          placeholder="选填，可搜索或直接输入"
          allow-search
          allow-create
          allow-clear
        />
      </a-form-item>

      <a-form-item field="department" label="科室">
        <a-select
          v-model="formData.department"
          :options="configOptions.department"
          :loading="optionsLoading"
          placeholder="选填，可搜索或直接输入"
          allow-search
          allow-create
          allow-clear
        />
      </a-form-item>

      <a-form-item field="title" label="职称">
        <a-select
          v-model="formData.title"
          :options="configOptions.position"
          :loading="optionsLoading"
          placeholder="选填，可搜索或直接输入"
          allow-search
          allow-create
          allow-clear
        />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup>
import { nextTick, reactive, ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import tool from '@/utils/tool'
import doctorApi from '@/api/product/doctor'
import doctorConfigApi from '@/api/product/doctor-config'

const emit = defineEmits(['success'])
const formRef = ref()
const visible = ref(false)
const loading = ref(false)
const optionsLoading = ref(false)
const optionsLoaded = ref(false)

const initialFormData = {
  name: '',
  phone: '',
  gender: '',
  hospital: '',
  department: '',
  title: ''
}

const formData = reactive({ ...initialFormData })
const configOptions = reactive({ hospital: [], department: [], position: [] })

const rules = {
  name: [
    { required: true, message: '请输入医生姓名' },
    { maxLength: 30, message: '医生姓名不能超过 30 个字符' }
  ],
  phone: [
    { required: true, message: '请输入手机号' },
    { match: /^1[3-9]\d{9}$/, message: '请输入 11 位有效手机号' }
  ],
  gender: [{ required: true, message: '请选择性别' }],
  hospital: [{ maxLength: 80, message: '医院名称不能超过 80 个字符' }],
  department: [{ maxLength: 80, message: '科室不能超过 80 个字符' }],
  title: [{ maxLength: 80, message: '职称不能超过 80 个字符' }]
}

const loadConfigOptions = async () => {
  if (optionsLoaded.value || optionsLoading.value) return

  optionsLoading.value = true
  try {
    const responses = await Promise.all(
      ['hospital', 'department', 'position'].map((type) =>
        doctorConfigApi.getPageList({ type, status: '1', page: 1, limit: 200 })
      )
    )

    responses.forEach((response, index) => {
      const type = ['hospital', 'department', 'position'][index]
      if (response.code === 200) {
        configOptions[type] = (response.data?.data || []).map((item) => ({
          label: item.name,
          value: item.name
        }))
      }
    })
    optionsLoaded.value = responses.every((response) => response.code === 200)
  } catch {
    // 选项加载失败不阻塞创建，字段仍可直接输入
  } finally {
    optionsLoading.value = false
  }
}

const open = async () => {
  Object.assign(formData, initialFormData)
  visible.value = true
  loadConfigOptions()
  await nextTick()
  formRef.value?.clearValidate()
}

const submit = async (done) => {
  const errors = await formRef.value?.validate()
  if (errors) {
    done(false)
    return
  }

  loading.value = true
  try {
    const response = await doctorApi.save({ ...formData })
    if (response.code !== 200) {
      done(false)
      return
    }

    Message.success(response.message || '医生账号已创建')
    emit('success')
    done(true)
  } catch {
    done(false)
  } finally {
    loading.value = false
  }
}

defineExpose({ open })
</script>

<style scoped lang="less">
.create-tip {
  margin-bottom: 16px;
}
</style>
