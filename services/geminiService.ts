import { GoogleGenAI, Type } from "@google/genai";
import { Product, LogisticsAnalysis } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const analyzeLogistics = async (product: Product): Promise<LogisticsAnalysis> => {
  if (!apiKey) {
    console.warn("API Key not found");
    return {
      category: "Erro de Configuração",
      estimatedCost: "R$ 0,00",
      volumetricWeight: 0,
      warnings: ["Configure a API Key para usar a IA."],
      packingTips: "Sem dicas disponíveis.",
      isOptimized: false
    };
  }

  const prompt = `
    Atue como um especialista em logística do Mercado Livre (Mercado Envíos) no Brasil.
    Analise o seguinte produto:
    Nome: ${product.title}
    Preço: R$ ${product.price}
    Dimensões: ${product.dimensions.height}cm (A) x ${product.dimensions.width}cm (L) x ${product.dimensions.length}cm (C)
    Peso Real: ${product.weight} kg

    Tarefas:
    1. Calcule o peso cúbico (fator 167 ou regra padrão dos correios/transportadoras BR).
    2. Determine se o produto se enquadra no Mercado Envíos Tradicional, Flex, ou se requer transportadora especial (dimensões excedentes).
    3. Estime um custo de frete médio para uma entrega interestadual (ex: SP para RJ).
    4. Verifique se as dimensões são eficientes ou se há desperdício de embalagem.
    5. Dê dicas de como embalar para reduzir custos ou evitar avarias.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING, description: "Categoria de envio (ex: Mercado Envíos Coleta, Flex, Transportadora)" },
            estimatedCost: { type: Type.STRING, description: "Custo estimado formatado em BRL" },
            volumetricWeight: { type: Type.NUMBER, description: "Peso volumétrico calculado em kg" },
            warnings: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Alertas sobre limites excedidos ou riscos" },
            packingTips: { type: Type.STRING, description: "Dica curta de embalagem" },
            isOptimized: { type: Type.BOOLEAN, description: "Se as dimensões parecem otimizadas" }
          },
          required: ["category", "estimatedCost", "volumetricWeight", "warnings", "packingTips", "isOptimized"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Sem resposta da IA");
    
    return JSON.parse(text) as LogisticsAnalysis;

  } catch (error) {
    console.error("Erro na análise logística:", error);
    return {
      category: "Indefinido",
      estimatedCost: "R$ --,--",
      volumetricWeight: 0,
      warnings: ["Erro ao conectar com a IA."],
      packingTips: "Tente novamente.",
      isOptimized: false
    };
  }
};