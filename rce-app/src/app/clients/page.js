"use client";
import React, { useState } from 'react';
import {
  Plus,
  Search,
  FileUp,
  Users,
  FileText,
  ChevronRight,
  Eye,
  CheckCircle,
  MoreVertical,
  Download,
  History,
  ShoppingCart,
  Clock
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { useRouter } from 'next/navigation';

import { supabase } from '@/lib/supabase';
import { extractAtaData } from '@/lib/gemini';

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [clientProducts, setClientProducts] = useState([]);
  const [clientOrders, setClientOrders] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('info'); // 'info', 'products', 'history'
  const [formData, setFormData] = useState({
    responsible_person: '',
    phone: '',
    email: '',
    address: ''
  });
  const [quantities, setQuantities] = useState({});
  const [showManualAddModal, setShowManualAddModal] = useState(false);
  const [masterProducts, setMasterProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [pendingAssociations, setPendingAssociations] = useState([]);
  const [newClientName, setNewClientName] = useState('');
  const [newClientContract, setNewClientContract] = useState('');
  const [associationForm, setAssociationForm] = useState({
    product: null,
    brand: '',
    price: '',
    custom_name: '',
    custom_description: ''
  });

  const handleAtaUpload = async (file) => {
    if (!file) return;
    setIsUploading(true);
    setExtractedData(null);

    try {
      const data = await extractAtaData(file);

      // Auto-match products with master catalog
      const { data: allMasterProducts } = await supabase.from('products').select('*');

      const matchedProducts = data.products.map(p => {
        const bestMatch = findBestMatch(p.selection_name, allMasterProducts);
        return {
          ...p,
          master_product: bestMatch,
          price: parseFloat(p.price?.toString().replace('R$', '').replace(',', '.')) || 0,
          quantity: parseInt(p.quantity) || 1
        };
      });

      setExtractedData({
        ...data,
        products: matchedProducts
      });
      setNewClientName(data.client_name || '');
      setNewClientContract(data.contract_number || '');
    } catch (error) {
      console.error("Upload error:", error);
      alert("Erro ao processar o documento. Verifique se o arquivo é um PDF ou Imagem e tente novamente.");
    } finally {
      setIsUploading(false);
    }
  };

  const findBestMatch = (contractName, masterCatalog) => {
    if (!masterCatalog || masterCatalog.length === 0) return null;

    const searchStr = contractName.toLowerCase();

    // Sort by relevance (simple includes/startsWith)
    const matches = masterCatalog.filter(p =>
      searchStr.includes(p.name.toLowerCase()) ||
      p.name.toLowerCase().includes(searchStr)
    );

    return matches.length > 0 ? matches[0] : null;
  };

  const handleLinkProduct = (index, masterProduct) => {
    const updated = [...extractedData.products];
    updated[index].master_product = masterProduct;
    setExtractedData({ ...extractedData, products: updated });
  };

  const fetchClients = async () => {
    setIsLoading(true);
    // Fetch clients and their product count from customer_products
    const { data: clientsData, error: clientsError } = await supabase.from('customers').select('*');

    if (clientsError) {
      console.error("Error fetching clients:", clientsError);
      setIsLoading(false);
      return;
    }

    // Fetch all product counts at once to be more efficient
    const { data: countsData, error: countsError } = await supabase.from('customer_products').select('customer_id');

    const countMap = {};
    if (!countsError && countsData) {
      countsData.forEach(item => {
        countMap[item.customer_id] = (countMap[item.customer_id] || 0) + 1;
      });
    }

    const enhancedClients = clientsData.map(client => ({
      ...client,
      productCount: countMap[client.id] || 0
    }));

    setClients(enhancedClients);
    setIsLoading(false);
  };

  const [masterSearchResults, setMasterSearchResults] = useState([]);
  const [activeLinkingIndex, setActiveLinkingIndex] = useState(null);

  const searchMasterProducts = async (term) => {
    if (!term) return;
    const { data } = await supabase.from('products').select('*', `name=ilike.*${term}*`).limit(8);
    setMasterSearchResults(data || []);
  };

  React.useEffect(() => {
    fetchClients();
  }, []);

  const handleViewClient = async (client) => {
    setSelectedClient(client);
    setShowDetailModal(true);
    setActiveTab('info');
    setFormData({
      responsible_person: client.responsible_person || '',
      phone: client.phone || '',
      email: client.email || '',
      address: client.address || ''
    });

    // Fetch products for this specific client
    const { data: prods, error } = await supabase.from('customer_products').select('*, products(name, sku, unit, description)', `customer_id=eq.${client.id}`);
    if (!error) {
      setClientProducts(prods);
    }
  };

  const handleSaveClient = async (updatedData) => {
    setIsSaving(true);
    const { error } = await supabase.from('customers').update(updatedData).eq('id', selectedClient.id);
    if (!error) {
      setClients(clients.map(c => c.id === selectedClient.id ? { ...c, ...updatedData } : c));
      setSelectedClient({ ...selectedClient, ...updatedData });
      alert("Informações salvas com sucesso!");
    } else {
      console.error("Error saving client:", error);
    }
    setIsSaving(false);
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProducts, setSelectedProducts] = useState(new Set());

  const filteredProducts = clientProducts.filter(cp => {
    const searchLower = searchTerm.toLowerCase();
    return (
      cp.products?.name?.toLowerCase().includes(searchLower) ||
      cp.products?.sku?.toLowerCase().includes(searchLower) ||
      cp.custom_brand?.toLowerCase().includes(searchLower)
    );
  });

  const toggleProductSelection = (id) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedProducts(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedProducts.size === filteredProducts.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(filteredProducts.map(p => p.id)));
    }
  };

  const handleCreateOrder = () => {
    if (!selectedClient) return;
    router.push(`/orders/new?clientId=${selectedClient.id}`);
  };

  const fetchClientOrders = async (clientId) => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*, customers(*)', `customer_id=eq.${clientId}&order=created_at.desc`);

    if (!error) {
      setClientOrders(data || []);
    }
    setIsLoading(false);
  };

  const fetchMasterProducts = async (term = '') => {
    const filter = term ? `name=ilike.*${term}*&limit=10` : 'limit=10';
    const { data, error } = await supabase.from('products').select('id, name, sku, description', filter);
    if (!error) setMasterProducts(data || []);
  };

  const handleAddAssociation = () => {
    if (!associationForm.product || !associationForm.price) return;

    const newAssoc = {
      product_id: associationForm.product.id,
      product_name: associationForm.custom_name || associationForm.product.name,
      product_description: associationForm.custom_description || associationForm.product.description || '',
      brand: associationForm.brand,
      price: parseFloat(associationForm.price) || 0,
      temp_id: Date.now()
    };

    setPendingAssociations([...pendingAssociations, newAssoc]);
    setAssociationForm({ product: null, brand: '', price: '', custom_name: '', custom_description: '' });
    setProductSearch('');
  };

  const updatePendingAssociation = (tempId, field, value) => {
    setPendingAssociations(pendingAssociations.map(a =>
      a.temp_id === tempId ? { ...a, [field]: field === 'price' ? parseFloat(value) || 0 : value } : a
    ));
  };

  const handleRemoveAssociation = (tempId) => {
    setPendingAssociations(pendingAssociations.filter(a => a.temp_id !== tempId));
  };

  const handleCreateManualClient = async () => {
    if (!newClientName || !newClientContract) {
      alert("Por favor, preencha o nome do cliente e o número do contrato.");
      return;
    }

    setIsSaving(true);
    try {
      // 1. Create client
      const { data: client, error: clientErr } = await supabase.from('customers').insert({
        name: newClientName,
        contract_number: newClientContract,
        status: 'Ativo'
      });

      if (clientErr) throw clientErr;
      const newClientId = client[0].id;

      // 2. Create products and associations
      if (pendingAssociations.length > 0) {
        const associations = pendingAssociations.map(a => ({
          customer_id: newClientId,
          product_id: a.product_id,
          custom_price: a.price,
          custom_name: a.product_name,
          custom_description: a.product_description,
          custom_brand: a.brand
        }));

        const { error: assocErr } = await supabase.from('customer_products').insert(associations);
        if (assocErr) throw assocErr;
      }

      alert("Cliente e produtos criados com sucesso!");
      setShowManualAddModal(false);
      setNewClientName('');
      setNewClientContract('');
      setPendingAssociations([]);
      fetchClients();
    } catch (error) {
      console.error("Save error:", error);
      alert("Erro ao salvar os dados.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveExtracted = async () => {
    if (!newClientName || !newClientContract) {
      alert("Por favor, preencha o nome do cliente e o número do contrato.");
      return;
    }

    const unlinkedCount = extractedData.products.filter(p => !p.master_product).length;
    if (unlinkedCount > 0) {
      if (!confirm(`Existem ${unlinkedCount} itens não vinculados ao estoque master. Deseja continuar mesmo assim?`)) {
        return;
      }
    }

    setIsSaving(true);
    try {
      // 1. Create client
      const { data: client, error: clientErr } = await supabase.from('customers').insert({
        name: newClientName,
        contract_number: newClientContract,
        document: extractedData.document,
        status: 'Ativo'
      });

      if (clientErr) throw clientErr;
      const newClientId = client[0].id;

      // 2. Create products and associations
      const associations = extractedData.products
        .filter(p => p.master_product)
        .map(p => ({
          customer_id: newClientId,
          product_id: p.master_product.id,
          custom_price: p.price,
          custom_name: p.selection_name,
          custom_description: p.selection_description || '',
          custom_brand: p.brand || ''
        }));

      if (associations.length > 0) {
        const { error: assocErr } = await supabase.from('customer_products').insert(associations);
        if (assocErr) throw assocErr;
      }

      alert("Cliente e produtos criados e vinculados com sucesso!");
      setShowModal(false);
      setExtractedData(null);
      fetchClients();
    } catch (error) {
      console.error("Save error:", error);
      alert("Erro ao salvar os dados.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="clients-container">
      <header className="page-header">
        <div className="header-info">
          <h1>Gestão de Clientes</h1>
          <p>Organize seus contratos e base de clientes com IA</p>
        </div>
        <div className="header-actions">
          <button className="btn secondary glass" onClick={() => setShowModal(true)}>
            <FileUp size={18} />
            <span>Ler Contrato (IA)</span>
          </button>
          <button className="btn primary" onClick={() => setShowManualAddModal(true)}>
            <Plus size={18} />
            <span>Novo Cliente</span>
          </button>
        </div>
      </header>

      <div className="filters-bar glass">
        <div className="search-box">
          <Search size={18} />
          <input type="text" placeholder="Buscar por nome, documento ou e-mail..." />
        </div>
        <div className="filter-options">
          <select>
            <option>Todos os Status</option>
            <option>Ativos</option>
            <option>Inativos</option>
          </select>
        </div>
      </div>

      <div className="clients-table glass">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Contrato (PE)</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan="5" className="loading-td">Carregando clientes...</td></tr>
            ) : clients.length === 0 ? (
              <tr><td colSpan="5" className="loading-td">Nenhum cliente encontrado.</td></tr>
            ) : (
              clients.map(client => (
                <tr key={client.id} onClick={() => handleViewClient(client)} className="clickable-row">
                  <td className="client-info-cell">
                    <div className="client-name">{client.name}</div>
                    <div className="client-meta">
                      <span>PE {client.contract_number}</span>
                      <span className="dot" />
                      <span className={client.productCount > 0 ? 'text-success' : 'text-warning'}>
                        {client.productCount} produtos vinculados
                      </span>
                    </div>
                  </td>
                  <td><span className="pe-badge">PE {client.contract_number}</span></td>
                  <td>
                    <span className={`status-badge ${(client.status || 'Ativo').toLowerCase()}`}>
                      {client.status || 'Ativo'}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="action-btn"><Eye size={16} /></button>
                      <button className="action-btn"><FileText size={16} /></button>
                      <button className="action-btn"><MoreVertical size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showDetailModal && selectedClient && (
        <div className="modal-overlay">
          <div className="modal-content glass detail-modal anim-scale-up">
            <header className="modal-header">
              <div className="header-overview">
                <div className="header-title">
                  <h2>{selectedClient.name}</h2>
                  <span className="pe-badge">PE {selectedClient.contract_number}</span>
                </div>
                <div className="header-subtitle">
                  <span className="id-badge">{selectedClient.productCount} produtos vinculados</span>
                </div>
              </div>
              <button className="close-btn" onClick={() => setShowDetailModal(false)}><X size={20} /></button>
            </header>

            <div className="modal-tabs">
              <button
                className={`tab-btn ${activeTab === 'info' ? 'active' : ''}`}
                onClick={() => setActiveTab('info')}
              >
                Informações
              </button>
              <button
                className={`tab-btn ${activeTab === 'products' ? 'active' : ''}`}
                onClick={() => setActiveTab('products')}
              >
                Produtos Vinculados
              </button>
              <button
                className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('history');
                  fetchClientOrders(selectedClient.id);
                }}
              >
                Histórico de Pedidos
              </button>
            </div>

            <div className="modal-body detail-body">
              {activeTab === 'info' ? (
                <div className="tab-content">
                  <div className="info-grid">
                    <div className="input-group">
                      <label>Responsável</label>
                      <input
                        type="text"
                        value={formData.responsible_person}
                        onChange={(e) => setFormData({ ...formData, responsible_person: e.target.value })}
                        placeholder="Nome do contato..."
                      />
                    </div>
                    <div className="input-group">
                      <label>Telefone</label>
                      <input
                        type="text"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                    <div className="input-group full">
                      <label>E-mail</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="email@cliente.com"
                      />
                    </div>
                    <div className="input-group full">
                      <label>Endereço</label>
                      <textarea
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        placeholder="Rua, número, bairro, cidade..."
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      className="btn primary"
                      onClick={() => handleSaveClient(formData)}
                      disabled={isSaving}
                    >
                      {isSaving ? 'Salvando...' : 'Salvar Informações'}
                    </button>
                  </div>
                </div>
              ) : activeTab === 'products' ? (
                <div className="tab-content">
                  <div className="products-header">
                    <div className="search-container">
                      <Search className="search-icon" size={18} />
                      <input
                        type="text"
                        className="search-input"
                        placeholder="Buscar produtos neste catálogo..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <div className="products-actions">
                      <div className="selected-count">
                        {selectedProducts.size} selecionados
                      </div>
                      <button
                        className="btn-order"
                        disabled={selectedProducts.size === 0}
                        onClick={handleCreateOrder}
                      >
                        <ShoppingCart size={18} />
                        <span>Montar Pedido</span>
                      </button>
                    </div>
                  </div>

                  <div className="history-table">
                    <table>
                      <thead>
                        <tr>
                          <th className="checkbox-cell">
                            <input
                              type="checkbox"
                              className="custom-checkbox"
                              checked={selectedProducts.size > 0 && selectedProducts.size === filteredProducts.length}
                              onChange={toggleSelectAll}
                            />
                          </th>
                          <th>Produto</th>
                          <th style={{ textAlign: 'right' }}>Marca</th>
                          <th style={{ textAlign: 'right' }}>Preço</th>
                          <th style={{ textAlign: 'right' }}>Qtd</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProducts.map((cp) => (
                          <tr key={cp.id} className={selectedProducts.has(cp.id) ? 'selected-row' : ''}>
                            <td className="checkbox-cell">
                              <input
                                type="checkbox"
                                className="custom-checkbox"
                                checked={selectedProducts.has(cp.id)}
                                onChange={() => toggleProductSelection(cp.id)}
                              />
                            </td>
                            <td>
                              <div className="p-maininfo">{cp.custom_name || cp.products?.name}</div>
                              <div className="p-spec" style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '6px' }}>
                                {cp.custom_description || cp.products?.description}
                              </div>
                              <div className="p-subinfo" style={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
                                {cp.products?.sku && <span className="p-code">SKU: {cp.products.sku}</span>}
                                {cp.products?.unit && <span className="p-code">Unid: {cp.products.unit}</span>}
                              </div>
                            </td>
                            <td style={{ textAlign: 'right', color: 'var(--primary-light)', fontSize: '0.85rem' }}>
                              {cp.custom_brand || "-"}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <span className="price-val">R$ {Number(cp.custom_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <input
                                type="number"
                                className="qty-input"
                                min="1"
                                value={quantities[cp.id] || 1}
                                onChange={(e) => {
                                  setQuantities({ ...quantities, [cp.id]: parseInt(e.target.value) || 1 });
                                  if (!selectedProducts.has(cp.id)) toggleProductSelection(cp.id);
                                }}
                              />
                            </td>
                          </tr>
                        ))}
                        {filteredProducts.length === 0 && (
                          <tr>
                            <td colSpan="3" className="loading-td">
                              {searchTerm ? "Nenhum produto encontrado na busca." : "Nenhum produto vinculado ainda."}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="tab-content">
                  <div className="history-header">
                    <h3>Pedidos Realizados</h3>
                    <p>Consulte todos os pedidos vinculados a este cliente</p>
                  </div>

                  <div className="history-table">
                    <table>
                      <thead>
                        <tr>
                          <th>ID / Data</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Total</th>
                          <th style={{ textAlign: 'center' }}>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {isLoading ? (
                          <tr><td colSpan="4" className="loading-td">Carregando histórico...</td></tr>
                        ) : clientOrders.length === 0 ? (
                          <tr><td colSpan="4" className="loading-td">Nenhum pedido encontrado.</td></tr>
                        ) : (
                          clientOrders.map(order => (
                            <tr key={order.id}>
                              <td>
                                <div style={{ fontWeight: 'bold' }}>#{order.id.slice(0, 8)}</div>
                                <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                                  {new Date(order.created_at).toLocaleDateString('pt-BR')}
                                </div>
                              </td>
                              <td>
                                <span className={`status-badge ${order.status.toLowerCase()}`}>
                                  {order.status}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                R$ {Number(order.total_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <div className="table-actions" style={{ justifyContent: 'center' }}>
                                  <button
                                    className="action-btn"
                                    onClick={() => router.push(`/orders/history?id=${order.id}`)}
                                    title="Ver Detalhes"
                                  >
                                    <Eye size={16} />
                                  </button>
                                  <button className="action-btn" title="Download PDF"><Download size={16} /></button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <footer className="modal-footer">
              <button className="btn secondary" onClick={() => setShowDetailModal(false)}>Fechar</button>
            </footer>
          </div>
        </div>
      )}

      {showManualAddModal && (
        <div className="modal-overlay">
          <div className="modal-content glass detail-modal anim-scale-up">
            <header className="modal-header">
              <h2>Cadastrar Novo Cliente</h2>
              <button className="close-btn" onClick={() => setShowManualAddModal(false)}><X size={20} /></button>
            </header>

            <div className="modal-body detail-body">
              <div className="tab-content" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Client Basic Info */}
                <div className="info-grid">
                  <div className="input-group">
                    <label>Nome do Cliente / Órgão</label>
                    <input
                      type="text"
                      placeholder="Ex: Araraquara Papelaria"
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                    />
                  </div>
                  <div className="input-group">
                    <label>Número do Contrato (PE)</label>
                    <input
                      type="text"
                      placeholder="Ex: 88/2024"
                      value={newClientContract}
                      onChange={(e) => setNewClientContract(e.target.value)}
                    />
                  </div>
                </div>

                {/* Association Builder */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
                  <h3>Vincular Produtos Iniciais</h3>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 120px 100px auto', gap: '1rem', alignItems: 'end', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px' }}>
                    <div className="input-group" style={{ position: 'relative' }}>
                      <label>Buscar Produto Master</label>
                      <input
                        type="text"
                        placeholder="Pesquisar catálogo central..."
                        value={productSearch}
                        onChange={(e) => {
                          setProductSearch(e.target.value);
                          fetchMasterProducts(e.target.value);
                        }}
                      />
                      {masterProducts.length > 0 && productSearch && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0 0 8px 8px', zIndex: 100, maxHeight: '200px', overflowY: 'auto' }}>
                          {masterProducts.map(p => (
                            <div
                              key={p.id}
                              style={{ padding: '0.75rem', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                              onClick={() => {
                                setAssociationForm({
                                  ...associationForm,
                                  product: p,
                                  custom_name: p.name,
                                  custom_description: p.description || ''
                                });
                                setProductSearch(p.name);
                                setMasterProducts([]);
                              }}
                            >
                              <div style={{ fontSize: '0.9rem' }}>{p.name}</div>
                              <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>SKU: {p.sku}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="input-group">
                      <label>Nome no Contrato</label>
                      <input
                        type="text"
                        placeholder="Nome personalizado..."
                        value={associationForm.custom_name}
                        onChange={(e) => setAssociationForm({ ...associationForm, custom_name: e.target.value })}
                      />
                    </div>
                    <div className="input-group">
                      <label>Especificação</label>
                      <input
                        type="text"
                        placeholder="Espec. técnica..."
                        value={associationForm.custom_description}
                        onChange={(e) => setAssociationForm({ ...associationForm, custom_description: e.target.value })}
                      />
                    </div>
                    <div className="input-group">
                      <label>Marca</label>
                      <input
                        type="text"
                        placeholder="Ex: BIC"
                        value={associationForm.brand}
                        onChange={(e) => setAssociationForm({ ...associationForm, brand: e.target.value })}
                      />
                    </div>
                    <div className="input-group">
                      <label>Preço</label>
                      <input
                        type="number"
                        placeholder="R$ 0,00"
                        value={associationForm.price}
                        onChange={(e) => setAssociationForm({ ...associationForm, price: e.target.value })}
                      />
                    </div>
                    <button className="btn primary" style={{ height: '42px', padding: '0 1rem' }} onClick={handleAddAssociation}>
                      <Plus size={18} />
                    </button>
                  </div>

                  <div className="history-table" style={{ maxHeight: '250px' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Produto / Especificação</th>
                          <th style={{ textAlign: 'right' }}>Marca</th>
                          <th style={{ textAlign: 'right' }}>Preço</th>
                          <th style={{ textAlign: 'right' }}>Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingAssociations.map((a) => (
                          <tr key={a.temp_id}>
                            <td style={{ width: '40%' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <input
                                  type="text"
                                  className="qty-input"
                                  style={{ width: '100%', textAlign: 'left', fontWeight: 'bold' }}
                                  value={a.product_name}
                                  onChange={(e) => updatePendingAssociation(a.temp_id, 'product_name', e.target.value)}
                                  placeholder="Nome no contrato..."
                                />
                                <textarea
                                  className="qty-input"
                                  style={{ width: '100%', textAlign: 'left', minHeight: '60px', padding: '0.4rem', fontSize: '0.8rem', opacity: 0.8 }}
                                  value={a.product_description}
                                  onChange={(e) => updatePendingAssociation(a.temp_id, 'product_description', e.target.value)}
                                  placeholder="Especificação técnica do contrato..."
                                />
                              </div>
                            </td>
                            <td>
                              <input
                                type="text"
                                className="qty-input"
                                style={{ width: '100%', textAlign: 'left' }}
                                value={a.brand}
                                onChange={(e) => updatePendingAssociation(a.temp_id, 'brand', e.target.value)}
                                placeholder="Marca..."
                              />
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <input
                                type="number"
                                className="qty-input"
                                style={{ width: '100%', textAlign: 'right' }}
                                value={a.price}
                                onChange={(e) => updatePendingAssociation(a.temp_id, 'price', e.target.value)}
                              />
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button className="btn-icon danger" onClick={() => handleRemoveAssociation(a.temp_id)} title="Remover">
                                <X size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {pendingAssociations.length === 0 && (
                          <tr>
                            <td colSpan="4" className="loading-td" style={{ padding: '1.5rem !important' }}>Nenhum produto adicionado à lista.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
                  <button className="btn secondary" onClick={() => setShowManualAddModal(false)}>Cancelar</button>
                  <button className="btn primary" disabled={isSaving} onClick={handleCreateManualClient}>
                    {isSaving ? "Salvando..." : "Criar Cliente e Vincular Produtos"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content glass anim-scale-up" style={{ maxWidth: extractedData ? '1000px' : '600px' }}>
            <header className="modal-header">
              <h2>{extractedData ? 'Revisar e Vincular Produtos' : 'Upload de Ata (IA)'}</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}><X size={20} /></button>
            </header>

            <div className="modal-body">
              {!extractedData && !isUploading && (
                <div
                  className="dropzone"
                  onClick={() => document.getElementById('ata-upload').click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleAtaUpload(e.dataTransfer.files[0]);
                  }}
                >
                  <FileUp size={48} />
                  <p>Arraste o arquivo do contrato aqui ou clique para selecionar</p>
                  <span>Análise automática de itens, preços e quantidades</span>
                  <input
                    id="ata-upload"
                    type="file"
                    hidden
                    accept=".pdf,image/*"
                    onChange={(e) => handleAtaUpload(e.target.files[0])}
                  />
                </div>
              )}

              {isUploading && (
                <div className="processing">
                  <div className="loader"></div>
                  <p>A IA da RCE está lendo o documento e mapeando os itens...</p>
                </div>
              )}

              {extractedData && (
                <div className="extraction-result">
                  <div className="info-grid" style={{ marginBottom: '2rem' }}>
                    <div className="input-group">
                      <label>Cliente / Órgão</label>
                      <input
                        value={newClientName}
                        onChange={(e) => setNewClientName(e.target.value)}
                        placeholder="Nome do cliente..."
                      />
                    </div>
                    <div className="input-group">
                      <label>Contrato / PE</label>
                      <input
                        value={newClientContract}
                        onChange={(e) => setNewClientContract(e.target.value)}
                        placeholder="Ex: 88/2024"
                      />
                    </div>
                  </div>

                  <div className="history-table" style={{ maxHeight: '400px' }}>
                    <h3 style={{ marginBottom: '1rem', opacity: 0.8 }}>Vincular Itens Extraídos ({extractedData.products.length})</h3>
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: '30%' }}>Descrição no Contrato</th>
                          <th style={{ width: '30%' }}>Produto Master (Estoque)</th>
                          <th style={{ textAlign: 'right' }}>Qtd</th>
                          <th style={{ textAlign: 'right' }}>Preço</th>
                        </tr>
                      </thead>
                      <tbody>
                        {extractedData.products.map((p, i) => (
                          <tr key={i}>
                            <td>
                              <div style={{ fontWeight: '500', fontSize: '0.9rem' }}>{p.selection_name}</div>
                              <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{p.selection_description}</div>
                              {p.brand && <div style={{ fontSize: '0.75rem', color: 'var(--primary-light)' }}>Marca: {p.brand}</div>}
                            </td>
                            <td>
                              <div style={{ position: 'relative' }}>
                                <div
                                  className="qty-input"
                                  style={{
                                    width: '100%',
                                    padding: '0.5rem',
                                    background: p.master_product ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.05)',
                                    borderColor: p.master_product ? 'var(--success)' : 'rgba(255,255,255,0.1)',
                                    color: p.master_product ? 'var(--text-primary)' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                  }}
                                  onClick={() => setActiveLinkingIndex(i)}
                                >
                                  {p.master_product ? p.master_product.name : '🔍 Clique para vincular'}
                                  {p.master_product && <CheckCircle size={14} style={{ color: 'var(--success)' }} />}
                                </div>

                                {activeLinkingIndex === i && (
                                  <div className="glass shadow-xl anim-scale-up" style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    zIndex: 100,
                                    marginTop: '0.5rem',
                                    padding: '0.5rem',
                                    maxHeight: '300px',
                                    overflowY: 'auto'
                                  }}>
                                    <input
                                      autoFocus
                                      className="qty-input"
                                      placeholder="Pesquisar estoque..."
                                      style={{ width: '100%', marginBottom: '0.5rem' }}
                                      onChange={(e) => searchMasterProducts(e.target.value)}
                                    />
                                    <div style={{ display: 'grid', gap: '0.25rem' }}>
                                      {masterSearchResults.map(m => (
                                        <div
                                          key={m.id}
                                          className="item-row"
                                          style={{ cursor: 'pointer', padding: '0.5rem', fontSize: '0.8rem' }}
                                          onClick={() => {
                                            handleLinkProduct(i, m);
                                            setActiveLinkingIndex(null);
                                            setMasterSearchResults([]);
                                          }}
                                        >
                                          {m.name} <span style={{ opacity: 0.5 }}>- {m.sku}</span>
                                        </div>
                                      ))}
                                      {masterSearchResults.length === 0 && <div style={{ padding: '0.5rem', opacity: 0.5, fontSize: '0.8rem' }}>Digite para buscar...</div>}
                                    </div>
                                    <button
                                      className="btn secondary"
                                      style={{ width: '100%', marginTop: '0.5rem', padding: '0.25rem' }}
                                      onClick={() => setActiveLinkingIndex(null)}
                                    >
                                      Fechar
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <input
                                type="number"
                                className="qty-input"
                                style={{ width: '60px' }}
                                value={p.quantity}
                                onChange={(e) => {
                                  const updated = [...extractedData.products];
                                  updated[i].quantity = e.target.value;
                                  setExtractedData({ ...extractedData, products: updated });
                                }}
                              />
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <input
                                type="number"
                                className="qty-input"
                                style={{ width: '80px' }}
                                value={p.price}
                                onChange={(e) => {
                                  const updated = [...extractedData.products];
                                  updated[i].price = e.target.value;
                                  setExtractedData({ ...extractedData, products: updated });
                                }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <footer className="modal-footer">
              <button
                className="btn secondary"
                onClick={() => { setExtractedData(null); setShowModal(false); }}
                disabled={isSaving}
              >
                Cancelar
              </button>
              {extractedData && (
                <button
                  className="btn primary"
                  onClick={handleSaveExtracted}
                  disabled={isSaving}
                >
                  {isSaving ? 'Salvando...' : 'Finalizar e Criar Cliente'}
                </button>
              )}
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

function X(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24" height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
