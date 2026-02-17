
import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, Category, AIAdvice, BudgetSuggestion, CategorySuggestion } from "../types";

export const getFinancialAdvice = async (
  transactions: Transaction[],
  categories: Category[]
): Promise<AIAdvice> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const summaryData = transactions.map(t => ({
    date: t.date,
    amount: t.amount,
    typeId: t.typeId,
    category: categories.find(c => c.id === t.categoryId)?.name || 'Unknown'
  }));

  const prompt = `
    Act as a professional financial advisor. Analyze the transaction data and provide clear, actionable budgeting advice.
    The tone should be professional, precise, and supportive. If the user has military-specific pay categories (BAH, BAS, etc.), factor those in accordingly.
    
    Categories and their budgets:
    ${categories.map(c => `${c.name}: $${c.budget}`).join('\n')}

    Transaction History:
    ${JSON.stringify(summaryData)}

    Provide a summary of their current state, 3 actionable tips to improve their financial position, and any alerts if they are significantly over budget.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            tips: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            alerts: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ['summary', 'tips', 'alerts']
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    return result as AIAdvice;
  } catch {
    return {
      summary: "Connection to the advisor service is temporarily unavailable. Please check your network and try again.",
      tips: [],
      alerts: []
    };
  }
};

export const getBudgetSuggestions = async (
  transactions: Transaction[],
  categories: Category[]
): Promise<BudgetSuggestion[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const history = transactions.map(t => ({
    amount: t.amount,
    typeId: t.typeId,
    categoryId: t.categoryId,
    categoryName: categories.find(c => c.id === t.categoryId)?.name || 'Unknown',
    date: t.date
  }));

  const prompt = `
    Based on the transaction history, suggest a realistic monthly budget for each category.
    Encourage improvement without setting unattainable goals.
    
    Current Categories:
    ${categories.map(c => `ID: ${c.id}, Name: ${c.name}, Current Budget: $${c.budget}`).join('\n')}

    Transaction History:
    ${JSON.stringify(history)}

    Return a list of suggestions.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              categoryId: { type: Type.STRING },
              suggestedAmount: { type: Type.NUMBER },
              reason: { type: Type.STRING }
            },
            required: ['categoryId', 'suggestedAmount', 'reason']
          }
        }
      }
    });

    const result = JSON.parse(response.text || '[]');
    return result as BudgetSuggestion[];
  } catch {
    return [];
  }
};

export const extractReceiptData = async (
  imageBase64: string
): Promise<{ merchant?: string; amount?: number; date?: string; description?: string }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    Analyze this receipt image and extract the following information:
    - Merchant/store name
    - Total amount (the final total, not subtotal)
    - Date of transaction (in YYYY-MM-DD format)
    - A brief description of what was purchased

    If any information cannot be determined from the image, return null for that field.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: imageBase64.split(',')[1] // Remove data:image/jpeg;base64, prefix
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            merchant: { type: Type.STRING, nullable: true },
            amount: { type: Type.NUMBER, nullable: true },
            date: { type: Type.STRING, nullable: true },
            description: { type: Type.STRING, nullable: true }
          }
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    return result;
  } catch {
    throw new Error("Failed to extract receipt data");
  }
};

export const suggestCategory = async (
  description: string,
  merchant: string | undefined,
  amount: number,
  categories: Category[],
  recentTransactions: Transaction[]
): Promise<CategorySuggestion[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const categoryList = categories.map(c => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
    type: c.type
  }));

  const recentHistory = recentTransactions
    .slice(0, 50) // Last 50 transactions
    .map(t => ({
      description: t.description,
      merchant: t.merchant,
      categoryId: t.categoryId,
      categoryName: categories.find(c => c.id === t.categoryId)?.name
    }));

  const prompt = `
    Suggest the most appropriate budget category for this transaction.

    Transaction Details:
    - Description: ${description}
    - Merchant: ${merchant || 'Unknown'}
    - Amount: $${amount}

    Available Categories:
    ${JSON.stringify(categoryList)}

    Recent Transaction History (for learning user patterns):
    ${JSON.stringify(recentHistory)}

    Return up to 3 category suggestions ranked by confidence (0-1), with reasoning for each suggestion.
    Consider the merchant name, transaction description, amount, and user's historical categorization patterns.
    Be specific and confident - use the merchant name and common sense to categorize accurately.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              categoryId: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
              reason: { type: Type.STRING }
            },
            required: ['categoryId', 'confidence', 'reason']
          }
        }
      }
    });

    const result = JSON.parse(response.text || '[]');
    return result as CategorySuggestion[];
  } catch {
    return [];
  }
};

// Batch category suggestions for multiple transactions (more efficient)
export const suggestCategoriesBatch = async (
  transactions: Array<{ description: string; merchant?: string; amount: number }>,
  categories: Category[],
  recentTransactions: Transaction[]
): Promise<Map<string, CategorySuggestion[]>> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const categoryList = categories.map(c => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
    type: c.type
  }));

  const recentHistory = recentTransactions
    .slice(0, 30) // Last 30 transactions
    .map(t => ({
      description: t.description,
      merchant: t.merchant,
      categoryId: t.categoryId,
      categoryName: categories.find(c => c.id === t.categoryId)?.name
    }));

  // Create a key for each transaction
  const transactionKeys = transactions.map(t => t.merchant || t.description);

  const prompt = `
    Analyze these transactions and suggest the most appropriate budget category for each.
    Return suggestions as an array where each item contains the transaction key (merchant or description) and up to 2 category suggestions.

    Transactions to categorize:
    ${transactions.map((t, i) => `
    ${i + 1}. Key: "${transactionKeys[i]}"
       - Description: ${t.description}
       - Merchant: ${t.merchant || 'Unknown'}
       - Amount: $${t.amount}
    `).join('\n')}

    Available Categories:
    ${JSON.stringify(categoryList)}

    Recent Transaction History (for learning patterns):
    ${JSON.stringify(recentHistory)}

    Be specific and confident. Use merchant names and common sense. Consider:
    - Starbucks, McDonald's, restaurants → Dining
    - Walmart, Target, grocery stores → Groceries
    - Shell, Chevron, gas stations → Gas/Transportation
    - Netflix, Spotify, streaming → Entertainment
    - Amazon could be Shopping, depending on amount/description
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              transactionKey: { type: Type.STRING },
              suggestions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    categoryId: { type: Type.STRING },
                    confidence: { type: Type.NUMBER },
                    reason: { type: Type.STRING }
                  },
                  required: ['categoryId', 'confidence', 'reason']
                }
              }
            },
            required: ['transactionKey', 'suggestions']
          }
        }
      }
    });

    const result = JSON.parse(response.text || '[]');

    // Convert to Map for easy lookup
    const suggestionsMap = new Map<string, CategorySuggestion[]>();
    result.forEach((item: { transactionKey: string; suggestions: CategorySuggestion[] }) => {
      suggestionsMap.set(item.transactionKey, item.suggestions);
    });

    return suggestionsMap;
  } catch {
    return new Map();
  }
};
