jest.unmock('../security');

describe('security', () => {
  it('stringSha256Sync', () => {
    const security = require('../security');
    expect(security.stringSha256Sync('hello world!'))
    .toBe('7509e5bda0c762d2bac7f90d758b5b2263fa01ccbc542ab5e3df163be08e6ca9');
  });
});
