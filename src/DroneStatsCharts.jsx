import React from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

// Yearly totals from dronarbevakaren-se-2026-03-10 (1).csv (filter/year/YYYY/ Anledning rows summed)
const yearlyData = [
  { year: '2022', notices: 106 },
  { year: '2023', notices: 164 },
  { year: '2024', notices: 233 },
  { year: '2025', notices: 322 },
  { year: '2026', notices: 75 }, // YTD (data till mars 2026)
];

// Polisens användning av drönare (Källa: Polisen)
const polisenDroneData = [
  { year: '2018', timmar: 560, uppdrag: 1010 },
  { year: '2019', timmar: 1228, uppdrag: 2238 },
  { year: '2020', timmar: 4558, uppdrag: 6771 },
  { year: '2021', timmar: 5699, uppdrag: 8185 },
  { year: '2022', timmar: 6842, uppdrag: 9631 },
  { year: '2023', timmar: 10696, uppdrag: 14179 },
  { year: '2024', timmar: 13700, uppdrag: 17900 }, // prognos
];

// Data from dronarbevakaren-se-2026-03-10.csv (dronarbevakaren.se/statistik)
// Framförhållning (lead time) – percentages
const framforhallningData = [
  { name: 'Negativ framförhållning', value: 14.94, fill: '#538cdddd' },
  { name: 'Ingen framförhållning', value: 11.85, fill: '#6b9ee8' },
  { name: 'Mindre än 24 h', value: 16.91, fill: '#ff7a5c' },
  { name: 'Mindre än 48 h', value: 14.32, fill: '#ff9a7a' },
  { name: 'Mer än 48 h', value: 38.77, fill: '#e85c5c' },
  { name: 'Okänt', value: 3.21, fill: '#555' },
];

// Anledning (reason for surveillance) – counts
const anledningData = [
  { name: 'Okänd', count: 292 },
  { name: 'Dignitärer, statsbesök, regering', count: 55 },
  { name: 'Folkfest och festival', count: 192 },
  { name: 'Match/sport', count: 217 },
  { name: 'Allmän sammankomst/demonstration', count: 47 },
  { name: 'Paludan', count: 5 },
  { name: 'Rättegång', count: 2 },
];

// Varaktighet (duration of surveillance) – counts
const varaktighetData = [
  { name: 'Okänd', count: 167 },
  { name: 'Mindre än 4 timmar', count: 12 },
  { name: '4 - 8 timmar', count: 49 },
  { name: '8 - 24 timmar', count: 257 },
  { name: '1 dygn', count: 30 },
  { name: '2 dygn', count: 49 },
  { name: '2 - 7 dygn', count: 80 },
  { name: '1 månad', count: 38 },
  { name: '3 månader', count: 61 },
  { name: 'Mer än 3 månader', count: 67 },
];

const tooltipStyle = {
  backgroundColor: '#1a1a1a',
  border: '1px solid #333',
  borderRadius: 0,
};

/* Axis styling for light panel background (visible ticks/labels) */
const axisTickStyle = { fill: '#4b4b4b', fontSize: 11 };
const axisLineStroke = '#c8c8c8';

const accentColor = '#538cdddd';

