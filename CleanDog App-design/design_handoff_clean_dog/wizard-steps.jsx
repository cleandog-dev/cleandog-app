// wizard-steps.jsx — Steps 1-4 of the Clean Dog booking wizard
// Step components receive: { state, setState, next, back, goto }

const SIZES = [
  { id: 'XS', label: 'XS · Toy',   weight: '< 5 kg',     icon: 'dogXS' },
  { id: 'S',  label: 'S · Piccolo', weight: '5 – 10 kg',  icon: 'dogS'  },
  { id: 'M',  label: 'M · Medio',   weight: '10 – 20 kg', icon: 'dogM'  },
  { id: 'L',  label: 'L · Grande',  weight: '20 – 35 kg', icon: 'dogL'  },
  { id: 'XL', label: 'XL · Gigante', weight: '> 35 kg',    icon: 'dogXL' },
];

const COATS = [
  { id: 'short', label: 'Corto',  hint: 'Beagle, Boxer',     icon: 'coatShort' },
  { id: 'med',   label: 'Medio',  hint: 'Border, Labrador',  icon: 'coatMed'   },
  { id: 'long',  label: 'Lungo',  hint: 'Setter, Pastore',   icon: 'coatLong'  },
  { id: 'curly', label: 'Riccio', hint: 'Barbone, Lagotto',  icon: 'coatCurly' },
];

const SERVICES = [
  { id: 'bath',     name: 'Bagno & Asciugatura', desc: 'Shampoo naturale, asciugatura delicata',     price: 28, dur: 45, icon: 'bath',     color: 'sage' },
  { id: 'cut',      name: 'Taglio & Styling',     desc: 'Forbici, rifinitura su misura',              price: 38, dur: 60, icon: 'scissors', color: 'brown' },
  { id: 'full',     name: 'Toelettatura completa', desc: 'Bagno + taglio + unghie + orecchie',         price: 58, dur: 90, icon: 'full',     color: 'sage', popular: true },
  { id: 'nails',    name: 'Solo unghie',           desc: 'Taglio e limatura, 15 minuti',               price: 12, dur: 15, icon: 'nails',    color: 'brown' },
  { id: 'parasite', name: 'Anti-parassiti',        desc: 'Trattamento naturale anti-pulci e zecche',   price: 22, dur: 30, icon: 'shield',   color: 'sage' },
];

/* ───────────────────────────────────────────── 1 · WELCOME ─── */
function StepWelcome({ next }) {
  return (
    <div className="step-enter" style={{
      maxWidth: 560, margin: '0 auto', padding: '48px 24px 64px',
      textAlign: 'center', position: 'relative',
    }}>
      {/* Decorative paw cluster */}
      <div style={{ position: 'relative', height: 140, marginBottom: 12 }}>
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
                      width: 140, height: 140, borderRadius: '50%',
                      background: 'radial-gradient(circle, var(--sage-100), transparent 70%)',
                      animation: 'pulse-soft 4s var(--ease-soft) infinite' }} />
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
                      animation: 'floaty 6s var(--ease-soft) infinite' }}>
          <Icon name="paw" size={72} color="var(--sage-800)" />
        </div>
        <div style={{ position: 'absolute', left: '18%', top: '18%', opacity: 0.35,
                      animation: 'floaty 5s var(--ease-soft) infinite', animationDelay: '0.6s' }}>
          <Icon name="paw" size={28} color="var(--brown-700)" />
        </div>
        <div style={{ position: 'absolute', right: '14%', top: '60%', opacity: 0.4,
                      animation: 'floaty 7s var(--ease-soft) infinite', animationDelay: '1.4s' }}>
          <Icon name="paw" size={22} color="var(--brown-700)" />
        </div>
      </div>

      <div className="eyebrow" style={{ marginBottom: 16 }}>Toelettatura naturale · Milano</div>
      <h1 className="display" style={{ fontSize: 'clamp(44px, 8vw, 72px)', margin: '0 0 20px' }}>
        Una giornata di&nbsp;cura,<br/>
        <em style={{ color: 'var(--brown-700)', fontWeight: 400 }}>fatta con calma.</em>
      </h1>
      <p style={{ fontSize: 17, lineHeight: 1.55, color: 'var(--ink-700)', maxWidth: 420, margin: '0 auto 36px' }}>
        Bagno, taglio e coccole nel nostro studio di toelettatura artigianale.
        Prodotti naturali, mai più di due cani per volta.
      </p>

      <button className="btn btn-primary" onClick={next} style={{ fontSize: 16, padding: '16px 32px' }}>
        Prenota ora
        <Icon name="arrowRight" size={18} />
      </button>

      <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginTop: 40,
                    fontSize: 13, color: 'var(--ink-500)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Icon name="clock" size={16} /> Conferma in 5 min
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Icon name="bell" size={16} /> Promemoria automatici
        </span>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────── 2 · IL TUO CANE ─── */
