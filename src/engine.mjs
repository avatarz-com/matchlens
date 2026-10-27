// Pure, dependency-free engine. Metres, milliseconds, pitch coordinates only.
export const RULES = Object.freeze({ maxFrameAgeMs: 1500, pressureRadiusM: 5, laneRadiusM: 2 });
const finite = Number.isFinite;
const pointOK = (p, pitch) => p && finite(p.x) && finite(p.y) && p.x >= 0 && p.x <= pitch.lengthM && p.y >= 0 && p.y <= pitch.widthM;
export const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
export function segmentDistance(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, length2 = dx * dx + dy * dy;
  const fraction = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length2));
  return { distanceM: distance(p, { x: a.x + fraction * dx, y: a.y + fraction * dy }), fraction };
}
const sorted = xs => [...xs].sort((a, b) => a.tMs - b.tMs || a.id.localeCompare(b.id));
export function validateDataset(data) {
  const fail = message => { throw new Error(message); };
  if (data.schemaVersion !== '1.0' || !data.pitch || !finite(data.pitch.lengthM) || !finite(data.pitch.widthM) || !(data.pitch.lengthM > 0) || !(data.pitch.widthM > 0) || data.pitch.unit !== 'm') fail('Invalid schema or pitch (metres required)');
  if (!finite(data.durationMs) || data.durationMs <= 0) fail('Invalid durationMs');
  if (!Array.isArray(data.teams) || data.teams.length !== 2 || new Set(data.teams.map(t => t.id)).size !== 2 || data.teams.some(t => ![1, -1].includes(t.attackDirection))) fail('Two distinct teams with attackDirection ±1 required');
  const teams = new Set(data.teams.map(t => t.id));
  if (!Array.isArray(data.players) || !data.players.length || data.players.some(p => !p.id || !teams.has(p.teamId)) || new Set(data.players.map(p => p.id)).size !== data.players.length) fail('Invalid players');
  const players = new Map(data.players.map(p => [p.id, p]));
  if (!Array.isArray(data.frames) || !Array.isArray(data.events)) fail('frames/events required');
  for (const [kind, rows] of [['frame', data.frames], ['event', data.events]]) {
    const ids = new Set();
    for (const row of rows) {
      if (typeof row.id !== 'string' || !row.id || ids.has(row.id)) fail(`Duplicate or missing ${kind} id`);
      ids.add(row.id);
      if (!finite(row.tMs) || row.tMs < 0 || row.tMs > data.durationMs || !finite(row.availableAtMs) || row.availableAtMs < row.tMs) fail(`Invalid chronology: ${row.id}`);
      if (kind === 'frame') {
        if (!row.positions || typeof row.positions !== 'object') fail(`Missing positions: ${row.id}`);
        for (const [id, pos] of Object.entries(row.positions)) if (!players.has(id) || !pointOK(pos, data.pitch)) fail(`Invalid position: ${row.id}/${id}`);
        if (row.ball && !pointOK(row.ball, data.pitch)) fail(`Invalid ball: ${row.id}`);
      } else {
        if (!['control', 'neutral', 'pass_start', 'pass_end'].includes(row.type)) fail(`Unknown event: ${row.id}`);
        if (row.type === 'control' && (!players.has(row.playerId) || players.get(row.playerId).teamId !== row.teamId)) fail(`Invalid controller: ${row.id}`);
        if (row.type === 'pass_start' && (!players.has(row.playerId) || players.get(row.playerId).teamId !== row.teamId || (row.receiverId && (!players.has(row.receiverId) || players.get(row.receiverId).teamId !== row.teamId)))) fail(`Invalid passer/receiver: ${row.id}`);
        if (row.type === 'pass_start' && ((row.from && !pointOK(row.from, data.pitch)) || (row.target && !pointOK(row.target, data.pitch)))) fail(`Invalid pass coordinates: ${row.id}`);
        if (row.type === 'pass_end' && (!['completed', 'intercepted', 'out', 'failed'].includes(row.outcome) || (row.position && !pointOK(row.position, data.pitch)))) fail(`Invalid outcome: ${row.id}`);
      }
    }
  }
  const eventMap = new Map(data.events.map(e => [e.id, e]));
  const ends = new Set(), stateTimes = new Set();
  for (const e of data.events) {
    if (['control', 'neutral'].includes(e.type)) {
      if (stateTimes.has(e.tMs)) fail(`Ambiguous control states at ${e.tMs}`);
      stateTimes.add(e.tMs);
    }
    if (e.type === 'pass_end') {
      const start = eventMap.get(e.passId);
      if (!start || start.type !== 'pass_start' || e.tMs < start.tMs || e.availableAtMs < start.availableAtMs || ends.has(e.passId)) fail(`Invalid pass resolution: ${e.id}`);
      ends.add(e.passId);
    }
  }
  return true;
}
function metric(value, unit, kind, formula, asOfMs, sources, inputs, missing = [], note = null) {
  return { value, unit, kind, formula, asOfMs, sources, inputs, missing, status: value === null ? 'unavailable' : 'available', note };
}
// Inputs at the observation timestamp must ALSO have been available by the knowledge cutoff.
function frameAt(data, observationMs, knowledgeMs) {
  const frame = sorted(data.frames.filter(f => f.tMs <= observationMs && f.availableAtMs <= knowledgeMs)).at(-1);
  return frame && observationMs - frame.tMs <= RULES.maxFrameAgeMs ? frame : null;
}
export function analyze(data, asOfMs) {
  validateDataset(data);
  if (!finite(asOfMs) || asOfMs < 0 || asOfMs > data.durationMs) throw new Error('asOfMs outside replay');
  const visible = sorted(data.events.filter(e => e.tMs <= asOfMs && e.availableAtMs <= asOfMs));
  const frame = frameAt(data, asOfMs, asOfMs);
  const players = new Map(data.players.map(p => [p.id, p]));
  const states = visible.filter(e => ['control', 'neutral'].includes(e.type));
  const durations = Object.fromEntries(data.teams.map(t => [t.id, 0]));
  let neutralMs = 0, unknownMs = states.length ? states[0].tMs : asOfMs;
  for (let i = 0; i < states.length; i++) {
    const state = states[i], dt = (states[i + 1]?.tMs ?? asOfMs) - state.tMs;
    if (state.type === 'control') durations[state.teamId] += dt;
    else neutralMs += dt;
  }
  const denominatorMs = Object.values(durations).reduce((a, b) => a + b, 0);
  const possession = Object.fromEntries(data.teams.map(t => [t.id, metric(denominatorMs ? durations[t.id] / denominatorMs * 100 : null, '%', 'deterministic', '100 × teamAttributedMs / sum(teamAttributedMs)', asOfMs, states.map(s => s.id), { durationsMs: durations, denominatorMs, neutralMs, unknownMs }, denominatorMs ? [] : ['attributed possession time'], 'Team attribution persists during pass flight; explicit neutral and unknown intervals excluded. Not optical ball tracking.') ]));
  const passes = visible.filter(e => e.type === 'pass_start').map(start => {
    const end = visible.find(e => e.type === 'pass_end' && e.passId === start.id);
    const direction = data.teams.find(t => t.id === start.teamId).attackDirection;
    const missing = [...(!start.from ? ['observed pass origin'] : []), ...(!start.target ? ['intended target'] : [])];
    const ok = missing.length === 0, dx = ok ? start.target.x - start.from.x : null, dy = ok ? start.target.y - start.from.y : null;
    const inputs = { from: start.from ?? null, intendedTarget: start.target ?? null, attackDirection: direction };
    const mk = (value, unit, formula) => metric(value, unit, 'deterministic', formula, asOfMs, [start.id], inputs, missing);
    return { id: start.id, playerId: start.playerId, teamId: start.teamId, receiverId: start.receiverId ?? null, tMs: start.tMs,
      length: mk(ok ? distance(start.from, start.target) : null, 'm', 'hypot(target.x−from.x, target.y−from.y); intended vector, not travelled path'),
      progression: mk(ok ? dx * direction : null, 'm', '(target.x−from.x) × attackDirection'),
      angle: metric(ok && (dx !== 0 || dy !== 0) ? Math.atan2(dy, dx * direction) * 180 / Math.PI : null, 'deg', 'deterministic', 'atan2(target.y−from.y, (target.x−from.x) × attackDirection) × 180/π; y increases down-pitch', asOfMs, [start.id], inputs, [...missing, ...(ok && dx === 0 && dy === 0 ? ['nonzero pass vector'] : [])]),
      observedDisplacement: metric(start.from && end?.position ? distance(start.from, end.position) : null, 'm', 'deterministic', 'Euclidean distance(observed origin, observed endpoint); not full flight path', asOfMs, [start.id, ...(end ? [end.id] : [])], { from: start.from ?? null, end: end?.position ?? null }, [...(!start.from ? ['observed pass origin'] : []), ...(!end?.position ? ['observed pass endpoint'] : [])]),
      outcome: metric(end?.outcome ?? null, 'category', 'observation', 'visible pass_end.outcome; no predicted success', asOfMs, [start.id, ...(end ? [end.id] : [])], { startMs: start.tMs, endMs: end?.tMs ?? null, availableAtMs: end?.availableAtMs ?? null }, end ? [] : ['observed pass resolution']) };
  });
  const completion = Object.fromEntries(data.teams.map(team => {
    const teamPasses = passes.filter(p => p.teamId === team.id), resolved = teamPasses.filter(p => p.outcome.value !== null), completed = resolved.filter(p => p.outcome.value === 'completed').length;
    return [team.id, metric(resolved.length ? 100 * completed / resolved.length : null, '%', 'deterministic', '100 × completed / resolved starts; pending excluded', asOfMs, resolved.flatMap(p => p.outcome.sources), { attempted: teamPasses.length, resolved: resolved.length, completed, pending: teamPasses.length - resolved.length }, resolved.length ? [] : ['resolved pass'])];
  }));
  const lastState = states.at(-1);
  const released = lastState && visible.some(e => e.type === 'pass_start' && e.playerId === lastState.playerId && e.tMs >= lastState.tMs);
  const holderId = lastState?.type === 'control' && !released ? lastState.playerId : null;
  const holder = players.get(holderId), origin = frame?.positions[holderId];
  const enemies = holder ? data.players.filter(p => p.teamId !== holder.teamId) : [];
  const missingDefenders = enemies.filter(p => !frame?.positions[p.id]).map(p => `position:${p.id}`);
  const missingPressure = [...(!holder ? ['explicit current ball holder'] : []), ...(!frame ? ['fresh position frame'] : []), ...(holder && !origin ? [`position:${holderId}`] : []), ...missingDefenders];
  const nearest = !missingPressure.length ? Math.min(...enemies.map(p => distance(origin, frame.positions[p.id]))) : null;
  const pressure = metric(missingPressure.length ? null : enemies.filter(p => distance(origin, frame.positions[p.id]) <= RULES.pressureRadiusM).length, 'opponents', 'heuristic', 'count(opponents at Euclidean distance ≤ 5 m); geometric proximity only', asOfMs, [...(frame ? [frame.id] : []), ...(lastState ? [lastState.id] : [])], { holderId, origin: origin ?? null, radiusM: RULES.pressureRadiusM, nearestOpponentM: nearest, positions: Object.fromEntries(enemies.filter(p => frame?.positions[p.id]).map(p => [p.id, frame.positions[p.id]])) }, [...new Set(missingPressure)], 'No velocity, orientation or calibrated pressure model.');
  const options = holder ? data.players.filter(p => p.teamId === holder.teamId && p.id !== holderId).map(receiver => {
    const target = frame?.positions[receiver.id], dir = data.teams.find(t => t.id === holder.teamId).attackDirection;
    const missing = [...(!frame ? ['fresh position frame'] : []), ...(!origin ? [`position:${holderId}`] : []), ...(!target ? [`position:${receiver.id}`] : [])];
    const geometryOK = !missing.length;
    const blockers = geometryOK ? enemies.filter(p => frame.positions[p.id]).map(p => ({ playerId: p.id, ...segmentDistance(frame.positions[p.id], origin, target) })).filter(p => p.fraction > 0 && p.fraction < 1 && p.distanceM <= RULES.laneRadiusM) : [];
    const sources = [...(frame ? [frame.id] : []), ...(lastState ? [lastState.id] : [])];
    const inputs = { origin: origin ?? null, target: target ?? null, attackDirection: dir };
    const laneMissing = [...new Set([...missing, ...missingDefenders, ...(geometryOK && distance(origin, target) === 0 ? ['distinct target position'] : [])])];
    return { receiverId: receiver.id,
      distance: metric(geometryOK ? distance(origin, target) : null, 'm', 'deterministic', 'Euclidean distance(holder, receiver)', asOfMs, sources, inputs, missing),
      progression: metric(geometryOK ? (target.x - origin.x) * dir : null, 'm', 'deterministic', '(receiver.x−holder.x) × attackDirection', asOfMs, sources, inputs, missing),
      lane: metric(laneMissing.length ? null : blockers.length ? 'obstructed' : 'clear-geometrically', 'category', 'heuristic', 'opponent projection inside open pass segment AND perpendicular distance ≤ 2 m', asOfMs, sources, { ...inputs, corridorRadiusM: RULES.laneRadiusM, opponentPositions: Object.fromEntries(enemies.filter(p => frame?.positions[p.id]).map(p => [p.id, frame.positions[p.id]])), blockers }, laneMissing, 'Static corridor, not interception probability; ignores speed, arrival times, feet, orientation and ball height.') };
  }) : [];
  return structuredClone({ schemaVersion: '1.0', datasetId: data.id, asOfMs, frame: frame ?? null, holderId,
    possession, completion, passes, pressure, options,
    availableEventIds: visible.map(e => e.id),
    layers: { trajectories: passes.map(p => ({ passId: p.id, startMs: p.tMs, from: p.length.inputs.from, target: p.length.inputs.intendedTarget })), pressure: { radiusM: RULES.pressureRadiusM, holderId }, options: options.map(o => ({ receiverId: o.receiverId, classification: o.lane.value })), pov: { status: 'renderer-owned', coordinateSpace: 'pitch-metres', cameraTarget: null } } });
}
// Deterministic local narratives: no API calls, both derive from exactly the same facts.
export function explain(snapshot, mode = 'novice') {
  const valid = snapshot.options.filter(o => o.distance.value !== null && o.lane.value !== null);
  const forward = valid.filter(o => o.progression.value > 0).sort((a, b) => b.progression.value - a.progression.value);
  const option = forward.find(o => o.lane.value === 'clear-geometrically') ?? forward[0] ?? valid[0];
  if (!option) return { text: 'Données insuffisantes pour expliquer les options à cet instant.', sources: [], kind: 'deterministic-template' };
  const d = option.distance.value.toFixed(1), p = option.progression.value.toFixed(1), blocked = option.lane.value === 'obstructed';
  return { text: mode === 'analyst' ? `${option.receiverId} : vecteur ${d} m, progression ${p} m ; ${blocked ? 'corridor occupé' : 'aucun défenseur dans le corridor de 2 m'}. Heuristique statique, aucune probabilité calculée.` : `${option.receiverId} permettrait de gagner ${p} mètres vers le but. ${blocked ? 'Un adversaire se trouve sur le trajet : attention.' : 'Le trajet semble dégagé sur cette image.'} Les joueurs peuvent encore bouger.`, sources: [...new Set([...option.distance.sources, ...option.progression.sources, ...option.lane.sources])], kind: 'deterministic-template', asOfMs: snapshot.asOfMs };
}
