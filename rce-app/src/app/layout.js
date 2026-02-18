"use client";
import React, { useState, useEffect } from 'react';
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { LogIn, Lock, User } from 'lucide-react';

const inter = Inter({ subsets: ["latin"] });

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const expectedUser = process.env.NEXT_PUBLIC_APP_USERNAME || 'rce';
    const expectedPass = process.env.NEXT_PUBLIC_APP_PASSWORD || 'rce123';

    if (username === expectedUser && password === expectedPass) {
      onLogin();
    } else {
      setError('Usuário ou senha incorretos');
    }
  };

  return (
    <div className="login-page">
      <div className="login-card anim-slide-up">
        <div className="login-header">
          <div className="login-logo">RCE</div>
          <h1>Bem-vindo de volta</h1>
          <p>Faça login para gerenciar seu estoque</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label><User size={16} /> Usuário</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Digite seu usuário"
              required
            />
          </div>
          <div className="form-group">
            <label><Lock size={16} /> Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          {error && <div className="login-error">{error}</div>}
          <button type="submit" className="btn primary lg full-width">
            Entrar <span>→</span>
          </button>
        </form>

        <div className="login-footer">
          © 2026 RCE Papelaria | Gestão de Contratos
        </div>
      </div>
    </div>
  );
}

export default function RootLayout({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const authStatus = localStorage.getItem('rce_auth');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
    localStorage.setItem('rce_auth', 'true');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('rce_auth');
  };

  if (isLoading) return <div className="loading-screen">Carregando...</div>;

  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        {!isAuthenticated ? (
          <Login onLogin={handleLogin} />
        ) : (
          <div className="app-container">
            <Sidebar onLogout={handleLogout} />
            <main className="main-content">
              <header className="top-header glass">
                <div className="search-bar">
                  <input type="text" placeholder="Pesquisar..." />
                </div>
                <div className="user-profile">
                  <div className="avatar" onClick={handleLogout} title="Sair" style={{ cursor: 'pointer' }}>RCE</div>
                  <div className="user-info">
                    <span className="user-name">RCE</span>
                    <span className="user-role">Administrador</span>
                  </div>
                </div>
              </header>
              <section className="page-content">
                {children}
              </section>
            </main>
          </div>
        )}
      </body>
    </html>
  );
}
