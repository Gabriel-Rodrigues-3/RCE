"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Package,
  AlertTriangle,
  ShoppingCart,
  Users,
  FileText,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  CreditCard,
  Plus,
  ArrowRight,
  Info,
  BarChart3,
  X
} from 'lucide-react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { supabase } from '@/lib/supabase';

export default function Dashboard() {
  const [metrics, setMetrics] = useState({
    totalProducts: 0,
    totalStock: 0,
    reservedStock: 0,
    availableStock: 0,
    ordersReservado: 0,
    ordersEntregue: 0,
    ordersFaturado: 0,
    totalClients: 0,
    lowStockCount: 0,
    outOfStockCount: 0
  });

  const [recentOrders, setRecentOrders] = useState([]);
  const [stockAlerts, setStockAlerts] = useState([]);
  const [recentDocuments, setRecentDocuments] = useState([]);
  const [showChartsModal, setShowChartsModal] = useState(false);
  const [chartsData, setChartsData] = useState({
    ordersByStatus: [],
    topProducts: []
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);

    try {
      // Fetch products and calculate stock metrics
      const { data: products } = await supabase
        .from('products')
        .select('id, name, stock_quantity');

      // Fetch all order products with reserved status
      const { data: orderProducts } = await supabase
        .from('order_products')
        .select('quantity, product_id, orders!inner(status)')
        .eq('orders.status', 'Reservado');

      // Calculate reserved quantities per product
      const reservedByProduct = {};
      orderProducts?.forEach(op => {
        reservedByProduct[op.product_id] = (reservedByProduct[op.product_id] || 0) + op.quantity;
      });

      // Calculate metrics
      const totalStock = products?.reduce((sum, p) => sum + (p.stock_quantity || 0), 0) || 0;
      const reservedStock = Object.values(reservedByProduct).reduce((sum, qty) => sum + qty, 0);
      const availableStock = totalStock - reservedStock;

      // Calculate stock alerts
      const lowStock = [];
      const outOfStock = [];

      products?.forEach(product => {
        const reserved = reservedByProduct[product.id] || 0;
        const available = (product.stock_quantity || 0) - reserved;

        if (available <= 0) {
          outOfStock.push({ ...product, available, reserved });
        } else if (available < 10) {
          lowStock.push({ ...product, available, reserved });
        }
      });

      // Fetch orders by status
      const { data: orders } = await supabase
        .from('orders')
        .select('id, status, total_amount, created_at, customers(name)');

      const ordersReservado = orders?.filter(o => o.status === 'Reservado').length || 0;
      const ordersEntregue = orders?.filter(o => o.status === 'Entregue').length || 0;
      const ordersFaturado = orders?.filter(o => o.status === 'Faturado').length || 0;

      // Fetch recent orders (last 5)
      const { data: recentOrdersData } = await supabase
        .from('orders')
        .select('id, status, total_amount, created_at, customers(name)')
        .order('created_at', { ascending: false })
        .limit(5);

      // Fetch clients count
      const { count: clientsCount } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true });

      // Fetch recent documents
      const { data: documentsData } = await supabase
        .from('documents')
        .select('id, title, file_type, created_at, expiry_date')
        .order('created_at', { ascending: false })
        .limit(5);

      setMetrics({
        totalProducts: products?.length || 0,
        totalStock,
        reservedStock,
        availableStock,
        ordersReservado,
        ordersEntregue,
        ordersFaturado,
        totalClients: clientsCount || 0,
        lowStockCount: lowStock.length,
        outOfStockCount: outOfStock.length
      });

      setRecentOrders(recentOrdersData || []);
      setStockAlerts([...outOfStock, ...lowStock].slice(0, 5));
      setRecentDocuments(documentsData || []);

      // Prepare charts data
      setChartsData({
        ordersByStatus: [
          { name: 'Reservados', value: ordersReservado, color: 'var(--info)' },
          { name: 'Entregues', value: ordersEntregue, color: 'var(--success)' },
          { name: 'Faturados', value: ordersFaturado, color: 'var(--warning)' }
        ],
        topProducts: products
          ?.sort((a, b) => (b.stock_quantity || 0) - (a.stock_quantity || 0))
          .slice(0, 10)
          .map(p => ({
            name: p.name.length > 20 ? p.name.substring(0, 20) + '...' : p.name,
            quantity: p.stock_quantity || 0
          })) || []
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Reservado': return 'var(--info)';
      case 'Entregue': return 'var(--success)';
      case 'Faturado': return 'var(--warning)';
      default: return 'var(--text-secondary)';
    }
  };

  const isExpiringSoon = (expiryDate) => {
    if (!expiryDate) return false;
    const daysUntilExpiry = Math.ceil((new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 5 && daysUntilExpiry >= 0;
  };

  if (isLoading) {
    return (
      <div className="dashboard-container">
        <header className="page-header">
          <h1>Dashboard</h1>
          <p>Carregando informações...</p>
        </header>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <header className="page-header">
        <div className="header-info">
          <h1>Dashboard</h1>
          <p>Visão geral do sistema RCE Papelaria</p>
        </div>
        <button
          className="btn secondary"
          onClick={() => setShowChartsModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <BarChart3 size={18} />
          Ver Gráficos
        </button>
      </header>

      {/* Metrics Cards */}
      <div className="stats-grid">
        <MetricCard
          title="Total de Produtos"
          value={metrics.totalProducts}
          icon={<Package size={24} />}
          color="var(--primary)"
        />
        <MetricCard
          title="Estoque Total"
          value={metrics.totalStock}
          subtitle="unidades"
          icon={<Package size={24} />}
          color="var(--accent)"
        />
        <MetricCard
          title="Itens Reservados"
          value={metrics.reservedStock}
          subtitle="unidades"
          icon={<Clock size={24} />}
          color="var(--warning)"
        />
        <MetricCard
          title="Estoque Disponível"
          value={metrics.availableStock}
          subtitle="unidades"
          icon={<CheckCircle size={24} />}
          color="var(--success)"
        />
      </div>

      {/* Orders Status */}
      <div className="stats-grid" style={{ marginTop: '1rem' }}>
        <MetricCard
          title="Pedidos Reservados"
          value={metrics.ordersReservado}
          icon={<ShoppingCart size={24} />}
          color="var(--info)"
          link="/orders/history"
        />
        <MetricCard
          title="Pedidos Entregues"
          value={metrics.ordersEntregue}
          icon={<CheckCircle size={24} />}
          color="var(--success)"
          link="/orders/history"
        />
        <MetricCard
          title="Pedidos Faturados"
          value={metrics.ordersFaturado}
          icon={<CreditCard size={24} />}
          color="var(--warning)"
          link="/orders/history"
        />
        <MetricCard
          title="Total de Clientes"
          value={metrics.totalClients}
          icon={<Users size={24} />}
          color="var(--primary)"
          link="/clients"
        />
      </div>

      {/* Quick Actions */}
      <div className="glass" style={{ padding: '1.5rem', marginTop: '2rem' }}>
        <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plus size={20} />
          Ações Rápidas
        </h3>
        <div className="quick-actions-grid">
          <Link href="/orders/new">
            <button className="btn primary">
              <ShoppingCart size={18} />
              Novo Pedido
            </button>
          </Link>
          <Link href="/inventory">
            <button className="btn secondary">
              <Package size={18} />
              Gerenciar Estoque
            </button>
          </Link>
          <Link href="/clients">
            <button className="btn secondary">
              <Users size={18} />
              Clientes
            </button>
          </Link>
          <Link href="/documents">
            <button className="btn secondary">
              <FileText size={18} />
              Documentos
            </button>
          </Link>
          <Link href="/proposals">
            <button className="btn secondary">
              <FileText size={18} />
              Nova Proposta
            </button>
          </Link>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Stock Alerts */}
        <div className="glass">
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={20} />
            Alertas de Estoque
            {(metrics.lowStockCount + metrics.outOfStockCount) > 0 && (
              <span className="badge" style={{ backgroundColor: 'var(--danger)', color: 'white', marginLeft: 'auto' }}>
                {metrics.lowStockCount + metrics.outOfStockCount}
              </span>
            )}
          </h3>
          {stockAlerts.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
              ✅ Nenhum alerta de estoque
            </p>
          ) : (
            <div className="alerts-list">
              {stockAlerts.map(product => (
                <div key={product.id} className="alert-item">
                  <div>
                    <strong>{product.name}</strong>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      SKU: {product.sku || 'S/ SKU'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      color: product.available <= 0 ? 'var(--danger)' : 'var(--warning)',
                      fontWeight: 'bold'
                    }}>
                      {product.available <= 0 ? '❌ Sem estoque' : `⚠️ ${product.available} disponível`}
                    </div>
                    {product.reserved > 0 && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {product.reserved} reservado(s)
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Orders */}
        <div className="glass">
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShoppingCart size={20} />
            Pedidos Recentes
          </h3>
          {recentOrders.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
              Nenhum pedido encontrado
            </p>
          ) : (
            <div className="recent-list">
              {recentOrders.map(order => (
                <div key={order.id} className="recent-item">
                  <div>
                    <strong>{order.customers?.name || 'Cliente não identificado'}</strong>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {new Date(order.created_at).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 'bold' }}>
                      R$ {parseFloat(order.total_amount || 0).toFixed(2)}
                    </div>
                    <span
                      className="status-badge"
                      style={{
                        backgroundColor: getStatusColor(order.status) + '20',
                        color: getStatusColor(order.status),
                        fontSize: '0.75rem',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px'
                      }}
                    >
                      {order.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Link href="/orders/history">
            <button className="btn secondary sm" style={{ width: '100%', marginTop: '1rem' }}>
              Ver Todos os Pedidos <ArrowRight size={16} />
            </button>
          </Link>
        </div>

        {/* Recent Documents */}
        <div className="glass">
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={20} />
            Documentos Recentes
          </h3>
          {recentDocuments.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
              Nenhum documento encontrado
            </p>
          ) : (
            <div className="recent-list">
              {recentDocuments.map(doc => (
                <div key={doc.id} className="recent-item">
                  <div>
                    <strong>{doc.title}</strong>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {doc.file_type?.includes('pdf') || doc.file_type?.includes('image') ? '📄 Arquivo' : '📝 Documento'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {isExpiringSoon(doc.expiry_date) && (
                      <div style={{ color: 'var(--danger)', fontSize: '0.85rem', fontWeight: 'bold' }}>
                        ⚠️ Expira em breve
                      </div>
                    )}
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Link href="/documents">
            <button className="btn secondary sm" style={{ width: '100%', marginTop: '1rem' }}>
              Ver Todos os Documentos <ArrowRight size={16} />
            </button>
          </Link>
        </div>
      </div>

      {/* Charts Modal */}
      {showChartsModal && (
        <div className="modal-overlay" onClick={() => setShowChartsModal(false)}>
          <div className="modal-content charts-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📊 Gráficos e Análises</h2>
              <button
                className="close-btn"
                onClick={() => setShowChartsModal(false)}
                aria-label="Fechar"
              >
                <X size={24} />
              </button>
            </div>

            <div className="charts-grid">
              {/* Orders by Status - Pie Chart */}
              <div className="chart-card glass">
                <h3>Pedidos por Status</h3>
                <div className="chart-wrapper">
                  {chartsData.ordersByStatus.some(d => d.value > 0) ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={chartsData.ordersByStatus}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {chartsData.ordersByStatus.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                      Nenhum pedido encontrado
                    </div>
                  )}
                </div>
              </div>

              {/* Top Products - Bar Chart */}
              <div className="chart-card glass">
                <h3>Top 10 Produtos em Estoque</h3>
                <div className="chart-wrapper">
                  {chartsData.topProducts.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={chartsData.topProducts}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--gray-200)" />
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: 'var(--gray-600)', fontSize: 11 }}
                          angle={-45}
                          textAnchor="end"
                          height={100}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: 'var(--gray-600)', fontSize: 12 }}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: 'var(--radius)',
                            border: 'none',
                            boxShadow: 'var(--shadow)',
                            backgroundColor: 'var(--white)'
                          }}
                        />
                        <Bar dataKey="quantity" fill="var(--primary)" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                      Nenhum produto encontrado
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ title, value, subtitle, icon, color, link }) {
  const content = (
    <div className="stat-card glass anim-fade-in" style={{ cursor: link ? 'pointer' : 'default' }}>
      <div className="stat-header">
        <div className="stat-icon" style={{ backgroundColor: color + '20', color: color }}>
          {icon}
        </div>
      </div>
      <div className="stat-body">
        <span className="stat-title">{title}</span>
        <span className="stat-value">
          {value}
          {subtitle && <span style={{ fontSize: '0.6em', marginLeft: '0.5rem', opacity: 0.7 }}>{subtitle}</span>}
        </span>
      </div>
    </div>
  );

  return link ? <Link href={link}>{content}</Link> : content;
}
