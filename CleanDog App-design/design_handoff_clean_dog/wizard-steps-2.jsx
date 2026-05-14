// wizard-steps-2.jsx — Steps 5-7 + Reminders panel

/* ─────────────────────────────────────── 5 · DATI CONTATTO ─── */
function StepContact({ state, setState, next, back }) {
  const phoneOk = (state.phone || '').replace(/\D/g, '').length >= 9;
  const canContinue = state.userName && phoneOk;
  return (
    <div className="step-enter" style={{ maxWidth: 560, margin: '0 auto', padding: '32px 24px 48px' }}>
      <StepHeader eyebrow="Step 05 · I tuoi dati" title="Come ti chiami?" subtitle="Useremo questi dati solo per la prenotazione e i promemoria." />

      <label className="label">Nome e cognome</label>
      <input className="input" placeholder="Mario Rossi"
        value={state.userName || ''}
        onChange={(e) => setState({ ...state, userName: e.target.value })}
        style={{ marginBottom: 20 }} autoFocus />

      <label className="label">Telefono</label>
      <input className="input" placeholder="+39 333 123 4567" inputMode="tel"
        value={state.phone || ''}
        onChange={(e) => setState({ ...state, phone: e.target.value })}
        style={{ marginBottom: 20 }} />

      <label className="label">Email <span style={{ color: 'var(--ink-300)', fontWeight: 400 }}>· opzionale</span></label>
      <input className="input" placeholder="mario@example.com" inputMode="email"
        value={state.email || ''}
        onChange={(e) => setState({ ...state, email: e.target.value })}
        style={{ marginBottom: 20 }} />

      <label className="label">Note per il toelettatore <span style={{ color: 'var(--ink-300)', fontWeight: 400 }}>· opzionale</span></label>
      <textarea className="textarea" placeholder="È pauroso con il phon, preferisce le coccole prima del bagno…"
        value={state.notes || ''}
        onChange={(e) => setState({ ...state, notes: e.target.value })}
        style={{ marginBottom: 20 }} />

      {/* Notification preferences */}
      <div className="card" style={{ padding: 18, marginBottom: 28, background: 'var(--cream-50)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <Icon name="bell" size={20} color="var(--sage-800)" />
          <strong style={{ fontSize: 14 }}>Promemoria automatici</strong>
        </div>
        <p style={{ fontSize: 13, color: 'var(--ink-500)', margin: '0 0 12px' }}>
          Ti scriviamo prima dell'appuntamento per non farti dimenticare.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { id: 'sms', label: 'SMS · 24h prima' },
            { id: 'email', label: 'Email · 24h prima', disabled: !state.email },
            { id: 'whatsapp', label: 'WhatsApp · 2h prima' },
          ].map((o) => {
            const reminders = state.reminders || ['sms', 'whatsapp'];
            const on = reminders.includes(o.id);
            return (
              <label key={o.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                fontSize: 13, color: o.disabled ? 'var(--ink-300)' : 'var(--ink-700)',
                cursor: o.disabled ? 'not-allowed' : 'pointer',
              }}>
                <input
                  type="checkbox" checked={on} disabled={o.disabled}
                  onChange={() => {
                    const cur = state.reminders || ['sms', 'whatsapp'];
                    setState({ ...state, reminders: on ? cur.filter((r) => r !== o.id) : [...cur, o.id] });
                  }}
                  style={{ accentColor: 'var(--sage-800)', width: 16, height: 16 }}
                />
                {o.label}
                {o.disabled && <span style={{ fontSize: 11, color: 'var(--ink-300)' }}>· aggiungi email</span>}
              </label>
            );
          })}
        </div>
      </div>

      <FooterNav back={back} next={next} canContinue={canContinue} />
    </div>
  );
}

