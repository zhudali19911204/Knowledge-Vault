"use strict";

let simulation = null;
let timer = 0;

function stopTimer() {
  if (timer) clearTimeout(timer);
  timer = 0;
}

function createWorkerState(payload) {
  const nodes = payload.nodes.map((node, index) => ({
    ...node,
    index,
    vx: 0,
    vy: 0,
    fx: Number.isFinite(node.fx) ? node.fx : null,
    fy: Number.isFinite(node.fy) ? node.fy : null,
  }));
  const groupTotals = new Map();
  for (const node of nodes) {
    const total = groupTotals.get(node.group) || { x: 0, y: 0, count: 0 };
    total.x += node.anchorX;
    total.y += node.anchorY;
    total.count += 1;
    groupTotals.set(node.group, total);
  }
  const groupCenters = new Map(Array.from(groupTotals, ([key, value]) => [key, {
    x: value.x / value.count,
    y: value.y / value.count,
  }]));
  const links = payload.links.map((link) => ({
    source: nodes[link.source],
    target: nodes[link.target],
    distance: link.distance,
    strength: link.strength,
  })).filter((link) => link.source && link.target);
  return {
    nodes,
    links,
    groupCenters,
    settings: payload.settings,
    alpha: Number.isFinite(payload.alpha) ? payload.alpha : 1,
    ticks: 0,
    paused: payload.paused === true,
    frameInterval: payload.frameInterval || 33,
  };
}

function tickWorkerSimulation(state) {
  const alpha = state.alpha;
  const rows = state.nodes;
  const settings = state.settings;
  if (rows.length === 0) return false;

  for (const link of state.links) {
    let dx = link.target.x - link.source.x;
    let dy = link.target.y - link.source.y;
    let distance = Math.hypot(dx, dy);
    if (distance < .01) {
      dx = ((link.source.index * 17 + link.target.index * 29) % 7) - 3;
      dy = ((link.source.index * 31 + link.target.index * 13) % 7) - 3;
      distance = Math.max(.1, Math.hypot(dx, dy));
    }
    const desiredDistance = link.distance * settings.linkDistance;
    const force = ((distance - desiredDistance) / distance) * link.strength * alpha;
    const forceX = dx * force;
    const forceY = dy * force;
    if (link.source.fx === null) {
      link.source.vx += forceX;
      link.source.vy += forceY;
    }
    if (link.target.fx === null) {
      link.target.vx -= forceX;
      link.target.vy -= forceY;
    }
  }

  const cellSize = 82 * settings.nodeScale;
  const grid = new Map();
  for (const row of rows) {
    const cellX = Math.floor(row.x / cellSize);
    const cellY = Math.floor(row.y / cellSize);
    const key = `${cellX},${cellY}`;
    const cell = grid.get(key) || [];
    cell.push(row);
    grid.set(key, cell);
  }
  for (const row of rows) {
    const cellX = Math.floor(row.x / cellSize);
    const cellY = Math.floor(row.y / cellSize);
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        const neighbors = grid.get(`${cellX + offsetX},${cellY + offsetY}`) || [];
        for (const other of neighbors) {
          if (other.index <= row.index) continue;
          let dx = other.x - row.x;
          let dy = other.y - row.y;
          let distanceSquared = dx * dx + dy * dy;
          if (distanceSquared < .01) {
            dx = ((row.index * 19 + other.index * 23) % 5) - 2;
            dy = ((row.index * 11 + other.index * 37) % 5) - 2;
            distanceSquared = Math.max(.1, dx * dx + dy * dy);
          }
          const distance = Math.sqrt(distanceSquared);
          const collisionDistance = (row.radius + other.radius) * settings.nodeScale + 9;
          const repulsion = Math.min(1.5, settings.repulsion / distanceSquared) * alpha;
          const collision = distance < collisionDistance
            ? (collisionDistance - distance) * .075
            : 0;
          const force = repulsion + collision;
          const forceX = (dx / distance) * force;
          const forceY = (dy / distance) * force;
          if (row.fx === null) {
            row.vx -= forceX;
            row.vy -= forceY;
          }
          if (other.fx === null) {
            other.vx += forceX;
            other.vy += forceY;
          }
        }
      }
    }
  }

  let kinetic = 0;
  for (const row of rows) {
    const groupCenter = state.groupCenters.get(row.group) || { x: 0, y: 0 };
    if (row.fx !== null && row.fy !== null) {
      row.x = row.fx;
      row.y = row.fy;
      row.vx = 0;
      row.vy = 0;
      continue;
    }
    row.vx += (groupCenter.x - row.x) * settings.clusterStrength * .00001 * alpha;
    row.vy += (groupCenter.y - row.y) * settings.clusterStrength * .00001 * alpha;
    row.vx += -row.x * settings.centerStrength * .00001 * alpha;
    row.vy += -row.y * settings.centerStrength * .00001 * alpha;
    row.vx *= .84;
    row.vy *= .84;
    const speed = Math.hypot(row.vx, row.vy);
    if (speed > 11) {
      row.vx = (row.vx / speed) * 11;
      row.vy = (row.vy / speed) * 11;
    }
    row.x += row.vx;
    row.y += row.vy;
    kinetic += row.vx * row.vx + row.vy * row.vy;
  }

  state.ticks += 1;
  state.alpha = Math.max(0, alpha * .985 - .00065);
  const averageKinetic = kinetic / Math.max(1, rows.length);
  return state.ticks < 720 && (state.alpha > .012 || averageKinetic > .012);
}

function postFrame(active) {
  const positions = new Float32Array(simulation.nodes.length * 2);
  for (let index = 0; index < simulation.nodes.length; index += 1) {
    positions[index * 2] = simulation.nodes[index].x;
    positions[index * 2 + 1] = simulation.nodes[index].y;
  }
  self.postMessage({
    type: "frame",
    positions: positions.buffer,
    alpha: simulation.alpha,
    active,
  }, [positions.buffer]);
}

function run() {
  stopTimer();
  if (!simulation || simulation.paused) return;
  const active = tickWorkerSimulation(simulation);
  postFrame(active);
  if (active) timer = setTimeout(run, simulation.frameInterval);
}

self.onmessage = (event) => {
  const message = event.data || {};
  if (message.type === "start") {
    stopTimer();
    simulation = createWorkerState(message);
    postFrame(!simulation.paused);
    if (!simulation.paused) run();
    return;
  }
  if (!simulation) return;
  if (message.type === "drag") {
    const node = simulation.nodes[message.index];
    if (!node) return;
    node.fx = message.fixed ? message.x : null;
    node.fy = message.fixed ? message.y : null;
    if (message.fixed) {
      node.x = message.x;
      node.y = message.y;
    }
    simulation.alpha = Math.max(simulation.alpha, message.alpha || .4);
    simulation.ticks = 0;
    if (!simulation.paused && !timer) run();
    return;
  }
  if (message.type === "stop") {
    stopTimer();
    simulation = null;
  }
};

self.__graphWorkerTest = { createWorkerState, tickWorkerSimulation };
