"use client";
import React, { useState, useEffect } from 'react';
import {
    FilePlus,
    Upload,
    Download,
    Trash2,
    AlertTriangle,
    CheckCircle,
    Calendar,
    FileText,
    RefreshCw,
    Search,
    ChevronRight,
    SearchSlash,
    Eye
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { jsPDF } from 'jspdf';
import { PDFDocument } from 'pdf-lib';

export default function DocumentsPage() {
    const [documents, setDocuments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showDeclModal, setShowDeclModal] = useState(false);
    const [selectedDocs, setSelectedDocs] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const [formData, setFormData] = useState({
        title: '',
        expiry_date: '',
        file: null
    });

    const [declData, setDeclData] = useState({
        title: '',
        text: '',
        splitByParagraph: true
    });

    const DECLARATION_HEADER = "A EMPRESA 47.092.461 GABRIEL RODRIGUES ME, INSCRITA SOB Nº DE CNPJ 47.092.461/0001-03 E INSCRIÇÃO ESTADUAL 334.083.950.114 SEDIADA NA RUA FERES SADALLA 478 – CENTRO – GUARIBA – SP, REPRESENTADA PELO SR. GABRIEL RODRIGUES, SOB NUMERO DE CPF 417.884.698-10 E RG 49.604.233-6, DECLARA SOB AS PENAS DA LEI:";

    useEffect(() => {
        fetchDocuments();
    }, []);

    const fetchDocuments = async () => {
        setIsLoading(true);
        const { data, error } = await supabase.from('documents').select('*');
        if (!error) setDocuments(data || []);
        setIsLoading(false);
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!formData.file) {
            alert('Por favor, selecione um arquivo.');
            return;
        }
        setUploading(true);

        try {
            const fileExt = formData.file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
            const filePath = `docs/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('documents')
                .upload(filePath, formData.file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('documents')
                .getPublicUrl(filePath);

            const newDoc = {
                title: formData.title,
                expiry_date: formData.expiry_date,
                file_name: formData.file.name,
                file_type: formData.file.type,
                file_url: publicUrl
            };

            const { error: insertError } = await supabase.from('documents').insert([newDoc]);

            if (insertError) throw insertError;

            setShowUploadModal(false);
            setFormData({ title: '', expiry_date: '', file: null });
            fetchDocuments();
        } catch (error) {
            console.error('Erro no upload:', error);
            alert('Erro ao salvar documento: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleSaveDeclaration = async (e) => {
        e.preventDefault();
        if (!declData.text.trim()) {
            alert('Por favor, insira o texto da declaração.');
            return;
        }
        setUploading(true);

        try {
            const paragraphs = declData.splitByParagraph
                ? declData.text.split('\n').filter(p => p.trim())
                : [declData.text];

            const newDocs = paragraphs.map(p => ({
                title: declData.splitByParagraph && paragraphs.length > 1 ? `${declData.title} - ${p.substring(0, 30)}...` : declData.title,
                content: p,
                expiry_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0], // 1 year default
                file_name: 'Declaração Gerada',
                file_type: 'text/declaration'
            }));

            const { error } = await supabase.from('documents').insert(newDocs);
            if (error) throw error;

            setShowDeclModal(false);
            setDeclData({ title: '', text: '', splitByParagraph: true });
            fetchDocuments();
        } catch (error) {
            console.error('Erro ao salvar declaração:', error);
            alert('Erro ao salvar: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (doc) => {
        if (!confirm('Deseja realmente remover este documento?')) return;

        const { error } = await supabase.from('documents').delete(`id=eq.${doc.id}`);
        if (!error) fetchDocuments();
    };

    const toggleSelect = (id) => {
        setSelectedDocs(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const getDaysRemaining = (expiryDate) => {
        const today = new Date();
        const expiry = new Date(expiryDate);
        const diffTime = expiry - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    const getStatusColor = (expiryDate) => {
        const days = getDaysRemaining(expiryDate);
        if (days < 0) return 'text-danger bg-danger-light';
        if (days <= 5) return 'text-warning bg-warning-light';
        return 'text-success bg-success-light';
    };

    const downloadSelected = async () => {
        const docsToDownload = documents.filter(doc => selectedDocs.includes(doc.id));
        if (docsToDownload.length === 0) return;

        setUploading(true); // Reusing uploading state for processing indication
        try {
            // 1. Create the merged PDF container
            const mergedPdf = await PDFDocument.create();

            // 2. Fetch and Merge each document
            for (const doc of docsToDownload) {
                try {
                    // Handle text declarations
                    if (doc.content) {
                        const textDoc = new jsPDF();
                        const pWidth = textDoc.internal.pageSize.getWidth();

                        // Branded header for declaration
                        textDoc.setFillColor(0, 51, 102);
                        textDoc.rect(0, 0, pWidth, 35, 'F');
                        try { textDoc.addImage('/logo-rce.png', 'PNG', 15, 5, 20, 20); } catch (e) { }
                        textDoc.setTextColor(255);
                        textDoc.setFontSize(18);
                        textDoc.text('RCE PAPELARIA', 40, 18);
                        textDoc.setFontSize(8);
                        textDoc.text('DECLARAÇÃO INSTITUCIONAL', 40, 24);

                        textDoc.setTextColor(0);
                        textDoc.setFontSize(14);
                        textDoc.setFont(undefined, 'bold');
                        textDoc.text(doc.title.toUpperCase(), pWidth / 2, 50, { align: 'center' });

                        textDoc.setFontSize(11);
                        textDoc.setFont(undefined, 'normal');

                        const margin = 20;
                        const maxWidth = pWidth - (margin * 2);

                        let currY = 65;
                        // Header text (bold, left-aligned for proper rendering)
                        textDoc.setFont(undefined, 'bold');
                        const headerLines = textDoc.splitTextToSize(DECLARATION_HEADER, maxWidth);
                        headerLines.forEach((line, idx) => {
                            textDoc.text(line, margin, currY + (idx * 6));
                        });
                        currY += (headerLines.length * 6) + 10;

                        // Content text (normal weight, left-aligned)
                        textDoc.setFont(undefined, 'normal');
                        const contentLines = textDoc.splitTextToSize(doc.content, maxWidth);
                        contentLines.forEach((line, idx) => {
                            textDoc.text(line, margin, currY + (idx * 6));
                        });
                        currY += (contentLines.length * 6) + 20;

                        // Location and date
                        const today = new Date();
                        const dateStr = today.toLocaleDateString('pt-BR');
                        textDoc.setFontSize(11);
                        textDoc.text(`Guariba - SP, ${dateStr}`, pWidth / 2, currY, { align: 'center' });
                        currY += 20;

                        // Signature Placeholder
                        if (currY < 250) {
                            textDoc.line(pWidth / 2 - 40, currY, pWidth / 2 + 40, currY);
                            textDoc.setFontSize(10);
                            textDoc.text('GABRIEL RODRIGUES', pWidth / 2, currY + 5, { align: 'center' });
                            textDoc.text('RCE PAPELARIA', pWidth / 2, currY + 10, { align: 'center' });
                        }

                        const textPdfBytes = textDoc.output('arraybuffer');
                        const textPdfDoc = await PDFDocument.load(textPdfBytes);
                        const pages = await mergedPdf.copyPages(textPdfDoc, textPdfDoc.getPageIndices());
                        pages.forEach(p => mergedPdf.addPage(p));
                        continue;
                    }

                    const response = await fetch(doc.file_url);
                    const fileBytes = await response.arrayBuffer();

                    if (doc.file_type === 'application/pdf' || doc.file_name.toLowerCase().endsWith('.pdf')) {
                        const externalPdf = await PDFDocument.load(fileBytes);
                        const pages = await mergedPdf.copyPages(externalPdf, externalPdf.getPageIndices());
                        pages.forEach(page => mergedPdf.addPage(page));
                    } else if (doc.file_type.startsWith('image/') || /\.(jpg|jpeg|png)$/i.test(doc.file_name)) {
                        // Create a new page for the image
                        const page = mergedPdf.addPage();
                        const { width: pageWidth, height: pageHeight } = page.getSize();

                        let image;
                        if (doc.file_name.toLowerCase().endsWith('.png')) {
                            image = await mergedPdf.embedPng(fileBytes);
                        } else {
                            image = await mergedPdf.embedJpg(fileBytes);
                        }

                        const dims = image.scaleToFit(pageWidth - 40, pageHeight - 40);
                        page.drawImage(image, {
                            x: pageWidth / 2 - dims.width / 2,
                            y: pageHeight / 2 - dims.height / 2,
                            width: dims.width,
                            height: dims.height,
                        });
                    }
                } catch (e) {
                    console.error(`Erro ao processar ${doc.title}:`, e);
                }
            }

            // 4. Save and Download
            const mergedPdfBytes = await mergedPdf.save();
            const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'Habilitacao_RCE_Completa.pdf';
            link.click();

        } catch (error) {
            console.error('Erro ao gerar PDF completo:', error);
            alert('Erro ao gerar PDF completo. Verifique se os links estão acessíveis.');
        } finally {
            setUploading(false);
        }
    };

    const filteredDocs = documents.filter(doc =>
        doc.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleViewDocument = (doc) => {
        if (doc.content) {
            alert(`--- ${doc.title} ---\n\n${DECLARATION_HEADER}\n\n${doc.content}`);
            return;
        }
        if (!doc.file_url) {
            alert('URL do documento não encontrada.');
            return;
        }
        window.open(doc.file_url, '_blank');
    };

    return (
        <div className="documents-container">
            <header className="page-header">
                <div className="header-info">
                    <h1>Documentação</h1>
                    <p>Gerencie certidões, contratos e licenças da RCE Papelaria</p>
                </div>
                <div className="header-actions">
                    {selectedDocs.length > 0 && (
                        <button className="btn secondary flex items-center gap-2" onClick={downloadSelected} disabled={uploading}>
                            {uploading ? <RefreshCw className="animate-spin" size={18} /> : <Download size={18} />}
                            {uploading ? 'Processando...' : `Baixar Habilitação (${selectedDocs.length})`}
                        </button>
                    )}
                    <button className="btn secondary flex items-center gap-2" onClick={() => setShowDeclModal(true)}>
                        <FileText size={18} />
                        Nova Declaração
                    </button>
                    <button className="btn primary flex items-center gap-2" onClick={() => setShowUploadModal(true)}>
                        <FilePlus size={18} />
                        Adicionar Documento
                    </button>
                </div>
            </header>

            <div className="search-bar-v2 glass">
                <Search size={20} />
                <input
                    type="text"
                    placeholder="Pesquisar por título do documento..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="documents-grid glass">
                {isLoading ? (
                    <div className="loading-state">
                        <RefreshCw className="animate-spin" />
                        <span>Carregando documentos...</span>
                    </div>
                ) : filteredDocs.length === 0 ? (
                    <div className="empty-state">
                        <SearchSlash size={48} />
                        <h3>Nenhum documento encontrado</h3>
                        <p>Comece adicionando novos documentos ou mude sua pesquisa.</p>
                    </div>
                ) : (
                    <table className="docs-table">
                        <thead>
                            <tr>
                                <th width="40"><input type="checkbox" onChange={(e) => {
                                    if (e.target.checked) setSelectedDocs(filteredDocs.map(d => d.id));
                                    else setSelectedDocs([]);
                                }} checked={selectedDocs.length === filteredDocs.length && filteredDocs.length > 0} /></th>
                                <th>Documento</th>
                                <th>Vencimento</th>
                                <th>Status</th>
                                <th>Arquivo</th>
                                <th className="text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredDocs.map((doc) => {
                                const daysRemaining = getDaysRemaining(doc.expiry_date);
                                const isCritical = daysRemaining <= 5;
                                return (
                                    <tr key={doc.id} className={isCritical ? 'near-expiry' : ''}>
                                        <td>
                                            <input
                                                type="checkbox"
                                                checked={selectedDocs.includes(doc.id)}
                                                onChange={() => toggleSelect(doc.id)}
                                            />
                                        </td>
                                        <td>
                                            <div className="doc-title">
                                                <FileText size={18} />
                                                <strong>{doc.title}</strong>
                                            </div>
                                        </td>
                                        <td>{new Date(doc.expiry_date).toLocaleDateString('pt-BR')}</td>
                                        <td>
                                            <span className={`status-pill ${getStatusColor(doc.expiry_date)}`}>
                                                {daysRemaining < 0 ? 'Expirado' : daysRemaining <= 5 ? 'Vence em breve' : 'Válido'}
                                                {isCritical && <AlertTriangle size={14} className="ml-2" />}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="file-name-pill">{doc.file_name}</span>
                                        </td>
                                        <td className="text-right">
                                            <div className="actions-cell">
                                                <button className="btn-icon" title="Visualizar" onClick={() => handleViewDocument(doc)}>
                                                    <Eye size={16} />
                                                </button>
                                                <button className="btn-icon" title="Substituir" onClick={() => {
                                                    setFormData({ ...formData, title: doc.title });
                                                    setShowUploadModal(true);
                                                }}>
                                                    <RefreshCw size={16} />
                                                </button>
                                                <button className="btn-icon danger" onClick={() => handleDelete(doc)}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {showUploadModal && (
                <div className="modal-overlay">
                    <div className="modal-content glass login-card" style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h2>Novo Documento</h2>
                            <button className="close-btn" onClick={() => setShowUploadModal(false)}>&times;</button>
                        </div>
                        <form onSubmit={handleUpload}>
                            <div className="form-group">
                                <label>Título do Documento</label>
                                <input
                                    type="text"
                                    required
                                    className="input-field"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="Ex: Certidão Negativa Federal"
                                />
                            </div>
                            <div className="form-group mt-4">
                                <label>Data de Vencimento</label>
                                <input
                                    type="date"
                                    required
                                    className="input-field"
                                    value={formData.expiry_date}
                                    onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                                />
                            </div>
                            <div className="form-group mt-4">
                                <label>Arquivo</label>
                                <div className="upload-dropzone">
                                    <input
                                        type="file"
                                        id="file-upload"
                                        className="hidden"
                                        onChange={(e) => setFormData({ ...formData, file: e.target.files[0] })}
                                    />
                                    <label htmlFor="file-upload" className="upload-label">
                                        {formData.file ? (
                                            <div className="file-preview">
                                                <CheckCircle size={24} color="var(--success)" />
                                                <span>{formData.file.name}</span>
                                            </div>
                                        ) : (
                                            <div className="upload-prompt">
                                                <Upload size={32} color="var(--primary)" />
                                                <span>Clique para selecionar o arquivo</span>
                                            </div>
                                        )}
                                    </label>
                                </div>
                            </div>
                            <div className="modal-actions mt-6">
                                <button type="button" className="btn secondary" onClick={() => setShowUploadModal(false)}>Cancelar</button>
                                <button type="submit" className="btn primary" disabled={uploading}>
                                    {uploading ? 'Salvando...' : 'Salvar Documento'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showDeclModal && (
                <div className="modal-overlay">
                    <div className="modal-content glass login-card" style={{ maxWidth: '600px' }}>
                        <div className="modal-header">
                            <h2>Nova Declaração</h2>
                            <button className="close-btn" onClick={() => setShowDeclModal(false)}>&times;</button>
                        </div>
                        <p className="text-sm text-gray-400 mb-4">
                            Esta declaração incluirá automaticamente o cabeçalho institucional da RCE Papelaria.
                        </p>
                        <form onSubmit={handleSaveDeclaration}>
                            <div className="form-group">
                                <label>Título da Declaração</label>
                                <input
                                    type="text"
                                    required
                                    className="input-field"
                                    value={declData.title}
                                    onChange={(e) => setDeclData({ ...declData, title: e.target.value })}
                                    placeholder="Ex: Declaração de Microempresa"
                                />
                            </div>
                            <div className="form-group mt-4">
                                <label>Texto da Declaração</label>
                                <textarea
                                    required
                                    className="input-field"
                                    rows={8}
                                    style={{ resize: 'vertical', minHeight: '150px' }}
                                    value={declData.text}
                                    onChange={(e) => setDeclData({ ...declData, text: e.target.value })}
                                    placeholder="Insira o texto aqui. Se houver vários parágrafos, selecione a opção abaixo para dividir."
                                />
                            </div>
                            <div className="form-group mt-4 flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="split-par"
                                    checked={declData.splitByParagraph}
                                    onChange={(e) => setDeclData({ ...declData, splitByParagraph: e.target.checked })}
                                />
                                <label htmlFor="split-par" className="cursor-pointer">Dividir parágrafos em declarações individuais</label>
                            </div>
                            <div className="modal-actions mt-6">
                                <button type="button" className="btn secondary" onClick={() => setShowDeclModal(false)}>Cancelar</button>
                                <button type="submit" className="btn primary" disabled={uploading}>
                                    {uploading ? 'Salvando...' : 'Salvar Declaração'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
