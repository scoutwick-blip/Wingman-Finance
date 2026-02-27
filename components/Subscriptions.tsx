import React, { useState, useMemo } from 'react';
import { Subscription, SubscriptionStatus, Category, RecurringFrequency, NotificationType, Account } from '../types';
import { Calendar, DollarSign, AlertTriangle, TrendingUp, Zap, Trash2, Edit2, ExternalLink } from 'lucide-react';

interface SubscriptionsProps {
  subscriptions: Subscription[];
  categories: Category[];
  accounts: Account[];
  currency: string;
  onAddSubscription: (subscription: Subscription) => void;
  onEditSubscription: (subscription: Subscription) => void;
  onDeleteSubscription: (subscriptionId: string) => void;
  onAddNotification: (type: NotificationType, title: string, message: string) => void;
}

export default function Subscriptions({
  subscriptions,
  categories,
  accounts,
  currency,
  onAddSubscription,
  onEditSubscription,
  onDeleteSubscription,
  onAddNotification
}: SubscriptionsProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    cost: '',
    billingCycle: RecurringFrequency.MONTHLY,
    categoryId: categories[0]?.id || '',
    accountId: accounts.find(a => a.isDefault)?.id || accounts[0]?.id || '',
    startDate: new Date().toISOString().split('T')[0],
    status: SubscriptionStatus.ACTIVE,
    trialEndDate: '',
    cancellationUrl: '',
    notes: ''
  });

  // Calculate next billing date
  const calculateNextBilling = (startDate: string, cycle: RecurringFrequency): string => {
    const date = new Date(startDate);
    const today = new Date();

    while (date <= today) {
      switch (cycle) {
        case RecurringFrequency.WEEKLY:
          date.setDate(date.getDate() + 7);
          break;
        case RecurringFrequency.BI_WEEKLY:
          date.setDate(date.getDate() + 14);
          break;
        case RecurringFrequency.MONTHLY:
          date.setMonth(date.getMonth() + 1);
          break;
        case RecurringFrequency.YEARLY:
          date.setFullYear(date.getFullYear() + 1);
          break;
      }
    }

    return date.toISOString().split('T')[0];
  };

  // Analytics
  const analytics = useMemo(() => {
    const active = subscriptions.filter(s => s.status === SubscriptionStatus.ACTIVE);
    const trials = subscriptions.filter(s => s.status === SubscriptionStatus.TRIAL);

    const monthlyTotal = active.reduce((sum, sub) => {
      switch (sub.billingCycle) {
        case RecurringFrequency.WEEKLY:
          return sum + (sub.cost * 52 / 12);
        case RecurringFrequency.BI_WEEKLY:
          return sum + (sub.cost * 26 / 12);
        case RecurringFrequency.MONTHLY:
          return sum + sub.cost;
        case RecurringFrequency.YEARLY:
          return sum + (sub.cost / 12);
        default:
          return sum;
      }
    }, 0);

    const yearlyTotal = monthlyTotal * 12;

    const mostExpensive = active.length > 0
      ? active.reduce((max, sub) => {
          const monthlyCost = sub.billingCycle === RecurringFrequency.YEARLY
            ? sub.cost / 12
            : sub.billingCycle === RecurringFrequency.WEEKLY
            ? sub.cost * 52 / 12
            : sub.billingCycle === RecurringFrequency.BI_WEEKLY
            ? sub.cost * 26 / 12
            : sub.cost;
          const maxMonthlyCost = max.billingCycle === RecurringFrequency.YEARLY
            ? max.cost / 12
            : max.billingCycle === RecurringFrequency.WEEKLY
            ? max.cost * 52 / 12
            : max.billingCycle === RecurringFrequency.BI_WEEKLY
            ? max.cost * 26 / 12
            : max.cost;
          return monthlyCost > maxMonthlyCost ? sub : max;
        })
      : null;

    return {
      activeCount: active.length,
      trialCount: trials.length,
      monthlyTotal,
      yearlyTotal,
      mostExpensive
    };
  }, [subscriptions]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const nextBillingDate = calculateNextBilling(formData.startDate, formData.billingCycle);

    const subscription: Subscription = {
      id: editingSubscription?.id || `sub-${Date.now()}`,
      name: formData.name,
      cost: parseFloat(formData.cost),
      billingCycle: formData.billingCycle,
      categoryId: formData.categoryId,
      accountId: formData.accountId || undefined,
      startDate: formData.startDate,
      nextBillingDate,
      status: formData.status,
      trialEndDate: formData.trialEndDate || undefined,
      cancellationUrl: formData.cancellationUrl || undefined,
      notes: formData.notes || undefined
    };

    if (editingSubscription) {
      onEditSubscription(subscription);
      onAddNotification(NotificationType.SUCCESS, 'Subscription Updated', `Updated ${subscription.name}`);
    } else {
      onAddSubscription(subscription);
      onAddNotification(NotificationType.SUCCESS, 'Subscription Added', `Added ${subscription.name} - ${currency}${subscription.cost.toFixed(2)}/${subscription.billingCycle}`);
    }

    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      cost: '',
      billingCycle: RecurringFrequency.MONTHLY,
      categoryId: categories[0]?.id || '',
      accountId: accounts.find(a => a.isDefault)?.id || accounts[0]?.id || '',
      startDate: new Date().toISOString().split('T')[0],
      status: SubscriptionStatus.ACTIVE,
      trialEndDate: '',
      cancellationUrl: '',
      notes: ''
    });
    setEditingSubscription(null);
    setShowForm(false);
  };

  const handleEdit = (subscription: Subscription) => {
    setEditingSubscription(subscription);
    setFormData({
      name: subscription.name,
      cost: subscription.cost.toString(),
      billingCycle: subscription.billingCycle,
      categoryId: subscription.categoryId,
      accountId: subscription.accountId || accounts.find(a => a.isDefault)?.id || accounts[0]?.id || '',
      startDate: subscription.startDate,
      status: subscription.status,
      trialEndDate: subscription.trialEndDate || '',
      cancellationUrl: subscription.cancellationUrl || '',
      notes: subscription.notes || ''
    });
    setShowForm(true);
  };

  const handleDelete = (subscription: Subscription) => {
    if (confirm(`Delete subscription "${subscription.name}"?`)) {
      onDeleteSubscription(subscription.id);
      onAddNotification(NotificationType.INFO, 'Subscription Deleted', `Deleted ${subscription.name}`);
    }
  };

  const getCategoryName = (categoryId: string) => {
    return categories.find(c => c.id === categoryId)?.name || 'Unknown';
  };

  const getStatusColor = (status: SubscriptionStatus): { className: string; style?: React.CSSProperties } => {
    switch (status) {
      case SubscriptionStatus.ACTIVE: return { className: 'bg-green-100 text-green-800 border-green-300' };
      case SubscriptionStatus.TRIAL: return { className: 'bg-blue-100 text-blue-800 border-blue-300' };
      case SubscriptionStatus.CANCELLED: return {
        className: 'border',
        style: {
          backgroundColor: 'var(--color-bg-tertiary)',
          color: 'var(--color-text-primary)',
          borderColor: 'var(--color-border-primary)'
        }
      };
      case SubscriptionStatus.EXPIRED: return { className: 'bg-red-100 text-red-800 border-red-300' };
    }
  };

  const groupedSubscriptions = useMemo(() => {
    return {
      active: subscriptions.filter(s => s.status === SubscriptionStatus.ACTIVE),
      trial: subscriptions.filter(s => s.status === SubscriptionStatus.TRIAL),
      cancelled: subscriptions.filter(s => s.status === SubscriptionStatus.CANCELLED)
    };
  }, [subscriptions]);

  const renderSubscriptionCard = (sub: Subscription) => {
    const category = categories.find(c => c.id === sub.categoryId);
    const account = accounts.find(a => a.id === sub.accountId);
    const daysUntilBilling = Math.ceil((new Date(sub.nextBillingDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    const daysUntilTrialEnd = sub.trialEndDate
      ? Math.ceil((new Date(sub.trialEndDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const statusColor = getStatusColor(sub.status);

    return (
      <div
        key={sub.id}
        className={`rounded-xl p-4 border-2 ${statusColor.className} hover:shadow-lg transition-all`}
        style={{ backgroundColor: 'var(--color-bg-card)', ...statusColor.style }}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{category?.icon || '📱'}</span>
              <h3 className="font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>{sub.name}</h3>
            </div>
            <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>{getCategoryName(sub.categoryId)}</p>
            {account && (
              <p className="text-xs flex items-center gap-1 mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                <span>{account.icon}</span>
                <span>{account.name}</span>
              </p>
            )}
            {sub.status === SubscriptionStatus.TRIAL && daysUntilTrialEnd !== null && (
              <p className="text-xs text-blue-600 font-medium mt-1">
                Trial ends in {daysUntilTrialEnd} days
              </p>
            )}
          </div>
          <div className="text-right">
            <span className="font-bold text-xl" style={{ color: 'var(--color-text-primary)' }}>{currency}{sub.cost.toFixed(2)}</span>
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>/{sub.billingCycle}</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" style={{ color: 'var(--color-text-tertiary)' }} />
            <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>Next: {new Date(sub.nextBillingDate).toLocaleDateString()}</span>
          </div>
          {sub.status === SubscriptionStatus.ACTIVE && (
            <span className={`font-medium ${daysUntilBilling <= 7 ? 'text-orange-600' : ''}`} style={daysUntilBilling <= 7 ? undefined : { color: 'var(--color-text-tertiary)' }}>
              {daysUntilBilling} days
            </span>
          )}
        </div>

        {sub.notes && (
          <p className="text-sm mb-3 italic" style={{ color: 'var(--color-text-tertiary)' }}>{sub.notes}</p>
        )}

        <div className="flex gap-2">
          {sub.cancellationUrl && (
            <a
              href={sub.cancellationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
            >
              <ExternalLink className="w-4 h-4" />
              Cancel
            </a>
          )}
          <button
            onClick={() => handleEdit(sub)}
            className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(sub)}
            className="text-white px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
            style={{ backgroundColor: 'var(--color-text-tertiary)' }}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-primary)' }}>SUBSCRIPTIONS</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-tertiary)' }}>Track and manage recurring services</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium"
        >
          <Zap className="w-5 h-5" />
          Add Subscription
        </button>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-100 uppercase">Active</p>
              <p className="text-3xl font-bold">{analytics.activeCount}</p>
            </div>
            <Zap className="w-8 h-8 text-blue-200" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-600 to-emerald-700 text-white rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-100 uppercase">Monthly Total</p>
              <p className="text-3xl font-bold">{currency}{analytics.monthlyTotal.toFixed(2)}</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-200" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-600 to-pink-700 text-white rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-100 uppercase">Yearly Total</p>
              <p className="text-3xl font-bold">{currency}{analytics.yearlyTotal.toFixed(2)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-200" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-orange-600 to-red-700 text-white rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-100 uppercase">Free Trials</p>
              <p className="text-3xl font-bold">{analytics.trialCount}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-orange-200" />
          </div>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="rounded-2xl p-6 shadow-lg" style={{ backgroundColor: 'var(--color-bg-card)', border: '2px solid var(--color-border-card)' }}>
          <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>{editingSubscription ? 'Edit Subscription' : 'Add New Subscription'}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Service Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-card)' }}
                  placeholder="Netflix, Spotify, etc."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Cost</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.cost}
                  onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-card)' }}
                  placeholder="9.99"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Billing Cycle</label>
                <select
                  value={formData.billingCycle}
                  onChange={(e) => setFormData({ ...formData, billingCycle: e.target.value as RecurringFrequency })}
                  className="w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-card)' }}
                >
                  {Object.values(RecurringFrequency).map(freq => (
                    <option key={freq} value={freq}>{freq}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Category</label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-card)' }}
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Account</label>
                <select
                  value={formData.accountId}
                  onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-card)' }}
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.icon} {acc.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Start Date</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-card)' }}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as SubscriptionStatus })}
                  className="w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-card)' }}
                >
                  {Object.values(SubscriptionStatus).map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Trial End Date (Optional)</label>
                <input
                  type="date"
                  value={formData.trialEndDate}
                  onChange={(e) => setFormData({ ...formData, trialEndDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-card)' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Cancellation URL (Optional)</label>
                <input
                  type="url"
                  value={formData.cancellationUrl}
                  onChange={(e) => setFormData({ ...formData, cancellationUrl: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-card)' }}
                  placeholder="https://..."
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Notes (Optional)</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-card)' }}
                rows={2}
                placeholder="Additional details..."
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                {editingSubscription ? 'Update Subscription' : 'Add Subscription'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 rounded-lg transition-colors font-medium"
                style={{ border: '2px solid var(--color-border-card)', color: 'var(--color-text-primary)', backgroundColor: 'var(--color-bg-card)' }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Subscriptions List */}
      {groupedSubscriptions.active.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-green-600 mb-3 flex items-center gap-2">
            <Zap className="w-5 h-5" />
            ACTIVE SUBSCRIPTIONS
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groupedSubscriptions.active.map(renderSubscriptionCard)}
          </div>
        </div>
      )}

      {groupedSubscriptions.trial.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-blue-600 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            FREE TRIALS
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groupedSubscriptions.trial.map(renderSubscriptionCard)}
          </div>
        </div>
      )}

      {groupedSubscriptions.cancelled.length > 0 && (
        <div>
          <h3 className="text-lg font-bold mb-3" style={{ color: 'var(--color-text-tertiary)' }}>CANCELLED</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groupedSubscriptions.cancelled.map(renderSubscriptionCard)}
          </div>
        </div>
      )}

      {subscriptions.length === 0 && (
        <div className="text-center py-12 rounded-2xl" style={{ backgroundColor: 'var(--color-bg-card)' }}>
          <Zap className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--color-text-tertiary)' }} />
          <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>No Subscriptions Yet</h3>
          <p className="mb-4" style={{ color: 'var(--color-text-tertiary)' }}>Start tracking your recurring services</p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Add Your First Subscription
          </button>
        </div>
      )}
    </div>
  );
}
