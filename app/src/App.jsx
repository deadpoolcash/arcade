import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import Dice from './Dice.jsx'
import './App.css'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import '@solana/wallet-adapter-react-ui/styles.css';


const network = 'https://api.devnet.solana.com';


function App() {
  const [count, setCount] = useState(0)
    const wallets = [new PhantomWalletAdapter()];

  return (
    <>
        <ConnectionProvider endpoint={network}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>
                    <div className="App">
                        <header className="App-header">
                            <h1>My Solana App</h1>
                            <Dice />
                        </header>
                    </div>
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    </>
  )
}

export default App
