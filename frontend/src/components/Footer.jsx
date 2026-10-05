import React from 'react';
import { ArrowUpRight, BriefcaseBusiness, Globe, MessageCircle, ShieldCheck, Sparkles, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';

const Footer = () => (
  <footer className="app-footer border-t border-slate-200 bg-slate-950 text-slate-200">
    <div className="section-shell py-12">
      <div className="rounded-[30px] border border-white/10 bg-white/5 p-5 sm:p-6">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
          <div className="lg:pr-6">
            <Link to="/" className="flex items-center gap-3 text-2xl font-black tracking-tight text-white">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-900">
                <Sparkles size={16} />
              </span>
              SHOP-NOW
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-6 text-slate-300">
              Thoughtful essentials for everyday living. Premium products, curated for modern lifestyles and elevated routines.
            </p>

            <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-300">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                <Truck size={14} /> Free delivery over ₹2000
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                <ShieldCheck size={14} /> Secure checkout
              </span>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">Shop</h3>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              <li><Link to="/" className="inline-flex items-center gap-2 hover:text-white">Products <ArrowUpRight size={12} /></Link></li>
              <li><a href="/#categories" className="inline-flex items-center gap-2 hover:text-white">Categories <ArrowUpRight size={12} /></a></li>
              <li><Link to="/orders" className="inline-flex items-center gap-2 hover:text-white">Orders <ArrowUpRight size={12} /></Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">Customer</h3>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              <li><Link to="/orders" className="hover:text-white">Track order</Link></li>
              <li><Link to="/cart" className="hover:text-white">Shopping bag</Link></li>
              <li><Link to="/login" className="hover:text-white">Account</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">Social</h3>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              <li><a href="https://instagram.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:text-white"><Globe size={14} /> Instagram</a></li>
              <li><a href="https://facebook.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:text-white"><MessageCircle size={14} /> Facebook</a></li>
              <li><a href="https://linkedin.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:text-white"><BriefcaseBusiness size={14} /> LinkedIn</a></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3 border-t border-slate-800 pt-6 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <p>© 2026 SHOP-NOW</p>
        <p>Crafted for premium everyday lifestyles</p>
      </div>
    </div>
  </footer>
);

export default Footer;
