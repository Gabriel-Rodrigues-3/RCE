"use client";
import React, { useState } from 'react';
import {
    Search,
    Plus,
    Trash2,
    CheckCircle,
    FileText,
    Download,
    User,
    ShoppingCart,
    Tag,
    Clock,
    FileUp,
    Eye,
    FileDown,
    ExternalLink
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { generateProposalPDF } from '@/utils/proposalPdf';
import { extractEditalData } from '@/lib/gemini';

export default function ProposalsPage() {
    const [selectedClient, setSelectedClient] = useState(null);
    const [clientSearch, setClientSearch] = useState('');
    const [clients, setClients] = useState([]);
    const [showClientResults, setShowClientResults] = useState(false);

    const [productSearch, setProductSearch] = useState('');
    const [masterProducts, setMasterProducts] = useState([]);
    const [selectedItems, setSelectedItems] = useState([]);

    const [validity, setValidity] = useState('15 dias');
    const [terms, setTerms] = useState('A combinar');
    const [viewMode, setViewMode] = useState('list'); // 'list', 'budget_ia', 'manual'
    const [savedProposals, setSavedProposals] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [extractedItems, setExtractedItems] = useState([]);
    const [proposalName, setProposalName] = useState('');
    const [status, setStatus] = useState('Orçamento');
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [currentStep, setCurrentStep] = useState(1); // 1: Client, 2: Items, 3: Finalization

    const fetchSavedProposals = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('proposals')
            .select('*, customers(*)')
            .order('created_at', { ascending: false });
        if (error) {
            console.error("Fetch error:", error);
            alert("Erro ao buscar propostas: " + error.message);
        } else {
            setSavedProposals(data || []);
        }
        setIsLoading(false);
    };

    React.useEffect(() => {
        fetchSavedProposals();
    }, []);

    const fetchClients = async (term) => {
        if (!term) return;
        const { data, error } = await supabase
            .from('customers')
            .select('*', `name=ilike.*${term}*&limit=20`);
        if (!error) setClients(data || []);
    };

    const fetchProducts = async (term) => {
        if (!term) return;
        const { data, error } = await supabase
            .from('products')
            .select('*', `name=ilike.*${term}*&limit=20`);
        if (!error) setMasterProducts(data || []);
    };

    const addItem = (product) => {
        const exists = selectedItems.find(item => item.id === product.id);
        if (exists) return;

        setSelectedItems([...selectedItems, {
            id: product.id,
            selection_name: product.name,
            brand: product.brand || '',
            unit_price: product.base_price || 0,
            quantity: 1,
            unit: product.unit || 'UN',
            product_id: product.id
        }]);
        setProductSearch('');
        setMasterProducts([]);
    };

    const updateItem = (id, field, value) => {
        setSelectedItems(selectedItems.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ));
    };

    const removeItem = (id) => {
        setSelectedItems(selectedItems.filter(item => item.id !== id));
    };

    const calculateTotal = () => {
        return selectedItems.reduce((acc, item) => acc + ((item.quantity || 0) * (item.unit_price || 0)), 0);
    };

    const handleEditalUpload = async (file) => {
        if (!file) return;
        setIsUploading(true);
        try {
            const data = await extractEditalData(file);

            // Fetch all products for matching
            const { data: allProducts } = await supabase.from('products').select('*');

            const matchedItems = data.products.map(p => {
                const match = findBestStockMatch(p.selection_name, allProducts);
                return {
                    id: Math.random().toString(36).substr(2, 9), // Temp ID
                    item_number: p.item_number,
                    selection_name: p.selection_name,
                    selection_description: p.selection_description,
                    unit: p.unit || 'UN',
                    quantity: parseFloat(p.quantity) || 0,
                    brand: match ? match.brand : '',
                    unit_price: match ? match.base_price : 0,
                    product_id: match ? match.id : null,
                    stock_qty: match ? match.stock_quantity : 0
                };
            });

            setSelectedItems(matchedItems);
        } catch (error) {
            console.error("Extraction error:", error);
            alert("Erro ao processar edital.");
        } finally {
            setIsUploading(false);
        }
    };

    const findBestStockMatch = (description, catalog) => {
        if (!catalog) return null;
        const search = description.toLowerCase();
        return catalog.find(p =>
            search.includes(p.name.toLowerCase()) ||
            p.name.toLowerCase().includes(search)
        );
    };

    const handleSaveAsBudget = async () => {
        if (!selectedClient) return alert("Selecione um cliente.");
        setIsSavingDraft(true);
        try {
            const proposalData = {
                customer_id: selectedClient.id,
                status: 'Orçamento',
                type: 'Edital',
                total_amount: Number(calculateTotal() || 0),
                validity: validity || '15 dias',
                terms: terms || 'A combinar',
                updated_at: new Date().toISOString()
            };

            let pId = editingId;

            if (editingId) {
                const { error: pErr } = await supabase
                    .from('proposals')
                    .update(proposalData)
                    .eq('id', editingId);
                if (pErr) throw pErr;

                // Delete existing items for full refresh
                await supabase.from('proposal_items').delete().eq('proposal_id', editingId);
            } else {
                const { data: proposal, error: pErr } = await supabase.from('proposals').insert(proposalData).select();
                if (pErr) throw pErr;
                if (!proposal || proposal.length === 0) throw new Error("Falha ao criar proposta.");
                pId = proposal[0].id;
            }

            const items = selectedItems.map(item => ({
                proposal_id: pId,
                product_id: item.product_id || null,
                item_number: String(item.item_number || ''),
                selection_name: item.selection_name || 'Sem nome',
                selection_description: item.selection_description || '',
                brand: item.brand || '',
                unit: item.unit || 'UN',
                quantity: parseFloat(item.quantity) || 0,
                unit_price: parseFloat(item.unit_price) || 0
            }));

            const { error: iErr } = await supabase.from('proposal_items').insert(items);
            if (iErr) throw iErr;

            alert("Orçamento salvo com sucesso!");
            setViewMode('list');
            fetchSavedProposals();
        } catch (err) {
            console.error("Save error:", err);
            alert("Erro ao salvar orçamento: " + (err.message || String(err)));
        } finally {
            setIsSavingDraft(false);
        }
    };

    const handleExportExcel = async (itemsToExport = selectedItems) => {
        if (!itemsToExport || itemsToExport.length === 0) return alert("Adicione itens primeiro.");
        try {
            const response = await fetch('/api/export-excel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: itemsToExport })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erro ao gerar Excel');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const timestamp = new Date().getTime();
            a.download = `Orcamento_RCE_${timestamp}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            alert("Excel gerado e baixado com sucesso!");
        } catch (err) {
            console.error(err);
            alert("Erro na exportação: " + err.message);
        }
    };

    const handleDeleteProposal = async (id) => {
        if (!confirm("Tem certeza que deseja excluir esta proposta?")) return;
        const { error } = await supabase.from('proposals').delete().eq('id', id);
        if (error) {
            console.error("Delete error:", error);
            alert("Erro ao excluir proposta: " + error.message);
        } else {
            fetchSavedProposals();
        }
    };

    const handleLoadProposal = async (proposal) => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('proposal_items')
                .select('*')
                .eq('proposal_id', proposal.id);

            if (error) throw error;

            setEditingId(proposal.id);
            setSelectedClient(proposal.customers);
            setSelectedItems(data.map(item => ({
                id: item.id,
                item_number: item.item_number,
                selection_name: item.selection_name,
                selection_description: item.selection_description,
                unit: item.unit,
                quantity: item.quantity,
                unit_price: item.unit_price,
                brand: item.brand,
                product_id: item.product_id
            })));

            setViewMode('manual');
            setCurrentStep(2); // Go to items directly when loading
        } catch (err) {
            console.error(err);
            alert("Erro ao carregar itens.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownloadAction = async (proposal) => {
        setIsLoading(true);
        try {
            const { data: items, error } = await supabase
                .from('proposal_items')
                .select('*')
                .eq('proposal_id', proposal.id);

            if (error) throw error;

            const formattedItems = items.map(item => ({
                item_number: item.item_number,
                selection_name: item.selection_name,
                unit: item.unit,
                quantity: item.quantity,
                unit_price: item.unit_price,
                brand: item.brand
            }));

            if (proposal.status === 'Orçamento') {
                await handleExportExcel(formattedItems);
            } else {
                handleGenerate(proposal.customers, formattedItems);
            }
        } catch (err) {
            console.error(err);
            alert("Erro ao baixar arquivo.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerate = (client = selectedClient, itemsToGenerate = selectedItems) => {
        if (!client) {
            alert('Por favor, selecione um cliente.');
            return;
        }
        if (itemsToGenerate.length === 0) {
            alert('Adicione pelo menos um item à proposta.');
            return;
        }

        setIsGenerating(true);
        generateProposalPDF({
            client: client,
            items: itemsToGenerate.map(i => ({
                ...i,
                name: String(i.selection_name || i.name || 'Item sem nome'),
                price: parseFloat(i.unit_price || i.price || 0),
                quantity: parseFloat(i.quantity || 0),
                brand: String(i.brand || '-')
            })),
            validity: validity || '15 dias',
            terms: terms || 'A combinar',
            totalAmount: Number(calculateTotal() || itemsToGenerate.reduce((acc, i) => acc + ((parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price || i.price) || 0)), 0))
        });
        setIsGenerating(false);
    };

    return (
        <div className="proposals-container">
            <header className="page-header">
                <div className="header-info">
                    <h1>Módulo de Bidding & Propostas</h1>
                    <p>IA para Editais, Negociação em Excel e Propostas Finais</p>
                </div>
                <div className="header-actions">
                    {viewMode === 'list' ? (
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button className="btn primary" onClick={() => { setViewMode('budget_ia'); setSelectedItems([]); setSelectedClient(null); setEditingId(null); setCurrentStep(1); }}>
                                <FileUp size={18} /> Novo Orçamento (IA)
                            </button>
                            <button className="btn secondary" onClick={() => { setViewMode('manual'); setSelectedItems([]); setSelectedClient(null); setEditingId(null); setCurrentStep(1); }}>
                                <Plus size={18} /> Proposta Manual
                            </button>
                        </div>
                    ) : (
                        <button className="btn secondary" onClick={() => { setViewMode('list'); setEditingId(null); setCurrentStep(1); }}>Voltar para Lista</button>
                    )}
                </div>
            </header>

            {viewMode === 'list' && (
                <div className="proposals-list-v2 glass">
                    <div className="list-header">
                        <h2>Orçamentos e Propostas Recentes</h2>
                        <div className="search-bar">
                            <Search size={18} />
                            <input type="text" placeholder="Filtrar por cliente..." />
                        </div>
                    </div>

                    <div className="history-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>Data</th>
                                    <th>Cliente</th>
                                    <th>Status</th>
                                    <th>Valor Total</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {savedProposals.map(p => (
                                    <tr key={p.id}>
                                        <td>{new Date(p.created_at).toLocaleDateString()}</td>
                                        <td><strong>{p.customers?.name}</strong></td>
                                        <td>
                                            <span className={`status-badge ${p.status.toLowerCase()}`}>
                                                {p.status}
                                            </span>
                                        </td>
                                        <td>R$ {(p.total_amount || 0).toLocaleString('pt-BR')}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button className="btn-icon" title="Editar/Ver" onClick={() => handleLoadProposal(p)}>
                                                    <Eye size={16} />
                                                </button>
                                                <button className="btn-icon" title="Exportar/Baixar" onClick={() => handleDownloadAction(p)}>
                                                    <Download size={16} />
                                                </button>
                                                <button className="btn-icon danger" title="Excluir" onClick={() => handleDeleteProposal(p.id)}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {savedProposals.length === 0 && (
                                    <tr><td colSpan="5" className="empty-state">Nenhum registro encontrado.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {(viewMode === 'budget_ia' || viewMode === 'manual') && (
                <div className="proposal-builder-v2 card shadow-sm anim-fade-in">
                    <div className="builder-header-tabs">
                        <div className={`tab ${currentStep === 1 ? 'active' : ''}`}>1. Identificação</div>
                        <div className={`tab ${currentStep === 2 ? 'active' : ''}`}>2. Itens</div>
                        <div className={`tab ${currentStep === 3 ? 'active' : ''}`}>3. Finalização</div>
                    </div>

                    {currentStep === 1 && (
                        <div className="builder-section anim-slide-in">
                            <div className="section-header">
                                <User size={20} />
                                <h3>1. Identificação do Cliente</h3>
                            </div>
                            <div className="client-selector">
                                {selectedClient ? (
                                    <div className="selected-client-card glass">
                                        <div className="client-details">
                                            <strong>{selectedClient.name}</strong>
                                            <span>{selectedClient.contract_number}</span>
                                        </div>
                                        <button className="btn-change" onClick={() => setSelectedClient(null)}>Trocar Cliente</button>
                                    </div>
                                ) : (
                                    <div className="search-box">
                                        <Search size={18} className="search-icon" />
                                        <input
                                            type="text"
                                            placeholder="Pesquisar cliente..."
                                            autoFocus
                                            onChange={(e) => {
                                                setClientSearch(e.target.value);
                                                fetchClients(e.target.value);
                                                setShowClientResults(true);
                                            }}
                                        />
                                        {showClientResults && clients.length > 0 && (
                                            <div className="search-results shadow-md">
                                                {clients.map(c => (
                                                    <div key={c.id} className="result-item" onClick={() => { setSelectedClient(c); setShowClientResults(false); }}>
                                                        {c.name}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            {selectedClient && (
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                    <button className="btn primary lg" onClick={() => setCurrentStep(2)}>
                                        Próximo: Adicionar Itens
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {currentStep === 2 && (
                        <>
                            {viewMode === 'budget_ia' && selectedItems.length === 0 && !isUploading && (
                                <div className="builder-section anim-slide-in">
                                    <div className="section-header">
                                        <FileText size={20} />
                                        <h3>2. Importar Edital (IA)</h3>
                                    </div>
                                    <div className="dropzone-large" onClick={() => document.getElementById('edital-file').click()}>
                                        <FileUp size={48} />
                                        <h4>Carregar Edital ou Termo de Referência</h4>
                                        <p>A IA extrairá automaticamente a tabela de itens para você</p>
                                        <input id="edital-file" type="file" hidden accept=".pdf,image/*" onChange={(e) => handleEditalUpload(e.target.files[0])} />
                                    </div>
                                    <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                                        <span>OU</span>
                                        <button className="btn text-primary" onClick={() => setViewMode('manual')}>Inserir Itens Manualmente</button>
                                    </div>
                                </div>
                            )}

                            {viewMode === 'manual' && (
                                <div className="builder-section anim-slide-in">
                                    <div className="section-header">
                                        <Search size={20} />
                                        <h3>2. Selecionar Produtos</h3>
                                    </div>
                                    <div className="search-box">
                                        <Search size={18} className="search-icon" />
                                        <input
                                            type="text"
                                            placeholder="Buscar no estoque por nome ou referência..."
                                            value={productSearch}
                                            autoFocus
                                            onChange={(e) => {
                                                setProductSearch(e.target.value);
                                                fetchProducts(e.target.value);
                                            }}
                                        />
                                        {masterProducts.length > 0 && (
                                            <div className="search-results">
                                                {masterProducts.map(p => (
                                                    <div key={p.id} className="result-item" onClick={() => addItem(p)}>
                                                        <div className="p-info">
                                                            <strong>{p.name}</strong>
                                                            <span>Estoque: {p.stock_quantity} {p.unit}</span>
                                                        </div>
                                                        <div className="p-price">R$ {(p.base_price || 0).toFixed(2)}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {isUploading && (
                                <div className="processing">
                                    <div className="loader"></div>
                                    <p>Analisando edital e buscando equivalentes no estoque...</p>
                                </div>
                            )}

                            {selectedItems.length > 0 && (
                                <div className="builder-section anim-slide-up">
                                    <div className="section-header">
                                        <ShoppingCart size={20} />
                                        <h3>{viewMode === 'budget_ia' ? 'Itens do Edital' : 'Itens Adicionados'}</h3>
                                    </div>

                                    <div className="selected-items-table">
                                        <table className="compact">
                                            <thead>
                                                <tr>
                                                    <th>Item</th>
                                                    <th style={{ width: '40%' }}>Descrição</th>
                                                    <th>Marca</th>
                                                    <th>Qtd</th>
                                                    <th>Preço Unit.</th>
                                                    <th>Total</th>
                                                    <th></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedItems.map((item, idx) => (
                                                    <tr key={item.id} className={item.product_id ? 'matched' : 'unmatched'}>
                                                        <td>{item.item_number || (idx + 1)}</td>
                                                        <td>
                                                            <div className="item-name">{item.selection_name}</div>
                                                            {item.selection_description && <div className="item-desc">{item.selection_description}</div>}
                                                        </td>
                                                        <td>
                                                            <input
                                                                className="inline-input"
                                                                value={item.brand}
                                                                onChange={(e) => updateItem(item.id, 'brand', e.target.value)}
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="number"
                                                                className="inline-input qty"
                                                                value={item.quantity}
                                                                onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="number"
                                                                className="inline-input price"
                                                                value={item.unit_price}
                                                                onChange={(e) => updateItem(item.id, 'unit_price', e.target.value)}
                                                            />
                                                        </td>
                                                        <td><strong>R$ {((item.quantity || 0) * (item.unit_price || 0)).toFixed(2)}</strong></td>
                                                        <td><button className="btn-remove" onClick={() => removeItem(item.id)}><Trash2 size={14} /></button></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="builder-footer" style={{ border: 'none', paddingTop: 0 }}>
                                        <div className="grand-total">
                                            <span>Subtotal ({selectedItems.length} itens)</span>
                                            <strong>R$ {calculateTotal().toLocaleString('pt-BR')}</strong>
                                        </div>
                                        <div className="footer-btns">
                                            <button className="btn secondary" onClick={() => setCurrentStep(1)}>Voltar</button>
                                            <button className="btn primary lg" onClick={() => setCurrentStep(3)}>Avançar p/ Finalização</button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {currentStep === 3 && (
                        <div className="builder-section anim-slide-in">
                            <div className="section-header">
                                <CheckCircle size={20} />
                                <h3>3. Finalização da Proposta</h3>
                            </div>

                            <div className="conditions-grid">
                                <div className="form-group">
                                    <label><Clock size={16} /> Validade da Proposta</label>
                                    <input value={validity} onChange={e => setValidity(e.target.value)} placeholder="Ex: 30 dias" />
                                </div>
                                <div className="form-group">
                                    <label><ShoppingCart size={16} /> Condições de Pagamento</label>
                                    <input value={terms} onChange={e => setTerms(e.target.value)} placeholder="Ex: 28 dias" />
                                </div>
                            </div>

                            <div className="builder-footer">
                                <div className="grand-total">
                                    <span>Valor Total da Proposta</span>
                                    <strong>R$ {calculateTotal().toLocaleString('pt-BR')}</strong>
                                </div>
                                <div className="footer-btns">
                                    <button className="btn secondary" onClick={() => setCurrentStep(2)}>Voltar para Itens</button>
                                    <button className="btn secondary" onClick={handleSaveAsBudget} disabled={isSavingDraft}>
                                        {isSavingDraft ? 'Salvando...' : 'Salvar como Orçamento'}
                                    </button>
                                    <button className="btn primary lg" onClick={handleGenerate}>
                                        <FileText size={20} /> Gerar PDF Final
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