function StepDog({ state, setState, next, back }) {
  const canContinue = state.dogName && state.size && state.coat;
  return (
    <div className="step-enter" style={{ maxWidth: 640, margin: '0 auto', padding: '32px 24px 48px' }}>
      <StepHeader eyebrow="Step 02 · Il tuo cane" title="Parlaci di lui" subtitle="Servono pochi dettagli per scegliere i prodotti giusti." />

      <label className="label">Come si chiama?</label>
      <input
        className="input"
        placeholder="es. Pepe, Luna, Argo…"
        value={state.dogName || ''}
        onChange={(e) => setState({ ...state, dogName: e.target.value })}
        style={{ marginBottom: 28 }}
        autoFocus
      />

      <label className="label">Taglia</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 28 }}>
        {SIZES.map((s) => (
          <SelectTile
            key={s.id}
            selected={state.size === s.id}
            onClick={() => setState({ ...state, size: s.id })}
            icon={s.icon}
            label={s.id}
            sub={s.weight}
          />
        ))}
      </div>

      <label className="label">Tipo di pelo</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 32 }}>
        {COATS.map((c) => (
          <SelectTile
            key={c.id}
            selected={state.coat === c.id}
            onClick={() => setState({ ...state, coat: c.id })}
            icon={c.icon}
            label={c.label}
            sub={c.hint}
            wide
          />
        ))}
      </div>

      <FooterNav back={back} next={next} canContinue={canContinue} />
    </div>
  );
}

function SelectTile({ selected, onClick, icon, label, sub, wide }) {
  return (
    <button
      onClick={onClick}
      className={`card card-selectable ${selected ? 'card-selected' : ''}`}
      style={{
        background: 'transparent',
        padding: wide ? '14px 12px' : '14px 8px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        font: 'inherit',
        color: 'inherit',
      }}
    >
      <Icon name={icon} size={wide ? 36 : 32} color={selected ? 'var(--sage-800)' : 'var(--ink-700)'} />
      <div style={{ fontSize: 14, fontWeight: 600, color: selected ? 'var(--sage-800)' : 'var(--ink-900)' }}>{label}</div>
      <div style={{ fontSize: 11, color: 'var(--ink-500)', lineHeight: 1.3 }}>{sub}</div>
    </button>
  );
}

