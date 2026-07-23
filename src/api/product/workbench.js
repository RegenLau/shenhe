import { request } from '@/utils/request.js'

export default {
  getOverview() {
    return request({
      url: '/core/product/workbench/overview',
      method: 'get'
    })
  }
}
