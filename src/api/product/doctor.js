import { request } from '@/utils/request.js'

export default {
  getPageList(params = {}) {
    return request({
      url: '/core/product/doctor/index',
      method: 'get',
      params
    })
  },

  read(id) {
    return request({
      url: '/core/product/doctor/read',
      method: 'get',
      params: { id }
    })
  },

  changeAccountStatus(data = {}) {
    return request({
      url: '/core/product/doctor/status',
      method: 'post',
      data
    })
  },

  exportPendingActivation() {
    return request({
      url: '/core/product/doctor/exportPendingActivation',
      method: 'post',
      data: {},
      responseType: 'blob'
    })
  }
}
