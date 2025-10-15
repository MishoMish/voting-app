import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogIn, Users, Shield } from 'lucide-react';
import { api } from '../api/api.js';

const LoginPage = ({ setUser }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    isAdmin: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setError(''); // Clear error when user types
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.login(formData);
      
      if (response.success) {
        setUser(response.user);
        
        // Redirect based on user type and intended destination
        const from = location.state?.from?.pathname || (response.user.isAdmin ? '/admin' : '/vote');
        navigate(from, { replace: true });
      }
    } catch (error) {
      setError(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const toggleLoginType = () => {
    setFormData(prev => ({
      ...prev,
      isAdmin: !prev.isAdmin,
      username: '',
      password: ''
    }));
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-blue-100 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-primary-600 rounded-full flex items-center justify-center mb-4">
            {formData.isAdmin ? (
              <Shield className="h-8 w-8 text-white" />
            ) : (
              <Users className="h-8 w-8 text-white" />
            )}
          </div>
          <h2 className="text-3xl font-bold text-gray-900">
            {formData.isAdmin ? 'Admin Login' : 'Voter Login'}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {formData.isAdmin 
              ? 'Access the admin panel to manage voting'
              : 'Sign in to participate in voting'
            }
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="card">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="username" className="label">
                  Username
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  className="input"
                  placeholder={formData.isAdmin ? "Admin username" : "Your username"}
                  value={formData.username}
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="password" className="label">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="input"
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="mt-6">
              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Signing in...
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <LogIn className="w-4 h-4 mr-2" />
                    Sign In
                  </div>
                )}
              </button>
            </div>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={toggleLoginType}
                className="text-sm text-primary-600 hover:text-primary-500 font-medium"
                disabled={loading}
              >
                {formData.isAdmin ? 'Switch to Voter Login' : 'Admin Login'}
              </button>
            </div>
          </div>
        </form>

        {!formData.isAdmin && (
          <div className="card bg-blue-50 border-blue-200">
            <h3 className="text-sm font-medium text-blue-900 mb-2">Test Accounts</h3>
            <p className="text-xs text-blue-700 mb-2">
              You can use any of these test accounts:
            </p>
            <div className="text-xs text-blue-600 space-y-1">
              <div><strong>Users:</strong> student1, student2, student3, teacher1, alice, bob</div>
              <div><strong>Passwords:</strong> password1, password2, password3, teacher123, alice123, bob123</div>
            </div>
          </div>
        )}

        {formData.isAdmin && (
          <div className="card bg-amber-50 border-amber-200">
            <h3 className="text-sm font-medium text-amber-900 mb-2">Admin Credentials</h3>
            <div className="text-xs text-amber-700">
              <div><strong>Username:</strong> admin</div>
              <div><strong>Password:</strong> admin123</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
