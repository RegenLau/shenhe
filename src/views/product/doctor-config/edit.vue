<template>
  <a-modal
    v-model:visible="visible"
    :width="tool.getDevice() === 'mobile' ? '100%' : '520px'"
    :title="title"
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
      <a-form-item field="name" :label="`${typeLabel}名称`">
        <a-input
          v-model="formData.name"
          :placeholder="`请输入${typeLabel}名称`"
          :max-length="80"
          show-word-limit
          allow-clear
        />
      </a-form-item>

      <template v-if="formData.type === 'hospital'">
        <a-form-item field="region" label="所在地区">
          <a-input
            v-model="formData.region"
            placeholder="例如：北京市"
            :max-length="50"
            allow-clear
          />
        </a-form-item>
        <a-form-item field="level" label="医院等级">
          <a-input
            v-model="formData.level"
            placeholder="例如：三级甲等"
            :max-length="30"
            allow-clear
          />
        </a-form-item>
      </template>

      <a-form-item field="sort" label="显示顺序">
        <a-input-number
          v-model="formData.sort"
          :min="0"
          :max="9999"
          placeholder="数字越小越靠前"
          style="width: 100%"
        />
      </a-form-item>

      <a-form-item field="status" label="状态">
        <sa-radio v-model="formData.status" dict="data_status" />
      </a-form-item>

      <a-form-item field="remark" label="备注">
        <a-textarea
          v-model="formData.remark"
          placeholder="选填，用于记录配置说明"
          :max-length="200"
          show-word-limit
          :auto-size="{ minRows: 3, maxRows: 5 }"
        />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup>
import { computed, nextTick, reactive, ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import tool from '@/utils/tool'
import doctorConfigApi from '@/api/product/doctor-config'

const emit = defineEmits(['success'])
const formRef = ref()
const mode = ref('add')
const visible = ref(false)
const loading = ref(false)

const typeLabels = {
  hospital: '医院',
  department: '科室',
  position: '职称'
}

const initialFormData = {
  id: undefined,
  type: 'hospital',
  name: '',
  region: '',
  level: '',
  sort: 0,
  status: '1',
  remark: ''
}

const formData = reactive({ ...initialFormData })
const typeLabel = computed(() => typeLabels[formData.type] || '配置')
const title = computed(() =>
  mode.value === 'add'
    ? `新增${typeLabel.value}`
    : `编辑${typeLabel.value}`
)
const rules = computed(() => ({
  name: [
    { required: true, message: `请输入${typeLabel.value}名称` },
    { maxLength: 80, message: `${typeLabel.value}名称不能超过 80 个字符` }
  ],
  region: [{ maxLength: 50, message: '所在地区不能超过 50 个字符' }],
  level: [{ maxLength: 30, message: '医院等级不能超过 30 个字符' }],
  sort: [{ required: true, message: '请输入显示顺序' }],
  status: [{ required: true, message: '请选择状态' }],
  remark: [{ maxLength: 200, message: '备注不能超过 200 个字符' }]
}))

const open = async (openMode = 'add', type = 'hospital', record = null) => {
  mode.value = openMode
  Object.assign(formData, initialFormData, { type })

  if (record) {
    Object.keys(initialFormData).forEach((key) => {
      if (record[key] !== undefined && record[key] !== null) {
        formData[key] = record[key]
      }
    })
  }

  visible.value = true
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
    const payload = { ...formData }
    const response =
      mode.value === 'add'
        ? await doctorConfigApi.save({ ...payload, id: undefined })
        : await doctorConfigApi.update(payload.id, payload)

    if (response.code !== 200) {
      done(false)
      return
    }

    Message.success(
      mode.value === 'add'
        ? `${typeLabel.value}新增成功`
        : `${typeLabel.value}保存成功`
    )
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
