
import React, { useState, useMemo } from 'react';
import { UserPreferences, Bill, Subscription, BillStatus, SubscriptionStatus, RecurringFrequency } from '../types';
import { DEFAULT_TRANSACTION_TYPES, DEFAULT_PREFERENCES, BUDGET_TEMPLATES } from '../constants';
import { ChevronRight, ChevronLeft, User, DollarSign, Wallet, CreditCard, Tv, Sparkles } from 'lucide-react';

interface SetupWizardProps {
  onComplete: (prefs: UserPreferences, initialBills?: Omit<Bill, 'id'>[], initialSubscriptions?: Omit<Subscription, 'id'>[]) => void;
  onCancel?: () => void;
  canCancel?: boolean;
}

interface Lifestyle {
  id: string;
  label: string;
  icon: string;
  description: string;
  templateId: string;
  accentColor: string;
}

const LIFESTYLES: Lifestyle[] = [
  { id: 'balanced', label: 'Balanced', icon: '⚖️', description: '50/30/20 needs, wants, savings', templateId: 'template-50-30-20', accentColor: '#4f46e5' },
  { id: 'military', label: 'Military', icon: '🎖️', description: 'BAH, BAS, TSP optimized', templateId: 'template-military', accentColor: '#1e40af' },
  { id: 'saver', label: 'Saver', icon: '🏦', description: 'Maximize savings & investments', templateId: 'template-aggressive-saver', accentColor: '#059669' },
  { id: 'debt-free', label: 'Debt Free', icon: '🎯', description: 'Aggressive debt payoff mode', templateId: 'template-debt-crusher', accentColor: '#dc2626' },
  { id: 'zero-based', label: 'Zero-Based', icon: '📋', description: 'Every dollar assigned a job', templateId: 'template-zero-based', accentColor: '#7c3aed' },
];

const COMMON_BILLS = [
  { name: 'Rent / Mortgage', icon: '🏠', amount: 1500, categoryHint: 'Housing', frequency: RecurringFrequency.MONTHLY },
  { name: 'Electric', icon: '⚡', amount: 120, categoryHint: 'Utilities', frequency: RecurringFrequency.MONTHLY },
  { name: 'Water', icon: '💧', amount: 60, categoryHint: 'Utilities', frequency: RecurringFrequency.MONTHLY },
  { name: 'Internet', icon: '📡', amount: 70, categoryHint: 'Internet/Cable', frequency: RecurringFrequency.MONTHLY },
  { name: 'Phone Bill', icon: '📱', amount: 80, categoryHint: 'Phone', frequency: RecurringFrequency.MONTHLY },
  { name: 'Car Payment', icon: '🚗', amount: 400, categoryHint: 'Transport', frequency: RecurringFrequency.MONTHLY },
  { name: 'Car Insurance', icon: '🛡️', amount: 150, categoryHint: 'Insurance', frequency: RecurringFrequency.MONTHLY },
  { name: 'Health Insurance', icon: '🏥', amount: 200, categoryHint: 'Insurance', frequency: RecurringFrequency.MONTHLY },
  { name: 'Student Loan', icon: '🎓', amount: 300, categoryHint: 'Debt', frequency: RecurringFrequency.MONTHLY },
  { name: 'Gas / Natural Gas', icon: '🔥', amount: 80, categoryHint: 'Utilities', frequency: RecurringFrequency.MONTHLY },
];

const COMMON_SUBSCRIPTIONS = [
  { name: 'Netflix', icon: '🎬', cost: 15.49, categoryHint: 'Subscriptions' },
  { name: 'Spotify', icon: '🎵', cost: 11.99, categoryHint: 'Subscriptions' },
  { name: 'Amazon Prime', icon: '📦', cost: 14.99, categoryHint: 'Subscriptions' },
  { name: 'YouTube Premium', icon: '▶️', cost: 13.99, categoryHint: 'Subscriptions' },
  { name: 'Disney+', icon: '🏰', cost: 13.99, categoryHint: 'Subscriptions' },
  { name: 'Hulu', icon: '📺', cost: 17.99, categoryHint: 'Subscriptions' },
  { name: 'Apple One / iCloud', icon: '🍎', cost: 19.95, categoryHint: 'Subscriptions' },
  { name: 'Gym Membership', icon: '💪', cost: 30, categoryHint: 'Fitness' },
  { name: 'HBO Max', icon: '🎭', cost: 15.99, categoryHint: 'Subscriptions' },
  { name: 'ChatGPT Plus', icon: '🤖', cost: 20, categoryHint: 'Subscriptions' },
];

