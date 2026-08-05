import { request } from '@/utils/request.js'

export default {
  getPageList(params = {}) {
    return request({
      url: '/core/product/task/index',
      method: 'get',
      params
    })
  },

  read(id) {
    return request({
      url: '/core/product/task/read',
      method: 'get',
      params: { id }
    })
  },

  getDoctorOptions() {
    return request({
      url: '/core/product/task/doctorOptions',
      method: 'get'
    })
  },

  save(data = {}) {
    return request({
      url: '/core/product/task/save',
      method: 'post',
      data
    })
  },

  previewImport(data = {}) {
    return request({
      url: '/core/product/task/importPreview',
      method: 'post',
      data
    })
  },

  confirmImport(previewToken) {
    return request({
      url: '/core/product/task/importConfirm',
      method: 'post',
      data: { preview_token: previewToken }
    })
  },

  downloadTemplate() {
    return request({
      url: '/core/product/task/template',
      method: 'get',
      responseType: 'blob'
    })
  }
}
