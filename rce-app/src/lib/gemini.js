import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY);

/**
 * Extracts client and product information from 'Ata' documents using Gemini.
 * @param {File} file - The document file (PDF or Image)
 * @returns {Promise<Object>} - Extracted data in JSON format
 */
export async function extractAtaData(file) {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Convert File to base64 for Gemini
    const base64Data = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(file);
    });

    const prompt = `
    Analise este documento de "Ata de Registro de Preços" ou Contrato Público.
    Extraia as seguintes informações em formato JSON estritamente:
    1. Nome do Cliente/Orgão (client_name)
    2. Documento/CNPJ se disponível (document)
    3. Número do Contrato ou PE (contract_number)
    4. Uma lista de produtos (products) contendo:
       - Número do item (item_number)
       - Descrição completa do item no contrato (selection_name)
       - Especificação técnica se houver (selection_description)
       - Marca/Modelo se houver (brand)
       - Quantidade (quantity)
       - Valor Unitário (price)
       - Unidade de medida (unit)

    Retorne APENAS o JSON, sem markdown ou explicações.
  `;

    try {
        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Data,
                    mimeType: file.type
                }
            }
        ]);

        const response = await result.response;
        let text = response.text();

        // Clean up potential markdown blocks from AI response
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        return JSON.parse(text);
    } catch (error) {
        console.error("Gemini Extraction Error:", error);
        throw new Error("Falha ao processar o documento com IA.");
    }
}

/**
 * Extracts items from bidding documents (Editais) for budgeting.
 * @param {File} file - The document file
 * @returns {Promise<Object>} - Extracted items in JSON format
 */
export async function extractEditalData(file) {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const base64Data = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(file);
    });

    const prompt = `
    Analise este Edital de Licitação ou Termo de Referência.
    Extraia a tabela de itens para orçamento em formato JSON estritamente:
    1. Uma lista de produtos (products) contendo:
       - Número do item (item_number) -> APENAS O NÚMERO
       - Descrição completa do item (selection_name)
       - Especificação detalhada (selection_description)
       - Quantidade (quantity) -> APENAS NÚMERO
       - Unidade de medida (unit) -> EX: UN, PCT, CX

    Retorne APENAS o JSON, sem markdown ou explicações. O JSON deve ser um objeto com a chave "products".
  `;

    try {
        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Data,
                    mimeType: file.type
                }
            }
        ]);

        const response = await result.response;
        let text = response.text();
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(text);
    } catch (error) {
        console.error("Gemini Edital Extraction Error:", error);
        throw new Error("Falha ao extrair itens do edital.");
    }
}
