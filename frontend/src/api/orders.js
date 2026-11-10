import { api, cleanParams, data } from './client';

export const ordersApi = {
  place: (payload) => data(api.post('/orders', payload)),
  mine: (params) => data(api.get('/orders/me', { params: cleanParams(params) })),
  get: (id) => data(api.get(`/orders/${id}`)),
  cancel: (id) => data(api.post(`/orders/${id}/cancel`)),
  review: (id, payload) => data(api.post(`/orders/${id}/review`, payload)),
  requestReturn: (id, reason) => data(api.post(`/orders/${id}/return`, { reason })),
};
