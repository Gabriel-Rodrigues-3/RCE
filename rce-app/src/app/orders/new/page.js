"use client";
import React, { useState } from 'react';
import {
    Plus,
    ShoppingCart,
    User,
    ArrowRight,
    CheckCircle,
    Minus,
    Trash2,
    FileText,
    FileUp,
    Sparkles,
    Download,
    Printer,
    ArrowLeft
} from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';

import { supabase } from '@/lib/supabase';
import { generateOrderPDF } from '@/utils/pdfExport';

export default function NewOrderPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const editOrderId = searchParams.get('edit');
    const directClientId = searchParams.get('clientId');

    const [step, setStep] = useState(1);
    const [clients, setClients] = useState([]);
    const [selectedClient, setSelectedClient] = useState(null);
    const [availableProducts, setAvailableProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [cart, setCart] = useState([]);
    const [orderId, setOrderId] = useState(null);

    // AI Extraction State
    const [showAIModal, setShowAIModal] = useState(false);
    const [isExtracting, setIsExtracting] = useState(false);
    const [extractedData, setExtractedData] = useState(null);
    const [cardQuantities, setCardQuantities] = useState({}); // Map of productId -> current selection

    const fetchClients = async () => {
        // Using mock syntax: select(columns, filter)
        const { data, error } = await supabase.from('customers').select('*', 'order=name.asc');
        if (!error) setClients(data || []);
    };

    const fetchClientProducts = async (clientId) => {
        setIsLoading(true);
        // Using mock syntax: select(columns, filter)
        const { data: cpData, error: cpError } = await supabase
            .from('customer_products')
            .select('*, products(*)', `customer_id=eq.${clientId}`);

        if (!cpError && cpData) {
            // Fetch total reserved for these products
            const productIds = cpData.map(cp => cp.product_id).filter(id => id);

            if (productIds.length > 0) {
                const idList = productIds.join(',');
                const { data: reservedData } = await supabase
                    .from('order_products')
                    .select('product_id, quantity, orders(status)', `product_id=in.(${idList})&orders.status=eq.Reservado`);

                // Map reserved totals
                const resTotals = (reservedData || []).reduce((acc, curr) => {
                    const prodId = curr.product_id;
                    acc[prodId] = (acc[prodId] || 0) + (curr.quantity || 0);
                    return acc;
                }, {});

                const formattedProds = cpData.map(cp => {
                    // Robust check for joined products (handle both object and array)
                    const prod = Array.isArray(cp.products) ? cp.products[0] : cp.products;
                    const physicalStock = prod?.stock_quantity || 0;
                    const reserved = resTotals[cp.product_id] || 0;

                    return {
                        id: cp.product_id,
                        name: cp.custom_name || prod?.name,
                        description: cp.custom_description || prod?.description,
                        sku: prod?.sku,
                        stock: physicalStock - reserved,
                        physical_stock: physicalStock,
                        price: cp.custom_price || prod?.base_price || 0,
                        unit: prod?.unit || 'UN',
                        brand: cp.custom_brand || prod?.brand || 'Genérico'
                    };
                });
                setAvailableProducts(formattedProds);

                // Initialize card quantities
                const initialQtys = {};
                formattedProds.forEach(p => initialQtys[p.id] = 1);
                setCardQuantities(initialQtys);
            } else {
                setAvailableProducts([]);
            }
        }
        setIsLoading(false);
    };

    const fetchOrderForEditing = async (id) => {
        setIsLoading(true);
        try {
            // 1. Fetch Order
            const { data: orderData, error: oError } = await supabase
                .from('orders')
                .select('*, customers(*)', `id=eq.${id}`);

            if (oError || !orderData || orderData.length === 0) throw oError || new Error('Order not found');
            const order = orderData[0];

            setSelectedClient(order.customers);

            // 2. Fetch Order Products
            const { data: items, error: iError } = await supabase
                .from('order_products')
                .select('*, products(*)', `order_id=eq.${id}`);

            if (iError) throw iError;

            // 3. Format cart and available products
            // We need available products first to match IDs correctly
            await fetchClientProducts(order.customer_id);

            const initialCart = items.map(item => {
                const prod = Array.isArray(item.products) ? item.products[0] : item.products;
                return {
                    id: item.product_id,
                    name: prod?.name || 'Produto',
                    price: parseFloat(item.unit_price),
                    quantity: item.quantity,
                    stock: 999, // Temp, will be updated by availableProducts
                    unit: prod?.unit || 'UN',
                    brand: item.custom_brand || prod?.brand || 'Genérico'
                };
            });

            setCart(initialCart);

            // Initialize card quantities for these items
            const qtys = {};
            items.forEach(item => qtys[item.product_id] = item.quantity);
            setCardQuantities(prev => ({ ...prev, ...qtys }));

            setStep(2);
        } catch (err) {
            console.error("Error loading order for edit:", err);
            alert("Erro ao carregar pedido para edição.");
        } finally {
            setIsLoading(false);
        }
    };

    React.useEffect(() => {
        fetchClients();
        if (editOrderId) {
            fetchOrderForEditing(editOrderId);
        } else if (directClientId) {
            // Pre-select client if provided in URL
            const loadClient = async () => {
                const { data, error } = await supabase.from('customers').select('*', `id=eq.${directClientId}`);
                if (!error && data && data.length > 0) {
                    setSelectedClient(data[0]);
                    setStep(2);
                }
            };
            loadClient();
        }
    }, [editOrderId, directClientId]);

    React.useEffect(() => {
        if (selectedClient && !editOrderId) {
            setCart([]);
            fetchClientProducts(selectedClient.id);
        }
    }, [selectedClient, editOrderId]);

    const addToCart = (product, quantity = 1) => {
        const existing = cart.find(item => item.id === product.id);
        if (existing) {
            setCart(cart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + quantity, brand: product.brand } : item));
        } else {
            setCart([...cart, { ...product, quantity }]);
        }
    };

    const removeFromCart = (id) => {
        setCart(cart.filter(item => item.id !== id));
    };

    const updateQuantity = (id, delta) => {
        setCart(cart.map(item => {
            if (item.id === id) {
                const newQty = item.quantity + delta;
                if (newQty < 1) return item;
                return { ...item, quantity: newQty };
            }
            return item;
        }));
    };

    const simulateAIExtraction = () => {
        setIsExtracting(true);
        setTimeout(() => {
            setIsExtracting(false);
            setExtractedData({
                clientName: "Empresa Alpha Ltda",
                items: [
                    { id: 101, name: 'Papel A4 Report 75g (500fls)', quantity: 10, price: 28.50 },
                    { id: 102, name: 'Caneta Esferográfica Azul BIC', quantity: 50, price: 1.20 },
                ]
            });
        }, 2000);
    };

    const importExtractedData = () => {
        // Find the client if not selected
        if (!selectedClient) {
            const client = clients.find(c => c.name === extractedData.clientName);
            if (client) setSelectedClient(client);
        }

        // Add items to cart
        extractedData.items.forEach(item => {
            const product = availableProducts.find(p => p.id === item.id || p.name === item.name);
            if (product) {
                addToCart(product, item.quantity);
            }
        });

        setExtractedData(null);
        setShowAIModal(false);
        setStep(2); // Jump to cart step
    };

    const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

    const finalizeOrder = async () => {
        if (!selectedClient || cart.length === 0) return;
        setIsLoading(true);

        // 1. Create or Update Order
        let currentOrderId = editOrderId;

        if (editOrderId) {
            // Update existing order amount
            const { error: upError } = await supabase
                .from('orders')
                .update({
                    total_amount: total,
                    updated_at: new Date().toISOString()
                }, `id=eq.${editOrderId}`);

            if (upError) {
                console.error("Error updating order:", upError);
                alert("Erro ao atualizar pedido.");
                setIsLoading(false);
                return;
            }

            // Remove old items
            await supabase.from('order_products').delete(`order_id=eq.${editOrderId}`);
        } else {
            const { data: orderData, error: orderError } = await supabase
                .from('orders')
                .insert({
                    customer_id: selectedClient.id,
                    status: 'Reservado',
                    total_amount: total
                });

            if (orderError || !orderData) {
                console.error("Error creating order:", orderError);
                alert("Erro ao criar pedido.");
                setIsLoading(false);
                return;
            }
            currentOrderId = orderData[0].id;
        }

        setOrderId(currentOrderId);

        const orderItems = cart.map(item => ({
            order_id: currentOrderId,
            product_id: item.id,
            quantity: item.quantity,
            unit_price: item.price,
            custom_brand: item.brand
        }));

        const { error: itemsError } = await supabase
            .from('order_products')
            .insert(orderItems);

        if (itemsError) {
            console.error("Error creating order items:", itemsError);
            alert("Erro ao criar itens do pedido.");
            setIsLoading(false);
            return;
        }

        setIsLoading(false);
        setStep(3);
    };

    return (
        <div className="orders-container">
            <header className="page-header">
                <div className="header-info">
                    <h1>Registro de Pedido</h1>
                    <p>Crie pedidos manualmente ou utilize a IA para extrair dados</p>
                </div>
                <div className="header-actions">
                    <button className="btn secondary glass" onClick={() => setShowAIModal(true)}>
                        <Sparkles size={18} />
                        <span>Preencher via IA</span>
                    </button>
                    <div className="stepper">
                        <div className={`step-item ${step >= 1 ? 'active' : ''}`}>1</div>
                        <div className="step-line"></div>
                        <div className={`step-item ${step >= 2 ? 'active' : ''}`}>2</div>
                        <div className="step-line"></div>
                        <div className={`step-item ${step >= 3 ? 'active' : ''}`}>3</div>
                    </div>
                </div>
            </header>

            {step === 1 && (
                <div className="step-content anim-fade-in">
                    <h2>Selecione o Cliente</h2>
                    <div className="client-selection-grid">
                        {clients.map(client => (
                            <div
                                key={client.id}
                                className={`client-card glass ${selectedClient?.id === client.id ? 'selected' : ''}`}
                                onClick={() => setSelectedClient(client)}
                            >
                                <div className="client-icon"><User size={24} /></div>
                                <span className="client-name">{client.name}</span>
                                {selectedClient?.id === client.id && <CheckCircle className="check-icon" size={20} />}
                            </div>
                        ))}
                    </div>
                    <footer className="step-footer">
                        <button
                            className="btn primary"
                            disabled={!selectedClient}
                            onClick={() => setStep(2)}
                        >
                            Próximo Passo <ArrowRight size={18} />
                        </button>
                    </footer>
                </div>
            )}

            {step === 2 && (
                <div className="step-content anim-fade-in main-order-flow">
                    <div className="products-selection">
                        <h2>Itens em Contrato ({selectedClient?.name})</h2>
                        <div className="selection-container card shadow-sm">
                            <table className="selection-table">
                                <thead>
                                    <tr>
                                        <th className="col-check"></th>
                                        <th className="col-product">Produto</th>
                                        <th className="col-brand">Marca</th>
                                        <th className="col-stock">Disponível</th>
                                        <th className="col-price">Preço Unit.</th>
                                        <th className="col-qty">Quantidade</th>
                                        <th className="col-action">Ação</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {availableProducts.map(product => {
                                        const inCart = cart.find(item => item.id === product.id);
                                        const currentCardQty = cardQuantities[product.id] || 1;

                                        const updateCardQty = (delta) => {
                                            const next = currentCardQty + delta;
                                            if (next < 1) return;
                                            setCardQuantities(prev => ({ ...prev, [product.id]: next }));
                                        };

                                        return (
                                            <tr key={product.id} className={inCart ? 'row-selected' : ''}>
                                                <td className="col-check">
                                                    {inCart && <CheckCircle className="check-icon-table" size={18} />}
                                                </td>
                                                <td className="col-product">
                                                    <div className="p-details">
                                                        <span className="p-main-name">{product.name}</span>
                                                        {product.description && <p className="p-sub-desc">{product.description}</p>}
                                                    </div>
                                                </td>
                                                <td className="col-brand">
                                                    <input
                                                        type="text"
                                                        className="inline-edit-input"
                                                        value={product.brand}
                                                        onChange={(e) => {
                                                            const newBrand = e.target.value;
                                                            setAvailableProducts(availableProducts.map(p =>
                                                                p.id === product.id ? { ...p, brand: newBrand } : p
                                                            ));
                                                        }}
                                                        placeholder="Marca..."
                                                        title="Clique para editar a marca"
                                                    />
                                                </td>
                                                <td className="col-stock">
                                                    <span className={`theme-badge ${product.stock < 10 ? 'critical' : ''}`}>
                                                        {product.stock} {product.unit}
                                                    </span>
                                                </td>
                                                <td className="col-price">
                                                    R$ {product.price.toFixed(2)}
                                                </td>
                                                <td className="col-qty">
                                                    <div className="qty-picker-inline">
                                                        <button onClick={() => updateCardQty(-1)} disabled={isLoading}><Minus size={14} /></button>
                                                        <span>{currentCardQty}</span>
                                                        <button onClick={() => updateCardQty(1)} disabled={isLoading}><Plus size={14} /></button>
                                                    </div>
                                                </td>
                                                <td className="col-action">
                                                    <button
                                                        className={`btn ${inCart ? 'secondary' : 'primary'} sm btn-add-table`}
                                                        onClick={() => addToCart(product, currentCardQty)}
                                                        disabled={isLoading}
                                                    >
                                                        {inCart ? 'Adicionado' : 'Adicionar'}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="order-summary glass shadow-lg">
                        <h3>Carrinho</h3>
                        <div className="cart-items">
                            {cart.length === 0 ? (
                                <div className="empty-cart">
                                    <ShoppingCart size={40} />
                                    <p>Carrinho vazio</p>
                                </div>
                            ) : (
                                cart.map(item => (
                                    <div key={item.id} className="cart-item">
                                        <div className="c-info">
                                            <span className="c-name">{item.name}</span>
                                            <div className="c-sub-info">
                                                <span className="c-brand-badge">{item.brand}</span>
                                                <span className="c-price">un: R$ {item.price.toFixed(2)}</span>
                                            </div>
                                        </div>
                                        <div className="c-controls">
                                            <div className="qty-picker">
                                                <button onClick={() => updateQuantity(item.id, -1)}><Minus size={14} /></button>
                                                <span>{item.quantity}</span>
                                                <button onClick={() => updateQuantity(item.id, 1)}><Plus size={14} /></button>
                                            </div>
                                            <button className="del-btn" onClick={() => removeFromCart(item.id)}><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="cart-footer">
                            <div className="total-row">
                                <span>Total</span>
                                <span>R$ {total.toFixed(2)}</span>
                            </div>
                            <button
                                className="btn primary full"
                                disabled={cart.length === 0 || isLoading}
                                onClick={finalizeOrder}
                            >
                                {isLoading ? 'Processando...' : 'Finalizar Pedido'}
                            </button>
                            <button className="btn ghost" onClick={() => setStep(1)}>Mudar Cliente</button>
                        </div>
                    </div>
                </div>
            )}

            {step === 3 && (
                <div className="step-content anim-scale-up confirmation-screen">
                    <div className="conf-card glass">
                        <div className="success-icon"><CheckCircle size={64} /></div>
                        <h2>Pedido Confirmado!</h2>
                        <p>O pedido para <strong>{selectedClient?.name}</strong> foi registrado com sucesso.</p>
                        <div className="conf-details">
                            <div className="detail-item">
                                <span>ID do Pedido</span>
                                <strong style={{ fontSize: '0.8rem' }}>{orderId}</strong>
                            </div>
                            <div className="detail-item">
                                <span>Total Faturado</span>
                                <strong>R$ {total.toFixed(2)}</strong>
                            </div>
                        </div>
                        <div className="conf-actions">
                            <button className="btn secondary" onClick={() => { router.push('/orders/new'); setStep(1); setCart([]); setSelectedClient(null); setOrderId(null); }}>
                                Novo Pedido
                            </button>
                            <button
                                className="btn primary"
                                onClick={() => generateOrderPDF({ id: orderId, total_amount: total }, selectedClient, cart)}
                            >
                                <FileText size={18} /> Baixar PDF
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* AI Extraction Modal */}
            {showAIModal && (
                <div className="modal-overlay">
                    <div className="modal-content glass anim-scale-up" style={{ maxWidth: '600px' }}>
                        <header className="modal-header">
                            <div className="modal-title-group">
                                <Sparkles size={20} className="text-primary" />
                                <h2>Extração de Pedido por IA</h2>
                            </div>
                            <button className="close-btn" onClick={() => setShowAIModal(false)}><X size={20} /></button>
                        </header>

                        <div className="modal-body">
                            {!extractedData && !isExtracting && (
                                <div className="dropzone" onClick={simulateAIExtraction}>
                                    <FileUp size={48} />
                                    <p>Arraste o pedido (PDF) ou clique para selecionar</p>
                                    <span>A IA identificará descrição, quantidades e valores</span>
                                </div>
                            )}

                            {isExtracting && (
                                <div className="processing">
                                    <div className="loader"></div>
                                    <p>A IA da RCE está convertendo o documento em pedido...</p>
                                </div>
                            )}

                            {extractedData && (
                                <div className="extraction-result anim-fade-in">
                                    <div className="result-header">
                                        <CheckCircle size={20} />
                                        <h3>Itens Identificados com Sucesso</h3>
                                    </div>

                                    <div className="client-preview">
                                        <div className="preview-field">
                                            <label>Cliente Detectado</label>
                                            <input value={extractedData.clientName} readOnly />
                                        </div>
                                    </div>

                                    <div className="items-container">
                                        {extractedData.items.map((item, idx) => (
                                            <div key={idx} className="item-row">
                                                <div className="item-details">
                                                    <span className="item-name">{item.name}</span>
                                                    <div className="item-meta">
                                                        <span>{item.quantity} un</span>
                                                        <span className="dot"></span>
                                                        <span>R$ {item.price.toFixed(2)} p/un</span>
                                                    </div>
                                                </div>
                                                <div className="item-subtotal">
                                                    R$ {(item.quantity * item.price).toFixed(2)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="extraction-warning">
                                        <AlertCircle size={14} />
                                        <p>Revise os itens e quantidades antes de importar para o carrinho.</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <footer className="modal-footer">
                            <button className="btn secondary" onClick={() => { setExtractedData(null); setShowAIModal(false); }}>Cancelar</button>
                            {extractedData && (
                                <button className="btn primary" onClick={importExtractedData}>
                                    Importar para o Carrinho
                                </button>
                            )}
                        </footer>
                    </div>
                </div>
            )}

        </div>
    );
}
