import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  AlertTriangle,
  Boxes,
  CalendarDays,
  Check,
  ClipboardList,
  Copy,
  Home,
  Navigation,
  Package,
  RotateCcw,
  ShieldCheck,
  Truck,
  XCircle,
} from 'lucide-react';
import { formatDay, isPastDay } from '../utils/dates';

// Dispatch warehouse
const WAREHOUSE = {
  name: import.meta.env.VITE_WAREHOUSE_NAME || 'Shopfront Central Warehouse',
  lat: Number(import.meta.env.VITE_WAREHOUSE_LAT) || 13.0827,
  lng: Number(import.meta.env.VITE_WAREHOUSE_LNG) || 80.2707,
};

// Logistics timeline steps
const TIMELINE_STEPS = [
  { key: 'Confirmed', label: 'Order Confirmed', icon: ClipboardList, progress: 0.1 },
  { key: 'Packed', label: 'Packed', icon: Package, progress: 0.25 },
  { key: 'Picked Up', label: 'Picked Up', icon: Boxes, progress: 0.45 },
  { key: 'In Transit', label: 'In Transit', icon: Truck, progress: 0.65 },
  { key: 'Out for Delivery', label: 'Out for Delivery', icon: Navigation, progress: 0.85 },
  { key: 'Delivered', label: 'Delivered', icon: Home, progress: 1.0 },
];

const fmtTime = (d) => (d ? new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '');

const geocode = async (address) => {
  const cacheKey = `geo:${address.pincode}:${address.city}`;
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch {
    /* storage unavailable */
  }

  const queries = [
    { postalcode: address.pincode, country: 'India' },
    { q: `${address.city}, ${address.state}, India` },
  ];
  for (const params of queries) {
    if (params.postalcode === undefined && !params.q) continue;
    if (params.postalcode !== undefined && !params.postalcode) continue;
    try {
      const url = new URL('https://nominatim.openstreetmap.org/search');
      Object.entries({ ...params, format: 'json', limit: 1 }).forEach(([k, v]) =>
        url.searchParams.set(k, v)
      );
      const res = await fetch(url);
      const [hit] = await res.json();
      if (hit) {
        const point = { lat: Number(hit.lat), lng: Number(hit.lon) };
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(point));
        } catch {
          /* ignore */
        }
        return point;
      }
    } catch {
      /* try next query */
    }
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
    if (['Shipped', 'In Transit', 'Out for Delivery'].includes(status)) {
      L.marker(at, { icon: emoji('🚚'), zIndexOffset: 1000 }).addTo(map).bindTooltip('Package in transit');
    }

    map.fitBounds(L.latLngBounds([from, to]), { padding: [40, 40] });
    return () => map.remove();
  }, [destination, progress, status]);

  return <div ref={ref} className="h-72 w-full overflow-hidden rounded-2xl border border-slate-200 sm:h-80" />;
};

