import { describe, expect, it } from 'vitest';
import { orderLinkUrl } from './OrderLinkPanel';

describe('sipariş linki', () => {
  it('kök adreste /siparis/<token> üretir (hash değilse)', () => {
    expect(orderLinkUrl('abc', 'https://trakya-catering.onrender.com', '/')).toBe('https://trakya-catering.onrender.com/siparis/abc');
  });
  it('alt klasörde tabanı korur', () => {
    expect(orderLinkUrl('abc', 'https://x.test', '/app/')).toBe('https://x.test/app/siparis/abc');
  });
});
