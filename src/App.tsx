import { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Link, Route, Routes, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, CalendarDays, Check, ChevronRight, Clock3, Copy, Download,
  Lock, LogOut, Menu, Pencil, Plus, RefreshCw, Settings, ShieldCheck,
  Trash2, Users, X, AlertCircle
} from "lucide-react";
import { supabase, isConfigured } from "./supabase";
import { createSchedule, deleteVolunteer, loadSchedule, saveVolunteer, updateScheduleStatus, upsertSignup } from "./api";
import { currentSlug, defaultTimes, formatDate, isPast, monthLabel, periodLabel, selectedCount, slotSignupCount, sundayContext } from "./utils";
import type { Schedule, Signup, Slot, Volunteer } from "./types";

function Layout({ children }: { children: React.ReactNode }) {
  return <div className="app-shell">{children}</div>;
}

function SetupWarning() {
  if (isConfigured) return null;
  return <div className="setup-warning"><AlertCircle size={18}/><div><strong>Banco ainda não configurado.</strong><br/>Copie <code>.env.example</code> para <code>.env.local</code> e preencha as duas variáveis do Supabase antes de publicar.</div></div>;
}

function Home() {
  return <Layout>
    <main className="center-page">
      <div className="brand-mark"><CalendarDays size={30}/></div>
      <h1>Escala de Voluntários</h1>
      <p className="lead">Escolha seu nome e marque os domingos em que pode servir.</p>
      <SetupWarning />
      <div className="home-actions">
        <Link className="primary-btn big" to="/escala"><CalendarDays size={20}/>Abrir escala do mês</Link>
        <Link className="secondary-btn big" to="/admin"><Lock size={18}/>Painel do líder</Link>
      </div>
    </main>
  </Layout>;
}

function Loading() { return <div className="loading"><RefreshCw className="spin" size={22}/>Carregando…</div>; }

function ErrorBox({ message }: { message: string }) {
  return <div className="error-box"><AlertCircle size={20}/><span>{message}</span></div>;
}

