import React, { useState } from 'react';
import { Send, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';
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
      setError('ADDRESS REQUIRED');
      return;
    }

    if (!isValidAddress(address)) {
      setError('INVALID ADDRESS FORMAT');
      return;
    }

    setIsLoading(true);

    try {
      const result = await requestFunds(address);
      setTxHash(result.txHash);
      setSuccess(`TRANSACTION COMPLETE: ${result.amount} ETH SENT`);
      setAddress('');
    } catch (err) {
      setError(err.message.toUpperCase());
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      <div className="main-panel">
        <header className="header">
          <h1 className="title">SEPOLIA FAUCET</h1>
          <div className="subtitle">TESTNET ETH DISTRIBUTION</div>
        </header>

        <form onSubmit={handleSubmit} className="form">
          <div className="input-group">
            <label className="label">ETHEREUM ADDRESS</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="0x..."
              className="input"
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`submit-button ${isLoading ? 'loading' : ''}`}
          >
            {isLoading ? (
              <>
                <div className="spinner"></div>
                <span>PROCESSING</span>
              </>
            ) : (
              <>
                <Send className="icon" />
                <span>REQUEST 0.1 ETH</span>
              </>
            )}
          </button>
        </form>

        {error && (
          <div className="status-message error">
            <AlertCircle className="status-icon" />
            <div className="status-text">{error}</div>
          </div>
        )}

        {success && (
          <div className="status-message success">
            <div className="success-header">
              <CheckCircle className="status-icon" />
              <div className="status-text">{success}</div>
            </div>
            {txHash && (
              <div className="tx-details">
                <div className="tx-label">TRANSACTION HASH:</div>
                <div className="tx-hash-container">
                  <code className="tx-hash">{txHash}</code>
                  <a
                    href={`https://sepolia.etherscan.io/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tx-link"
                  >
                    <ExternalLink className="link-icon" />
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        <footer className="footer">
          <div className="footer-text">
            <div>RATE LIMIT: 1 REQUEST PER HOUR</div>
            <div>NETWORK: SEPOLIA TESTNET</div>
            <div>PURPOSE: DEVELOPMENT ONLY</div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;