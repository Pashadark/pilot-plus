import { GlonassSoftClient, type GlonassSoftClientOptions } from './client.server';

type ClientConfiguration = Pick<GlonassSoftClientOptions, 'baseUrl' | 'username' | 'password'>;

interface ClientRegistry<TClient> {
  get(companyId: string, configuration: ClientConfiguration): TClient;
}

export function createGlonassSoftClientRegistry<TClient = GlonassSoftClient>(
  createClient: (configuration: ClientConfiguration) => TClient = (configuration) =>
    new GlonassSoftClient(configuration) as TClient,
): ClientRegistry<TClient> {
  const clients = new Map<string, { fingerprint: string; client: TClient }>();

  return {
    get(companyId, configuration) {
      const fingerprint = JSON.stringify(configuration);
      const existing = clients.get(companyId);
      if (existing?.fingerprint === fingerprint) return existing.client;
      const client = createClient(configuration);
      clients.set(companyId, { fingerprint, client });
      return client;
    },
  };
}