/* ───────────────────────────────────── 6 · RIEPILOGO ───────── */
function StepSummary({ state, next, back, goto }) {
  const services = (state.services || []).map((id) => CD_SERVICES.find((s) => s.id === id)).filter(Boolean);
  const total = services.reduce((s, x) => s + x.price, 0);
  const dur = services.reduce((s, x) => s + x.dur, 0);
  const dateObj = state.date ? new Date(state.date) : null;
  const dateLabel = dateObj
    ? dateObj.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
    : '';
  const sizeLabel = CD_SIZES.find((s) => s.id === state.size)?.label;
  const coatLabel = CD_COATS.find((c) => c.id === state.coat)?.label;

  return (
    <div className="step-enter" style={{ maxWidth: 600, margin: '0 auto', padding: '32px 24px 48px' }}>
      <StepHeader eyebrow="Step 06 · Riepilogo" title="Tutto pronto?" subtitle="Controlla i dettagli e conferma la prenotazione." />

      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
        {/* Date hero */}
        <div style={{
          padding: '20px 24px 22px',
          background: 'linear-gradient(180deg, var(--sage-100), var(--cream-50))',
          borderBottom: '1px dashed var(--cream-300)',
          position: 'relative',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div className="eyebrow">Appuntamento</div>
            <button onClick={() => goto(3)} className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }}>
              <Icon name="edit" size={12} /> modifica
            </button>
          </div>
          <div className="display" style={{
            fontSize: 'clamp(22px, 4.6vw, 30px)',
            color: 'var(--sage-800)',
            textTransform: 'capitalize',
            lineHeight: 1.18,
            marginBottom: 6,
            textWrap: 'balance',
          }}>
            {dateLabel}
          </div>
          <div style={{ fontSize: 15, color: 'var(--ink-700)' }}>
            alle <strong>{state.time}</strong> · circa {dur} min
          </div>
        </div>

        {/* Dog */}
        <SummaryRow
          label="Cane"
          value={`${state.dogName} · ${sizeLabel} · pelo ${coatLabel?.toLowerCase()}`}
          onEdit={() => goto(1)}
          icon="paw"
        />

        {/* Services */}
        <div style={{ padding: '16px 24px', borderTop: '1px dashed var(--cream-300)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
              Servizi
            </span>
            <button onClick={() => goto(2)} className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 12 }}>
              <Icon name="edit" size={12} /> modifica
            </button>
          </div>
          {services.map((s) => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed var(--cream-200)', fontSize: 14 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Icon name={s.icon} size={18} color="var(--brown-700)" />
                {s.name}
              </span>
              <span style={{ color: 'var(--ink-700)' }}>€{s.price}</span>
            </div>
          ))}
        </div>

        {/* Contact */}
        <SummaryRow
          label="Contatti"
          value={`${state.userName} · ${state.phone}`}
          sub={state.email || null}
          onEdit={() => goto(4)}
          icon="phone"
        />

        {/* Reminders */}
        <div style={{ padding: '14px 24px', borderTop: '1px dashed var(--cream-300)',
                      display: 'flex', alignItems: 'center', gap: 10, color: 'var(--sage-800)',
                      background: 'var(--sage-100)', fontSize: 13 }}>
          <Icon name="bell" size={18} />
          <span>Riceverai un promemoria via {(state.reminders || ['sms']).join(' + ').toUpperCase()}</span>
        </div>

        {/* Total */}
        <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: 'var(--cream-50)' }}>
          <div style={{ fontSize: 13, color: 'var(--ink-500)' }}>Totale stimato · paghi in negozio</div>
          <div className="display" style={{ fontSize: 36, color: 'var(--sage-800)' }}>€{total}</div>
        </div>
      </div>

      {state.notes && (
        <div className="card" style={{ padding: '14px 18px', marginBottom: 20, background: 'var(--cream-50)' }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Note</div>
          <div style={{ fontSize: 14, color: 'var(--ink-700)', fontStyle: 'italic' }}>"{state.notes}"</div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <button className="btn btn-ghost" onClick={back}>
          <Icon name="arrowLeft" size={16} /> Indietro
        </button>
        <button className="btn btn-primary" onClick={next} style={{ padding: '16px 28px' }}>
          Conferma prenotazione
          <Icon name="check" size={16} />
        </button>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, sub, icon, onEdit }) {
  return (
    <div style={{ padding: '14px 24px', borderTop: '1px dashed var(--cream-300)',
                  display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, background: 'var(--cream-200)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon name={icon} size={18} color="var(--brown-700)" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 2 }}>
          {label}
        </div>
        <div style={{ fontSize: 14, color: 'var(--ink-900)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
          {value}
        </div>
        {sub && <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>{sub}</div>}
      </div>
      {onEdit && (
        <button onClick={onEdit} className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 12 }}>
          <Icon name="edit" size={12} />
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────────────────── 7 · SUCCESS ────────── */
function StepSuccess({ state, restart }) {
  const dateObj = state.date ? new Date(state.date) : null;
  const dateLabel = dateObj
    ? dateObj.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
    : '';
  // Confetti pieces
  const pieces = React.useMemo(() => Array.from({ length: 24 }, (_, i) => ({
    id: i,
    cx: (Math.random() - 0.5) * 600,
    cy: 200 + Math.random() * 400,
    cr: (Math.random() - 0.5) * 540,
    delay: Math.random() * 0.6,
    color: ['var(--sage-800)', 'var(--sage-600)', 'var(--brown-700)', 'var(--brown-300)', 'var(--cream-300)'][i % 5],
    shape: i % 3,
  })), []);

  return (
    <div className="step-enter" style={{ maxWidth: 520, margin: '0 auto', padding: '48px 24px 64px', textAlign: 'center', position: 'relative' }}>
      {/* Confetti */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {pieces.map((p) => (
          <span key={p.id} style={{
            position: 'absolute', left: '50%', top: 80,
            width: p.shape === 0 ? 8 : 6,
            height: p.shape === 1 ? 14 : 8,
            background: p.color,
            borderRadius: p.shape === 2 ? '50%' : 2,
            ['--cx']: `${p.cx}px`,
            ['--cy']: `${p.cy}px`,
            ['--cr']: `${p.cr}deg`,
            animation: `confetti 1.6s ${p.delay}s var(--ease-soft) forwards`,
          }} />
        ))}
      </div>

      {/* Animated check */}
      <div style={{
        width: 120, height: 120, borderRadius: '50%',
        background: 'var(--sage-100)',
        margin: '0 auto 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'pulse-soft 2.4s var(--ease-soft) infinite',
        position: 'relative', zIndex: 1,
      }}>
        <svg width="64" height="64" viewBox="0 0 44 44">
          <path d="M10 22l8 8 16-16"
                fill="none" stroke="var(--sage-800)" strokeWidth="3.5"
                strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray="50" strokeDashoffset="50"
                style={{ animation: 'draw 0.8s 0.2s var(--ease-organic) forwards' }} />
        </svg>
      </div>

      <div className="eyebrow" style={{ marginBottom: 12, color: 'var(--sage-800)' }}>Prenotazione confermata</div>
      <h1 className="display" style={{ fontSize: 'clamp(38px, 6vw, 56px)', margin: '0 0 16px' }}>
        A presto, <em style={{ color: 'var(--brown-700)', fontWeight: 400 }}>{state.userName?.split(' ')[0] || 'amico'}</em>!
      </h1>
      <p style={{ fontSize: 16, color: 'var(--ink-700)', margin: '0 auto 36px', maxWidth: 380, lineHeight: 1.5 }}>
        Ti aspettiamo <strong style={{ color: 'var(--sage-800)', textTransform: 'capitalize' }}>{dateLabel}</strong> alle <strong>{state.time}</strong>.
        {state.dogName && <> Lavato e profumato, {state.dogName} tornerà a casa felice.</>}
      </p>

      <div className="card" style={{
        padding: '16px 18px', marginBottom: 28, textAlign: 'left',
        background: 'var(--cream-50)', display: 'flex', gap: 14, alignItems: 'flex-start',
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, background: 'var(--sage-100)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon name="bell" size={20} color="var(--sage-800)" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Promemoria automatici attivi</div>
          <div style={{ fontSize: 13, color: 'var(--ink-500)', lineHeight: 1.5 }}>
            Ti contatteremo automaticamente prima dell'appuntamento.
            Nessuna ansia, ci pensiamo noi.
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
        <button className="btn btn-secondary" onClick={() => alert('Aggiunto al tuo calendario.')}>
          <Icon name="calendar" size={16} /> Aggiungi al calendario
        </button>
        <button className="btn btn-ghost" onClick={restart} style={{ fontSize: 13, color: 'var(--ink-500)' }}>
          Prenota un altro appuntamento
        </button>
      </div>
    </div>
  );
}

/* ─── Notifications panel — preview of automated reminders ─── */
function RemindersPanel({ state, onClose }) {
  const dateObj = state.date ? new Date(state.date) : null;
  const dateLabel = dateObj
    ? dateObj.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })
    : '—';
  const reminders = state.reminders || ['sms', 'whatsapp'];
  const dogName = state.dogName || 'il tuo cane';

  const messages = [
    {
      when: 'Subito · ora',
      channel: 'EMAIL',
      title: 'Conferma prenotazione',
      body: `Ciao ${state.userName?.split(' ')[0] || 'amico'}, abbiamo riservato il tuo slot del ${dateLabel} alle ${state.time}. Aggiungi al calendario.`,
      sent: true,
    },
    reminders.includes('sms') && {
      when: '24h prima',
      channel: 'SMS',
      title: 'Promemoria appuntamento',
      body: `🐾 Domani alle ${state.time} aspettiamo ${dogName} per la sua coccola. Per spostare: rispondi 1.`,
    },
    reminders.includes('whatsapp') && {
      when: '2h prima',
      channel: 'WHATSAPP',
      title: 'Tra poco ci vediamo',
      body: `Tra 2 ore inizia l'appuntamento di ${dogName}. Indirizzo: Via dei Glicini 12, Milano.`,
    },
    {
      when: 'Dopo il bagno',
      channel: 'WHATSAPP',
      title: 'Tutto pronto!',
      body: `${dogName} è bellissimo e ti aspetta. Foto in arrivo 📸`,
    },
    {
      when: '4 settimane dopo',
      channel: 'EMAIL',
      title: 'È ora di un altro bagno?',
      body: `Sono passate 4 settimane dall'ultima toelettatura. Riprenota con un click.`,
    },
  ].filter(Boolean);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'rgba(31, 26, 20, 0.4)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      animation: 'stepEnter 0.3s var(--ease-soft)',
    }}
    onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--cream-50)', borderRadius: 24,
        maxWidth: 480, width: '100%', maxHeight: '88vh', overflow: 'auto',
        boxShadow: 'var(--shadow-lg)', border: '1px solid var(--cream-300)',
      }}>
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--cream-200)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, background: 'var(--cream-50)', zIndex: 1,
        }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Sistema automatico</div>
            <h3 className="display" style={{ fontSize: 22, margin: 0 }}>I tuoi promemoria</h3>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: 8 }}>
            <Icon name="close" size={16} />
          </button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.map((m, i) => (
            <div key={i} className="card" style={{ padding: 14, background: m.sent ? 'var(--sage-100)' : 'var(--cream-50)', borderColor: m.sent ? 'var(--sage-300)' : 'var(--cream-300)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: 11, letterSpacing: '0.1em' }}>
                <span style={{ color: 'var(--brown-700)', fontWeight: 600 }}>{m.channel}</span>
                <span style={{ color: 'var(--ink-500)' }}>{m.when}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{m.title}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-700)', lineHeight: 1.45 }}>{m.body}</div>
              {m.sent && (
                <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--sage-800)' }}>
                  <Icon name="check" size={11} /> inviato
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ padding: '14px 20px', background: 'var(--cream-100)', fontSize: 12, color: 'var(--ink-500)', textAlign: 'center', borderTop: '1px solid var(--cream-200)' }}>
          Tutti gli invii sono completamente automatici. Puoi disattivarli nel pannello account.
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { StepContact, StepSummary, StepSuccess, SummaryRow, RemindersPanel });
