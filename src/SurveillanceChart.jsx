import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const data = [
  { year: '2015', cameras: 500, drones: 50 },
  { year: '2018', cameras: 1500, drones: 150 },
  { year: '2021', cameras: 3000, drones: 400 },
  { year: '2024', cameras: 4000, drones: 800 },
  { year: '2026', cameras: 5000, drones: 1200 },
];

const accentColor = '#538cdddd';
const droneColor = '#ff7a5c';

export default function SurveillanceChart() {
  return (
    <div className="poi-chart">
      <div className="poi-chart-header">
        <div>
          <div className="small text-uppercase">Eskalation av visuell övervakning</div>
          <div className="poi-chart-title">Poliskameror &amp; drönarflygningar (illustrativt)</div>
        </div>
        <div className="poi-chart-legend small">
          <span className="legend-item">
            <span className="legend-swatch cameras" />
            Kameror (fasta &amp; mobila)
          </span>
          <span className="legend-item">
            <span className="legend-swatch drones" />
            Registrerade drönarflygningar
          </span>
        </div>
      </div>
      <div className="poi-chart-body poi-chart-recharts">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart
            data={data}
            margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.09)" />
            <XAxis
              dataKey="year"
              tick={{ fill: 'rgba(255,255,255,0.75)', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.2)' }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 5000]}
              tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.2)' }}
              tickLine={false}
              tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: 0,
              }}
              labelStyle={{ color: '#ccc' }}
              formatter={(value) => [value.toLocaleString('sv-SE'), null]}
              labelFormatter={(label) => `År: ${label}`}
            />
            <Line
              type="monotone"
              dataKey="cameras"
              name="Kameror"
              stroke={accentColor}
              strokeWidth={2}
              dot={{ fill: accentColor, r: 4 }}
              activeDot={{ r: 6 }}
              isAnimationActive={true}
              animationDuration={1000}
              animationEasing="ease-out"
            />
            <Line
              type="monotone"
              dataKey="drones"
              name="Drönarflygningar"
              stroke={droneColor}
              strokeWidth={2}
              dot={{ fill: droneColor, r: 4 }}
              activeDot={{ r: 6 }}
              isAnimationActive={true}
              animationDuration={1000}
              animationEasing="ease-out"
              animationBegin={150}
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="poi-chart-xlabels small">
          {data.map((d) => (
            <div key={d.year}>
              <div>{d.year}</div>
              <div className="poi-chart-values">
                <span className="value cameras">≈ {d.cameras.toLocaleString('sv-SE')} kameror</span>
                <span className="value drones">≈ {d.drones.toLocaleString('sv-SE')} flygningar</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="poi-chart-footnote small">
        Trendlinjen är schematisk, baserad på storleksordningen för <em>kameraoffensiven</em> och utbyggnaden av
        polisens drönaranvändning – inte exakta räkningar.
      </p>
    </div>
  );
}