/* ─────────────────────────────────────── 3 · SCEGLI I SERVIZI ─── */
function StepServices({ state, setState, next, back }) {
  const selected = state.services || [];
  const toggle = (id) => {
    const has = selected.includes(id);
    setState({ ...state, services: has ? selected.filter((s) => s !== id) : [...selected, id] });
  };
  const total = selected.reduce((sum, id) => sum + (SERVICES.find((s) => s.id === id)?.price || 0), 0);
  const dur = selected.reduce((sum, id) => sum + (SERVICES.find((s) => s.id === id)?.dur || 0), 0);
  const canContinue = selected.length > 0;

  return (
    <div className="step-enter" style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 48px' }}>
      <StepHeader eyebrow="Step 03 · Servizi" title="Cosa serve oggi?" subtitle="Combina liberamente — il prezzo si aggiorna in tempo reale." />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        {SERVICES.map((s) => {
          const isSel = selected.includes(s.id);
          return (
            <button
              key={s.id}
              onClick={() => toggle(s.id)}
              className={`card card-selectable ${isSel ? 'card-selected' : ''}`}
              style={{
                background: 'transparent',
                padding: '18px 20px',
                display: 'grid',
                gridTemplateColumns: '52px 1fr auto',
                alignItems: 'center',
                gap: 16,
                font: 'inherit',
                color: 'inherit',
                textAlign: 'left',
                position: 'relative',
              }}
            >
              <div style={{
                width: 52, height: 52,
                borderRadius: 14,
                background: isSel
                  ? (s.color === 'sage' ? 'var(--sage-100)' : 'var(--brown-100)')
                  : 'var(--cream-200)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background var(--dur-fast) var(--ease-soft)',
              }}>
                <Icon name={s.icon} size={28} color={isSel
                  ? (s.color === 'sage' ? 'var(--sage-800)' : 'var(--brown-700)')
                  : 'var(--ink-700)'} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 16, fontWeight: 600 }}>{s.name}</span>
                  {s.popular && <span className="badge badge-brown">Più richiesto</span>}
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-500)' }}>{s.desc}</div>
                <div style={{ display: 'flex', gap: 14, marginTop: 6, fontSize: 12, color: 'var(--ink-700)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Icon name="clock" size={12} /> {s.dur} min
                  </span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="display" style={{ fontSize: 26, lineHeight: 1, color: 'var(--sage-800)' }}>
                  €{s.price}
                </div>
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                  <CheckCircle on={isSel} />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selected.length > 0 && (
        <div className="card" style={{
          padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'var(--sage-100)', borderColor: 'var(--sage-300)', marginBottom: 24,
        }}>
          <div style={{ fontSize: 13, color: 'var(--sage-800)' }}>
            <strong>{selected.length}</strong> serviz{selected.length === 1 ? 'io' : 'i'} · {dur} min totali
          </div>
          <div className="display" style={{ fontSize: 22, color: 'var(--sage-800)' }}>€{total}</div>
        </div>
      )}

      <FooterNav back={back} next={next} canContinue={canContinue} />
    </div>
  );
}

function CheckCircle({ on }) {
  return (
    <div style={{
      width: 24, height: 24, borderRadius: '50%',
      border: on ? 'none' : '1.5px solid var(--cream-300)',
      background: on ? 'var(--sage-800)' : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all var(--dur-fast) var(--ease-organic)',
      transform: on ? 'scale(1)' : 'scale(0.95)',
    }}>
      {on && <Icon name="check" size={14} color="white" />}
    </div>
  );
}

/* ─────────────────────────────────────── 4 · DATA E ORA ─────── */
function StepDate({ state, setState, next, back }) {
  // Generate 14 days starting today
  const today = new Date(2026, 4, 4); // May 4, 2026 — fixed for demo determinism
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });
  const [monthIdx, setMonthIdx] = React.useState(0);

  const selectedDate = state.date;
  const slots = ['09:00', '10:00', '11:00', '12:00', '14:30', '15:30', '16:30', '17:30'];
  // Some slots are "booked" deterministically based on date
  const bookedFor = (dateKey) => {
    const seed = (dateKey.charCodeAt(dateKey.length - 1) || 0) % 7;
    return new Set(slots.filter((_, i) => (i + seed) % 5 === 0 || (i + seed) % 7 === 0));
  };
  const dateKey = selectedDate || '';
  const booked = bookedFor(dateKey);

  const canContinue = state.date && state.time;

  const dow = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
  const monthName = days[0].toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

  return (
    <div className="step-enter" style={{ maxWidth: 640, margin: '0 auto', padding: '32px 24px 48px' }}>
      <StepHeader eyebrow="Step 04 · Quando" title="Scegli giorno e ora" subtitle="Slot evidenziati = disponibili. Aggiorniamo l'agenda in tempo reale." />

      {/* Month strip */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 14, padding: '0 4px',
      }}>
        <span className="display" style={{ fontSize: 20, color: 'var(--ink-900)', textTransform: 'capitalize' }}>
          {monthName}
        </span>
        <span style={{ fontSize: 13, color: 'var(--ink-500)' }}>Prossimi 14 giorni</span>
      </div>

      {/* Day chips */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 28,
      }}>
        {days.map((d, i) => {
          const key = d.toISOString().slice(0, 10);
          const isSel = selectedDate === key;
          const isSun = d.getDay() === 0;
          const dayLabel = dow[(d.getDay() + 6) % 7];
          return (
            <button
              key={key}
              disabled={isSun}
              onClick={() => setState({ ...state, date: key, time: null })}
              className={`card card-selectable ${isSel ? 'card-selected' : ''}`}
              style={{
                background: isSun ? 'transparent' : 'var(--cream-50)',
                padding: '10px 4px',
                fontFamily: 'inherit',
                color: isSun ? 'var(--ink-300)' : 'var(--ink-900)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                opacity: isSun ? 0.5 : 1,
                cursor: isSun ? 'not-allowed' : 'pointer',
              }}
            >
              <span style={{ fontSize: 10, color: isSel ? 'var(--sage-800)' : 'var(--ink-500)', fontWeight: 600, letterSpacing: '0.1em' }}>{dayLabel}</span>
              <span className="display" style={{ fontSize: 22, color: isSel ? 'var(--sage-800)' : 'inherit' }}>{d.getDate()}</span>
              {isSun && <span style={{ fontSize: 9, color: 'var(--ink-300)' }}>chiuso</span>}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <>
          <label className="label">Slot disponibili</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginBottom: 32 }}>
            {slots.map((t) => {
              const isBooked = booked.has(t);
              const isSel = state.time === t;
              return (
                <button
                  key={t}
                  disabled={isBooked}
                  onClick={() => setState({ ...state, time: t })}
                  className={`card card-selectable ${isSel ? 'card-selected' : ''}`}
                  style={{
                    background: isBooked ? 'transparent' : 'var(--cream-50)',
                    padding: '12px 8px',
                    fontFamily: 'inherit',
                    fontSize: 15, fontWeight: 500,
                    color: isBooked ? 'var(--ink-300)' : (isSel ? 'var(--sage-800)' : 'var(--ink-900)'),
                    textDecoration: isBooked ? 'line-through' : 'none',
                    cursor: isBooked ? 'not-allowed' : 'pointer',
                    opacity: isBooked ? 0.6 : 1,
                  }}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </>
      )}

      <FooterNav back={back} next={next} canContinue={canContinue} />
    </div>
  );
}

/* ─── Shared bits ──────────────────────────────────────────── */
function StepHeader({ eyebrow, title, subtitle }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div className="eyebrow" style={{ marginBottom: 10 }}>{eyebrow}</div>
      <h2 className="display" style={{ fontSize: 'clamp(32px, 5vw, 44px)', margin: '0 0 8px' }}>{title}</h2>
      {subtitle && <p style={{ fontSize: 15, color: 'var(--ink-500)', margin: 0, maxWidth: 480 }}>{subtitle}</p>}
    </div>
  );
}

function FooterNav({ back, next, canContinue, nextLabel = 'Continua' }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 8 }}>
      <button className="btn btn-ghost" onClick={back}>
        <Icon name="arrowLeft" size={16} /> Indietro
      </button>
      <button className="btn btn-primary" onClick={next} disabled={!canContinue}>
        {nextLabel}
        <Icon name="arrowRight" size={16} />
      </button>
    </div>
  );
}

Object.assign(window, {
  StepWelcome, StepDog, StepServices, StepDate,
  StepHeader, FooterNav, SelectTile, CheckCircle,
  CD_SIZES: SIZES, CD_COATS: COATS, CD_SERVICES: SERVICES,
});
