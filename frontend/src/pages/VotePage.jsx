import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Vote, CheckCircle, Clock, LogOut, AlertCircle } from 'lucide-react';
import { api } from '../api/api.js';
import VoteOptionCard from '../components/VoteOptionCard.jsx';
import { io } from 'socket.io-client';

const VotePage = ({ user, setUser }) => {
  const navigate = useNavigate();
  
  const [vote, setVote] = useState(null);
  const [selectedChoices, setSelectedChoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [voteStatus, setVoteStatus] = useState({ hasVoted: false, voteExists: false });

  useEffect(() => {
    loadVoteData();
    
    // Connect to Socket.IO for real-time updates
    const socket = io(import.meta.env.PROD ? '' : 'http://localhost:3000', {
      withCredentials: true
    });
    
    socket.emit('user_connect', { userId: user?.id, username: user?.username });
    
    socket.on('vote_started', (newVote) => {
      setVote(newVote);
      setSelectedChoices([]);
      setSubmitted(false);
      setVoteStatus({ hasVoted: false, voteExists: true });
      setError('');
    });
    
    socket.on('vote_ended', () => {
      setVote(prev => prev ? { ...prev, active: false } : null);
    });
    
    socket.on('force_logout', (data) => {
      if (data.userId === user?.id) {
        handleLogout(true);
      }
    });
    
    return () => {
      socket.disconnect();
    };
  }, [user?.id]);

  const loadVoteData = async () => {
    try {
      setLoading(true);
      const [voteResponse, statusResponse] = await Promise.all([
        api.getCurrentVote(),
        api.getUserVoteStatus()
      ]);
      
      setVote(voteResponse.vote);
      setVoteStatus(statusResponse);
      
      if (statusResponse.hasVoted) {
        setSubmitted(true);
        setSelectedChoices(statusResponse.submission || []);
      }
    } catch (error) {
      setError('Failed to load voting data');
      console.error('Error loading vote data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOptionSelect = (option) => {
    if (submitted || !vote || !vote.active) return;
    
    const isSelected = selectedChoices.includes(option);
    
    if (isSelected) {
      setSelectedChoices(prev => prev.filter(choice => choice !== option));
    } else {
      if (selectedChoices.length >= vote.max_selections) {
        if (vote.max_selections === 1) {
          setSelectedChoices([option]);
        } else {
          setError(`You can only select up to ${vote.max_selections} options`);
          return;
        }
      } else {
        setSelectedChoices(prev => [...prev, option]);
      }
    }
    setError('');
  };

  const handleSubmitVote = async () => {
    if (selectedChoices.length === 0) {
      setError('Please select at least one option');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await api.submitVote(selectedChoices);
      
      if (response.success) {
        setSubmitted(true);
        setVoteStatus(prev => ({ ...prev, hasVoted: true }));
      }
    } catch (error) {
      setError(error.message || 'Failed to submit vote');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async (forced = false) => {
    try {
      if (!forced) {
        await api.logout();
      }
      setUser(null);
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout on client side even if API call fails
      setUser(null);
      navigate('/login', { replace: true });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading voting data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Vote className="h-8 w-8 text-primary-600 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">Voting System</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Welcome, <span className="font-medium">{user?.username}</span>
              </span>
              <button
                onClick={() => handleLogout()}
                className="btn-secondary text-sm"
              >
                <LogOut className="w-4 h-4 mr-1" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        )}

        {!vote ? (
          <div className="card text-center py-12">
            <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              No Active Vote
            </h2>
            <p className="text-gray-600">
              Please wait for an administrator to start a new vote.
            </p>
          </div>
        ) : (
          <>
            {submitted ? (
              <div className="card text-center py-12 bg-green-50 border-green-200">
                <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-green-900 mb-2">
                  Vote Submitted Successfully!
                </h2>
                <p className="text-green-700 mb-4">
                  Thank you for participating in the vote.
                </p>
                {selectedChoices.length > 0 && (
                  <div className="bg-white p-4 rounded-lg border border-green-200 inline-block">
                    <p className="text-sm font-medium text-gray-700 mb-2">Your selections:</p>
                    <ul className="text-sm text-gray-600 space-y-1">
                      {selectedChoices.map((choice, index) => (
                        <li key={index} className="flex items-center">
                          <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                          {choice}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {!vote.active && (
                  <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-blue-800 text-sm">
                      This vote has ended. Results may be available from the administrator.
                    </p>
                  </div>
                )}
              </div>
            ) : !vote.active ? (
              <div className="card text-center py-12 bg-amber-50 border-amber-200">
                <Clock className="w-16 h-16 text-amber-600 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-amber-900 mb-2">
                  Voting Has Ended
                </h2>
                <p className="text-amber-700">
                  This vote is no longer accepting submissions.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="card">
                  <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                      {vote.title}
                    </h2>
                    {vote.description && (
                      <p className="text-gray-600">{vote.description}</p>
                    )}
                    <div className="mt-4 inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                      Select {vote.max_selections === 1 ? '1 option' : `up to ${vote.max_selections} options`}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {vote.options.map((option, index) => (
                      <VoteOptionCard
                        key={index}
                        option={option}
                        isSelected={selectedChoices.includes(option)}
                        onSelect={() => handleOptionSelect(option)}
                        disabled={submitting}
                        index={index}
                      />
                    ))}
                  </div>

                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        {selectedChoices.length} of {vote.max_selections} selected
                      </div>
                      <button
                        onClick={handleSubmitVote}
                        disabled={selectedChoices.length === 0 || submitting}
                        className="btn-primary"
                      >
                        {submitting ? (
                          <div className="flex items-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Submitting...
                          </div>
                        ) : (
                          <div className="flex items-center">
                            <Vote className="w-4 h-4 mr-2" />
                            Submit Vote
                          </div>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default VotePage;
