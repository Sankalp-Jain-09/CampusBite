import { api, data } from './client';

export const aiApi = {
  insights: (question) => data(api.post('/ai/insights', question ? { question } : {})),
};
