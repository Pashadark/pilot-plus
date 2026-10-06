import { renderToStaticMarkup } from 'react-dom/server';
import { it, expect } from 'vitest';
import { FinePaymentQr } from './FinePaymentQr';
it('renders an accessible QR and the same provider URL without remote image services', () => {
  const html = renderToStaticMarkup(<FinePaymentQr url="https://driver-helper.ru/pay/test" />);
  expect(html).toContain('<svg');
  expect(html).toContain('Открыть страницу оплаты');
  expect(html).toContain('href="https://driver-helper.ru/pay/test"');
  expect(html).not.toContain('<img');
});
