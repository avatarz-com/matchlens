// Seeded synthetic scenes, never derived from a real club, player, match or footage.
function random(seed) { let s = seed >>> 0; return () => { s = (1664525 * s + 1013904223) >>> 0; return s / 4294967296; }; }
export function makeFixture(scenario = 'blocked', seed = 42) {
  if (!['open', 'blocked', 'missing', 'delayed'].includes(scenario)) throw new Error('Unknown scenario');
  const rand = random(seed);
  const players = ['A', 'B'].flatMap(teamId => Array.from({ length: 11 }, (_, i) => ({ id: `${teamId}${i + 1}`, teamId, name: `${teamId === 'A' ? 'Azur' : 'Corail'} ${i + 1}` })));
  const base = Object.fromEntries(players.map((p, i) => [p.id, { x: p.teamId === 'A' ? 8 + (i % 7) * 4 : 77 + (i % 5) * 5, y: 4 + (i % 10) * 6 + rand() * 0.3 }]));
  Object.assign(base, { A1: { x: 40, y: 34 }, A2: { x: 60, y: 20 }, A3: { x: 66, y: 44 }, A4: { x: 32, y: 53 }, B1: scenario === 'open' ? { x: 80, y: 60 } : { x: 53, y: 39 }, B2: { x: 39, y: 38 } });
  const blocked = scenario !== 'open';
  const targetId = blocked ? 'A3' : 'A2', target = base[targetId];
  const frames = Array.from({ length: 25 }, (_, i) => {
    const tMs = i * 500, positions = structuredClone(base);
    if (scenario === 'missing' && tMs >= 5500 && tMs <= 6500) delete positions.B1;
    const k = Math.max(0, Math.min(1, (tMs - 6100) / 900));
    const flightTarget = blocked ? base.B1 : target;
    const ball = { x: 40 + k * (flightTarget.x - 40), y: 34 + k * (flightTarget.y - 34) };
    return { id: `f-${tMs}`, tMs, availableAtMs: tMs, positions, ball };
  });
  const delayed = scenario === 'delayed' ? 1000 : 0;
  const events = [
    { id: 'control-start', type: 'control', tMs: 0, availableAtMs: 0, teamId: 'A', playerId: 'A1' },
    { id: 'neutral-start', type: 'neutral', tMs: 3000, availableAtMs: 3000, reason: 'contested' },
    { id: 'control-resumed', type: 'control', tMs: 4000, availableAtMs: 4000, teamId: 'A', playerId: 'A1' },
    { id: 'pass-1', type: 'pass_start', tMs: 6100, availableAtMs: 6100, teamId: 'A', playerId: 'A1', receiverId: targetId, from: base.A1, target },
    { id: 'resolution-1', type: 'pass_end', tMs: 7000, availableAtMs: 7000 + delayed, passId: 'pass-1', outcome: blocked ? 'intercepted' : 'completed', position: blocked ? base.B1 : target },
    { id: 'control-next', type: 'control', tMs: 7001, availableAtMs: 7001 + delayed, teamId: blocked ? 'B' : 'A', playerId: blocked ? 'B1' : targetId }
  ];
  return { schemaVersion: '1.0', id: `synthetic-${scenario}-${seed}`, title: { open: 'Passe dégagée', blocked: 'Corridor occupé', missing: 'Positions manquantes', delayed: 'Résolution retardée' }[scenario], seed, durationMs: 12000, pitch: { lengthM: 105, widthM: 68, axes: 'x right, y down', unit: 'm' }, teams: [{ id: 'A', name: 'Azur', attackDirection: 1 }, { id: 'B', name: 'Corail', attackDirection: -1 }], players, frames, events,
    decisions: [{ id: 'decision-1', tMs: 6000, actorId: 'A1', label: 'Quelle option privilégier ?', video: { assetId: null, mediaTimeMs: 6000, originalOnly: true } }],
    sync: { clock: 'match-relative-ms', videoOffsetMs: 0, playbackRate: 1, layers: ['trajectories', 'pressure', 'options', 'pov'], pov: { status: 'planned', target: 'selected-receiver', source: 'synthetic-scene', authenticCamera: false } },
    limitations: ['Scripted toy sequence with 22 fictional players; not calibrated to professional match distributions.', 'Players stationary in this sprint; synthetic ball movement only.', 'Intended target distance is not observed ball flight distance.'] };
}
