"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Package,
  Filter,
  ArrowUpDown,
  AlertTriangle,
  History,
  MoreVertical,
  Download,
  Tag,
  Info
} from 'lucide-react';

import { supabase } from '@/lib/supabase';

export default function InventoryPage() {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({
    name: '',
    sku: '',
    description: '',
    brand: '',
    unit: 'UN',
    base_price: '',
    stock_quantity: 0
  });

  const [activeTab, setActiveTab] = useState('Geral');
  const [reservedInfo, setReservedInfo] = useState([]);
  const [modalTab, setModalTab] = useState('info');
  const [productReservations, setProductReservations] = useState([]);

  const fetchInventory = async () => {
    setIsLoading(true);
    // 1. Fetch products
    const { data: prods, error: pError } = await supabase.from('products').select('*', 'order=name.asc');

    // 2. Fetch reserved quantities (Orders status = 'Reservado')
    const { data: resData, error: rError } = await supabase
      .from('order_products')
      .select('product_id, quantity, orders!inner(id, status, customers(name))')
      .eq('orders.status', 'Reservado');

    if (!pError && prods) {
      // Calculate reserved totals per product
      const resTotals = (resData || []).reduce((acc, curr) => {
        acc[curr.product_id] = (acc[curr.product_id] || 0) + curr.quantity;
        return acc;
      }, {});

      setProducts(prods.map(p => ({
        ...p,
        reserved_quantity: resTotals[p.id] || 0,
        available_quantity: (p.stock_quantity || 0) - (resTotals[p.id] || 0)
      })));

      setReservedInfo(resData || []);
    }
    setIsLoading(false);
  };

  React.useEffect(() => {
    fetchInventory();
  }, []);

  const handleOpenModal = async (product = null) => {
    if (product) {
      setEditingProduct(product);
      setProductForm({
        name: product.name || '',
        sku: product.sku || '',
        description: product.description || '',
        brand: product.brand || '',
        unit: product.unit || 'UNID.',
        base_price: product.base_price || '',
        stock_quantity: product.stock_quantity || 0
      });

      // Fetch reservations for this product
      const { data: resData } = await supabase
        .from('order_products')
        .select('quantity, orders(id, created_at, status, customers(name))')
        .eq('product_id', product.id);

      // Filter for only 'Reservado' orders
      const reservedOnly = (resData || []).filter(item => item.orders?.status === 'Reservado');
      setProductReservations(reservedOnly);
    } else {
      setEditingProduct(null);
      setProductForm({
        name: '',
        sku: '',
        description: '',
        brand: '',
        unit: 'UNID.',
        base_price: '',
        stock_quantity: 0
      });
      setProductReservations([]);
    }
    setModalTab('info');
    setIsModalOpen(true);
  };

  const handleSaveProduct = async () => {
    if (!productForm.name) {
      alert("O nome do produto é obrigatório.");
      return;
    }

    setIsLoading(true);
    const payload = {
      ...productForm,
      base_price: parseFloat(productForm.base_price) || 0,
      stock_quantity: parseInt(productForm.stock_quantity) || 0,
      updated_at: new Date().toISOString()
    };

    let error;
    if (editingProduct) {
      const { error: updateError } = await supabase.from('products').update(payload).eq('id', editingProduct.id);
      error = updateError;
    } else {
      // Generate product_id for new products
      const { data: maxProduct } = await supabase
        .from('products')
        .select('product_id')
        .order('product_id', { ascending: false })
        .limit(1);

      let nextId = 1;
      if (maxProduct && maxProduct.length > 0 && maxProduct[0].product_id) {
        const lastNum = parseInt(maxProduct[0].product_id.replace('PROD-', ''));
        nextId = lastNum + 1;
      }

      const productId = 'PROD-' + String(nextId).padStart(6, '0');

      const { error: insertError } = await supabase.from('products').insert({
        ...payload,
        product_id: productId,
        created_at: new Date().toISOString()
      });
      error = insertError;
    }

    if (!error) {
      await fetchInventory();
      setIsModalOpen(false);
    } else {
      console.error("Error saving product:", error);
      alert("Erro ao salvar produto.");
    }
    setIsLoading(false);
  };

  const filteredProducts = products.filter(p =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="inventory-container">
      <header className="page-header">
        <div className="header-info">
          <h1>Gestão de Estoque</h1>
          <p>Controle de insumos, níveis críticos e reposição</p>
        </div>
        <div className="header-actions">
          <button className="btn secondary glass">
            <Download size={18} />
            <span>Exportar</span>
          </button>
          <button className="btn primary" onClick={() => handleOpenModal()}>
            <Plus size={18} />
            <span>Novo Produto</span>
          </button>
        </div>
      </header>

      <div className="inventory-overview stats-grid">
        <OverviewCard title="Total de Itens" value={products.length} color="var(--primary)" icon={<Package size={20} />} />
        <OverviewCard
          title="Valor em Estoque"
          value={`R$ ${products.reduce((acc, p) => acc + (p.base_price * p.stock_quantity), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          color="var(--accent)"
          icon={<Tag size={20} />}
        />
        <OverviewCard title="Abaixo do Mínimo" value={products.filter(p => p.stock_quantity < 10 && p.stock_quantity > 0).length} color="var(--warning)" icon={<AlertTriangle size={20} />} />
        <OverviewCard title="Em Falta" value={products.filter(p => p.stock_quantity <= 0).length} color="var(--danger)" icon={<AlertTriangle size={20} />} />
      </div>

      <div className="tabs-container glass" style={{ display: 'flex', gap: '1rem', padding: '1rem', marginBottom: '1.5rem' }}>
        <button
          className={`tab-btn ${activeTab === 'Geral' ? 'active' : ''}`}
          onClick={() => setActiveTab('Geral')}
          style={activeTab === 'Geral' ? { background: 'var(--primary)', color: 'white', padding: '0.5rem 1rem', borderRadius: '8px' } : { padding: '0.5rem 1rem' }}
        >
          Estoque Geral
        </button>
        <button
          className={`tab-btn ${activeTab === 'Reservado' ? 'active' : ''}`}
          onClick={() => setActiveTab('Reservado')}
          style={activeTab === 'Reservado' ? { background: 'var(--accent)', color: 'white', padding: '0.5rem 1rem', borderRadius: '8px' } : { padding: '0.5rem 1rem' }}
        >
          Itens Reservados
        </button>
      </div>

      <div className="filters-bar glass">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Buscar por nome, SKU ou marca..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-options">
          <button className="filter-btn"><Filter size={16} /> Categoria</button>
          <button className="filter-btn"><ArrowUpDown size={16} /> Estoque</button>
        </div>
      </div>

      {isLoading ? (
        <div className="loading-state">Carregando inventário...</div>
      ) : activeTab === 'Geral' ? (
        <div className="inventory-table glass">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Produto</th>
                <th>Marca</th>
                <th>Unid.</th>
                <th>Estoque</th>
                <th>Reservado</th>
                <th>Disponível</th>
                <th>Status</th>
                <th>Valor Base</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(product => (
                <tr
                  key={product.id}
                  className="clickable-row"
                  onClick={() => handleOpenModal(product)}
                >
                  <td>
                    <code style={{ fontSize: '0.75rem', background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: '4px' }}>
                      {product.product_id || 'N/A'}
                    </code>
                  </td>
                  <td>
                    <div className="product-cell">
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                        <span className="p-code" style={{ fontSize: '0.7rem' }}>{product.sku || 'S/ SKU'}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span className="p-name" style={{ fontWeight: 'bold' }}>{product.name}</span>
                          {product.description && (
                            <div className="tooltip-container" onClick={(e) => e.stopPropagation()}>
                              <Info size={14} />
                              <span className="tooltip-text">{product.description}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td><span className="category-tag">{product.brand || 'Genérica'}</span></td>
                  <td style={{ fontWeight: '600', color: 'var(--primary)' }}>{product.unit}</td>
                  <td style={{ fontWeight: 'bold' }}>{product.stock_quantity}</td>
                  <td style={{ color: 'var(--warning)', fontWeight: 'bold' }}>{product.reserved_quantity}</td>
                  <td style={{ color: 'var(--success)', fontWeight: 'bold' }}>{product.available_quantity}</td>
                  <td>
                    <span className={`status-badge ${product.available_quantity > 0 ? 'disponivel' : 'em-falta'}`}>
                      {product.available_quantity > 0 ? 'Disponível' : 'Em Falta'}
                    </span>
                  </td>
                  <td>R$ {parseFloat(product.base_price || 0).toFixed(2)}</td>
                  <td>
                    <div className="table-actions" onClick={(e) => e.stopPropagation()}>
                      <button className="action-btn" onClick={() => handleOpenModal(product)} title="Editar"><Package size={16} /></button>
                      <button className="action-btn"><MoreVertical size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="inventory-table glass">
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th>Cliente</th>
                <th>Pedido</th>
                <th>Quantidade</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {reservedInfo.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>Nenhum item reservado no momento.</td></tr>
              ) : reservedInfo.map((res, idx) => (
                <tr key={idx}>
                  <td><strong>{products.find(p => p.id === res.product_id)?.name}</strong></td>
                  <td>{res.orders?.customers?.name}</td>
                  <td><span style={{ fontSize: '0.75rem' }}>#{res.orders?.id.split('-')[0]}</span></td>
                  <td>{res.quantity}</td>
                  <td>
                    <Link href="/orders/history">
                      <button className="btn secondary sm">Ver Pedido</button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass" style={{ maxWidth: '600px', width: '90%' }}>
            <div className="modal-header">
              <h2>{editingProduct ? 'Editar Produto' : 'Novo Produto'}</h2>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>&times;</button>
            </div>

            {editingProduct && (
              <div className="tabs-container" style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <button
                  className={`tab-btn ${modalTab === 'info' ? 'active' : ''}`}
                  onClick={() => setModalTab('info')}
                  style={modalTab === 'info' ? { background: 'var(--primary)', color: 'white', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.9rem' } : { padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                >
                  Informações
                </button>
                <button
                  className={`tab-btn ${modalTab === 'reservas' ? 'active' : ''}`}
                  onClick={() => setModalTab('reservas')}
                  style={modalTab === 'reservas' ? { background: 'var(--accent)', color: 'white', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.9rem' } : { padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                >
                  Reservas ({productReservations.length})
                </button>
              </div>
            )}

            <div className="modal-body">
              {modalTab === 'info' ? (
                <div className="form-grid">
                  <div className="input-group full">
                    <label>Nome do Produto</label>
                    <input
                      type="text"
                      placeholder="Ex: Papel A4 Special"
                      value={productForm.name}
                      onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    />
                  </div>
                  <div className="input-group">
                    <label>SKU / Código</label>
                    <input
                      type="text"
                      placeholder="Ex: PAP-001"
                      value={productForm.sku}
                      onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                    />
                  </div>
                  <div className="input-group">
                    <label>Marca</label>
                    <input
                      type="text"
                      placeholder="Ex: BIC, Chamex"
                      value={productForm.brand}
                      onChange={(e) => setProductForm({ ...productForm, brand: e.target.value })}
                    />
                  </div>
                  <div className="input-group full">
                    <label>Especificação Técnica / Descrição Detalhada</label>
                    <textarea
                      placeholder="Descreva as especificações do produto..."
                      style={{ minHeight: '100px', resize: 'vertical' }}
                      value={productForm.description}
                      onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                    />
                  </div>
                  <div className="input-group">
                    <label>Unidade</label>
                    <select
                      value={productForm.unit}
                      onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                      style={{
                        padding: '0.75rem',
                        borderRadius: '8px',
                        border: '1px solid var(--gray-300)',
                        backgroundColor: 'var(--white)',
                        fontSize: '0.95rem',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="UN">UN - Unidade</option>
                      <option value="CX">CX - Caixa</option>
                      <option value="MT">MT - Metro</option>
                      <option value="RL">RL - Rolo</option>
                      <option value="PCT">PCT - Pacote</option>
                      <option value="KG">KG - Quilograma</option>
                      <option value="L">L - Litro</option>
                      <option value="M²">M² - Metro Quadrado</option>
                      <option value="M³">M³ - Metro Cúbico</option>
                      <option value="DZ">DZ - Dúzia</option>
                    </select>
                  </div>
                  <div className="input-group">
                    <label>Preço Base</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={productForm.base_price}
                      onChange={(e) => setProductForm({ ...productForm, base_price: e.target.value })}
                    />
                  </div>
                  <div className="input-group">
                    <label>Quantidade em Estoque</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={productForm.stock_quantity}
                      onChange={(e) => setProductForm({ ...productForm, stock_quantity: e.target.value })}
                    />
                  </div>
                </div>
              ) : (
                <div style={{ padding: '1rem 0' }}>
                  {productReservations.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(255,255,255,0.6)' }}>
                      <p>Nenhuma reserva ativa para este produto.</p>
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                          <th style={{ padding: '0.75rem', textAlign: 'left' }}>Cliente</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left' }}>Pedido</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center' }}>Quantidade</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left' }}>Data</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productReservations.map((res, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '0.75rem' }}>{res.orders?.customers?.name || 'N/A'}</td>
                            <td style={{ padding: '0.75rem' }}>
                              <code style={{ fontSize: '0.75rem', background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: '4px' }}>
                                #{res.orders?.id?.split('-')[0] || 'N/A'}
                              </code>
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 'bold', color: 'var(--warning)' }}>
                              {res.quantity}
                            </td>
                            <td style={{ padding: '0.75rem', fontSize: '0.85rem' }}>
                              {res.orders?.created_at ? new Date(res.orders.created_at).toLocaleDateString('pt-BR') : 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
              <button className="btn primary" onClick={handleSaveProduct}>
                {editingProduct ? 'Salvar Alterações' : 'Criar Produto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OverviewCard({ title, value, color, icon }) {
  return (
    <div className="ov-card glass">
      <div className="ov-icon" style={{ backgroundColor: color + '15', color: color }}>
        {icon}
      </div>
      <div className="ov-info">
        <span className="ov-title">{title}</span>
        <span className="ov-value">{value}</span>
      </div>
    </div>
  );
}
