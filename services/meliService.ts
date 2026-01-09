import { Product, MeliUser } from "../types";

const BASE_URL = 'https://api.mercadolibre.com';

// Função auxiliar para cabeçalhos
const getHeaders = (token: string) => ({
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json',
  // Tentar forçar aceitação de JSON para evitar alguns erros de MIME
  'Accept': 'application/json'
});

// 1. Obter dados do Usuário (Vendedor)
export const getMeliUser = async (token: string): Promise<MeliUser> => {
  try {
    const response = await fetch(`${BASE_URL}/users/me`, {
      headers: getHeaders(token)
    });
    
    if (!response.ok) {
      if (response.status === 401) throw new Error('Token inválido ou expirado (401).');
      if (response.status === 403) throw new Error('Acesso negado (403). Verifique escopos.');
      throw new Error(`Erro API MeLi: ${response.status}`);
    }
    
    return await response.json();
  } catch (error: any) {
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Falha de Rede/CORS. O navegador bloqueou a requisição direta ao Mercado Livre.');
    }
    throw error;
  }
};

// 2. Buscar IDs dos anúncios do vendedor
export const getSellerItems = async (token: string, userId: number): Promise<string[]> => {
  try {
    const response = await fetch(`${BASE_URL}/users/${userId}/items/search?status=active&limit=50`, {
      headers: getHeaders(token)
    });
    
    if (!response.ok) throw new Error('Erro ao buscar lista de anúncios.');
    
    const data = await response.json();
    return data.results || [];
  } catch (error: any) {
    console.error("Erro getSellerItems:", error);
    throw error;
  }
};

// 3. Buscar detalhes completos dos itens
export const getItemDetails = async (token: string, itemIds: string[]): Promise<Product[]> => {
  if (itemIds.length === 0) return [];

  const idsString = itemIds.slice(0, 20).join(','); 
  
  try {
    const response = await fetch(`${BASE_URL}/items?ids=${idsString}`, {
      headers: getHeaders(token)
    });

    if (!response.ok) throw new Error('Erro ao buscar detalhes dos produtos.');

    const data = await response.json();

    return data.map((itemWrapper: any) => {
      // items?ids retorna array de objetos { code: 200, body: {...} }
      const item = itemWrapper.body;
      
      let dimensions = { height: 0, width: 0, length: 0 };
      let weight = 0;

      if (item.shipping?.dimensions) {
        // Formato esperado: "height x width x length, weight"
        const parts = item.shipping.dimensions.split(',');
        if (parts.length === 2) {
          const dims = parts[0].split('x');
          weight = parseInt(parts[1]) / 1000; // converter gramas para kg
          if (dims.length === 3) {
            dimensions = {
              height: parseInt(dims[0]),
              width: parseInt(dims[1]),
              length: parseInt(dims[2])
            };
          }
        }
      }

      return {
        id: item.id,
        title: item.title,
        sku: item.attributes?.find((a: any) => a.id === 'SELLER_SKU')?.value_name || 'SEM-SKU',
        price: item.price,
        dimensions: dimensions,
        weight: weight,
        mlStatus: item.status === 'active' ? 'active' : 'paused',
        shippingMode: item.shipping?.mode || 'custom',
        lastSync: new Date().toLocaleTimeString(),
        thumbnail: item.thumbnail,
        permalink: item.permalink
      } as Product;
    });
  } catch (error) {
    console.error("Erro getItemDetails:", error);
    throw error;
  }
};

// 4. Atualizar Dimensões (O que muda o frete)
export const updateItemDimensions = async (token: string, product: Product) => {
  // Convertemos kg de volta para gramas para o Mercado Livre
  const weightInGrams = Math.round(product.weight * 1000);
  const dimString = `${product.dimensions.height}x${product.dimensions.width}x${product.dimensions.length},${weightInGrams}`;
  
  const body = {
    shipping: {
      dimensions: dimString,
      // mode: 'me2' // Geralmente mantemos o mode existente, a menos que queira forçar
    }
  };

  const response = await fetch(`${BASE_URL}/items/${product.id}`, {
    method: 'PUT',
    headers: getHeaders(token),
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error("Erro MeLi API:", errorData);
    throw new Error('Falha ao atualizar dimensões no Mercado Livre.');
  }

  return await response.json();
};