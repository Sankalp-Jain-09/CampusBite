import { api, data } from './client';

export const authApi = {
  login: (email, password) => data(api.post('/auth/login', { email, password })),
  registerCustomer: (payload) => data(api.post('/auth/register', payload)),
  registerOwner: (payload) => data(api.post('/auth/register/restaurant-owner', payload)),
  registerDeliveryPartner: (payload) => data(api.post('/auth/register/delivery-partner', payload)),
  me: () => data(api.get('/auth/me')),
};
