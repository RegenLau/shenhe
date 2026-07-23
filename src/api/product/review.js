import { request } from '@/utils/request.js'

export default {
  getPageList(params = {}) {
    return request({
      url: '/core/product/review/index',
      method: 'get',
      params
    })
  },

  read(id) {
    return request({
      url: '/core/product/review/read',
      method: 'get',
      params: { id }
    })
  }
}
