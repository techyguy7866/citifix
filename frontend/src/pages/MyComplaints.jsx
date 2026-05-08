
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { complaintsApi } from '@/lib/api.js';
import DashboardLayout from '@/components/DashboardLayout.jsx';
import { motion, AnimatePresence } from 'framer-motion';
import { Tag, Calendar, CheckCircle, Clock, BarChart, Megaphone, ShieldAlert, X, Camera, Upload, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast.js';

const MyComplaints = () => {
    const [complaints, setComplaints] = useState([]);
    const { toast } = useToast();
    const [challengeModal, setChallengeModal] = useState({ open: false, complaintId: null, title: '' });
    const [challengeReason, setChallengeReason] = useState('');
    const [submittingChallenge, setSubmittingChallenge] = useState(false);

    const load = async () => {
        try {
            const mine = await complaintsApi.listMine();
            setComplaints(mine.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
        } catch {
            setComplaints([]);
        }
    };

    useEffect(() => { load(); }, []);

    const getStatusChip = (status, challenged) => {
        if (challenged) return (
            <span className="bg-rose-900/60 text-rose-300 border border-rose-500/40 px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                <ShieldAlert className="w-3 h-3"/> Challenged
            </span>
        );
        switch(status) {
            case 'open':      return <span className="bg-blue-700/40 text-blue-300   border border-blue-500/30   px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1"><Clock className="w-3 h-3"/> Open</span>;
            case 'assigned':  return <span className="bg-amber-700/40 text-amber-300  border border-amber-500/30  px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1"><BarChart className="w-3 h-3"/> Assigned</span>;
            case 'resolved':  return <span className="bg-emerald-700/40 text-emerald-300 border border-emerald-500/30 px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Resolved</span>;
            case 'escalated': return <span className="bg-purple-700/40 text-purple-300  border border-purple-500/30  px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1"><Megaphone className="w-3 h-3"/> Escalated</span>;
            default: return null;
        }
    };

    const handleChallenge = async () => {
        if (!challengeReason.trim()) {
            toast({ title: 'Please provide a reason', variant: 'destructive' });
            return;
        }
        setSubmittingChallenge(true);
        try {
            await complaintsApi.challengeResolution(challengeModal.complaintId, challengeReason);
            toast({ title: '⚠️ Resolution Challenged!', description: 'The complaint has been re-opened for review.' });
            setChallengeModal({ open: false, complaintId: null, title: '' });
            setChallengeReason('');
            await load();
        } catch (err) {
            toast({ title: 'Failed to challenge', description: err.message, variant: 'destructive' });
        } finally {
            setSubmittingChallenge(false);
        }
    };

    return (
        <>
            <Helmet>
                <title>My Complaints - CITIFIX</title>
                <meta name="description" content="Track your submitted complaints and challenge fake resolutions." />
            </Helmet>
            <DashboardLayout>
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-3xl font-bold text-white">My Complaints</h1>
                    <span className="text-white/40 text-sm">{complaints.length} total</span>
                </div>

                {complaints.length > 0 ? (
                    <div className="space-y-4">
                        {complaints.map((c, i) => (
                            <motion.div
                                key={c.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.04 }}
                                className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-2xl hover:border-white/20 transition-all"
                            >
                                <div className="flex justify-between items-start mb-2 gap-3">
                                    <h2 className="text-lg font-bold text-white">{c.title}</h2>
                                    {getStatusChip(c.status, c.resolutionChallenged)}
                                </div>
                                <p className="text-white/60 mb-4 text-sm">{c.description}</p>

                                {/* Resolution proof image */}
                                {c.resolutionImageUrl && (
                                    <div className="mb-4 rounded-xl overflow-hidden border border-emerald-500/30 bg-emerald-500/5">
                                        <div className="px-3 py-2 bg-emerald-500/10 flex items-center gap-2">
                                            <ShieldCheck className="w-4 h-4 text-emerald-400" />
                                            <span className="text-emerald-400 text-xs font-bold">Resolution Proof Photo</span>
                                        </div>
                                        <img
                                            src={c.resolutionImageUrl}
                                            alt="Resolution proof"
                                            className="w-full max-h-48 object-cover"
                                        />
                                    </div>
                                )}

                                <div className="flex items-center justify-between text-sm text-white/40 border-t border-white/10 pt-4">
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-1">
                                            <Tag className="w-3.5 h-3.5"/>
                                            <span>{c.category}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Calendar className="w-3.5 h-3.5"/>
                                            <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                                        </div>
                                    </div>

                                    {/* Challenge Resolution Button — only for resolved, non-challenged complaints */}
                                    {c.status === 'resolved' && !c.resolutionChallenged && (
                                        <button
                                            onClick={() => setChallengeModal({ open: true, complaintId: c.id, title: c.title })}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/15 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-medium transition-all"
                                        >
                                            <AlertTriangle className="w-3.5 h-3.5" />
                                            Challenge Resolution
                                        </button>
                                    )}
                                    {c.resolutionChallenged && (
                                        <span className="text-rose-400/60 text-xs italic flex items-center gap-1">
                                            <ShieldAlert className="w-3.5 h-3.5" /> Challenge submitted
                                        </span>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 text-white/30">
                        <p className="text-lg">You haven't submitted any complaints yet.</p>
                    </div>
                )}
            </DashboardLayout>

            {/* Challenge Modal */}
            <AnimatePresence>
                {challengeModal.open && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-[#111] border border-rose-500/30 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
                        >
                            <div className="flex justify-between items-start p-5 border-b border-white/10">
                                <div>
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                        <AlertTriangle className="w-5 h-5 text-rose-400" /> Challenge Resolution
                                    </h3>
                                    <p className="text-white/40 text-sm mt-0.5 line-clamp-1">{challengeModal.title}</p>
                                </div>
                                <button onClick={() => { setChallengeModal({ open: false, complaintId: null, title: '' }); setChallengeReason(''); }} className="text-white/40 hover:text-white">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-5 space-y-4">
                                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-sm text-rose-300">
                                    ⚠️ This will re-open the complaint and notify the SuperAdmin that the resolution was not satisfactory.
                                </div>
                                <div>
                                    <label className="text-white/60 text-xs font-medium block mb-2">Why is this resolution unsatisfactory?</label>
                                    <textarea
                                        rows={4}
                                        className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-rose-500 text-sm resize-none"
                                        placeholder="e.g. The pothole was not properly filled, it's still dangerous..."
                                        value={challengeReason}
                                        onChange={e => setChallengeReason(e.target.value)}
                                    />
                                </div>
                                <button
                                    onClick={handleChallenge}
                                    disabled={submittingChallenge || !challengeReason.trim()}
                                    className="w-full py-3 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                                >
                                    {submittingChallenge ? (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <><ShieldAlert className="w-4 h-4" /> Submit Challenge</>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
};

export default MyComplaints;
