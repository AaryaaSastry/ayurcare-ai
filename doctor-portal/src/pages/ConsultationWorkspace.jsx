import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2, Plus, Save, Video, XCircle } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { doctorService } from '../services/api';

const createMedicineRow = () => ({ name: '', details: '' });

const ConsultationWorkspace = () => {
  const { appointmentId } = useParams();
  const navigate = useNavigate();

  const [appointment, setAppointment] = useState(null);
  const [meetingLink, setMeetingLink] = useState('');
  const [meetingStatus, setMeetingStatus] = useState('scheduled');
  const [notes, setNotes] = useState('');
  const [medicines, setMedicines] = useState([createMedicineRow()]);
  const [loading, setLoading] = useState(true);
  const [savingDraft, setSavingDraft] = useState(false);
  const [endingCall, setEndingCall] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [toast, setToast] = useState('');

  const patientName = useMemo(() => {
    const name = appointment?.patientId?.name;
    if (name && name.trim()) return name;
    const email = appointment?.patientId?.email;
    if (email) return email.split('@')[0];
    return 'Patient';
  }, [appointment]);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      setLoading(true);
      try {
        const startPayload = await doctorService.startConsultation(appointmentId);
        const appt = startPayload?.appointment;
        if (!isMounted) return;
        const hydrated = await doctorService.getAppointmentById(appointmentId);
        if (!isMounted) return;
        setAppointment(hydrated || appt || null);
        setMeetingLink(startPayload?.meetingLink || appt?.meetingLink || '');
        setMeetingStatus(startPayload?.meetingStatus || appt?.meetingStatus || 'live');

        const prescription = await doctorService.getPrescriptionByAppointment(appointmentId);
        if (!isMounted) return;
        setNotes(String(prescription?.notes || ''));
        const rows = Array.isArray(prescription?.medicines) && prescription.medicines.length
          ? prescription.medicines
          : [createMedicineRow()];
        setMedicines(rows);
      } catch (err) {
        if (isMounted) {
          setToast(err.message || 'Failed to initialize consultation.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    init();
    return () => {
      isMounted = false;
    };
  }, [appointmentId]);

  const setRow = (index, key, value) => {
    setMedicines((prev) => prev.map((row, idx) => (idx === index ? { ...row, [key]: value } : row)));
  };

  const addMedicineRow = () => setMedicines((prev) => [...prev, createMedicineRow()]);

  const removeMedicineRow = (index) => {
    setMedicines((prev) => {
      if (prev.length === 1) return [createMedicineRow()];
      return prev.filter((_, idx) => idx !== index);
    });
  };

  const persistDraft = async () => {
    setSavingDraft(true);
    try {
      await doctorService.savePrescriptionDraft({ appointmentId, notes, medicines });
      setToast('Draft saved.');
    } catch (err) {
      setToast(err.message || 'Failed to save draft.');
    } finally {
      setSavingDraft(false);
    }
  };

  const endCall = async () => {
    setEndingCall(true);
    try {
      await doctorService.endConsultation(appointmentId);
      setMeetingStatus('ended');
      setToast('Call ended. You can still finalize prescription.');
    } catch (err) {
      setToast(err.message || 'Failed to end call.');
    } finally {
      setEndingCall(false);
    }
  };

  const finalize = async () => {
    setFinalizing(true);
    try {
      const result = await doctorService.finalizePrescription({ appointmentId, notes, medicines });
      setMeetingStatus(result?.appointment?.meetingStatus || 'ended');
      setToast('Prescription finalized.');
      setTimeout(() => navigate('/dashboard'), 900);
    } catch (err) {
      setToast(err.message || 'Failed to finalize prescription.');
    } finally {
      setFinalizing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-[#f8fafc] flex">
        <Sidebar />
        <main className="flex-1 ml-72 flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-slate-400" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#f8fafc] flex">
      <Sidebar />
      <main className="flex-1 ml-72 h-screen p-4">
        <div className="h-full bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50"
              >
                <ArrowLeft size={16} />
              </button>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Consultation Workspace</div>
                <h1 className="text-xl font-black text-slate-900">{patientName}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                meetingStatus === 'live' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'
              }`}>
                {meetingStatus}
              </span>
              {toast && <span className="text-xs font-semibold text-slate-500">{toast}</span>}
            </div>
          </div>

          <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[minmax(0,1.65fr)_minmax(420px,0.9fr)]">
            <section className="border-r border-slate-100 min-h-0 flex flex-col">
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-700 font-bold text-sm">
                  <Video size={16} />
                  <span>Video Consultation</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={endCall}
                    disabled={endingCall || meetingStatus === 'ended'}
                    className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold uppercase tracking-wide disabled:bg-slate-300"
                  >
                    {endingCall ? 'Ending...' : 'End Call'}
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0 bg-slate-50">
                {meetingLink ? (
                  <iframe
                    src={meetingLink}
                    title="Consultation Video"
                    className="w-full h-full border-0"
                    allow="camera; microphone; fullscreen; display-capture"
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500 text-sm font-semibold">
                    Meeting link unavailable.
                  </div>
                )}
              </div>
            </section>

            <section className="min-h-0 flex flex-col bg-[#fcfcfd]">
              <div className="px-5 py-4 border-b border-slate-200 bg-white">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">Prescription Pad</h2>
                    <p className="text-xs text-slate-500 mt-1">Capture clinical notes while the consultation is in progress.</p>
                  </div>
                  <div className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-100">
                    {meetingStatus}
                  </div>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-5 space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Clinical Notes</label>
                    <span className="text-[10px] font-bold text-slate-400">{notes.length} chars</span>
                  </div>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={10}
                    className="w-full rounded-2xl border border-slate-300 p-3.5 text-sm leading-6 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-all bg-white"
                    placeholder="Write findings, assessment, and treatment advice..."
                  />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Medicines</label>
                    <button
                      onClick={addMedicineRow}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1.5 hover:bg-slate-50"
                    >
                      <Plus size={12} />
                      Add
                    </button>
                  </div>
                  <div className="space-y-3">
                    {medicines.map((row, idx) => (
                      <div key={`${idx}-${row.name}`} className="rounded-2xl border border-slate-200 p-3.5 space-y-2.5 bg-slate-50/40">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Medicine #{idx + 1}</div>
                        <input
                          value={row.name}
                          onChange={(e) => setRow(idx, 'name', e.target.value)}
                          placeholder="Medicine name"
                          className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                        />
                        <textarea
                          value={row.details}
                          onChange={(e) => setRow(idx, 'details', e.target.value)}
                          rows={2}
                          placeholder="Dosage / timing / duration"
                          className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                        />
                        <button
                          onClick={() => removeMedicineRow(idx)}
                          className="text-xs font-bold text-rose-500 hover:text-rose-600"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-3 md:p-4 border-t border-slate-200 bg-white sticky bottom-0">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
                  <button
                    onClick={persistDraft}
                    disabled={savingDraft}
                    className="px-3 py-3 rounded-xl border border-slate-300 text-slate-700 text-xs font-black uppercase tracking-wide flex items-center justify-center gap-2 hover:bg-slate-50 disabled:opacity-70"
                  >
                    {savingDraft ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Save Draft
                  </button>
                  <button
                    onClick={finalize}
                    disabled={finalizing}
                    className="px-3 py-3 rounded-xl bg-emerald-600 text-white text-xs font-black uppercase tracking-wide flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:bg-emerald-300"
                  >
                    {finalizing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    Finalize
                  </button>
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="px-3 py-3 rounded-xl bg-slate-100 text-slate-700 text-xs font-black uppercase tracking-wide flex items-center justify-center gap-2 hover:bg-slate-200"
                  >
                    <XCircle size={14} />
                    Exit
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ConsultationWorkspace;