const CURRENCIES = [
  { symbol: '$', label: 'USD' },
  { symbol: '€', label: 'EUR' },
  { symbol: '£', label: 'GBP' },
  { symbol: '¥', label: 'JPY' },
  { symbol: '₹', label: 'INR' },
  { symbol: '₱', label: 'PHP' },
  { symbol: '₩', label: 'KRW' },
  { symbol: 'R$', label: 'BRL' },
];

export const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete, onCancel, canCancel }) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('$');
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [selectedLifestyle, setSelectedLifestyle] = useState('balanced');
  const [selectedBills, setSelectedBills] = useState<Set<number>>(new Set());
  const [billAmounts, setBillAmounts] = useState<Map<number, number>>(
    new Map(COMMON_BILLS.map((b, i) => [i, b.amount]))
  );
  const [selectedSubs, setSelectedSubs] = useState<Set<number>>(new Set());
  const [subCosts, setSubCosts] = useState<Map<number, number>>(
    new Map(COMMON_SUBSCRIPTIONS.map((s, i) => [i, s.cost]))
  );

  const totalSteps = 6;
  const lifestyle = LIFESTYLES.find(l => l.id === selectedLifestyle) || LIFESTYLES[0];
  const template = BUDGET_TEMPLATES.find(t => t.id === lifestyle.templateId);

  const monthlyBillTotal = useMemo(() => {
    let total = 0;
    selectedBills.forEach(i => { total += billAmounts.get(i) || 0; });
    return total;
  }, [selectedBills, billAmounts]);

  const monthlySubTotal = useMemo(() => {
    let total = 0;
    selectedSubs.forEach(i => { total += subCosts.get(i) || 0; });
    return total;
  }, [selectedSubs, subCosts]);

  const toggleBill = (index: number) => {
    const next = new Set(selectedBills);
    next.has(index) ? next.delete(index) : next.add(index);
    setSelectedBills(next);
  };

  const toggleSub = (index: number) => {
    const next = new Set(selectedSubs);
    next.has(index) ? next.delete(index) : next.add(index);
    setSelectedSubs(next);
  };

  const handleNext = () => step < totalSteps ? setStep(step + 1) : handleFinish();
  const handleBack = () => step > 1 && setStep(step - 1);

  const handleFinish = () => {
    const income = parseFloat(monthlyIncome) || 0;

    const prefs: UserPreferences = {
      name,
      currency,
      privacyMode: false,
      accentColor: lifestyle.accentColor,
      setupComplete: true,
      transactionTypes: DEFAULT_TRANSACTION_TYPES,
      profileImage: undefined,
      notificationSettings: DEFAULT_PREFERENCES.notificationSettings,
      billReminderSettings: DEFAULT_PREFERENCES.billReminderSettings,
      smartCategorizationEnabled: true,
      theme: 'system',
      persona: selectedLifestyle === 'military' ? 'military' : 'standard',
      monthlyIncome: income > 0 ? income : undefined,
      budgetTemplate: lifestyle.templateId,
    };

    // Build initial bills
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const initialBills: Omit<Bill, 'id'>[] = [];
    selectedBills.forEach(index => {
      const bill = COMMON_BILLS[index];
      const amount = billAmounts.get(index) || bill.amount;
      initialBills.push({
        name: bill.name,
        amount,
        dueDate: nextMonth.toISOString().split('T')[0],
        categoryId: '', // Will be resolved by App.tsx based on categoryHint
        isRecurring: true,
        frequency: bill.frequency,
        status: BillStatus.UPCOMING,
        notes: `Added during setup (${bill.categoryHint})`,
      });
    });

    // Build initial subscriptions
    const initialSubs: Omit<Subscription, 'id'>[] = [];
    selectedSubs.forEach(index => {
      const sub = COMMON_SUBSCRIPTIONS[index];
      const cost = subCosts.get(index) || sub.cost;
      initialSubs.push({
        name: sub.name,
        cost,
        billingCycle: RecurringFrequency.MONTHLY,
        categoryId: '', // Will be resolved by App.tsx
        startDate: today.toISOString().split('T')[0],
        nextBillingDate: nextMonth.toISOString().split('T')[0],
        status: SubscriptionStatus.ACTIVE,
        notes: `Added during setup (${sub.categoryHint})`,
      });
    });

    onComplete(prefs, initialBills.length > 0 ? initialBills : undefined, initialSubs.length > 0 ? initialSubs : undefined);
  };

  const canProceed = () => {
    if (step === 1) return name.trim().length > 0;
    return true;
  };

  const progressPercent = (step / totalSteps) * 100;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4338ca 100%)' }}>
      <div className="max-w-lg w-full rounded-[2rem] shadow-2xl p-6 md:p-10 space-y-8 relative overflow-hidden"
        style={{ backgroundColor: 'var(--color-bg-secondary)' }}>

        {/* Progress Bar */}
        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%`, backgroundColor: lifestyle.accentColor }}
          />
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-tertiary)' }}>
            Step {step} of {totalSteps}
          </p>
          {canCancel && (
            <button onClick={onCancel} className="text-xs font-bold uppercase tracking-wide transition-colors"
              style={{ color: 'var(--color-text-tertiary)' }}>
              Cancel
            </button>
          )}
        </div>

        {/* Step Content */}
        <div className="min-h-[320px] flex flex-col">

          {/* Step 1: Welcome + Name */}
          {step === 1 && (
            <div className="space-y-6 flex-1 flex flex-col justify-center">
              <div className="text-center space-y-3">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto shadow-lg"
                  style={{ background: `linear-gradient(135deg, ${lifestyle.accentColor}, #7c3aed)` }}>
                  <span className="text-4xl">💰</span>
                </div>
                <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
                  Welcome to Wingman
                </h2>
                <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                  Smart budgeting that works for you
                </p>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2"
                  style={{ color: 'var(--color-text-secondary)' }}>
                  <User className="w-3 h-3 inline mr-1" />
                  What should we call you?
                </label>
                <input
                  type="text" autoFocus value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-xl px-5 py-4 text-base font-semibold outline-none transition-all focus:ring-2"
                  style={{
                    backgroundColor: 'var(--color-bg-tertiary)',
                    border: '2px solid var(--color-border-card)',
                    color: 'var(--color-text-primary)',
                    '--tw-ring-color': lifestyle.accentColor,
                  } as React.CSSProperties}
                />
              </div>
            </div>
          )}

          {/* Step 2: Lifestyle / Budget Template */}
          {step === 2 && (
            <div className="space-y-5 flex-1">
              <div className="text-center space-y-1">
                <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
                  Choose Your Style
                </h2>
                <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  This sets your budget template — you can customize later
                </p>
              </div>
              <div className="space-y-2">
                {LIFESTYLES.map(ls => (
                  <button
                    key={ls.id}
                    onClick={() => setSelectedLifestyle(ls.id)}
                    className="w-full p-4 rounded-xl flex items-center gap-4 transition-all text-left"
                    style={selectedLifestyle === ls.id
                      ? { backgroundColor: `${ls.accentColor}15`, border: `2px solid ${ls.accentColor}`, boxShadow: `0 0 0 1px ${ls.accentColor}30` }
                      : { backgroundColor: 'var(--color-bg-tertiary)', border: '2px solid var(--color-border-card)' }
                    }
                  >
                    <span className="text-2xl">{ls.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm" style={{ color: selectedLifestyle === ls.id ? ls.accentColor : 'var(--color-text-primary)' }}>
                        {ls.label}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                        {ls.description}
                      </p>
                    </div>
                    {selectedLifestyle === ls.id && (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: ls.accentColor }}>
                        <span className="text-white text-xs font-bold">✓</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
              {/* Template Preview */}
              {template && (
                <div className="rounded-xl p-3 space-y-2" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
                    Budget Breakdown
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {template.categories.map((cat, i) => (
                      <span key={i} className="text-xs px-2 py-1 rounded-lg font-medium"
                        style={{ backgroundColor: `${cat.color}20`, color: cat.color }}>
                        {cat.icon} {cat.name} {cat.percentage}%
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Currency + Income */}
          {step === 3 && (
            <div className="space-y-6 flex-1 flex flex-col justify-center">
              <div className="text-center space-y-1">
                <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
                  Your Money
                </h2>
                <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  Currency and income for budget calculations
                </p>
              </div>

              {/* Currency Grid */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2"
                  style={{ color: 'var(--color-text-secondary)' }}>
                  <DollarSign className="w-3 h-3 inline mr-1" />
                  Currency
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {CURRENCIES.map(c => (
                    <button
                      key={c.symbol} onClick={() => setCurrency(c.symbol)}
                      className="h-14 rounded-xl border-2 text-center transition-all"
                      style={currency === c.symbol
                        ? { borderColor: lifestyle.accentColor, backgroundColor: `${lifestyle.accentColor}15`, color: lifestyle.accentColor }
                        : { borderColor: 'var(--color-border-card)', backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' }
                      }
                    >
                      <span className="text-lg font-bold block">{c.symbol}</span>
                      <span className="text-[10px] font-medium">{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Monthly Income */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2"
                  style={{ color: 'var(--color-text-secondary)' }}>
                  <Wallet className="w-3 h-3 inline mr-1" />
                  Monthly Take-Home Income <span style={{ color: 'var(--color-text-tertiary)' }}>(optional)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold" style={{ color: 'var(--color-text-tertiary)' }}>
                    {currency}
                  </span>
                  <input
                    type="number"
                    value={monthlyIncome}
                    onChange={e => setMonthlyIncome(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-xl pl-10 pr-5 py-4 text-base font-semibold outline-none transition-all focus:ring-2"
                    style={{
                      backgroundColor: 'var(--color-bg-tertiary)',
                      border: '2px solid var(--color-border-card)',
                      color: 'var(--color-text-primary)',
                    }}
                  />
                </div>
                <p className="text-xs mt-2" style={{ color: 'var(--color-text-tertiary)' }}>
                  Used to calculate budget percentages. You can update this anytime.
                </p>
              </div>
            </div>
          )}

          {/* Step 4: Common Bills */}
          {step === 4 && (
            <div className="space-y-4 flex-1">
              <div className="text-center space-y-1">
                <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
                  <CreditCard className="w-5 h-5 inline mr-2" />
                  Your Bills
                </h2>
                <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  Select the bills you pay regularly — tap to toggle, edit amounts
                </p>
              </div>
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {COMMON_BILLS.map((bill, index) => {
                  const isSelected = selectedBills.has(index);
                  return (
                    <div key={index}
                      className="flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer"
                      style={isSelected
                        ? { backgroundColor: `${lifestyle.accentColor}10`, border: `2px solid ${lifestyle.accentColor}` }
                        : { backgroundColor: 'var(--color-bg-tertiary)', border: '2px solid var(--color-border-card)' }
                      }
                    >
                      <button onClick={() => toggleBill(index)} className="flex items-center gap-3 flex-1 text-left">
                        <span className="text-xl">{bill.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>{bill.name}</p>
                          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{bill.categoryHint}</p>
                        </div>
                      </button>
                      {isSelected && (
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold" style={{ color: 'var(--color-text-tertiary)' }}>{currency}</span>
                          <input
                            type="number"
                            value={billAmounts.get(index) || ''}
                            onChange={e => {
                              const next = new Map(billAmounts);
                              next.set(index, parseFloat(e.target.value) || 0);
                              setBillAmounts(next);
                            }}
                            onClick={e => e.stopPropagation()}
                            className="w-20 text-right rounded-lg px-2 py-1.5 text-sm font-bold outline-none focus:ring-2"
                            style={{
                              backgroundColor: 'var(--color-bg-secondary)',
                              border: '1px solid var(--color-border-card)',
                              color: 'var(--color-text-primary)',
                            }}
                          />
                        </div>
                      )}
                      {!isSelected && (
                        <span className="text-xs font-bold" style={{ color: 'var(--color-text-tertiary)' }}>
                          {currency}{bill.amount}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              {selectedBills.size > 0 && (
                <div className="text-center py-2 rounded-xl" style={{ backgroundColor: `${lifestyle.accentColor}10` }}>
                  <p className="text-sm font-bold" style={{ color: lifestyle.accentColor }}>
                    {selectedBills.size} bill{selectedBills.size > 1 ? 's' : ''} — {currency}{monthlyBillTotal.toFixed(2)}/mo
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 5: Common Subscriptions */}
          {step === 5 && (
            <div className="space-y-4 flex-1">
              <div className="text-center space-y-1">
                <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
                  <Tv className="w-5 h-5 inline mr-2" />
                  Your Subscriptions
                </h2>
                <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  Select the services you're subscribed to
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-[280px] overflow-y-auto pr-1">
                {COMMON_SUBSCRIPTIONS.map((sub, index) => {
                  const isSelected = selectedSubs.has(index);
                  return (
                    <button key={index} onClick={() => toggleSub(index)}
                      className="p-3 rounded-xl transition-all text-left"
                      style={isSelected
                        ? { backgroundColor: `${lifestyle.accentColor}10`, border: `2px solid ${lifestyle.accentColor}` }
                        : { backgroundColor: 'var(--color-bg-tertiary)', border: '2px solid var(--color-border-card)' }
                      }
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{sub.icon}</span>
                        <span className="font-semibold text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>{sub.name}</span>
                      </div>
                      {isSelected ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold" style={{ color: 'var(--color-text-tertiary)' }}>{currency}</span>
                          <input
                            type="number"
                            value={subCosts.get(index) || ''}
                            onChange={e => {
                              const next = new Map(subCosts);
                              next.set(index, parseFloat(e.target.value) || 0);
                              setSubCosts(next);
                            }}
                            onClick={e => e.stopPropagation()}
                            className="w-16 text-right rounded-lg px-2 py-1 text-xs font-bold outline-none focus:ring-1"
                            style={{
                              backgroundColor: 'var(--color-bg-secondary)',
                              border: '1px solid var(--color-border-card)',
                              color: 'var(--color-text-primary)',
                            }}
                          />
                          <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>/mo</span>
                        </div>
                      ) : (
                        <p className="text-xs font-bold" style={{ color: 'var(--color-text-tertiary)' }}>
                          {currency}{sub.cost}/mo
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
              {selectedSubs.size > 0 && (
                <div className="text-center py-2 rounded-xl" style={{ backgroundColor: `${lifestyle.accentColor}10` }}>
                  <p className="text-sm font-bold" style={{ color: lifestyle.accentColor }}>
                    {selectedSubs.size} subscription{selectedSubs.size > 1 ? 's' : ''} — {currency}{monthlySubTotal.toFixed(2)}/mo
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 6: Summary */}
          {step === 6 && (
            <div className="space-y-5 flex-1 flex flex-col justify-center">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
                  style={{ background: `linear-gradient(135deg, ${lifestyle.accentColor}, #7c3aed)` }}>
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
                  You're All Set, {name}!
                </h2>
                <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  Here's your setup summary
                </p>
              </div>

              <div className="space-y-3">
                {/* Budget Style */}
                <div className="flex items-center justify-between p-3 rounded-xl"
                  style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{lifestyle.icon}</span>
                    <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Budget Style</span>
                  </div>
                  <span className="text-sm font-bold" style={{ color: lifestyle.accentColor }}>{lifestyle.label}</span>
                </div>

                {/* Income */}
                {monthlyIncome && parseFloat(monthlyIncome) > 0 && (
                  <div className="flex items-center justify-between p-3 rounded-xl"
                    style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                    <div className="flex items-center gap-3">
                      <span className="text-xl">💰</span>
                      <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Monthly Income</span>
                    </div>
                    <span className="text-sm font-bold" style={{ color: '#10b981' }}>{currency}{parseFloat(monthlyIncome).toLocaleString()}</span>
                  </div>
                )}

                {/* Bills */}
                <div className="flex items-center justify-between p-3 rounded-xl"
                  style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📋</span>
                    <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Bills</span>
                  </div>
                  <span className="text-sm font-bold" style={{ color: 'var(--color-text-secondary)' }}>
                    {selectedBills.size > 0 ? `${selectedBills.size} — ${currency}${monthlyBillTotal.toFixed(0)}/mo` : 'None'}
                  </span>
                </div>

                {/* Subscriptions */}
                <div className="flex items-center justify-between p-3 rounded-xl"
                  style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📺</span>
                    <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Subscriptions</span>
                  </div>
                  <span className="text-sm font-bold" style={{ color: 'var(--color-text-secondary)' }}>
                    {selectedSubs.size > 0 ? `${selectedSubs.size} — ${currency}${monthlySubTotal.toFixed(0)}/mo` : 'None'}
                  </span>
                </div>

                {/* Monthly Overview */}
                {monthlyIncome && parseFloat(monthlyIncome) > 0 && (
                  <div className="p-4 rounded-xl text-center"
                    style={{ backgroundColor: `${lifestyle.accentColor}10`, border: `1px solid ${lifestyle.accentColor}30` }}>
                    <p className="text-xs uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--color-text-tertiary)' }}>
                      Estimated Monthly Budget
                    </p>
                    <p className="text-lg font-bold" style={{ color: lifestyle.accentColor }}>
                      {currency}{(parseFloat(monthlyIncome) - monthlyBillTotal - monthlySubTotal).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                      after bills & subscriptions
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex gap-3">
          {step > 1 && (
            <button onClick={handleBack}
              className="flex items-center justify-center gap-1 px-6 py-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
              style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          )}
          <button
            disabled={!canProceed()}
            onClick={handleNext}
            className="flex-1 text-white py-4 rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ backgroundColor: lifestyle.accentColor }}
          >
            {step === totalSteps ? (
              <>
                <Sparkles className="w-4 h-4" />
                Get Started
              </>
            ) : (
              <>
                Continue
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
