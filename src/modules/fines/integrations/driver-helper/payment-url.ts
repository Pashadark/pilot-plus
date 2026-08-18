const DRIVER_HELPER_PAYMENT_HOSTS = new Set([
  'driver-helper.ru',
  'www.driver-helper.ru',
  'pay.driver-helper.ru',
  'payment.driver-helper.ru',
]);

export interface ValidatedDriverHelperPaymentUrl {
  paymentUrl: string;
  paymentHost: string;
}

export function validateDriverHelperPaymentUrl(
  value: string,
): ValidatedDriverHelperPaymentUrl | null {
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash ||
      !DRIVER_HELPER_PAYMENT_HOSTS.has(url.hostname)
    ) {
      return null;
    }
    return { paymentUrl: url.toString(), paymentHost: url.hostname };
  } catch {
    return null;
  }
}
