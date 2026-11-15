import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

test('zero sunlight is interval-limited and metrics describe geometry', async () => {
  const server = await createServer({cacheDir:'node_modules/.vite-tests/labels.test',server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { TimelineBar } = await server.ssrLoadModule('/src/components/TimelineBar.tsx');
    const { MetricCards } = await server.ssrLoadModule('/src/components/MetricCards.tsx');
    const summary = { total_visible_hours: 0, total_blocked_hours: 24, total_interval_hours: 24,
      visibility_percentage: 0, full_disk_visible_hours: 0, partial_limb_hours: 0, fully_blocked_hours: 24,
      window_count: 0, longest_window_hours: 0, longest_blackout_hours: 24, windows: [] };
    const timeRange = {start_time: '2026-11-14T00:00:00Z', stop_time: '2026-11-15T00:00:00Z', elapsed_hours: 24, total_points: 25, step_size: '1h'};
    const props = {earthComm: summary, solarPower: summary, timeRange, site: { latitude: -89.9, longitude: 0, ground_elevation_m: -100, observer_height_m: 2, total_altitude_m: -98 }};
    const html = renderToStaticMarkup(React.createElement(TimelineBar, props)) + renderToStaticMarkup(React.createElement(MetricCards, props));
    assert.equal(/PERMANENT SHADOW|Power Generation|permanent shadow \/ eclipse/.test(html), false);
    assert.equal(html.includes('NO SUNLIGHT IN EVALUATED INTERVAL'), true);
    assert.equal(html.includes('Geometric Earth Visibility'), true);
    assert.equal(html.includes('Sunlight Availability'), true);
  } finally { await server.close(); }
});
