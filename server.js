// server.js
const express = require('express');
const { ethers } = require('ethers');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(cors());

// Rate limiting - 1 request per hour per IP
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1, // limit each IP to 1 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again after an hour.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// In-memory storage for address-based rate limiting
const addressCooldowns = new Map();
const ADDRESS_COOLDOWN = 60 * 60 * 1000; // 1 hour in milliseconds

// Ethereum setup
const provider = new ethers.JsonRpcProvider(
  process.env.SEPOLIA_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY'
);

// Validate and create wallet from private key
if (!process.env.PRIVATE_KEY) {
  console.error('❌ PRIVATE_KEY environment variable is not set');
  console.error('Please set PRIVATE_KEY in your .env file');
  process.exit(1);
}

// Validate private key format
const privateKey = process.env.PRIVATE_KEY.replace('0x', ''); // Remove 0x prefix if present
if (!/^[0-9a-fA-F]{64}$/.test(privateKey)) {
  console.error('❌ Invalid private key format');
  console.error('Private key must be a 64-character hexadecimal string');
  console.error('Current value:', process.env.PRIVATE_KEY);
  process.exit(1);
}

const faucetWallet = new ethers.Wallet(privateKey, provider);

// Faucet configuration
const FAUCET_AMOUNT = ethers.parseEther('0.1'); // 0.1 ETH
const MIN_BALANCE = ethers.parseEther('1.0'); // Minimum balance to keep operating

// Utility functions
const isValidAddress = (address) => {
  try {
    return ethers.isAddress(address);
  } catch {
    return false;
  }
};

const checkAddressCooldown = (address) => {
  const lastRequest = addressCooldowns.get(address.toLowerCase());
  if (lastRequest && Date.now() - lastRequest < ADDRESS_COOLDOWN) {
    return false;
  }
  return true;
};

const updateAddressCooldown = (address) => {
  addressCooldowns.set(address.toLowerCase(), Date.now());
};

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const balance = await provider.getBalance(faucetWallet.address);
    const network = await provider.getNetwork();
    
    res.json({
      status: 'healthy',
      faucetAddress: faucetWallet.address,
      balance: ethers.formatEther(balance),
      network: network.name,
      chainId: network.chainId.toString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Main faucet endpoint
app.post('/api/faucet', limiter, async (req, res) => {
  try {
    const { address } = req.body;

    // Validate request
    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }

    if (!isValidAddress(address)) {
      return res.status(400).json({ error: 'Invalid Ethereum address' });
    }

    // Check address-specific cooldown
    if (!checkAddressCooldown(address)) {
      return res.status(429).json({ 
        error: 'This address has already requested funds recently. Please wait 1 hour.' 
      });
    }

    // Check faucet balance
    const faucetBalance = await provider.getBalance(faucetWallet.address);
    if (faucetBalance < MIN_BALANCE) {
      return res.status(503).json({ 
        error: 'Faucet is running low on funds. Please contact the administrator.' 
      });
    }

    // Check recipient balance (optional: prevent sending to already rich addresses)
    const recipientBalance = await provider.getBalance(address);
    const maxRecipientBalance = ethers.parseEther('5.0'); // Don't send if they already have > 5 ETH
    
    if (recipientBalance > maxRecipientBalance) {
      return res.status(400).json({ 
        error: 'Recipient address already has sufficient funds' 
      });
    }

    // Prepare transaction
    const tx = {
      to: address,
      value: FAUCET_AMOUNT,
      gasLimit: 21000, // Standard ETH transfer
    };

    // Send transaction
    console.log(`Sending ${ethers.formatEther(FAUCET_AMOUNT)} ETH to ${address}`);
    const transaction = await faucetWallet.sendTransaction(tx);
    
    // Update cooldown
    updateAddressCooldown(address);

    // Wait for transaction to be mined (optional, but good UX)
    const receipt = await transaction.wait(1);

    console.log(`Transaction successful: ${transaction.hash}`);
    
    res.json({
      success: true,
      txHash: transaction.hash,
      amount: ethers.formatEther(FAUCET_AMOUNT),
      blockNumber: receipt.blockNumber
    });

  } catch (error) {
    console.error('Faucet error:', error);
    
    // Handle specific error types
    if (error.code === 'INSUFFICIENT_FUNDS') {
      res.status(503).json({ error: 'Faucet has insufficient funds' });
    } else if (error.code === 'NETWORK_ERROR') {
      res.status(502).json({ error: 'Network error. Please try again later.' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Get faucet stats
app.get('/api/stats', async (req, res) => {
  try {
    const balance = await provider.getBalance(faucetWallet.address);
    const gasPrice = await provider.getFeeData();
    
    res.json({
      faucetBalance: ethers.formatEther(balance),
      faucetAddress: faucetWallet.address,
      amountPerRequest: ethers.formatEther(FAUCET_AMOUNT),
      gasPrice: ethers.formatUnits(gasPrice.gasPrice, 'gwei'),
      cooldownPeriod: '1 hour'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve static files (frontend)
app.use(express.static(path.join(__dirname, 'build')));

// Catch all handler: send back React's index.html file for any non-API routes
app.get('*', (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚰 Faucet server running on port ${PORT}`);
  console.log(`Faucet address: ${faucetWallet.address}`);
  console.log(`Network: Sepolia Testnet`);
});