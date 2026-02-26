import React, { useState } from 'react';
import { BudgetTemplate, Category, CategoryType } from '../types';
import { BUDGET_TEMPLATES } from '../constants';
import { Check, Info, Zap, DollarSign, Target, TrendingUp, X } from 'lucide-react';

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
      <div className="rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
        <div className="p-6">
          {/* Header */}
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-semibold uppercase tracking-wide mb-2"
                style={{ color: 'var(--color-text-primary)' }}>BUDGET TEMPLATES</h2>
              <p style={{ color: 'var(--color-text-secondary)' }}>Choose a proven budget framework and customize it to your income</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:text-red-600 rounded-xl transition-all shadow-sm flex-shrink-0"
              style={{ border: '2px solid var(--color-border-card)', backgroundColor: 'var(--color-bg-card)' }}
              aria-label="Close"
              title="Close"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Income Input */}
          <div className="rounded-xl p-4 mb-6"
            style={{ backgroundColor: 'var(--color-accent-light)', border: '2px solid var(--color-accent)44' }}>
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--color-accent)' }}>YOUR MONTHLY INCOME</label>
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
              <input
                type="number"
                value={customIncome}
                onChange={(e) => handleIncomeChange(e.target.value)}
                className="flex-1 px-4 py-2 rounded-lg text-lg font-bold focus:ring-2 focus:border-transparent"
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  border: '2px solid var(--color-border-card)',
                  color: 'var(--color-text-primary)',
                  focusRingColor: 'var(--color-accent)',
                }}
                placeholder="5000"
              />
            </div>
            <p className="text-sm mt-2" style={{ color: 'var(--color-text-secondary)' }}>
              Templates will calculate budget amounts based on this income
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Template Selection */}
            <div className="space-y-4">
              <h3 className="font-bold text-lg flex items-center gap-2"
                style={{ color: 'var(--color-text-primary)' }}>
                <Target className="w-5 h-5" />
                SELECT TEMPLATE
              </h3>

              {BUDGET_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleTemplateSelect(template)}
                  className="w-full text-left p-4 rounded-xl border-2 transition-all"
                  style={selectedTemplate?.id === template.id
                    ? { borderColor: 'var(--color-accent)', backgroundColor: 'var(--color-accent-light)', boxShadow: 'var(--shadow-lg)' }
                    : { borderColor: 'var(--color-border-card)', backgroundColor: 'var(--color-bg-card)' }
                  }
                >
                  <div className="flex items-start gap-3">
                    <span className="text-3xl">{getTemplateIcon(template.targetAudience)}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>{template.name}</h4>
                        {template.targetAudience && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                            {template.targetAudience}
                          </span>
                        )}
                      </div>
                      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{template.description}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {template.categories.slice(0, 5).map((cat, idx) => (
                          <span key={idx} className="text-xs px-2 py-1 rounded"
                            style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>
                            {cat.icon} {cat.name}
                          </span>
                        ))}
                        {template.categories.length > 5 && (
                          <span className="text-xs px-2 py-1" style={{ color: 'var(--color-text-tertiary)' }}>
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
              <h3 className="font-bold text-lg flex items-center gap-2"
                style={{ color: 'var(--color-text-primary)' }}>
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

                  <div className="rounded-xl p-4 max-h-96 overflow-y-auto space-y-2"
                    style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                    {previewCategories.map((cat) => {
                      const templateCat = selectedTemplate.categories.find(tc => tc.name === cat.name);
                      return (
                        <div
                          key={cat.id}
                          className="rounded-lg p-3"
                          style={{
                            backgroundColor: 'var(--color-bg-card)',
                            border: '1px solid var(--color-border-card)',
                            borderLeftWidth: '4px',
                            borderLeftColor: cat.color
                          }}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{cat.icon}</span>
                              <span className="font-bold" style={{ color: 'var(--color-text-primary)' }}>{cat.name}</span>
                            </div>
                            <span className="font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>${cat.budget.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="uppercase font-medium" style={{ color: 'var(--color-text-secondary)' }}>{cat.type}</span>
                            <span style={{ color: 'var(--color-text-tertiary)' }}>{templateCat?.percentage}% of income</span>
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
                      className="flex-1 bg-emerald-600 text-white px-6 py-3 rounded-xl hover:bg-emerald-700 transition-colors font-bold flex items-center justify-center gap-2"
                    >
                      <Zap className="w-5 h-5" />
                      Apply Template
                    </button>
                    <button
                      onClick={onClose}
                      className="px-6 py-3 rounded-xl transition-colors font-medium"
                      style={{ border: '2px solid var(--color-border-card)', color: 'var(--color-text-secondary)' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl p-12 text-center"
                  style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                  <Target className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--color-text-tertiary)' }} />
                  <h4 className="font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>Select a Template</h4>
                  <p style={{ color: 'var(--color-text-secondary)' }}>Choose a budget template from the left to see the preview</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Comparison */}
          <div className="mt-6 rounded-xl p-4"
            style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
            <h4 className="font-bold text-sm mb-3" style={{ color: 'var(--color-text-primary)' }}>TEMPLATE COMPARISON</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="rounded-lg p-3"
                style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)' }}>
                <p className="font-bold text-blue-600 mb-1">Best for Beginners</p>
                <p style={{ color: 'var(--color-text-secondary)' }}>50/30/20 Rule - Simple and balanced</p>
              </div>
              <div className="rounded-lg p-3"
                style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)' }}>
                <p className="font-bold text-emerald-600 mb-1">Maximum Savings</p>
                <p style={{ color: 'var(--color-text-secondary)' }}>Aggressive Saver - 40% to savings/investments</p>
              </div>
              <div className="rounded-lg p-3"
                style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)' }}>
                <p className="font-bold text-rose-500 mb-1">Debt Elimination</p>
                <p style={{ color: 'var(--color-text-secondary)' }}>Debt Crusher - 40% to debt payoff</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
