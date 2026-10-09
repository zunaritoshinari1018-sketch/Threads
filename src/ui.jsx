import React from 'react';
import { X, ChevronRight, ArrowUpRight, HelpCircle } from 'lucide-react';
import { PLATFORMS } from './domain.js';

export function Button({ children, variant = 'secondary', size = '', icon: Icon, className = '', type = 'button', disabled = false, onClick, title }) {
  return <button className={`btn btn-${variant} ${size ? `btn-${size}` : ''} ${className}`} type={type} disabled={disabled} onClick={onClick} title={title}>
    {Icon && <Icon size={16} strokeWidth={1.9} />}{children}
  </button>;
}

export function PageHeader({ eyebrow, title, description, actions, icon: Icon }) {
  return <div className="page-header">
    <div className="page-heading">
      {Icon && <span className="page-heading-icon"><Icon size={21} /></span>}
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
    </div>
    {actions && <div className="page-actions">{actions}</div>}
  </div>;
}

export function Pill({ children, tone = 'neutral', dot = false, className = '' }) {
  return <span className={`pill pill-${tone} ${dot ? 'pill-dot' : ''} ${className}`}>{dot && <i />}{children}</span>;
}

export function PlatformBadge({ platform, compact = false }) {
  const item = PLATFORMS.find((entry) => entry.id === platform) || { id: platform || 'unknown', label: platform || '不明', short: '?', color: '#64748b' };
  return <span className={`platform-badge ${compact ? 'platform-badge-compact' : ''}`}>
    <span className="platform-icon" style={{ '--platform-color': item.color }}>{item.short}</span>{!compact && item.label}
  </span>;
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return <div className="empty-state">
    <div className="empty-icon">{Icon ? <Icon size={22} strokeWidth={1.8} /> : <span>＋</span>}</div>
    <strong>{title}</strong><p>{description}</p>{action && <div className="empty-action">{action}</div>}
  </div>;
}

export function Card({ title, subtitle, action, children, className = '', padding = '' }) {
  return <section className={`card ${padding ? `card-${padding}` : ''} ${className}`}>
    {(title || action) && <div className="card-head"><div>{title && <h2>{title}</h2>}{subtitle && <p>{subtitle}</p>}</div>{action}</div>}
    {children}
  </section>;
}

export function Modal({ open, onClose, title, subtitle, children, footer, wide = false }) {
  if (!open) return null;
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
    <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" onClick={onClose} aria-label="閉じる"><X size={18} /></button></div>
      <div className="modal-body">{children}</div>
      {footer && <div className="modal-footer">{footer}</div>}
    </div>
  </div>;
}

export function Field({ label, hint, children, required = false, className = '' }) {
  return <label className={`field ${className}`}>
    <span className="field-label">{label}{required && <em>必須</em>}{hint && <small title={hint}><HelpCircle size={13} /></small>}</span>
    {children}
    {hint && <span className="field-hint">{hint}</span>}
  </label>;
}

export function TextInput({ value, onChange, placeholder, type = 'text', ...props }) {
  return <input value={value ?? ''} type={type} onChange={(event) => onChange?.(event.target.value)} placeholder={placeholder} {...props} />;
}

export function TextArea({ value, onChange, placeholder, rows = 3, ...props }) {
  return <textarea value={value ?? ''} rows={rows} onChange={(event) => onChange?.(event.target.value)} placeholder={placeholder} {...props} />;
}

export function SelectInput({ value, onChange, options, placeholder, ...props }) {
  return <select value={value ?? ''} onChange={(event) => onChange?.(event.target.value)} {...props}>
    {placeholder && <option value="">{placeholder}</option>}
    {options.map((option) => {
      const item = typeof option === 'string' ? { value: option, label: option } : option;
      return <option key={item.value} value={item.value} disabled={item.disabled}>{item.label}</option>;
    })}
  </select>;
}

export function ToggleChip({ checked, children, onChange, className = '' }) {
  return <button type="button" className={`toggle-chip ${checked ? 'is-selected' : ''} ${className}`} onClick={() => onChange?.(!checked)}>{children}{checked && <span>✓</span>}</button>;
}

export function DataOrigin({ origin, status }) {
  const values = {
    official_api: ['公式API実測', 'blue'],
    manual: ['手入力', 'neutral'],
    imported: ['インポート', 'violet'],
    ai_generated: ['AI生成', 'purple'],
    ai_estimated: ['AI推定', 'amber'],
    derived: ['ローカル生成・派生', 'teal'],
  };
  const [label, tone] = values[origin] || ['未分類', 'neutral'];
  return <span className="origin-wrap"><Pill tone={tone}>{label}</Pill>{status && <span className="origin-status">{status}</span>}</span>;
}

export function DateLabel({ date, fallback = '—' }) {
  if (!date) return fallback;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' }).format(parsed);
}

export function LinkButton({ href, children }) {
  return <a className="link-button" href={href} target="_blank" rel="noreferrer">{children}<ArrowUpRight size={13} /></a>;
}

export function BreadcrumbLabel({ children }) {
  return <div className="breadcrumb-label">Workspace <ChevronRight size={13} /> {children}</div>;
}

export function formatNumber(value) {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return '未取得';
  return new Intl.NumberFormat('ja-JP').format(Number(value));
}

export function formatRate(value) {
  return value === null || value === undefined ? '算出不可' : `${Number(value).toFixed(1)}%`;
}
