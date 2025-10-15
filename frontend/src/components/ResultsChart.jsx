import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'];

const ResultsChart = ({ results, detailedResults, vote, title }) => {
  // Transform results object to array format for recharts
  const chartData = Object.entries(results || {}).map(([option, votes], index) => ({
    option: option.length > 20 ? option.substring(0, 20) + '...' : option,
    fullOption: option,
    votes,
    color: COLORS[index % COLORS.length]
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900">{data.fullOption}</p>
          <p className="text-primary-600">
            Votes: <span className="font-bold">{data.votes}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  if (!results || Object.keys(results).length === 0) {
    return (
      <div className="card text-center py-8">
        <p className="text-gray-500">No voting results yet</p>
      </div>
    );
  }

  const maxVotes = Math.max(...Object.values(results));
  const totalVotes = Object.values(results).reduce((sum, votes) => sum + votes, 0);

  return (
    <div className="card">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {title || 'Voting Results'}
        </h3>
        <p className="text-sm text-gray-600">
          Total votes: {totalVotes}
        </p>
      </div>

      <div className="mb-6">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis 
              dataKey="option" 
              angle={-45}
              textAnchor="end"
              height={80}
              interval={0}
              tick={{ fontSize: 12 }}
              stroke="#64748b"
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              stroke="#64748b"
              domain={[0, maxVotes + 1]}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="votes" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Results summary table */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Detailed Results</h4>
        {chartData
          .sort((a, b) => b.votes - a.votes)
          .map((item, index) => {
            const percentage = totalVotes > 0 ? ((item.votes / totalVotes) * 100).toFixed(1) : 0;
            const optionDetails = detailedResults?.[item.fullOption];
            
            return (
              <div key={item.fullOption} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: item.color }}
                    ></div>
                    <span className="text-sm font-medium text-gray-900">
                      {index + 1}. {item.fullOption}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">
                      {item.votes} votes
                    </div>
                    <div className="text-xs text-gray-500">
                      {percentage}%
                    </div>
                  </div>
                </div>
                
                {/* Show voter names for non-anonymous votes */}
                {vote && !vote.anonymous && optionDetails && optionDetails.voters && optionDetails.voters.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-300">
                    <h5 className="text-xs font-medium text-gray-600 mb-2">Voters:</h5>
                    <div className="flex flex-wrap gap-1">
                      {optionDetails.voters.map((voter, voterIndex) => (
                        <span
                          key={voterIndex}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {voter}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Show anonymous message for anonymous votes */}
                {vote && vote.anonymous && item.votes > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-300">
                    <p className="text-xs text-gray-500 italic">
                      Anonymous voting - voter identities hidden
                    </p>
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
};

export default ResultsChart;
