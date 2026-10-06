export async function relayLead(payload, env = process.env, send = fetch) {
  const endpoint = env.TGCAR_LEAD_URL,
    secret = env.TGCAR_LEAD_SECRET;
  if (!endpoint || !secret || secret.length < 32)
    throw new Error('Приём заявок ещё не подключён. Заявка не отправлена.');
  const url = new URL(endpoint);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !(
      url.protocol === 'https:' ||
      (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    )
  )
    throw new Error('Неверная настройка связи с системой.');
  const response = await send(endpoint, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + secret },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = new Error(
      response.status === 429
        ? 'Слишком много заявок. Попробуйте позже.'
        : response.status === 400
          ? 'Проверьте российский номер телефона, имя и даты.'
          : response.status === 409
            ? 'Данные попытки изменились. Обновите форму.'
            : 'Система не подтвердила сохранение. Повторите отправку — дубликат не создастся.',
    );
    error.status = [400, 409, 429].includes(response.status) ? response.status : 503;
    throw error;
  }
  const data = await response.json();
  if (!/^tgcar_[a-f0-9]{40}$/.test(data.id || '') || data.status !== 'NEW')
    throw new Error('Система не подтвердила сохранение заявки.');
  return { id: data.id, status: 'NEW' };
}
