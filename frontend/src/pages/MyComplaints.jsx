
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { complaintsApi } from '@/lib/api.js';
import DashboardLayout from '@/components/DashboardLayout.jsx';
import { Tag, Calendar, CheckCircle, Clock, BarChart, Megaphone } from 'lucide-react';

const MyComplaints = () => {
    const [complaints, setComplaints] = useState([]);

    useEffect(() => {
        const load = async () => {
            try {
                const mine = await complaintsApi.listMine();
                setComplaints(mine.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)));
            } catch {
                setComplaints([]);
            }
        };
        load();
    }, []);

    const getStatusChip = (status) => {
        switch(status) {
            case 'open': return <span className="bg-blue-700 text-white px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1"><Clock className="w-3 h-3"/> Open</span>
            case 'assigned': return <span className="bg-yellow-700 text-white px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1"><BarChart className="w-3 h-3"/> Assigned</span>
            case 'resolved': return <span className="bg-green-700 text-white px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Resolved</span>
            case 'escalated': return <span className="bg-purple-700 text-white px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1"><Megaphone className="w-3 h-3"/> Escalated</span>
            default: return null;
        }
    }

    return (
        <>
            <Helmet>
                <title>My Complaints - CITIFIX</title>
                <meta name="description" content="Track your submitted complaints." />
            </Helmet>
            <DashboardLayout>
                <h1 className="text-3xl font-bold mb-6">My Complaints</h1>

                {complaints.length > 0 ? (
                    <div className="space-y-4">
                        {complaints.map(c => (
                            <div key={c.id} className="bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700">
                                <div className="flex justify-between items-start mb-2">
                                    <h2 className="text-xl font-bold">{c.title}</h2>
                                    {getStatusChip(c.status)}
                                </div>
                                <p className="text-slate-300 mb-4">{c.description}</p>
                                <div className="flex items-center justify-between text-sm text-slate-400 border-t border-slate-700 pt-4">
                                    <div className="flex items-center gap-2">
                                        <Tag className="w-4 h-4"/>
                                        <span>{c.category}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4"/>
                                        <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-slate-300">You haven't submitted any complaints yet.</p>
                )}
            </DashboardLayout>
        </>
    );
};

export default MyComplaints;
