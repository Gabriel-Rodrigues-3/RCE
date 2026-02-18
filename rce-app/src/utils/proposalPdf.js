import jsPDF from 'jspdf';

/**
 * Generates a professional business proposal PDF for RCE Papelaria
 * @param {Object} proposalData - The data for the proposal
 */
export const generateProposalPDF = (proposalData) => {
    const { client, items, validity, terms, totalAmount } = proposalData;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header - Company Info
    doc.setFillColor(0, 51, 102); // Deep Blue
    doc.rect(0, 0, pageWidth, 40, 'F');

    // Add Logo
    try {
        // Logo is in public folder, accessible via /logo-rce.png
        doc.addImage('/logo-rce.png', 'PNG', 15, 8, 25, 25);
    } catch (e) {
        console.warn('Logo not found, skipping...');
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont(undefined, 'bold');
    doc.text('RCE PAPELARIA', 45, 22);

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text('Soluções em Papelaria e Suprimentos para Órgãos Públicos', 45, 29);
    doc.text('Licitações | Atas de Registro de Preços | Contratos Diretos', 45, 34);

    // Client Header
    let y = 55;
    doc.setTextColor(0);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('PROPOSTA COMERCIAL', 20, y);

    y += 10;
    doc.setDrawColor(0, 51, 102);
    doc.setLineWidth(0.5);
    doc.line(20, y, pageWidth - 20, y);

    y += 10;
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('CLIENTE / ÓRGÃO:', 20, y);
    doc.setFont(undefined, 'normal');
    const clientName = client?.name || 'Cliente não identificado';
    doc.text(clientName, 55, y);

    if (client?.contract_number) {
        y += 6;
        doc.setFont(undefined, 'bold');
        doc.text('CONTRATO (PE):', 20, y);
        doc.setFont(undefined, 'normal');
        doc.text(client.contract_number, 55, y);
    }

    y += 6;
    doc.setFont(undefined, 'bold');
    doc.text('DATA DE EMISSÃO:', 20, y);
    doc.setFont(undefined, 'normal');
    doc.text(new Date().toLocaleDateString('pt-BR'), 55, y);

    // Items Table Header
    y += 15;
    doc.setFillColor(245, 245, 245);
    doc.rect(20, y - 5, pageWidth - 40, 8, 'F');
    doc.setFont(undefined, 'bold');
    doc.text('PRODUTO', 25, y);
    doc.text('MARCA', 100, y);
    doc.text('QTD', 135, y);
    doc.text('UNIT.', 155, y);
    doc.text('TOTAL', 180, y, { align: 'right' });

    // Items List
    y += 10;
    doc.setFont(undefined, 'normal');

    items.forEach((item) => {
        if (y > 260) {
            doc.addPage();
            y = 20;
        }

        const productName = item.name;
        // Handle long names
        const splitName = doc.splitTextToSize(productName, 70);
        const price = Number(item.price) || 0;
        const qty = Number(item.quantity) || 0;
        const rowTotal = price * qty;

        doc.text(splitName, 25, y);
        doc.text(item.brand || '-', 100, y);
        doc.text(qty.toString(), 135, y);
        doc.text(`R$ ${price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 155, y);
        doc.text(`R$ ${rowTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 180, y, { align: 'right' });

        y += (splitName.length * 6) + 2;
        doc.setDrawColor(240);
        doc.line(20, y - 4, pageWidth - 20, y - 4);
    });

    // Total
    y += 10;
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(`VALOR TOTAL DA PROPOSTA: R$ ${Number(totalAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, pageWidth - 20, y, { align: 'right' });

    // Footer / Terms
    y += 20;
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('CONDIÇÕES GERAIS:', 20, y);

    y += 8;
    doc.setFont(undefined, 'normal');
    doc.text(`Validade da Proposta: ${validity || '15 dias'}`, 20, y);

    y += 6;
    doc.text(`Prazo de Entrega: ${terms || 'A combinar'}`, 20, y);

    y += 6;
    doc.text('Pagamento: Conforme edital / empenho', 20, y);

    // Signature
    y += 30;
    doc.line(70, y, 140, y);
    doc.setFontSize(9);
    doc.text('Responsável Comercial', 105, y + 5, { align: 'center' });

    // Save
    const fileName = `Proposta_${(clientName || 'Desconhecido').replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`;
    doc.save(fileName);
};
