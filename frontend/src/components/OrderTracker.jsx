import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Check, Package, Truck, Home, ClipboardList, XCircle, CalendarDays } from 'lucide-react';
import { formatDay, isPastDay } from '../utils/dates';

// Dispatch warehouse. Override in frontend/.env (see .env.example).
const WAREHOUSE = {
  name: import.meta.env.VITE_WAREHOUSE_NAME || 'Shopfront Warehouse',
  lat: Number(import.meta.env.VITE_WAREHOUSE_LAT) || 13.0827,
  lng: Number(import.meta.env.VITE_WAREHOUSE_LNG) || 80.2707,
};

const STEPS = [
  { key: 'Pending', label: 'Order placed', icon: ClipboardList, progress: 0 },
  { key: 'Processing', label: 'Packed & processing', icon: Package, progress: 0 },
  { key: 'Shipped', label: 'Out for delivery', icon: Truck, progress: 0.5 },
  { key: 'Delivered', label: 'Delivered', icon: Home, progress: 1 },
];

const fmtTime = (d) => (d ? new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '');

const geocode = async (address) => {
  const cacheKey = `geo:${address.pincode}:${address.city}`;
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch { /* storage unavailable */ }

  const queries = [
    { postalcode: address.pincode, country: 'India' },
    { q: `${address.city}, ${address.state}, India` },
  ];
  for (const params of queries) {
    if (params.postalcode === undefined && !params.q) continue;
    if (params.postalcode !== undefined && !params.postalcode) continue;
    try {
      const url = new URL('https://nominatim.openstreetmap.org/search');
      Object.entries({ ...params, format: 'json', limit: 1 }).forEach(([k, v]) => url.searchParams.set(k, v));
      const res = await fetch(url);
      const [hit] = await res.json();
      if (hit) {
        const point = { lat: Number(hit.lat), lng: Number(hit.lon) };
        try { sessionStorage.setItem(cacheKey, JSON.stringify(point)); } catch { /* ignore */ }
        return point;
      }
    } catch { /* try next query */ }
  }
  return null;
};

const dot = (color, size = 16) =>
  L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.4)"></div>`,
  });

const emoji = (char) =>
  L.divIcon({
    className: '',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    html: `<div style="width:34px;height:34px;border-radius:50%;background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.45)">${char}</div>`,
  });

const TrackingMap = ({ destination, progress, status }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return undefined;
    const map = L.map(ref.current, { scrollWheelZoom: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    const from = [WAREHOUSE.lat, WAREHOUSE.lng];
    const to = [destination.lat, destination.lng];
    const at = [from[0] + (to[0] - from[0]) * progress, from[1] + (to[1] - from[1]) * progress];

    L.polyline([from, to], { color: '#94a3b8', weight: 4, dashArray: '8 8' }).addTo(map);
    if (progress > 0) L.polyline([from, at], { color: '#059669', weight: 5 }).addTo(map);

    L.marker(from, { icon: dot('#0f172a') }).addTo(map).bindTooltip(WAREHOUSE.name);
    L.marker(to, { icon: dot(status === 'Delivered' ? '#059669' : '#f43f5e') }).addTo(map).bindTooltip('Delivery address');
    if (status === 'Shipped') L.marker(at, { icon: emoji('🚚'), zIndexOffset: 1000 }).addTo(map).bindTooltip('Your package (estimated)');

    map.fitBounds(L.latLngBounds([from, to]), { padding: [40, 40] });
    return () => map.remove();
  }, [destination, progress, status]);

  return <div ref={ref} className="h-72 w-full overflow-hidden rounded-2xl border border-slate-200 sm:h-80" />;
};

const OrderTracker = ({ order }) => {
  const [destination, setDestination] = useState(undefined); // undefined = loading, null = not found
  const addr = order.shippingAddress || {};

  useEffect(() => {
    let alive = true;
    geocode(addr).then((p) => alive && setDestination(p));
    return () => { alive = false; };
  }, [addr.pincode, addr.city, addr.state]); // eslint-disable-line react-hooks/exhaustive-deps

  if (order.status === 'Cancelled') {
    return (
      <section className="mb-6 flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-800">
        <XCircle size={22} /> <p className="text-sm font-semibold">This order was cancelled.</p>
      </section>
    );
  }
  if (order.status === 'Awaiting Payment') {
    return (
      <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-800">
        Waiting for payment. Tracking starts once your payment is confirmed.
      </section>
    );
  }

  const currentIdx = Math.max(0, STEPS.findIndex((s) => s.key === order.status));
  const history = order.statusHistory || [];
  const timeFor = (key) => {
    const entry = history.find((h) => h.status === key);
    if (entry) return entry.at;
    if (key === 'Pending') return order.createdAt;
    return null;
  };
  const progress = STEPS[currentIdx].progress;
  const deliveredAt = history.find((h) => h.status === 'Delivered')?.at;
  const overdue = order.status !== 'Delivered' && isPastDay(order.estimatedDelivery);

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex items-center gap-3">
        <Truck size={20} className="text-indigo-700" />
        <h2 className="text-lg font-bold">Track your order</h2>
      </div>

      {order.estimatedDelivery && (
        <div className={`mt-4 flex flex-wrap items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${order.status === 'Delivered' ? 'bg-emerald-50 text-emerald-800' : overdue ? 'bg-rose-50 text-rose-800' : 'bg-slate-50 text-slate-800'}`}>
          <CalendarDays size={16} />
          {order.status === 'Delivered'
            ? `Delivered${deliveredAt ? ` on ${formatDay(deliveredAt, true)}` : ''}`
            : overdue
              ? `Running late: was expected ${formatDay(order.estimatedDelivery, true)}`
              : `${order.scheduledDelivery ? 'Scheduled delivery' : 'Estimated delivery'}: ${formatDay(order.estimatedDelivery, true)}`}
        </div>
      )}

      <ol className="mt-6 grid gap-5 sm:grid-cols-4 sm:gap-2">
        {STEPS.map((step, i) => {
          const done = i <= currentIdx;
          const Icon = done && i < currentIdx ? Check : step.icon;
          return (
            <li key={step.key} className="relative flex gap-3 sm:flex-col sm:items-center sm:text-center">
              {i < STEPS.length - 1 && (
                <span aria-hidden className={`absolute left-[19px] top-10 h-[calc(100%-1rem)] w-0.5 sm:left-1/2 sm:top-[19px] sm:h-0.5 sm:w-full ${i < currentIdx ? 'bg-indigo-600' : 'bg-slate-200'}`} />
              )}
              <span className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 ${done ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-400'} ${i === currentIdx && order.status !== 'Delivered' ? 'ring-4 ring-emerald-100' : ''}`}>
                <Icon size={18} />
              </span>
              <div>
                <p className={`text-sm font-semibold ${done ? 'text-slate-900' : 'text-slate-400'}`}>{step.label}</p>
                <p className="mt-0.5 text-xs text-slate-500">{done ? fmtTime(timeFor(step.key)) : ''}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-7">
        {destination === undefined && <div className="h-72 animate-pulse rounded-2xl bg-slate-100" />}
        {destination === null && (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
            Map is unavailable for this address right now. Your order status above is up to date.
          </p>
        )}
        {destination && <TrackingMap destination={destination} progress={progress} status={order.status} />}
        {destination && (
          <p className="mt-2 text-xs text-slate-500">
            Package position on the map is estimated from the order stage, not live GPS.
          </p>
        )}
      </div>
    </section>
  );
};

export default OrderTracker;
