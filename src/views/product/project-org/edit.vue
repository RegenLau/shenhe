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
      <a-form-item
        v-if="formData.type === 'project'"
        label="所属基金会"
      >
        <span class="parent-name">{{ formData.foundation_name }}</span>
      </a-form-item>

      <a-form-item
        v-if="formData.type === 'identifier'"
        label="所属项目"
      >
        <span class="parent-name">{{ formData.project_name }}</span>
      </a-form-item>

      <a-form-item field="name" :label="`${typeLabel}名称`">
        <a-input
          v-model="formData.name"
          :placeholder="`请输入${typeLabel}名称`"
          :max-length="80"
          show-word-limit
          allow-clear
        />
      </a-form-item>

      <a-form-item field="code" :label="`${typeLabel}编码`">
        <a-input
          v-model="formData.code"
          placeholder="选填，同一上级下不能重复"
          :max-length="40"
          show-word-limit
          allow-clear
        />
      </a-form-item>

      <a-form-item field="status" label="状态">
        <sa-radio v-model="formData.status" dict="data_status" />
      </a-form-item>

      <a-form-item field="remark" label="备注">
        <a-textarea
          v-model="formData.remark"
          placeholder="选填，用于记录说明信息"
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
import api from '@/api/product/project-org'

const emit = defineEmits(['success'])
const formRef = ref()
const mode = ref('add')
const visible = ref(false)
const loading = ref(false)

const typeLabels = {
  foundation: '基金会',
  project: '项目',
  identifier: '项目标识'
}

const initialFormData = {
  id: undefined,
  type: 'foundation',
  name: '',
  code: '',
  status: '1',
  remark: '',
  foundation_id: undefined,
  project_id: undefined,
  foundation_name: '',
  project_name: ''
}

const formData = reactive({ ...initialFormData })
const typeLabel = computed(() => typeLabels[formData.type] || '数据')
const title = computed(() =>
  mode.value === 'add' ? `新建${typeLabel.value}` : `编辑${typeLabel.value}`
)
const rules = computed(() => ({
  name: [
    { required: true, message: `请输入${typeLabel.value}名称` },
    { maxLength: 80, message: `${typeLabel.value}名称不能超过 80 个字符` }
  ],
  code: [{ maxLength: 40, message: `${typeLabel.value}编码不能超过 40 个字符` }],
  status: [{ required: true, message: '请选择状态' }],
  remark: [{ maxLength: 200, message: '备注不能超过 200 个字符' }]
}))

const open = async (openMode = 'add', type = 'foundation', parent = null, record = null) => {
  mode.value = openMode
  Object.assign(formData, initialFormData, { type })

  if (parent?.foundation) {
    formData.foundation_id = parent.foundation.id
    formData.foundation_name = parent.foundation.name
  }
  if (parent?.project) {
    formData.project_id = parent.project.id
    formData.project_name = parent.project.name
  }

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
    const payload = {
      type: formData.type,
      name: formData.name,
      code: formData.code,
      status: formData.status,
      remark: formData.remark
    }
    if (formData.type === 'project') {
      payload.foundation_id = formData.foundation_id
    }
    if (formData.type === 'identifier') {
      payload.project_id = formData.project_id
    }

    const response =
      mode.value === 'add'
        ? await api.save(payload)
        : await api.update(formData.id, payload)

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

<style scoped lang="less">
.parent-name {
  color: var(--color-text-2);
}
</style>
