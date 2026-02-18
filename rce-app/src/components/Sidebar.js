"use client";
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  FileText,
  FilePlus,
  Settings,
  Menu,
  X,
  LogOut
} from 'lucide-react';

const menuItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Clientes', path: '/clients', icon: Users },
  { name: 'Estoque', path: '/inventory', icon: Package },
  { name: 'Pedidos', path: '/orders/history', icon: ShoppingCart },
  { name: 'Propostas', path: '/proposals', icon: FileText },
  { name: 'Documentação', path: '/documents', icon: FilePlus },
];

export default function Sidebar({ onLogout }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = React.useState(true);

  return (
    <div className={`sidebar ${isOpen ? 'open' : 'closed'} glass`}>
      <div className="sidebar-header">
        <div className="logo-placeholder">
          <span className="logo-rce">RCE</span>
          <span className="logo-papelaria">Papelaria</span>
        </div>
        <button onClick={() => setIsOpen(!isOpen)} className="toggle-btn">
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path;
          return (
            <Link key={item.path} href={item.path}>
              <div className={`nav-item ${isActive ? 'active' : ''}`}>
                <Icon size={20} />
                {isOpen && <span>{item.name}</span>}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="nav-item">
          <Settings size={20} />
          {isOpen && <span>Configurações</span>}
        </div>
        <div className="nav-item logout" onClick={onLogout} style={{ cursor: 'pointer', color: '#ff3b30' }}>
          <LogOut size={20} />
          {isOpen && <span>Sair</span>}
        </div>
        {isOpen && <div style={{
          padding: '10px 20px',
          fontSize: '0.7rem',
          opacity: 0.4,
          textAlign: 'center',
          marginTop: 'auto'
        }}>v1.2.3</div>}
      </div>

    </div>
  );
}
