import React, { useState } from 'react';
import { Send, Droplets, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';
import './App.css';

const App = () => {
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Backend API call
  const requestFunds = async (recipientAddress) => {
    const response = await fetch('/api/faucet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ address: recipientAddress }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to request funds');
    }

    return response.json();
  };

  const isValidAddress = (address) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setSuccess('');
    setTxHash('');

    if (!address) {
      setError('Please enter an Ethereum address');
      return;
    }

    if (!isValidAddress(address)) {
      setError('Please enter a valid Ethereum address');
      return;
    }

    setIsLoading(true);

    try {
      const result = await requestFunds(address);
      setTxHash(result.txHash);
      setSuccess(`Successfully sent ${result.amount} ETH to ${address}`);
      setAddress('');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <Droplets className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Sepolia Faucet</h1>
          <p className="text-gray-600">Get free testnet ETH for development</p>
        </div>

        <div className="space-y-6">
          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
              Ethereum Address
            </label>
            <input
              type="text"
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="0x742d35Cc6635Bb..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              disabled={isLoading}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Sending ETH...</span>
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                <span>Request 0.1 ETH</span>
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="text-red-700 text-sm">{error}</div>
          </div>
        )}

        {success && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start space-x-3 mb-3">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div className="text-green-700 text-sm">{success}</div>
            </div>
            {txHash && (
              <div className="border-t border-green-200 pt-3">
                <p className="text-xs text-gray-600 mb-2">Transaction Hash:</p>
                <div className="flex items-center space-x-2">
                  <code className="text-xs bg-gray-100 p-2 rounded flex-1 break-all">
                    {txHash}
                  </code>
                  <a
                    href={`https://sepolia.etherscan.io/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-blue-600 hover:text-blue-800"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 text-center">
          <div className="text-xs text-gray-500 space-y-1">
            <p>• Rate limited to 1 request per hour per address</p>
            <p>• Only works on Sepolia testnet</p>
            <p>• For development purposes only</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;