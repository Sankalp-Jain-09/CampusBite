import { api, cleanParams, data } from './client';

export const deliveryApi = {
  active: (params) => data(api.get('/delivery/orders', { params: cleanParams(params) })),
  get: (id) => data(api.get(`/delivery/orders/${id}`)),
  setStatus: (id, status) => data(api.patch(`/delivery/orders/${id}/status`, { status })),
  history: (params) => data(api.get('/delivery/history', { params: cleanParams(params) })),
};
