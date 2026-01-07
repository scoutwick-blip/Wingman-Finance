
import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, Category, AIAdvice, BudgetSuggestion } from "../types";

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
    Act as a professional financial advisor for a member of the Air Force. Analyze the transaction data and provide clear, actionable budgeting advice.
    The tone should be professional, precise, and supportive—like a reliable wingman. Avoid over-the-top military slang, but understand military-specific pay structures (BAH, BAS, etc.).
    
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
  } catch (error) {
    console.error("Error getting AI advice:", error);
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
  } catch (error) {
    console.error("Error getting budget suggestions:", error);
    return [];
  }
};