export default function DroneStatsCharts() {
  return (
    <div className="drone-stats-charts">
      {/* Chart 0: Increase over the years – Line */}
      <div className="panel mb-4">
        <div className="d-flex justify-content-between align-items-baseline mb-2">
          <h3 className="h6 text-uppercase">Ökning över åren</h3>
          <span className="badge bg-light text-dark border small">dronarbevakaren.se</span>
        </div>
        <p className="small text-muted mb-3">
          Antal notiser om drönarövervakning per år (2026 delår).
        </p>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart
            data={yearlyData}
            margin={{ top: 12, right: 12, left: 36, bottom: 28 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" vertical={false} />
            <XAxis
              dataKey="year"
              tick={axisTickStyle}
              axisLine={{ stroke: axisLineStroke }}
              tickLine={{ stroke: axisLineStroke }}
            />
            <YAxis
              width={32}
              tick={axisTickStyle}
              axisLine={{ stroke: axisLineStroke }}
              tickLine={{ stroke: axisLineStroke }}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value) => [value, 'Antal notiser']}
              labelStyle={{ color: '#ccc' }}
              labelFormatter={(label) => `År ${label}`}
            />
            <Line
              type="monotone"
              dataKey="notices"
              name="Antal notiser"
              stroke={accentColor}
              strokeWidth={2}
              dot={{ fill: accentColor, r: 4 }}
              activeDot={{ r: 6 }}
              isAnimationActive
              animationDuration={800}
            />
          </LineChart>
        </ResponsiveContainer>
        <p className="small text-muted mt-2 mb-0">
          2026 avser data till mars 2026.
        </p>
      </div>

      {/* Chart: Polisens användning av drönare – timmar & uppdrag */}
      <div className="panel mb-4">
        <div className="d-flex justify-content-between align-items-baseline mb-2">
          <h3 className="h6 text-uppercase">Polisens användning av drönare</h3>
          <span className="badge bg-light text-dark border small">Källa: Polisen</span>
        </div>
        <p className="small text-muted mb-3">
          Flygtimmar och antal uppdrag per år. 2024 är prognos.
        </p>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart
            data={polisenDroneData}
            margin={{ top: 12, right: 44, left: 44, bottom: 28 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" vertical={false} />
            <XAxis
              dataKey="year"
              tick={axisTickStyle}
              axisLine={{ stroke: axisLineStroke }}
              tickLine={{ stroke: axisLineStroke }}
            />
            <YAxis
              yAxisId="left"
              orientation="left"
              width={36}
              tick={axisTickStyle}
              axisLine={{ stroke: axisLineStroke }}
              tickLine={{ stroke: axisLineStroke }}
              tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)}
              label={{ value: 'Timmar', angle: -90, position: 'insideLeft', fill: '#4b4b4b', fontSize: 10 }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              width={36}
              tick={axisTickStyle}
              axisLine={{ stroke: axisLineStroke }}
              tickLine={{ stroke: axisLineStroke }}
              tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)}
              label={{ value: 'Uppdrag', angle: 90, position: 'insideRight', fill: '#4b4b4b', fontSize: 10 }}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={{ color: '#ccc' }}
              labelFormatter={(label) => `År ${label}`}
              formatter={(value, name) => [
                name === 'timmar' ? `${value.toLocaleString('sv-SE')} timmar` : value.toLocaleString('sv-SE'),
                name === 'timmar' ? 'Timmar' : 'Uppdrag',
              ]}
            />
            <Legend
              wrapperStyle={{ fontSize: '0.75rem' }}
              formatter={(value) => <span style={{ color: 'var(--text-muted-color)' }}>{value === 'timmar' ? 'Timmar' : 'Uppdrag'}</span>}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="timmar"
              name="timmar"
              stroke={accentColor}
              strokeWidth={2}
              dot={{ fill: accentColor, r: 4 }}
              activeDot={{ r: 6 }}
              isAnimationActive
              animationDuration={800}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="uppdrag"
              name="uppdrag"
              stroke="#ff7a5c"
              strokeWidth={2}
              dot={{ fill: '#ff7a5c', r: 4 }}
              activeDot={{ r: 6 }}
              isAnimationActive
              animationDuration={800}
              animationBegin={100}
            />
          </LineChart>
        </ResponsiveContainer>
        <p className="small text-muted mt-2 mb-0">
          2024: prognos. Källa: Polisen.
        </p>
      </div>

      {/* Chart 1: Varaktighet (duration) – Bar */}
      <div className="panel mb-4">
        <div className="d-flex justify-content-between align-items-baseline mb-2">
          <h3 className="h6 text-uppercase">Varaktighet</h3>
          <span className="badge bg-light text-dark border small">dronarbevakaren.se</span>
        </div>
        <p className="small text-muted mb-3">
          Hur länge drönarövervakningen varade (antal notiser). Varaktighet räknas när start- och slutdatum framgår av beslut.
        </p>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart
            data={varaktighetData}
            layout="vertical"
            margin={{ top: 8, right: 12, left: 12, bottom: 28 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" horizontal={false} />
            <XAxis type="number" tick={axisTickStyle} axisLine={{ stroke: axisLineStroke }} tickLine={{ stroke: axisLineStroke }} />
            <YAxis type="category" dataKey="name" width={140} tick={{ fill: '#4b4b4b', fontSize: 10 }} axisLine={{ stroke: axisLineStroke }} tickLine={{ stroke: axisLineStroke }} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value) => [value, 'Antal notiser']}
              labelStyle={{ color: '#ccc' }}
            />
            <Bar dataKey="count" name="Antal notiser" fill="#538cdddd" radius={[0, 2, 2, 0]} isAnimationActive animationDuration={800} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Framförhållning (lead time) – Pie */}
      <div className="panel mb-4">
        <div className="d-flex justify-content-between align-items-baseline mb-2">
          <h3 className="h6 text-uppercase">Framförhållning</h3>
          <span className="badge bg-light text-dark border small">dronarbevakaren.se</span>
        </div>
        <p className="small text-muted mb-3">
          Hur lång tid i förväg polisen meddelat om drönarövervakning (andel av notiser).
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <Pie
              data={framforhallningData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={90}
              label={({ name, value }) => `${name}: ${value}%`}
              labelLine={{ stroke: '#737373' }}
            >
              {framforhallningData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} stroke="#fff" strokeWidth={1} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value) => [`${value}%`, 'Andel']}
              labelStyle={{ color: '#ccc' }}
            />
            <Legend
              wrapperStyle={{ fontSize: '0.7rem' }}
              formatter={(value) => <span style={{ color: '#4b4b4b' }}>{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Anledning (reason) – Bar */}
      <div className="panel">
        <div className="d-flex justify-content-between align-items-baseline mb-2">
          <h3 className="h6 text-uppercase">Anledning till drönarövervakning</h3>
          <span className="badge bg-light text-dark border small">dronarbevakaren.se</span>
        </div>
        <p className="small text-muted mb-3">
          Antal notiser per angiven anledning (ofta framgår inte anledning i beslut).
        </p>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={anledningData}
            layout="vertical"
            margin={{ top: 8, right: 12, left: 12, bottom: 28 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" horizontal={false} />
            <XAxis type="number" tick={axisTickStyle} axisLine={{ stroke: axisLineStroke }} tickLine={{ stroke: axisLineStroke }} />
            <YAxis type="category" dataKey="name" width={160} tick={{ fill: '#4b4b4b', fontSize: 10 }} axisLine={{ stroke: axisLineStroke }} tickLine={{ stroke: axisLineStroke }} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value) => [value, 'Antal notiser']}
              labelStyle={{ color: '#ccc' }}
            />
            <Bar dataKey="count" name="Antal notiser" fill="#538cdddd" radius={[0, 2, 2, 0]} isAnimationActive animationDuration={800} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
