import React, { useState } from 'react';
import { BudgetTemplate, Category, CategoryType } from '../types';
import { BUDGET_TEMPLATES } from '../constants';
import { Check, Info, Zap, DollarSign, Target, TrendingUp } from 'lucide-react';

interface BudgetTemplatesProps {
  categories: Category[];
  monthlyIncome: number;
  onApplyTemplate: (newCategories: Category[]) => void;
  onClose: () => void;
}

export default function BudgetTemplates({
  categories,
  monthlyIncome,
  onApplyTemplate,
  onClose
}: BudgetTemplatesProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<BudgetTemplate | null>(null);
  const [customIncome, setCustomIncome] = useState(monthlyIncome.toString());
  const [previewCategories, setPreviewCategories] = useState<Category[]>([]);

  const handleTemplateSelect = (template: BudgetTemplate) => {
    setSelectedTemplate(template);
    generatePreview(template, parseFloat(customIncome) || monthlyIncome);
  };

  const generatePreview = (template: BudgetTemplate, income: number) => {
    const newCategories: Category[] = template.categories.map((cat, index) => {
      const budgetAmount = (income * cat.percentage) / 100;

      return {
        id: `cat-${Date.now()}-${index}`,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        budget: Math.round(budgetAmount),
        type: cat.type,
        initialBalance: cat.type === CategoryType.DEBT ? Math.round(budgetAmount) : undefined
      };
    });

    setPreviewCategories(newCategories);
  };

  const handleIncomeChange = (value: string) => {
    setCustomIncome(value);
    if (selectedTemplate) {
      const income = parseFloat(value) || 0;
      generatePreview(selectedTemplate, income);
    }
  };

  const handleApply = () => {
    if (previewCategories.length > 0) {
      if (confirm('This will replace your current budget categories. Continue?')) {
        onApplyTemplate(previewCategories);
      }
    }
  };

  const getTemplateIcon = (targetAudience?: string) => {
    switch (targetAudience) {
      case 'Military': return '🎖️';
      case 'Saver': return '💎';
      case 'Debt Payoff': return '💪';
      default: return '📊';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-wide mb-2">BUDGET TEMPLATES</h2>
            <p className="text-gray-600">Choose a proven budget framework and customize it to your income</p>
          </div>

          {/* Income Input */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-6">
            <label className="block text-sm font-bold text-blue-900 mb-2">YOUR MONTHLY INCOME</label>
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-blue-600" />
              <input
                type="number"
                value={customIncome}
                onChange={(e) => handleIncomeChange(e.target.value)}
                className="flex-1 px-4 py-2 border-2 border-blue-300 rounded-lg text-lg font-bold focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="5000"
              />
            </div>
            <p className="text-sm text-blue-700 mt-2">
              Templates will calculate budget amounts based on this income
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Template Selection */}
            <div className="space-y-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Target className="w-5 h-5" />
                SELECT TEMPLATE
              </h3>

              {BUDGET_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleTemplateSelect(template)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    selectedTemplate?.id === template.id
                      ? 'border-blue-500 bg-blue-50 shadow-lg'
                      : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-3xl">{getTemplateIcon(template.targetAudience)}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-bold text-lg">{template.name}</h4>
                        {template.targetAudience && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                            {template.targetAudience}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{template.description}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {template.categories.slice(0, 5).map((cat, idx) => (
                          <span key={idx} className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {cat.icon} {cat.name}
                          </span>
                        ))}
                        {template.categories.length > 5 && (
                          <span className="text-xs text-gray-500 px-2 py-1">
                            +{template.categories.length - 5} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Preview */}
            <div className="space-y-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                PREVIEW
              </h3>

              {selectedTemplate ? (
                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-xl p-6">
                    <h4 className="font-bold text-lg mb-4">{selectedTemplate.name}</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-100">Monthly Income</span>
                        <span className="font-bold">${parseFloat(customIncome || '0').toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-100">Categories</span>
                        <span className="font-bold">{previewCategories.length}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4 max-h-96 overflow-y-auto space-y-2">
                    {previewCategories.map((cat) => {
                      const templateCat = selectedTemplate.categories.find(tc => tc.name === cat.name);
                      return (
                        <div
                          key={cat.id}
                          className="bg-white rounded-lg p-3 border border-gray-200"
                          style={{ borderLeftWidth: '4px', borderLeftColor: cat.color }}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{cat.icon}</span>
                              <span className="font-bold">{cat.name}</span>
                            </div>
                            <span className="font-bold text-lg">${cat.budget.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-gray-600">
                            <span className="uppercase font-medium">{cat.type}</span>
                            <span>{templateCat?.percentage}% of income</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 flex gap-3">
                    <Info className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                    <div className="text-sm text-yellow-800">
                      <p className="font-bold mb-1">Important</p>
                      <p>Applying this template will <strong>replace all your current categories</strong>. Your existing transactions will remain, but may need to be recategorized.</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleApply}
                      className="flex-1 bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-700 transition-colors font-bold flex items-center justify-center gap-2"
                    >
                      <Zap className="w-5 h-5" />
                      Apply Template
                    </button>
                    <button
                      onClick={onClose}
                      className="px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-100 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-xl p-12 text-center">
                  <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h4 className="font-bold text-gray-900 mb-2">Select a Template</h4>
                  <p className="text-gray-600">Choose a budget template from the left to see the preview</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Comparison */}
          <div className="mt-6 bg-slate-50 rounded-xl p-4">
            <h4 className="font-bold text-sm text-slate-900 mb-3">TEMPLATE COMPARISON</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <p className="font-bold text-blue-600 mb-1">Best for Beginners</p>
                <p className="text-gray-600">50/30/20 Rule - Simple and balanced</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <p className="font-bold text-green-600 mb-1">Maximum Savings</p>
                <p className="text-gray-600">Aggressive Saver - 40% to savings/investments</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <p className="font-bold text-red-600 mb-1">Debt Elimination</p>
                <p className="text-gray-600">Debt Crusher - 40% to debt payoff</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
