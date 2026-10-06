function html(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function formatDepositReturnedMessage(input: {
  contract: string;
  client: string;
  vehicle: string;
  collected: string;
  returned: string;
  withheld: string;
  reason?: string | null;
  at: string;
  actor: string;
  rentalId: string;
}) {
  return [
    '💳 <b>Залог по договору оформлен</b>',
    `🚗 ${html(input.vehicle)}`,
    `👤 ${html(input.client)}`,
    `📄 Договор: <code>${html(input.contract)}</code>`,
    `💰 Внесено: <b>${html(input.collected)}</b>`,
    `✅ Возвращено: <b>${html(input.returned)}</b>`,
    `🧾 Удержано: <b>${html(input.withheld)}</b>`,
    input.reason ? `📝 Причина: ${html(input.reason)}` : null,
    `🕒 Дата возврата: <b>${html(input.at)} (МСК)</b>`,
    `👨‍💼 Оформил: <b>${html(input.actor)}</b>`,
    `🔗 <a href="https://supapro.ru/rentals/${encodeURIComponent(input.rentalId)}">Открыть договор</a>`,
  ]
    .filter(Boolean)
    .join('\n');
}
