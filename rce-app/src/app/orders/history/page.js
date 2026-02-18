"use client";
import React, { useState } from 'react';
import {
    Plus,
    Search,
    ShoppingCart,
    Filter,
    ArrowUpDown,
    MoreVertical,
    Eye,
    Clock,
    CheckCircle,
    CreditCard,
    FileText,
    Download,
    Edit2,
    Trash2
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { supabase } from '@/lib/supabase';
import { generateOrderPDF } from '@/utils/pdfExport';

export default function OrderHistoryPage() {
    const router = useRouter();
    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Reservado');
    const [showNFModal, setShowNFModal] = useState(false);
    const [currentOrder, setCurrentOrder] = useState(null);
    const [nfUrl, setNfUrl] = useState('');
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [orderDetails, setOrderDetails] = useState(null);
    const [sortColumn, setSortColumn] = useState('created_at');
    const [sortDirection, setSortDirection] = useState('desc');

    const fetchOrders = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('orders')
            .select('*, customers(name)', `status=eq.${activeTab}&order=created_at.desc`);

        if (!error) setOrders(data || []);
        setIsLoading(false);
    };

    React.useEffect(() => {
        fetchOrders();
    }, [activeTab]);

    const handleUpdateStatus = async (orderId, newStatus, additionalData = {}) => {
        const { error } = await supabase
            .from('orders')
            .update({
                status: newStatus,
                ...additionalData,
                updated_at: new Date().toISOString(),
                ...(newStatus === 'Entregue' ? { delivered_at: new Date().toISOString() } : {}),
                ...(newStatus === 'Faturado' ? { faturado_at: new Date().toISOString() } : {})
            })
            .eq('id', orderId);

        if (!error) {
            fetchOrders();
            setShowNFModal(false);
            setNfUrl('');
        } else {
            alert('Erro ao atualizar status.');
        }
    };

    const downloadOrderPDF = async (order) => {
        setIsLoading(true);
        try {
            const { data: items, error } = await supabase
                .from('order_products')
                .select('*, products(*)', `order_id=eq.${order.id}`);

            if (error) throw error;

            generateOrderPDF(order, order.customers, items);
        } catch (err) {
            console.error("Error generating PDF:", err);
            alert("Erro ao gerar PDF.");
        } finally {
            setIsLoading(false);
        }
    };

    const openNFModal = (order) => {
        setCurrentOrder(order);
        setNfUrl(order.signed_nf_url || '');
        setShowNFModal(true);
    };

    const openDetailsModal = async (order) => {
        setCurrentOrder(order);
        setShowDetailsModal(true);

        // Fetch order products
        const { data: products } = await supabase
            .from('order_products')
            .select('*, products(name, sku, unit)')
            .eq('order_id', order.id);

        setOrderDetails({
            ...order,
            products: products || []
        });
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Reservado': return 'var(--info)';
            case 'Entregue': return 'var(--success)';
            case 'Faturado': return 'var(--warning)';
            default: return 'var(--text-secondary)';
        }
    };

    const handleSort = (column) => {
        console.log('Sorting by:', column, 'Current direction:', sortDirection);
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    return (
        <div className="orders-container">
            <header className="page-header">
                <div className="header-info">
                    <h1>Gestão de Pedidos</h1>
                    <p>Acompanhe o status e faturamento de todos os pedidos</p>
                </div>
                <div className="header-actions">
                    <Link href="/orders/new">
                        <button className="btn primary">
                            <Plus size={18} />
                            <span>Novo Pedido</span>
                        </button>
                    </Link>
                </div>
            </header>

            <div className="tabs-container glass" style={{ display: 'flex', gap: '1rem', padding: '1rem', marginBottom: '1.5rem' }}>
                <button
                    className={`tab-btn ${activeTab === 'Reservado' ? 'active' : ''}`}
                    onClick={() => setActiveTab('Reservado')}
                    style={activeTab === 'Reservado' ? { background: 'var(--accent)', color: 'white', padding: '0.5rem 1rem', borderRadius: '8px' } : { padding: '0.5rem 1rem' }}
                >
                    Reservados
                </button>
                <button
                    className={`tab-btn ${activeTab === 'Entregue' ? 'active' : ''}`}
                    onClick={() => setActiveTab('Entregue')}
                    style={activeTab === 'Entregue' ? { background: 'var(--success)', color: 'white', padding: '0.5rem 1rem', borderRadius: '8px' } : { padding: '0.5rem 1rem' }}
                >
                    Entregues
                </button>
                <button
                    className={`tab-btn ${activeTab === 'Faturado' ? 'active' : ''}`}
                    onClick={() => setActiveTab('Faturado')}
                    style={activeTab === 'Faturado' ? { background: 'var(--warning)', color: 'white', padding: '0.5rem 1rem', borderRadius: '8px' } : { padding: '0.5rem 1rem' }}
                >
                    Faturados
                </button>
            </div>

            <div className="orders-table glass">
                <table>
                    <thead>
                        <tr>
                            <th onClick={() => handleSort('created_at')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    Data
                                    <ArrowUpDown size={14} style={{ opacity: sortColumn === 'created_at' ? 1 : 0.3 }} />
                                </div>
                            </th>
                            <th onClick={() => handleSort('id')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    ID do Pedido
                                    <ArrowUpDown size={14} style={{ opacity: sortColumn === 'id' ? 1 : 0.3 }} />
                                </div>
                            </th>
                            <th onClick={() => handleSort('customer_name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    Cliente
                                    <ArrowUpDown size={14} style={{ opacity: sortColumn === 'customer_name' ? 1 : 0.3 }} />
                                </div>
                            </th>
                            <th onClick={() => handleSort('total')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    Total
                                    <ArrowUpDown size={14} style={{ opacity: sortColumn === 'total' ? 1 : 0.3 }} />
                                </div>
                            </th>
                            <th>NF Assinada</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>Carregando...</td></tr>
                        ) : orders.length === 0 ? (
                            <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>Nenhum pedido encontrado nesta categoria.</td></tr>
                        ) : [...orders].sort((a, b) => {
                            let aVal, bVal;

                            switch (sortColumn) {
                                case 'created_at':
                                    aVal = new Date(a.created_at);
                                    bVal = new Date(b.created_at);
                                    break;
                                case 'id':
                                    aVal = a.id;
                                    bVal = b.id;
                                    break;
                                case 'customer_name':
                                    aVal = a.customers?.name || '';
                                    bVal = b.customers?.name || '';
                                    break;
                                case 'total':
                                    aVal = parseFloat(a.total) || 0;
                                    bVal = parseFloat(b.total) || 0;
                                    break;
                                default:
                                    return 0;
                            }

                            if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
                            if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
                            return 0;
                        }).map(order => (
                            <tr key={order.id}>
                                <td>{new Date(order.created_at).toLocaleDateString('pt-BR')}</td>
                                <td><strong style={{ fontSize: '0.75rem' }}>{order.id.split('-')[0]}...</strong></td>
                                <td>{order.customers?.name || 'Cliente Removido'}</td>
                                <td>R$ {parseFloat(order.total_amount || 0).toFixed(2)}</td>
                                <td>
                                    {order.signed_nf_url ? (
                                        <a href={order.signed_nf_url} target="_blank" rel="noreferrer" style={{ color: 'var(--success)', fontSize: '0.8rem' }}>Ver NF</a>
                                    ) : (
                                        <span style={{ opacity: 0.5, fontSize: '0.8rem' }}>Pendente</span>
                                    )}
                                </td>
                                <td>
                                    <div className="table-actions">
                                        <button
                                            className="action-btn"
                                            title="Baixar PDF"
                                            onClick={() => downloadOrderPDF(order)}
                                        >
                                            <Download size={16} />
                                        </button>

                                        {order.status === 'Reservado' && (
                                            <>
                                                <button
                                                    className="action-btn"
                                                    title="Editar Pedido"
                                                    onClick={() => router.push(`/orders/new?edit=${order.id}`)}
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    className="btn secondary sm"
                                                    onClick={() => handleUpdateStatus(order.id, 'Entregue')}
                                                    title="Marcar como Entregue"
                                                >
                                                    Entregue
                                                </button>
                                            </>
                                        )}
                                        {order.status === 'Entregue' && (
                                            <>
                                                <button
                                                    className="btn primary sm"
                                                    onClick={() => openNFModal(order)}
                                                    title="Anexar NF"
                                                >
                                                    <FileText size={14} /> NF
                                                </button>
                                                <button
                                                    className="btn secondary sm"
                                                    onClick={() => handleUpdateStatus(order.id, 'Faturado')}
                                                    title="Faturar"
                                                >
                                                    Faturar
                                                </button>
                                            </>
                                        )}
                                        <button
                                            className="action-btn"
                                            title="Ver Detalhes"
                                            onClick={() => openDetailsModal(order)}
                                        >
                                            <Eye size={16} />
                                        </button>
                                        <button className="action-btn" title="Mais Opções"><MoreVertical size={16} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* NF Link Modal */}
            {showNFModal && (
                <div className="modal-overlay">
                    <div className="modal-content glass anim-scale-up" style={{ maxWidth: '400px' }}>
                        <h3>Anexar NF Assinada</h3>
                        <p style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>Cole o link para a nota fiscal assinada.</p>
                        <input
                            type="text"
                            className="qty-input"
                            style={{ width: '100%', marginBottom: '1.5rem', textAlign: 'left' }}
                            placeholder="Link da nota fiscal (ex: Google Drive, Dropbox...)"
                            value={nfUrl}
                            onChange={(e) => setNfUrl(e.target.value)}
                        />
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                            <button className="btn ghost" onClick={() => setShowNFModal(false)}>Cancelar</button>
                            <button
                                className="btn primary"
                                onClick={() => handleUpdateStatus(currentOrder.id, 'Entregue', { signed_nf_url: nfUrl })}
                            >
                                Salvar NF
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Order Details Modal */}
            {showDetailsModal && orderDetails && (
                <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
                    <div className="modal-content glass anim-scale-up" style={{ maxWidth: '700px', maxHeight: '80vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Detalhes do Pedido</h2>
                            <button className="close-btn" onClick={() => setShowDetailsModal(false)}>&times;</button>
                        </div>

                        <div className="modal-body">
                            {/* Order Info */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                                <div>
                                    <p style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.25rem' }}>ID do Pedido</p>
                                    <p style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{orderDetails.id.split('-')[0]}...</p>
                                </div>
                                <div>
                                    <p style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.25rem' }}>Data</p>
                                    <p style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{new Date(orderDetails.created_at).toLocaleDateString('pt-BR')}</p>
                                </div>
                                <div>
                                    <p style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.25rem' }}>Cliente</p>
                                    <p style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{orderDetails.customers?.name || 'N/A'}</p>
                                </div>
                                <div>
                                    <p style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.25rem' }}>Status</p>
                                    <span className="status-badge" style={{ background: getStatusColor(orderDetails.status), padding: '0.25rem 0.75rem', borderRadius: '12px', fontSize: '0.8rem' }}>
                                        {orderDetails.status}
                                    </span>
                                </div>
                            </div>

                            {/* Products Table */}
                            <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Produtos</h3>
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                        <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.85rem' }}>Produto</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.85rem' }}>Qtd</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.85rem' }}>Preço Unit.</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.85rem' }}>Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orderDetails.products.map((item, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '0.75rem' }}>
                                                <div>
                                                    <p style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>{item.products?.name || 'Produto Removido'}</p>
                                                    <p style={{ fontSize: '0.75rem', opacity: 0.6 }}>{item.products?.sku || 'N/A'}</p>
                                                </div>
                                            </td>
                                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                                {item.quantity} {item.products?.unit || 'UN'}
                                            </td>
                                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                                R$ {parseFloat(item.unit_price || 0).toFixed(2)}
                                            </td>
                                            <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold' }}>
                                                R$ {(parseFloat(item.unit_price || 0) * parseInt(item.quantity || 0)).toFixed(2)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr style={{ borderTop: '2px solid rgba(255,255,255,0.2)' }}>
                                        <td colSpan="3" style={{ padding: '1rem', textAlign: 'right', fontWeight: 'bold', fontSize: '1.1rem' }}>
                                            Total:
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--accent)' }}>
                                            R$ {parseFloat(orderDetails.total_amount || 0).toFixed(2)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>

                            {/* Additional Info */}
                            {orderDetails.signed_nf_url && (
                                <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                                    <p style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.5rem' }}>Nota Fiscal</p>
                                    <a href={orderDetails.signed_nf_url} target="_blank" rel="noreferrer" className="btn secondary sm">
                                        <FileText size={14} /> Ver NF Assinada
                                    </a>
                                </div>
                            )}
                        </div>

                        <div className="modal-footer" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                            <button className="btn secondary" onClick={() => setShowDetailsModal(false)}>Fechar</button>
                            <button className="btn primary" onClick={() => downloadOrderPDF(orderDetails)}>
                                <Download size={14} /> Baixar PDF
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