const OrderTracker = ({ order }) => {
  const [destination, setDestination] = useState(undefined);
  const [copied, setCopied] = useState(false);
  const addr = order.shippingAddress || {};

  useEffect(() => {
    let alive = true;
    geocode(addr).then((p) => alive && setDestination(p));
    return () => {
      alive = false;
    };
  }, [addr.pincode, addr.city, addr.state]); // eslint-disable-line react-hooks/exhaustive-deps

  if (order.status === 'Cancelled') {
    return (
      <section className="mb-6 flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-800">
        <XCircle size={22} />
        <div>
          <p className="text-sm font-semibold">This order was cancelled.</p>
          <p className="text-xs text-rose-600 mt-0.5">
            Items have been returned to warehouse stock and refund credited to your wallet.
          </p>
        </div>
      </section>
    );
  }

  if (order.status === 'Awaiting Payment') {
    return (
      <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-800">
        Waiting for payment confirmation. Tracking begins once payment is verified.
      </section>
    );
  }

  const deliveryPartner = order.deliveryPartner || order.shipment?.deliveryPartner;
  const trackingNumber = order.trackingNumber || order.shipment?.trackingNumber;
  const shipment = order.shipment || {};

  // Map order status to timeline step index
  const getStepIndex = (status) => {
    switch (status) {
      case 'Pending':
      case 'Confirmed':
        return 0;
      case 'Packed':
      case 'Processing':
        return 1;
      case 'Shipped':
      case 'Picked Up':
        return 2;
      case 'In Transit':
        return 3;
      case 'Out for Delivery':
        return 4;
      case 'Delivered':
        return 5;
      case 'Failed Delivery':
        return 4;
      case 'RTO Initiated':
      case 'RTO Delivered':
        return 3;
      default:
        return 0;
    }
  };

  const currentIdx = getStepIndex(order.deliveryStatus || order.status);
  const history = shipment.statusHistory || order.statusHistory || [];

  const timeFor = (key) => {
    const entry = history.find((h) => h.status === key);
    if (entry) return entry.at;
    if (key === 'Confirmed' || key === 'Pending') return order.createdAt;
    return null;
  };

  const progress = TIMELINE_STEPS[currentIdx]?.progress || 0.1;
  const deliveredAt = history.find((h) => h.status === 'Delivered')?.at;
  const overdue = order.status !== 'Delivered' && isPastDay(order.estimatedDelivery);

  const copyTracking = () => {
    if (!trackingNumber) return;
    navigator.clipboard.writeText(trackingNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
            <Truck size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Live Delivery Tracking</h2>
            <p className="text-xs text-slate-500">Real-time parcel logistics and shipment milestones</p>
          </div>
        </div>

        {order.estimatedDelivery && (
          <div
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold ${
              order.status === 'Delivered'
                ? 'bg-emerald-50 text-emerald-800'
                : overdue
                ? 'bg-rose-50 text-rose-800'
                : 'bg-slate-50 text-slate-700 border border-slate-200/60'
            }`}
          >
            <CalendarDays size={14} />
            <span>
              {order.status === 'Delivered'
                ? `Delivered${deliveredAt ? ` on ${formatDay(deliveredAt, true)}` : ''}`
                : overdue
                ? `Expected ${formatDay(order.estimatedDelivery, true)}`
                : `Estimated Delivery: ${formatDay(order.estimatedDelivery, true)}`}
            </span>
          </div>
        )}
      </div>

      {/* Courier & AWB Details Banner */}
      <div className="mt-5 rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50/70 via-indigo-50/40 to-slate-50 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm">
              <Truck size={18} />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-800">
                Logistics Partner
              </span>
              <p className="text-sm font-bold text-slate-900">
                {deliveryPartner?.name || 'Assigned Express Courier'}
              </p>
              {deliveryPartner?.phone && (
                <p className="text-[11px] text-slate-500">Contact: {deliveryPartner.phone}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {trackingNumber && (
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  AWB Tracking Number
                </span>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className="font-mono text-xs font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                    {trackingNumber}
                  </span>
                  <button
                    onClick={copyTracking}
                    className="text-slate-400 hover:text-slate-700 p-1"
                    title="Copy AWB number"
                  >
                    {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            )}

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Current Status
              </span>
              <span className="mt-0.5 inline-block font-bold text-xs text-indigo-700">
                {order.deliveryStatus || order.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* NDR / Delivery Failed Alert */}
      {order.status === 'Failed Delivery' && (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-start gap-3">
          <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Delivery Attempt Unsuccessful</p>
            <p className="mt-0.5 text-rose-700">
              {shipment.failedReason ||
                'Customer was unavailable or address unreachable. Our delivery partner will re-attempt delivery.'}
            </p>
          </div>
        </div>
      )}

      {/* RTO Alert */}
      {['RTO Initiated', 'RTO Delivered'].includes(order.status) && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 flex items-start gap-3">
          <RotateCcw size={18} className="text-amber-700 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Return to Origin (RTO) Initiated</p>
            <p className="mt-0.5 text-amber-800">
              {shipment.rtoReason ||
                'Package is being safely returned to our dispatch fulfillment center.'}
            </p>
          </div>
        </div>
      )}

      {/* 6-Step Visual Timeline */}
      <div className="mt-7">
        <ol className="grid gap-5 sm:grid-cols-6 sm:gap-1">
          {TIMELINE_STEPS.map((step, i) => {
            const isCompleted = i <= currentIdx;
            const isCurrent = i === currentIdx;
            const Icon = isCompleted && i < currentIdx ? Check : step.icon;

            return (
              <li
                key={step.key}
                className="relative flex gap-3 sm:flex-col sm:items-center sm:text-center"
              >
                {i < TIMELINE_STEPS.length - 1 && (
                  <span
                    aria-hidden
                    className={`absolute left-[19px] top-10 h-[calc(100%-1rem)] w-0.5 sm:left-1/2 sm:top-[19px] sm:h-0.5 sm:w-full ${
                      i < currentIdx ? 'bg-indigo-600' : 'bg-slate-200'
                    }`}
                  />
                )}
                <span
                  className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition ${
                    isCompleted
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-slate-200 bg-white text-slate-400'
                  } ${isCurrent && order.status !== 'Delivered' ? 'ring-4 ring-emerald-100' : ''}`}
                >
                  <Icon size={16} />
                </span>
                <div>
                  <p
                    className={`text-xs font-semibold ${
                      isCompleted ? 'text-slate-900' : 'text-slate-400'
                    }`}
                  >
                    {step.label}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    {isCompleted ? fmtTime(timeFor(step.key)) : ''}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Map visualization */}
      <div className="mt-8">
        {destination === undefined && (
          <div className="h-72 animate-pulse rounded-2xl bg-slate-100" />
        )}
        {destination === null && (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
            Map coordinates unavailable for this address. Your order status milestones above are up to date.
          </p>
        )}
        {destination && (
          <TrackingMap destination={destination} progress={progress} status={order.status} />
        )}
        {destination && (
          <p className="mt-2 text-xs text-slate-400">
            Package transit position on the map is estimated from the dispatch checkpoint.
          </p>
        )}
      </div>
    </section>
  );
};

export default OrderTracker;
