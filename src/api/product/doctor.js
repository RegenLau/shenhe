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
  }
}
