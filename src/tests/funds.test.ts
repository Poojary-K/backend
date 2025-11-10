import request from 'supertest';
import { createApp } from '../app.js';

jest.mock('../services/fundService.js', () => ({
  getFundSummary: jest.fn(async () => ({
    totalcontributions: '100.00',
    totaldonations: '40.00',
    availablefunds: '60.00',
  })),
}));

describe('GET /api/funds/status', () => {
  it('returns 200 with fund summary', async () => {
    const app = createApp();
    const res = await request(app).get('/api/funds/status');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      totalcontributions: '100.00',
      totaldonations: '40.00',
      availablefunds: '60.00',
    });
  });
});