function VolunteerPage() {
  const { slug = currentSlug() } = useParams();
  const [data, setData] = useState<Awaited<ReturnType<typeof loadSchedule>>>(null);
  const [selectedVolunteer, setSelectedVolunteer] = useState<Volunteer | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const refresh = async () => {
    setLoading(true); setError("");
    try { setData(await loadSchedule(slug)); }
    catch (e: any) { setError(e.message || "Não foi possível carregar a escala."); }
    finally { setLoading(false); }
  };

  useEffect(() => { refresh(); }, [slug]);

  useEffect(() => {
    if (!supabase || !data?.schedule.id) return;
    const channel = supabase.channel(`public-schedule-${data.schedule.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "signups" }, () => refresh())
      .subscribe();
    return () => {
  if (supabase) supabase.removeChannel(channel);
};
  }, [data?.schedule.id]);

  const mine = selectedVolunteer ? data?.signups.filter(s => s.volunteer_id === selectedVolunteer.id) ?? [] : [];
  const minimum = data?.schedule.min_slots ?? 2;

  async function toggle(slot: Slot) {
    if (!selectedVolunteer || data?.schedule.status !== "open" || isPast(slot.service_date)) return;
    const exists = data.signups.some(s => s.slot_id === slot.id && s.volunteer_id === selectedVolunteer.id);
    setSaving(slot.id); setError("");
    try {
      await upsertSignup(slot.id, selectedVolunteer.id, !exists);
      setData(await loadSchedule(slug));
      setSaved(false);
    } catch (e: any) {
      setError(e.message || "Não foi possível salvar.");
    } finally { setSaving(null); }
  }

  if (loading) return <Layout><Loading/></Layout>;
  if (error && !data) return <Layout><div className="center-page"><ErrorBox message={error}/><button className="secondary-btn" onClick={refresh}>Tentar novamente</button></div></Layout>;
  if (!data) return <Layout><div className="center-page"><ErrorBox message="Esta escala ainda não existe."/><Link className="secondary-btn" to="/">Voltar</Link></div></Layout>;

  const sundays = [...new Set(data.slots.map(s => s.service_date))];

  return <Layout>
    <header className="topbar">
      <Link to="/" className="icon-btn" aria-label="Voltar"><ArrowLeft size={20}/></Link>
      <div><div className="eyebrow">ESCALA DO MÊS</div><h2>{monthLabel(data.schedule.year, data.schedule.month)}</h2></div>
      <button className="icon-btn" onClick={refresh} aria-label="Atualizar"><RefreshCw size={19}/></button>
    </header>

    <main className="content">
      {data.schedule.status === "closed" && <div className="closed-banner"><Lock size={18}/> Escala encerrada pelo líder. As marcações não podem mais ser alteradas.</div>}
      <SetupWarning />
      {!selectedVolunteer ? <>
        <section className="intro-card">
          <Users size={25}/><div><strong>Quem é você?</strong><span>Toque no seu nome para começar.</span></div>
        </section>
        <div className="name-list">
          {data.volunteers.map(v => <button key={v.id} className="name-option" onClick={() => setSelectedVolunteer(v)}>
            <span className="avatar">{v.name.trim().charAt(0).toUpperCase()}</span><span>{v.name}</span><ChevronRight size={19}/>
          </button>)}
        </div>
      </> : <>
        <section className="person-card">
          <div><span className="eyebrow">VOCÊ ESTÁ COMO</span><strong>{selectedVolunteer.name}</strong></div>
          <button className="text-btn" onClick={() => setSelectedVolunteer(null)}>Trocar nome</button>
        </section>

        <div className={`progress-card ${mine.length >= minimum ? "complete" : ""}`}>
          <div><strong>{mine.length} {mine.length === 1 ? "marcação" : "marcações"}</strong><span>{mine.length >= minimum ? "Mínimo atingido ✓" : `Escolha pelo menos ${minimum}`}</span></div>
          <div className="progress-dots">{Array.from({length: minimum}).map((_,i)=><span key={i} className={i < mine.length ? "filled":""}/>)}</div>
        </div>

        <p className="section-hint">Toque nos turnos em que você pode servir. Você pode marcar quantos quiser.</p>
        {error && <ErrorBox message={error}/>}
        <div className="sunday-list">
          {sundays.map(date => {
            const past = isPast(date);
            const context = sundayContext(date);
            const slots = data.slots.filter(s => s.service_date === date);
            return <section key={date} className={`sunday-card ${context === "HOJE" ? "today" : ""} ${past ? "past" : ""}`}>
              <div className="sunday-head">
                <div><span className="date-weekday">{formatDate(date).split(",")[0]}</span><strong>{new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", {day:"2-digit", month:"2-digit"})}</strong></div>
                <span className={`context ${context === "HOJE" ? "accent" : ""}`}>{context}</span>
              </div>
              <div className="slots">
                {slots.map(slot => {
                  const chosen = data.signups.some(s => s.slot_id === slot.id && s.volunteer_id === selectedVolunteer.id);
                  const count = slotSignupCount(data.signups, slot.id);
                  const times = defaultTimes(slot.period);
                  const disabled = past || data.schedule.status !== "open" || saving === slot.id;
                  return <button key={slot.id} disabled={disabled} onClick={() => toggle(slot)} className={`slot ${chosen ? "chosen":""} ${disabled ? "disabled":""}`}>
                    <div className="slot-check">{saving === slot.id ? <RefreshCw className="spin" size={17}/> : chosen ? <Check size={17}/> : null}</div>
                    <div className="slot-main"><strong>{periodLabel(slot.period)}</strong><span><Clock3 size={14}/><b>chegar {times.arrival}</b> · culto {times.service}</span></div>
                    <span className="slot-count">{count} {count === 1 ? "pessoa" : "pessoas"}</span>
                  </button>
                })}
              </div>
              {past && <div className="passed-label">Este domingo já passou</div>}
            </section>
          })}
        </div>

        <div className="sticky-confirm">
          <button className="primary-btn big full" disabled={mine.length < minimum || data.schedule.status !== "open"} onClick={() => setSaved(true)}>
            <Check size={20}/>{saved ? "Confirmado!" : "Confirmar minhas marcações"}
          </button>
          {mine.length < minimum && <small>Faltam {minimum - mine.length} marcação(ões) para atingir o mínimo.</small>}
        </div>
      </>}
    </main>
  </Layout>;
}

function PinGate({ onAuth }: { onAuth: () => void }) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [teamName, setTeamName] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (!supabase) throw new Error("Supabase não configurado.");
        const { data, error } = await supabase.rpc("is_admin_configured");
        if (error) throw error;
        setConfigured(Boolean(data));
      } catch (e: any) {
        setError(e.message || "Não foi possível verificar a configuração.");
      }
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      if (!supabase) throw new Error("Supabase não configurado.");
      if (pin.length < 4) throw new Error("Use pelo menos 4 números.");
      if (configured === false) {
        if (pin !== confirmPin) throw new Error("Os PINs não conferem.");
        const { error: setupError } = await supabase.rpc("setup_admin_pin", {
          p_pin: pin,
          p_team_name: teamName.trim() || "Minha Equipe"
        });
        if (setupError) throw setupError;
      } else {
        const { data, error: rpcError } = await supabase.rpc("verify_admin_pin", { p_pin: pin });
        if (rpcError) throw rpcError;
        if (!data) throw new Error("PIN incorreto.");
      }
      sessionStorage.setItem("escala_admin", "1"); onAuth();
    } catch (e: any) { setError(e.message || "Não foi possível concluir."); }
    finally { setLoading(false); }
  }

  if (configured === null && !error) return <div className="center-page"><Loading/></div>;

  return <div className="center-page pin-page">
    <div className="brand-mark"><ShieldCheck size={30}/></div>
    <h1>{configured === false ? "Configurar painel" : "Painel do líder"}</h1>
    <p className="lead">{configured === false ? "No primeiro acesso, defina um PIN numérico para proteger o painel." : "Digite o PIN numérico para entrar."}</p>
    <form onSubmit={submit} className="pin-form">
      {configured === false && <input value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="Nome da equipe (opcional)" maxLength={80} />}
      <input autoFocus inputMode="numeric" pattern="[0-9]*" maxLength={12} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g,""))} placeholder={configured === false ? "Crie seu PIN" : "PIN"} />
      {configured === false && <input inputMode="numeric" pattern="[0-9]*" maxLength={12} value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g,""))} placeholder="Confirme o PIN" />}
      {error && <ErrorBox message={error}/>}
      <button className="primary-btn big full" disabled={loading || pin.length < 4 || (configured === false && pin !== confirmPin)}>
        {loading ? "Processando…" : configured === false ? "Criar PIN e entrar" : "Entrar"}
      </button>
    </form>
    <Link className="text-btn" to="/">Voltar</Link>
  </div>;
}

function AdminPage() {
  const [auth, setAuth] = useState(sessionStorage.getItem("escala_admin") === "1");
  if (!auth) return <Layout><PinGate onAuth={() => setAuth(true)}/></Layout>;
  return <AdminDashboard onLogout={() => { sessionStorage.removeItem("escala_admin"); setAuth(false); }}/>;
}

function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const slug = currentSlug();
  const [data, setData] = useState<Awaited<ReturnType<typeof loadSchedule>>>(null);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"scale"|"team">("scale");

  const refresh = async () => {
    try {
      const d = await loadSchedule(slug);
      setData(d);
      if (d) setVolunteers(d.volunteers);
    } catch (e: any) { setError(e.message || "Erro ao carregar."); }
  };
  useEffect(() => { refresh(); }, []);

  const missingSlots = useMemo(() => data?.slots.filter(s => slotSignupCount(data.signups, s.id) === 0) ?? [], [data]);
  const underMinimum = useMemo(() => volunteers.filter(v => selectedCount(data?.signups ?? [], v.id) < (data?.schedule.min_slots ?? 2)), [volunteers, data]);

  async function ensureCurrentSchedule() {
    if (data) return;
    try { await createSchedule(new Date().getFullYear(), new Date().getMonth()+1, 2); await refresh(); }
    catch (e:any) { setError(e.message || "Não foi possível criar a escala."); }
  }

  async function addVolunteer() {
    if (!newName.trim()) return;
    try { await saveVolunteer(null, newName.trim()); setNewName(""); await refresh(); }
    catch (e:any) { setError(e.message || "Erro ao adicionar."); }
  }

  async function closeOrOpen() {
    if (!data) return;
    try { await updateScheduleStatus(data.schedule.id, data.schedule.status === "open" ? "closed" : "open"); await refresh(); }
    catch (e:any) { setError(e.message || "Erro ao atualizar."); }
  }

  function exportText() {
    if (!data) return;
    const lines = [`ESCALA — ${monthLabel(data.schedule.year, data.schedule.month)}`, ""];
    [...new Set(data.slots.map(s => s.service_date))].forEach(date => {
      lines.push(formatDate(date).toUpperCase());
      data.slots.filter(s => s.service_date === date).forEach(slot => {
        const names = data.signups.filter(x => x.slot_id === slot.id).map(x => data.volunteers.find(v => v.id === x.volunteer_id)?.name).filter(Boolean);
        lines.push(`${periodLabel(slot.period)}: ${names.length ? names.join(", ") : "— SEM VOLUNTÁRIO —"}`);
      });
      lines.push("");
    });
    navigator.clipboard?.writeText(lines.join("\n"));
    alert("Escala copiada para a área de transferência.");
  }

  return <Layout>
    <header className="topbar admin-top">
      <Link to="/" className="icon-btn"><ArrowLeft size={20}/></Link>
      <div><div className="eyebrow">PAINEL DO LÍDER</div><h2>{monthLabel(new Date().getFullYear(), new Date().getMonth()+1)}</h2></div>
      <button className="icon-btn" onClick={onLogout}><LogOut size={19}/></button>
    </header>
    <main className="content">
      <SetupWarning />
      {error && <ErrorBox message={error}/>}
      {!data ? <div className="empty-admin"><CalendarDays size={42}/><h3>Escala do mês ainda não criada</h3><p>Crie a escala para gerar automaticamente os domingos e os dois turnos.</p><button className="primary-btn" onClick={ensureCurrentSchedule}><Plus size={18}/>Criar escala do mês</button></div> :
      <>
        <div className="admin-actions">
          <button className="secondary-btn" onClick={refresh}><RefreshCw size={17}/>Atualizar</button>
          <button className="secondary-btn" onClick={exportText}><Copy size={17}/>Copiar escala</button>
          <button className={data.schedule.status === "open" ? "danger-btn" : "primary-btn"} onClick={closeOrOpen}><Lock size={17}/>{data.schedule.status === "open" ? "Encerrar escala" : "Reabrir escala"}</button>
        </div>

        <div className="tabs"><button className={tab==="scale"?"active":""} onClick={()=>setTab("scale")}>Visão da escala</button><button className={tab==="team"?"active":""} onClick={()=>setTab("team")}>Equipe</button></div>

        {tab==="scale" ? <>
          <div className="stats-grid">
            <div className="stat"><strong>{missingSlots.length}</strong><span>turnos vazios</span></div>
            <div className="stat"><strong>{underMinimum.length}</strong><span>abaixo do mínimo</span></div>
            <div className="stat"><strong>{data.volunteers.length}</strong><span>voluntários</span></div>
          </div>
          {missingSlots.length > 0 && <div className="warning-card"><AlertCircle size={20}/><div><strong>Há turnos sem ninguém</strong><span>Veja os turnos marcados em vermelho abaixo.</span></div></div>}
          <div className="admin-scale">
            {[...new Set(data.slots.map(s=>s.service_date))].map(date => <div className="admin-day" key={date}>
              <div className="admin-day-head"><strong>{formatDate(date)}</strong><span>{sundayContext(date)}</span></div>
              {data.slots.filter(s=>s.service_date===date).map(slot => {
                const names = data.signups.filter(x=>x.slot_id===slot.id).map(x=>data.volunteers.find(v=>v.id===x.volunteer_id)?.name).filter(Boolean);
                return <div className={`admin-slot ${names.length===0 ? "empty":""}`} key={slot.id}>
                  <div><strong>{periodLabel(slot.period)}</strong><span>{defaultTimes(slot.period).arrival} · {defaultTimes(slot.period).service}</span></div>
                  <p>{names.length ? names.join(" · ") : "SEM VOLUNTÁRIO"}</p>
                </div>
              })}
            </div>)}
          </div>
        </> : <TeamPanel volunteers={volunteers} newName={newName} setNewName={setNewName} addVolunteer={addVolunteer} refresh={refresh} />}
      </>}
    </main>
  </Layout>;
}

function TeamPanel({ volunteers, newName, setNewName, addVolunteer, refresh }: any) {
  return <section>
    <div className="panel-card"><div><h3>Equipe</h3><p>Adicione ou desative voluntários.</p></div></div>
    <div className="add-row"><input value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addVolunteer()} placeholder="Nome do voluntário"/><button className="primary-btn" onClick={addVolunteer}><Plus size={18}/>Adicionar</button></div>
    <div className="team-list">{volunteers.map((v: Volunteer)=><div className="team-row" key={v.id}><span className="avatar">{v.name.charAt(0).toUpperCase()}</span><strong>{v.name}</strong><button className="icon-btn" title="Desativar" onClick={async()=>{await deleteVolunteer(v.id); refresh();}}><Trash2 size={17}/></button></div>)}</div>
  </section>;
}

function App() {
  return <BrowserRouter><Routes>
    <Route path="/" element={<Home/>}/>
    <Route path="/escala" element={<VolunteerPage/>}/>
    <Route path="/escala/:slug" element={<VolunteerPage/>}/>
    <Route path="/admin" element={<AdminPage/>}/>
  </Routes></BrowserRouter>;
}

export default App;
