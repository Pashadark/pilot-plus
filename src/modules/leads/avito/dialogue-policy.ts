export type DialogueClock = {
  lastCustomerAt: string | null;
  lastHumanAt: string | null;
  waitingSince: string | null;
  episode: string | null;
  remindedEpisode: string | null;
  paused: boolean;
};
export function emptyDialogue(): DialogueClock {
  return {
    lastCustomerAt: null,
    lastHumanAt: null,
    waitingSince: null,
    episode: null,
    remindedEpisode: null,
    paused: false,
  };
}
export function advanceDialogue(
  state: DialogueClock,
  event: { kind: 'customer' | 'human' | 'assistant'; at: string; id: string },
): DialogueClock {
  const at = Date.parse(event.at);
  if (!Number.isFinite(at) || event.kind === 'assistant') return state;
  const lastCustomer = state.lastCustomerAt ? Date.parse(state.lastCustomerAt) : -Infinity;
  const lastHuman = state.lastHumanAt ? Date.parse(state.lastHumanAt) : -Infinity;
  if (event.kind === 'human') {
    if (at < lastHuman) return state;
    return {
      ...state,
      lastHumanAt: event.at,
      paused: true,
      ...(at >= lastCustomer ? { waitingSince: null, episode: null } : {}),
    };
  }
  if (at <= lastHuman || at < lastCustomer) return state;
  return {
    ...state,
    lastCustomerAt: event.at,
    waitingSince: state.waitingSince ?? event.at,
    episode: state.episode ?? event.id,
  };
}
export function reminderDue(state: DialogueClock, now: Date) {
  return Boolean(
    state.episode &&
    state.waitingSince &&
    state.remindedEpisode !== state.episode &&
    now.getTime() - Date.parse(state.waitingSince) >= 15 * 60000,
  );
}
