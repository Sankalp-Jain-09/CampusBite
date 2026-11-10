import { api, cleanParams, data } from './client';

export const restaurantsApi = {
  list: (params) => data(api.get('/restaurants', { params: cleanParams(params) })),
  get: (id) => data(api.get(`/restaurants/${id}`)),
  menu: (id, params) => data(api.get(`/restaurants/${id}/menu`, { params: cleanParams(params) })),
  categories: (id) => data(api.get(`/restaurants/${id}/categories`)),
  reviews: (id, params) => data(api.get(`/restaurants/${id}/reviews`, { params: cleanParams(params) })),
  menuItem: (id) => data(api.get(`/menu-items/${id}`)),
};
