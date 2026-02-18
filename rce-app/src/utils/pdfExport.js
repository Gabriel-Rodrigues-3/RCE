import jsPDF from 'jspdf';

export const generateOrderPDF = async (order, client, items) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Load logo as base64
    const logoUrl = '/logo-rce.png';

    const loadImage = (url) => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = reject;
            img.src = url;
        });
    };

    let logoData = null;
    try {
        logoData = await loadImage(logoUrl);
    } catch (e) {
        console.error("Logo failed to load, using text fallback");
    }

    const addHeader = () => {
        if (logoData) {
            doc.addImage(logoData, 'PNG', 20, 10, 45, 25);
        } else {
            doc.setFontSize(24);
            doc.setTextColor(0, 51, 102);
            doc.setFont(undefined, 'bold');
            doc.text('RCE', 20, 25);
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.text('PAPELARIA', 20, 30);
        }

        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text('CONFIRMAÇÃO DE PEDIDO', pageWidth - 20, 25, { align: 'right' });

        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`ID: ${order.id}`, pageWidth - 20, 32, { align: 'right' });
        doc.text(`Data: ${new Date(order.created_at || new Date()).toLocaleDateString('pt-BR')}`, pageWidth - 20, 37, { align: 'right' });
    };

    const addClientInfo = () => {
        doc.setDrawColor(230);
        doc.setLineWidth(0.5);
        doc.line(20, 45, pageWidth - 20, 45);

        doc.setFontSize(11);
        doc.setTextColor(0);
        doc.setFont(undefined, 'bold');
        doc.text('DADOS DO CLIENTE', 20, 55);

        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        doc.text(`Nome/Razão Social: ${client?.name || 'Não informado'}`, 20, 62);
    };

    const addTable = () => {
        let y = 80;

        // Header
        doc.setFillColor(0, 51, 102);
        doc.rect(20, y - 5, pageWidth - 40, 8, 'F');
        doc.setTextColor(255);
        doc.setFont(undefined, 'bold');
        doc.setFontSize(9);
        doc.text('PRODUTO', 25, y);
        doc.text('MARCA', 95, y);
        doc.text('QUANT.', 130, y);
        doc.text('UNIT.', 155, y);
        doc.text('TOTAL', 180, y, { align: 'right' });

        doc.setTextColor(0);
        doc.setFont(undefined, 'normal');
        y += 10;

        items.forEach((item, index) => {
            if (y > 270) {
                doc.addPage();
                y = 20;
            }

            const prod = Array.isArray(item.products) ? item.products[0] : item.products;
            const prodName = item.name || prod?.name || 'Produto';
            const brand = item.custom_brand || prod?.brand || 'Genérico';
            const qty = item.quantity || 0;
            const price = parseFloat(item.unit_price || item.price || 0);
            const subtotal = qty * price;

            const splitName = doc.splitTextToSize(prodName, 65);
            doc.text(splitName, 25, y);

            const splitBrand = doc.splitTextToSize(brand, 30);
            doc.text(splitBrand, 95, y);

            const lineOffset = Math.max((splitName.length - 1) * 4, (splitBrand.length - 1) * 4);
            doc.text(`${qty}`, 130, y);
            doc.text(`R$ ${price.toFixed(2)}`, 155, y);
            doc.text(`R$ ${subtotal.toFixed(2)}`, 180, y, { align: 'right' });

            y += 8 + lineOffset;
            doc.setDrawColor(245);
            doc.line(20, y - 4, pageWidth - 20, y - 4);
        });

        y += 10;
        doc.setDrawColor(0, 51, 102);
        doc.setLineWidth(1);
        doc.line(140, y, 190, y);

        y += 8;
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('TOTAL GERAL:', 140, y);
        const totalAmount = parseFloat(order.total_amount || 0);
        doc.text(`R$ ${totalAmount.toFixed(2)}`, 190, y, { align: 'right' });
    };

    addHeader();
    addClientInfo();
    addTable();

    doc.save(`Pedido_RCE_${order.id.split('-')[0]}.pdf`);
};
