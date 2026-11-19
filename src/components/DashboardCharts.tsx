'use client';
import { useMemo, useState } from 'react';
import { rupiah } from '@/lib/calculations';

type ReceiptLike = {
  transactionDate: string | Date;
  total: number;
  paymentStatus?: string;
  paymentMethod?: string;
};

type Point = { key: string; date: Date; total: number; count: number };

const STATUS_COLORS: Record<string, string> = {
  Lunas: '#159b68',
  'Belum lunas': '#f59e0b',
  'DP / Uang muka': '#5148e5',
  'Sebagian dibayar': '#64748b',
};

const METHOD_COLORS = ['#5148e5', '#159b68', '#f59e0b', '#0ea5e9', '#8b5cf6'];

function startOfDay(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function niceCeil(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 100000;
  const exponent = Math.pow(10, Math.floor(Math.log10(value)));
  const factor = value / exponent;
  const nice = factor <= 1 ? 1 : factor <= 2 ? 2 : factor <= 5 ? 5 : 10;
  return nice * exponent;
}

function compact(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`;
  if (value >= 1_000) return `${(value / 1_000).toLocaleString('id-ID', { maximumFractionDigits: 0 })} rb`;
  return String(Math.round(value));
}

export function DashboardCharts({ receipts }: { receipts: ReceiptLike[] }) {
  const [range, setRange] = useState<7 | 30>(7);

  const series = useMemo<Point[]>(() => {
    const end = startOfDay(new Date());
    const points: Point[] = Array.from({ length: range }, (_, index) => {
      const date = new Date(end);
      date.setDate(end.getDate() - (range - 1 - index));
      return { key: dateKey(date), date, total: 0, count: 0 };
    });
    const byKey = new Map(points.map(point => [point.key, point]));
    for (const receipt of receipts) {
      const point = byKey.get(dateKey(new Date(receipt.transactionDate)));
      if (!point) continue;
      point.total += Number(receipt.total) || 0;
      point.count += 1;
    }
    return points;
  }, [receipts, range]);

  const rangeTotal = series.reduce((sum, point) => sum + point.total, 0);
  const rangeCount = series.reduce((sum, point) => sum + point.count, 0);
  const maxTotal = niceCeil(Math.max(...series.map(point => point.total), 0));
  const gridValues = [1, 0.75, 0.5, 0.25, 0];

  const statusData = useMemo(() => {
    const labels = Object.keys(STATUS_COLORS);
    return labels.map(label => ({
      label,
      color: STATUS_COLORS[label],
      count: receipts.filter(receipt => (receipt.paymentStatus || 'Belum lunas') === label).length,
    }));
  }, [receipts]);

  const paidPercent = receipts.length
    ? Math.round((statusData.find(item => item.label === 'Lunas')?.count || 0) / receipts.length * 100)
    : 0;

  const methodData = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    for (const receipt of receipts) {
      const name = receipt.paymentMethod || 'Lainnya';
      const entry = map.get(name) || { name, total: 0, count: 0 };
      entry.total += Number(receipt.total) || 0;
      entry.count += 1;
      map.set(name, entry);
    }
    return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 5);
  }, [receipts]);

  const methodMax = Math.max(...methodData.map(item => item.total), 1);
  const maxCount = Math.max(1, Math.ceil(Math.max(...series.map(point => point.count), 0) / 5) * 5);
  const hasData = receipts.length > 0;
  const activeStatusCount = statusData.filter(item => item.count > 0).length;

  return (
    <div className="dash-charts">
      <section className="card chart-card chart-wide">
        <div className="sectionhead">
          <div>
            <h2>Tren penjualan</h2>
            <div className="eyebrow">
              {hasData ? `${rupiah(rangeTotal)} · ${rangeCount} transaksi` : 'Belum ada transaksi pada periode ini'}
            </div>
          </div>
          <div className="chart-range" role="group" aria-label="Rentang grafik penjualan">
            <button type="button" className={range === 7 ? 'active' : ''} onClick={() => setRange(7)}>7 hari</button>
            <button type="button" className={range === 30 ? 'active' : ''} onClick={() => setRange(30)}>30 hari</button>
          </div>
        </div>

        {hasData ? (
          <div className="bar-chart" role="img" aria-label={`Grafik penjualan ${range} hari terakhir`}>
            <div className="bar-y" aria-hidden="true">
              {gridValues.map(value => (
                <span key={value}>{compact(maxTotal * value)}</span>
              ))}
            </div>
            <div className="bar-plot">
              <div className="bar-grid" aria-hidden="true">
                {gridValues.map(value => <i key={value} />)}
              </div>
              <div className="bar-columns">
                {series.map((point, index) => {
                  const showLabel = range <= 7 || index % 5 === 0 || index === series.length - 1;
                  const height = point.total > 0 ? Math.max(3, (point.total / maxTotal) * 100) : 0;
                  const label = `${point.date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}`;
                  return (
                    <div className={`bar-col${point.total === 0 ? ' empty' : ''}`} key={point.key}>
                      <div
                        className="bar-fill"
                        style={{ height: `${height}%` }}
                        title={`${label} · ${rupiah(point.total)} · ${point.count} transaksi`}
                      />
                      <span className="bar-x">{showLabel ? `${point.date.getDate()}/${point.date.getMonth() + 1}` : ''}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="chart-empty">Transaksi yang tersimpan akan muncul sebagai grafik di sini.</div>
        )}
      </section>

      <section className="card chart-card" style={{ gridColumn: '1 / -1' }}>
        <div className="sectionhead">
          <div>
            <h2>Tren pembelian</h2>
            <div className="eyebrow">Jumlah transaksi per hari · {range} hari terakhir</div>
          </div>
        </div>

        {hasData ? (
          <div className="bar-chart" role="img" aria-label={`Grafik pembelian ${range} hari terakhir`}>
            <div className="bar-y" aria-hidden="true">
              {[1, 0.75, 0.5, 0.25, 0].map(value => (
                <span key={value}>{Math.round(maxCount * value)}</span>
              ))}
            </div>
            <div className="bar-plot">
              <div className="bar-grid" aria-hidden="true">
                {[1, 0.75, 0.5, 0.25, 0].map((_, index) => <i key={index} />)}
              </div>
              <div className="bar-columns">
                {series.map((point, index) => {
                  const showLabel = range <= 7 || index % 5 === 0 || index === series.length - 1;
                  const height = point.count > 0 ? Math.max(3, (point.count / maxCount) * 100) : 0;
                  const label = `${point.date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}`;
                  return (
                    <div className={`bar-col${point.count === 0 ? ' empty' : ''}`} key={point.key}>
                      <div
                        className="bar-fill purchase-fill"
                        style={{ height: `${height}%` }}
                        title={`${label} · ${point.count} pembelian`}
                      />
                      <span className="bar-x">{showLabel ? `${point.date.getDate()}/${point.date.getMonth() + 1}` : ''}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="chart-empty">Belum ada transaksi pada periode ini.</div>
        )}
      </section>

      <div className="chart-grid">
        <section className="card chart-card">
          <div className="sectionhead">
            <div>
              <h2>Status pembayaran</h2>
              <div className="eyebrow">Distribusi seluruh transaksi</div>
            </div>
          </div>
          {hasData ? (
            <div className="donut-wrap">
              <div className="donut">
                <svg viewBox="0 0 140 140" role="img" aria-label={`${paidPercent}% transaksi lunas`}>
                  <circle cx="70" cy="70" r="54" fill="none" stroke="#eef0f6" strokeWidth="17" />
                  {(() => {
                    const circumference = 2 * Math.PI * 54;
                    let offset = 0;
                    return statusData.map(item => {
                      if (!item.count) return null;
                      const length = (item.count / receipts.length) * circumference;
                      const gap = activeStatusCount > 1 ? Math.min(3, length * 0.2) : 0;
                      const visible = Math.max(0.5, length - gap);
                      const circle = (
                        <circle
                          key={item.label}
                          cx="70"
                          cy="70"
                          r="54"
                          fill="none"
                          stroke={item.color}
                          strokeWidth="17"
                          strokeDasharray={`${visible} ${circumference - visible}`}
                          strokeDashoffset={-offset}
                          strokeLinecap="round"
                          transform="rotate(-90 70 70)"
                        >
                          <title>{`${item.label}: ${item.count} transaksi`}</title>
                        </circle>
                      );
                      offset += length;
                      return circle;
                    });
                  })()}
                </svg>
                <div className="donut-center">
                  <b>{paidPercent}%</b>
                  <span>lunas</span>
                </div>
              </div>
              <ul className="chart-legend">
                {statusData.map(item => (
                  <li key={item.label}>
                    <i style={{ background: item.color }} />
                    <span>{item.label}</span>
                    <b>{item.count}</b>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="chart-empty">Belum ada status pembayaran.</div>
          )}
        </section>

        <section className="card chart-card">
          <div className="sectionhead">
            <div>
              <h2>Metode pembayaran</h2>
              <div className="eyebrow">Nilai transaksi per metode</div>
            </div>
          </div>
          {hasData && methodData.length ? (
            <ul className="method-chart">
              {methodData.map((method, index) => (
                <li key={method.name}>
                  <div className="method-head">
                    <span>{method.name}</span>
                    <b>{rupiah(method.total)}</b>
                  </div>
                  <div className="method-track">
                    <i
                      style={{ width: `${Math.max(4, (method.total / methodMax) * 100)}%`, background: METHOD_COLORS[index % METHOD_COLORS.length] }}
                    />
                  </div>
                  <small>{method.count} transaksi</small>
                </li>
              ))}
            </ul>
          ) : (
            <div className="chart-empty">Belum ada data metode pembayaran.</div>
          )}
        </section>
      </div>
    </div>
  );
}
