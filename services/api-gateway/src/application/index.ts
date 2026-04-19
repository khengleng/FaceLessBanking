export type ApplicationLayer = {
  ready: true;
};

export function createApplicationLayer(): ApplicationLayer {
  return { ready: true };
}
