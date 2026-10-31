import { simulate } from './run';
self.onmessage = (e) => {
  const { configs, seeds, profiles, budget } = e.data;
  try {
    for (const config of configs)
      for (const seed of seeds)
        for (let rotation = 0; rotation < profiles.length; rotation++) {
          const row = simulate(config, seed, profiles, rotation, budget, 15000, (progress) =>
            self.postMessage({ progress }),
          );
          self.postMessage({ row });
        }
    self.postMessage({ done: true });
  } catch (error) {
    self.postMessage({ error: String(error) });
  }
};
