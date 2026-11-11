import { api, cleanParams, data } from './client';

export const ownerApi = {
  restaurant: () => data(api.get('/owner/restaurant')),
  updateRestaurant: (payload) => data(api.put('/owner/restaurant', payload)),
  uploadRestaurantImage: (file) => {
    const form = new FormData();
    form.append('file', file);
    return data(api.put('/owner/restaurant/image', form));
  },

  menu: (params) => data(api.get('/owner/menu-items', { params: cleanParams(params) })),
  createDish: (payload) => data(api.post('/owner/menu-items', payload)),
  updateDish: (id, payload) => data(api.put(`/owner/menu-items/${id}`, payload)),
  setAvailability: (id, isAvailable) => data(api.patch(`/owner/menu-items/${id}/availability`, { is_available: isAvailable })),
  deleteDish: (id) => data(api.delete(`/owner/menu-items/${id}`)),

  orders: (params) => data(api.get('/owner/orders', { params: cleanParams(params) })),
  setStatus: (id, status) => data(api.patch(`/owner/orders/${id}/status`, { status })),
  deliveryPartners: () => data(api.get('/owner/delivery-partners')),
  assign: (id, partnerId) => data(api.post(`/owner/orders/${id}/assign`, { delivery_partner_id: partnerId })),

  stats: (params) => data(api.get('/owner/stats', { params: cleanParams(params) })),
  reminders: (params) => data(api.get('/owner/reminders', { params: cleanParams(params) })),
  acknowledgeReminder: (id) => data(api.patch(`/owner/reminders/${id}/acknowledge`)),

  returns: (params) => data(api.get('/owner/returns', { params: cleanParams(params) })),
  approveReturn: (id) => data(api.post(`/owner/returns/${id}/approve`)),
  rejectReturn: (id, note) => data(api.post(`/owner/returns/${id}/reject`, { owner_note: note })),
};
