import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { superAdminApi, adminApi } from "@/lib/api";
import { motion } from "framer-motion";
import { Users, ClipboardList, Clock, Search, Shield, ShieldOff, AlertTriangle, CheckCircle, UserPlus, X, BarChart2, AlertOctagon } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useToast } from "@/components/ui/use-toast";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

const DEPARTMENTS = [
  { id: 'Roads', label: 'Roads & Transport', icon: '🛣️' },
  { id: 'Water', label: 'Water Supply', icon: '🌊' },
  { id: 'Waste', label: 'Waste Management', icon: '🗑️' },
  { id: 'Electricity', label: 'Electricity', icon: '⚡' },
  { id: 'Parks', label: 'Parks & Recreation', icon: '🌳' },
  { id: 'Traffic', label: 'Traffic & Signals', icon: '🚦' },
  { id: 'Other', label: 'Other Issues', icon: '📋' },
];

const SuperAdminPanel = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("users");
  
  // Data states
  const [users, setUsers] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [slaConfigs, setSlaConfigs] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeDept, setActiveDept] = useState("All");
  const [assignModal, setAssignModal] = useState({
    isOpen: false, complaintId: null,
    projectAmount: "", warrantyPeriod: "", projectDeadline: "", projectNote: ""
  });
  const [extensionRequests, setExtensionRequests] = useState([]);
  const [raisedIssues, setRaisedIssues] = useState([]);
  const [raisedIssueAssignModal, setRaisedIssueAssignModal] = useState({ isOpen: false, issueId: null, issueTitle: "" });
  const [assigningRaisedIssue, setAssigningRaisedIssue] = useState(false);
  // Department-selection modal state (shown when promoting a user to SUBADMIN)
  const [deptModal, setDeptModal] = useState({ isOpen: false, userId: null, userName: "" });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersData, complaintsData, slaData, analyticsData, extRequestsData, raisedIssuesData] = await Promise.all([
        superAdminApi.users(),
        adminApi.complaints(),
        superAdminApi.getSlaConfigs(),
        superAdminApi.getAnalytics(),
        superAdminApi.getExtensionRequests(),
        superAdminApi.getRaisedIssues(),
      ]);
      setUsers(usersData);
      setComplaints(complaintsData.complaints || []);
      setAnalytics(analyticsData);
      setExtensionRequests(extRequestsData);
      setRaisedIssues(raisedIssuesData);
      
      // Merge SLA configs with defaults
      const mergedSlas = DEPARTMENTS.map(dept => {
        const existing = slaData.find(s => s.department === dept.id);
        return existing || { department: dept.id, daysToResolve: 7, isNew: true };
      });
      setSlaConfigs(mergedSlas);
    } catch (err) {
      toast({ title: "Error fetching data", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // --- Handlers ---

  const handleRoleChange = async (userId, newRole, userName) => {
    // If promoting to SUBADMIN, show department selection modal first
    if (newRole === "SUBADMIN") {
      setDeptModal({ isOpen: true, userId, userName: userName || "this user" });
      return;
    }
    // For any other role (CITIZEN), apply directly
    try {
      await superAdminApi.setRole(userId, newRole, null);
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole, department: null } : u));
      toast({ title: "Role updated successfully" });
    } catch (err) {
      toast({ title: "Failed to update role", description: err.message, variant: "destructive" });
    }
  };

  const handleSubAdminWithDept = async (department) => {
    const { userId } = deptModal;
    try {
      await superAdminApi.setRole(userId, "SUBADMIN", department);
      setUsers(users.map(u => u.id === userId ? { ...u, role: "SUBADMIN", department } : u));
      toast({ title: `SubAdmin assigned to ${department} ✅` });
    } catch (err) {
      toast({ title: "Failed to update role", description: err.message, variant: "destructive" });
    } finally {
      setDeptModal({ isOpen: false, userId: null, userName: "" });
    }
  };

  const handleSlaChange = async (department, daysStr) => {
    const days = parseInt(daysStr, 10);
    if (isNaN(days) || days < 1) return;

    try {
      await superAdminApi.setSla(department, days);
      setSlaConfigs(slaConfigs.map(s => s.department === department ? { ...s, daysToResolve: days, isNew: false } : s));
      toast({ title: "SLA updated successfully" });
    } catch (err) {
      toast({ title: "Failed to update SLA", description: err.message, variant: "destructive" });
    }
  };

  const handleAssign = async (subAdminId) => {
    if (!assignModal.complaintId || !subAdminId) return;
    try {
      const updated = await superAdminApi.assignSubAdmin(assignModal.complaintId, {
        subAdminId,
        projectAmount: assignModal.projectAmount || undefined,
        warrantyPeriod: assignModal.warrantyPeriod || undefined,
        projectDeadline: assignModal.projectDeadline || undefined,
        projectNote: assignModal.projectNote || undefined,
      });
      setComplaints(complaints.map(c => c.id === assignModal.complaintId ? updated : c));
      setAssignModal({ isOpen: false, complaintId: null, projectAmount: "", warrantyPeriod: "", projectDeadline: "", projectNote: "" });
      toast({ title: "Sub-Admin assigned successfully" });
    } catch (err) {
      toast({ title: "Failed to assign", description: err.message, variant: "destructive" });
    }
  };

  const handleReviewExtension = async (requestId, status) => {
    try {
      await superAdminApi.reviewExtensionRequest(requestId, { status });
      setExtensionRequests(prev => prev.map(r => r.id === requestId ? { ...r, status } : r));
      toast({ title: status === "APPROVED" ? "Extension approved ✅" : "Extension rejected ❌" });
    } catch (err) {
      toast({ title: "Failed to review", description: err.message, variant: "destructive" });
    }
  };

  const handleUnassign = async (complaintId) => {
    try {
      const updated = await superAdminApi.unassign(complaintId);
      setComplaints(complaints.map(c => c.id === complaintId ? updated : c));
      toast({ title: "Sub-Admin unassigned" });
    } catch (err) {
      toast({ title: "Failed to unassign", description: err.message, variant: "destructive" });
    }
  };

  // --- Render Helpers ---

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.phone.includes(searchTerm)
  );

  const filteredComplaints = complaints.filter(c => 
    (activeDept === "All" || c.category === activeDept) &&
    c.status !== "resolved" // Only show active complaints for assignment
  );

  const subAdmins = users.filter(u => u.role === "SUBADMIN");

  // In assign modal: only show subAdmins from the same department as the complaint being assigned
  const getComplaintDept = () => {
    if (!assignModal.complaintId) return null;
    const c = complaints.find(c => c.id === assignModal.complaintId);
    return c?.category || null;
  };

  const filteredSubAdminsForAssign = () => {
    const dept = getComplaintDept();
    if (!dept) return subAdmins;
    return subAdmins.filter(a => a.department === dept);
  };

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">SuperAdmin Control Center</h1>
        <p className="text-white/60">Manage roles, assign tasks, and configure system SLAs.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-8 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveTab("users")}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${
            activeTab === "users" ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/20"
          }`}
        >
          <Users className="w-5 h-5" /> User Management
        </button>
        <button
          onClick={() => setActiveTab("assign")}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${
            activeTab === "assign" ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/20"
          }`}
        >
          <ClipboardList className="w-5 h-5" /> Assign Complaints
        </button>
        <button
          onClick={() => setActiveTab("sla")}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${
            activeTab === "sla" ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/20"
          }`}
        >
          <Clock className="w-5 h-5" /> SLA Settings
        </button>
        <button
          onClick={() => setActiveTab("analytics")}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${
            activeTab === "analytics" ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/20"
          }`}
        >
          <BarChart2 className="w-5 h-5" /> Analytics Overview
        </button>
        <button
          onClick={() => setActiveTab("extensions")}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${
            activeTab === "extensions" ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/20"
          }`}
        >
          <Clock className="w-5 h-5" /> Extension Requests
          {extensionRequests.filter(r => r.status === "PENDING").length > 0 && (
            <span className="bg-rose-500 text-white text-xs font-bold rounded-full px-2 py-0.5 ml-1">
              {extensionRequests.filter(r => r.status === "PENDING").length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("raised")}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${
            activeTab === "raised" ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/20"
          }`}
        >
          <AlertOctagon className="w-5 h-5" /> Raised Issues
          {raisedIssues.filter(r => r.status === "PENDING").length > 0 && (
            <span className="bg-amber-500 text-white text-xs font-bold rounded-full px-2 py-0.5 ml-1">
              {raisedIssues.filter(r => r.status === "PENDING").length}
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div></div>
      ) : (
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6">
          
          {/* TAB 1: USER MANAGEMENT */}
          {activeTab === "users" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-white">System Users</h2>
                <div className="relative">
                  <Search className="w-5 h-5 text-white/50 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search name or phone..."
                    className="bg-white/10 border border-white/20 text-white rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:border-white/40"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-white/50 text-sm">
                      <th className="pb-3 font-medium">Name</th>
                      <th className="pb-3 font-medium">Phone</th>
                      <th className="pb-3 font-medium">Role</th>
                      <th className="pb-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(u => (
                      <tr key={u.id} className="border-b border-white/5 text-white/90 hover:bg-white/5 transition-colors">
                        <td className="py-4 font-medium">{u.name}</td>
                        <td className="py-4">{u.phone}</td>
                        <td className="py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            u.role === 'SUPERADMIN' ? 'bg-purple-500/20 text-purple-400' :
                            u.role === 'SUBADMIN' ? 'bg-amber-500/20 text-amber-400' :
                            u.role === 'ADMIN' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-white/10 text-white/60'
                          }`}>
                            {u.role}
                            {u.role === 'SUBADMIN' && u.department && (
                              <span className="ml-1.5 text-[10px] bg-amber-500/30 px-1.5 py-0.5 rounded-full">
                                {u.department}
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="py-4 text-right">
                          {u.id !== user.id && u.role !== 'SUPERADMIN' && (
                            <select
                              value={u.role}
                              onChange={(e) => handleRoleChange(u.id, e.target.value, u.name)}
                              className="bg-black border border-white/20 text-white rounded-lg px-3 py-1 text-sm focus:outline-none"
                            >
                              <option value="CITIZEN">CITIZEN</option>
                              <option value="SUBADMIN">SUBADMIN</option>
                            </select>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* TAB 2: ASSIGN COMPLAINTS */}
          {activeTab === "assign" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {/* Department Tabs */}
              <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
                <button
                  onClick={() => setActiveDept('All')}
                  className={`flex-shrink-0 px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                    activeDept === 'All' ? 'bg-white text-black shadow-lg' : 'bg-white/10 text-white hover:bg-white/20 border border-white/5'
                  }`}
                >
                  🌐 All Open Issues
                </button>
                {DEPARTMENTS.map(dept => (
                  <button
                    key={dept.id}
                    onClick={() => setActiveDept(dept.id)}
                    className={`flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                      activeDept === dept.id ? 'bg-white text-black shadow-lg' : 'bg-white/10 text-white hover:bg-white/20 border border-white/5'
                    }`}
                  >
                    <span>{dept.icon}</span> {dept.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredComplaints.length === 0 ? (
                  <div className="col-span-full py-10 text-center text-white/50">No open complaints found for this category.</div>
                ) : filteredComplaints.map(c => (
                  <div key={c.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold px-2 py-1 bg-white/10 rounded text-white/70">#{c.id} • {c.category}</span>
                        {c.status === "assigned" && (
                          <span className="text-amber-400 text-xs font-bold flex items-center gap-1"><Shield className="w-3 h-3"/> ASSIGNED</span>
                        )}
                      </div>
                      <h3 className="font-semibold text-white mb-1 line-clamp-1">{c.title}</h3>
                      <p className="text-sm text-white/50 line-clamp-2 mb-4">{c.description}</p>
                    </div>

                    <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                      {c.assignedAdminId ? (
                        <div className="flex flex-col">
                          <span className="text-xs text-white/50">Assigned to:</span>
                          <span className="text-sm font-medium text-amber-400">{c.assignedAdmin?.name || "Sub-Admin"}</span>
                          <span className="text-xs text-white/40 mt-1">SLA: {new Date(c.slaDeadline).toLocaleDateString()}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-white/40 italic">Unassigned</span>
                      )}

                      <div className="flex gap-2">
                        {c.assignedAdminId ? (
                          <button 
                            onClick={() => handleUnassign(c.id)}
                            className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                            title="Unassign"
                          >
                            <ShieldOff className="w-4 h-4" />
                          </button>
                        ) : (
                          <button 
                            onClick={() => setAssignModal({ isOpen: true, complaintId: c.id })}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-lg text-sm font-medium transition-colors"
                          >
                            <UserPlus className="w-4 h-4" /> Assign
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* TAB 3: SLA SETTINGS */}
          {activeTab === "sla" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="max-w-2xl">
                <p className="text-white/60 mb-6 text-sm">Set the Service Level Agreement (SLA) deadline for each department. When assigned, the sub-admin will have this many days to resolve the issue before an automated escalation occurs.</p>
                
                <div className="space-y-4">
                  {slaConfigs.map(sla => {
                    const deptInfo = DEPARTMENTS.find(d => d.id === sla.department) || { label: sla.department, icon: '📋' };
                    return (
                      <div key={sla.department} className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{deptInfo.icon}</span>
                          <span className="font-medium text-white">{deptInfo.label}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <input 
                            type="number" 
                            min="1"
                            defaultValue={sla.daysToResolve}
                            onBlur={(e) => {
                              if (e.target.value != sla.daysToResolve) {
                                handleSlaChange(sla.department, e.target.value);
                              }
                            }}
                            className="w-20 bg-black border border-white/20 text-white rounded-lg px-3 py-2 text-center focus:outline-none focus:border-emerald-500"
                          />
                          <span className="text-sm text-white/50">days</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 4: ANALYTICS OVERVIEW */}
          {activeTab === "analytics" && analytics && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-white">Analytics Overview</h2>
              </div>
              
              <div className="grid sm:grid-cols-3 gap-6 mb-8">
                <div className="bg-gradient-to-br from-indigo-500/20 to-purple-500/20 backdrop-blur-md rounded-2xl p-6 border border-white/10">
                  <p className="text-white/60 text-sm font-medium mb-1">Total System Users</p>
                  <p className="text-3xl font-bold text-white">
                    {analytics.system.roles.reduce((acc, curr) => acc + curr._count.id, 0)}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-emerald-500/20 to-teal-500/20 backdrop-blur-md rounded-2xl p-6 border border-white/10">
                  <p className="text-white/60 text-sm font-medium mb-1">Total Complaints</p>
                  <p className="text-3xl font-bold text-white">{analytics.system.totalComplaints}</p>
                </div>
                <div className="bg-gradient-to-br from-rose-500/20 to-orange-500/20 backdrop-blur-md rounded-2xl p-6 border border-white/10">
                  <p className="text-white/60 text-sm font-medium mb-1">SLA Breaches</p>
                  <p className="text-3xl font-bold text-rose-400">{analytics.system.breachedComplaints}</p>
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                {/* SubAdmin Performance Chart */}
                <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
                  <h3 className="font-bold text-lg text-white mb-4">SubAdmin Case Resolution</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analytics.subAdmins}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis dataKey="name" stroke="rgba(255,255,255,0.6)" />
                      <YAxis stroke="rgba(255,255,255,0.6)" />
                      <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.1)' }} />
                      <Legend />
                      <Bar dataKey="resolvedCount" name="Resolved" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="breachedCount" name="Breached" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                
                {/* User Roles Chart */}
                <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
                  <h3 className="font-bold text-lg text-white mb-4">User Roles Distribution</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={analytics.system.roles}
                        dataKey="_count.id"
                        nameKey="role"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ role, percent }) => `${role} ${(percent * 100).toFixed(0)}%`}
                      >
                        {analytics.system.roles.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.1)' }} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* SubAdmin Performance Table */}
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden mt-8">
                <div className="p-6 border-b border-white/10">
                  <h3 className="font-bold text-lg text-white">SubAdmin Performance Board</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-white/10 text-white/50 text-sm">
                        <th className="p-4 font-medium">SubAdmin Name</th>
                        <th className="p-4 font-medium">Assigned</th>
                        <th className="p-4 font-medium">Resolved</th>
                        <th className="p-4 font-medium">SLA Breaches</th>
                        <th className="p-4 font-medium">Avg Resolution Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.subAdmins.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="p-8 text-center text-white/50">No SubAdmins found.</td>
                        </tr>
                      ) : analytics.subAdmins.map(admin => (
                        <tr key={admin.id} className="border-b border-white/5 hover:bg-white/5 transition-colors text-white">
                          <td className="p-4 font-medium">{admin.name}</td>
                          <td className="p-4 text-emerald-400 font-bold">{admin.assignedCount}</td>
                          <td className="p-4 text-blue-400 font-bold">{admin.resolvedCount}</td>
                          <td className="p-4 text-rose-400 font-bold">{admin.breachedCount}</td>
                          <td className="p-4 text-white/70">
                            {admin.avgResolutionHours ? `${admin.avgResolutionHours} hrs` : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 5: EXTENSION REQUESTS */}
          {activeTab === "extensions" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-white">Extension Requests</h2>
                <span className="text-white/40 text-sm">{extensionRequests.length} total requests</span>
              </div>

              {extensionRequests.length === 0 ? (
                <div className="text-center py-16 text-white/30 italic">No extension requests yet.</div>
              ) : extensionRequests.map(req => (
                <div key={req.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-white font-semibold">{req.complaint?.title}</p>
                      <p className="text-white/50 text-sm">
                        Category: <span className="text-white/70">{req.complaint?.category}</span> &middot;
                        SubAdmin: <span className="text-white/70">{req.requestedBy?.name}</span>
                      </p>
                      <p className="text-white/40 text-xs">
                        Current deadline: {req.complaint?.projectDeadline
                          ? new Date(req.complaint.projectDeadline).toLocaleDateString()
                          : req.complaint?.slaDeadline
                          ? new Date(req.complaint.slaDeadline).toLocaleDateString()
                          : "N/A"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {req.status === "PENDING" ? (
                        <>
                          <button
                            onClick={() => handleReviewExtension(req.id, "APPROVED")}
                            className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400 border border-emerald-500/30 rounded-xl text-sm font-medium transition-all"
                          >
                            ✓ Approve
                          </button>
                          <button
                            onClick={() => handleReviewExtension(req.id, "REJECTED")}
                            className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/40 text-rose-400 border border-rose-500/30 rounded-xl text-sm font-medium transition-all"
                          >
                            ✕ Reject
                          </button>
                        </>
                      ) : (
                        <span className={`px-4 py-2 rounded-xl text-sm font-bold border ${
                          req.status === "APPROVED"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                        }`}>
                          {req.status}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 p-3 bg-white/5 rounded-xl border border-white/5">
                    <p className="text-white/50 text-xs font-semibold uppercase mb-1">Reason for Extension</p>
                    <p className="text-white/80 text-sm">{req.reason}</p>
                    <p className="text-amber-400 text-xs font-semibold mt-1">+{req.requestedDays} days requested</p>
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {/* TAB 6: RAISED ISSUES */}
          {activeTab === "raised" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-white">Raised Issues</h2>
                <span className="text-white/40 text-sm">{raisedIssues.length} total · {raisedIssues.filter(r => r.status === "PENDING").length} pending</span>
              </div>

              {raisedIssues.length === 0 ? (
                <div className="text-center py-16 text-white/30 italic">No raised issues yet.</div>
              ) : raisedIssues.map(issue => (
                <div key={issue.id} className={`bg-white/5 border rounded-2xl p-5 transition-all ${
                  issue.status === "PENDING" ? "border-amber-500/30 hover:border-amber-500/50" :
                  issue.status === "ASSIGNED" ? "border-blue-500/30" :
                  "border-emerald-500/20 opacity-60"
                }`}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <AlertOctagon className={`w-4 h-4 ${
                          issue.status === "PENDING" ? "text-amber-400" :
                          issue.status === "ASSIGNED" ? "text-blue-400" : "text-emerald-400"
                        }`} />
                        <p className="text-white font-semibold">{issue.title}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${
                          issue.status === "PENDING" ? "bg-amber-500/10 text-amber-400 border-amber-500/30" :
                          issue.status === "ASSIGNED" ? "bg-blue-500/10 text-blue-400 border-blue-500/30" :
                          "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        }`}>{issue.status}</span>
                      </div>
                      <p className="text-white/60 text-sm">{issue.description}</p>
                      <p className="text-white/40 text-xs">
                        Project: <span className="text-white/60">#{issue.complaint?.id} · {issue.complaint?.title}</span>
                        {" · "} Raised by: <span className="text-white/60">{issue.raisedBy?.name}</span>
                        {issue.assignedTo && <> · Assigned to: <span className="text-blue-400">{issue.assignedTo?.name}</span></>}
                      </p>
                    </div>

                    <div>
                      {issue.status === "PENDING" && (
                        <button
                          onClick={() => setRaisedIssueAssignModal({ isOpen: true, issueId: issue.id, issueTitle: issue.title })}
                          className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 border border-blue-500/30 rounded-xl text-sm font-medium transition-all whitespace-nowrap"
                        >
                          Assign SubAdmin
                        </button>
                      )}
                      {issue.status === "RESOLVED" && (
                        <span className="px-4 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-xl text-sm font-bold">✓ RESOLVED</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          )}

        </div>
      )}

      {/* Raised Issue Assign SubAdmin Modal */}
      {raisedIssueAssignModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[#111] border border-amber-500/20 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
          >
            <div className="flex justify-between items-center p-5 border-b border-white/10">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <AlertOctagon className="w-5 h-5 text-amber-400" /> Assign SubAdmin to Fix Issue
                </h3>
                <p className="text-white/40 text-sm mt-0.5">{raisedIssueAssignModal.issueTitle}</p>
              </div>
              <button onClick={() => setRaisedIssueAssignModal({ isOpen: false, issueId: null, issueTitle: "" })} className="text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-2 max-h-80 overflow-auto">
              <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3">Select a SubAdmin to resolve this issue</p>
              {subAdmins.length === 0 ? (
                <p className="text-center text-white/50 py-4">No Sub-Admins found.</p>
              ) : subAdmins.map(admin => (
                <button
                  key={admin.id}
                  disabled={assigningRaisedIssue}
                  onClick={async () => {
                    setAssigningRaisedIssue(true);
                    try {
                      await superAdminApi.assignRaisedIssue(raisedIssueAssignModal.issueId, admin.id);
                      toast({ title: "SubAdmin assigned ✅", description: `${admin.name} will now fix the raised issue.` });
                      setRaisedIssueAssignModal({ isOpen: false, issueId: null, issueTitle: "" });
                      fetchData();
                    } catch (err) {
                      toast({ title: "Failed to assign", description: err.message, variant: "destructive" });
                    } finally {
                      setAssigningRaisedIssue(false);
                    }
                  }}
                  className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/30 rounded-xl transition-all text-left group disabled:opacity-50"
                >
                  <div>
                    <div className="font-medium text-white group-hover:text-amber-400 transition-colors">{admin.name}</div>
                    <div className="text-xs text-white/50">{admin.phone}</div>
                    <div className="text-xs text-white/30">{admin._count?.assignedComplaints ?? 0} active cases</div>
                  </div>
                  <CheckCircle className="w-5 h-5 text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      {/* Enhanced Assignment Modal */}
      {assignModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl"
          >
            <div className="flex justify-between items-center p-5 border-b border-white/10">
              <div>
                <h3 className="text-lg font-bold text-white">Assign Project to Sub-Admin</h3>
                <p className="text-white/40 text-sm">Fill in project details before selecting a sub-admin</p>
              </div>
              <button onClick={() => setAssignModal({ isOpen: false, complaintId: null, projectAmount: "", warrantyPeriod: "", projectDeadline: "", projectNote: "" })} className="text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-white/10 max-h-[70vh] overflow-auto">
              {/* Left: Project Details */}
              <div className="p-5 space-y-4">
                <h4 className="text-white font-semibold text-sm uppercase tracking-widest opacity-60">Project Details</h4>

                <div>
                  <label className="block text-white/60 text-xs font-medium mb-1">Budget Amount (₹)</label>
                  <input
                    type="number"
                    placeholder="e.g. 150000"
                    value={assignModal.projectAmount}
                    onChange={e => setAssignModal(prev => ({ ...prev, projectAmount: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-emerald-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-white/60 text-xs font-medium mb-1">Warranty Period (days after resolution)</label>
                  <input
                    type="number"
                    placeholder="e.g. 365"
                    value={assignModal.warrantyPeriod}
                    onChange={e => setAssignModal(prev => ({ ...prev, warrantyPeriod: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-emerald-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-white/60 text-xs font-medium mb-1">Project Deadline</label>
                  <input
                    type="date"
                    value={assignModal.projectDeadline}
                    onChange={e => setAssignModal(prev => ({ ...prev, projectDeadline: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-emerald-500 text-sm"
                  />
                  <p className="text-white/30 text-xs mt-1">Leave blank to use default SLA days</p>
                </div>

                <div>
                  <label className="block text-white/60 text-xs font-medium mb-1">Project Description / Notes</label>
                  <textarea
                    rows={4}
                    placeholder="Describe the scope of work..."
                    value={assignModal.projectNote}
                    onChange={e => setAssignModal(prev => ({ ...prev, projectNote: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-emerald-500 text-sm resize-none"
                  />
                </div>
              </div>

              {/* Right: Sub-Admin Selection (filtered by complaint department) */}
              <div className="p-5 space-y-2">
                {(() => {
                  const dept = getComplaintDept();
                  const filtered = filteredSubAdminsForAssign();
                  return (
                    <>
                      <div className="mb-4">
                        <h4 className="text-white font-semibold text-sm uppercase tracking-widest opacity-60">Select Sub-Admin</h4>
                        {dept && (
                          <p className="text-xs text-amber-400/70 mt-1">Showing only <strong>{dept}</strong> department SubAdmins</p>
                        )}
                      </div>
                      {filtered.length === 0 ? (
                        <div className="py-6 text-center space-y-2">
                          <p className="text-white/50 text-sm">No SubAdmins for <strong className="text-amber-400">{dept}</strong> department.</p>
                          <p className="text-white/30 text-xs">Promote a user to SubAdmin and assign them to this department first.</p>
                        </div>
                      ) : filtered.map(admin => (
                        <button
                          key={admin.id}
                          onClick={() => handleAssign(admin.id)}
                          className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-emerald-500/10 border border-transparent hover:border-emerald-500/30 rounded-xl transition-all text-left group"
                        >
                          <div>
                            <div className="font-medium text-white group-hover:text-emerald-400 transition-colors">{admin.name}</div>
                            <div className="text-xs text-white/50">{admin.phone}</div>
                            <div className="flex gap-2 mt-1">
                              <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">{admin.department}</span>
                              <span className="text-xs text-white/30">{admin._count?.assignedComplaints ?? 0} active cases</span>
                            </div>
                          </div>
                          <CheckCircle className="w-5 h-5 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </>
                  );
                })()}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Department Selection Modal — shown when promoting a user to SubAdmin */}
      {deptModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[#111] border border-amber-500/30 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
          >
            <div className="flex justify-between items-center p-5 border-b border-white/10">
              <div>
                <h3 className="text-lg font-bold text-white">Assign Department</h3>
                <p className="text-white/40 text-sm mt-0.5">Select a department for <span className="text-amber-400">{deptModal.userName}</span></p>
              </div>
              <button onClick={() => setDeptModal({ isOpen: false, userId: null, userName: "" })} className="text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-3">
              {DEPARTMENTS.map(dept => (
                <button
                  key={dept.id}
                  onClick={() => handleSubAdminWithDept(dept.id)}
                  className="flex items-center gap-3 p-4 bg-white/5 hover:bg-amber-500/10 border border-white/10 hover:border-amber-500/40 rounded-xl transition-all text-left group"
                >
                  <span className="text-2xl">{dept.icon}</span>
                  <div>
                    <div className="text-sm font-medium text-white group-hover:text-amber-400 transition-colors">{dept.label}</div>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default SuperAdminPanel;
