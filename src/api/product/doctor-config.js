import { request } from '@/utils/request.js'

export default {
  getPageList(params = {}) {
    return request({
      url: '/core/product/doctor-config/index',
      method: 'get',
      params
    })
  },

  save(data = {}) {
    return request({
      url: '/core/product/doctor-config/save',
      method: 'post',
      data
    })
  },

  update(id, data = {}) {
    return request({
      url: '/core/product/doctor-config/update',
      method: 'put',
      params: { id },
      data
    })
  },

  destroy(data = {}) {
    return request({
      url: '/core/product/doctor-config/destroy',
      method: 'delete',
      data
    })
  },

  changeStatus(data = {}) {
    return request({
      url: '/core/product/doctor-config/changeStatus',
      method: 'post',
      data
    })
  }
}
