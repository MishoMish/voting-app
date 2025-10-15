import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Settings, LogOut, Plus, Play, Square, Users, Download, 
  UserX, Eye, EyeOff, BarChart3, RefreshCw, AlertCircle 
} from 'lucide-react';
import { api } from '../api/api.js';
import ProgressBar from '../components/ProgressBar.jsx';
import ResultsChart from '../components/ResultsChart.jsx';
import { io } from 'socket.io-client';

const AdminPanel = ({ user, setUser }) => {
  const navigate = useNavigate();
  
  const [dashboardData, setDashboardData] = useState(null);
  const [users, setUsers] = useState([]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // New vote form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newVote, setNewVote] = useState({
    title: '',
    description: '',
    options: ['', ''],
    maxSelections: 1,
    anonymous: false
  });
  const [creating, setCreating] = useState(false);
  
  const [actionLoading, setActionLoading] = useState({});
  
  // New features state
  const [historicalVotes, setHistoricalVotes] = useState([]);
  const [selectedVoteDetails, setSelectedVoteDetails] = useState(null);
  const [showUserForm, setShowUserForm] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    role: 'user'
  });

  useEffect(() => {
    loadData();
    
    // Connect to Socket.IO for real-time updates
    const socket = io(import.meta.env.PROD ? '' : 'http://localhost:3000', {
      withCredentials: true
    });
    
    socket.emit('admin_connect');
    
    socket.on('user_logged_in', ({ username }) => {
      console.log(`User logged in: ${username}`);
      loadUsers();
    });
    
    socket.on('user_logged_out', ({ username }) => {
      console.log(`User logged out: ${username}`);
      loadUsers();
    });
    
    socket.on('vote_submitted', ({ username, totalVoted, totalUsers }) => {
      console.log(`Vote submitted by: ${username}`);
      loadDashboard();
      loadResults();
      loadUsers();
    });
    
    return () => {
      socket.disconnect();
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadDashboard(),
        loadUsers(),
        loadResults()
      ]);
    } catch (error) {
      setError('Failed to load admin data');
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDashboard = async () => {
    try {
      const response = await api.getDashboard();
      setDashboardData(response);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await api.getUsers();
      setUsers(response.users);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadResults = async () => {
    try {
      const response = await api.getResults();
      setResults(response);
    } catch (error) {
      console.error('Error loading results:', error);
    }
  };

  // New functions for enhanced features
  const loadHistoricalVotes = async () => {
    try {
      const response = await api.getAllVotes();
      setHistoricalVotes(response);
    } catch (error) {
      console.error('Error loading historical votes:', error);
      setError('Failed to load historical votes');
    }
  };

  const loadVoteDetails = async (voteId) => {
    try {
      const response = await api.getVoteDetails(voteId);
      setSelectedVoteDetails(response);
    } catch (error) {
      console.error('Error loading vote details:', error);
      setError('Failed to load vote details');
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.addUser(newUser);
      setNewUser({ username: '', password: '', role: 'user' });
      setShowUserForm(false);
      await loadUsers();
      setError('');
    } catch (error) {
      setError(error.message || 'Failed to add user');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (!confirm(`Are you sure you want to delete user "${username}"? This action cannot be undone.`)) {
      return;
    }

    setActionLoading({ ...actionLoading, [`delete_${userId}`]: true });
    try {
      await api.deleteUser(userId);
      await loadUsers();
      setError('');
    } catch (error) {
      setError(error.message || 'Failed to delete user');
    } finally {
      setActionLoading({ ...actionLoading, [`delete_${userId}`]: false });
    }
  };

  const exportVoteDetails = (voteDetails) => {
    const exportData = {
      vote: voteDetails.vote,
      results: voteDetails.results,
      voterDetails: voteDetails.voterDetails,
      totalParticipation: voteDetails.totalParticipation,
      exportedAt: new Date().toISOString()
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `vote_${voteDetails.vote.id}_${voteDetails.vote.title.replace(/[^a-zA-Z0-9]/g, '_')}_results.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleLogout = async () => {
    try {
      await api.logout();
      setUser(null);
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleCreateVote = async () => {
    const validOptions = newVote.options.filter(opt => opt.trim());
    
    if (!newVote.title.trim()) {
      setError('Vote title is required');
      return;
    }
    
    if (validOptions.length < 2) {
      setError('At least 2 options are required');
      return;
    }
    
    if (newVote.maxSelections < 1 || newVote.maxSelections > validOptions.length) {
      setError('Invalid max selections value');
      return;
    }

    setCreating(true);
    setError('');

    try {
      const response = await api.startVote({
        title: newVote.title.trim(),
        description: newVote.description.trim(),
        options: validOptions,
        maxSelections: newVote.maxSelections,
        anonymous: newVote.anonymous
      });
      
      if (response.success) {
        setShowCreateForm(false);
        setNewVote({
          title: '',
          description: '',
          options: ['', ''],
          maxSelections: 1,
          anonymous: false
        });
        await loadData();
      }
    } catch (error) {
      setError(error.message || 'Failed to create vote');
    } finally {
      setCreating(false);
    }
  };

  const handleEndVote = async () => {
    setActionLoading(prev => ({ ...prev, endVote: true }));
    
    try {
      const response = await api.endVote();
      if (response.success) {
        await loadData();
      }
    } catch (error) {
      setError(error.message || 'Failed to end vote');
    } finally {
      setActionLoading(prev => ({ ...prev, endVote: false }));
    }
  };

  const handleLogoutUser = async (userId) => {
    setActionLoading(prev => ({ ...prev, [`logout_${userId}`]: true }));
    
    try {
      const response = await api.logoutUser(userId);
      if (response.success) {
        await loadUsers();
      }
    } catch (error) {
      setError(error.message || 'Failed to logout user');
    } finally {
      setActionLoading(prev => ({ ...prev, [`logout_${userId}`]: false }));
    }
  };

  const handleExport = async (format) => {
    try {
      const response = await api.exportResults(format);
      
      if (format === 'csv') {
        const blob = new Blob([await response.text()], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vote-results-${Date.now()}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        const blob = new Blob([JSON.stringify(await response.json(), null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vote-results-${Date.now()}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      setError(error.message || 'Failed to export results');
    }
  };

  const addOption = () => {
    setNewVote(prev => ({
      ...prev,
      options: [...prev.options, '']
    }));
  };

  const removeOption = (index) => {
    setNewVote(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }));
  };

  const updateOption = (index, value) => {
    setNewVote(prev => ({
      ...prev,
      options: prev.options.map((opt, i) => i === index ? value : opt)
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Settings className="h-8 w-8 text-primary-600 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">Admin Panel</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Welcome, <span className="font-medium">{user?.username}</span>
              </span>
              <button
                onClick={handleLogout}
                className="btn-secondary text-sm"
              >
                <LogOut className="w-4 h-4 mr-1" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
              <p className="text-red-800">{error}</p>
              <button
                onClick={() => setError('')}
                className="ml-auto text-red-600 hover:text-red-800"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
              { id: 'users', label: 'Users', icon: Users },
              { id: 'results', label: 'Results', icon: Eye },
              { id: 'history', label: 'History', icon: RefreshCw },
              { id: 'manage', label: 'User Management', icon: Settings }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center py-2 px-1 border-b-2 font-medium text-sm
                  ${activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <tab.icon className="w-4 h-4 mr-2" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Current Vote Status */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Current Vote</h2>
                <button
                  onClick={loadDashboard}
                  className="btn-secondary text-sm"
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Refresh
                </button>
              </div>

              {dashboardData?.currentVote ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium text-gray-900">{dashboardData.currentVote.title}</h3>
                    {dashboardData.currentVote.description && (
                      <p className="text-gray-600 text-sm mt-1">{dashboardData.currentVote.description}</p>
                    )}
                    <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                      <span>Max selections: {dashboardData.currentVote.max_selections}</span>
                      <span>Options: {dashboardData.currentVote.options?.length}</span>
                      <span className={dashboardData.currentVote.active ? 'text-green-600' : 'text-red-600'}>
                        {dashboardData.currentVote.active ? 'Active' : 'Ended'}
                      </span>
                    </div>
                  </div>

                  <ProgressBar
                    current={dashboardData.stats.votedUsers}
                    total={dashboardData.stats.totalUsers}
                    label="Voting Progress"
                  />

                  <div className="flex space-x-3">
                    {dashboardData.currentVote.active && (
                      <button
                        onClick={handleEndVote}
                        disabled={actionLoading.endVote}
                        className="btn-danger"
                      >
                        {actionLoading.endVote ? (
                          <div className="flex items-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Ending...
                          </div>
                        ) : (
                          <div className="flex items-center">
                            <Square className="w-4 h-4 mr-2" />
                            End Vote
                          </div>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">No active vote</p>
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="btn-primary"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create New Vote
                  </button>
                </div>
              )}
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Users', value: dashboardData?.stats.totalUsers || 0, color: 'blue' },
                { label: 'Logged In', value: dashboardData?.stats.loggedInUsers || 0, color: 'green' },
                { label: 'Voted', value: dashboardData?.stats.votedUsers || 0, color: 'purple' },
                { label: 'Participation Rate', value: `${dashboardData?.stats.participationRate || 0}%`, color: 'orange' }
              ].map((stat) => (
                <div key={stat.label} className={`card bg-${stat.color}-50 border-${stat.color}-200`}>
                  <div className="text-center">
                    <p className={`text-2xl font-bold text-${stat.color}-600`}>{stat.value}</p>
                    <p className={`text-sm text-${stat.color}-700 font-medium`}>{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Recent Votes */}
            {dashboardData?.recentVotes && dashboardData.recentVotes.length > 0 && (
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Votes</h3>
                <div className="space-y-3">
                  {dashboardData.recentVotes.map((vote) => (
                    <div key={vote.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{vote.title}</p>
                        <p className="text-sm text-gray-500">
                          Created: {new Date(vote.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          vote.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {vote.active ? 'Active' : 'Ended'}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {vote.submission_count} submissions
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">User Management</h2>
                <button
                  onClick={loadUsers}
                  className="btn-secondary text-sm"
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Refresh
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Username
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Voted
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {user.username}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            user.logged_in 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {user.logged_in ? 'Online' : 'Offline'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            user.voted 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {user.voted ? 'Voted' : 'Not Voted'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {user.logged_in && (
                            <button
                              onClick={() => handleLogoutUser(user.id)}
                              disabled={actionLoading[`logout_${user.id}`]}
                              className="btn-danger text-xs"
                            >
                              {actionLoading[`logout_${user.id}`] ? (
                                <div className="flex items-center">
                                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                                  Logging out...
                                </div>
                              ) : (
                                <div className="flex items-center">
                                  <UserX className="w-3 h-3 mr-1" />
                                  Force Logout
                                </div>
                              )}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Results Tab */}
        {activeTab === 'results' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Vote Results</h2>
              <div className="flex space-x-2">
                <button
                  onClick={loadResults}
                  className="btn-secondary text-sm"
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Refresh
                </button>
                {results?.results && (
                  <>
                    <button
                      onClick={() => handleExport('json')}
                      className="btn-secondary text-sm"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Export JSON
                    </button>
                    <button
                      onClick={() => handleExport('csv')}
                      className="btn-secondary text-sm"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Export CSV
                    </button>
                  </>
                )}
              </div>
            </div>

            {results?.results ? (
              <>
                <ResultsChart 
                  results={results.results} 
                  detailedResults={results.detailedResults}
                  vote={results.vote}
                  title={results.vote?.title}
                />
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="card bg-blue-50 border-blue-200">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">{results.stats?.totalUsers}</p>
                      <p className="text-sm text-blue-700 font-medium">Total Users</p>
                    </div>
                  </div>
                  <div className="card bg-green-50 border-green-200">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">{results.stats?.totalVoted}</p>
                      <p className="text-sm text-green-700 font-medium">Voted</p>
                    </div>
                  </div>
                  <div className="card bg-purple-50 border-purple-200">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-purple-600">{results.stats?.participationRate}%</p>
                      <p className="text-sm text-purple-700 font-medium">Participation</p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="card text-center py-8">
                <p className="text-gray-500">No results available yet</p>
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Vote History</h2>
              <button
                onClick={loadHistoricalVotes}
                className="btn-secondary text-sm"
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Refresh
              </button>
            </div>

            <div className="card">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="table-header">ID</th>
                      <th className="table-header">Title</th>
                      <th className="table-header">Description</th>
                      <th className="table-header">Start Time</th>
                      <th className="table-header">End Time</th>
                      <th className="table-header">Status</th>
                      <th className="table-header">Submissions</th>
                      <th className="table-header">Anonymous</th>
                      <th className="table-header">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {historicalVotes.map((vote) => (
                      <tr key={vote.id}>
                        <td className="table-cell font-medium">{vote.id}</td>
                        <td className="table-cell font-medium">{vote.title}</td>
                        <td className="table-cell text-gray-500">{vote.description || 'No description'}</td>
                        <td className="table-cell">{new Date(vote.start_time).toLocaleString()}</td>
                        <td className="table-cell">
                          {vote.end_time ? new Date(vote.end_time).toLocaleString() : 'Not ended'}
                        </td>
                        <td className="table-cell">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            vote.status === 'completed' ? 'bg-green-100 text-green-800' : 
                            vote.status === 'active' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {vote.status}
                          </span>
                        </td>
                        <td className="table-cell">{vote.total_submissions}</td>
                        <td className="table-cell">
                          {vote.anonymous ? (
                            <span className="text-green-600 font-medium">Yes</span>
                          ) : (
                            <span className="text-gray-500">No</span>
                          )}
                        </td>
                        <td className="table-cell">
                          <button
                            onClick={() => loadVoteDetails(vote.id)}
                            className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {historicalVotes.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-500">No historical votes found</p>
                  <button
                    onClick={loadHistoricalVotes}
                    className="btn-primary mt-4"
                  >
                    Load Historical Votes
                  </button>
                </div>
              )}
            </div>

            {/* Vote Details Modal */}
            {selectedVoteDetails && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Vote Details: {selectedVoteDetails.vote.title}
                      </h3>
                      <button
                        onClick={() => setSelectedVoteDetails(null)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        ×
                      </button>
                    </div>

                    <div className="space-y-6">
                      {/* Vote Info */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="card">
                          <h4 className="font-medium text-gray-900 mb-2">Vote Information</h4>
                          <p><strong>Description:</strong> {selectedVoteDetails.vote.description || 'No description'}</p>
                          <p><strong>Status:</strong> {selectedVoteDetails.vote.status}</p>
                          <p><strong>Anonymous:</strong> {selectedVoteDetails.vote.anonymous ? 'Yes' : 'No'}</p>
                          <p><strong>Start Time:</strong> {new Date(selectedVoteDetails.vote.start_time).toLocaleString()}</p>
                          <p><strong>End Time:</strong> {selectedVoteDetails.vote.end_time ? new Date(selectedVoteDetails.vote.end_time).toLocaleString() : 'Not ended'}</p>
                        </div>
                        
                        <div className="card">
                          <h4 className="font-medium text-gray-900 mb-2">Participation</h4>
                          <p className="text-2xl font-bold text-blue-600">{selectedVoteDetails.totalParticipation}</p>
                          <p className="text-gray-600">Total Participants</p>
                        </div>
                      </div>

                      {/* Results Chart */}
                      {selectedVoteDetails.results && selectedVoteDetails.results.length > 0 && (
                        <div className="card">
                          <h4 className="font-medium text-gray-900 mb-4">Results</h4>
                          <div className="space-y-2">
                            {selectedVoteDetails.results.map((result, index) => (
                              <div key={index} className="flex items-center justify-between">
                                <span className="font-medium">{result.name}</span>
                                <span className="text-lg font-bold text-blue-600">{result.vote_count} votes</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Voter Details (if not anonymous) */}
                      {!selectedVoteDetails.vote.anonymous && selectedVoteDetails.voterDetails && selectedVoteDetails.voterDetails.length > 0 && (
                        <div className="card">
                          <h4 className="font-medium text-gray-900 mb-4">Voter Details</h4>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="table-header">Username</th>
                                  <th className="table-header">Voted For</th>
                                  <th className="table-header">Timestamp</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {selectedVoteDetails.voterDetails.map((voter, index) => (
                                  <tr key={index}>
                                    <td className="table-cell">{voter.username}</td>
                                    <td className="table-cell">{voter.voted_for}</td>
                                    <td className="table-cell">{new Date(voter.timestamp).toLocaleString()}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end space-x-3">
                        <button
                          onClick={() => exportVoteDetails(selectedVoteDetails)}
                          className="btn-secondary"
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Export Results
                        </button>
                        <button
                          onClick={() => setSelectedVoteDetails(null)}
                          className="btn-primary"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* User Management Tab */}
        {activeTab === 'manage' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">User Management</h2>
              <button
                onClick={() => setShowUserForm(true)}
                className="btn-primary"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add User
              </button>
            </div>

            <div className="card">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="table-header">ID</th>
                      <th className="table-header">Username</th>
                      <th className="table-header">Role</th>
                      <th className="table-header">Status</th>
                      <th className="table-header">Created</th>
                      <th className="table-header">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td className="table-cell font-medium">{user.id}</td>
                        <td className="table-cell font-medium">{user.username}</td>
                        <td className="table-cell">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="table-cell">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            user.logged_in ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {user.logged_in ? 'Online' : 'Offline'}
                          </span>
                        </td>
                        <td className="table-cell">
                          {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="table-cell">
                          <div className="flex space-x-2">
                            {user.logged_in && (
                              <button
                                onClick={() => handleLogoutUser(user.id)}
                                disabled={actionLoading[`logout_${user.id}`]}
                                className="text-orange-600 hover:text-orange-900 text-sm font-medium disabled:opacity-50"
                              >
                                {actionLoading[`logout_${user.id}`] ? 'Logging out...' : 'Force Logout'}
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteUser(user.id, user.username)}
                              disabled={actionLoading[`delete_${user.id}`]}
                              className="text-red-600 hover:text-red-900 text-sm font-medium disabled:opacity-50"
                            >
                              {actionLoading[`delete_${user.id}`] ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Add User Modal */}
            {showUserForm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg max-w-md w-full">
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New User</h3>
                    
                    <form onSubmit={handleAddUser} className="space-y-4">
                      <div>
                        <label className="label">Username *</label>
                        <input
                          type="text"
                          className="input"
                          placeholder="Enter username"
                          value={newUser.username}
                          onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))}
                          required
                        />
                      </div>

                      <div>
                        <label className="label">Password *</label>
                        <input
                          type="password"
                          className="input"
                          placeholder="Enter password"
                          value={newUser.password}
                          onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                          required
                        />
                      </div>

                      <div>
                        <label className="label">Role *</label>
                        <select
                          className="input"
                          value={newUser.role}
                          onChange={(e) => setNewUser(prev => ({ ...prev, role: e.target.value }))}
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>

                      <div className="flex justify-end space-x-3">
                        <button
                          type="button"
                          onClick={() => setShowUserForm(false)}
                          className="btn-secondary"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={creating}
                          className="btn-primary"
                        >
                          {creating ? (
                            <div className="flex items-center">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Creating...
                            </div>
                          ) : (
                            <>
                              <Plus className="w-4 h-4 mr-1" />
                              Add User
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Create Vote Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Vote</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="label">Vote Title *</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Enter vote title"
                      value={newVote.title}
                      onChange={(e) => setNewVote(prev => ({ ...prev, title: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="label">Description (Optional)</label>
                    <textarea
                      className="input"
                      rows={3}
                      placeholder="Enter vote description"
                      value={newVote.description}
                      onChange={(e) => setNewVote(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="label">Options *</label>
                    {newVote.options.map((option, index) => (
                      <div key={index} className="flex items-center space-x-2 mb-2">
                        <input
                          type="text"
                          className="input flex-1"
                          placeholder={`Option ${index + 1}`}
                          value={option}
                          onChange={(e) => updateOption(index, e.target.value)}
                        />
                        {newVote.options.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeOption(index)}
                            className="btn-danger text-sm px-2 py-1"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addOption}
                      className="btn-secondary text-sm mt-2"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Option
                    </button>
                  </div>

                  <div>
                    <label className="label">Maximum Selections</label>
                    <input
                      type="number"
                      className="input"
                      min="1"
                      max={newVote.options.filter(opt => opt.trim()).length}
                      value={newVote.maxSelections}
                      onChange={(e) => setNewVote(prev => ({ ...prev, maxSelections: parseInt(e.target.value) || 1 }))}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="anonymous"
                      checked={newVote.anonymous}
                      onChange={(e) => setNewVote(prev => ({ ...prev, anonymous: e.target.checked }))}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <label htmlFor="anonymous" className="label cursor-pointer">
                      Anonymous Voting
                      <span className="block text-sm text-gray-600">
                        When enabled, voter identities will not be recorded in the database
                      </span>
                    </label>
                  </div>
                </div>

                <div className="flex space-x-3 mt-6 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => setShowCreateForm(false)}
                    className="btn-secondary flex-1"
                    disabled={creating}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateVote}
                    disabled={creating}
                    className="btn-primary flex-1"
                  >
                    {creating ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Creating...
                      </div>
                    ) : (
                      <div className="flex items-center justify-center">
                        <Play className="w-4 h-4 mr-2" />
                        Start Vote
                      </div>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminPanel;
