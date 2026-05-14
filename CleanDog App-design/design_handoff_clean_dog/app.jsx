// app.jsx — Clean Dog booking wizard shell

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "sage",
  "headerStyle": "minimal",
  "showProgressBar": true,
  "showDesignSystem": false
}/*EDITMODE-END*/;

const STEP_LABELS = ['Welcome', 'Cane', 'Servizi', 'Data', 'Contatti', 'Riepilogo', 'Successo'];

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [step, setStep] = React.useState(0);
  const [state, setState] = React.useState({
    dogName: '', size: null, coat: null,
    services: [],
    date: null, time: null,
    userName: '', phone: '', email: '', notes: '',
    reminders: ['sms', 'whatsapp'],
  });
  const [showReminders, setShowReminders] = React.useState(false);

  const totalSteps = 7;
  const next = () => setStep((s) => Math.min(totalSteps - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));
  const goto = (n) => setStep(Math.max(0, Math.min(totalSteps - 1, n)));
  const restart = () => {
    setStep(0);
    setState({
      dogName: '', size: null, coat: null, services: [],
      date: null, time: null,
      userName: '', phone: '', email: '', notes: '',
      reminders: ['sms', 'whatsapp'],
    });
  };

  // Apply accent tweak via CSS var
  React.useEffect(() => {
    const root = document.documentElement;
    if (tweaks.accent === 'brown') {
      root.style.setProperty('--accent-primary', 'var(--brown-700)');
    } else {
      root.style.setProperty('--accent-primary', 'var(--sage-800)');
    }
  }, [tweaks.accent]);

  const stepProps = { state, setState, next, back, goto };

  const screenLabels = ['01 Welcome', '02 Dog', '03 Services', '04 Date', '05 Contact', '06 Summary', '07 Success'];

  return (
    <div data-screen-label={screenLabels[step]} style={{ minHeight: '100vh', position: 'relative' }}>
      {/* App Chrome / Header */}
      {step !== 0 && step !== totalSteps - 1 && (
        <header className="app-chrome" style={{
          padding: '14px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <Logo size={20} />
          {tweaks.showProgressBar && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center', maxWidth: 320 }}>
              {Array.from({ length: 5 }, (_, i) => i + 1).map((s) => (
                <span key={s} className={
                  s === step ? 'stepdot stepdot-active'
                  : s < step ? 'stepdot stepdot-done'
                  : 'stepdot'
                } />
              ))}
            </div>
          )}
          <button
            onClick={() => setShowReminders(true)}
            className="btn btn-ghost"
            title="Vedi i promemoria automatici"
            style={{ padding: '8px 12px', fontSize: 12, color: 'var(--ink-700)' }}
          >
            <Icon name="bell" size={16} /> Promemoria
          </button>
        </header>
      )}

      {/* The current step */}
      <main key={step} style={{ paddingBottom: 80 }}>
        {step === 0 && <StepWelcome {...stepProps} />}
        {step === 1 && <StepDog {...stepProps} />}
        {step === 2 && <StepServices {...stepProps} />}
        {step === 3 && <StepDate {...stepProps} />}
        {step === 4 && <StepContact {...stepProps} />}
        {step === 5 && <StepSummary {...stepProps} />}
        {step === 6 && <StepSuccess state={state} restart={restart} />}
      </main>

      {/* Footer attribution */}
      {step === 0 && (
        <div style={{
          position: 'absolute', bottom: 20, left: 0, right: 0,
          textAlign: 'center', fontSize: 11, color: 'var(--ink-500)',
          letterSpacing: '0.12em', textTransform: 'uppercase',
        }}>
          Via dei Glicini 12, Milano · Aperti Lun–Sab
        </div>
      )}

      {/* Reminders modal */}
      {showReminders && (
        <RemindersPanel state={state} onClose={() => setShowReminders(false)} />
      )}

      {/* Design system overlay (toggle via tweak) */}
      {tweaks.showDesignSystem && <DesignSystemOverlay onClose={() => setTweak('showDesignSystem', false)} />}

      {/* Tweaks */}
      <TweaksPanel title="Tweaks">
        <TweakSection title="Wizard">
          <TweakRadio
            label="Stile header"
            value={tweaks.headerStyle}
            options={[{ value: 'minimal', label: 'Minimal' }, { value: 'progress', label: 'Step dots' }]}
            onChange={(v) => setTweak({ headerStyle: v, showProgressBar: v === 'progress' })}
          />
          <TweakToggle label="Barra progresso" value={tweaks.showProgressBar} onChange={(v) => setTweak('showProgressBar', v)} />
        </TweakSection>
        <TweakSection title="Navigazione">
          <TweakSelect
            label="Vai allo step"
            value={String(step)}
            options={STEP_LABELS.map((l, i) => ({ value: String(i), label: `${i + 1}. ${l}` }))}
            onChange={(v) => goto(parseInt(v, 10))}
          />
          <TweakButton label="Riempi dati di esempio" onClick={() => {
            setState({
              dogName: 'Pepe', size: 'M', coat: 'curly',
              services: ['full', 'parasite'],
              date: '2026-05-09', time: '10:00',
              userName: 'Sara Bianchi', phone: '+39 333 412 7788', email: 'sara@example.com',
              notes: 'Pepe è un po\' nervoso col phon, parlategli piano.',
              reminders: ['sms', 'whatsapp', 'email'],
            });
          }} />
          <TweakButton label="Reset wizard" onClick={restart} />
        </TweakSection>
        <TweakSection title="Vedi anche">
          <TweakButton label="Apri promemoria automatici" onClick={() => setShowReminders(true)} />
          <TweakToggle label="Mostra design system" value={tweaks.showDesignSystem} onChange={(v) => setTweak('showDesignSystem', v)} />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

/* ─── Design system overlay ─────────────────────────────── */
function DesignSystemOverlay({ onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60, background: 'var(--cream-100)',
      overflow: 'auto',
    }}>
      <header className="app-chrome" style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Logo size={20} />
        <span className="eyebrow">Design System</span>
        <button onClick={onClose} className="btn btn-ghost"><Icon name="close" size={16} /> Chiudi</button>
      </header>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>
        <h1 className="display" style={{ fontSize: 56, margin: '0 0 8px' }}>Clean Dog · Design System</h1>
        <p style={{ fontSize: 16, color: 'var(--ink-500)', marginBottom: 48, maxWidth: 600 }}>
          Sistema "organic luxury" per la web app di prenotazione. Naturale, artigianale, caldo ma moderno.
        </p>

        {/* Colors */}
        <DSSection title="Colori" eyebrow="01 · Palette">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            <ColorGroup name="Sage" colors={[
              ['--sage-900', '#2A4032'], ['--sage-800', '#3D5A47'], ['--sage-700', '#4A6B54'],
              ['--sage-600', '#5C7A5E'], ['--sage-300', '#A8BCA9'], ['--sage-100', '#DCE5DD'],
            ]} />
            <ColorGroup name="Brown" colors={[
              ['--brown-800', '#5C4631'], ['--brown-700', '#8B6A4F'], ['--brown-500', '#A6886A'],
              ['--brown-300', '#C4A882'], ['--brown-100', '#E8D9C3'],
            ]} />
            <ColorGroup name="Cream" colors={[
              ['--cream-50', '#FBF7EF'], ['--cream-100', '#F5EDE0'],
              ['--cream-200', '#EEE3D0'], ['--cream-300', '#E2D4BC'],
            ]} />
            <ColorGroup name="Ink" colors={[
              ['--ink-900', '#1F1A14'], ['--ink-700', '#4A3F32'],
              ['--ink-500', '#7A6B57'], ['--ink-300', '#B5A78F'],
            ]} />
          </div>
        </DSSection>

        {/* Type */}
        <DSSection title="Tipografia" eyebrow="02 · Type">
          <div style={{ display: 'grid', gap: 16 }}>
            {[
              { label: 'Display · Cormorant Garamond 56', cls: 'display', size: 56, sample: 'Una giornata di cura' },
              { label: 'Display · Cormorant Garamond 32', cls: 'display', size: 32, sample: 'Tutto pronto?' },
              { label: 'Body · DM Sans 16', cls: '', size: 16, sample: 'Bagno, taglio e coccole nel nostro studio di toelettatura artigianale.' },
              { label: 'Body · DM Sans 13', cls: '', size: 13, sample: 'Riceverai un promemoria 24h prima dell\'appuntamento.' },
              { label: 'Eyebrow · DM Sans 11 · uppercase', cls: 'eyebrow', size: 11, sample: 'Step 03 · Servizi' },
            ].map((t) => (
              <div key={t.label} className="card" style={{ padding: 20 }}>
                <div className="eyebrow" style={{ marginBottom: 8 }}>{t.label}</div>
                <div className={t.cls} style={{ fontSize: t.size }}>{t.sample}</div>
              </div>
            ))}
          </div>
        </DSSection>

        {/* Components */}
        <DSSection title="Componenti" eyebrow="03 · Library">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <DSCard title="Buttons">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <button className="btn btn-primary">Primary <Icon name="arrowRight" size={14} /></button>
                <button className="btn btn-secondary">Secondary</button>
                <button className="btn btn-ghost">Ghost</button>
                <button className="btn btn-primary" disabled>Disabled</button>
              </div>
            </DSCard>

            <DSCard title="Badges">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <span className="badge">default</span>
                <span className="badge badge-sage">sage</span>
                <span className="badge badge-brown">brown</span>
              </div>
            </DSCard>

            <DSCard title="Step indicator">
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span className="stepdot stepdot-done" />
                <span className="stepdot stepdot-done" />
                <span className="stepdot stepdot-active" />
                <span className="stepdot" />
                <span className="stepdot" />
              </div>
            </DSCard>

            <DSCard title="Service icons (line-art)">
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                {['bath', 'scissors', 'full', 'nails', 'shield'].map((n) => (
                  <div key={n} style={{ textAlign: 'center', fontSize: 11, color: 'var(--ink-500)' }}>
                    <Icon name={n} size={36} color="var(--sage-800)" />
                    <div style={{ marginTop: 4 }}>{n}</div>
                  </div>
                ))}
              </div>
            </DSCard>

            <DSCard title="Size icons">
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                {['dogXS', 'dogS', 'dogM', 'dogL', 'dogXL'].map((n) => (
                  <Icon key={n} name={n} size={48} color="var(--brown-700)" />
                ))}
              </div>
            </DSCard>

            <DSCard title="Card · selectable / selected">
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="card" style={{ padding: 18, width: 180 }}>Default card</div>
                <div className="card card-selected" style={{ padding: 18, width: 180 }}>Selected card</div>
              </div>
            </DSCard>
          </div>
        </DSSection>

        {/* Motion */}
        <DSSection title="Animazioni" eyebrow="04 · Motion">
          <div className="card" style={{ padding: 24 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--ink-500)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  <th style={{ padding: '8px 12px 8px 0' }}>Trigger</th>
                  <th style={{ padding: '8px 12px' }}>Animazione</th>
                  <th style={{ padding: '8px 12px' }}>Durata</th>
                  <th style={{ padding: '8px 0' }}>Easing</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Cambio step', 'translateY(20px) → 0 + fade', '620ms', 'cubic-bezier(.34, 1.2, .42, 1)'],
                  ['Hover card', 'translateY(-2px) + shadow', '220ms', 'cubic-bezier(.34, 1.2, .42, 1)'],
                  ['Selezione', 'scale(0.95→1) + check fade', '220ms', 'cubic-bezier(.34, 1.2, .42, 1)'],
                  ['Hero paw', 'floaty (loop)', '6s', 'cubic-bezier(.4, 0, .2, 1)'],
                  ['Success check', 'stroke-dashoffset draw', '800ms', 'organic'],
                  ['Coriandoli', 'translate + rotate + fade', '1.6s', 'soft'],
                ].map((row, i) => (
                  <tr key={i} style={{ borderTop: '1px dashed var(--cream-300)' }}>
                    {row.map((c, j) => (
                      <td key={j} style={{ padding: '12px 12px 12px 0', color: j === 3 ? 'var(--ink-500)' : 'inherit', fontFamily: j === 3 ? 'var(--font-mono)' : 'inherit', fontSize: j === 3 ? 12 : 14 }}>{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DSSection>

        {/* States */}
        <DSSection title="Stati" eyebrow="05 · Interaction states">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {[
              { label: 'Default', sel: false, hover: false },
              { label: 'Hover', sel: false, hover: true },
              { label: 'Selected', sel: true, hover: false },
            ].map((s) => (
              <div key={s.label}>
                <div className="eyebrow" style={{ marginBottom: 8 }}>{s.label}</div>
                <div className={`card ${s.sel ? 'card-selected' : ''}`} style={{
                  padding: 18, transform: s.hover ? 'translateY(-2px)' : 'none',
                  boxShadow: s.hover ? 'var(--shadow-md)' : undefined,
                  borderColor: s.hover ? 'var(--brown-300)' : undefined,
                }}>
                  <Icon name="bath" size={28} color={s.sel ? 'var(--sage-800)' : 'var(--ink-700)'} />
                  <div style={{ fontWeight: 600, marginTop: 6 }}>Bagno & Asciugatura</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>€28 · 45 min</div>
                </div>
              </div>
            ))}
          </div>
        </DSSection>

        <div style={{ padding: '60px 0 20px', textAlign: 'center', fontSize: 12, color: 'var(--ink-500)' }}>
          Clean Dog · Design system v1.0 · Maggio 2026
        </div>
      </div>
    </div>
  );
}

function DSSection({ title, eyebrow, children }) {
  return (
    <section style={{ marginBottom: 60 }}>
      <div className="eyebrow" style={{ marginBottom: 6 }}>{eyebrow}</div>
      <h2 className="display" style={{ fontSize: 36, margin: '0 0 24px' }}>{title}</h2>
      {children}
    </section>
  );
}

function DSCard({ title, children }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div className="eyebrow" style={{ marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  );
}

function ColorGroup({ name, colors }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="eyebrow" style={{ marginBottom: 12 }}>{name}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {colors.map(([token, hex]) => (
          <div key={token} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: hex, border: '1px solid rgba(0,0,0,0.06)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-700)' }}>{token}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-500)' }}>{hex}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
